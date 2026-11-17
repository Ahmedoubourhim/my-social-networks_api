const Album = require('../models/Album');
const Photo = require('../models/Photo');
const Comment = require('../models/Comment');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const { same } = require('../utils/ids');
const access = require('../services/access');

const POSTER = { path: 'postedBy', select: 'firstname lastname avatar' };

async function getAlbum(id) {
  const album = await Album.findById(id);
  if (!album) throw new AppError(404, 'ALBUM_NOT_FOUND', 'Album introuvable');
  return album;
}

// Album lisible si l'événement est public, ou si on y participe
async function getReadableAlbum(id, user) {
  const album = await getAlbum(id);
  await access.getVisibleEvent(album.event, user);
  return album;
}

// POST /albums : un participant ou un organisateur crée l'album d'un événement
exports.create = async (req, res) => {
  const event = await access.getEvent(req.body.event);
  access.requireEventMember(event, req.user);
  const album = await Album.create({ ...req.body, createdBy: req.user._id });
  created(res, album);
};

// GET /albums?event=&q=
exports.list = async (req, res) => {
  const filter = {};
  if (req.query.event) {
    await access.getVisibleEvent(req.query.event, req.user);
    filter.event = req.query.event;
  } else {
    const me = req.user._id;
    filter.event = {
      $in: await Event.find({ $or: [{ visibility: 'public' }, { organizers: me }, { participants: me }] }).distinct('_id'),
    };
  }
  if (req.query.q) filter.title = new RegExp(escapeRegex(req.query.q), 'i');

  const { items, meta } = await paginate(Album, filter, req.query, { sortable: ['title', 'createdAt'] });
  ok(res, items, meta);
};

exports.get = async (req, res) => {
  ok(res, await getReadableAlbum(req.params.id, req.user));
};

exports.update = async (req, res) => {
  const album = await getAlbum(req.params.id);
  const event = await access.getEvent(album.event);
  if (!same(album.createdBy, req.user._id)) access.requireOrganizer(event, req.user);
  album.set(req.body);
  await album.save();
  ok(res, album);
};

exports.remove = async (req, res) => {
  const album = await getAlbum(req.params.id);
  const event = await access.getEvent(album.event);
  if (!same(album.createdBy, req.user._id)) access.requireOrganizer(event, req.user);

  const photoIds = await Photo.find({ album: album._id }).distinct('_id');
  await Comment.deleteMany({ photo: { $in: photoIds } });
  await Photo.deleteMany({ album: album._id });
  await album.deleteOne();
  noContent(res);
};

// ---------- /albums/:id/photos ----------
exports.listPhotos = async (req, res) => {
  const album = await getReadableAlbum(req.params.id, req.user);
  const filter = { album: album._id, ...dateRange(req.query, 'createdAt') };
  if (req.query.postedBy) filter.postedBy = req.query.postedBy;
  if (req.query.q) filter.caption = new RegExp(escapeRegex(req.query.q), 'i');

  const { items, meta } = await paginate(Photo, filter, req.query, { sortable: ['createdAt'], populate: POSTER });
  ok(res, items, meta);
};

// Une photo est postée par 1 participant de l'événement (organisateurs inclus), sinon 403
exports.createPhoto = async (req, res) => {
  const album = await getAlbum(req.params.id);
  const event = await access.getEvent(album.event);
  access.requireEventMember(event, req.user);

  const photo = await Photo.create({ album: album._id, postedBy: req.user._id, ...req.body });
  await photo.populate(POSTER);
  created(res, photo);
};
