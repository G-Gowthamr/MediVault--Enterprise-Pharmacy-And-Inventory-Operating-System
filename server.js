const app = require('./src/app');
const { DB_FILE } = require('./src/config/db');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MediVault backend listening on http://localhost:${PORT} (DB: ${DB_FILE})`);
});
