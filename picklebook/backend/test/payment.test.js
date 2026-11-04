jest.mock('../src/config/db', () => ({ pool: { execute: jest.fn() }, getConnection: jest.fn() }));

const { getConnection } = require('../src/config/db');
const Payment = require('../src/models/Payment');

describe('Payment ledger safeguards', () => {
  let connection;
  let reservation;
  let payments;
  let duplicateReference;

  beforeEach(() => {
    reservation = { id: 7, total_price: '800.00', status: 'confirmed' };
    payments = [{ id: 21, reservation_id: 7, amount: '800.00', payment_method: 'cash', payment_status: 'pending', transaction_reference: null }];
    duplicateReference = false;
    connection = {
      beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
      execute: jest.fn(async (sql) => {
        if (sql.startsWith('SELECT reservation_id FROM payments')) return [[{ reservation_id: 7 }]];
        if (sql.includes('FROM reservations')) return [[reservation]];
        if (sql.includes('transaction_reference = ? AND reservation_id <>')) return [duplicateReference ? [{ id: 99 }] : []];
        if (sql.includes('FROM payments')) return [payments];
        return [{ insertId: 22, affectedRows: 1 }];
      })
    };
    getConnection.mockResolvedValue(connection);
    jest.spyOn(Payment, 'findById').mockImplementation(async (id) => ({ id, reservation_id: 7, amount: '800.00' }));
  });

  afterEach(() => jest.restoreAllMocks());

  test('rejects a client-supplied partial amount without changing the ledger', async () => {
    await expect(Payment.create({ reservation_id: 7, amount: '1.00', payment_method: 'cash' })).rejects.toMatchObject({ statusCode: 400 });
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('UPDATE') || sql.startsWith('INSERT'))).toBe(false);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test('uses the stored total and reuses a pending record for GCash submission', async () => {
    const result = await Payment.submitGcashReference(7, ' gcash-123456 ');
    expect(result.id).toBe(21);
    const update = connection.execute.mock.calls.find(([sql]) => sql.startsWith('UPDATE payments'));
    expect(update[1]).toEqual(['800.00', 'gcash', 'submitted', 'GCASH-123456', expect.any(Date), null, 21]);
    expect(connection.execute.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test.each(['verified', 'refunded'])('never overwrites a %s payment with a new reference', async (status) => {
    payments[0].payment_status = status;
    await expect(Payment.submitGcashReference(7, 'GCASH-123456')).rejects.toMatchObject({ statusCode: 409 });
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('treats a retry of the same submitted reference as idempotent', async () => {
    Object.assign(payments[0], { payment_method: 'gcash', payment_status: 'submitted', transaction_reference: 'GCASH-123456' });
    await expect(Payment.submitGcashReference(7, 'gcash-123456')).resolves.toMatchObject({ id: 21 });
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('UPDATE') || sql.startsWith('INSERT'))).toBe(false);
  });

  test('does not replace a reference while staff are reviewing it', async () => {
    Object.assign(payments[0], { payment_method: 'gcash', payment_status: 'submitted', transaction_reference: 'GCASH-123456' });
    await expect(Payment.submitGcashReference(7, 'DIFFERENT-123456')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('allows a rejected reference to be corrected on its existing record', async () => {
    payments[0].payment_status = 'rejected';
    await expect(Payment.submitGcashReference(7, 'GCASH-654321')).resolves.toMatchObject({ id: 21 });
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO payments'))).toBe(false);
  });

  test('rejects a reference already claimed by a different reservation', async () => {
    duplicateReference = true;
    await expect(Payment.submitGcashReference(7, 'GCASH-123456')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('converts a competing unique-index claim into a conflict and rolls back', async () => {
    const execute = connection.execute.getMockImplementation();
    connection.execute.mockImplementation(async (...args) => {
      if (args[0].startsWith('UPDATE payments')) throw Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
      return execute(...args);
    });
    await expect(Payment.submitGcashReference(7, 'GCASH-123456')).rejects.toMatchObject({ statusCode: 409 });
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test.each(['cancelled', 'rejected', 'completed'])('rejects submissions and verification on a %s booking', async (status) => {
    reservation.status = status;
    await expect(Payment.submitGcashReference(7, 'GCASH-123456')).rejects.toMatchObject({ statusCode: 409 });
    await expect(Payment.verifyPayment(21, 2, 'verified')).rejects.toMatchObject({ statusCode: 409 });
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('requires a staff identity before cash can be created as verified', async () => {
    await expect(Payment.create({ reservation_id: 7, payment_method: 'cash', payment_status: 'verified' })).rejects.toMatchObject({ statusCode: 403 });
  });

  test('records cash collection, verification history and booking confirmation in one transaction', async () => {
    reservation.status = 'pending';
    await Payment.create({ reservation_id: 7, payment_method: 'cash', payment_status: 'verified', verified_by_user_id: 2 });
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO payment_verifications'))).toBe(true);
    expect(connection.execute.mock.calls.some(([sql]) => sql.startsWith('UPDATE reservations'))).toBe(true);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('will not verify GCash before a transfer reference is submitted', async () => {
    payments[0].payment_method = 'gcash';
    await expect(Payment.verifyPayment(21, 2, 'verified')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('will not verify an amount that differs from the stored reservation total', async () => {
    payments[0].amount = '10.00';
    await expect(Payment.verifyPayment(21, 2, 'verified')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('will not reverse a prior staff decision through the verification endpoint', async () => {
    payments[0].payment_status = 'verified';
    await expect(Payment.verifyPayment(21, 2, 'rejected')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('verification rolls back the payment change if its history cannot be written', async () => {
    const execute = connection.execute.getMockImplementation();
    connection.execute.mockImplementation(async (...args) => {
      if (args[0].startsWith('INSERT INTO payment_verifications')) throw new Error('Storage unavailable');
      return execute(...args);
    });
    await expect(Payment.verifyPayment(21, 2, 'verified')).rejects.toThrow('Storage unavailable');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });
});
