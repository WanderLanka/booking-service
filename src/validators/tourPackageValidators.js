const Joi = require('joi');

const createBookingSchema = Joi.object({
  userId: Joi.string().required(),
  username: Joi.string().required(),
  packageId: Joi.string().required(),
  startDate: Joi.date().iso().min('now').required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  numberOfTravelers: Joi.number().integer().min(1).max(50).default(1),
  notes: Joi.string().max(2000).allow('', null),
  specialRequests: Joi.string().max(1000).allow('', null),
  contactPhone: Joi.string().max(20).allow('', null),
  contactEmail: Joi.string().email().allow('', null),
  paymentMethod: Joi.string().valid('mock', 'credit_card', 'paypal', 'bank_transfer').default('mock'),
});

const updateBookingSchema = Joi.object({
  startDate: Joi.date().iso().min('now'),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  numberOfTravelers: Joi.number().integer().min(1).max(50),
  status: Joi.string().valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled'),
  notes: Joi.string().max(2000).allow('', null),
  specialRequests: Joi.string().max(1000).allow('', null),
  contactPhone: Joi.string().max(20).allow('', null),
  contactEmail: Joi.string().email().allow('', null),
}).min(1);

const cancelBookingSchema = Joi.object({
  reason: Joi.string().max(500).allow('', null),
  requestRefund: Joi.boolean().default(true),
});

module.exports = {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
};
