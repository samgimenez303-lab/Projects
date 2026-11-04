jest.mock('../src/models/Settings', () => ({ get: jest.fn() }));
const Settings = require('../src/models/Settings');
const { loadPaymentInstructions } = require('../src/utils/paymentInstructions');

describe('Manual payment instructions', () => {
  test('hides placeholder merchant numbers and disables GCash', async () => {
    Settings.get.mockImplementation(async (key) => key === 'gcash_number' ? '09XX-XXX-XXXX' : 'PickleBook Inc.');
    await expect(loadPaymentInstructions()).resolves.toMatchObject({ gcash: { configured: false, number: '' }, verification_required: true });
  });

  test('normalizes an international Philippine mobile number', async () => {
    Settings.get.mockImplementation(async (key) => key === 'gcash_number' ? '+63 917 123 4567' : 'Court Operator');
    await expect(loadPaymentInstructions()).resolves.toMatchObject({ methods: ['cash', 'gcash'], gcash: { configured: true, number: '09171234567', name: 'Court Operator' } });
  });
});
