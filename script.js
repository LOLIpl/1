const form = document.getElementById("addMovieForm");
const gallery = document.getElementById("movieGallery");
const player = document.getElementById("videoPlayer");
const playerContainer = document.getElementById("playerContainer");
const playerTitle = document.getElementById("playerTitle");

form.addEventListener("submit", function (e) {
  e.preventDefault();
  const title = document.getElementById("title").value.trim();
  const videoUrl = document.getElementById("videoUrl").value.trim();
  const thumbnailUrl = document.getElementById("thumbnailUrl").value.trim();

  if (!title || !videoUrl || !thumbnailUrl) {
    alert("Wypełnij wszystkie pola!");
    return;
  }

  const movie = { title, videoUrl, thumbnailUrl };
  const movies = JSON.parse(localStorage.getItem("movies") || "[]");
  movies.push(movie);
  localStorage.setItem("movies", JSON.stringify(movies));

  form.reset();
  loadMovies();
});

function loadMovies() {
  gallery.innerHTML = "";
  const movies = JSON.parse(localStorage.getItem("movies") || "[]");

  if (movies.length === 0) {
    gallery.innerHTML = "<p>Brak zapisanych filmów.</p>";
    return;
  }

  movies.forEach((movie, index) => {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = movie.thumbnailUrl;

    const body = document.createElement("div");
    body.className = "card-body";

    const title = document.createElement("h3");
    title.textContent = movie.title;

    const playBtn = document.createElement("button");
    playBtn.textContent = "▶ Odtwórz";
    playBtn.onclick = () => playMovie(movie);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑 Usuń";
    deleteBtn.onclick = () => deleteMovie(index);

    body.appendChild(title);
    body.appendChild(playBtn);
    body.appendChild(deleteBtn);
    card.appendChild(img);
    card.appendChild(body);

    gallery.appendChild(card);
  });
}

function playMovie(movie) {
  player.src = movie.videoUrl;
  playerTitle.textContent = "🎬 " + movie.title;
  playerContainer.style.display = "flex";
  player.play().catch(err => {
    alert("Nie udało się odtworzyć filmu.");
    console.error(err);
  });
}

function closePlayer() {
  player.pause();
  playerContainer.style.display = "none";
}

function deleteMovie(index) {
  const movies = JSON.parse(localStorage.getItem("movies") || "[]");
  movies.splice(index, 1);
  localStorage.setItem("movies", JSON.stringify(movies));
  loadMovies();
}

loadMovies();
