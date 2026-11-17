const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const carpoolOfferSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: true },
    driver: { type: ObjectId, ref: 'User', required: true },
    departurePlace: { type: String, required: [true, 'Le lieu de départ est obligatoire'], trim: true },
    departureTime: { type: Date, required: [true, "L'heure de départ est obligatoire"] },
    price: { type: Number, required: [true, 'Le prix est obligatoire'], min: [0, 'Le prix doit être >= 0'] },
    availableSeats: {
      type: Number,
      required: [true, 'Le nombre de places est obligatoire'],
      min: [0, 'Le nombre de places doit être >= 0'],
      validate: { validator: Number.isInteger, message: 'Le nombre de places doit être un entier' },
    },
    maxDetourMinutes: { type: Number, required: [true, "Le temps d'écart maximum est obligatoire"], min: [0, "L'écart doit être >= 0"] },
    passengers: [{ type: ObjectId, ref: 'User' }], // réservations (bonus)
  },
  { timestamps: true }
);

carpoolOfferSchema.index({ event: 1, departureTime: 1 });

carpoolOfferSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('CarpoolOffer', carpoolOfferSchema);
