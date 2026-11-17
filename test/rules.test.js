// Vérifie les règles métier de l'API : npm test (MongoDB doit tourner)
// Utilise une base dédiée, supprimée à la fin : la base de démo n'est pas touchée.
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/mysocialnetworks_test';

const mongoose = require('mongoose');
const app = require('../src/app');
const Thread = require('../src/models/Thread');
const Vote = require('../src/models/Vote');
const TicketType = require('../src/models/TicketType');
const User = require('../src/models/User');

let base;
let passed = 0;
const failures = [];

async function api(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// compare le statut HTTP (et éventuellement le code d'erreur)
function expect(label, res, status, code) {
  const ok = res.status === status && (!code || (res.body && res.body.error && res.body.error.code === code));
  if (ok) passed++;
  else failures.push(label);
  const got = `${res.status}${res.body && res.body.error ? ' ' + res.body.error.code : ''}`;
  console.log(`${ok ? 'OK ' : 'KO '} ${label.padEnd(66)} attendu ${status}${code ? ' ' + code : ''} -> ${got}`);
}

function check(label, cond, detail = '') {
  if (cond) passed++;
  else failures.push(label);
  console.log(`${cond ? 'OK ' : 'KO '} ${label.padEnd(66)} ${detail}`);
}

async function newUser(name) {
  const r = await api('POST', '/auth/register', { firstname: name, lastname: 'Test', email: `${name}@test.fr`, password: 'password123' });
  return { id: r.body.data.user._id, token: r.body.data.token, res: r };
}

const dates = { startDate: '2027-06-01T18:00:00Z', endDate: '2027-06-01T23:00:00Z' };
const buyer = (email) => ({ firstname: 'A', lastname: 'B', email, address: { street: '1 rue X', zipCode: '75001', city: 'Paris', country: 'France' } });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  const server = app.listen(0);
  base = `http://localhost:${server.address().port}/api/v1`;

  console.log('\n--- Utilisateurs ---');
  const alice = await newUser('alice');
  const bob = await newUser('bob');
  const carol = await newUser('carol');
  expect('register OK', alice.res, 201);
  check('le mot de passe n\'est jamais renvoyé', !JSON.stringify(alice.res.body).includes('password'));
  check('le mot de passe est hashé en base', (await User.findOne({ email: 'alice@test.fr' }).select('+password')).password.startsWith('$2'));
  expect('email dupliqué', await api('POST', '/auth/register', { firstname: 'X', lastname: 'Y', email: 'alice@test.fr', password: 'password123' }), 409, 'EMAIL_ALREADY_USED');
  expect('email dupliqué (casse différente)', await api('POST', '/auth/register', { firstname: 'X', lastname: 'Y', email: 'ALICE@test.fr', password: 'password123' }), 409);
  const idx = await User.collection.indexes();
  check('index unique sur users.email', idx.some((i) => i.key.email === 1 && i.unique));
  expect('login mauvais mot de passe', await api('POST', '/auth/login', { email: 'alice@test.fr', password: 'nope' }), 401);
  expect('route protégée sans token', await api('GET', '/users/me'), 401);
  expect('identifiant mal formé', await api('GET', '/users/abc', null, alice.token), 400, 'INVALID_ID');
  expect('modifier le compte d\'un autre', await api('PATCH', `/users/${bob.id}`, { firstname: 'Z' }, alice.token), 403);

  console.log('\n--- Groupes ---');
  const pub = (await api('POST', '/groups', { name: 'Public', type: 'public', members: [bob.id], allowMembersToCreateEvents: false }, alice.token)).body.data;
  const secret = (await api('POST', '/groups', { name: 'Secret', type: 'secret' }, alice.token)).body.data;
  check('le créateur est admin ET membre', pub.admins.length === 1 && pub.members.length === 2 && pub.admins[0]._id === alice.id);
  const list = (await api('GET', '/groups?limit=100', null, carol.token)).body.data;
  check('groupe secret absent de la recherche d\'un non-membre', !list.some((g) => g._id === secret._id));
  expect('groupe secret : accès direct d\'un non-membre', await api('GET', `/groups/${secret._id}`, null, carol.token), 404);
  expect('retirer le dernier admin (admins)', await api('DELETE', `/groups/${pub._id}/admins/${alice.id}`, null, alice.token), 409, 'LAST_ADMIN');
  expect('retirer le dernier admin (members)', await api('DELETE', `/groups/${pub._id}/members/${alice.id}`, null, alice.token), 409, 'LAST_ADMIN');
  expect('quitter le groupe en étant le dernier admin', await api('POST', `/groups/${pub._id}/leave`, null, alice.token), 409, 'LAST_ADMIN');
  expect('rejoindre un groupe public', await api('POST', `/groups/${pub._id}/join`, null, carol.token), 200);
  expect('ajouter un second admin', await api('POST', `/groups/${pub._id}/admins`, { userId: bob.id }, alice.token), 201);
  expect('retirer un admin quand il en reste un autre', await api('DELETE', `/groups/${pub._id}/admins/${alice.id}`, null, bob.token), 204);
  await api('POST', `/groups/${pub._id}/admins`, { userId: alice.id }, bob.token); // Alice redevient admin

  console.log('\n--- Événements ---');
  const ev = { name: 'Fête', location: 'Paris', ...dates };
  expect('endDate < startDate', await api('POST', '/events', { ...ev, endDate: '2027-06-01T10:00:00Z' }, alice.token), 422);
  expect('endDate = startDate', await api('POST', '/events', { ...ev, endDate: ev.startDate }, alice.token), 422);
  expect('billetterie sur un événement privé', await api('POST', '/events', { ...ev, visibility: 'private', ticketingEnabled: true }, alice.token), 422);
  expect('création dans un groupe sans être membre', await api('POST', '/events', { ...ev, group: secret._id }, bob.token), 404);
  // le groupe public n'autorise pas les membres à créer des événements ; Carol (simple membre) est refusée
  await api('PATCH', `/groups/${pub._id}`, { allowMembersToCreateEvents: false }, alice.token);
  expect('membre simple, groupe sans allowMembersToCreateEvents', await api('POST', '/events', { ...ev, group: pub._id }, carol.token), 403, 'GROUP_EVENTS_NOT_ALLOWED');
  const grpEvent = await api('POST', '/events', { ...ev, group: pub._id, inviteGroupMembers: true }, alice.token);
  expect('admin crée un événement de groupe', grpEvent, 201);
  check('invitation de tous les membres du groupe', grpEvent.body.data.participants.length === 2 && grpEvent.body.data.organizers.length === 1);
  const main = (await api('POST', '/events', { ...ev, name: 'Principal', ticketingEnabled: true, shoppingListEnabled: true, carpoolEnabled: true, participants: [bob.id] }, alice.token)).body.data;
  const priv = (await api('POST', '/events', { ...ev, name: 'Privé', visibility: 'private', participants: [bob.id] }, alice.token)).body.data;
  expect('événement privé : accès d\'un extérieur', await api('GET', `/events/${priv._id}`, null, carol.token), 403, 'EVENT_PRIVATE');
  expect('événement privé : accès d\'un participant', await api('GET', `/events/${priv._id}`, null, bob.token), 200);
  const evList = (await api('GET', '/events?limit=100', null, carol.token)).body.data;
  check('événement privé absent de la recherche d\'un extérieur', !evList.some((e) => e._id === priv._id));
  expect('modifier endDate avant startDate (PATCH)', await api('PATCH', `/events/${main._id}`, { endDate: '2020-01-01T00:00:00Z' }, alice.token), 422);
  expect('retirer le dernier organisateur', await api('DELETE', `/events/${main._id}/organizers/${alice.id}`, null, alice.token), 409, 'LAST_ORGANIZER');
  expect('ajouter un organisateur', await api('POST', `/events/${main._id}/organizers`, { userId: carol.id }, alice.token), 201);
  expect('retirer un organisateur quand il en reste un autre', await api('DELETE', `/events/${main._id}/organizers/${carol.id}`, null, alice.token), 204);
  const share = await api('GET', `/events/${main._id}/share`, null, alice.token);
  check('liens de partage (Facebook, X, LinkedIn, WhatsApp)', share.status === 200 && ['facebook', 'x', 'linkedin', 'whatsapp'].every((k) => share.body.data[k]));
  expect('partage d\'un événement privé', await api('GET', `/events/${priv._id}/share`, null, alice.token), 403);
  const page = await api('GET', '/events?limit=1&page=2&sort=name', null, alice.token);
  check('pagination (page, limit, meta)', page.body.data.length === 1 && page.body.meta.page === 2 && page.body.meta.total >= 3);
  expect('tri non autorisé', await api('GET', '/events?sort=password', null, alice.token), 400);

  console.log('\n--- Fils de discussion ---');
  expect('fil lié à un groupe ET un événement (API)', await api('POST', '/threads', { title: 'x', group: pub._id, event: main._id }, alice.token), 422);
  expect('fil lié à rien (API)', await api('POST', '/threads', { title: 'x' }, alice.token), 422);
  let schemaError = null;
  try { await Thread.create({ title: 'x', group: pub._id, event: main._id, createdBy: alice.id }); } catch (e) { schemaError = e; }
  check('fil groupe ET événement refusé par le schéma Mongoose', schemaError && schemaError.name === 'ValidationError');
  schemaError = null;
  try { await Thread.create({ title: 'x', createdBy: alice.id }); } catch (e) { schemaError = e; }
  check('fil sans groupe ni événement refusé par le schéma Mongoose', schemaError && schemaError.name === 'ValidationError');
  const quiet = (await api('POST', '/groups', { name: 'Silence', members: [bob.id], allowMembersToPost: false }, alice.token)).body.data;
  const thread = (await api('POST', '/threads', { title: 'Silence', group: quiet._id }, alice.token)).body.data;
  const message = await api('POST', `/threads/${thread._id}/messages`, { content: 'Bonjour' }, alice.token);
  expect('admin publie dans un groupe allowMembersToPost=false', message, 201);
  expect('membre publie (allowMembersToPost=false)', await api('POST', `/threads/${thread._id}/messages`, { content: 'Hello' }, bob.token), 403, 'POSTING_NOT_ALLOWED');
  expect('membre commente un message (autorisé)', await api('POST', `/messages/${message.body.data._id}/comments`, { content: 'Merci' }, bob.token), 201);
  expect('extérieur commente un message', await api('POST', `/messages/${message.body.data._id}/comments`, { content: 'Hey' }, carol.token), 403);
  const eventThread = await api('POST', '/threads', { title: 'Orga', event: main._id }, bob.token);
  expect('participant crée un fil d\'événement', eventThread, 201);
  expect('extérieur lit un fil d\'événement', await api('GET', `/threads/${eventThread.body.data._id}`, null, carol.token), 403);

  console.log('\n--- Albums et photos ---');
  const album = (await api('POST', '/albums', { event: main._id, title: 'Photos' }, bob.token)).body.data;
  expect('photo postée par un participant', await api('POST', `/albums/${album._id}/photos`, { url: 'https://img.fr/1.jpg' }, bob.token), 201);
  expect('photo postée par un non-participant', await api('POST', `/albums/${album._id}/photos`, { url: 'https://img.fr/2.jpg' }, carol.token), 403, 'NOT_PARTICIPANT');

  console.log('\n--- Sondages ---');
  const pollBody = { event: main._id, title: 'Menu', questions: [{ label: 'Plat ?', answers: ['Pizza', 'Pâtes'] }] };
  expect('sondage créé par un non-organisateur', await api('POST', '/polls', pollBody, bob.token), 403, 'NOT_ORGANIZER');
  expect('sondage sans question', await api('POST', '/polls', { ...pollBody, questions: [] }, alice.token), 422);
  expect('question avec une seule réponse', await api('POST', '/polls', { ...pollBody, questions: [{ label: 'q', answers: ['seule'] }] }, alice.token), 422);
  const poll = (await api('POST', '/polls', pollBody, alice.token)).body.data;
  const q = poll.questions[0];
  expect('vote par un non-participant', await api('POST', `/polls/${poll._id}/vote`, { questionId: q._id, answerId: q.answers[0]._id }, carol.token), 403);
  expect('premier vote', await api('POST', `/polls/${poll._id}/vote`, { questionId: q._id, answerId: q.answers[0]._id }, bob.token), 201);
  expect('double vote : la réponse est remplacée', await api('POST', `/polls/${poll._id}/vote`, { questionId: q._id, answerId: q.answers[1]._id }, bob.token), 200);
  await Promise.all([1, 2, 3, 4, 5].map(() => api('POST', `/polls/${poll._id}/vote`, { questionId: q._id, answerId: q.answers[0]._id }, alice.token)));
  check('5 votes simultanés du même utilisateur = 1 seul vote en base', (await Vote.countDocuments({ poll: poll._id, user: alice.id })) === 1);
  const results = (await api('GET', `/polls/${poll._id}/results`, null, bob.token)).body.data.questions[0];
  check('résultats : décompte par réponse', results.totalVotes === 2 && results.answers[0].votes === 1 && results.answers[1].votes === 1);

  console.log('\n--- Billetterie ---');
  expect('billetterie désactivée', await api('POST', `/events/${grpEvent.body.data._id}/ticket-types`, { name: 'Std', amount: 10, quantity: 5 }, alice.token), 403, 'FEATURE_DISABLED');
  expect('type de billet par un non-organisateur', await api('POST', `/events/${main._id}/ticket-types`, { name: 'Std', amount: 10, quantity: 5 }, bob.token), 403);
  expect('montant négatif', await api('POST', `/events/${main._id}/ticket-types`, { name: 'Std', amount: -1, quantity: 5 }, alice.token), 422);
  const standard = (await api('POST', `/events/${main._id}/ticket-types`, { name: 'Standard', amount: 20, quantity: 3 }, alice.token)).body.data;
  const vip = (await api('POST', `/events/${main._id}/ticket-types`, { name: 'VIP', amount: 90, quantity: 10 }, alice.token)).body.data;
  expect('achat sans compte', await api('POST', `/events/${main._id}/tickets`, { ticketType: vip._id, buyer: buyer('marie@ext.fr') }), 201);
  expect('2e billet, même email', await api('POST', `/events/${main._id}/tickets`, { ticketType: vip._id, buyer: buyer('marie@ext.fr') }), 409, 'TICKET_ALREADY_BOUGHT');
  expect('2e billet, même email (autre type, autre casse)', await api('POST', `/events/${main._id}/tickets`, { ticketType: standard._id, buyer: buyer('MARIE@ext.fr') }), 409, 'TICKET_ALREADY_BOUGHT');
  expect('adresse incomplète', await api('POST', `/events/${main._id}/tickets`, { ticketType: vip._id, buyer: { firstname: 'a', lastname: 'b', email: 'z@z.fr' } }), 422);
  const same = await Promise.all([1, 2, 3, 4, 5].map(() => api('POST', `/events/${main._id}/tickets`, { ticketType: vip._id, buyer: buyer('course@ext.fr') })));
  check('5 achats simultanés avec le même email : 1 seul billet', same.filter((r) => r.status === 201).length === 1, same.map((r) => r.status).join(','));
  check('stock VIP cohérent après la course d\'unicité', (await TicketType.findById(vip._id)).sold === 2);
  const rush = await Promise.all(Array.from({ length: 10 }, (_, i) => api('POST', `/events/${main._id}/tickets`, { ticketType: standard._id, buyer: buyer(`rush${i}@ext.fr`) })));
  const sold = rush.filter((r) => r.status === 201).length;
  const soldOut = rush.filter((r) => r.status === 409 && r.body.error.code === 'SOLD_OUT').length;
  check('stock de 3, 10 achats simultanés : 3 vendus, 7 refusés (SOLD_OUT)', sold === 3 && soldOut === 7, `vendus=${sold} refusés=${soldOut}`);
  check('stock jamais négatif', (await TicketType.findById(standard._id)).sold === 3);
  expect('achat sur un type épuisé', await api('POST', `/events/${main._id}/tickets`, { ticketType: standard._id, buyer: buyer('late@ext.fr') }), 409, 'SOLD_OUT');
  const remaining = (await api('GET', `/events/${main._id}/tickets/remaining`)).body.data;
  check('billets restants par type', remaining.find((t) => t.name === 'Standard').remaining === 0 && remaining.find((t) => t.name === 'VIP').remaining === 8);
  expect('billets vendus visibles par un non-organisateur', await api('GET', `/events/${main._id}/tickets`, null, bob.token), 403);

  console.log('\n--- Shopping list ---');
  const item = { name: 'Chips', quantity: 2, arrivalTime: '2027-06-01T17:00:00Z' };
  expect('shopping list désactivée', await api('POST', `/events/${grpEvent.body.data._id}/shopping-items`, item, alice.token), 403, 'FEATURE_DISABLED');
  expect('ajout d\'un élément', await api('POST', `/events/${main._id}/shopping-items`, item, bob.token), 201);
  expect('élément dupliqué', await api('POST', `/events/${main._id}/shopping-items`, item, alice.token), 409, 'ITEM_ALREADY_EXISTS');
  expect('élément dupliqué (casse et espaces)', await api('POST', `/events/${main._id}/shopping-items`, { ...item, name: '  CHIPS ' }, alice.token), 409);
  const dups = await Promise.all([1, 2, 3, 4].map(() => api('POST', `/events/${main._id}/shopping-items`, { ...item, name: 'Gâteau' }, bob.token)));
  check('4 ajouts simultanés du même élément : 1 seul créé', dups.filter((r) => r.status === 201).length === 1);

  console.log('\n--- Covoiturage ---');
  const offer = { departurePlace: 'Gare', departureTime: '2027-06-01T16:00:00Z', price: 5, availableSeats: 1, maxDetourMinutes: 20 };
  expect('covoiturage désactivé', await api('POST', `/events/${grpEvent.body.data._id}/carpools`, offer, alice.token), 403, 'FEATURE_DISABLED');
  const car = (await api('POST', `/events/${main._id}/carpools`, offer, bob.token)).body.data;
  expect('le conducteur réserve sa voiture', await api('POST', `/carpools/${car._id}/book`, null, bob.token), 400);
  const seats = await Promise.all([alice, alice].map((u) => api('POST', `/carpools/${car._id}/book`, null, u.token)));
  check('2 réservations simultanées pour 1 place : 1 seule réussit', seats.filter((r) => r.status === 201).length === 1, seats.map((r) => r.status).join(','));
  expect('covoiturage complet', await api('POST', `/carpools/${car._id}/book`, null, (await newUserAndJoin(main._id, alice.token)).token), 409, 'NO_SEATS_LEFT');

  console.log('\n--- Suppressions ---');
  expect('supprimer son compte en étant dernier admin/organisateur', await api('DELETE', `/users/${alice.id}`, null, alice.token), 409);
  expect('supprimer un événement (cascade)', await api('DELETE', `/events/${main._id}`, null, alice.token), 204);
  check('billets supprimés avec l\'événement', (await TicketType.countDocuments({ event: main._id })) === 0);

  await server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  console.log(`\n${passed} vérifications réussies, ${failures.length} échec(s)`);
  if (failures.length) {
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
  }
}

// crée un utilisateur et l'ajoute comme participant d'un événement
async function newUserAndJoin(eventId, organizerToken) {
  const u = await newUser('late' + Date.now());
  await api('POST', `/events/${eventId}/participants`, { userId: u.id }, organizerToken);
  return u;
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.connection.dropDatabase().catch(() => {});
  process.exit(1);
});
