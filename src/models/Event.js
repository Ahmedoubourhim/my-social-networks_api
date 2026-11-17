const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Le nom de l'événement est obligatoire"], trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 5000 },
    startDate: { type: Date, required: [true, 'La date de début est obligatoire'] },
    endDate: { type: Date, required: [true, 'La date de fin est obligatoire'] },
    location: { type: String, required: [true, 'Le lieu est obligatoire'], trim: true },
    coverPhoto: { type: String, trim: true },
    visibility: {
      type: String,
      enum: { values: ['public', 'private'], message: 'visibility doit valoir public ou private' },
      default: 'public',
    },
    organizers: [{ type: ObjectId, ref: 'User' }],
    participants: [{ type: ObjectId, ref: 'User' }],
    group: { type: ObjectId, ref: 'Group' },
    ticketingEnabled: { type: Boolean, default: false },
    shoppingListEnabled: { type: Boolean, default: false },
    carpoolEnabled: { type: Boolean, default: false },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

eventSchema.index({ name: 'text', description: 'text', location: 'text' });
eventSchema.index({ startDate: 1 });
eventSchema.index({ visibility: 1 });
eventSchema.index({ organizers: 1 });
eventSchema.index({ participants: 1 });
eventSchema.index({ group: 1 });

// Règles métier vérifiées à chaque save()
eventSchema.pre('validate', function () {
  if (this.startDate && this.endDate && this.endDate <= this.startDate) {
    this.invalidate('endDate', 'La date de fin doit être postérieure à la date de début');
  }
  if (!this.organizers || this.organizers.length < 1) {
    this.invalidate('organizers', 'Un événement doit avoir au moins un organisateur');
  }
  if (this.ticketingEnabled && this.visibility !== 'public') {
    this.invalidate('ticketingEnabled', 'La billetterie est réservée aux événements publics');
  }
});

eventSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Event', eventSchema);
