/* ── IndexedDB cache (replaces localStorage for TMDB) ── */
const DB_NAME = 'TvSuperCache';
const DB_VERSION = 1;
const STORE_NAME = 'tmdb';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tmdbCacheGet(key) {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) { resolve(null); return; }
        if (Date.now() - entry.ts > 86400000) {
          resolve(null);
          tx.oncomplete = () => {
            const tx2 = db.transaction(STORE_NAME, 'readwrite');
            tx2.objectStore(STORE_NAME).delete(key);
          };
          return;
        }
        resolve(entry.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function tmdbCacheSet(key, data) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ key, ts: Date.now(), data });
  } catch { /* ignore */ }
}

async function tmdbCacheClearExpired() {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const now = Date.now();
      req.result.forEach(entry => {
        if (now - entry.ts > 86400000) store.delete(entry.key);
      });
    };
  } catch { /* ignore */ }
}
