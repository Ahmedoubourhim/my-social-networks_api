const Joi = require('joi');
const { objectId, fullAddress } = require('./common');

exports.createType = Joi.object({
  name: Joi.string().trim().max(100).required(),
  amount: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(1).required(),
});

exports.updateType = Joi.object({
  name: Joi.string().trim().max(100),
  amount: Joi.number().min(0),
  quantity: Joi.number().integer().min(1),
}).min(1);

const buyer = Joi.object({
  firstname: Joi.string().trim().max(100).required(),
  lastname: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().email().required(),
  address: fullAddress.required(),
});

exports.purchase = Joi.object({
  ticketType: objectId.required(),
  buyer: buyer.required(),
});

exports.updateTicket = Joi.object({
  buyer: Joi.object({
    firstname: Joi.string().trim().max(100),
    lastname: Joi.string().trim().max(100),
    email: Joi.string().trim().email(),
    address: Joi.object({
      street: Joi.string().trim().max(200),
      zipCode: Joi.string().trim().max(20),
      city: Joi.string().trim().max(100),
      country: Joi.string().trim().max(100),
    }),
  }).min(1).required(),
});
