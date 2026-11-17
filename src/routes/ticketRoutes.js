const router = require('express').Router();
const { auth, optionalAuth } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const v = require('../validators/ticket');
const c = require('../controllers/ticketController');

require('../middlewares/validateId')(router, 'id', 'eventId');

// Ce routeur est monté à la racine de /api/v1 : on met donc "auth" route par route
// Consultation + achat ouverts aux personnes extérieures (pas besoin de compte)
router.get('/events/:eventId/ticket-types', c.listTypes);
router.get('/events/:eventId/tickets/remaining', c.remaining);
router.post('/events/:eventId/tickets', optionalAuth, validate(v.purchase), c.purchase);

// Gestion réservée aux organisateurs
router.post('/events/:eventId/ticket-types', auth, validate(v.createType), c.createType);
router.get('/events/:eventId/tickets', auth, c.listTickets);

router.get('/ticket-types/:id', c.getType);
router.patch('/ticket-types/:id', auth, validate(v.updateType), c.updateType);
router.delete('/ticket-types/:id', auth, c.removeType);

router.get('/tickets/:id', auth, c.getTicket);
router.patch('/tickets/:id', auth, validate(v.updateTicket), c.updateTicket);
router.delete('/tickets/:id', auth, c.removeTicket);

module.exports = router;
