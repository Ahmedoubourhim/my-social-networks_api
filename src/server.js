const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/env');

connectDB()
  .then(() => {
    app.listen(port, () => console.log(`API démarrée sur http://localhost:${port}/api/v1`));
  })
  .catch((err) => {
    console.error('Connexion MongoDB impossible :', err.message);
    process.exit(1);
  });
