const Joi = require('joi');
const { objectId, url } = require('./common');

// Étape 1 du parcours guidé : configuration de l'événement
exports.create = Joi.object({
  name: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(5000).allow(''),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'endDate doit être postérieure à startDate',
  }),
  location: Joi.string().trim().required(),
  coverPhoto: url,
  visibility: Joi.string().valid('public', 'private').default('public'),
  organizers: Joi.array().items(objectId), // le créateur est ajouté automatiquement
  participants: Joi.array().items(objectId),
  group: objectId,
  inviteGroupMembers: Joi.boolean(), //"inviter tous les membres du groupe en un clic"
  ticketingEnabled: Joi.boolean(),
  shoppingListEnabled: Joi.boolean(),
  carpoolEnabled: Joi.boolean(),
}).with('inviteGroupMembers', 'group');

exports.update = Joi.object({
  name: Joi.string().trim().max(150),
  description: Joi.string().trim().max(5000).allow(''),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  location: Joi.string().trim(),
  coverPhoto: url,
  visibility: Joi.string().valid('public', 'private'),
  ticketingEnabled: Joi.boolean(),
  shoppingListEnabled: Joi.boolean(),
  carpoolEnabled: Joi.boolean(),
}).min(1);

exports.userRef = Joi.object({ userId: objectId.required() });

// un seul utilisateur (userId) ou plusieurs (userIds)
exports.usersRef = Joi.object({
  userId: objectId,
  userIds: Joi.array().items(objectId).min(1),
}).or('userId', 'userIds');
