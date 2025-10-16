const database = require('./services/database');
const gallerySync = require('./services/gallery-sync');

async function resetAndSync() {
  console.log('Manual gallery reset and sync');

  // Initialize database
  database.initialize();

  // Reset the gallery
  const resetResult = gallerySync.resetGallery();
  console.log('Reset result:', resetResult);

  if (resetResult.success) {
    // Trigger sync
    console.log('Starting sync...');
    const syncResult = await gallerySync.syncGallery();
    console.log('Sync result:', syncResult);
  }

  // Close database
  database.close();
  process.exit(0);
}

resetAndSync().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});