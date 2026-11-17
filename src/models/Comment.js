const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Un commentaire porte soit sur un message de fil, soit sur une photo d'album (jamais les deux)
const commentSchema = new mongoose.Schema(
  {
    message: { type: ObjectId, ref: 'Message' },
    photo: { type: ObjectId, ref: 'Photo' },
    author: { type: ObjectId, ref: 'User', required: true },
    content: { type: String, required: [true, 'Le contenu du commentaire est obligatoire'], trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

commentSchema.index({ message: 1, createdAt: 1 });
commentSchema.index({ photo: 1, createdAt: 1 });

commentSchema.pre('validate', function () {
  if (!!this.message === !!this.photo) {
    this.invalidate('message', 'Un commentaire porte sur un message ou sur une photo (un seul des deux)');
  }
});

commentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Comment', commentSchema);
