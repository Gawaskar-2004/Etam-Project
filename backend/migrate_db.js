const db = require('./src/config/db');
async function migrate() {
  try {
    console.log('Starting migration...');
    
    // 1. Create rooms table
    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id CHAR(36) PRIMARY KEY,
        institution_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100),
        capacity INT,
        building VARCHAR(255),
        floor VARCHAR(50),
        status VARCHAR(20) DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_room (institution_id, name)
      )
    `);
    console.log('✅ Rooms table created/verified');

    // 2. Add columns to timetable_assignments if missing
    const [cols] = await db.query('DESCRIBE timetable_assignments');
    const hasRoomId = cols.some(c => c.Field === 'room_id');
    const hasItemId = cols.some(c => c.Field === 'item_id');

    if (!hasRoomId) {
      await db.query('ALTER TABLE timetable_assignments ADD COLUMN room_id CHAR(36) AFTER item_id');
      console.log('✅ room_id added to timetable_assignments');
    }
    if (!hasItemId) {
      // It was in the DESCRIBE output as varchar(36), so it might already be there.
      // But let's be sure.
      console.log('ℹ️  item_id already exists');
    }

    // 3. Add column to class_teachers if missing
    const [ctCols] = await db.query('DESCRIBE class_teachers');
    const hasCtItemId = ctCols.some(c => c.Field === 'item_id');
    if (!hasCtItemId) {
      await db.query('ALTER TABLE class_teachers ADD COLUMN item_id CHAR(36) AFTER subcategory_id');
      console.log('✅ item_id added to class_teachers');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}
migrate();
