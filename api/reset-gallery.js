const database = require('./services/database');
const db = database.getDb();

// Delete all gallery photos to force re-upload
const stmt = db.prepare('DELETE FROM gallery_photos');
const result = stmt.run();
console.log(`Deleted ${result.changes} photos from database`);

// Reset sync state
const updateStmt = db.prepare(`
  UPDATE gallery_sync_state 
  SET total_photos_processed = 0, 
      last_sync_at = NULL,
      sync_status = 'idle'
`);
updateStmt.run();
console.log('Reset sync state');

db.close();
console.log('Done! Gallery will re-process all photos on next sync.');
