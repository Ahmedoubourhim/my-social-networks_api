const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const shoppingItemSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: true },
    name: { type: String, required: [true, "Le nom de l'élément est obligatoire"], trim: true, maxlength: 100 },
    nameNormalized: { type: String }, // name en minuscules, sans espaces superflus : sert à l'unicité
    quantity: {
      type: Number,
      required: [true, 'La quantité est obligatoire'],
      min: [1, 'La quantité doit être >= 1'],
      validate: { validator: Number.isInteger, message: 'La quantité doit être un entier' },
    },
    arrivalTime: { type: Date, required: [true, "L'heure d'arrivée est obligatoire"] },
    user: { type: ObjectId, ref: 'User', required: true }, // celui qui apporte l'élément
  },
  { timestamps: true }
);

// Chaque élément apporté est unique par événement ("Chips" et " chips " sont le même élément)
shoppingItemSchema.index({ event: 1, nameNormalized: 1 }, { unique: true });

shoppingItemSchema.statics.normalize = (name) => String(name).trim().replace(/\s+/g, ' ').toLowerCase();

shoppingItemSchema.pre('validate', function () {
  if (this.name) this.nameNormalized = this.constructor.normalize(this.name);
});

shoppingItemSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret.nameNormalized;
    return ret;
  },
});

module.exports = mongoose.model('ShoppingItem', shoppingItemSchema);
