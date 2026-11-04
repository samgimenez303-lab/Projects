const Settings = require('../models/Settings');

// These are merchant instructions for a manual transfer, never gateway credentials.
const loadPaymentInstructions = async () => {
  const [name, rawNumber] = await Promise.all([
    Settings.get('gcash_name', ''),
    Settings.get('gcash_number', '')
  ]);
  const digits = String(rawNumber || '').replace(/[\s()+-]/g, '');
  const number = digits.startsWith('63') ? `0${digits.slice(2)}` : digits;
  const configured = /^09\d{9}$/.test(number) && String(name || '').trim().length > 0;
  return {
    methods: ['cash', 'gcash'],
    gcash: { name: String(name || '').trim(), number: configured ? number : '', configured },
    verification_required: true
  };
};

module.exports = { loadPaymentInstructions };
