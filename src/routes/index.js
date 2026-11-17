const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));

module.exports = router;
