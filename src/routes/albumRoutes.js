const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/album');
const c = require('../controllers/albumController');

require('../middlewares/validateId')(router, 'id');

router.use(auth);

router.post('/', validate(v.createAlbum), c.create);
router.get('/', c.list);
router.get('/:id', c.get);
router.patch('/:id', validate(v.updateAlbum), c.update);
router.delete('/:id', c.remove);

// routes imbriquées
router.get('/:id/photos', c.listPhotos);
router.post('/:id/photos', validate(v.createPhoto), c.createPhoto);

module.exports = router;
