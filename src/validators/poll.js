const Joi = require('joi');
const { objectId } = require('./common');

// les réponses sont de simples libellés, uniques (sans tenir compte de la casse) dans une question
const answers = Joi.array()
  .items(Joi.string().trim().max(200))
  .min(2)
  .unique((a, b) => a.toLowerCase() === b.toLowerCase())
  .required();

const question = Joi.object({
  label: Joi.string().trim().max(300).required(),
  answers,
});

exports.create = Joi.object({
  event: objectId.required(),
  title: Joi.string().trim().max(200).required(),
  questions: Joi.array().items(question).min(1).required(),
});

exports.update = Joi.object({
  title: Joi.string().trim().max(200),
  questions: Joi.array().items(question).min(1), // remplace les questions (refusé s'il y a déjà des votes)
}).min(1);

exports.vote = Joi.object({
  questionId: objectId.required(),
  answerId: objectId.required(),
});
