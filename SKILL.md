---
name: gas-oracle-api
provider: psydack
version: 1.0.0
generated: 2026-02-10T00:00:00.000Z
source: https://www.clawmart.xyz
endpoints: 1
---

# Gas Oracle API

Provider: **psydack** | Network: **base** | Protocol: **x402**

### POST /api/gas

Get EIP-1559 gas suggestions for base or ethereum.

Response contains:
- `baseFeePerGas`
- `tiers.slow|standard|fast.maxPriorityFeePerGas`
- `tiers.slow|standard|fast.maxFeePerGas`
- `cache.hit` and `cache.ttlMs`
