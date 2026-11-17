const Joi = require('joi');
const { objectId } = require('./common');

// group XOR event : exactement un des deux
exports.createThread = Joi.object({
  title: Joi.string().trim().max(150).required(),
  group: objectId,
  event: objectId,
}).xor('group', 'event').messages({
  'object.xor': 'Un fil doit être lié à un groupe OU à un événement (pas les deux, pas aucun)',
  'object.missing': 'Un fil doit être lié à un groupe OU à un événement (pas les deux, pas aucun)',
});

exports.updateThread = Joi.object({
  title: Joi.string().trim().max(150).required(),
});

exports.message = Joi.object({
  content: Joi.string().trim().max(5000).required(),
});

exports.comment = Joi.object({
  content: Joi.string().trim().max(2000).required(),
});
