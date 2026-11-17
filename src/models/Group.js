const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Le nom du groupe est obligatoire'], trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 2000 },
    icon: { type: String, trim: true },
    coverPhoto: { type: String, trim: true },
    type: {
      type: String,
      enum: { values: ['public', 'private', 'secret'], message: 'type doit valoir public, private ou secret' },
      default: 'public',
    },
    allowMembersToPost: { type: Boolean, default: true },
    allowMembersToCreateEvents: { type: Boolean, default: false },
    admins: [{ type: ObjectId, ref: 'User' }],
    members: [{ type: ObjectId, ref: 'User' }],
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

groupSchema.index({ name: 'text' });
groupSchema.index({ type: 1 });
groupSchema.index({ members: 1 });

// Règles : >= 1 admin, >= 1 membre, et tout admin est aussi membre
groupSchema.pre('validate', function () {
  if (!this.admins || this.admins.length < 1) this.invalidate('admins', 'Un groupe doit avoir au moins un administrateur');
  if (!this.members || this.members.length < 1) this.invalidate('members', 'Un groupe doit avoir au moins un membre');
  const memberIds = (this.members || []).map(String);
  if ((this.admins || []).some((a) => !memberIds.includes(String(a)))) {
    this.invalidate('admins', 'Un administrateur doit aussi être membre du groupe');
  }
});

groupSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Group', groupSchema);
