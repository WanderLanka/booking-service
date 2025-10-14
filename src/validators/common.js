const Joi = require('joi');

const objectId = () =>
  Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .message('Invalid ObjectId');

const pagination = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  objectId,
  pagination,
};