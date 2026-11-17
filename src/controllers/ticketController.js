const TicketType = require('../models/TicketType');
const Ticket = require('../models/Ticket');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const access = require('../services/access');

// La billetterie n'existe que pour les événements PUBLICS qui l'ont activée
async function getTicketingEvent(eventId) {
  const event = await access.getEvent(eventId);
  if (event.visibility !== 'public') {
    throw new AppError(403, 'TICKETING_PUBLIC_ONLY', 'La billetterie est réservée aux événements publics');
  }
  access.requireFeature(event, 'ticketingEnabled', 'La billetterie');
  return event;
}

async function getType(id) {
  const type = await TicketType.findById(id);
  if (!type) throw new AppError(404, 'TICKET_TYPE_NOT_FOUND', 'Type de billet introuvable');
  return type;
}

async function getTicket(id) {
  const ticket = await Ticket.findById(id);
  if (!ticket) throw new AppError(404, 'TICKET_NOT_FOUND', 'Billet introuvable');
  return ticket;
}

// ---------- Types de billets ----------
exports.createType = async (req, res) => {
  const event = await getTicketingEvent(req.params.eventId);
  access.requireOrganizer(event, req.user);
  const type = await TicketType.create({ ...req.body, event: event._id, createdBy: req.user._id });
  created(res, type);
};

exports.listTypes = async (req, res) => {
  const event = await getTicketingEvent(req.params.eventId);
  const filter = { event: event._id };
  if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
  const { items, meta } = await paginate(TicketType, filter, req.query, {
    sortable: ['name', 'amount', 'createdAt'],
    defaultSort: 'amount',
  });
  ok(res, items, meta);
};

// GET /events/:eventId/tickets/remaining : billets restants par type
exports.remaining = async (req, res) => {
  const event = await getTicketingEvent(req.params.eventId);
  const types = await TicketType.find({ event: event._id }).sort('amount');
  ok(
    res,
    types.map((t) => ({
      ticketTypeId: t._id,
      name: t.name,
      amount: t.amount,
      quantity: t.quantity,
      sold: t.sold,
      remaining: t.quantity - t.sold,
    }))
  );
};

exports.getType = async (req, res) => {
  const type = await getType(req.params.id);
  await getTicketingEvent(type.event);
  ok(res, type);
};

exports.updateType = async (req, res) => {
  const type = await getType(req.params.id);
  const event = await getTicketingEvent(type.event);
  access.requireOrganizer(event, req.user);

  // la nouvelle quantité ne peut pas être inférieure au nombre de billets déjà vendus (condition atomique)
  const filter = { _id: type._id };
  if (req.body.quantity !== undefined) filter.sold = { $lte: req.body.quantity };
  const updated = await TicketType.findOneAndUpdate(filter, { $set: req.body }, { returnDocument: 'after', runValidators: true });
  if (!updated) {
    throw new AppError(409, 'QUANTITY_BELOW_SOLD', 'La quantité ne peut pas être inférieure au nombre de billets déjà vendus');
  }
  ok(res, updated);
};

exports.removeType = async (req, res) => {
  const type = await getType(req.params.id);
  const event = await access.getEvent(type.event);
  access.requireOrganizer(event, req.user);
  if (await Ticket.exists({ ticketType: type._id })) {
    throw new AppError(409, 'TICKET_TYPE_SOLD', 'Des billets de ce type ont déjà été vendus : suppression impossible');
  }
  await type.deleteOne();
  noContent(res);
};

// ---------- Achat ----------
// POST /events/:eventId/tickets
exports.purchase = async (req, res) => {
  const event = await getTicketingEvent(req.params.eventId);
  const { ticketType, buyer } = req.body;
  const email = buyer.email.toLowerCase();

  const type = await TicketType.findOne({ _id: ticketType, event: event._id });
  if (!type) throw new AppError(404, 'TICKET_TYPE_NOT_FOUND', "Ce type de billet n'existe pas pour cet événement");

  // 1 seul billet par personne (email) et par événement
  if (await Ticket.exists({ event: event._id, 'buyer.email': email })) {
    throw new AppError(409, 'TICKET_ALREADY_BOUGHT', 'Une personne ne peut obtenir qu\'un seul billet par événement');
  }

  // Décrément ATOMIQUE du stock : la condition sold < quantity est évaluée par MongoDB
  // dans la même opération que l'incrément => impossible de vendre plus que la quantité.
  const reserved = await TicketType.findOneAndUpdate(
    { _id: type._id, $expr: { $lt: ['$sold', '$quantity'] } },
    { $inc: { sold: 1 } },
    { returnDocument: 'after' }
  );
  if (!reserved) throw new AppError(409, 'SOLD_OUT', 'Ce type de billet est épuisé');

  try {
    const ticket = await Ticket.create({
      event: event._id,
      ticketType: type._id,
      buyer: { ...buyer, email },
      purchasedBy: req.user ? req.user._id : undefined,
    });
    await ticket.populate({ path: 'ticketType', select: 'name amount' });
    created(res, ticket);
  } catch (err) {
    // l'achat a échoué : on rend la place au stock
    await TicketType.updateOne({ _id: type._id }, { $inc: { sold: -1 } });
    if (err.code === 11000) {
      throw new AppError(409, 'TICKET_ALREADY_BOUGHT', "Une personne ne peut obtenir qu'un seul billet par événement");
    }
    throw err;
  }
};

// ---------- Gestion des billets vendus (organisateurs) ----------
exports.listTickets = async (req, res) => {
  const event = await getTicketingEvent(req.params.eventId);
  access.requireOrganizer(event, req.user);

  const filter = { event: event._id, ...dateRange(req.query, 'purchaseDate') };
  if (req.query.ticketType) filter.ticketType = req.query.ticketType;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ 'buyer.firstname': rx }, { 'buyer.lastname': rx }, { 'buyer.email': rx }];
  }
  const { items, meta } = await paginate(Ticket, filter, req.query, {
    sortable: ['purchaseDate', 'createdAt'],
    defaultSort: '-purchaseDate',
    populate: { path: 'ticketType', select: 'name amount' },
  });
  ok(res, items, meta);
};

exports.getTicket = async (req, res) => {
  const ticket = await getTicket(req.params.id);
  access.requireOrganizer(await access.getEvent(ticket.event), req.user);
  await ticket.populate({ path: 'ticketType', select: 'name amount' });
  ok(res, ticket);
};

// L'organisateur corrige les infos de l'acheteur (pas le type de billet)
exports.updateTicket = async (req, res) => {
  const ticket = await getTicket(req.params.id);
  access.requireOrganizer(await access.getEvent(ticket.event), req.user);
  // fusion champ par champ (sinon une adresse partielle écraserait toute l'adresse)
  const { address, ...buyer } = req.body.buyer;
  for (const [key, value] of Object.entries(buyer)) ticket.set(`buyer.${key}`, value);
  for (const [key, value] of Object.entries(address || {})) ticket.set(`buyer.address.${key}`, value);
  try {
    await ticket.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'TICKET_ALREADY_BOUGHT', 'Cet email possède déjà un billet pour cet événement');
    throw err;
  }
  ok(res, ticket);
};

// Annulation : le billet est supprimé et la place est rendue au stock
exports.removeTicket = async (req, res) => {
  const ticket = await getTicket(req.params.id);
  access.requireOrganizer(await access.getEvent(ticket.event), req.user);
  await ticket.deleteOne();
  await TicketType.updateOne({ _id: ticket.ticketType, sold: { $gt: 0 } }, { $inc: { sold: -1 } });
  noContent(res);
};
