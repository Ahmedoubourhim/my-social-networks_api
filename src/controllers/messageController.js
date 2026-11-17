const Message = require('../models/Message');
const Comment = require('../models/Comment');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const { same } = require('../utils/ids');
const ctxOf = require('../services/context');

const AUTHOR = { path: 'author', select: 'firstname lastname avatar' };

async function getMessage(id) {
  const message = await Message.findById(id);
  if (!message) throw new AppError(404, 'MESSAGE_NOT_FOUND', 'Message introuvable');
  return message;
}

exports.get = async (req, res) => {
  const message = await getMessage(req.params.id);
  ctxOf.requireMember(await ctxOf.ofMessage(message), req.user);
  await message.populate(AUTHOR);
  ok(res, message);
};

// Seul l'auteur modifie son message
exports.update = async (req, res) => {
  const message = await getMessage(req.params.id);
  if (!same(message.author, req.user._id)) throw new AppError(403, 'FORBIDDEN', "Seul l'auteur peut modifier son message");
  message.content = req.body.content;
  await message.save();
  ok(res, message);
};

// L'auteur ou un admin/organisateur peut supprimer
exports.remove = async (req, res) => {
  const message = await getMessage(req.params.id);
  const ctx = await ctxOf.ofMessage(message);
  if (!same(message.author, req.user._id) && !ctxOf.isStaff(ctx, req.user)) {
    throw new AppError(403, 'FORBIDDEN', "Seul l'auteur ou un admin/organisateur peut supprimer ce message");
  }
  await Comment.deleteMany({ message: message._id });
  await message.deleteOne();
  noContent(res);
};

// ---------- /messages/:id/comments ----------
exports.listComments = async (req, res) => {
  const message = await getMessage(req.params.id);
  ctxOf.requireMember(await ctxOf.ofMessage(message), req.user);

  const filter = { message: message._id, ...dateRange(req.query, 'createdAt') };
  if (req.query.q) filter.content = new RegExp(escapeRegex(req.query.q), 'i');
  const { items, meta } = await paginate(Comment, filter, req.query, {
    sortable: ['createdAt'],
    defaultSort: 'createdAt',
    populate: AUTHOR,
  });
  ok(res, items, meta);
};

// Tout membre (groupe) / participant (événement) peut commenter, même si allowMembersToPost = false
exports.createComment = async (req, res) => {
  const message = await getMessage(req.params.id);
  ctxOf.requireMember(await ctxOf.ofMessage(message), req.user);

  const comment = await Comment.create({ message: message._id, author: req.user._id, content: req.body.content });
  await comment.populate(AUTHOR);
  created(res, comment);
};
