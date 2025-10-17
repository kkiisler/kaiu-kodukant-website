// Script to remove monitor-source entries from sync history
const fs = require('fs').promises;
const path = require('path');

async function cleanSyncHistory() {
  const historyFile = path.join('/data', 'sync-history.json');

  try {
    const data = await fs.readFile(historyFile, 'utf8');
    const history = JSON.parse(data);

    let cleanedCount = 0;

    // Clean calendar history
    if (history.calendar) {
      const originalCount = history.calendar.length;
      history.calendar = history.calendar.filter(entry => entry.source !== 'monitor');
      cleanedCount += originalCount - history.calendar.length;
      console.log(`Removed ${originalCount - history.calendar.length} monitor entries from calendar history`);
    }

    // Clean gallery history
    if (history.gallery) {
      const originalCount = history.gallery.length;
      history.gallery = history.gallery.filter(entry => entry.source !== 'monitor');
      cleanedCount += originalCount - history.gallery.length;
      console.log(`Removed ${originalCount - history.gallery.length} monitor entries from gallery history`);
    }

    // Write cleaned history back
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    console.log(`✅ Cleaned ${cleanedCount} monitor entries from sync history`);

  } catch (error) {
    console.error('Error cleaning sync history:', error);
  }
}

cleanSyncHistory();