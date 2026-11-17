const ShoppingItem = require('../models/ShoppingItem');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const { same } = require('../utils/ids');
const access = require('../services/access');

const USER = { path: 'user', select: 'firstname lastname avatar' };

const duplicate = () => new AppError(409, 'ITEM_ALREADY_EXISTS', 'Cet élément est déjà apporté par quelqu\'un pour cet événement');

// Shopping list : événement visible + option activée + utilisateur participant/organisateur
async function getListEvent(eventId, user) {
  const event = await access.getVisibleEvent(eventId, user);
  access.requireFeature(event, 'shoppingListEnabled', 'La shopping list');
  return event;
}

async function getItem(id) {
  const item = await ShoppingItem.findById(id);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Élément introuvable');
  return item;
}

exports.list = async (req, res) => {
  const event = await getListEvent(req.params.eventId, req.user);
  const filter = { event: event._id, ...dateRange(req.query, 'arrivalTime') };
  if (req.query.q) filter.name = new RegExp(escapeRegex(req.query.q), 'i');
  if (req.query.user) filter.user = req.query.user;

  const { items, meta } = await paginate(ShoppingItem, filter, req.query, {
    sortable: ['name', 'quantity', 'arrivalTime', 'createdAt'],
    defaultSort: 'arrivalTime',
    populate: USER,
  });
  ok(res, items, meta);
};

exports.create = async (req, res) => {
  const event = await getListEvent(req.params.eventId, req.user);
  access.requireEventMember(event, req.user);

  const normalized = ShoppingItem.normalize(req.body.name);
  if (await ShoppingItem.exists({ event: event._id, nameNormalized: normalized })) throw duplicate();

  try {
    const item = await ShoppingItem.create({ ...req.body, event: event._id, user: req.user._id });
    await item.populate(USER);
    created(res, item);
  } catch (err) {
    if (err.code === 11000) throw duplicate(); // course entre deux créations simultanées
    throw err;
  }
};

exports.get = async (req, res) => {
  const item = await getItem(req.params.id);
  await getListEvent(item.event, req.user);
  await item.populate(USER);
  ok(res, item);
};

// Modifiable par celui qui l'apporte ou par un organisateur
async function getEditable(req) {
  const item = await getItem(req.params.id);
  const event = await getListEvent(item.event, req.user);
  if (!same(item.user, req.user._id)) access.requireOrganizer(event, req.user);
  return item;
}

exports.update = async (req, res) => {
  const item = await getEditable(req);
  item.set(req.body);
  try {
    await item.save();
  } catch (err) {
    if (err.code === 11000) throw duplicate();
    throw err;
  }
  await item.populate(USER);
  ok(res, item);
};

exports.remove = async (req, res) => {
  const item = await getEditable(req);
  await item.deleteOne();
  noContent(res);
};
