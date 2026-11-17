// Suppression en cascade des données rattachées (Mongo n'a pas de ON DELETE CASCADE).
// Les modèles sont récupérés par leur nom pour éviter les dépendances circulaires.
const mongoose = require('mongoose');

const model = (name) => mongoose.models[name];
const idsOf = async (name, filter) => (model(name) ? model(name).find(filter).distinct('_id') : []);
const del = async (name, filter) => {
  if (model(name)) await model(name).deleteMany(filter);
};

// Fils (+ messages + commentaires) qui correspondent au filtre
exports.deleteThreads = async (filter) => {
  const threadIds = await idsOf('Thread', filter);
  const messageIds = await idsOf('Message', { thread: { $in: threadIds } });
  await del('Comment', { message: { $in: messageIds } });
  await del('Message', { thread: { $in: threadIds } });
  await del('Thread', { _id: { $in: threadIds } });
};

exports.deleteGroup = async (groupId) => {
  await exports.deleteThreads({ group: groupId });
  // les événements du groupe survivent mais ne sont plus rattachés
  await model('Event').updateMany({ group: groupId }, { $unset: { group: 1 } });
  await model('Group').deleteOne({ _id: groupId });
};

exports.deleteEvent = async (eventId) => {
  await exports.deleteThreads({ event: eventId });

  const albumIds = await idsOf('Album', { event: eventId });
  const photoIds = await idsOf('Photo', { album: { $in: albumIds } });
  await del('Comment', { photo: { $in: photoIds } });
  await del('Photo', { album: { $in: albumIds } });
  await del('Album', { event: eventId });

  await del('Vote', { event: eventId });
  await del('Poll', { event: eventId });
  await del('Ticket', { event: eventId });
  await del('TicketType', { event: eventId });
  await del('ShoppingItem', { event: eventId });
  await del('CarpoolOffer', { event: eventId });

  await model('Event').deleteOne({ _id: eventId });
};
