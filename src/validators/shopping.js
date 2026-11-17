const Joi = require('joi');

exports.create = Joi.object({
  name: Joi.string().trim().max(100).required(),
  quantity: Joi.number().integer().min(1).required(),
  arrivalTime: Joi.date().iso().required(),
});

exports.update = Joi.object({
  name: Joi.string().trim().max(100),
  quantity: Joi.number().integer().min(1),
  arrivalTime: Joi.date().iso(),
}).min(1);
