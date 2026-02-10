jest.mock('@x402/express', () => ({
  paymentMiddleware: () => (req, res, next) => next()
}));

const request = require('supertest');
const app = require('../src/index');

describe('gas-oracle-api', () => {
  test('returns 400 for unsupported chain', async () => {
    const response = await request(app).post('/api/gas').send({ chain: 'polygon' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('BAD_REQUEST');
  });

  test('returns gas snapshot for base', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x77359400' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: '0x3b9aca00' }) });

    const response = await request(app).post('/api/gas').send({ chain: 'base' });

    expect(response.statusCode).toBe(200);
    expect(response.body.chain).toBe('base');
    expect(response.body.standard).toBeGreaterThan(0);

    global.fetch = originalFetch;
  });
});
