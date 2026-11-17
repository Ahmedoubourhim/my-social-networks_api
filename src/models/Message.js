const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const messageSchema = new mongoose.Schema(
  {
    thread: { type: ObjectId, ref: 'Thread', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    content: { type: String, required: [true, 'Le contenu du message est obligatoire'], trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

messageSchema.index({ thread: 1, createdAt: -1 });

messageSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Message', messageSchema);
