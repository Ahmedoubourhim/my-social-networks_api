const { isId } = require('../utils/ids');
const AppError = require('../utils/AppError');

// Enregistre sur un routeur la vérification des paramètres d'URL qui sont des ObjectId
// (400 INVALID_ID sinon). Ex : validateIds(router, 'id', 'eventId')
module.exports = (router, ...names) => {
  for (const name of names) {
    router.param(name, (req, res, next, value) => {
      if (!isId(value)) {
        return next(new AppError(400, 'INVALID_ID', `Le paramètre "${name}" n'est pas un identifiant valide`));
      }
      next();
    });
  }
};
