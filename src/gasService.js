const RPC_BY_CHAIN = {
  base: 'https://mainnet.base.org',
  ethereum: 'https://cloudflare-eth.com'
};

const CACHE_TTL_MS = Number(process.env.GAS_CACHE_TTL_MS || 10000);
const CACHE = new Map();

function toBigInt(hexValue, fallback = 0n) {
  if (!hexValue || hexValue === '0x') {
    return fallback;
  }
  return BigInt(hexValue);
}

function weiToGwei(wei) {
  return Number(wei) / 1e9;
}

function roundGwei(value) {
  return Number(value.toFixed(6));
}

function getPercentileTip(feeHistory, percentileIndex, fallbackTipWei) {
  const rewards = Array.isArray(feeHistory?.reward) ? feeHistory.reward : [];
  const values = rewards
    .map((row) => (Array.isArray(row) ? row[percentileIndex] : null))
    .filter(Boolean)
    .map((hex) => toBigInt(hex))
    .filter((v) => v > 0n);

  if (values.length === 0) {
    return fallbackTipWei;
  }

  values.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return values[Math.floor(values.length / 2)];
}

async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });

  if (!response.ok) {
    throw new Error(`rpc_http_${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`rpc_error_${data.error.code}`);
  }

  return data.result;
}

async function getGasSnapshot(chain) {
  const now = Date.now();
  const cached = CACHE.get(chain);
  if (cached && now - cached.createdAt < CACHE_TTL_MS) {
    return { ...cached.value, cache: { hit: true, ttlMs: CACHE_TTL_MS } };
  }

  const rpcUrl = RPC_BY_CHAIN[chain];
  if (!rpcUrl) {
    throw new Error('unsupported_chain');
  }

  const [pendingBlock, feeHistory, priorityFeeHex] = await Promise.all([
    rpc(rpcUrl, 'eth_getBlockByNumber', ['pending', false]),
    rpc(rpcUrl, 'eth_feeHistory', ['0xA', 'pending', [10, 50, 90]]).catch(() => null),
    rpc(rpcUrl, 'eth_maxPriorityFeePerGas').catch(() => '0x3b9aca00')
  ]);

  const fallbackTipWei = toBigInt(priorityFeeHex, 1_000_000_000n);
  const baseFeeWei = toBigInt(pendingBlock?.baseFeePerGas, 0n);

  const tipSlowWei = getPercentileTip(feeHistory, 0, fallbackTipWei);
  const tipStandardWei = getPercentileTip(feeHistory, 1, fallbackTipWei);
  const tipFastWei = getPercentileTip(feeHistory, 2, fallbackTipWei);

  const maxFeeSlowWei = baseFeeWei * 2n + tipSlowWei;
  const maxFeeStandardWei = baseFeeWei * 2n + tipStandardWei;
  const maxFeeFastWei = baseFeeWei * 2n + tipFastWei;

  const value = {
    chain,
    model: 'eip1559',
    unit: 'gwei',
    tiers: {
      slow: {
        maxPriorityFeePerGas: roundGwei(weiToGwei(tipSlowWei)),
        maxFeePerGas: roundGwei(weiToGwei(maxFeeSlowWei))
      },
      standard: {
        maxPriorityFeePerGas: roundGwei(weiToGwei(tipStandardWei)),
        maxFeePerGas: roundGwei(weiToGwei(maxFeeStandardWei))
      },
      fast: {
        maxPriorityFeePerGas: roundGwei(weiToGwei(tipFastWei)),
        maxFeePerGas: roundGwei(weiToGwei(maxFeeFastWei))
      }
    },
    baseFeePerGas: roundGwei(weiToGwei(baseFeeWei)),
    fetchedAt: new Date().toISOString(),
    cache: { hit: false, ttlMs: CACHE_TTL_MS }
  };

  // Keep in-memory cache per chain to reduce RPC load and smooth spikes.
  CACHE.set(chain, { createdAt: now, value });

  return value;
}

module.exports = {
  RPC_BY_CHAIN,
  getGasSnapshot,
  __internal: {
    CACHE,
    getPercentileTip,
    weiToGwei
  }
};
