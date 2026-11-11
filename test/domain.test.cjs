const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBookingSchema } = require('../src/validators/tourPackageBookingValidators');
const fixture = { userId: '507f1f77bcf86cd799439011', tourPackageId: '507f1f77bcf86cd799439012', packageTitle: 'Ella', startDate: '2030-01-01', endDate: '2030-01-03', peopleCount: 2, pricing: { unitAmount: 100, totalAmount: 200, perPerson: true } };

test('booking validation rejects reverse dates, zero guests and negative prices', () => {
  assert.equal(createBookingSchema.validate(fixture).error, undefined);
  for (const invalid of [{ endDate: '2029-12-31' }, { peopleCount: 0 }, { pricing: { unitAmount: -1, totalAmount: -1 } }]) {
    assert.ok(createBookingSchema.validate({ ...fixture, ...invalid }).error);
  }
});

test('production mock checkout refuses before persistence or reservation calls', async () => {
  const Service = require('../src/services/EnhancedBookingService');
  const env = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    await assert.rejects(new Service().createCompleteBooking({}), /disabled in production/);
  } finally { if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env; }
});

test('booking creation identity comes from the access token and list is scoped to its owner', async () => {
  const guard = require('../src/middleware/bookingAccess');
  const req = { path: '/create', user: { userId: fixture.userId }, body: { userId: 'spoofed' } };
  let called = false;
  await guard(req, {}, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.body.userId, fixture.userId);
  const list = { path: '/list', user: req.user, query: { userId: 'spoofed', guideId: 'spoofed-guide' } };
  await guard(list, {}, () => {});
  assert.deepEqual(list.query, { userId: fixture.userId });
});

test('another customer cannot read or approve a tour booking', async t => {
  const Model = require('../src/models/TourPackageBooking');
  t.mock.method(Model, 'findById', () => ({ lean: async () => ({ userId: 'other-user', guideId: 'other-guide' }) }));
  const guard = require('../src/middleware/bookingAccess');
  for (const action of ['get', 'approve', 'cancel', 'pay']) {
    let code;
    await guard({ path: `/${action}/${fixture.tourPackageId}`, user: { userId: fixture.userId } }, { status(c) { code = c; return this; }, json() {} }, () => assert.fail('authorization bypass'));
    assert.equal(code, 403);
  }
});

test('production rejects checkout creation before Stripe can charge a customer', async t => {
  const express = require('express');
  const app = express();
  app.use('/payments', require('../src/payments/routes'));
  const request = await require('./http.cjs')(t, app);
  const before = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    for (const path of ['/payments/create-session', '/payments/create-intent']) {
      assert.equal((await request(path, { method: 'POST' })).status, 503);
    }
  } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before; }
});
