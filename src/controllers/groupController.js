const Group = require('../models/Group');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex } = require('../utils/pagination');
const { includesId } = require('../utils/ids');
const access = require('../services/access');
const cascade = require('../services/cascade');
const { unique, assertUsersExist } = require('../services/users');

const USER_FIELDS = 'firstname lastname avatar';

// Vue "résumé" d'un groupe : sans la liste des membres (utilisée pour les non-membres d'un groupe privé)
const summary = (group) => {
  const obj = group.toJSON();
  obj.membersCount = obj.members.length;
  obj.adminsCount = obj.admins.length;
  delete obj.members;
  delete obj.admins;
  return obj;
};

const populate = (group) =>
  group.populate([
    { path: 'admins', select: USER_FIELDS },
    { path: 'members', select: USER_FIELDS },
  ]);

// POST /groups : le créateur est automatiquement admin ET membre
exports.create = async (req, res) => {
  const { members = [], ...data } = req.body;
  const memberIds = unique([req.user._id, ...members]);
  await assertUsersExist(memberIds);

  const group = await Group.create({
    ...data,
    admins: [req.user._id],
    members: memberIds,
    createdBy: req.user._id,
  });
  await populate(group);
  created(res, group);
};

// GET /groups?q=&type=&mine=true : les groupes secrets n'apparaissent que pour leurs membres
exports.list = async (req, res) => {
  const me = req.user._id;
  const and = [{ $or: [{ type: { $in: ['public', 'private'] } }, { members: me }] }];

  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    and.push({ $or: [{ name: rx }, { description: rx }] });
  }
  if (req.query.type) and.push({ type: req.query.type });
  if (req.query.mine === 'true') and.push({ members: me });

  const { items, meta } = await paginate(Group, { $and: and }, req.query, {
    sortable: ['name', 'type', 'createdAt'],
  });
  ok(res, items.map(summary), meta);
};

exports.get = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  if (group.type === 'public' || access.isGroupMember(group, req.user)) {
    await populate(group);
    return ok(res, group);
  }
  ok(res, summary(group)); // groupe privé, utilisateur non membre
};

exports.update = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  access.requireGroupAdmin(group, req.user);
  group.set(req.body);
  await group.save();
  await populate(group);
  ok(res, group);
};

exports.remove = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  access.requireGroupAdmin(group, req.user);
  await cascade.deleteGroup(group._id);
  noContent(res);
};

// POST /groups/:id/join : public => direct ; privé => sur invitation d'un admin ; secret => invisible
exports.join = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  if (access.isGroupMember(group, req.user)) throw new AppError(409, 'ALREADY_MEMBER', 'Vous êtes déjà membre de ce groupe');
  if (group.type !== 'public') {
    throw new AppError(403, 'GROUP_NOT_PUBLIC', "Ce groupe n'est pas public : un administrateur doit vous ajouter");
  }
  group.members.push(req.user._id);
  await group.save();
  ok(res, summary(group));
};

exports.leave = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  access.requireGroupMember(group, req.user);
  if (access.isGroupAdmin(group, req.user) && group.admins.length === 1) {
    throw new AppError(409, 'LAST_ADMIN', 'Vous êtes le dernier administrateur : nommez-en un autre ou supprimez le groupe');
  }
  group.members.pull(req.user._id);
  group.admins.pull(req.user._id);
  await group.save();
  noContent(res);
};

exports.addMember = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  access.requireGroupAdmin(group, req.user);
  await assertUsersExist([req.body.userId]);
  if (includesId(group.members, req.body.userId)) throw new AppError(409, 'ALREADY_MEMBER', 'Cet utilisateur est déjà membre');
  group.members.push(req.body.userId);
  await group.save();
  await populate(group);
  created(res, group);
};

// DELETE /groups/:id/members/:userId : un admin retire un membre (ou un membre se retire lui-même)
exports.removeMember = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  const self = String(req.user._id) === req.params.userId;
  if (!self) access.requireGroupAdmin(group, req.user);
  if (!includesId(group.members, req.params.userId)) throw new AppError(404, 'NOT_A_MEMBER', "Cet utilisateur n'est pas membre du groupe");
  if (includesId(group.admins, req.params.userId) && group.admins.length === 1) {
    throw new AppError(409, 'LAST_ADMIN', 'Impossible de retirer le dernier administrateur du groupe');
  }
  group.members.pull(req.params.userId);
  group.admins.pull(req.params.userId);
  await group.save();
  noContent(res);
};

exports.addAdmin = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  access.requireGroupAdmin(group, req.user);
  if (!includesId(group.members, req.body.userId)) {
    throw new AppError(400, 'NOT_A_MEMBER', "L'utilisateur doit d'abord être membre du groupe");
  }
  if (includesId(group.admins, req.body.userId)) throw new AppError(409, 'ALREADY_ADMIN', 'Cet utilisateur est déjà administrateur');
  group.admins.push(req.body.userId);
  await group.save();
  await populate(group);
  created(res, group);
};

exports.removeAdmin = async (req, res) => {
  const group = await access.getGroup(req.params.id, req.user);
  access.requireGroupAdmin(group, req.user);
  if (!includesId(group.admins, req.params.userId)) throw new AppError(404, 'NOT_AN_ADMIN', "Cet utilisateur n'est pas administrateur");
  if (group.admins.length === 1) {
    throw new AppError(409, 'LAST_ADMIN', 'Impossible de retirer le dernier administrateur du groupe');
  }
  group.admins.pull(req.params.userId); // il reste membre
  await group.save();
  noContent(res);
};
