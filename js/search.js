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
