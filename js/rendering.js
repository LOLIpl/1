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
