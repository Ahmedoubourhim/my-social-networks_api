const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/thread');
const c = require('../controllers/threadController');

require('../middlewares/validateId')(router, 'id');

router.use(auth);

router.post('/', validate(v.createThread), c.create);
router.get('/', c.list);
router.get('/:id', c.get);
router.patch('/:id', validate(v.updateThread), c.update);
router.delete('/:id', c.remove);

// routes imbriquées
router.get('/:id/messages', c.listMessages);
router.post('/:id/messages', validate(v.message), c.createMessage);

module.exports = router;
