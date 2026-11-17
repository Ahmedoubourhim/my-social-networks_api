const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const voteSchema = new mongoose.Schema(
  {
    poll: { type: ObjectId, ref: 'Poll', required: true },
    event: { type: ObjectId, ref: 'Event', required: true },
    question: { type: ObjectId, required: true }, // _id de la question dans poll.questions
    answer: { type: ObjectId, required: true }, // _id de la réponse choisie
    user: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Un participant ne peut voter qu'une seule fois par question
voteSchema.index({ poll: 1, question: 1, user: 1 }, { unique: true });

voteSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Vote', voteSchema);
