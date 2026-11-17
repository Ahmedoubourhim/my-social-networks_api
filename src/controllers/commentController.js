const Comment = require('../models/Comment');
const AppError = require('../utils/AppError');
const { ok, noContent } = require('../utils/response');
const { same } = require('../utils/ids');
const ctxOf = require('../services/context');
const access = require('../services/access');

const AUTHOR = { path: 'author', select: 'firstname lastname avatar' };

async function getComment(id) {
  const comment = await Comment.findById(id);
  if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Commentaire introuvable');
  return comment;
}

// Valable pour les commentaires de messages et de photos
exports.get = async (req, res) => {
  const comment = await getComment(req.params.id);
  const ctx = await ctxOf.ofComment(comment);
  if (comment.photo) {
    // photo : visible comme l'événement (public ou participant)
    if (!access.canSeeEvent(ctx.event, req.user)) throw new AppError(403, 'EVENT_PRIVATE', 'Cet événement est privé');
  } else {
    ctxOf.requireMember(ctx, req.user);
  }
  await comment.populate(AUTHOR);
  ok(res, comment);
};

exports.update = async (req, res) => {
  const comment = await getComment(req.params.id);
  if (!same(comment.author, req.user._id)) throw new AppError(403, 'FORBIDDEN', "Seul l'auteur peut modifier son commentaire");
  comment.content = req.body.content;
  await comment.save();
  ok(res, comment);
};

exports.remove = async (req, res) => {
  const comment = await getComment(req.params.id);
  const ctx = await ctxOf.ofComment(comment);
  if (!same(comment.author, req.user._id) && !ctxOf.isStaff(ctx, req.user)) {
    throw new AppError(403, 'FORBIDDEN', "Seul l'auteur ou un admin/organisateur peut supprimer ce commentaire");
  }
  await comment.deleteOne();
  noContent(res);
};
