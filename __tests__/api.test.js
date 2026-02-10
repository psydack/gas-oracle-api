jest.mock('@x402/express', () => ({
  paymentMiddleware: () => (req, res, next) => next()
}));

const request = require('supertest');
const app = require('../src/index');
const { __internal } = require('../src/gasService');

describe('gas-oracle-api', () => {
  beforeEach(() => {
    __internal.CACHE.clear();
  });

  test('returns 400 for unsupported chain', async () => {
    const response = await request(app).post('/api/gas').send({ chain: 'polygon' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('BAD_REQUEST');
  });

  test('returns eip1559 gas snapshot for base', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { baseFeePerGas: '0x3b9aca00' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { reward: [['0x3b9aca00', '0x59682f00', '0x77359400']] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x3b9aca00' }) });

    const response = await request(app).post('/api/gas').send({ chain: 'base' });

    expect(response.statusCode).toBe(200);
    expect(response.body.chain).toBe('base');
    expect(response.body.model).toBe('eip1559');
    expect(response.body.baseFeePerGas).toBeGreaterThan(0);
    expect(response.body.tiers.standard.maxFeePerGas).toBeGreaterThan(0);
    expect(response.body.tiers.standard.maxPriorityFeePerGas).toBeGreaterThan(0);
    expect(response.body.cache.hit).toBe(false);

    global.fetch = originalFetch;
  });

  test('returns cached response on repeated requests', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { baseFeePerGas: '0x3b9aca00' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { reward: [['0x3b9aca00', '0x59682f00', '0x77359400']] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x3b9aca00' }) });

    const first = await request(app).post('/api/gas').send({ chain: 'base' });
    const second = await request(app).post('/api/gas').send({ chain: 'base' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body.cache.hit).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);

    global.fetch = originalFetch;
  });
});
