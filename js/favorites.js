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
