const AppError = require('../utils/AppError');

exports.notFound = (req, res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route introuvable : ${req.method} ${req.originalUrl}`));
};

// Gestion d'erreurs centralisée : toutes les erreurs sortent au même format
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let code = err.code;
  let message = err.message;
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    // erreur de validation Mongoose
    status = 422;
    code = 'VALIDATION_ERROR';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details.map((d) => d.message).join(' ; ');
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = `Valeur invalide pour "${err.path}"`;
  } else if (err.code === 11000) {
    // violation d'index unique
    status = 409;
    code = 'DUPLICATE';
    const fields = Object.keys(err.keyPattern || {}).join(', ');
    message = `Cette valeur existe déjà (${fields})`;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    code = 'INVALID_TOKEN';
    message = 'Token invalide ou expiré';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Corps de requête JSON invalide';
  }

  if (status >= 500) {
    console.error(err);
    code = 'INTERNAL_ERROR';
    message = 'Erreur interne du serveur';
  }

  const error = { code: code || 'ERROR', message };
  if (details) error.details = details;
  res.status(status).json({ success: false, error });
};
