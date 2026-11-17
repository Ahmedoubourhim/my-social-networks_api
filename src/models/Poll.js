const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const answerSchema = new mongoose.Schema({
  label: { type: String, required: [true, 'Le libellé de la réponse est obligatoire'], trim: true, maxlength: 200 },
});

const questionSchema = new mongoose.Schema({
  label: { type: String, required: [true, 'Le libellé de la question est obligatoire'], trim: true, maxlength: 300 },
  answers: {
    type: [answerSchema],
    validate: [(v) => v.length >= 2, 'Une question doit proposer au moins 2 réponses possibles'],
  },
});

const pollSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: [true, "L'événement est obligatoire"] },
    title: { type: String, required: [true, 'Le titre du sondage est obligatoire'], trim: true, maxlength: 200 },
    questions: {
      type: [questionSchema],
      validate: [(v) => v.length >= 1, 'Un sondage doit comporter au moins une question'],
    },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

pollSchema.index({ event: 1 });

pollSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Poll', pollSchema);
