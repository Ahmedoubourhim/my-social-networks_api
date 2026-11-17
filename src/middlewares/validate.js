const AppError = require('../utils/AppError');

// Valide req.body avec un schéma Joi. Erreur de validation => 422
module.exports = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body || {}, { abortEarly: false, stripUnknown: true });
  if (error) {
    const err = new AppError(422, 'VALIDATION_ERROR', error.details.map((d) => d.message).join(' ; '));
    err.details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    return next(err);
  }
  req.body = value;
  next();
};
