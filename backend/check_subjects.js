const db = require('./src/config/db');
async function check() {
  try {
    const [cols] = await db.query('DESCRIBE subjects');
    console.log('Columns:', cols);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
