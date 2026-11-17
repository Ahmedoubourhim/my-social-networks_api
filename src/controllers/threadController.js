const Thread = require('../models/Thread');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const { same } = require('../utils/ids');
const access = require('../services/access');
const ctxOf = require('../services/context');
const cascade = require('../services/cascade');

const AUTHOR = { path: 'author', select: 'firstname lastname avatar' };

async function getThread(id) {
  const thread = await Thread.findById(id);
  if (!thread) throw new AppError(404, 'THREAD_NOT_FOUND', 'Fil de discussion introuvable');
  return thread;
}

// POST /threads : lié à un groupe OU à un événement (contrôlé par Joi, le schéma et ici)
exports.create = async (req, res) => {
  const { group, event } = req.body;
  if (!!group === !!event) {
    throw new AppError(400, 'THREAD_TARGET', 'Un fil est lié à un groupe OU à un événement, jamais aux deux ni à aucun');
  }

  const ctx = group
    ? { kind: 'group', group: await access.getGroup(group, req.user) }
    : { kind: 'event', event: await access.getEvent(event) };
  ctxOf.requirePoster(ctx, req.user);

  const thread = await Thread.create({ title: req.body.title, group, event, createdBy: req.user._id });
  created(res, thread);
};

// GET /threads?group=&event=&q= : uniquement les fils auxquels l'utilisateur a accès
exports.list = async (req, res) => {
  const me = req.user._id;
  const groupIds = await Group.find({ members: me }).distinct('_id');
  const eventIds = await Event.find({ $or: [{ organizers: me }, { participants: me }] }).distinct('_id');

  const and = [{ $or: [{ group: { $in: groupIds } }, { event: { $in: eventIds } }] }];
  if (req.query.group) and.push({ group: req.query.group });
  if (req.query.event) and.push({ event: req.query.event });
  if (req.query.q) and.push({ title: new RegExp(escapeRegex(req.query.q), 'i') });

  const { items, meta } = await paginate(Thread, { $and: and }, req.query, { sortable: ['title', 'createdAt'] });
  ok(res, items, meta);
};

exports.get = async (req, res) => {
  const thread = await getThread(req.params.id);
  ctxOf.requireMember(await ctxOf.ofThread(thread), req.user);
  ok(res, thread);
};

exports.update = async (req, res) => {
  const thread = await getThread(req.params.id);
  const ctx = await ctxOf.ofThread(thread);
  if (!same(thread.createdBy, req.user._id) && !ctxOf.isStaff(ctx, req.user)) {
    throw new AppError(403, 'FORBIDDEN', "Seul le créateur du fil ou un admin/organisateur peut le modifier");
  }
  thread.title = req.body.title;
  await thread.save();
  ok(res, thread);
};

exports.remove = async (req, res) => {
  const thread = await getThread(req.params.id);
  const ctx = await ctxOf.ofThread(thread);
  if (!same(thread.createdBy, req.user._id) && !ctxOf.isStaff(ctx, req.user)) {
    throw new AppError(403, 'FORBIDDEN', "Seul le créateur du fil ou un admin/organisateur peut le supprimer");
  }
  await cascade.deleteThreads({ _id: thread._id });
  noContent(res);
};

// ---------- /threads/:id/messages ----------
exports.listMessages = async (req, res) => {
  const thread = await getThread(req.params.id);
  ctxOf.requireMember(await ctxOf.ofThread(thread), req.user);

  const filter = { thread: thread._id, ...dateRange(req.query, 'createdAt') };
  if (req.query.q) filter.content = new RegExp(escapeRegex(req.query.q), 'i');
  if (req.query.author) filter.author = req.query.author;

  const { items, meta } = await paginate(Message, filter, req.query, {
    sortable: ['createdAt'],
    populate: AUTHOR,
  });
  ok(res, items, meta);
};

exports.createMessage = async (req, res) => {
  const thread = await getThread(req.params.id);
  ctxOf.requirePoster(await ctxOf.ofThread(thread), req.user);

  const message = await Message.create({ thread: thread._id, author: req.user._id, content: req.body.content });
  await message.populate(AUTHOR);
  created(res, message);
};
