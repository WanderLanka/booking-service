const Joi = require('joi');

const createReservationSchema = Joi.object({
  userId: Joi.string().required(),
  packageId: Joi.string().required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  notes: Joi.string().max(1000).allow('', null),
});

const updateReservationSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')),
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed'),
  notes: Joi.string().max(1000).allow('', null),
}).min(1);

module.exports = {
  createReservationSchema,
  updateReservationSchema,
};
