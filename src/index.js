require('dotenv').config();
const express = require('express');
const { paymentMiddleware } = require('@x402/express');
const { x402ResourceServer, HTTPFacilitatorClient } = require('@x402/core/server');
const { registerExactEvmScheme } = require('@x402/evm/exact/server');
const { getGasSnapshot } = require('./gasService');

const app = express();
app.use(express.json());

const WALLET_ADDRESS = process.env.WALLET_ADDRESS;
const PORT = process.env.APP_PORT || process.env.PORT || 3000;
const FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://x402.org/facilitator';
const NETWORK = process.env.NETWORK || 'eip155:84532';
const PRICE = '$0.00025';

if (!WALLET_ADDRESS) {
  console.error('ERROR: WALLET_ADDRESS environment variable is required');
  process.exit(1);
}

const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const x402Server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(x402Server);

app.use(paymentMiddleware({
  'POST /api/gas': {
    accepts: [{ scheme: 'exact', price: PRICE, network: NETWORK, payTo: WALLET_ADDRESS }],
    description: 'Get gas fee suggestions for base or ethereum',
    mimeType: 'application/json'
  }
}, x402Server));

app.post('/api/gas', async (req, res) => {
  try {
    const chain = String(req.body?.chain || '').toLowerCase();
    if (!chain) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Provide chain: "base" or "ethereum"' });
    }

    const snapshot = await getGasSnapshot(chain);
    return res.json(snapshot);
  } catch (error) {
    if (String(error.message).includes('unsupported_chain')) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Unsupported chain. Use base or ethereum.' });
    }

    return res.status(502).json({
      error: 'UPSTREAM_ERROR',
      message: 'Failed to fetch gas data',
      details: String(error.message || error)
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    service: 'Gas Oracle API',
    status: 'online',
    endpoint: 'POST /api/gas',
    example: { chain: 'base' },
    payment: { price: PRICE, network: NETWORK, protocol: 'x402' }
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`gas-oracle-api listening on ${PORT}`);
  });
}

module.exports = app;
