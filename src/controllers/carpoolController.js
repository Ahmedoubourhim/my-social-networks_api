const CarpoolOffer = require('../models/CarpoolOffer');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const { same, includesId } = require('../utils/ids');
const access = require('../services/access');

const POPULATE = [
  { path: 'driver', select: 'firstname lastname avatar' },
  { path: 'passengers', select: 'firstname lastname avatar' },
];

async function getCarpoolEvent(eventId, user) {
  const event = await access.getVisibleEvent(eventId, user);
  access.requireFeature(event, 'carpoolEnabled', 'Le covoiturage');
  return event;
}

async function getOffer(id) {
  const offer = await CarpoolOffer.findById(id);
  if (!offer) throw new AppError(404, 'CARPOOL_NOT_FOUND', 'Offre de covoiturage introuvable');
  return offer;
}

// GET /events/:eventId/carpools?q=&maxPrice=&minSeats=&from=&to=
exports.list = async (req, res) => {
  const event = await getCarpoolEvent(req.params.eventId, req.user);
  const filter = { event: event._id, ...dateRange(req.query, 'departureTime') };
  if (req.query.q) filter.departurePlace = new RegExp(escapeRegex(req.query.q), 'i');
  if (req.query.maxPrice !== undefined) filter.price = { $lte: Number(req.query.maxPrice) };
  if (req.query.minSeats !== undefined) filter.availableSeats = { $gte: Number(req.query.minSeats) };

  const { items, meta } = await paginate(CarpoolOffer, filter, req.query, {
    sortable: ['price', 'departureTime', 'availableSeats', 'createdAt'],
    defaultSort: 'departureTime',
    populate: POPULATE,
  });
  ok(res, items, meta);
};

exports.create = async (req, res) => {
  const event = await getCarpoolEvent(req.params.eventId, req.user);
  access.requireEventMember(event, req.user);
  const offer = await CarpoolOffer.create({ ...req.body, event: event._id, driver: req.user._id });
  await offer.populate(POPULATE);
  created(res, offer);
};

exports.get = async (req, res) => {
  const offer = await getOffer(req.params.id);
  await getCarpoolEvent(offer.event, req.user);
  await offer.populate(POPULATE);
  ok(res, offer);
};

async function getEditable(req) {
  const offer = await getOffer(req.params.id);
  const event = await getCarpoolEvent(offer.event, req.user);
  if (!same(offer.driver, req.user._id)) access.requireOrganizer(event, req.user);
  return offer;
}

exports.update = async (req, res) => {
  const offer = await getEditable(req);
  offer.set(req.body);
  await offer.save();
  await offer.populate(POPULATE);
  ok(res, offer);
};

exports.remove = async (req, res) => {
  const offer = await getEditable(req);
  await offer.deleteOne();
  noContent(res);
};

// POST /carpools/:id/book : réserve UNE place (décrément atomique des places disponibles)
exports.book = async (req, res) => {
  const offer = await getOffer(req.params.id);
  const event = await getCarpoolEvent(offer.event, req.user);
  access.requireEventMember(event, req.user);

  if (same(offer.driver, req.user._id)) throw new AppError(400, 'DRIVER_CANNOT_BOOK', 'Le conducteur ne peut pas réserver sa propre offre');
  if (includesId(offer.passengers, req.user._id)) throw new AppError(409, 'ALREADY_BOOKED', 'Vous avez déjà une place dans cette voiture');

  const updated = await CarpoolOffer.findOneAndUpdate(
    { _id: offer._id, availableSeats: { $gt: 0 }, passengers: { $ne: req.user._id } },
    { $inc: { availableSeats: -1 }, $push: { passengers: req.user._id } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new AppError(409, 'NO_SEATS_LEFT', "Il n'y a plus de place disponible dans cette voiture");

  await updated.populate(POPULATE);
  created(res, updated);
};

// DELETE /carpools/:id/book : annule sa réservation (la place est rendue)
exports.cancelBooking = async (req, res) => {
  const offer = await getOffer(req.params.id);
  await getCarpoolEvent(offer.event, req.user);

  const updated = await CarpoolOffer.findOneAndUpdate(
    { _id: offer._id, passengers: req.user._id },
    { $inc: { availableSeats: 1 }, $pull: { passengers: req.user._id } },
    { returnDocument: 'after' }
  );
  if (!updated) throw new AppError(404, 'NOT_BOOKED', "Vous n'avez pas réservé de place dans cette voiture");
  noContent(res);
};
