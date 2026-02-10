# Gas Oracle API

x402 API for EIP-1559 gas suggestions on Base and Ethereum.

## Endpoint

### POST /api/gas

Request:

```json
{ "chain": "base" }
```

Response:

```json
{
  "chain": "base",
  "model": "eip1559",
  "unit": "gwei",
  "baseFeePerGas": 1.02,
  "tiers": {
    "slow": { "maxPriorityFeePerGas": 1, "maxFeePerGas": 3.04 },
    "standard": { "maxPriorityFeePerGas": 1.5, "maxFeePerGas": 3.54 },
    "fast": { "maxPriorityFeePerGas": 2, "maxFeePerGas": 4.04 }
  },
  "cache": { "hit": false, "ttlMs": 10000 }
}
```

Notes:
- Uses `eth_getBlockByNumber(pending)` for `baseFeePerGas`.
- Uses `eth_feeHistory` percentiles (10/50/90) for tip tiers.
- In-memory cache and IP rate limiting enabled.
