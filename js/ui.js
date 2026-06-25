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
