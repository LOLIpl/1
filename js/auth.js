/* ── AUTH (localStorage-based, stateless for GH Pages) ── */
async function localLoginFetch(data) {
  let db;
  try { db = JSON.parse(localStorage.getItem(CONFIG.USERS_KEY)) || {}; } catch (e) { db = {}; }
  const username = data.username || data.user;
  const user = db[username] || null;
  switch (data.action) {
    case 'register':
      if (user) return { ok: false, error: 'Użytkownik już istnieje' };
      db[username] = { password: data.password, favorites: [], planned: [], watched: {} };
      localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(db));
      return { ok: true };
    case 'login':
      if (!user || user.password !== data.password) return { ok: false, error: 'Nieprawidłowe dane' };
      return { ok: true, favorites: user.favorites || [], watched: user.watched || {}, planned: user.planned || [] };
    case 'getData':
      if (!db[username]) db[username] = { password: '', favorites: [], planned: [], watched: {} };
      localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(db));
      return { ok: true, favorites: db[username].favorites || [], planned: db[username].planned || [], watched: db[username].watched || {} };
    case 'saveFavorites':
      if (!db[username]) db[username] = { password: '', favorites: [], planned: [], watched: {} };
      db[username].favorites = Array.isArray(data.favorites) ? data.favorites : [];
      localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(db));
      return { ok: true };
    case 'savePlanned':
      if (!db[username]) db[username] = { password: '', favorites: [], planned: [], watched: {} };
      db[username].planned = Array.isArray(data.planned) ? data.planned : [];
      localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(db));
      return { ok: true };
    case 'saveWatched':
      if (!db[username]) db[username] = { password: '', favorites: [], planned: [], watched: {} };
      const cleaned = {};
      if (data.watched && typeof data.watched === 'object') {
        for (const [sid, eps] of Object.entries(data.watched)) {
          if (eps && typeof eps === 'object') {
            const cleanEps = {};
            for (const [k, v] of Object.entries(eps)) if (v) cleanEps[k] = true;
            if (Object.keys(cleanEps).length) cleaned[sid] = cleanEps;
          }
        }
      }
      db[username].watched = cleaned;
      localStorage.setItem(CONFIG.USERS_KEY, JSON.stringify(db));
      return { ok: true };
    default:
      return { ok: false, error: 'Nieznana akcja' };
  }
}

function saveAuthToStorage(user) {
  try { localStorage.setItem(CONFIG.AUTH_KEY, JSON.stringify(user)); } catch (e) {}
}

function loadAuthFromStorage() {
  try { return JSON.parse(localStorage.getItem(CONFIG.AUTH_KEY)); } catch (e) { return null; }
}
