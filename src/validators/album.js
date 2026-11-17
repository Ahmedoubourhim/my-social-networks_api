const Joi = require('joi');
const { objectId, url } = require('./common');

exports.createAlbum = Joi.object({
  event: objectId.required(),
  title: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(2000).allow(''),
});

exports.updateAlbum = Joi.object({
  title: Joi.string().trim().max(150),
  description: Joi.string().trim().max(2000).allow(''),
}).min(1);

exports.createPhoto = Joi.object({
  url: url.required(),
  caption: Joi.string().trim().max(500).allow(''),
});

exports.updatePhoto = Joi.object({
  url,
  caption: Joi.string().trim().max(500).allow(''),
}).min(1);
