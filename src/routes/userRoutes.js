const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/user');
const c = require('../controllers/userController');

require('../middlewares/validateId')(router, 'id');

router.use(auth);

router.get('/', c.list);
router.get('/me', c.me); // avant "/:id" pour ne pas être pris pour un id
router.get('/:id', c.get);
router.patch('/:id', validate(v.update), c.update);
router.delete('/:id', c.remove);

module.exports = router;
