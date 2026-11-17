const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { created, ok } = require('../utils/response');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

const signToken = (user) => jwt.sign({ id: user._id }, jwtSecret, { expiresIn: jwtExpiresIn });

exports.register = async (req, res) => {
  const exists = await User.findOne({ email: req.body.email.toLowerCase() });
  if (exists) throw new AppError(409, 'EMAIL_ALREADY_USED', 'Un utilisateur avec cet email existe déjà');

  const user = await User.create(req.body);
  created(res, { user, token: signToken(user) });
};

exports.login = async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
  if (!user || !(await user.checkPassword(req.body.password))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email ou mot de passe incorrect');
  }
  ok(res, { user, token: signToken(user) });
};
