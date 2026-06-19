const db = require('./src/config/db');
async function check() {
  try {
    const [rows] = await db.query('SHOW TABLES');
    console.log('Tables:', rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
