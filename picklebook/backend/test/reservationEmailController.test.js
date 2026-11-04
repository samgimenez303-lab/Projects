jest.mock('../src/models/Reservation', () => ({ createReservation: jest.fn() }));
jest.mock('../src/models/Notification', () => ({ create: jest.fn() }));
jest.mock('../src/models/AuditLog', () => ({ log: jest.fn() }));
jest.mock('../src/config/email', () => ({ sendReservationConfirmationEmail: jest.fn() }));

const Reservation = require('../src/models/Reservation');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const { sendReservationConfirmationEmail } = require('../src/config/email');
const { createReservation } = require('../src/controllers/reservationController');

describe('Saved-booking email response', () => {
  let req;
  let res;
  let saved;
  beforeEach(() => {
    jest.clearAllMocks();
    saved = { id: 7, reference_number: 'PB-TEST01', court_name: 'Indoor Court', reservation_date: '2026-11-02', start_time: '08:00', end_time: '09:00', total_price: '800.00', status: 'pending' };
    req = { user: { id: 5, name: 'Sam', email: 'player@example.test' }, body: { court_id: 3, reservation_date: '2026-11-02', start_time: '08:00', end_time: '09:00', payment_method: 'cash' }, ip: '127.0.0.1' };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    Reservation.createReservation.mockResolvedValue(saved);
    Notification.create.mockResolvedValue({ id: 1 });
    AuditLog.log.mockResolvedValue({ id: 1 });
    sendReservationConfirmationEmail.mockResolvedValue({ success: true, status: 'sent', receipt_attached: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  test.each(['sent', 'simulated'])('returns the saved booking and truthful %s status after its email attempt', async (status) => {
    sendReservationConfirmationEmail.mockResolvedValue({ success: true, status, receipt_attached: true });
    await createReservation(req, res);
    expect(sendReservationConfirmationEmail).toHaveBeenCalledWith('player@example.test', 'Sam', saved);
    expect(Reservation.createReservation.mock.invocationCallOrder[0]).toBeLessThan(sendReservationConfirmationEmail.mock.invocationCallOrder[0]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true, data: { reservation: saved, email_delivery: { status, recipient: 'player@example.test', receipt_attached: true } }
    }));
  });

  test.each(['resolved failure', 'rejected promise', 'synchronous template error'])('%s cannot make a committed reservation appear to fail', async (failure) => {
    if (failure === 'resolved failure') sendReservationConfirmationEmail.mockResolvedValue({ success: false, status: 'failed', error: 'SMTP unavailable' });
    else if (failure === 'rejected promise') sendReservationConfirmationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    else sendReservationConfirmationEmail.mockImplementation(() => { throw new Error('Template unavailable'); });
    await createReservation(req, res);
    expect(Reservation.createReservation).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true, data: { reservation: saved, email_delivery: { status: 'failed', recipient: 'player@example.test', receipt_attached: false } }
    }));
  });

  test('bounds waiting at eight seconds without claiming an ongoing attempt failed or leaking its later rejection', async () => {
    jest.useFakeTimers();
    let rejectEmail;
    sendReservationConfirmationEmail.mockReturnValue(new Promise((resolve, reject) => { rejectEmail = reject; }));
    const response = createReservation(req, res);
    await jest.advanceTimersByTimeAsync(8000);
    await response;
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: { reservation: saved, email_delivery: { status: 'unconfirmed', recipient: 'player@example.test', receipt_attached: false } }
    }));
    rejectEmail(new Error('Late SMTP rejection'));
    await jest.advanceTimersByTimeAsync(0);
    expect(res.status).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('does not email a booking whose save failed', async () => {
    Reservation.createReservation.mockRejectedValue(new Error('Time slot unavailable'));
    await createReservation(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(sendReservationConfirmationEmail).not.toHaveBeenCalled();
  });
});
