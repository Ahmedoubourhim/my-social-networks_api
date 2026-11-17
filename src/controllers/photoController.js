const Photo = require('../models/Photo');
const Album = require('../models/Album');
const Comment = require('../models/Comment');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, dateRange } = require('../utils/pagination');
const { same } = require('../utils/ids');
const access = require('../services/access');

const USER = 'firstname lastname avatar';

async function getPhoto(id) {
  const photo = await Photo.findById(id);
  if (!photo) throw new AppError(404, 'PHOTO_NOT_FOUND', 'Photo introuvable');
  return photo;
}

// retrouve l'événement d'une photo (photo -> album -> événement)
async function eventOf(photo) {
  const album = await Album.findById(photo.album);
  return access.getEvent(album.event);
}

exports.get = async (req, res) => {
  const photo = await getPhoto(req.params.id);
  const event = await eventOf(photo);
  if (!access.canSeeEvent(event, req.user)) throw new AppError(403, 'EVENT_PRIVATE', 'Cet événement est privé');
  await photo.populate({ path: 'postedBy', select: USER });
  ok(res, photo);
};

exports.update = async (req, res) => {
  const photo = await getPhoto(req.params.id);
  if (!same(photo.postedBy, req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Seul celui qui a posté la photo peut la modifier');
  photo.set(req.body);
  await photo.save();
  ok(res, photo);
};

exports.remove = async (req, res) => {
  const photo = await getPhoto(req.params.id);
  if (!same(photo.postedBy, req.user._id)) access.requireOrganizer(await eventOf(photo), req.user);
  await Comment.deleteMany({ photo: photo._id });
  await photo.deleteOne();
  noContent(res);
};

// ---------- /photos/:id/comments ----------
exports.listComments = async (req, res) => {
  const photo = await getPhoto(req.params.id);
  const event = await eventOf(photo);
  if (!access.canSeeEvent(event, req.user)) throw new AppError(403, 'EVENT_PRIVATE', 'Cet événement est privé');

  const filter = { photo: photo._id, ...dateRange(req.query, 'createdAt') };
  const { items, meta } = await paginate(Comment, filter, req.query, {
    sortable: ['createdAt'],
    defaultSort: 'createdAt',
    populate: { path: 'author', select: USER },
  });
  ok(res, items, meta);
};

// 0..n participants de l'événement peuvent commenter une photo
exports.createComment = async (req, res) => {
  const photo = await getPhoto(req.params.id);
  access.requireEventMember(await eventOf(photo), req.user);

  const comment = await Comment.create({ photo: photo._id, author: req.user._id, content: req.body.content });
  await comment.populate({ path: 'author', select: USER });
  created(res, comment);
};
