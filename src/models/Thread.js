const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const threadSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Le titre du fil est obligatoire'], trim: true, maxlength: 150 },
    group: { type: ObjectId, ref: 'Group' },
    event: { type: ObjectId, ref: 'Event' },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

threadSchema.index({ group: 1 });
threadSchema.index({ event: 1 });

// Un fil est lié à 1 groupe OU 1 événement : jamais les deux, jamais aucun
threadSchema.pre('validate', function () {
  if (this.group && this.event) {
    this.invalidate('event', 'Un fil de discussion ne peut pas être lié à la fois à un groupe et à un événement');
  } else if (!this.group && !this.event) {
    this.invalidate('group', 'Un fil de discussion doit être lié à un groupe ou à un événement');
  }
});

threadSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Thread', threadSchema);
