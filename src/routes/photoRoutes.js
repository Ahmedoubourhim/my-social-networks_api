const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const album = require('../validators/album');
const thread = require('../validators/thread');
const c = require('../controllers/photoController');

require('../middlewares/validateId')(router, 'id');

router.use(auth);

router.get('/:id', c.get);
router.patch('/:id', validate(album.updatePhoto), c.update);
router.delete('/:id', c.remove);

// routes imbriquées
router.get('/:id/comments', c.listComments);
router.post('/:id/comments', validate(thread.comment), c.createComment);

module.exports = router;
