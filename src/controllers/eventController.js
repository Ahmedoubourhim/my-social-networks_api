const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex, dateRange } = require('../utils/pagination');
const { includesId } = require('../utils/ids');
const access = require('../services/access');
const cascade = require('../services/cascade');
const { shareLinks } = require('../services/share');
const { unique, assertUsersExist } = require('../services/users');
const Group = require('../models/Group');

const USER_FIELDS = 'firstname lastname avatar';

const populate = (event) =>
  event.populate([
    { path: 'organizers', select: USER_FIELDS },
    { path: 'participants', select: USER_FIELDS },
    { path: 'group', select: 'name type icon' },
  ]);

// POST /events : étape 1 du parcours guidé (configuration de l'événement)
exports.create = async (req, res) => {
  const { inviteGroupMembers, organizers = [], participants = [], group: groupId, ...data } = req.body;

  let group = null;
  if (groupId) {
    group = await access.getGroup(groupId, req.user);
    access.requireGroupMember(group, req.user);
    // si le groupe n'autorise pas les membres à créer des événements, seuls les admins le peuvent
    if (!group.allowMembersToCreateEvents && !access.isGroupAdmin(group, req.user)) {
      throw new AppError(403, 'GROUP_EVENTS_NOT_ALLOWED', 'Ce groupe réserve la création d\'événements à ses administrateurs');
    }
  }

  const organizerIds = unique([req.user._id, ...organizers]);
  let participantIds = unique(participants).filter((id) => !organizerIds.includes(id));
  if (group && inviteGroupMembers) {
    participantIds = unique([...participantIds, ...group.members]).filter((id) => !organizerIds.includes(id));
  }
  await assertUsersExist(unique([...organizerIds, ...participantIds]));

  const event = await Event.create({
    ...data,
    group: group ? group._id : undefined,
    organizers: organizerIds,
    participants: participantIds,
    createdBy: req.user._id,
  });
  await populate(event);
  created(res, event);
};

// GET /events?q=&visibility=&group=&mine=true&role=organizer&from=&to=&sort=
exports.list = async (req, res) => {
  const me = req.user._id;
  // on ne voit que les événements publics + ceux où l'on est organisateur ou participant
  const and = [{ $or: [{ visibility: 'public' }, { organizers: me }, { participants: me }] }];

  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    and.push({ $or: [{ name: rx }, { description: rx }, { location: rx }] });
  }
  if (req.query.visibility) and.push({ visibility: req.query.visibility });
  if (req.query.group) and.push({ group: req.query.group });
  if (req.query.role === 'organizer') and.push({ organizers: me });
  else if (req.query.mine === 'true') and.push({ $or: [{ organizers: me }, { participants: me }] });
  and.push(dateRange(req.query, 'startDate'));

  const { items, meta } = await paginate(Event, { $and: and }, req.query, {
    sortable: ['name', 'startDate', 'endDate', 'createdAt'],
    defaultSort: 'startDate',
    populate: [{ path: 'group', select: 'name type icon' }],
  });
  ok(res, items, meta);
};

exports.get = async (req, res) => {
  const event = await access.getVisibleEvent(req.params.id, req.user);
  await populate(event);
  ok(res, event);
};

exports.update = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  event.set(req.body);
  await event.save(); // endDate > startDate et billetterie => public vérifiés dans le schéma
  await populate(event);
  ok(res, event);
};

exports.remove = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  await cascade.deleteEvent(event._id);
  noContent(res);
};

// ---------- Organisateurs ----------
exports.addOrganizer = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  await assertUsersExist([req.body.userId]);
  if (includesId(event.organizers, req.body.userId)) throw new AppError(409, 'ALREADY_ORGANIZER', 'Cet utilisateur est déjà organisateur');
  event.organizers.push(req.body.userId);
  event.participants.pull(req.body.userId); // un organisateur n'a pas besoin d'être aussi "participant"
  await event.save();
  await populate(event);
  created(res, event);
};

exports.removeOrganizer = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  if (!includesId(event.organizers, req.params.userId)) throw new AppError(404, 'NOT_AN_ORGANIZER', "Cet utilisateur n'est pas organisateur");
  if (event.organizers.length === 1) {
    throw new AppError(409, 'LAST_ORGANIZER', "Impossible de retirer le dernier organisateur de l'événement");
  }
  event.organizers.pull(req.params.userId);
  await event.save();
  noContent(res);
};

// ---------- Participants ----------
// Ajoute des participants sauf ceux qui le sont déjà (ou qui sont organisateurs)
async function addParticipants(event, ids) {
  const toAdd = unique(ids).filter((id) => !includesId(event.participants, id) && !includesId(event.organizers, id));
  if (!toAdd.length) throw new AppError(409, 'ALREADY_PARTICIPANT', 'Ces utilisateurs participent déjà à l\'événement');
  event.participants.push(...toAdd);
  await event.save();
}

exports.addParticipants = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  const ids = req.body.userIds || [req.body.userId];
  await assertUsersExist(unique(ids));
  await addParticipants(event, ids);
  await populate(event);
  created(res, event);
};

exports.removeParticipant = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  const self = String(req.user._id) === req.params.userId;
  if (!self) access.requireOrganizer(event, req.user);
  if (!includesId(event.participants, req.params.userId)) throw new AppError(404, 'NOT_A_PARTICIPANT', "Cet utilisateur n'est pas participant");
  event.participants.pull(req.params.userId);
  await event.save();
  noContent(res);
};

// POST /events/:id/join : on rejoint un événement public
exports.join = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  if (event.visibility !== 'public') throw new AppError(403, 'EVENT_PRIVATE', 'Cet événement est privé : il faut y être invité');
  if (access.isEventMember(event, req.user)) throw new AppError(409, 'ALREADY_PARTICIPANT', 'Vous participez déjà à cet événement');
  event.participants.push(req.user._id);
  await event.save();
  await populate(event);
  ok(res, event);
};

exports.leave = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  if (access.isOrganizer(event, req.user)) {
    throw new AppError(400, 'ORGANIZER_CANNOT_LEAVE', 'Un organisateur doit être retiré via DELETE /events/:id/organizers/:userId');
  }
  if (!includesId(event.participants, req.user._id)) throw new AppError(404, 'NOT_A_PARTICIPANT', 'Vous ne participez pas à cet événement');
  event.participants.pull(req.user._id);
  await event.save();
  noContent(res);
};

// POST /events/:id/invite-group-members : "inviter tous les membres du groupe en un clic"
exports.inviteGroupMembers = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  if (!event.group) throw new AppError(400, 'NO_GROUP', "Cet événement n'est pas rattaché à un groupe");
  const group = await Group.findById(event.group);
  if (!group) throw new AppError(404, 'GROUP_NOT_FOUND', 'Groupe introuvable');
  await addParticipants(event, group.members);
  await populate(event);
  ok(res, event);
};

// GET /events/:id/share : liens de partage (événement public, hors groupe privé/secret)
exports.share = async (req, res) => {
  const event = await access.getEvent(req.params.id);
  access.requireOrganizer(event, req.user);
  if (event.visibility !== 'public') {
    throw new AppError(403, 'SHARE_NOT_ALLOWED', 'Seuls les événements publics peuvent être partagés');
  }
  if (event.group) {
    const group = await Group.findById(event.group);
    if (group && group.type !== 'public') {
      throw new AppError(403, 'SHARE_NOT_ALLOWED', 'Le partage est réservé aux groupes publics');
    }
  }
  ok(res, shareLinks(event));
};
