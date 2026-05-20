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
  const res = await fetch(url);
  if (!res.ok) return { item, tmdb: null };
  const data = await res.json();
  const first = data.results?.[0] || null;
  if (first) {
    await tmdbCacheSet(cacheKey, first);
  }
  return { item, tmdb: first };
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

  // Replace poster with smaller size for items that already have it
  results.forEach(r => {
    if (r.status === "fulfilled" && r.value.item && r.value.tmdb?.poster_path) {
      r.value.item.poster = "https://image.tmdb.org/t/p/w342" + r.value.tmdb.poster_path;
    }
  });
}
