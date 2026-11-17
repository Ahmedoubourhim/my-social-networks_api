const Joi = require('joi');

const objectId = Joi.string().hex().length(24).messages({
  'string.length': '{{#label}} doit être un identifiant valide (24 caractères)',
  'string.hex': '{{#label}} doit être un identifiant valide',
});

const address = Joi.object({
  street: Joi.string().trim().max(200),
  zipCode: Joi.string().trim().max(20),
  city: Joi.string().trim().max(100),
  country: Joi.string().trim().max(100),
});

// adresse complète (obligatoire pour l'achat d'un billet)
const fullAddress = Joi.object({
  street: Joi.string().trim().max(200).required(),
  zipCode: Joi.string().trim().max(20).required(),
  city: Joi.string().trim().max(100).required(),
  country: Joi.string().trim().max(100).required(),
});

const url = Joi.string().trim().uri({ scheme: ['http', 'https'] });

module.exports = { objectId, address, fullAddress, url };
