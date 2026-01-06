const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '..', 'public', 'tmp');
const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function msUntilNextJstMidnight() {
  const nowMs = Date.now();
  const jstNow = new Date(nowMs + JST_OFFSET_MS);
  const nextJstMidnightUtc = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + 1) - JST_OFFSET_MS;
  return nextJstMidnightUtc - nowMs;
}

async function clearTmpFolder() {
  try {
    await fs.promises.mkdir(TMP_DIR, { recursive: true });
    const entries = await fs.promises.readdir(TMP_DIR);
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(TMP_DIR, entry);
        const stats = await fs.promises.stat(fullPath);
        if (stats.isFile()) {
          await fs.promises.unlink(fullPath);
        }
      })
    );
  } catch (err) {
    console.error('Failed to clear tmp folder:', err);
  }
}

function scheduleTmpCleanup() {
  const delay = msUntilNextJstMidnight();
  setTimeout(() => {
    clearTmpFolder();
    setInterval(clearTmpFolder, DAY_MS);
  }, delay);
}

function startTmpCleanup() {
  clearTmpFolder();
  scheduleTmpCleanup();
}

module.exports = { startTmpCleanup, clearTmpFolder };
