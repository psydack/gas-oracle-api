const RPC_BY_CHAIN = {
  base: 'https://mainnet.base.org',
  ethereum: 'https://cloudflare-eth.com'
};

function toGwei(hexValue) {
  return Number(BigInt(hexValue) / 1000000000n);
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
  const rpcUrl = RPC_BY_CHAIN[chain];
  if (!rpcUrl) {
    throw new Error('unsupported_chain');
  }

  const [baseFeePerGas, priorityFee] = await Promise.all([
    rpc(rpcUrl, 'eth_gasPrice'),
    rpc(rpcUrl, 'eth_maxPriorityFeePerGas').catch(() => '0x77359400')
  ]);

  const base = toGwei(baseFeePerGas);
  const priority = Math.max(1, toGwei(priorityFee));

  return {
    chain,
    unit: 'gwei',
    slow: Math.max(1, base),
    standard: Math.max(1, base + priority),
    fast: Math.max(1, base + priority * 2),
    fetchedAt: new Date().toISOString()
  };
}

module.exports = {
  RPC_BY_CHAIN,
  getGasSnapshot
};
