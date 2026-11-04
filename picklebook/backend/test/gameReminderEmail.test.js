jest.mock('dotenv', () => ({ config: jest.fn() }));
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));

const { buildGameReminderMessage } = require('../src/utils/gameReminderMessage');
const booking = (overrides = {}) => ({
  id: 7, reference_number: 'PB-TEST01', court_name: 'Indoor Court',
  reservation_date: '2026-11-04', start_time: '08:30:00',
  user_name: 'Sam Player', user_email: 'player@example.test', ...overrides
});
const frontendUrl = 'https://picklebook.example.test';

describe('Upcoming-game reminder content', () => {
  test('gives the customer a useful one-hour reminder with the facility schedule and preparation advice', () => {
    const reminder = buildGameReminderMessage(booking(), { timeZone: 'Asia/Manila', frontendUrl });
    expect(reminder.title).toBe('Your game starts in 1 hour!');
    expect(reminder.subject).toBe('Your PickleBook game starts in 1 hour - PB-TEST01');
    expect(reminder.link).toBe('/reservations/7');
    for (const content of [reminder.message, reminder.text]) {
      expect(content).toContain('Indoor Court');
      expect(content).toContain('2026-11-04');
      expect(content).toContain('08:30');
      expect(content).toContain('Asia/Manila');
      expect(content).toContain('paddle, water, and court shoes');
      expect(content).toContain('10–15 minutes early');
      expect(content).toContain('See you on the court!');
      expect(content).not.toMatch(/paid|receipt|payment verified/i);
    }
    expect(reminder.html).toContain('View reservation</a>');
    expect(reminder.html).toContain(`${frontendUrl}/reservations/7`);
    expect(reminder.text).toContain(`View reservation: ${frontendUrl}/reservations/7`);
  });

  test.each([[42, '42 minutes'], [1, '1 minute'], [8.2, '9 minutes']])('uses the current countdown for a catch-up reminder (%s)', (minutesUntilStart, countdown) => {
    const reminder = buildGameReminderMessage(booking(), { minutesUntilStart });
    expect(reminder.title).toBe(`Your game starts in ${countdown}!`);
    expect(reminder.message).toContain(`starts in ${countdown}`);
    expect(reminder.subject).toContain(`starts in ${countdown}`);
    expect(reminder.text).toContain(`starts in ${countdown}`);
  });

  test('keeps wall-clock schedule values in the configured facility time zone', () => {
    const reminder = buildGameReminderMessage(booking({ reservation_date: '2026-11-04', start_time: '00:15:00' }), {
      timeZone: 'America/Los_Angeles', frontendUrl
    });
    expect(reminder.text).toContain('Date: 2026-11-04');
    expect(reminder.text).toContain('Start time (facility local time): 00:15');
    expect(reminder.text).toContain('Facility time zone: America/Los_Angeles');
    expect(reminder.message).toContain('2026-11-04 at 00:15 (America/Los_Angeles)');
  });

  test('escapes untrusted HTML and strips header control characters without losing plain text', () => {
    const reminder = buildGameReminderMessage(booking({
      user_name: '<img src=x onerror="alert(1)">', court_name: '<script>alert("court")</script>',
      reference_number: 'PB-TEST01\r\nBcc: other@example.test', id: '7/other?injected=yes'
    }), { frontendUrl });
    expect(reminder.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(reminder.html).toContain('&lt;script&gt;alert(&quot;court&quot;)&lt;/script&gt;');
    expect(reminder.html).not.toContain('<script>');
    expect(reminder.html).not.toContain('<img src=x');
    expect(reminder.subject).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    expect(reminder.text).toContain('<img src=x onerror="alert(1)">');
    expect(reminder.link).toBe('/reservations/7%2Fother%3Finjected%3Dyes');
  });

  test.each(['javascript:alert(1)', 'https://user:password@example.test/'])('replaces unsafe frontend URLs (%s)', (frontendUrl) => {
    const reminder = buildGameReminderMessage(booking(), { frontendUrl });
    expect(reminder.text).toContain('http://localhost:5173/reservations/7');
    expect(reminder.html).not.toContain('href="javascript:');
    expect(reminder.html).not.toContain('user:password');
  });

  test('preserves a hosted app path while removing URL query parameters and fragments', () => {
    const reminder = buildGameReminderMessage(booking(), { frontendUrl: `${frontendUrl}/app/?secret=value#private` });
    expect(reminder.text).toContain(`${frontendUrl}/app/reservations/7`);
    expect(reminder.html).not.toContain('secret=value');
    expect(reminder.html).not.toContain('#private');
  });
});

describe('Private reminder email delivery with mocked SMTP', () => {
  const previousDevMode = process.env.EMAIL_DEV_MODE;
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.EMAIL_DEV_MODE = 'false';
    mockSendMail.mockResolvedValue({ messageId: 'reminder-test', accepted: ['player@example.test'], rejected: [] });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { jest.restoreAllMocks(); });
  afterAll(() => {
    if (previousDevMode === undefined) delete process.env.EMAIL_DEV_MODE; else process.env.EMAIL_DEV_MODE = previousDevMode;
  });

  test('sends only to the reservation customer without copies or receipt attachments', async () => {
    const { sendGameReminderEmail } = require('../src/config/email');
    const result = await sendGameReminderEmail(booking(), { minutesUntilStart: 42, timeZone: 'Asia/Manila', frontendUrl });
    expect(result).toEqual({ success: true, status: 'sent', messageId: 'reminder-test' });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mail = mockSendMail.mock.calls[0][0];
    expect(mail).toEqual(expect.objectContaining({
      to: 'player@example.test', subject: expect.stringContaining('42 minutes'),
      text: expect.stringContaining('Asia/Manila'), html: expect.stringContaining('View reservation</a>'),
      attachments: [], disableFileAccess: true, disableUrlAccess: true
    }));
    expect(mail).not.toHaveProperty('cc');
    expect(mail).not.toHaveProperty('bcc');
    expect(mail).not.toHaveProperty('envelope');
  });

  test.each([undefined, '', 'player@example.test,other@example.test', 'player@example.test\r\nBcc:other@example.test', 'player@example.test\u0000', 'player@other@example.test'])('rejects a missing or unsafe customer recipient (%s)', async (user_email) => {
    const { sendGameReminderEmail } = require('../src/config/email');
    await expect(sendGameReminderEmail(booking({ user_email }))).resolves.toEqual(expect.objectContaining({
      success: false, status: 'failed'
    }));
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('returns failed for SMTP rejection or a transport error', async () => {
    const { sendGameReminderEmail } = require('../src/config/email');
    mockSendMail.mockResolvedValueOnce({ accepted: [], rejected: ['player@example.test'] });
    await expect(sendGameReminderEmail(booking())).resolves.toEqual(expect.objectContaining({ success: false, status: 'failed' }));
    mockSendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(sendGameReminderEmail(booking())).resolves.toEqual(expect.objectContaining({ success: false, status: 'failed', error: 'SMTP unavailable' }));
  });

  test('reports simulated delivery in development mode without contacting SMTP', async () => {
    process.env.EMAIL_DEV_MODE = 'true';
    const { sendGameReminderEmail } = require('../src/config/email');
    await expect(sendGameReminderEmail(booking())).resolves.toEqual(expect.objectContaining({ success: true, status: 'simulated' }));
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(require('nodemailer').createTransport).not.toHaveBeenCalled();
  });
});
