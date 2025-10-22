/* ================================
   CORE: constants, images, utils
==================================*/
const API_KEY = "b3b7be8927fa9aaa0801f00983c0fb94";
const BASE    = "https://api.themoviedb.org/3";

const IMG = {
  poster:   p => (p ? "https://image.tmdb.org/t/p/w342" + p : ""),
  backdrop: p => (p ? "https://image.tmdb.org/t/p/w780" + p : ""),
  profile:  p => (p ? "https://image.tmdb.org/t/p/w185" + p : "")
};

const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const yearOf = s => (typeof s === "string" && s.length >= 4 ? s.slice(0,4) : "");

// fetch and parse JSON with optional params
async function fetchJSON(path, params={}) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("api_key", API_KEY);
  for (const [k,v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(res.status + " " + res.statusText);
    }
    return await res.json();
  } catch (err) {
    console.error("fetchJSON error:", err);
    return null;
  }
}

/* ================================
   GENERIC LIST RENDERER (single copy)
==================================*/
function renderList(gridEl, items, buildCard, {
  emptyHTML = '<p style="padding:12px;color:#b00020;">No results.</p>',
} = {}) {
  if (!gridEl) return;
  gridEl.textContent = ""; // clear
  if (!Array.isArray(items) || items.length === 0) {
    gridEl.innerHTML = emptyHTML;
    return;
  }
  const frag = document.createDocumentFragment();
  for (const item of items) {
    const node = buildCard(item);
    if (node) frag.appendChild(node);
  }
  gridEl.appendChild(frag);
}

/* ================================
   MOVIE CARD BUILDER
==================================*/
function buildMovieCard(m){
  const title  = (typeof m.title === "string" && m.title) || (typeof m.name === "string" && m.name) || "Untitled";
  const y      = yearOf(m.release_date || m.first_air_date || "");
  const rating = (typeof m.vote_average === "number" && m.vote_average > 0)
    ? (Math.round(m.vote_average * 10) / 10).toFixed(1) + "★"
    : "—";

  const card = document.createElement("article");
  card.className = "trend-card";

  const poster = document.createElement("img");
  poster.className = "poster";
  poster.alt = "Poster for " + title;
  const url = IMG.poster(m.poster_path);
  if (url) poster.src = url; else poster.style.display = "none";

  const meta = document.createElement("div");
  meta.className = "meta";

  const t = document.createElement("div");
  t.className = "title";
  t.textContent = title;

  const sub = document.createElement("div");
  sub.className = "subtext";
  sub.textContent = [y, rating].filter(Boolean).join(" • ");

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cardDetails";
  btn.textContent = "See Details";
  btn.addEventListener("click", () => Details.open(m.id));

  meta.append(t, sub, btn);
  card.append(poster, meta);
  return card;
}

/* ================================
   PANEL SHOW (choose-one state)
==================================*/
function showPanel(panelId){
  document.querySelectorAll('[role="tabpanel"]').forEach(p => {
    const willHide = (p.id !== panelId);
    // if we're hiding the Genres panel, reset its content
    if (p.id === 'Genres' && willHide) {
      const g1 = document.getElementById('list-genres');
      const g2 = document.getElementById('genreSpecificGrid');
      if (g1) g1.textContent = '';
      if (g2) g2.textContent = '';
    }
    p.hidden = willHide;
  });

  document.querySelectorAll('.tabs [role="tab"]').forEach(btn => {
    const isActive = btn.getAttribute('aria-controls') === panelId;
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

let currentPanel = null;

/* ================================
   TRENDING RENDERER
==================================*/
async function renderTrendingTab(){
  currentPanel = 'Trending';
  showPanel('Trending'); // make it visible immediately

  const grid = document.getElementById('list-trending');
  if (!grid) return;

  // Lazy-load once: if already filled, skip fetch
  if (grid.childElementCount > 0) return;

  const json = await fetchJSON('trending/movie/week');
  const list = Array.isArray(json?.results) ? json.results : [];

  // If user switched tabs during fetch, abort painting
  if (currentPanel !== 'Trending') return;

  renderList(grid, list, buildMovieCard, {
    emptyHTML: '<p style="padding:12px;color:#b00020;">Failed to load trending movies.</p>'
  });
}

/* ================================
   GENRES RENDERER
==================================*/
async function renderGenresTab() {
  currentPanel = 'Genres';
  showPanel('Genres');

  const grid = document.getElementById('list-genres');

  const json = await fetchJSON('genre/movie/list');
  const genres = Array.isArray(json?.genres) ? json.genres : [];

  const frag = document.createDocumentFragment();
  for (const g of genres) {
    const card = document.createElement('div');
    card.className = 'genre-card';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'genre-chip';
    btn.textContent = g.name;
    btn.dataset.genreId = String(g.id); // keep id for later

    btn.addEventListener('click', () => renderMoviesByGenre(g.id, g.name));

    card.appendChild(btn);
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

async function renderMoviesByGenre(id, name){
  const json = await fetchJSON('discover/movie', {
    with_genres: String(id),  
    include_adult: 'false',
    language: 'en-US',
    sort_by: 'popularity.desc',
    page: '1'
  });
  const genreGrid = document.getElementById('genreSpecificGrid');
  const movies = Array.isArray(json?.results) ? json.results : [];

  for(const movie of movies){
    renderList(genreGrid, movies, buildMovieCard,{
        emptyHTML: '<p style="padding:12px;color:#b00020;">Failed to load trending movies.</p>'
    });
  }
}

/* ================================
   DETAILS PANEL
==================================*/
const Details = (() => {
  const $panel    = $("#details-panel");
  const $backdrop = $("#backdrop");
  const $row      = $("#row");
  const $genres   = $("#genres");
  const $overview = $("#overview");
  const $castGrid = $("#cast-grid");

  function close(){
    $panel.style.display = "none";
    $backdrop.removeAttribute("src");
    $row.innerHTML = "";
    $genres.innerHTML = "";
    $overview.textContent = "";
    $castGrid.innerHTML = "";
  }

  async function open(id){
    $panel.style.display = "block";

    const [data, credits] = await Promise.all([
      fetchJSON(`movie/${id}`),
      fetchJSON(`movie/${id}/credits`)
    ]);

    if (!data){
      $row.innerHTML = `<h2 class="detailsTitle">Details unavailable</h2>`;
      return;
    }

    // Backdrop
    if (data.backdrop_path) $backdrop.src = IMG.backdrop(data.backdrop_path);
    else $backdrop.removeAttribute("src");

    // Title row
    const title = data.title || "Untitled";
    const year  = yearOf(data.release_date || "");
    const stats = [
      data.runtime ? `${data.runtime}m` : null,
      typeof data.vote_average === "number" ? `${(Math.round(data.vote_average * 10) / 10).toFixed(1)}★` : null,
      data.original_language ? data.original_language.toUpperCase() : null
    ].filter(Boolean).join(" ● ");

    $row.innerHTML = `
      <h2 class="detailsTitle">${title}${year ? ` (${year})` : ""}</h2>
      <div class="subtext">${stats}</div>
    `;

    // Genres + overview
    $genres.innerHTML = (data.genres || []).map(g => `<span class="chip">${g.name}</span>`).join("");
    $overview.textContent = data.overview || "No overview available";

    // Cast grid
    const topCast = (credits?.cast || []).slice(0, 10);
    $castGrid.innerHTML = topCast.map(c => `
      <div class="cast-card">
        <img class="cast-img" alt="${c.name}" src="${IMG.profile(c.profile_path)}" onerror="this.style.display='none'">
        <div>
          <div class="cast-name">${c.name}</div>
          <div class="sub">${c.character || ""}</div>
        </div>
      </div>
    `).join("");
  }

  return { open, close };
})();

$(".close-details").addEventListener("click", () => Details.close());

/* ================================
   SEARCH 
==================================*/
const $q = $("#q");
const $searchBtn = $("#searchBtn");

async function searchMovies(query){
  const json = await fetchJSON("search/movie", { query, include_adult: "false", page: "1" });
  const results = Array.isArray(json?.results) ? json.results : [];

  // label & render
  $("#q-label").textContent = query;
  const grid = $("#list-search");
  renderList(grid, results, buildMovieCard, {
    emptyHTML: `<p style="padding:12px;color:#b00020;">No results for “${query}”.</p>`
  });

  // show Search results panel
  currentPanel = 'Search';
  showPanel("Search");
}

function onSearchSubmit(){
  const query = $q.value.trim();
  if (!query){
    // empty query → bounce back to Trending
    currentPanel = 'Trending';
    renderTrendingTab();
    return;
  }
  searchMovies(query);
}

$searchBtn.addEventListener("click", onSearchSubmit);
$q.addEventListener("keydown", (e) => { if (e.key === "Enter") onSearchSubmit(); });

/* ================================
   SIMPLE TAB CLICK HANDLERS
==================================*/
document.getElementById('tab-Trending')?.addEventListener('click', () => {
  currentPanel = 'Trending';
  renderTrendingTab();
  
});

document.getElementById('tab-Genres')?.addEventListener('click', () => {
  currentPanel = 'Genres';
  renderGenresTab();
});

document.getElementById('tab-About')?.addEventListener('click', () => {
  currentPanel = 'About';
  showPanel('About');
});

/* ================================
   BOOT
==================================*/
currentPanel = 'Trending';
renderTrendingTab();
