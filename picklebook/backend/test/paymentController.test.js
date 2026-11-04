jest.mock('../src/models/Payment', () => ({ create: jest.fn(), findById: jest.fn(), submitGcashReference: jest.fn() }));
jest.mock('../src/models/Reservation', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Notification', () => ({ create: jest.fn() }));
jest.mock('../src/models/AuditLog', () => ({ log: jest.fn() }));
jest.mock('../src/utils/paymentInstructions', () => ({ loadPaymentInstructions: jest.fn() }));

const Payment = require('../src/models/Payment');
const Reservation = require('../src/models/Reservation');
const AuditLog = require('../src/models/AuditLog');
const { loadPaymentInstructions } = require('../src/utils/paymentInstructions');
const controller = require('../src/controllers/paymentController');

describe('Payment endpoint authorization and responses', () => {
  let req;
  let res;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 5, role: 'customer' }, body: { reservation_id: 7, payment_method: 'cash' }, params: {}, ip: '127.0.0.1' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    Reservation.findById.mockResolvedValue({ id: 7, user_id: 5, total_price: '800.00', reference_number: 'PB-TEST' });
    Payment.create.mockResolvedValue({ id: 21, amount: '800.00' });
    loadPaymentInstructions.mockResolvedValue({ gcash: { configured: true, name: 'Court Operator', number: '09171234567' } });
  });

  test.each(['createPayment', 'submitGcashReference'])('blocks another customer booking in %s', async (method) => {
    Reservation.findById.mockResolvedValue({ id: 7, user_id: 90 });
    await controller[method](req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(Payment.create).not.toHaveBeenCalled();
    expect(Payment.submitGcashReference).not.toHaveBeenCalled();
  });

  test('customer cash selection remains pending and uses no required client amount', async () => {
    await controller.createPayment(req, res);
    expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({ amount: undefined, payment_status: 'pending', verified_by_user_id: null }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('staff cash collection carries the verifier identity to the transaction', async () => {
    req.user = { id: 2, role: 'staff' };
    await controller.createPayment(req, res);
    expect(Payment.create).toHaveBeenCalledWith(expect.objectContaining({ payment_status: 'verified', verified_by_user_id: 2 }));
  });

  test('does not accept manual GCash submissions to placeholder merchant details', async () => {
    req.body.transaction_reference = 'GCASH-123456';
    loadPaymentInstructions.mockResolvedValue({ gcash: { configured: false } });
    await controller.submitGcashReference(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Payment.submitGcashReference).not.toHaveBeenCalled();
  });

  test('returns a payment conflict instead of an internal server error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Payment.create.mockRejectedValue(Object.assign(new Error('Already settled.'), { statusCode: 409 }));
    await controller.createPayment(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Already settled.' }));
    console.error.mockRestore();
  });

  test('an audit outage does not make a committed payment appear to fail', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    AuditLog.log.mockRejectedValueOnce(new Error('Audit unavailable'));
    await controller.createPayment(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    console.error.mockRestore();
  });
});
