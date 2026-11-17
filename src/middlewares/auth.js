const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { jwtSecret } = require('../config/env');

// Lit le header "Authorization: Bearer <token>" et renvoie l'utilisateur (ou null)
async function readUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const payload = jwt.verify(header.slice(7), jwtSecret);
  return User.findById(payload.id);
}

// Route protégée : 401 si pas de token valide
exports.auth = async (req, res, next) => {
  const user = await readUser(req);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Authentification requise (header Authorization: Bearer <token>)');
  req.user = user;
  next();
};

// Route ouverte à tous, mais on identifie l'utilisateur s'il envoie un token
exports.optionalAuth = async (req, res, next) => {
  req.user = await readUser(req);
  next();
};
