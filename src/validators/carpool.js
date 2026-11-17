const Joi = require('joi');

exports.create = Joi.object({
  departurePlace: Joi.string().trim().max(200).required(),
  departureTime: Joi.date().iso().required(),
  price: Joi.number().min(0).required(),
  availableSeats: Joi.number().integer().min(1).required(),
  maxDetourMinutes: Joi.number().integer().min(0).required(),
});

exports.update = Joi.object({
  departurePlace: Joi.string().trim().max(200),
  departureTime: Joi.date().iso(),
  price: Joi.number().min(0),
  availableSeats: Joi.number().integer().min(0),
  maxDetourMinutes: Joi.number().integer().min(0),
}).min(1);
