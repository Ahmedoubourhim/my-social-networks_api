const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const buyerSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: [true, 'Le prénom est obligatoire'], trim: true },
    lastname: { type: String, required: [true, 'Le nom est obligatoire'], trim: true },
    email: {
      type: String,
      required: [true, "L'email est obligatoire"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "L'email n'est pas valide"],
    },
    address: {
      street: { type: String, required: [true, 'La rue est obligatoire'], trim: true },
      zipCode: { type: String, required: [true, 'Le code postal est obligatoire'], trim: true },
      city: { type: String, required: [true, 'La ville est obligatoire'], trim: true },
      country: { type: String, required: [true, 'Le pays est obligatoire'], trim: true },
    },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: true },
    ticketType: { type: ObjectId, ref: 'TicketType', required: true },
    buyer: { type: buyerSchema, required: true },
    purchaseDate: { type: Date, default: Date.now },
    purchasedBy: { type: ObjectId, ref: 'User' }, // renseigné si l'acheteur était connecté
  },
  { timestamps: true }
);

// Une personne (même email) ne peut obtenir qu'un seul billet par événement
ticketSchema.index({ event: 1, 'buyer.email': 1 }, { unique: true });
ticketSchema.index({ ticketType: 1 });

ticketSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Ticket', ticketSchema);
