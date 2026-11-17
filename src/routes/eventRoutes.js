const router = require('express').Router();
const { auth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/event');
const c = require('../controllers/eventController');

require('../middlewares/validateId')(router, 'id', 'userId');

router.use(auth);

router.post('/', validate(v.create), c.create);
router.get('/', c.list);
router.get('/:id', c.get);
router.patch('/:id', validate(v.update), c.update);
router.delete('/:id', c.remove);

router.post('/:id/organizers', validate(v.userRef), c.addOrganizer);
router.delete('/:id/organizers/:userId', c.removeOrganizer);

router.post('/:id/participants', validate(v.usersRef), c.addParticipants);
router.delete('/:id/participants/:userId', c.removeParticipant);
router.post('/:id/join', c.join);
router.post('/:id/leave', c.leave);

router.post('/:id/invite-group-members', c.inviteGroupMembers);
router.get('/:id/share', c.share);

module.exports = router;
