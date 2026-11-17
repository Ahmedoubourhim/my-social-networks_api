const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/carpool');
const c = require('../controllers/carpoolController');

require('../middlewares/validateId')(router, 'id', 'eventId');

// monté à la racine de /api/v1 : "auth" route par route
router.get('/events/:eventId/carpools', auth, c.list);
router.post('/events/:eventId/carpools', auth, validate(v.create), c.create);

router.get('/carpools/:id', auth, c.get);
router.patch('/carpools/:id', auth, validate(v.update), c.update);
router.delete('/carpools/:id', auth, c.remove);

router.post('/carpools/:id/book', auth, c.book);
router.delete('/carpools/:id/book', auth, c.cancelBooking);

module.exports = router;
