// npm run seed : vide la base puis insère des données de démonstration
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const User = require('./models/User');
const Group = require('./models/Group');
const Event = require('./models/Event');
const Thread = require('./models/Thread');
const Message = require('./models/Message');
const Comment = require('./models/Comment');
const Album = require('./models/Album');
const Photo = require('./models/Photo');
const Poll = require('./models/Poll');
const Vote = require('./models/Vote');
const TicketType = require('./models/TicketType');
const Ticket = require('./models/Ticket');
const ShoppingItem = require('./models/ShoppingItem');
const CarpoolOffer = require('./models/CarpoolOffer');

const PASSWORD = 'Password123!';
const models = [User, Group, Event, Thread, Message, Comment, Album, Photo, Poll, Vote, TicketType, Ticket, ShoppingItem, CarpoolOffer];

// date relative à aujourd'hui : jours + heure
const day = (days, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const address = (street, zipCode, city) => ({ street, zipCode, city, country: 'France' });

async function main() {
  await connectDB();

  // 1. on vide la base (et on recrée les index uniques)
  for (const M of models) {
    await M.deleteMany({});
    await M.syncIndexes();
  }

  // 2. utilisateurs
  const people = [
    ['Alice', 'Martin', 'alice.martin@example.com', 'Paris'],
    ['Bruno', 'Durand', 'bruno.durand@example.com', 'Lyon'],
    ['Claire', 'Bernard', 'claire.bernard@example.com', 'Paris'],
    ['David', 'Moreau', 'david.moreau@example.com', 'Nice'],
    ['Emma', 'Petit', 'emma.petit@example.com', 'Paris'],
    ['Farid', 'Benali', 'farid.benali@example.com', 'Marseille'],
    ['Gwen', 'Leroy', 'gwen.leroy@example.com', 'Nantes'],
    ['Hugo', 'Simon', 'hugo.simon@example.com', 'Lille'],
  ];
  const users = [];
  for (const [i, [firstname, lastname, email, city]] of people.entries()) {
    users.push(
      await User.create({
        firstname,
        lastname,
        email,
        password: PASSWORD,
        avatar: `https://i.pravatar.cc/150?img=${i + 1}`,
        birthdate: new Date(1990 + i, i, 10 + i),
        address: address(`${10 + i} rue de la République`, '75001', city),
      })
    );
  }
  const [alice, bruno, claire, david, emma, farid, gwen, hugo] = users;
  const ids = (list) => list.map((u) => u._id);

  // 3. groupes (un de chaque type)
  const club = await Group.create({
    name: 'Club Photo Paris',
    description: 'Sorties et partages entre passionnés de photographie.',
    icon: 'https://picsum.photos/seed/clubicon/100',
    coverPhoto: 'https://picsum.photos/seed/clubcover/1200/400',
    type: 'public',
    allowMembersToPost: true,
    allowMembersToCreateEvents: true,
    admins: [alice._id],
    members: ids([alice, bruno, claire, emma, farid]),
    createdBy: alice._id,
  });
  const famille = await Group.create({
    name: 'Famille Martin',
    description: 'Le groupe privé de la famille.',
    type: 'private',
    allowMembersToPost: true,
    allowMembersToCreateEvents: false, // seuls les admins créent des événements
    admins: ids([alice, gwen]),
    members: ids([alice, gwen, bruno, david]),
    createdBy: alice._id,
  });
  const secret = await Group.create({
    name: 'Équipe Projet X',
    description: 'Groupe secret : invisible pour les non-membres.',
    type: 'secret',
    allowMembersToPost: false, // seuls les admins publient
    allowMembersToCreateEvents: false,
    admins: [alice._id],
    members: ids([alice, bruno]),
    createdBy: alice._id,
  });

  // 4. événements
  const sortie = await Event.create({
    name: 'Sortie photo à Montmartre',
    description: "Balade photo dans Montmartre au lever du soleil, puis petit-déjeuner partagé.",
    startDate: day(10, 7),
    endDate: day(10, 12),
    location: 'Place du Tertre, 75018 Paris',
    coverPhoto: 'https://picsum.photos/seed/montmartre/1200/400',
    visibility: 'public',
    organizers: ids([alice, claire]),
    participants: ids([bruno, emma, farid]), // = tous les membres du club (invitation en un clic)
    group: club._id,
    shoppingListEnabled: true,
    carpoolEnabled: true,
    createdBy: alice._id,
  });
  const jazz = await Event.create({
    name: 'Festival Jazz de Nice',
    description: 'Trois soirées de concerts en plein air.',
    startDate: day(40, 20),
    endDate: day(42, 23),
    location: 'Jardin Albert 1er, 06000 Nice',
    coverPhoto: 'https://picsum.photos/seed/jazz/1200/400',
    visibility: 'public',
    organizers: ids([david]),
    participants: [],
    ticketingEnabled: true,
    createdBy: david._id,
  });
  const anniversaire = await Event.create({
    name: 'Anniversaire de Mamie',
    description: 'Déjeuner surprise pour les 80 ans de Mamie.',
    startDate: day(20, 12),
    endDate: day(20, 18),
    location: '12 rue des Lilas, 69003 Lyon',
    visibility: 'private',
    organizers: ids([alice, gwen]),
    participants: ids([bruno, david]),
    group: famille._id,
    shoppingListEnabled: true,
    carpoolEnabled: true,
    createdBy: alice._id,
  });
  const reunion = await Event.create({
    name: 'Réunion de lancement Projet X',
    description: 'Kick-off confidentiel.',
    startDate: day(3, 9),
    endDate: day(3, 11),
    location: 'Salle B12, Paris',
    visibility: 'private',
    organizers: [alice._id],
    participants: [bruno._id],
    group: secret._id,
    createdBy: alice._id,
  });

  // 5. fils de discussion, messages, commentaires
  const threadClub = await Thread.create({ title: 'Discussion générale', group: club._id, createdBy: alice._id });
  const threadSortie = await Thread.create({ title: 'Organisation de la sortie', event: sortie._id, createdBy: claire._id });
  const threadFamille = await Thread.create({ title: 'Idées cadeaux pour Mamie', group: famille._id, createdBy: gwen._id });

  const m1 = await Message.create({ thread: threadClub._id, author: alice._id, content: 'Bienvenue à tous dans le Club Photo Paris !' });
  const m2 = await Message.create({ thread: threadClub._id, author: bruno._id, content: 'Quelqu’un a testé le nouveau 50mm ?' });
  const m3 = await Message.create({ thread: threadSortie._id, author: claire._id, content: 'Rendez-vous à 7h devant le Sacré-Cœur, pensez aux trépieds.' });
  const m4 = await Message.create({ thread: threadFamille._id, author: gwen._id, content: 'Je pense à un album photo de toute la famille.' });
  await Comment.create({ message: m1._id, author: emma._id, content: 'Merci Alice, ravie d’être là !' });
  await Comment.create({ message: m2._id, author: farid._id, content: 'Oui, il est excellent en basse lumière.' });
  await Comment.create({ message: m3._id, author: bruno._id, content: 'Parfait, je prends le mien.' });
  await Comment.create({ message: m4._id, author: david._id, content: 'Super idée !' });

  // 6. album photo + photos + commentaires
  const album = await Album.create({ event: sortie._id, title: 'Repérages Montmartre', description: 'Photos des repérages', createdBy: claire._id });
  const photos = [];
  for (const [i, who] of [alice, claire, bruno].entries()) {
    photos.push(
      await Photo.create({
        album: album._id,
        url: `https://picsum.photos/seed/montmartre${i}/800/600`,
        caption: `Vue n°${i + 1}`,
        postedBy: who._id,
      })
    );
  }
  await Comment.create({ photo: photos[0]._id, author: emma._id, content: 'Magnifique cadrage !' });
  await Comment.create({ photo: photos[0]._id, author: farid._id, content: 'La lumière est top.' });

  // 7. sondage + votes
  const poll = await Poll.create({
    event: sortie._id,
    title: 'Préférences pour la sortie',
    questions: [
      { label: 'Quel petit-déjeuner ?', answers: [{ label: 'Croissants' }, { label: 'Pain au chocolat' }, { label: 'Fruits' }] },
      { label: 'Quel appareil emporter ?', answers: [{ label: 'Reflex' }, { label: 'Hybride' }] },
    ],
    createdBy: alice._id,
  });
  const [q1, q2] = poll.questions;
  const vote = (u, q, a) => Vote.create({ poll: poll._id, event: sortie._id, question: q._id, answer: a._id, user: u._id });
  await vote(bruno, q1, q1.answers[0]);
  await vote(emma, q1, q1.answers[0]);
  await vote(farid, q1, q1.answers[2]);
  await vote(bruno, q2, q2.answers[1]);
  await vote(emma, q2, q2.answers[0]);

  // 8. billetterie (un type épuisé pour tester le 409)
  const standard = await TicketType.create({ event: jazz._id, name: 'Standard', amount: 25, quantity: 100, sold: 2, createdBy: david._id });
  const vip = await TicketType.create({ event: jazz._id, name: 'VIP', amount: 80, quantity: 10, createdBy: david._id });
  const earlyBird = await TicketType.create({ event: jazz._id, name: 'Early bird', amount: 15, quantity: 2, sold: 2, createdBy: david._id });
  const buyers = [
    ['Léa', 'Garnier', 'lea.garnier@example.com', standard],
    ['Paul', 'Rivière', 'paul.riviere@example.com', standard],
  ];
  for (const [firstname, lastname, email, type] of buyers) {
    await Ticket.create({
      event: jazz._id,
      ticketType: type._id,
      buyer: { firstname, lastname, email, address: address('5 avenue Jean Médecin', '06000', 'Nice') },
    });
  }
  // les 2 "early bird" vendus
  for (const [firstname, lastname, email] of [['Marc', 'Blanc', 'marc.blanc@example.com'], ['Sonia', 'Noir', 'sonia.noir@example.com']]) {
    await Ticket.create({
      event: jazz._id,
      ticketType: earlyBird._id,
      buyer: { firstname, lastname, email, address: address('8 rue Masséna', '06000', 'Nice') },
    });
  }

  // 9. shopping list
  await ShoppingItem.create({ event: sortie._id, name: 'Croissants', quantity: 20, arrivalTime: day(10, 6), user: bruno._id });
  await ShoppingItem.create({ event: sortie._id, name: 'Thermos de café', quantity: 3, arrivalTime: day(10, 7), user: emma._id });
  await ShoppingItem.create({ event: sortie._id, name: 'Jus d’orange', quantity: 4, arrivalTime: day(10, 7), user: farid._id });
  await ShoppingItem.create({ event: anniversaire._id, name: 'Gâteau d’anniversaire', quantity: 1, arrivalTime: day(20, 11), user: gwen._id });

  // 10. covoiturage
  await CarpoolOffer.create({
    event: sortie._id,
    driver: farid._id,
    departurePlace: 'Gare de Lyon, Paris',
    departureTime: day(10, 6),
    price: 4,
    availableSeats: 2, // 3 places au départ, 1 déjà réservée
    maxDetourMinutes: 15,
    passengers: [emma._id],
  });
  await CarpoolOffer.create({
    event: anniversaire._id,
    driver: bruno._id,
    departurePlace: 'Gare Part-Dieu, Lyon',
    departureTime: day(20, 10),
    price: 0,
    availableSeats: 3,
    maxDetourMinutes: 30,
  });

  // ---------- Récapitulatif ----------
  console.log('\n=== Données de démo insérées ===');
  console.log(`Mot de passe de TOUS les comptes : ${PASSWORD}\n`);
  console.log('Comptes de test :');
  users.forEach((u) => console.log(`  ${u.email.padEnd(28)} ${u.firstname} ${u.lastname}  (id ${u._id})`));
  console.log('\nRôles utiles :');
  console.log('  alice.martin   : admin des 3 groupes, organisatrice (sortie, anniversaire, réunion)');
  console.log('  claire.bernard : organisatrice de la sortie photo');
  console.log('  david.moreau   : organisateur du Festival Jazz (billetterie)');
  console.log('  hugo.simon     : aucun groupe ni événement (utilisateur "extérieur")');
  console.log('\nGroupes :');
  [club, famille, secret].forEach((g) => console.log(`  [${g.type.padEnd(7)}] ${g.name}  (id ${g._id})`));
  console.log('\nÉvénements :');
  [sortie, jazz, anniversaire, reunion].forEach((e) => console.log(`  [${e.visibility.padEnd(7)}] ${e.name}  (id ${e._id})`));
  console.log(`\nFil groupe : ${threadClub._id} | Fil événement : ${threadSortie._id}`);
  console.log(`Album : ${album._id} | Photo : ${photos[0]._id} | Sondage : ${poll._id}`);
  console.log(`Types de billets (Festival Jazz) : Standard ${standard._id} | VIP ${vip._id} | Early bird (épuisé) ${earlyBird._id}`);
  console.log('');

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed en échec :', err);
  await mongoose.disconnect();
  process.exit(1);
});
