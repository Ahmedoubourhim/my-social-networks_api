const { isId } = require('../utils/ids');
const AppError = require('../utils/AppError');

// Vérifie que les paramètres d'URL de type id sont des ObjectId valides (400 sinon)
module.exports = (req, res, next) => {
  for (const [key, value] of Object.entries(req.params)) {
    if ((key === 'id' || key.endsWith('Id')) && !isId(value)) {
      return next(new AppError(400, 'INVALID_ID', `Le paramètre "${key}" n'est pas un identifiant valide`));
    }
  }
  next();
};
