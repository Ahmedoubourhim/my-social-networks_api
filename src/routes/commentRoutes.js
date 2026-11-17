const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/thread');
const c = require('../controllers/commentController');

require('../middlewares/validateId')(router, 'id');

router.use(auth);

router.get('/:id', c.get);
router.patch('/:id', validate(v.comment), c.update);
router.delete('/:id', c.remove);

module.exports = router;
