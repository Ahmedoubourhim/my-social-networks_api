const User = require('../models/User');
const AppError = require('../utils/AppError');

// Retire les doublons d'une liste d'ids (en string)
exports.unique = (ids) => [...new Set((ids || []).map(String))];

// Vérifie que tous les ids correspondent à des utilisateurs existants (404 sinon)
exports.assertUsersExist = async (ids) => {
  if (!ids.length) return;
  const count = await User.countDocuments({ _id: { $in: ids } });
  if (count !== ids.length) throw new AppError(404, 'USER_NOT_FOUND', "Au moins un utilisateur n'existe pas");
};
