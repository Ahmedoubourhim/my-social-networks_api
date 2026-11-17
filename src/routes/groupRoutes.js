const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/group');
const c = require('../controllers/groupController');

require('../middlewares/validateId')(router, 'id', 'userId');

router.use(auth);

router.post('/', validate(v.create), c.create);
router.get('/', c.list);
router.get('/:id', c.get);
router.patch('/:id', validate(v.update), c.update);
router.delete('/:id', c.remove);

router.post('/:id/join', c.join);
router.post('/:id/leave', c.leave);

router.post('/:id/members', validate(v.userRef), c.addMember);
router.delete('/:id/members/:userId', c.removeMember);
router.post('/:id/admins', validate(v.userRef), c.addAdmin);
router.delete('/:id/admins/:userId', c.removeAdmin);

module.exports = router;
