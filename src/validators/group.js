const Joi = require('joi');
const { objectId, url } = require('./common');

exports.create = Joi.object({
  name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().max(2000).allow(''),
  icon: url,
  coverPhoto: url,
  type: Joi.string().valid('public', 'private', 'secret').default('public'),
  allowMembersToPost: Joi.boolean(),
  allowMembersToCreateEvents: Joi.boolean(),
  members: Joi.array().items(objectId), // membres ajoutés dès la création (le créateur est ajouté automatiquement)
});

exports.update = Joi.object({
  name: Joi.string().trim().max(100),
  description: Joi.string().trim().max(2000).allow(''),
  icon: url,
  coverPhoto: url,
  type: Joi.string().valid('public', 'private', 'secret'),
  allowMembersToPost: Joi.boolean(),
  allowMembersToCreateEvents: Joi.boolean(),
}).min(1);

exports.userRef = Joi.object({ userId: objectId.required() });
