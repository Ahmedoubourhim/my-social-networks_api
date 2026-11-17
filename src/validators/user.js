const Joi = require('joi');
const { address, url } = require('./common');

exports.register = Joi.object({
  firstname: Joi.string().trim().max(100).required(),
  lastname: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).max(72).required(),
  avatar: url,
  birthdate: Joi.date().max('now'),
  address,
});

exports.login = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

exports.update = Joi.object({
  firstname: Joi.string().trim().max(100),
  lastname: Joi.string().trim().max(100),
  email: Joi.string().trim().email(),
  password: Joi.string().min(8).max(72),
  avatar: url.allow(null, ''),
  birthdate: Joi.date().max('now'),
  address,
}).min(1);
