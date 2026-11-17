const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/thread');
const c = require('../controllers/messageController');

require('../middlewares/validateId')(router, 'id');

router.use(auth);

router.get('/:id', c.get);
router.patch('/:id', validate(v.message), c.update);
router.delete('/:id', c.remove);

// routes imbriquées
router.get('/:id/comments', c.listComments);
router.post('/:id/comments', validate(v.comment), c.createComment);

module.exports = router;
