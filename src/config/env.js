require('dotenv').config({ quiet: true });

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mysocialnetworks',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  // base utilisée pour fabriquer les liens de partage d'un événement
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
};
