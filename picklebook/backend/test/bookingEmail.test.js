jest.mock('dotenv', () => ({ config: jest.fn() }));
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));

const { buildBookingEmail, bookingReceiptData } = require('../src/utils/bookingReceipt');

const booking = (overrides = {}) => ({
  id: 7, reference_number: 'PB-TEST01', court_id: 3, court_name: 'Indoor Court',
  reservation_date: '2026-11-02', start_time: '08:00:00', end_time: '09:00:00',
  total_price: '800.00', status: 'pending',
  payments: [{ id: 21, amount: '800.00', payment_status: 'pending', payment_method: 'cash' }],
  ...overrides
});
const frontend = 'https://picklebook.example.test';
const pdfText = (attachment) => [...attachment.content.toString('ascii').matchAll(/<([\da-f]+)> Tj/g)]
  .map((match) => Buffer.from(match[1], 'hex').toString('latin1')).join('\n');

describe('Booking thank-you message and printable receipt', () => {
  test('pending approval produces a complete unpaid booking receipt, never a confirmed or paid receipt', () => {
    const message = buildBookingEmail('Sam Player', booking(), frontend);
    expect(message.subject).toBe('Thank you for choosing PickleBook - PB-TEST01');
    expect(message.text).toContain('awaiting approval');
    expect(message.text).toContain('Booking status: Pending approval');
    expect(message.text).toContain('Court: Indoor Court');
    expect(message.text).toContain('Date: 2026-11-02');
    expect(message.text).toContain('Time (facility local time): 08:00 - 09:00');
    expect(message.text).toContain('Booking total: PHP 800.00');
    expect(message.text).toContain('Verified payments: PHP 0.00');
    expect(message.text).toContain('Balance due: PHP 800.00');
    expect(message.text).toContain('Payment status: Payment pending');
    expect(message.text).toContain('not proof of payment');
    expect(message.text).toContain('https://picklebook.example.test/reservations/7');
    expect(message.text).not.toContain('has been saved and confirmed');
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments[0]).toEqual(expect.objectContaining({
      filename: 'PickleBook-PB-TEST01-receipt.pdf', contentType: 'application/pdf', contentDisposition: 'attachment'
    }));
    expect(message.attachments[0].content.subarray(0, 8).toString()).toBe('%PDF-1.4');
    expect(pdfText(message.attachments[0])).toContain('Booking receipt');
    expect(pdfText(message.attachments[0])).toContain('Payment status: Payment pending');
    expect(pdfText(message.attachments[0])).not.toContain('Payment receipt');
  });

  test('a confirmed reservation still remains unpaid until its payment is verified', () => {
    const message = buildBookingEmail('Sam', booking({ status: 'confirmed' }), frontend);
    expect(message.text).toContain('has been saved and confirmed');
    expect(message.text).toContain('Payment status: Payment pending');
    expect(pdfText(message.attachments[0])).toContain('Booking receipt');
    expect(pdfText(message.attachments[0])).not.toContain('Paid - verified');
  });

  test.each(['submitted', 'rejected', 'refunded'])('%s payment records never count as a verified payment', (status) => {
    const reservation = booking({ payments: [{ id: 21, amount: '800.00', payment_status: status, payment_method: 'gcash' }] });
    const data = bookingReceiptData('Sam', reservation, frontend);
    expect(data.title).toBe('Booking receipt');
    expect(data.rows).toContainEqual(['Verified payments', 'PHP 0.00']);
    expect(data.rows).toContainEqual(['Balance due', 'PHP 800.00']);
    if (status === 'submitted') expect(data.paymentStatus).toContain('awaiting staff verification');
    if (status === 'refunded') expect(data.paymentStatus).toContain('Refund recorded');
  });

  test('a payment receipt requires verified funds covering the total and deduplicates joined payments', () => {
    const payment = { id: 21, amount: '800.00', payment_status: 'verified', payment_method: 'cash' };
    const reservation = booking({ status: 'confirmed', payments: [payment, payment] });
    const message = buildBookingEmail('Sam', reservation, frontend);
    expect(message.text).toContain('Verified payments: PHP 800.00');
    expect(message.text).not.toContain('PHP 1,600.00');
    expect(message.text).toContain('Balance due: PHP 0.00');
    expect(pdfText(message.attachments[0])).toContain('Payment receipt');
    expect(pdfText(message.attachments[0])).toContain('Paid - verified by staff');
    const partial = bookingReceiptData('Sam', booking({ payments: [{ ...payment, amount: '400.00' }] }), frontend);
    expect(partial.title).toBe('Booking receipt');
    expect(partial.rows).toContainEqual(['Balance due', 'PHP 400.00']);
  });

  test('escapes customer-controlled HTML, blocks header injection and sanitizes the attachment filename', () => {
    const message = buildBookingEmail('<img src=x onerror="alert(1)">', booking({
      reference_number: '../../PB:\r\nInjected', court_name: '<script>alert("court")</script>'
    }), frontend);
    expect(message.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(message.html).toContain('&lt;script&gt;alert(&quot;court&quot;)&lt;/script&gt;');
    expect(message.html).not.toContain('<script>');
    expect(message.html).not.toContain('<img src=x');
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.attachments[0].filename).toMatch(/^[a-zA-Z0-9_-]+-receipt\.pdf$/);
    expect(message.text).toContain('<img src=x onerror="alert(1)">');
    expect(message.html).toContain('https://picklebook.example.test/reservations/7');
    const invalidLink = buildBookingEmail('Sam', booking(), 'javascript:alert(1)');
    expect(invalidLink.html).not.toContain('href="javascript:');
  });

  test('uses printable UTF-8 HTML for non-Latin names without dropping or replacing characters', () => {
    const message = buildBookingEmail('李小明 <Player>', booking({ court_name: '室內球場' }), frontend);
    const attachment = message.attachments[0];
    expect(attachment.filename).toMatch(/\.html$/);
    expect(attachment.contentType).toBe('text/html; charset=utf-8');
    expect(attachment.content.toString('utf8')).toContain('李小明 &lt;Player&gt;');
    expect(attachment.content.toString('utf8')).toContain('室內球場');
    expect(attachment.content.toString('utf8')).toContain('@media print');
    expect(attachment.content.toString('utf8')).toContain('Payment pending');
    expect(message.text).toContain('李小明 <Player>');
  });

  test('the deterministic PDF has byte-correct cross references and safely encodes PDF operators in names', () => {
    const message = buildBookingEmail('Sam ) Tj /Bad ( Player', booking(), frontend);
    const source = message.attachments[0].content.toString('ascii');
    const xref = Number(/startxref\n(\d+)\n/.exec(source)[1]);
    expect(source.slice(xref, xref + 4)).toBe('xref');
    const entries = source.slice(xref).split('\n').slice(3, 10);
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(source.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
    expect(pdfText(message.attachments[0])).toContain('Sam ) Tj /Bad ( Player');
    expect(buildBookingEmail('Sam ) Tj /Bad ( Player', booking(), frontend).attachments[0].content)
      .toEqual(message.attachments[0].content);
  });
});

describe('Mocked SMTP delivery result', () => {
  const previousDevMode = process.env.EMAIL_DEV_MODE;
  const previousFrontend = process.env.FRONTEND_URL;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.EMAIL_DEV_MODE = 'false';
    process.env.FRONTEND_URL = frontend;
    mockSendMail.mockResolvedValue({ messageId: 'test-message', accepted: ['player@example.test'], rejected: [] });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); });
  afterAll(() => {
    if (previousDevMode === undefined) delete process.env.EMAIL_DEV_MODE; else process.env.EMAIL_DEV_MODE = previousDevMode;
    if (previousFrontend === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = previousFrontend;
  });

  test('reports SMTP acceptance with the receipt attached and bounded transport timeouts', async () => {
    const { sendReservationConfirmationEmail } = require('../src/config/email');
    const result = await sendReservationConfirmationEmail('player@example.test', 'Sam', booking());
    expect(result).toEqual({ success: true, status: 'sent', messageId: 'test-message', receipt_attached: true });
    expect(require('nodemailer').createTransport).toHaveBeenCalledWith(expect.objectContaining({
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 5000, dnsTimeout: 5000
    }));
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'player@example.test', attachments: [expect.objectContaining({ contentType: 'application/pdf' })],
      disableFileAccess: true, disableUrlAccess: true
    }));
  });

  test('reports SMTP rejection or transport errors as failed, never sent', async () => {
    const { sendReservationConfirmationEmail } = require('../src/config/email');
    mockSendMail.mockResolvedValueOnce({ messageId: 'rejected', accepted: [], rejected: ['player@example.test'] });
    await expect(sendReservationConfirmationEmail('player@example.test', 'Sam', booking()))
      .resolves.toEqual(expect.objectContaining({ success: false, status: 'failed', receipt_attached: false }));
    mockSendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(sendReservationConfirmationEmail('player@example.test', 'Sam', booking()))
      .resolves.toEqual(expect.objectContaining({ success: false, status: 'failed', receipt_attached: false }));
  });

  test('development mode simulates email instead of claiming a live send', async () => {
    process.env.EMAIL_DEV_MODE = 'true';
    const { sendReservationConfirmationEmail } = require('../src/config/email');
    const result = await sendReservationConfirmationEmail('player@example.test', 'Sam', booking());
    expect(result).toEqual(expect.objectContaining({ success: true, status: 'simulated', receipt_attached: true }));
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(require('nodemailer').createTransport).not.toHaveBeenCalled();
  });

  test('verification and password reset helpers retain their existing links and text', async () => {
    const { sendVerificationEmail, sendPasswordResetEmail } = require('../src/config/email');
    await sendVerificationEmail('player@example.test', 'Sam', 'verification-token');
    expect(mockSendMail).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: 'Verify your PickleBook account',
      text: expect.stringContaining('/verify-email?token=verification-token&email=player%40example.test')
    }));
    await sendPasswordResetEmail('player@example.test', 'Sam', 'reset-token');
    expect(mockSendMail).toHaveBeenLastCalledWith(expect.objectContaining({
      subject: 'Reset your PickleBook password',
      text: expect.stringContaining('/reset-password?token=reset-token&email=player%40example.test')
    }));
  });
});
