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
  TMDB_RATE_LIMIT_MS: 300,
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

/* ── TMDB with rate limiting + IndexedDB caching ── */
let tmdbQueue = [];
let tmdbProcessing = false;

async function processTmdbQueue() {
  if (tmdbProcessing) return;
  tmdbProcessing = true;
  while (tmdbQueue.length > 0) {
    const task = tmdbQueue.shift();
    try {
      const data = await fetchTmdbSingle(task.item, task.type);
      task.resolve(data);
    } catch (e) {
      task.reject(e);
    }
    await new Promise(r => setTimeout(r, CONFIG.TMDB_RATE_LIMIT_MS));
  }
  tmdbProcessing = false;
}

async function fetchTmdbSingle(item, type = 'movie') {
  const q = item.titleEn || item.title;
  const cacheKey = `${type}_${q}`;
  const cached = await tmdbCacheGet(cacheKey);
  if (cached) return { item, tmdb: cached };

  const url = `https://api.themoviedb.org/3/search/${type}?api_key=${CONFIG.TMDB_KEY}&query=${encodeURIComponent(q)}&language=pl-PL`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const first = data.results?.[0] || null;
      if (first) {
        await tmdbCacheSet(cacheKey, first);
      }
      return { item, tmdb: first };
    }
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }
    return { item, tmdb: null };
  }
  return { item, tmdb: null };
}

function enqueueTmdbRequest(item, type) {
  return new Promise((resolve, reject) => {
    tmdbQueue.push({ item, type, resolve, reject });
    processTmdbQueue();
  });
}

async function fetchTMDBBatch(list, type = 'movie') {
  const promises = list.map(item => enqueueTmdbRequest(item, type));
  const results = await Promise.allSettled(promises);
  results.forEach(r => {
    if (r.status !== "fulfilled" || !r.value.tmdb) return;
    const { item, tmdb } = r.value;
    if (tmdb.poster_path) item.poster = "https://image.tmdb.org/t/p/w342" + tmdb.poster_path;
    if (tmdb.backdrop_path) item.backdrop = "https://image.tmdb.org/t/p/w1280" + tmdb.backdrop_path;
    item.rating = tmdb.vote_average ? +tmdb.vote_average.toFixed(1) : null;
    item.year = (type === 'movie' ? tmdb.release_date : tmdb.first_air_date)?.slice(0, 4) || null;
    item.genres = tmdb.genre_ids || [];
    item.description = tmdb.overview || "";
    item.popularity = tmdb.popularity || 0;
    if (type === 'tv') item._tmdbName = tmdb.name || "";
  });
}

/* -- UI: Sidebar, Auth Modal, Rendering, Cards -- */

/* -- AUTH UI -- */
let modalMode = 'login';

function openAuthModal(mode) {
  if (mode === undefined) mode = 'login';
  const authModal = document.getElementById('authModal');
  const authTitle = document.getElementById('authTitle');
  const modalSubmit = document.getElementById('modalSubmit');
  const modalToggle = document.getElementById('modalToggle');
  const authMsgEl = document.getElementById('authMsg');
  const modalUser = document.getElementById('modalUser');
  const modalPass = document.getElementById('modalPass');
  if (!authModal) return;

  modalMode = mode;
  authTitle.textContent = mode === 'login' ? 'Zaloguj' : 'Utworz konto';
  modalSubmit.textContent = mode === 'login' ? 'Zaloguj' : 'Utworz konto';
  modalToggle.textContent = mode === 'login' ? 'Utworz konto' : 'Zaloguj';
  authMsgEl.textContent = '';
  modalUser.value = '';
  modalPass.value = '';
  authModal.style.display = 'flex';
  setTimeout(function() { if (modalUser) modalUser.focus(); }, 50);
}

function closeAuthModal() {
  const el = document.getElementById('authModal');
  if (el) el.style.display = 'none';
}

function updateAuthUI() {
  const authButton = document.getElementById('authButton');
  const authStatus = document.getElementById('authStatus');
  const authUserLabel = document.getElementById('authUserLabel');
  if (!authButton || !authStatus) return;
  if (state.currentUser) {
    authButton.style.display = 'none';
    authStatus.style.display = 'flex';
    authUserLabel.textContent = state.currentUser.username;
  } else {
    authButton.style.display = 'flex';
    authStatus.style.display = 'none';
    authUserLabel.textContent = '';
  }
}

/* -- MOBILE SIDEBAR -- */
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

/* -- SKELETONS -- */
function renderSkeletons(container, count) {
  if (count === undefined) count = 10;
  container.innerHTML = '';
  var grid = document.createElement('div');
  grid.className = 'movie-grid';
  for (var i = 0; i < count; i++) {
    var el = document.createElement('div');
    el.innerHTML = '<div class="skeleton skeleton-thumb"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>';
    grid.appendChild(el);
  }
  container.appendChild(grid);
}

/* -- CARD BUILDER -- */
function buildCard(item, isSerial, delay) {
  var card = document.createElement("div");
  card.className = "movie" + (isSerial ? " is-tv" : "");
  card.style.animationDelay = (delay || 0) + "s";
  var itemId = item.id;
  card.dataset.itemId = itemId;
  card.dataset.isSerial = isSerial;

  var thumbClass = "movie-thumb" + (isSerial ? " is-serial" : "");
  var posterUrl = item.poster || '';
  var year = item.year || "";
  var rating = item.rating ? " - ★ " + item.rating : "";
  var pid = makePid(itemId, isSerial);

  var imgHtml = posterUrl
    ? '<img src="' + posterUrl + '" alt="' + escapeHtml(item.title) + '" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\';">'
    : '';
  card.innerHTML = '<div class="' + thumbClass + '">' + imgHtml +
    '<div class="movie-overlay">' +
    '<button class="mini-play">▶</button>' +
    '<button class="card-fav-btn" data-pid="' + pid + '" data-istv="' + isSerial + '" title="Ulubione">♥</button>' +
    '<button class="card-plan-btn" data-pid="' + pid + '" data-istv="' + isSerial + '" title="Zaplanowane">☆</button>' +
    '</div></div>' +
    '<div class="movie-meta">' +
    '<span class="movie-title">' + escapeHtml(item.title) + '</span>' +
    '<span class="movie-info">' + year + ' ' + rating + '</span></div>';

  // Async button state
  (async function() {
    var favs = await getFavorites();
    var planned = await getPlanned();
    var favBtn = card.querySelector('.card-fav-btn');
    var planBtn = card.querySelector('.card-plan-btn');
    if (favs.includes(pid)) {
      favBtn.classList.add('active');
      favBtn.style.color = '#e8664a';
      favBtn.style.borderColor = 'rgba(232,102,74,0.5)';
    }
    if (planned.includes(pid)) {
      planBtn.classList.add('active');
      planBtn.style.color = '#4fa8e8';
      planBtn.style.borderColor = 'rgba(79,168,232,0.5)';
    }
  })();

  card.addEventListener('click', function(e) {
    if (e.target.closest('.card-fav-btn') || e.target.closest('.card-plan-btn')) return;
    if (isSerial) openSerial(itemId);
    else openMovie(itemId);
  });

  return card;
}

/* -- CHUNKED RENDERING -- */
function renderChunked(items, container, isSerial, onComplete) {
  var index = 0;
  function renderNextChunk() {
    var chunk = items.slice(index, index + CONFIG.RENDER_CHUNK_SIZE);
    var frag = document.createDocumentFragment();
    chunk.forEach(function(item, i) {
      var realIndex = index + i;
      var card = buildCard(item, isSerial, realIndex * 0.02);
      frag.appendChild(card);
    });
    container.appendChild(frag);
    index += CONFIG.RENDER_CHUNK_SIZE;
    if (index < items.length) {
      requestAnimationFrame(renderNextChunk);
    } else if (onComplete) {
      onComplete();
    }
  }
  renderNextChunk();
}

/* -- PAGINATION -- */
function createPagination(current, total, onPageChange) {
  var wrapper = document.createElement('div');
  wrapper.className = 'pagination';
  var prevBtn = document.createElement('button');
  prevBtn.innerHTML = '←';
  prevBtn.className = 'page-arrow';
  prevBtn.disabled = current === 1;
  prevBtn.addEventListener('click', function() { if (current > 1) onPageChange(current - 1); });
  wrapper.appendChild(prevBtn);

  var maxVisible = 5;
  var startPage = Math.max(1, current - Math.floor(maxVisible / 2));
  var endPage = Math.min(total, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

  for (var i = startPage; i <= endPage; i++) {
    (function(page) {
      var btn = document.createElement('button');
      btn.textContent = page;
      btn.className = page === current ? 'active' : '';
      btn.addEventListener('click', function() { if (page !== current) onPageChange(page); });
      wrapper.appendChild(btn);
    })(i);
  }
  var nextBtn = document.createElement('button');
  nextBtn.innerHTML = '→';
  nextBtn.className = 'page-arrow';
  nextBtn.disabled = current === total;
  nextBtn.addEventListener('click', function() { if (current < total) onPageChange(current + 1); });
  wrapper.appendChild(nextBtn);
  return wrapper;
}

/* -- SCROLL REVEAL -- */
function initReveal() {
  var els = document.querySelectorAll(".reveal");
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } });
  }, { threshold: 0.05 });
  els.forEach(function(el) { obs.observe(el); });
}

/* -- SCROLL TO TOP -- */
function initScrollToTop() {
  var btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    if (window.scrollY > 600) { btn.classList.add('visible'); }
    else { btn.classList.remove('visible'); }
  });
  btn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
}

/* -- CATEGORY VIEW -- */
function showCategoryView(categoryName, items, isSerial) {
  var content = document.getElementById("content");
  var favSection = document.getElementById("favoritesSection");
  var categoryView = document.getElementById("categoryView");
  var categoryViewTitle = document.getElementById("categoryViewTitle");
  var categoryViewContent = document.getElementById("categoryViewContent");
  if (!categoryView) return;

  content.style.display = 'none';
  if (favSection) favSection.style.display = 'none';
  categoryView.classList.add('active');
  categoryViewTitle.textContent = categoryName;

  var key = categoryName + '_' + (isSerial ? 'tv' : 'movie');
  state.categoryPageData[key] = { items: items, isSerial: isSerial, page: 1 };
  renderCategoryPage(key);
}

function hideCategoryView() {
  var content = document.getElementById("content");
  var categoryView = document.getElementById("categoryView");
  if (!categoryView) return;
  categoryView.classList.remove('active');
  if (content) content.style.display = '';
  var favSection = document.getElementById("favoritesSection");
  if (favSection) favSection.style.display = '';
}

function renderCategoryPage(key) {
  var categoryViewContent = document.getElementById("categoryViewContent");
  if (!categoryViewContent) return;
  var data = state.categoryPageData[key];
  if (!data) return;
  var items = data.items;
  var isSerial = data.isSerial;
  var page = data.page;
  var totalPages = Math.ceil(items.length / CONFIG.ITEMS_PER_PAGE);
  var start = (page - 1) * CONFIG.ITEMS_PER_PAGE;
  var end = Math.min(start + CONFIG.ITEMS_PER_PAGE, items.length);
  var pageItems = items.slice(start, end);

  categoryViewContent.innerHTML = '';
  var grid = document.createElement("div");
  grid.className = "movie-grid";
  renderChunked(pageItems, grid, isSerial, function() {
    if (totalPages > 1) {
      var pagination = createPagination(page, totalPages, function(newPage) {
        state.categoryPageData[key].page = newPage;
        renderCategoryPage(key);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      categoryViewContent.appendChild(pagination);
    }
  });
  categoryViewContent.appendChild(grid);
}

/* -- ACCENT COLOR (for serial/movie detail pages) -- */
function getAccent(isSerial) {
  return isSerial ? '#4fa8e8' : '#e8a020';
}

/* -- SEARCH -- */

function doSearch(query) {
  var content = document.getElementById("content");
  hideCategoryView();
  if (!query) { state.isSearching = false; renderAll(); return; }
  state.isSearching = true;

  var q = query.toLowerCase();
  var filteredMovies = state.movies.filter(function(m) {
    return (m.title && m.title.toLowerCase().includes(q)) || (m.titleEn && m.titleEn.toLowerCase().includes(q));
  });
  var filteredSerials = state.serials.filter(function(s) {
    return (s.title && s.title.toLowerCase().includes(q)) || (s.titleEn && s.titleEn.toLowerCase().includes(q)) || (s._tmdbName && s._tmdbName.toLowerCase().includes(q));
  });
  var total = filteredMovies.length + filteredSerials.length;

  content.innerHTML = '<div class="search-header">Wyniki dla: <em>"' + escapeHtml(query) + '"</em> &mdash; ' + total + ' wyników</div>';
  if (!total) { content.innerHTML += '<div class="no-results">Nic nie znaleziono</div>'; return; }

  if (filteredSerials.length) {
    var serialSection = document.createElement('div');
    serialSection.className = 'search-section';
    var sh = document.createElement("div");
    sh.className = "search-section-label";
    sh.innerHTML = '<span class="ssl-badge ssl-tv">Seriale</span><span class="ssl-count">' + filteredSerials.length + '</span>';
    serialSection.appendChild(sh);
    var grid = document.createElement("div");
    grid.className = "movie-grid search-grid";
    renderChunked(filteredSerials, grid, true);
    serialSection.appendChild(grid);
    content.appendChild(serialSection);
  }

  if (filteredMovies.length) {
    var movieSection = document.createElement('div');
    movieSection.className = 'search-section';
    var mh = document.createElement("div");
    mh.className = "search-section-label";
    mh.innerHTML = '<span class="ssl-badge ssl-movie">Filmy</span><span class="ssl-count">' + filteredMovies.length + '</span>';
    movieSection.appendChild(mh);
    var grid2 = document.createElement("div");
    grid2.className = "movie-grid search-grid";
    renderChunked(filteredMovies, grid2, false);
    movieSection.appendChild(grid2);
    content.appendChild(movieSection);
  }
}

function clearSearch() {
  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  if (searchInput) searchInput.value = "";
  if (searchClear) searchClear.style.display = "none";
  state.isSearching = false;
  hideCategoryView();
  renderAll();
}

/* -- FAVORITES + PLANNED -- */
let favCache = null;
let plannedCache = null;

async function getFavorites() {
  if (!state.currentUser) return [];
  if (favCache !== null) return favCache;
  try {
    const data = await localLoginFetch({ action: 'getData', username: state.currentUser.username });
    favCache = (data && data.favorites) ? data.favorites : [];
    return favCache;
  } catch (e) { return []; }
}

async function saveFavorites(list) {
  if (!state.currentUser) { showToast('Zaloguj sie aby zapisac ulubione', 'err'); return; }
  favCache = list;
  try { await localLoginFetch({ action: 'saveFavorites', username: state.currentUser.username, favorites: list }); } catch (e) { console.warn('saveFavorites failed', e); }
  await renderFavorites();
}

async function toggleFavorite(itemId, isTv) {
  if (!state.currentUser) { openAuthModal('login'); return; }
  const pid = makePid(itemId, isTv);
  let favs = await getFavorites();
  const index = favs.indexOf(pid);
  if (index > -1) { favs.splice(index, 1); showToast('Usunieto z ulubionych'); } else { favs.push(pid); showToast('Dodano do ulubionych'); }
  await saveFavorites(favs);
  favCache = favs;
}

async function removeFavorite(pid) {
  const favs = await getFavorites();
  await saveFavorites(favs.filter(f => f !== pid));
  showToast('Usunieto z ulubionych');
}

async function clearAllFavorites() {
  if (!confirm("Wyczycic wszystkie polubione?")) return;
  await saveFavorites([]);
  showToast('Wyczyszczono ulubione');
}

async function getPlanned() {
  if (!state.currentUser) return [];
  if (plannedCache !== null) return plannedCache;
  try {
    const data = await localLoginFetch({ action: 'getData', username: state.currentUser.username });
    plannedCache = (data && data.planned) ? data.planned : [];
    return plannedCache;
  } catch (e) { return []; }
}

async function savePlanned(list) {
  if (!state.currentUser) { showToast('Zaloguj sie', 'err'); return; }
  plannedCache = list;
  try { await localLoginFetch({ action: 'savePlanned', username: state.currentUser.username, planned: list }); } catch (e) { console.warn('savePlanned failed', e); }
  await renderFavorites();
}

async function togglePlanned(itemId, isTv) {
  if (!state.currentUser) { openAuthModal('login'); return; }
  const pid = makePid(itemId, isTv);
  let planned = await getPlanned();
  const index = planned.indexOf(pid);
  if (index > -1) { planned.splice(index, 1); showToast('Usunieto z zaplanowanych'); } else { planned.push(pid); showToast('Dodano do zaplanowanych'); }
  await savePlanned(planned);
  plannedCache = planned;
}

async function removePlanned(pid) {
  const planned = await getPlanned();
  await savePlanned(planned.filter(p => p !== pid));
  showToast('Usunieto z zaplanowanych');
}

async function clearAllPlanned() {
  if (!confirm("Wyczycic wszystkie zaplanowane?")) return;
  await savePlanned([]);
  showToast('Wyczyszczono zaplanowane');
}

function findItemById(id, isTv) {
  const list = isTv ? state.serials : state.movies;
  return list.find(item => String(item.id) === String(id)) || null;
}

/* -- RENDERING: TV, Movies, Serials, Favorites -- */

/* -- TV -- */
function renderTV() {
  var content = document.getElementById("content");
  content.innerHTML = "";
  if (!state.tvChannels.length) { content.innerHTML = '<div class="no-results">Brak kanalów TV. Dodaj tv.json.</div>'; return; }
  var grid = document.createElement("div");
  grid.className = "movie-grid";
  var frag = document.createDocumentFragment();
  state.tvChannels.forEach(function(channel, i) {
    var card = document.createElement("div");
    card.className = "movie is-tv fade-in";
    card.style.animationDelay = (i * 0.03) + "s";
    var logo = channel.logo || '';
    var name = channel.name || 'Kanal';
    card.innerHTML = '<div class="movie-thumb">' +
      '<img src="' + logo + '" alt="' + escapeHtml(name) + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.style.background=\'var(--surface2)\';">' +
      '<div class="movie-overlay"><button class="mini-play">▶</button></div></div>' +
      '<div class="movie-meta"><span class="movie-title">' + escapeHtml(name) + '</span>' +
      '<span class="movie-info" style="color:#2ecc71;font-weight:500;">● NA ZYWO</span></div>';
    card.addEventListener('click', function() { if (channel.link) playTvChannel(channel.link); });
    frag.appendChild(card);
  });
  grid.appendChild(frag);
  content.appendChild(grid);
}

function playTvChannel(link) {
  var modal = document.getElementById('tvPlayerModal');
  var iframe = document.getElementById('tvIframe');
  if (!modal || !iframe) return;
  iframe.src = link;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeTvChannel() {
  var modal = document.getElementById('tvPlayerModal');
  var iframe = document.getElementById('tvIframe');
  if (!modal || !iframe) return;
  iframe.src = '';
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

/* -- ADD CATEGORY -- */
function addCategory(name, list, container, isSerial) {
  var valid = list.slice(0, CONFIG.ITEMS_PER_CATEGORY_HOME);
  if (!valid.length) return;

  var section = document.createElement("div");
  section.className = "category reveal";

  var header = document.createElement("div");
  header.className = "category-header";
  header.innerHTML = '<div style="display:flex;align-items:baseline;gap:0.8rem;">' +
    '<h2>' + escapeHtml(name) + '</h2>' +
    '<span class="cat-count">' + list.length + ' ' + (isSerial ? "seriali" : "filmów") + '</span></div>';

  var viewAllBtn = document.createElement("button");
  viewAllBtn.className = "category-pill";
  viewAllBtn.textContent = "Zobacz wszystko";
  viewAllBtn.addEventListener('click', function() { showCategoryView(name, list, isSerial); });
  header.appendChild(viewAllBtn);
  section.appendChild(header);

  // Featured item
  if (valid[0] && valid[0].backdrop) {
    var featured = document.createElement("div");
    featured.className = "featured" + (isSerial ? " tv" : "");
    featured.style.backgroundImage = "url(" + valid[0].backdrop + ")";
    var itemId = valid[0].id;
    var desc = valid[0].description ? valid[0].description.slice(0, 120) + "…" : "";
    featured.innerHTML = '<div class="featured-overlay"></div>' +
      '<div class="featured-info">' +
      '<h3>' + escapeHtml(valid[0].title) + '</h3>' +
      '<p>' + escapeHtml(desc) + '</p>' +
      '<div class="featured-meta">' +
      (valid[0].rating ? '<span class="star">★ ' + valid[0].rating + '</span>' : '') +
      (valid[0].year ? '<span class="year">' + valid[0].year + '</span>' : '') +
      (isSerial ? '<span class="tv-badge">SERIAL</span>' : '') +
      '</div>' +
      '<button class="play-btn' + (isSerial ? ' tv' : '') + '" data-id="' + itemId + '">▶ Ogladaj</button></div>';
    featured.querySelector('.play-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      if (isSerial) openSerial(itemId); else openMovie(itemId);
    });
    featured.addEventListener("click", function() { if (isSerial) openSerial(itemId); else openMovie(itemId); });
    section.appendChild(featured);
  }

  var grid = document.createElement("div");
  grid.className = "movie-grid";
  renderChunked(valid, grid, isSerial);
  section.appendChild(grid);
  container.appendChild(section);
}

/* -- RENDER MOVIES -- */
function renderMovieCategories() {
  var content = document.getElementById("content");
  content.innerHTML = "";

  var withPoster = state.movies.filter(function(m) { return m.poster; });
  var byRating = [].concat(state.movies).sort(function(a, b) { return (b.rating || 0) - (a.rating || 0); });
  var byWorstRating = [].concat(state.movies).sort(function(a, b) { return (a.rating || 0) - (b.rating || 0); });
  var byNewest = [].concat(state.movies).sort(function(a, b) { return (b.year || 0) - (a.year || 0); });
  var byOldest = [].concat(state.movies).sort(function(a, b) { return (a.year || 0) - (b.year || 0); });
  var byRecent = [].concat(state.movies).reverse();
  var recommended = shuffleImmutable(state.movies).slice(0, CONFIG.RECOMMENDED_COUNT);

  var allCategories = [
    { name: "Polecane", list: recommended },
    { name: "Najwyzej oceniane", list: byRating },
    { name: "Najgorzej oceniane", list: byWorstRating },
    { name: "Najnowsze", list: byNewest },
    { name: "Komedia", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(35) >= 0; }) },
    { name: "Akcja", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(28) >= 0; }) },
    { name: "Sci-Fi", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(878) >= 0; }) },
    { name: "Dramat", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(18) >= 0; }) },
    { name: "Animacja", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(16) >= 0; }) },
    { name: "Horror", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(27) >= 0; }) },
    { name: "Thriller", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(53) >= 0; }) },
    { name: "Romans", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(10749) >= 0; }) },
    { name: "Fantasy", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(14) >= 0; }) },
    { name: "Kryminal", list: withPoster.filter(function(m) { return m.genres && m.genres.indexOf(80) >= 0; }) },
    { name: "Klasyki", list: byOldest },
    { name: "Ostatnio dodane", list: byRecent },
  ];

  renderFilterBar(content, allCategories, renderMovieCategories);
  var toRender = state.selectedGlobalCategory ? allCategories.filter(function(c) { return c.name === state.selectedGlobalCategory; }) : allCategories;
  toRender.forEach(function(cat) { addCategory(cat.name, cat.list, content, false); });
  initReveal();
}

/* -- RENDER SERIALS -- */
function renderSerialCategories() {
  var content = document.getElementById("content");
  content.innerHTML = "";
  if (!state.serials.length) {
    content.innerHTML = '<div class="no-results">Brak seriali. Dodaj seriale do <b>serials.json</b>.</div>';
    return;
  }

  var withPoster = state.serials.filter(function(m) { return m.poster; });
  var byRating = [].concat(state.serials).sort(function(a, b) { return (b.rating || 0) - (a.rating || 0); });
  var byWorstRating = [].concat(state.serials).sort(function(a, b) { return (a.rating || 0) - (b.rating || 0); });
  var byNewest = [].concat(state.serials).sort(function(a, b) { return (b.year || 0) - (a.year || 0); });
  var byRecent = [].concat(state.serials).reverse();
  var recommended = shuffleImmutable(state.serials).slice(0, CONFIG.RECOMMENDED_COUNT);

  var allCategories = [
    { name: "Polecane", list: recommended },
    { name: "Najwyzej oceniane", list: byRating },
    { name: "Najgorzej oceniane", list: byWorstRating },
    { name: "Najnowsze", list: byNewest },
    { name: "Dramat", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(18) >= 0; }) },
    { name: "Komedia", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(35) >= 0; }) },
    { name: "Akcja", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(10759) >= 0; }) },
    { name: "Sci-Fi i Fantasy", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(10765) >= 0; }) },
    { name: "Kryminal", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(80) >= 0; }) },
    { name: "Animacja", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(16) >= 0; }) },
    { name: "Dokumentalny", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(99) >= 0; }) },
    { name: "Tajemnica", list: withPoster.filter(function(s) { return s.genres && s.genres.indexOf(9648) >= 0; }) },
    { name: "Ostatnio dodane", list: byRecent },
  ];

  renderFilterBar(content, allCategories, renderSerialCategories);
  var toRender = state.selectedGlobalCategory ? allCategories.filter(function(c) { return c.name === state.selectedGlobalCategory; }) : allCategories;
  toRender.forEach(function(cat) { addCategory(cat.name, cat.list, content, true); });
  initReveal();
}

/* -- FILTER BAR -- */
function renderFilterBar(container, categories, renderFn) {
  var filterContainer = document.createElement("div");
  filterContainer.className = "global-filters";
  var allBtn = document.createElement("button");
  allBtn.className = "global-filter-btn" + (!state.selectedGlobalCategory ? " active" : "");
  allBtn.textContent = "Wszystkie";
  allBtn.onclick = function() { state.selectedGlobalCategory = null; renderFn(); };
  filterContainer.appendChild(allBtn);

  categories.forEach(function(cat) {
    if (!cat.list.length) return;
    var btn = document.createElement("button");
    btn.className = "global-filter-btn" + (state.selectedGlobalCategory === cat.name ? " active" : "");
    btn.textContent = cat.name;
    btn.onclick = function() { state.selectedGlobalCategory = cat.name; renderFn(); };
    filterContainer.appendChild(btn);
  });
  container.appendChild(filterContainer);
}

/* -- FAVORITES RENDERING -- */
async function renderFavorites() {
  var section = document.getElementById("favoritesSection");
  var favCont = document.getElementById("favContent");
  if (!section || !favCont) return;

  var favs = await getFavorites();
  var planned = await getPlanned();

  if (!state.currentUser) {
    section.style.display = 'block';
    favCont.innerHTML = '<div class="fav-section">' +
      '<div class="fav-header"><span class="fav-title">Polubione</span></div>' +
      '<div style="padding:1rem;color:var(--muted);">Zaloguj sie, aby zobaczyc swoje polubione.</div>' +
      '<div style="padding:0 1rem 1rem;"><button id="favLoginBtn" class="fav-clear-btn">Zaloguj</button></div></div>' +
      '<div class="fav-section">' +
      '<div class="fav-header"><span class="fav-title">Zaplanowane</span></div>' +
      '<div style="padding:1rem;color:var(--muted);">Zaloguj sie, aby zobaczyc zaplanowane.</div></div>';
    var loginBtn = document.getElementById('favLoginBtn');
    if (loginBtn) loginBtn.addEventListener('click', function() { openAuthModal('login'); });
    return;
  }

  var html = '';
  if (!favs.length) {
    html += '<div class="fav-section"><div class="fav-header"><span class="fav-title">Polubione</span></div><div style="padding:1rem;color:var(--muted);">Brak polubionych pozycji.</div></div>';
  } else {
    html += '<div class="fav-section"><div class="fav-header"><span class="fav-title">Polubione</span><button class="fav-clear-btn" id="favClearAll">Wyczysc wszystko</button></div><div class="fav-grid" id="favGrid"></div><div class="fav-divider"></div></div>';
  }
  if (!planned.length) {
    html += '<div class="fav-section"><div class="fav-header"><span class="fav-title">Zaplanowane</span></div><div style="padding:1rem;color:var(--muted);">Brak zaplanowanych pozycji.</div></div>';
  } else {
    html += '<div class="fav-section"><div class="fav-header"><span class="fav-title">Zaplanowane</span><button class="fav-clear-btn" id="plannedClearAll">Wyczysc wszystko</button></div><div class="fav-grid" id="plannedGrid"></div><div class="fav-divider"></div></div>';
  }

  section.style.display = 'block';
  favCont.innerHTML = html;

  var clearFav = document.getElementById('favClearAll');
  if (clearFav) clearFav.addEventListener('click', clearAllFavorites);
  var clearPlan = document.getElementById('plannedClearAll');
  if (clearPlan) clearPlan.addEventListener('click', clearAllPlanned);

  function renderFavGrid(gridId, pids, removeFn) {
    var grid = document.getElementById(gridId);
    if (!grid) return;
    var frag = document.createDocumentFragment();
    pids.forEach(function(pid) {
      var parsed = parsePid(pid);
      var id = parsed.id;
      var isTv = parsed.isTv;
      var item = findItemById(id, isTv);
      if (!item) return;
      var card = document.createElement("div");
      card.className = "fav-card";
      var poster = item.poster || '';
      var title = item.title || 'Bez tytulu';
      card.innerHTML = '<button class="fav-remove" data-pid="' + pid + '" title="Usun">✕</button>' +
        (poster ? '<img src="' + poster + '" alt="' + escapeHtml(title) + '" loading="lazy">' : '') +
        '<div class="fav-card-title">' + escapeHtml(title) + '</div>';
      card.querySelector('.fav-remove').addEventListener('click', function(e) { e.stopPropagation(); removeFn(pid); });
      card.addEventListener('click', function() {
        window.location.href = isTv ? 'detail.html?id=' + encodeURIComponent(id) + '&type=serial' : 'detail.html?id=' + encodeURIComponent(id) + '&type=movie';
      });
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  if (favs.length) renderFavGrid('favGrid', favs, removeFavorite);
  if (planned.length) renderFavGrid('plannedGrid', planned, removePlanned);
}

/* -- NAVIGATION -- */
function openMovie(id) { window.location.href = "detail.html?id=" + encodeURIComponent(id) + "&type=movie"; }
function openSerial(id) { window.location.href = "detail.html?id=" + encodeURIComponent(id) + "&type=serial"; }

/* -- APP INIT -- */

function renderAll() {
  if (state.currentTab === "movies") renderMovieCategories();
  else if (state.currentTab === "serials") renderSerialCategories();
  else if (state.currentTab === "tv") renderTV();
}

function fadeAndRender() {
  var content = document.getElementById("content");
  content.classList.add("fading");
  setTimeout(function() {
    content.classList.remove("fading");
    renderAll();
  }, 220);
}

async function loadAll() {
  var content = document.getElementById("content");
  renderSkeletons(content, 10);

  try {
    var results = await Promise.allSettled([
      fetch(CONFIG.MOVIES_URL).then(function(r) { return r.ok ? r.json() : Promise.reject(); }),
      fetch(CONFIG.SERIALS_URL).then(function(r) { return r.ok ? r.json() : Promise.reject(); }),
      fetch(CONFIG.TV_URL).then(function(r) { return r.ok ? r.json() : Promise.reject(); })
    ]);

    var rawMovies = results[0].status === 'fulfilled' && Array.isArray(results[0].value) ? results[0].value : [];
    var rawSerials = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];

    rawMovies.forEach(function(m, i) { if (m.id === undefined || m.id === null) m.id = i; });
    rawSerials.forEach(function(s, i) { if (s.id === undefined || s.id === null) s.id = i; });

    state.movies = shuffleImmutable(rawMovies);
    state.serials = shuffleImmutable(rawSerials);
    state.tvChannels = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];

    await tmdbCacheClearExpired();

    // Initial render (shows placeholders for items without poster)
    renderAll();

    // TMDB enrichment - first batch, then render again with posters
    var update = function() { if (!state.isSearching) renderAll(); };
    fetchTMDBBatch(state.movies.slice(0, 200), 'movie').then(update);
    fetchTMDBBatch(state.serials.slice(0, 50), 'tv').then(update);

    // Remaining items
    setTimeout(function() {
      fetchTMDBBatch(state.movies.slice(200), 'movie').then(update);
      fetchTMDBBatch(state.serials.slice(50), 'tv').then(update);
    }, 5000);

  } catch (e) {
    console.error(e);
    content.innerHTML = '<div class="no-results">Blad ladowania danych.<br>Sprawdz pliki JSON.</div>';
    showToast('Blad ladowania danych', 'err');
  }
}

/* -- TABS -- */
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var tab = btn.dataset.tab;
      if (tab === state.currentTab) return;
      document.querySelectorAll(".tab-btn").forEach(function(b) { b.classList.remove("active"); });
      btn.classList.add("active");
      state.currentTab = tab;
      state.selectedGlobalCategory = null;
      hideCategoryView();
      document.body.classList.toggle("tab-serials", tab === "serials");
      document.body.classList.toggle("tab-tv", tab === "tv");
      if (state.isSearching) clearSearch();
      else fadeAndRender();
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

/* -- SEARCH INPUT -- */
function initSearch() {
  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  if (!searchInput) return;

  searchInput.addEventListener("input", debounce(function(e) {
    var val = e.target.value.trim();
    if (searchClear) searchClear.style.display = val ? "flex" : "none";
    doSearch(val);
  }, 250));

  if (searchClear) {
    searchClear.addEventListener("click", clearSearch);
  }
}

/* -- DELEGATED CLICK HANDLERS -- */
function initEventDelegation() {
  document.addEventListener('click', async function(e) {
    var favBtn = e.target.closest('.card-fav-btn');
    var planBtn = e.target.closest('.card-plan-btn');

    if (favBtn) {
      e.stopPropagation();
      var pid = favBtn.dataset.pid;
      var isTv = favBtn.dataset.istv === 'true';
      var parsed = parsePid(pid);
      await toggleFavorite(parsed.id, isTv);
      var favs = await getFavorites();
      if (favs.includes(pid)) {
        favBtn.classList.add('active');
        favBtn.style.color = '#e8664a';
        favBtn.style.borderColor = 'rgba(232,102,74,0.5)';
      } else {
        favBtn.classList.remove('active');
        favBtn.style.color = 'rgba(255,255,255,0.7)';
        favBtn.style.borderColor = 'rgba(255,255,255,0.3)';
      }
    }

    if (planBtn) {
      e.stopPropagation();
      pid = planBtn.dataset.pid;
      isTv = planBtn.dataset.istv === 'true';
      parsed = parsePid(pid);
      await togglePlanned(parsed.id, isTv);
      var planned = await getPlanned();
      if (planned.includes(pid)) {
        planBtn.classList.add('active');
        planBtn.style.color = '#4fa8e8';
        planBtn.style.borderColor = 'rgba(79,168,232,0.5)';
      } else {
        planBtn.classList.remove('active');
        planBtn.style.color = 'rgba(255,255,255,0.7)';
        planBtn.style.borderColor = 'rgba(255,255,255,0.3)';
      }
    }
  });
}

/* -- AUTH EVENT BINDING -- */
function initAuthEvents() {
  var authButton = document.getElementById('authButton');
  var authClose = document.getElementById('authClose');
  var modalToggle = document.getElementById('modalToggle');
  var modalSubmit = document.getElementById('modalSubmit');

  if (authButton) authButton.addEventListener('click', function() { openAuthModal('login'); });
  if (authClose) authClose.addEventListener('click', closeAuthModal);

  if (modalToggle) {
    modalToggle.addEventListener('click', function() {
      openAuthModal(modalMode === 'login' ? 'register' : 'login');
    });
  }

  if (modalSubmit) {
    modalSubmit.addEventListener('click', async function() {
      var modalUser = document.getElementById('modalUser');
      var modalPass = document.getElementById('modalPass');
      var authMsgEl = document.getElementById('authMsg');
      var u = modalUser.value.trim();
      var p = modalPass.value;
      if (!u || !p) { authMsgEl.textContent = 'Podaj nazwe i haslo'; return; }
      try {
        var action = modalMode === 'login' ? 'login' : 'register';
        var data = await localLoginFetch({ action: action, username: u, password: p });
        if (data.ok) {
          state.currentUser = { username: u };
          saveAuthToStorage(state.currentUser);
          updateAuthUI();
          closeAuthModal();
          showToast(modalMode === 'login' ? 'Zalogowano pomyslnie' : 'Konto utworzone');
          favCache = null;
          plannedCache = null;
          await renderFavorites();
        } else {
          authMsgEl.textContent = data.error || 'Blad logowania';
        }
      } catch (e) { authMsgEl.textContent = 'Blad sieci'; }
    });
  }

  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function() {
      state.currentUser = null;
      try { localStorage.removeItem(CONFIG.AUTH_KEY); } catch (e) {}
      favCache = null;
      plannedCache = null;
      updateAuthUI();
      renderFavorites();
      showToast('Wylogowano');
    });
  }
}

/* -- KEYBOARD -- */
function initKeyboard() {
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var authModal = document.getElementById('authModal');
      if (authModal && authModal.style.display === 'flex') { closeAuthModal(); return; }
      var tvModal = document.getElementById('tvPlayerModal');
      if (tvModal && tvModal.style.display === 'flex') { closeTvChannel(); return; }
    }
  });
}

/* -- MOBILE SIDEBAR -- */
function initMobileMenu() {
  var menuBtn = document.getElementById('mobileMenuBtn');
  var overlay = document.getElementById('mobileOverlay');
  if (menuBtn) {
    menuBtn.addEventListener('click', function() {
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) closeSidebar();
      else openSidebar();
    });
  }
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

/* -- TV PLAYER -- */
function initTvPlayer() {
  var closeBtn = document.getElementById('closeTvBtn');
  var modal = document.getElementById('tvPlayerModal');
  if (closeBtn) closeBtn.addEventListener('click', closeTvChannel);
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target.id === 'tvPlayerModal') closeTvChannel();
    });
  }
}

/* -- BACK TO HOME -- */
function initBackToHome() {
  var backBtn = document.getElementById('backToHome');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      hideCategoryView();
      renderAll();
    });
  }
}

/* -- INIT -- */
document.addEventListener('DOMContentLoaded', function() {
  initTabs();
  initSearch();
  initEventDelegation();
  initAuthEvents();
  initKeyboard();
  initMobileMenu();
  initTvPlayer();
  initBackToHome();
  initScrollToTop();

  var storedAuth = loadAuthFromStorage();
  if (storedAuth && storedAuth.username) state.currentUser = storedAuth;
  updateAuthUI();
  renderFavorites();
  loadAll();
});
