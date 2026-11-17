const router = require('express').Router();
const validate = require('../middlewares/validate');
const v = require('../validators/user');
const c = require('../controllers/authController');

router.post('/register', validate(v.register), c.register);
router.post('/login', validate(v.login), c.login);

module.exports = router;
