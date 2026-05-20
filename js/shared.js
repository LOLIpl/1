/* ── CONFIG ── */
const CONFIG = {
  TMDB_KEY: "bb6f3e486fbce89586745ded69c13681",
  MOVIES_URL: "movies.json",
  SERIALS_URL: "serials.json",
  TV_URL: "tv.json",
  CACHE_KEY: 'tvsuper_tmdb_cache_v1',
  AUTH_KEY: 'tvsuper_auth',
  USERS_KEY: 'tvsuper_users_data',
  ITEMS_PER_PAGE: 50,
  ITEMS_PER_CATEGORY_HOME: 10,
  RECOMMENDED_COUNT: 5,
  TMDB_CHUNK_SIZE: 20,
  RENDER_CHUNK_SIZE: 20,
  TMDB_RATE_LIMIT_MS: 150,
  GENRE_NAMES: {
    28: "Akcja", 12: "Przygodowy", 16: "Animacja", 35: "Komedia",
    80: "Kryminał", 18: "Dramat", 14: "Fantasy", 27: "Horror",
    9648: "Tajemnica", 10749: "Romans", 878: "Sci-Fi", 53: "Thriller",
    10752: "Wojenny", 37: "Western", 10759: "Akcja i przygoda",
    10762: "Dla dzieci", 10763: "Wiadomości", 10764: "Reality",
    10765: "Sci-Fi i Fantasy", 10766: "Telenowela", 10767: "Talk-show",
    10768: "Wojenny i polityczny", 99: "Dokumentalny"
  }
};

/* ── STATE ── */
const state = {
  movies: [],
  serials: [],
  tvChannels: [],
  currentTab: "movies",
  isSearching: false,
  selectedGlobalCategory: null,
  currentUser: null,
  categoryPageData: {}
};

/* ── UTILS ── */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = type === 'err' ? 'toast-err' : '';
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.remove('show'), 3000);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function shuffleImmutable(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function makePid(itemId, isTv) {
  return (isTv ? 's_' : 'm_') + itemId;
}

function parsePid(pid) {
  return { id: pid.slice(2), isTv: pid[0] === 's' };
}
