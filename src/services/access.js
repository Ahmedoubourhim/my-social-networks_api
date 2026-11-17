// Contrôle des droits : qui est membre / admin d'un groupe, organisateur / participant d'un événement
const Group = require('../models/Group');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { includesId } = require('../utils/ids');

// ---------- Groupes ----------
exports.isGroupMember = (group, user) => includesId(group.members, user._id);
exports.isGroupAdmin = (group, user) => includesId(group.admins, user._id);

// Un groupe secret n'existe pas pour les non-membres (404)
exports.getGroup = async (id, user) => {
  const group = await Group.findById(id);
  if (!group || (group.type === 'secret' && !exports.isGroupMember(group, user))) {
    throw new AppError(404, 'GROUP_NOT_FOUND', 'Groupe introuvable');
  }
  return group;
};

exports.requireGroupAdmin = (group, user) => {
  if (!exports.isGroupAdmin(group, user)) {
    throw new AppError(403, 'NOT_GROUP_ADMIN', 'Action réservée aux administrateurs du groupe');
  }
};

exports.requireGroupMember = (group, user) => {
  if (!exports.isGroupMember(group, user)) {
    throw new AppError(403, 'NOT_GROUP_MEMBER', 'Action réservée aux membres du groupe');
  }
};

// ---------- Événements ----------
exports.isOrganizer = (event, user) => includesId(event.organizers, user._id);
// "participant" au sens large : organisateur ou invité
exports.isEventMember = (event, user) =>
  exports.isOrganizer(event, user) || includesId(event.participants, user._id);

exports.canSeeEvent = (event, user) => event.visibility === 'public' || exports.isEventMember(event, user);

exports.getEvent = async (id) => {
  const event = await Event.findById(id);
  if (!event) throw new AppError(404, 'EVENT_NOT_FOUND', 'Événement introuvable');
  return event;
};

// Un événement privé n'est visible que par ses organisateurs et ses participants
exports.getVisibleEvent = async (id, user) => {
  const event = await exports.getEvent(id);
  if (!exports.canSeeEvent(event, user)) {
    throw new AppError(403, 'EVENT_PRIVATE', 'Cet événement est privé');
  }
  return event;
};

exports.requireOrganizer = (event, user) => {
  if (!exports.isOrganizer(event, user)) {
    throw new AppError(403, 'NOT_ORGANIZER', "Action réservée aux organisateurs de l'événement");
  }
};

exports.requireEventMember = (event, user) => {
  if (!exports.isEventMember(event, user)) {
    throw new AppError(403, 'NOT_PARTICIPANT', "Action réservée aux participants de l'événement");
  }
};

// Option activable sur l'événement (billetterie, shopping list, covoiturage)
exports.requireFeature = (event, flag, label) => {
  if (!event[flag]) {
    throw new AppError(403, 'FEATURE_DISABLED', `${label} n'est pas activé(e) pour cet événement`);
  }
};
