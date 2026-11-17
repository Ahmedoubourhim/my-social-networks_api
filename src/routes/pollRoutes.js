const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/poll');
const c = require('../controllers/pollController');

require('../middlewares/validateId')(router, 'id', 'questionId');

router.use(auth);

router.post('/', validate(v.create), c.create);
router.get('/', c.list);
router.get('/:id', c.get);
router.patch('/:id', validate(v.update), c.update);
router.delete('/:id', c.remove);

router.post('/:id/vote', validate(v.vote), c.vote);
router.delete('/:id/votes/:questionId', c.removeVote);
router.get('/:id/results', c.results);

module.exports = router;
