// Retrouve le "contexte" (groupe ou événement) d'un fil / message / commentaire
// pour appliquer les bons droits : membre/admin pour un groupe, participant/organisateur pour un événement.
const mongoose = require('mongoose');
const Group = require('../models/Group');
const Event = require('../models/Event');
const Thread = require('../models/Thread');
const Message = require('../models/Message');
const AppError = require('../utils/AppError');
const access = require('./access');

const notFound = (what) => new AppError(404, 'NOT_FOUND', `${what} introuvable`);

exports.ofThread = async (thread) => {
  if (thread.group) {
    const group = await Group.findById(thread.group);
    if (!group) throw notFound('Groupe');
    return { kind: 'group', group };
  }
  const event = await Event.findById(thread.event);
  if (!event) throw notFound('Événement');
  return { kind: 'event', event };
};

exports.ofMessage = async (message) => {
  const thread = await Thread.findById(message.thread);
  if (!thread) throw notFound('Fil de discussion');
  return exports.ofThread(thread);
};

exports.ofComment = async (comment) => {
  if (comment.message) {
    const message = await Message.findById(comment.message);
    if (!message) throw notFound('Message');
    return exports.ofMessage(message);
  }
  const photo = await mongoose.model('Photo').findById(comment.photo);
  if (!photo) throw notFound('Photo');
  const album = await mongoose.model('Album').findById(photo.album);
  if (!album) throw notFound('Album');
  return { kind: 'event', event: await Event.findById(album.event) };
};

// membre du groupe / participant de l'événement
exports.isMember = (ctx, user) =>
  ctx.kind === 'group' ? access.isGroupMember(ctx.group, user) : access.isEventMember(ctx.event, user);

// admin du groupe / organisateur de l'événement
exports.isStaff = (ctx, user) =>
  ctx.kind === 'group' ? access.isGroupAdmin(ctx.group, user) : access.isOrganizer(ctx.event, user);

exports.requireMember = (ctx, user) => {
  if (!exports.isMember(ctx, user)) {
    throw new AppError(
      403,
      ctx.kind === 'group' ? 'NOT_GROUP_MEMBER' : 'NOT_PARTICIPANT',
      ctx.kind === 'group' ? 'Réservé aux membres du groupe' : "Réservé aux participants de l'événement"
    );
  }
};

// Publier : membre/participant ; dans un groupe, les simples membres seulement si allowMembersToPost
exports.requirePoster = (ctx, user) => {
  exports.requireMember(ctx, user);
  if (ctx.kind === 'group' && !ctx.group.allowMembersToPost && !exports.isStaff(ctx, user)) {
    throw new AppError(403, 'POSTING_NOT_ALLOWED', 'Ce groupe réserve la publication à ses administrateurs');
  }
};
