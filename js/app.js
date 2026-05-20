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
