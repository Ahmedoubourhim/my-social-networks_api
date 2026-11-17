const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { bcryptRounds } = require('../config/env');

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: [true, 'Le prénom est obligatoire'], trim: true },
    lastname: { type: String, required: [true, 'Le nom est obligatoire'], trim: true },
    email: {
      type: String,
      required: [true, "L'email est obligatoire"],
      unique: true, // deux utilisateurs ne peuvent pas avoir le même email
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "L'email n'est pas valide"],
    },
    password: { type: String, required: [true, 'Le mot de passe est obligatoire'], select: false },
    avatar: { type: String, trim: true },
    birthdate: { type: Date },
    address: { type: addressSchema },
  },
  { timestamps: true }
);

// Hash du mot de passe dès qu'il est créé ou modifié
userSchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, bcryptRounds);
  }
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Le mot de passe n'est jamais renvoyé
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
