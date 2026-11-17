const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const photoSchema = new mongoose.Schema(
  {
    album: { type: ObjectId, ref: 'Album', required: true },
    url: { type: String, required: [true, "L'URL de la photo est obligatoire"], trim: true },
    caption: { type: String, trim: true, maxlength: 500 },
    postedBy: { type: ObjectId, ref: 'User', required: true }, // un participant de l'événement
  },
  { timestamps: true }
);

photoSchema.index({ album: 1, createdAt: -1 });

photoSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Photo', photoSchema);
