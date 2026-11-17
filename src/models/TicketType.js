const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const ticketTypeSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: true },
    name: { type: String, required: [true, 'Le nom du type de billet est obligatoire'], trim: true, maxlength: 100 },
    amount: { type: Number, required: [true, 'Le montant est obligatoire'], min: [0, 'Le montant doit être >= 0'] },
    quantity: {
      type: Number,
      required: [true, 'La quantité est obligatoire'],
      min: [1, 'La quantité doit être >= 1'],
      validate: { validator: Number.isInteger, message: 'La quantité doit être un entier' },
    },
    sold: { type: Number, default: 0, min: 0 }, // billets déjà vendus (modifié uniquement de façon atomique)
    createdBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

ticketTypeSchema.virtual('remaining').get(function () {
  return this.quantity - this.sold;
});

ticketTypeSchema.index({ event: 1 });

ticketTypeSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

module.exports = mongoose.model('TicketType', ticketTypeSchema);
