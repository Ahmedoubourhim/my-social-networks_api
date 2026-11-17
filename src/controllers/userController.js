const User = require('../models/User');
const Group = require('../models/Group');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { ok, noContent } = require('../utils/response');
const { paginate, escapeRegex } = require('../utils/pagination');
const { same } = require('../utils/ids');

// Les autres utilisateurs ne voient que le profil public
const PUBLIC_FIELDS = 'firstname lastname avatar createdAt';

// GET /users?q=&city=&page=&limit=&sort=
exports.list = async (req, res) => {
  const filter = {};
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ firstname: rx }, { lastname: rx }];
  }
  if (req.query.city) filter['address.city'] = new RegExp(`^${escapeRegex(req.query.city)}$`, 'i');

  const { items, meta } = await paginate(User, filter, req.query, {
    sortable: ['firstname', 'lastname', 'createdAt'],
    select: PUBLIC_FIELDS,
  });
  ok(res, items, meta);
};

exports.me = (req, res) => ok(res, req.user);

exports.get = async (req, res) => {
  if (same(req.params.id, req.user._id)) return ok(res, req.user);
  const user = await User.findById(req.params.id).select(PUBLIC_FIELDS);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
  ok(res, user);
};

exports.update = async (req, res) => {
  if (!same(req.params.id, req.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'Vous ne pouvez modifier que votre propre compte');
  }
  if (req.body.email && req.body.email.toLowerCase() !== req.user.email) {
    const exists = await User.findOne({ email: req.body.email.toLowerCase() });
    if (exists) throw new AppError(409, 'EMAIL_ALREADY_USED', 'Un utilisateur avec cet email existe déjà');
  }
  req.user.set(req.body);
  await req.user.save();
  ok(res, req.user);
};

exports.remove = async (req, res) => {
  if (!same(req.params.id, req.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'Vous ne pouvez supprimer que votre propre compte');
  }
  const id = req.user._id;

  // on ne peut pas laisser un groupe sans admin ni un événement sans organisateur
  const soleAdmin = await Group.exists({ admins: [id] });
  const soleOrganizer = await Event.exists({ organizers: [id] });
  if (soleAdmin || soleOrganizer) {
    throw new AppError(409, 'LAST_ADMIN_OR_ORGANIZER', "Vous êtes le seul administrateur d'un groupe ou le seul organisateur d'un événement : transférez ou supprimez-les d'abord");
  }

  await Group.updateMany({}, { $pull: { members: id, admins: id } });
  await Event.updateMany({}, { $pull: { organizers: id, participants: id } });
  await req.user.deleteOne();
  noContent(res);
};
