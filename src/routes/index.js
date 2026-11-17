const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/groups', require('./groupRoutes'));
// routeurs "à la racine" (chemins complets, auth route par route) : à monter AVANT /events,
// car eventRoutes applique "auth" à tout ce qui commence par /events
router.use(require('./ticketRoutes'));

router.use('/events', require('./eventRoutes'));
router.use('/threads', require('./threadRoutes'));
router.use('/messages', require('./messageRoutes'));
router.use('/comments', require('./commentRoutes'));
router.use('/albums', require('./albumRoutes'));
router.use('/photos', require('./photoRoutes'));
router.use('/polls', require('./pollRoutes'));

module.exports = router;
