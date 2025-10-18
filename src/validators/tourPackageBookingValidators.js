const Joi = require('joi');

const createBookingSchema = Joi.object({
  userId: Joi.string().required(),
  tourPackageId: Joi.string().required(),
  packageTitle: Joi.string().required(),
  packageSlug: Joi.string().optional(),
  guideId: Joi.string().optional(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().required(),
  peopleCount: Joi.number().integer().min(1).default(1),
  pricing: Joi.object({
    currency: Joi.string().default('USD'),
    unitAmount: Joi.number().min(0).required(),
    totalAmount: Joi.number().min(0).required(),
    perPerson: Joi.boolean().default(false),
  }).required(),
  notes: Joi.string().allow('').optional(),
  // For mock payment
  paymentMethod: Joi.string().valid('mock', 'card').default('mock'),
  // Cancellation policy from package
  cancellationPolicy: Joi.object({
    freeCancellation: Joi.boolean().optional(),
    freeCancellationWindow: Joi.string().optional(),
  }).optional(),
});

module.exports = { createBookingSchema };
