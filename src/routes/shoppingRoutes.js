const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/shopping');
const c = require('../controllers/shoppingController');

require('../middlewares/validateId')(router, 'id', 'eventId');

// monté à la racine de /api/v1 : "auth" route par route
router.get('/events/:eventId/shopping-items', auth, c.list);
router.post('/events/:eventId/shopping-items', auth, validate(v.create), c.create);

router.get('/shopping-items/:id', auth, c.get);
router.patch('/shopping-items/:id', auth, validate(v.update), c.update);
router.delete('/shopping-items/:id', auth, c.remove);

module.exports = router;
