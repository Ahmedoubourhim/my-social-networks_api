const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const Event = require('../models/Event');
const AppError = require('../utils/AppError');
const { ok, created, noContent } = require('../utils/response');
const { paginate, escapeRegex } = require('../utils/pagination');
const { same } = require('../utils/ids');
const access = require('../services/access');

async function getPoll(id) {
  const poll = await Poll.findById(id);
  if (!poll) throw new AppError(404, 'POLL_NOT_FOUND', 'Sondage introuvable');
  return poll;
}

// ["Oui", "Non"] => [{ label: "Oui" }, { label: "Non" }]
const toQuestions = (questions) =>
  questions.map((q) => ({ label: q.label, answers: q.answers.map((label) => ({ label })) }));

// POST /polls : uniquement par un organisateur de l'événement
exports.create = async (req, res) => {
  const event = await access.getEvent(req.body.event);
  access.requireOrganizer(event, req.user);

  const poll = await Poll.create({
    event: event._id,
    title: req.body.title,
    questions: toQuestions(req.body.questions),
    createdBy: req.user._id,
  });
  created(res, poll);
};

// GET /polls?event=&q=
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

  const { items, meta } = await paginate(Poll, filter, req.query, { sortable: ['title', 'createdAt'] });
  ok(res, items, meta);
};

exports.get = async (req, res) => {
  const poll = await getPoll(req.params.id);
  await access.getVisibleEvent(poll.event, req.user);
  ok(res, poll);
};

exports.update = async (req, res) => {
  const poll = await getPoll(req.params.id);
  access.requireOrganizer(await access.getEvent(poll.event), req.user);

  if (req.body.title) poll.title = req.body.title;
  if (req.body.questions) {
    if (await Vote.exists({ poll: poll._id })) {
      throw new AppError(409, 'POLL_HAS_VOTES', 'Les questions ne sont plus modifiables : des votes ont déjà été enregistrés');
    }
    poll.questions = toQuestions(req.body.questions);
  }
  await poll.save();
  ok(res, poll);
};

exports.remove = async (req, res) => {
  const poll = await getPoll(req.params.id);
  access.requireOrganizer(await access.getEvent(poll.event), req.user);
  await Vote.deleteMany({ poll: poll._id });
  await poll.deleteOne();
  noContent(res);
};

// POST /polls/:id/vote : une seule réponse par question.
// Choix : re-voter REMPLACE la réponse précédente (200 au lieu de 201).
exports.vote = async (req, res) => {
  const poll = await getPoll(req.params.id);
  const event = await access.getEvent(poll.event);
  access.requireEventMember(event, req.user);

  const { questionId, answerId } = req.body;
  const question = poll.questions.id(questionId);
  if (!question) throw new AppError(404, 'QUESTION_NOT_FOUND', "Cette question n'appartient pas au sondage");
  if (!question.answers.id(answerId)) {
    throw new AppError(400, 'INVALID_ANSWER', "Cette réponse n'appartient pas à la question");
  }

  const filter = { poll: poll._id, question: questionId, user: req.user._id };
  const previous = await Vote.findOneAndUpdate(
    filter,
    { $set: { answer: answerId }, $setOnInsert: { event: poll.event } },
    { upsert: true, returnDocument: 'before' }
  );
  const vote = await Vote.findOne(filter);
  if (previous) return ok(res, vote); // vote remplacé
  created(res, vote);
};

// DELETE /polls/:id/votes/:questionId : retirer son vote
exports.removeVote = async (req, res) => {
  const poll = await getPoll(req.params.id);
  access.requireEventMember(await access.getEvent(poll.event), req.user);
  const deleted = await Vote.findOneAndDelete({ poll: poll._id, question: req.params.questionId, user: req.user._id });
  if (!deleted) throw new AppError(404, 'VOTE_NOT_FOUND', "Vous n'avez pas voté pour cette question");
  noContent(res);
};

// GET /polls/:id/results : décompte des votes par réponse
exports.results = async (req, res) => {
  const poll = await getPoll(req.params.id);
  await access.getVisibleEvent(poll.event, req.user);

  const counts = await Vote.aggregate([
    { $match: { poll: poll._id } },
    { $group: { _id: { question: '$question', answer: '$answer' }, votes: { $sum: 1 } } },
  ]);
  const countOf = (q, a) => {
    const found = counts.find((c) => same(c._id.question, q._id) && same(c._id.answer, a._id));
    return found ? found.votes : 0;
  };

  const questions = poll.questions.map((q) => {
    const answers = q.answers.map((a) => ({ answerId: a._id, label: a.label, votes: countOf(q, a) }));
    return { questionId: q._id, label: q.label, totalVotes: answers.reduce((s, a) => s + a.votes, 0), answers };
  });
  ok(res, { pollId: poll._id, title: poll.title, questions });
};
