jest.mock('../src/models/Service', () => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../src/models/AuditLog', () => ({ log: jest.fn().mockResolvedValue(undefined) }));

const express = require('express');
const request = require('supertest');
const Service = require('../src/models/Service');
const controller = require('../src/controllers/serviceController');
const { serviceCreateValidation, serviceUpdateValidation, reservationCreateValidation } = require('../src/middleware/validate');

const app = express();
app.use(express.json());
app.get('/services', controller.getAllServices);
app.get('/services/:id', controller.getServiceById);
app.post('/services', (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); }, serviceCreateValidation, controller.createService);
app.put('/services/:id', (req, res, next) => { req.user = { id: 1, role: 'admin' }; next(); }, serviceUpdateValidation, controller.updateService);
app.post('/reservations', reservationCreateValidation, (req, res) => res.sendStatus(204));

beforeEach(() => jest.clearAllMocks());

test.each(['equipment', 'coaching', 'event', 'package'])(
  'cannot create the retired %s service category', async (category) => {
    const response = await request(app).post('/services').send({ name: 'Old add-on', category, price: 10 });
    expect(response.status).toBe(400);
    expect(Service.create).not.toHaveBeenCalled();
  }
);

test('cannot change a court service to a retired category', async () => {
  const response = await request(app).put('/services/4').send({ category: 'coaching' });
  expect(response.status).toBe(400);
  expect(Service.update).not.toHaveBeenCalled();
});

test('creates a court discovery listing without a separate service price', async () => {
  Service.create.mockResolvedValue({ id: 5, name: 'Indoor pickleball', category: 'indoor', price: 0 });
  const response = await request(app).post('/services').send({ name: 'Indoor pickleball', category: 'indoor' });
  expect(response.status).toBe(201);
  expect(response.body.data.service.category).toBe('indoor');
});

test('public requests cannot retrieve archived add-on descriptions', async () => {
  Service.findById.mockResolvedValue({ id: 1, category: 'indoor', legacy_category: 'equipment', is_active: 0 });
  const response = await request(app).get('/services/1');
  expect(response.status).toBe(404);
});

test('public service list filters out inactive entries', async () => {
  Service.findAll.mockResolvedValue([]);
  const response = await request(app).get('/services');
  expect(response.status).toBe(200);
  expect(Service.findAll).toHaveBeenCalledWith({ is_active: 1, category: null });
});

test('new reservations reject additional service charges', async () => {
  const response = await request(app).post('/reservations').send({
    court_id: 1,
    reservation_date: '2026-11-01',
    start_time: '10:00',
    end_time: '11:00',
    services: [{ service_id: 1, quantity: 1 }],
    payment_method: 'cash',
  });
  expect(response.status).toBe(400);
  expect(response.body.errors.some((error) => error.field === 'services')).toBe(true);
});
