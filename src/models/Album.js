const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const albumSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: [true, "L'événement est obligatoire"] },
    title: { type: String, required: [true, "Le titre de l'album est obligatoire"], trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

albumSchema.index({ event: 1 });

albumSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Album', albumSchema);
