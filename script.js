// --- CONFIGURATION ---
const WORKER_URL = 'https://streamex-server.snahasishdey141.workers.dev';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';

// --- GLOBAL VARIABLES ---
let currentUser = null;
let appSettings = { theme: 'dark', lang: 'en', region: 'IN', adult: 'false' };
let currentSlide = 0;
let slideInterval;
let playerState = { id: null, type: null, season: 1, episode: 1, anilistId: null, isAnime: false };
let seasonData = [];
let episodeView = 'list';
let navState = { view: 'home', query: null };

const prefetchedData = {};

async function prefetchEndpoint(endpoint) {
    if (prefetchedData[endpoint]) return;

    try {
        const data = await fetchAPI(endpoint);
        prefetchedData[endpoint] = data;
    } catch (e) { }
}

const activeScrollHandlers = {};


// --- SERVERS (UPDATED FOR WORKER) ---
const servers = [
    // --- ANIME SERVERS (Require Anilist ID) ---
    { name: "StreameX Anime", isAnime: true, key: "Streamrip", useSandbox: false },
    { name: "FilmU", isAnime: true, key: "FilmU", useSandbox: false },
    { name: "VidNest (Sub)", isAnime: true, key: "vidnest_anime_sub", useSandbox: false },
    { name: "VidNest (Dub)", isAnime: true, key: "vidnest_anime_dub", useSandbox: false },
    { name: "Anime (Sub)", isAnime: true, key: "animepahe_sub", useSandbox: false },
    { name: "Anime (Dub)", isAnime: true, key: "animepahe_dub", useSandbox: false },
    { name: "VidLink (Sub)", isAnime: true, key: "vidlink_anime_sub", useSandbox: false },
    { name: "VidLink (Dub)", isAnime: true, key: "vidlink_anime_dub", useSandbox: false },
    { name: "Megaplay", isAnime: true, key: "megaplay_anime_sub", useSandbox: false },

    // --- MOVIE/TV SERVERS (Use TMDB ID) ---
    { name: "StreameX", key: "streamex", useSandbox: false },
    { name: "Server1", key: "fastserver", useSandbox: false },
    { name: "Server2", key: "multiserver", useSandbox: true },
    { name: "VidSrc", key: "vidsrc", useSandbox: false },
    { name: "Server4", key: "server5", useSandbox: false },       // Maps to PrimeSrc in worker
    { name: "Vidpro", key: "vidpro", useSandbox: false },        // Maps to VidKing in worker
    { name: "Stream", key: "cstream", useSandbox: false },
    { name: "king", key: "vidking_direct", useSandbox: false }, // Maps to VidRock in worker
    { name: "pro", key: "vidlink_standard", useSandbox: false },
    { name: "New", key: "Nhd", useSandbox: false },
    { name: "Modern", key: "modern", useSandbox: false },
    { name: "Scape", key: "screenscape", useSandbox: false },
    { name: "Modiplay", key: "modiplay", useSandbox: false },
    { name: "Smart", key: "smart", useSandbox: false },
    { name: "nest", key: "vidnest_standard", useSandbox: false },
    { name: "letest", key: "nontongo", useSandbox: false },
    { name: "Api1", key: "Multi_server", useSandbox: false },
    { name: "Multilang", key: "Multi_lang", useSandbox: false },
    { name: "Premium", key: "Premium", useSandbox: false },
    { name: "MovieApi", key: "MoviesApi", useSandbox: false },
    { name: "EmbedApi", key: "EmbedApi", useSandbox: false },
    { name: "Vidapi", key: "Vidapi", useSandbox: false },
    { name: "NextGen", key: "NextGen", useSandbox: false },
    { name: "Streamrip", key: "Streamrip_Movie", useSandbox: false },
    { name: "FilmU", key: "FilmU_Movie", useSandbox: false },
    { name: "Vidcore", key: "vidcore", useSandbox: false },
    { name: "Vipembed", key: "2embed", useSandbox: false },

];

// --- NEW HELPER: FETCH ANILIST ID ---
async function fetchAnilistId(title, season = 1) {
    // If season > 1, append it to search (e.g. "Naruto Season 2") because Anilist separates seasons
    const searchQuery = season > 1 ? `${title} Season ${season}` : title;

    const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
        }
      }
    }
    `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                query: query,
                variables: { search: searchQuery }
            })
        });

        const data = await response.json();
        if (data.data && data.data.Media) {
            console.log(`[Anilist] Found ID: ${data.data.Media.id} for "${searchQuery}"`);
            return data.data.Media.id;
        }
    } catch (e) {
        console.error("[Anilist] Fetch Failed:", e);
    }
    return null;
}

// Use DOMContentLoaded instead of window.onload so it runs instantly
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    applyTheme();

    // 1. ROUTE IMMEDIATELY - Don't wait for anything else!
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');

    if (type && id) {
        openPlayer(id, type, true);
    } else {
        router('home');
    }

    // 2. Fetch settings in the background WITHOUT 'await' blocking the UI
    populateSettingsAPI().catch(error => {
        console.error("Settings API Error:", error);
        addFallbackSettings();
    });
});

// --- BROWSER BACK BUTTON LISTENER ---
// Move this outside to run immediately
window.addEventListener('popstate', (event) => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');

    if (type && id) {
        openPlayer(id, type, true);
    } else {
        restoreLastState();
    }
});

// --- DATABASE LOGIC ---
function toggleLib(key, id, type, title, poster) {
    let list = getLib(key);

    if (list.find(i => i.id == id)) {
        list = list.filter(i => i.id != id);
        if (key === 'watchlist') showToast("Removed from Watchlist");
    } else {
        list.unshift({ id, type, title, poster, savedAt: Date.now() });
        if (key === 'watchlist') showToast("Saved to Watchlist");
    }
    saveLib(key, list);
}

async function renderLibrary(containerId, key) {
    const container = document.getElementById(containerId);
    if (!container) return;

    showSkeletons(containerId, 6);

    let list = getLib(key) || [];

    if (key === 'history') {
        list = [...list].reverse();
    }

    renderGrid(list, containerId, null);
}


// --- SETTINGS LOGIC ---
async function populateSettingsAPI() {
    const langSelect = document.getElementById('set-lang');
    const regionSelect = document.getElementById('set-region');
    if (!langSelect || !regionSelect) return;
    const langs = await fetchAPI('/configuration/languages');
    if (Array.isArray(langs)) {
        langs.sort((a, b) => a.english_name.localeCompare(b.english_name));
        langSelect.innerHTML = '';
        langs.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.iso_639_1;
            opt.innerText = l.english_name;
            langSelect.appendChild(opt);
        });
    }
    const countries = await fetchAPI('/configuration/countries');
    if (Array.isArray(countries)) {
        countries.sort((a, b) => a.english_name.localeCompare(b.english_name));
        regionSelect.innerHTML = '';
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.iso_3166_1;
            opt.innerText = c.english_name;
            regionSelect.appendChild(opt);
        });
    }
    langSelect.value = appSettings.lang || 'en';
    regionSelect.value = appSettings.region || 'IN';
}

function addFallbackSettings() {
    const langSelect = document.getElementById('set-lang');
    if (langSelect) langSelect.innerHTML = '<option value="en">English</option>';
    const regionSelect = document.getElementById('set-region');
    if (regionSelect) regionSelect.innerHTML = '<option value="IN">India</option><option value="US">USA</option>';
}

function loadSettings() {
    const saved = localStorage.getItem('streamex_settings');
    if (saved) appSettings = JSON.parse(saved);
    const themeEl = document.getElementById('set-theme');
    if (themeEl) themeEl.value = appSettings.theme;
    const adultEl = document.getElementById('set-adult');
    if (adultEl) adultEl.value = appSettings.adult;
}

function saveSettings() {
    appSettings.theme = document.getElementById('set-theme').value;
    appSettings.lang = document.getElementById('set-lang').value;
    appSettings.region = document.getElementById('set-region').value;
    appSettings.adult = document.getElementById('set-adult').value;
    localStorage.setItem('streamex_settings', JSON.stringify(appSettings));
    location.reload();
}

function applyTheme() {
    if (appSettings.theme === 'light') document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
}

// --- ROUTING ---
function router(viewName) {
    // 1. Clean URL (remove ?id=...)
    if (window.location.search.length > 0) {
        window.history.pushState({}, '', window.location.pathname);
    }

    // 2. TRACK HISTORY 
    if (viewName !== 'player') {
        navState.view = viewName;
        if (viewName !== 'movies' && viewName !== 'mobile-search' && viewName !== 'search') {
            navState.query = null;
        }
    }

    // Clear desktop search box when navigating to another page
    if (viewName !== 'search' && viewName !== 'mobile-search' && viewName !== 'player') {
        const desktopSearch = document.querySelector('.search-input:not(#mobile-search-input)');
        if (desktopSearch) desktopSearch.value = '';
    }

    // 3. Update UI & HIGHLIGHT ACTIVE MENU
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        // Check if this sidebar item matches the current view
        if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(`router('${viewName}')`)) {
            el.classList.add('active');
        }
    });

    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.b-nav-item').forEach(el => el.classList.remove('active'));

    if (viewName !== 'player') {
        document.getElementById('iframe-box').innerHTML = '';
    }

    if (viewName === 'home') {
        document.querySelectorAll('.b-nav-item')[0]?.classList.add('active');
        loadHome();
    } else if (viewName === 'mobile-search') {
        document.querySelectorAll('.b-nav-item')[1]?.classList.add('active');
    } else {
        document.querySelectorAll('.b-nav-item')[2]?.classList.add('active');
        document.querySelector('.main-content').scrollTop = 0;
        if (viewName === 'movies') loadMoviesPage();
        if (viewName === 'tv') loadTVPage();
        if (viewName === 'anime') loadAnimePage();
        if (viewName === 'watchlist') renderLibrary('watchlist-grid', 'watchlist');
        if (viewName === 'history') renderLibrary('history-grid', 'history');
    }
}

// --- API HELPER ---
async function fetchAPI(endpoint) {
    // 1. Check local memory first (Fastest)
    if (prefetchedData[endpoint]) {
        return prefetchedData[endpoint];
    }

    // 2. Check Browser Session Storage (Survives page reloads)
    const cacheKey = 'tmdb_' + endpoint;
    const cachedStr = sessionStorage.getItem(cacheKey);
    if (cachedStr) {
        const cachedData = JSON.parse(cachedStr);
        prefetchedData[endpoint] = cachedData; // Put back in memory
        return cachedData;
    }

    // 3. If not cached, fetch from your Cloudflare Worker
    const res = await fetch(
        `https://streamex-proxy.snahasishdey141.workers.dev/?endpoint=${encodeURIComponent(endpoint)}`
    );
    const data = await res.json();

    // 4. Save the result so we don't hit the worker again this session
    prefetchedData[endpoint] = data;
    try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
        console.warn("Session storage full");
    }

    return data;
}


// --- HOME & CATEGORIES ---
async function refreshHomeHistory() {
    const continueSection = document.getElementById('continue-watching-section');
    if (!continueSection) return;

    let historyList = getLib('history') || [];

    if (historyList.length > 0) {
        historyList.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

        continueSection.style.display = 'block';
        renderGrid(historyList.slice(0, 4), 'home-history');
    } else {
        continueSection.style.display = 'none';
    }
}


async function loadHome() {
    showSkeletons('hero-slider', 1); showSkeletons('home-bollywood', 6); showSkeletons('home-hollywood', 6); showSkeletons('home-tv', 6);
    const continueSection = document.getElementById('continue-watching-section');
    if (continueSection) { continueSection.style.display = 'block'; showSkeletons('home-history', 4); }
    const today = new Date().toISOString().split('T')[0];
    const currentRegion = appSettings.region || 'IN';
    const regionSelect = document.getElementById('set-region');
    let regionName = "Local";
    if (regionSelect && regionSelect.selectedIndex > -1) regionName = regionSelect.options[regionSelect.selectedIndex].text;
    const titleEl = document.getElementById('local-title');
    if (titleEl) titleEl.innerText = `Latest ${regionName} Movies`;
    const hTitle = document.getElementById('hollywood-title');
    if (hTitle) hTitle.innerText = (currentRegion !== 'US') ? "Latest Hollywood" : "Trending Worldwide";
    let localQuery;

    if (currentRegion === "IN") {
        // True Bollywood (Hindi)
        localQuery = `/discover/movie?with_original_language=hi&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&vote_count.gte=5`;
    } else {
        // Other regions still use origin country
        localQuery = `/discover/movie?with_origin_country=${currentRegion}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&vote_count.gte=5`;
    }
    const hollyQuery = currentRegion !== 'US' ? `/discover/movie?with_origin_country=US&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&vote_count.gte=5` : '/movie/trending/week';
    // 1. FETCH AND RENDER THE SLIDER FIRST (Crucial for LCP)
    try {
        const trending = await fetchAPI('/trending/all/week');
        let slides = [];
        if (trending && trending.results) {
            slides = trending.results.filter(item => item.backdrop_path).slice(0, 5);
        }
        renderSlider(slides); // Paint the slider to the screen instantly!
    } catch (error) {
        console.error("Slider Load Error:", error);
    }

    // 2. FETCH THE REST OF THE GRIDS AFTERWARD
    try {
        const [localMovies, hollyData, tvShows] = await Promise.all([
            fetchAPI(localQuery),
            fetchAPI(hollyQuery),
            fetchAPI('/trending/tv/week')
        ]);

        renderGrid(localMovies ? localMovies.results : [], 'home-bollywood');
        renderGrid(hollyData ? hollyData.results : [], 'home-hollywood');
        renderGrid(tvShows ? tvShows.results : [], 'home-tv', 'tv');

        // Background Prefetching for other pages
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                prefetchEndpoint('/movie/popular');
                prefetchEndpoint('/tv/top_rated');
                prefetchEndpoint('/discover/tv?with_genres=16&with_origin_country=JP');
            });
        } else {
            setTimeout(() => {
                prefetchEndpoint('/movie/popular');
                prefetchEndpoint('/tv/top_rated');
                prefetchEndpoint('/discover/tv?with_genres=16&with_origin_country=JP');
            }, 2000);
        }
    } catch (error) {
        console.error("Home Data Load Error:", error);
    }
    await refreshHomeHistory();
}

function renderSlider(items) {
    const container = document.getElementById('hero-slider');
    if (!container) return;
    container.innerHTML = '';
    items.forEach((item, index) => {
        if (!item) return;
        const type = item.media_type || (item.name ? 'tv' : 'movie');
        const title = item.title || item.name;
        const activeClass = index === 0 ? 'active' : '';
        let bg = '';
        if (item.backdrop_path) {
            bg = `https://wsrv.nl/?url=image.tmdb.org/t/p/w1280${item.backdrop_path}&output=webp`;

            // Preload the very first slider image as ultra-high priority
            if (index === 0) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = bg;
                link.imageSrcset = `${bg}`;
                link.setAttribute('fetchpriority', 'high');
                document.head.appendChild(link);
            }
        }
        const slide = document.createElement('div');
        slide.className = `slide ${activeClass}`;
        slide.style.backgroundImage = `url(${bg})`;
        slide.innerHTML = `<div class="hero-content"><div style="margin-bottom:10px;"><span style="background:var(--accent); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:12px;">#${index + 1} Spotlight</span></div><div class="hero-title">${title}</div><div class="hero-desc">${item.overview || ''}</div><button class="btn btn-primary" onclick="openPlayer('${item.id}', '${type}')"><i class="fas fa-play"></i> Watch Now</button></div>`;
        container.appendChild(slide);
    });
    if (slideInterval) clearInterval(slideInterval);
    const slides = document.querySelectorAll('.slide');
    currentSlide = 0;
    slideInterval = setInterval(() => {
        if (slides.length > 0) {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }
    }, 5000);
}

async function loadMoviesPage() { showSkeletons('movies-popular', 6); showSkeletons('movies-top', 6); showSkeletons('movies-action', 6); const [popular, topRated, action] = await Promise.all([fetchAPI('/movie/popular'), fetchAPI('/movie/top_rated'), fetchAPI('/discover/movie?with_genres=28')]); renderGrid(popular.results, 'movies-popular', 'movie'); renderGrid(topRated.results, 'movies-top', 'movie'); renderGrid(action.results, 'movies-action', 'movie'); }
async function loadTVPage() { showSkeletons('tv-airing', 6); showSkeletons('tv-top', 6); const [trending, popular] = await Promise.all([fetchAPI('/tv/on_the_air'), fetchAPI('/tv/top_rated')]); renderGrid(trending.results, 'tv-airing', 'tv'); renderGrid(popular.results, 'tv-top', 'tv'); }
async function loadAnimePage() { showSkeletons('anime-trending', 6); showSkeletons('anime-popular', 6); const [trending, popular] = await Promise.all([fetchAPI('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc'), fetchAPI('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=vote_count.desc')]); renderGrid(trending.results, 'anime-trending', 'tv'); renderGrid(popular.results, 'anime-popular', 'tv'); }

function renderGrid(items, containerId, forceType) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML =
            '<div style="color:#666; padding:20px;">No content found.</div>';
        return;
    }

    let visibleCount = 20;
    let currentIndex = 0;

    function renderBatch() {
        const slice = items.slice(currentIndex, currentIndex + visibleCount);

        slice.forEach(item => {
            const posterPath = item.poster_path || item.poster;
            if (!posterPath) return;

            const type =
                item.type ||
                forceType ||
                item.media_type ||
                (item.name ? "tv" : "movie");

            const title = item.title || item.name;
            const dateStr = item.release_date || item.first_air_date || "";
            const year = dateStr ? dateStr.substring(0, 4) : "";

            const card = document.createElement("div");
            card.className = "media-card";
            card.onclick = () => openPlayer(item.id, type);

            const ratingTag = item.vote_average
                ? `<div class="card-rating">${item.vote_average.toFixed(1)}</div>`
                : "";

            // Smart Responsive & Next-Gen WebP Sizing
            const isExternal = posterPath.startsWith("http");

            // Wrap TMDB URLs in the wsrv.nl proxy to force WebP conversion
            const imgUrlSmall = isExternal ? posterPath : `https://wsrv.nl/?url=image.tmdb.org/t/p/w185${posterPath}&output=webp&q=70`;
            const imgUrlMedium = isExternal ? posterPath : `https://wsrv.nl/?url=image.tmdb.org/t/p/w342${posterPath}&output=webp&q=70`;

            card.innerHTML = `
        <div class="poster">
          <img 
            src="${imgUrlSmall}" 
            srcset="${imgUrlSmall} 185w, ${imgUrlMedium} 342w"
            sizes="(max-width: 768px) 110px, 150px"
            loading="lazy" 
            alt="${title}" 
            onerror="this.style.display='none'">
          ${ratingTag}
          <div class="hover-overlay">
            <i class="fas fa-play-circle play-icon"></i>
          </div>
        </div>
        <div class="media-title">${title}</div>
        <div class="media-year">${year} ${type === "tv" ? "• TV" : ""
                }</div>
      `;

            container.appendChild(card);
        });

        currentIndex += visibleCount;
    }

    renderBatch();

    // Remove the old listener for this specific container if it exists
    if (activeScrollHandlers[containerId]) {
        window.removeEventListener("scroll", activeScrollHandlers[containerId]);
    }

    function handleScroll() {
        // Only trigger if this view is actually active, and we are near the bottom
        if (container.closest('.page-view')?.classList.contains('active') || containerId === 'search-res' || containerId === 'mobile-search-results') {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
                // If we've shown all items, stop listening to save performance
                if (currentIndex >= items.length) {
                    window.removeEventListener("scroll", handleScroll);
                    delete activeScrollHandlers[containerId];
                    return;
                }
                renderBatch();
            }
        }
    }
    activeScrollHandlers[containerId] = handleScroll;
    window.addEventListener("scroll", handleScroll, { passive: true });
}

// --- player---
async function openPlayer(id, type, skipPush = false) {
    // 1. Initialize Default State
    let preferredServer = -1;
    // Reset player state completely
    playerState = { id, type, season: 1, episode: 1, anilistId: null, isAnime: false };

    // 2. CHECK HISTORY (LOCAL ONLY)
    let savedState = getLib('history')?.find(i => i.id == id);

    // 3. RESTORE PROGRESS (If found)
    if (savedState) {
        if (type === 'tv') {
            playerState.season = savedState.season || 1;
            playerState.episode = savedState.episode || 1;
            if (playerState.season > 1 || playerState.episode > 1) {
                showToast(`Resumed: S${playerState.season} E${playerState.episode}`, 'info');
            }
        }
        if (savedState.serverIdx !== undefined) {
            preferredServer = savedState.serverIdx;
        }
    }

    // 4. UI Setup & Navigation History Logic
    if (!document.getElementById('view-player').classList.contains('active')) {
        // Only save state if we are entering from outside
    }

    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-player').classList.add('active');
    window.scrollTo(0, 0);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    if (!skipPush) {
        const newUrl = `?type=${type}&id=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
    document.getElementById('iframe-box').innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center;"><i class="fas fa-spinner fa-spin" style="font-size:40px;"></i></div>';

    // 5. Fetch Details from API
    const data = await fetchAPI(`/${type}/${id}`);

    const title = data.title || data.name;
    const desc = data.overview;
    const poster = data.poster_path ? IMG_URL + data.poster_path : '';

    // --- ANIME DETECTION ---
    // --- IMPROVED ANIME DETECTION ---
    const isTV = type === 'tv';

    const isAnime =
        isTV &&
        (
            // Japanese origin
            (data.origin_country && data.origin_country.includes('JP')) ||

            // Japanese language
            data.original_language === 'ja'
        ) &&
        // Must be animation
        (data.genres && data.genres.some(g => g.id === 16));


    playerState.title = title;
    playerState.poster = poster;
    playerState.isAnime = isAnime;

    // --- SMART SERVER SELECTION ---
    if (preferredServer === -1) {
        preferredServer = servers.findIndex(s => !!s.isAnime === isAnime);
        // Fallback: If no matching server found, use index 0 (but careful if 0 is anime and we are watching movie)
        if (preferredServer === -1) {
            // If we are watching non-anime, find first non-anime server
            if (!isAnime) preferredServer = servers.findIndex(s => !s.isAnime);
            // If we are watching anime, find first anime server
            else preferredServer = servers.findIndex(s => s.isAnime);

            // Absolute fallback
            if (preferredServer === -1) preferredServer = 0;
        }
    }

    // --- ANIME SPECIFIC LOGIC ---
    if (isAnime) {
        const targetSeason = playerState.season || 1;
        const anilistId = await fetchAnilistId(title, targetSeason);
        if (anilistId) {
            playerState.anilistId = anilistId;
        }
    }

    // --- UI RENDERING (Common for both) ---
    const year = (data.release_date || data.first_air_date || '').substring(0, 4);
    const genres = data.genres ? data.genres.map(g => g.name).slice(0, 2).join(', ') : '';
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';

    // Panels Setup
    const rightPanel = document.getElementById('episode-panel');
    const bottomDetails = document.querySelector('.media-details-box');
    if (rightPanel) rightPanel.innerHTML = '';
    if (bottomDetails) bottomDetails.innerHTML = '';

    if (type === 'movie') {
        if (rightPanel) {
            rightPanel.style.display = 'flex';
            const status = data.status || "Released";
            const studio = (data.production_companies && data.production_companies.length > 0) ? data.production_companies[0].name : "Unknown";
            const date = data.release_date || "N/A";

            rightPanel.innerHTML = `
                <div class="movie-sidebar">
                    <div class="movie-sidebar-header">
                        <img src="${poster}" class="sidebar-poster" alt="${title}">
                        <div class="sidebar-meta-info">
                            <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value">${status}</span></div>
                            <div class="meta-item"><span class="meta-label">Production</span><span class="meta-value">${studio}</span></div>
                            <div class="meta-item"><span class="meta-label">Aired</span><span class="meta-value">${date}</span></div>
                        </div>
                    </div>
                    <div class="movie-sidebar-body">
                        <h1>${title}</h1>
                        <div class="sidebar-badges">
                            <span class="badge-year">${year}</span>
                            <span class="badge-rating">${rating}</span>
                        </div>
                        <div class="sidebar-buttons">
                            <button class="s-btn s-btn-red" id="watchlist-btn-movie"><i class="far fa-heart"></i> Watchlist </button>
                            <button class="s-btn s-btn-green" onclick="downloadContent()"><i class="fas fa-download"></i> Download</button>
                            <button onclick="shareContent('${title.replace(/'/g, "\\'")}')" class="s-btn s-btn-gray"><i class="fas fa-share-alt"></i> Share</button>
                        </div>
                        <div class="sidebar-desc">${desc}</div>
                    </div>
                </div>
            `;
        }
        setTimeout(() => setupWatchlistBtn(id, 'watchlist-btn-movie', type, title, data.poster_path), 0);

    } else {
        if (rightPanel) {
            rightPanel.style.display = 'flex';
            rightPanel.innerHTML = `
                <div class="ep-header">
                    <select id="season-select" onchange="loadSeason(this.value)"></select>
                    <div class="view-toggles">
                        <i class="fas fa-list active" onclick="setEpView('list')"></i>
                        <i class="fas fa-th-large" onclick="setEpView('grid')"></i>
                    </div>
                </div>
                <div id="episode-list-box" class="ep-container list-view"></div>
            `;
        }
        if (bottomDetails) {
            // Extract TV specific data for the meta info box
            const tvStatus = data.status || "Airing";
            const tvNetwork = (data.networks && data.networks.length > 0) ? data.networks[0].name : "Unknown";
            const tvDate = data.first_air_date || "N/A";

            bottomDetails.innerHTML = `
                <div class="movie-sidebar tv-details-card">
                    <div class="movie-sidebar-header">
                        <img src="${poster}" class="sidebar-poster" alt="${title}">
                        <div class="sidebar-meta-info">
                            <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value">${tvStatus}</span></div>
                            <div class="meta-item"><span class="meta-label">Network</span><span class="meta-value">${tvNetwork}</span></div>
                            <div class="meta-item"><span class="meta-label">Aired</span><span class="meta-value">${tvDate}</span></div>
                        </div>
                    </div>
                    <div class="movie-sidebar-body">
                        <h1 style="margin-top: 15px;">${title}</h1>
                        <div class="sidebar-badges">
                            <span class="badge-year">${year}</span>
                            <span class="badge-rating">${rating}</span>
                            <span style="font-size: 13px; color: var(--text-muted); margin-left: 5px;">${genres}</span>
                        </div>
                        <div class="sidebar-buttons">
                            <button class="s-btn s-btn-red" id="watchlist-btn-tv"><i class="far fa-heart"></i> Watchlist </button>
                            <button class="s-btn s-btn-green" onclick="downloadContent()"><i class="fas fa-download"></i> Download</button>
                            <button onclick="shareContent('${title.replace(/'/g, "\\'")}')" class="s-btn s-btn-gray"><i class="fas fa-share-alt"></i> Share</button>
                        </div>
                        <div class="sidebar-desc">${desc}</div>
                    </div>
                </div>
            `;
        }
        setTimeout(() => setupWatchlistBtn(id, 'watchlist-btn-tv', type, title, data.poster_path), 0);

        const sSelect = document.getElementById('season-select');
        if (sSelect && data.seasons) {
            sSelect.innerHTML = '';
            data.seasons.forEach(s => {
                if (s.season_number > 0) {
                    const opt = document.createElement('option');
                    opt.value = s.season_number;
                    opt.innerText = s.name;
                    sSelect.appendChild(opt);
                }
            });
            sSelect.value = playerState.season;
        }

        await loadSeason(playerState.season);
        setTimeout(() => {
            const activeEp = document.querySelector('.ep-item.active');
            const box = document.getElementById('episode-list-box');
            if (activeEp && box) {
                const epTop = activeEp.getBoundingClientRect().top;
                const boxTop = box.getBoundingClientRect().top;
                box.scrollTo({
                    top: box.scrollTop + (epTop - boxTop) - (box.clientHeight / 2) + (activeEp.clientHeight / 2),
                    behavior: 'smooth'
                });
            }
        }, 300);
    }

    renderServers(preferredServer);
    loadVideo(preferredServer);

    // --- RECOMMENDATIONS (GUARANTEED TO RUN) ---
    // Fetch recommendations for EVERY type (movie/tv/anime)
    // --- RECOMMENDATIONS (FULLY FIXED FOR MOVIE / TV / ANIME) ---
    try {
        const recContainer = document.getElementById('player-recommendations');

        if (recContainer) {
            recContainer.innerHTML =
                '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading recommendations...</div>';
        }

        // Try recommendations first
        let recs = await fetchAPI(`/${type}/${id}/recommendations`);

        // If empty → fallback to similar
        if (!recs || !recs.results || recs.results.length === 0) {
            recs = await fetchAPI(`/${type}/${id}/similar`);
        }

        if (recs && recs.results && recs.results.length > 0) {
            renderGrid(
                recs.results.filter(i => i.poster_path).slice(0, 12),
                'player-recommendations',
                type
            );
        } else {
            if (recContainer) {
                recContainer.innerHTML =
                    '<div style="color:#666; padding:20px;">No recommendations available.</div>';
            }
        }

    } catch (e) {
        console.error("Recommendations Error:", e);
    }

    window.scrollTo(0, 0);
    const finalMainContent = document.querySelector('.main-content');
    if (finalMainContent) finalMainContent.scrollTop = 0;

}

function setupWatchlistBtn(id, btnId, type, title, poster) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    updateWatchlistBtnStyles(id, btnId);
    btn.onclick = () => {
        toggleLib('watchlist', id, type, title, poster);
        setTimeout(() => updateWatchlistBtnStyles(id, btnId), 200);
    };
}

async function updateWatchlistBtnStyles(id, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const watchlist = getLib('watchlist') || [];
    const exists = watchlist.find(i => i.id == id);

    if (exists) {
        btn.innerHTML = '<i class="fas fa-check"></i> Added';

        if (btn.classList.contains('s-btn')) {
            btn.classList.remove('s-btn-red');
            btn.classList.add('s-btn-gray');
        } else if (btn.classList.contains('btn-primary')) {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-glass');
        }
    } else {
        btn.innerHTML = '<i class="far fa-heart"></i> Watchlist';

        if (btn.classList.contains('s-btn')) {
            btn.classList.remove('s-btn-gray');
            btn.classList.add('s-btn-red');
        } else if (btn.classList.contains('btn-glass')) {
            btn.classList.remove('btn-glass');
            btn.classList.add('btn-primary');
        }
    }
}

function shareContent(title) {
    if (navigator.share) { navigator.share({ title: 'Watch on StreameX', text: `Check out "${title}" on StreameX!`, url: window.location.href }).catch(console.error); }
    else { navigator.clipboard.writeText(window.location.href); showToast('Link copied!'); }
}

async function loadSeason(seasonNum) {
    playerState.season = seasonNum;
    const box = document.getElementById('episode-list-box');
    if (box) box.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

    // --- ANIME SEASON UPDATE ---
    if (playerState.isAnime) {
        // When changing season, get the new Anilist ID for that specific season
        const newAnilistId = await fetchAnilistId(playerState.title, seasonNum);
        if (newAnilistId) {
            playerState.anilistId = newAnilistId;
            // Reload the player if it's currently playing to update the ID
            const iframeBox = document.getElementById('iframe-box');
            if (iframeBox && iframeBox.innerHTML.includes('iframe')) {
                const currentServerBtn = document.querySelector('.server-btn.active');
                const fallbackIdx = servers.findIndex(s => !!s.isAnime === playerState.isAnime);
                const serverIdx = currentServerBtn ? parseInt(currentServerBtn.dataset.index) : (fallbackIdx !== -1 ? fallbackIdx : 0);
                // Only reload if using an Anime server
                if (servers[serverIdx].isAnime) loadVideo(serverIdx);
            }
        }
    }
    // ----------------------------

    const data = await fetchAPI(`/tv/${playerState.id}/season/${seasonNum}`);
    seasonData = data.episodes || [];
    renderEpisodeList();
}

function setEpView(view) {
    episodeView = view;
    document.querySelector('.fa-list')?.classList.toggle('active', view === 'list');
    document.querySelector('.fa-th-large')?.classList.toggle('active', view === 'grid');
    const box = document.getElementById('episode-list-box');
    if (box) box.className = `ep-container ${view}-view`;
    renderEpisodeList();
}

function renderEpisodeList() {
    const box = document.getElementById('episode-list-box');
    if (!box) return;
    box.innerHTML = '';
    if (!seasonData.length) { box.innerHTML = '<div style="padding:10px; color:#666;">No episodes found.</div>'; return; }
    seasonData.forEach(ep => {
        const div = document.createElement('div');
        div.className = `ep-item ${ep.episode_number == playerState.episode ? 'active' : ''}`;
        div.onclick = () => {
            playerState.episode = ep.episode_number;
            renderEpisodeList();
            // Determine active server using the saved dataset index
            const currentServerBtn = document.querySelector('.server-btn.active');
            const fallbackIdx = servers.findIndex(s => !!s.isAnime === playerState.isAnime);
            const serverIdx = currentServerBtn ? parseInt(currentServerBtn.dataset.index) : (fallbackIdx !== -1 ? fallbackIdx : 0);
            loadVideo(serverIdx);
        };
        // Force WebP for episode thumbnails
        const imgUrl = ep.still_path ? `https://wsrv.nl/?url=image.tmdb.org/t/p/w185${ep.still_path}&output=webp` : '';
        if (episodeView === 'list') {
            div.innerHTML = `<div class="ep-number">${ep.episode_number}</div><div class="ep-info"><div class="ep-title">${ep.name}</div></div>`;
        } else {
            div.innerHTML = `<div class="ep-thumb">${imgUrl ? `<img src="${imgUrl}" loading="lazy">` : '<div style="width:100%;height:100%;background:#222;"></div>'}</div><div class="ep-info"><div class="ep-title"><span style="color:var(--accent); font-weight:bold;">${ep.episode_number}.</span> ${ep.name}</div></div>`;
        }
        box.appendChild(div);
    });
}

function closePlayer() {
    restoreLastState();
}

function renderServers(activeIdx = -1) {
    const list = document.getElementById('server-list');
    if (!list) return;
    list.innerHTML = '';

    let primaryServers = [];
    let fallbackServers = [];
    let firstVisibleIndex = -1;

    // 1. Group the servers based on what is currently playing
    servers.forEach((srv, idx) => {
        if (!playerState.isAnime) {
            // If watching Movie/TV: Only load non-anime servers
            if (!srv.isAnime) primaryServers.push({ srv, idx });
        } else {
            // If watching Anime: Separate Anime servers and Fallback Movie servers
            if (srv.isAnime) {
                primaryServers.push({ srv, idx });
            } else {
                fallbackServers.push({ srv, idx });
            }
        }
    });

    // 2. Determine the default active server (First primary, or first fallback)
    if (primaryServers.length > 0) {
        firstVisibleIndex = primaryServers[0].idx;
    } else if (fallbackServers.length > 0) {
        firstVisibleIndex = fallbackServers[0].idx;
    }

    // Helper function to render a block of servers
    function renderServerBlock(group, titleText) {
        if (group.length === 0) return;

        // If a title is provided (for Anime mode), create a full-width header
        if (titleText) {
            const title = document.createElement('div');
            title.innerHTML = titleText;
            // CSS to make it span all 3 columns and look like a mini-header
            title.style.gridColumn = '1 / -1';
            title.style.color = 'var(--text-muted)';
            title.style.fontSize = '12px';
            title.style.fontWeight = '600';
            title.style.textTransform = 'uppercase';
            title.style.marginTop = '10px';
            title.style.marginBottom = '5px';
            title.style.borderBottom = '1px solid var(--border-color)';
            title.style.paddingBottom = '5px';
            list.appendChild(title);
        }

        // Render the actual buttons
        group.forEach(item => {
            const { srv, idx } = item;
            const btn = document.createElement('div');
            const isActive = (activeIdx !== -1) ? (idx === activeIdx) : (idx === firstVisibleIndex);

            btn.className = `server-btn ${isActive ? 'active' : ''}`;
            btn.dataset.index = idx; // Saves the true backend index to the HTML
            btn.innerHTML = `<i class="fas fa-play"></i> ${srv.name}`;

            btn.onclick = () => {
                document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadVideo(idx);
            }
            list.appendChild(btn);
        });
    }

    // 3. Render the blocks to the screen
    if (!playerState.isAnime) {
        // Just render regular servers normally without extra labels
        renderServerBlock(primaryServers, null);
    } else {
        // Render two distinct blocks with labels for Anime
        renderServerBlock(primaryServers, '<i class="fas fa-dragon"></i> Dedicated Anime Servers');
        renderServerBlock(fallbackServers, '<i class="fas fa-film"></i> Fallback Movie Servers');
    }

    // 4. Fallback if absolutely no servers match
    if (primaryServers.length === 0 && fallbackServers.length === 0) {
        list.innerHTML = '<div style="color:#fff; padding:10px; grid-column: 1 / -1;">No compatible servers found.</div>';
    }
}

async function loadVideo(serverIdx) {
    const iframeBox = document.getElementById('iframe-box');

    // Safety check for player state
    if (!playerState) playerState = { season: 1, episode: 1 };

    // 1. Show a professional Loading Screen while we fetch the secure token
    iframeBox.innerHTML = `
        <div style="display:flex; height:100%; width:100%; align-items:center; justify-content:center; flex-direction:column; color:#fff; background:#000;">
            <i class="fas fa-circle-notch fa-spin" style="font-size:40px; margin-bottom:15px; color:var(--accent);"></i>
            <div style="font-family:sans-serif; font-size:14px; opacity:0.8;">Securing Connection...</div>
        </div>
    `;

    // Save to history
    updateHistory(serverIdx);

    const srv = servers[serverIdx];
    // Ensure we have a valid server object
    if (!srv) {
        iframeBox.innerHTML = '<div style="color:red; padding:20px;">Error: Server not found.</div>';
        return;
    }

    // 2. Determine the correct ID to send (Anilist for Anime, TMDB for others)
    // The worker needs the specific ID type based on the server
    let targetId = playerState.id; // Default to TMDB ID

    if (srv.isAnime) {
        if (playerState.anilistId) {
            targetId = playerState.anilistId;
        } else {
            // If we are trying to play Anime but don't have an AniList ID yet, stop.
            iframeBox.innerHTML = '<div style="text-align:center; padding:20px; color:#ff4444;">Error: Anime ID missing. Please refresh the page.</div>';
            return;
        }
    }

    try {
        // 3. CALL YOUR WORKER TO GET A TOKEN
        // We assume you added 'const WORKER_URL' at the top of your file
        const tokenUrl = `${WORKER_URL}/token?server=${srv.key}&id=${targetId}`;
        const response = await fetch(tokenUrl);

        if (!response.ok) throw new Error("Failed to generate security token");

        const data = await response.json();
        if (!data.token) throw new Error("Invalid token received");

        // 4. CONSTRUCT THE SECURE PLAY URL
        // This URL points to your Worker, which verifies the token and redirects to the video
        const playUrl = new URL(`${WORKER_URL}/play`);
        playUrl.searchParams.set('server', srv.key);
        playUrl.searchParams.set('id', targetId);
        playUrl.searchParams.set('token', data.token);

        // Pass extra details needed for the stream
        if (playerState.type) playUrl.searchParams.set('type', playerState.type);
        if (playerState.season) playUrl.searchParams.set('season', playerState.season);
        if (playerState.episode) playUrl.searchParams.set('episode', playerState.episode);

        // Check if the current server supports sandboxing based on our array
        let sandboxAttr = "";
        if (srv.useSandbox === true) {
            sandboxAttr = `sandbox="allow-scripts allow-same-origin allow-presentation"`;
        }

        // 5. LOAD THE IFRAME
        // We use the Worker URL as the source. The browser will never see the real video source URL.
        iframeBox.innerHTML = `<iframe src="${playUrl.toString()}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media" ${sandboxAttr} style="width:100%; height:100%;"></iframe>`;

    } catch (error) {
        console.error("Video Load Error:", error);
        iframeBox.innerHTML = `
            <div style="text-align:center; padding:20px; color:#ff4444; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%;">
                <i class="fas fa-exclamation-triangle" style="font-size:30px; margin-bottom:10px;"></i>
                <div>Stream Error: ${error.message}</div>
                <div style="font-size:12px; margin-top:5px; opacity:0.7;">Try selecting a different server.</div>
            </div>
        `;
    }
}

// --- HELPERS ---
function getLib(key) { return JSON.parse(localStorage.getItem('streamex_' + key)) || []; }
function saveLib(key, data) { localStorage.setItem('streamex_' + key, JSON.stringify(data)); }
function handleSearch(e) {
    if (e.key === 'Enter') {
        const query = e.target.value;
        if (!query) return;

        // Use the smart search function to handle everything (saving state, etc)
        performLiveSearch(query);
    }
}
function toggleMobileMenu() { document.getElementById('mobile-menu-overlay')?.classList.toggle('active'); }
function openMobileSearch() { document.getElementById('mobile-menu-overlay')?.classList.remove('active'); router('mobile-search'); setTimeout(() => { document.getElementById('mobile-search-input')?.focus(); }, 100); }
function clearData(key) { if (confirm('Are you sure?')) { localStorage.removeItem('streamex_' + key); location.reload(); } }
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '<i class="fas fa-check-circle" style="color:#4caf50;"></i>' : '<i class="fas fa-info-circle" style="color:#2196f3;"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); if (container.children.length === 0) container.remove(); }, 3000);
}
function showSkeletons(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) { container.innerHTML += `<div class="media-card sk-card"><div class="poster skeleton sk-poster"></div><div class="skeleton sk-text"></div><div class="skeleton sk-meta"></div></div>`; }
}
let searchTimer;
function handleSmartSearch(query) {
    clearTimeout(searchTimer);
    if (!query || query.trim().length === 0) {
        const mobileView = document.getElementById('view-mobile-search');
        if (mobileView && mobileView.classList.contains('active')) { document.getElementById('mobile-search-results').innerHTML = ''; }
        else { router('home'); }
        return;
    }
    if (query.length < 2) return;
    searchTimer = setTimeout(() => { performLiveSearch(query); }, 500);
}

function performLiveSearch(query) {
    // 1. Save the query to history
    navState.query = query;

    let resultContainerId = 'search-res';
    const mobileView = document.getElementById('view-mobile-search');

    if (mobileView && mobileView.classList.contains('active')) {
        resultContainerId = 'mobile-search-results';
        navState.view = 'mobile-search';
    } else {
        // USE THE NEW SEARCH VIEW INSTEAD OF DESTROYING THE MOVIES PAGE
        router('search');
        navState.query = query; // Ensure query persists
        const searchTitle = document.getElementById('search-title');
        if (searchTitle) {
            searchTitle.innerHTML = `Results for: "<span style="color:var(--accent)">${query}</span>"`;
        }
    }

    showSkeletons(resultContainerId, 6);

    fetchAPI(`/search/multi?query=${encodeURIComponent(query)}`).then(data => {
        const filtered = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
        if (filtered.length === 0) {
            document.getElementById(resultContainerId).innerHTML = '<div style="color:#888; padding:20px;">No matches found. Check spelling?</div>';
        } else {
            renderGrid(filtered, resultContainerId);
        }
    });
}

function updateHistory(serverIdx) {
    const item = {
        id: playerState.id,
        type: playerState.type,
        title: playerState.title || "Unknown Title",
        poster: playerState.poster || "",
        season: playerState.season,
        episode: playerState.episode,
        serverIdx: serverIdx,
        savedAt: Date.now()
    };

    let history = getLib('history') || [];

    // Remove existing entry
    history = history.filter(i => i.id != item.id);

    // Add to top
    history.unshift(item);

    // Keep only latest 50
    if (history.length > 50) history.pop();

    saveLib('history', history);
}

async function downloadContent() {
    // Extract season and episode alongside id and type
    const { id, type, season, episode } = playerState;

    // Define primary URL
    const primaryUrl = `https://zxcstream.xyz/download/${type}/${id}`;

    // Define fallback URL
    let fallbackUrl = `https://media.trendingpie.com/?id=${id}`;

    // Check if it's a TV show to append season and episode
    if (type === 'tv') {
        // Use the selected season/episode, or default to 1 if undefined
        const s = season || 1;
        const e = episode || 1;
        fallbackUrl += `&s=${s}&e=${e}`;
    }

    showToast("Preparing download link...", "info");

    try {
        // Attempt to ping the primary server
        await fetch(primaryUrl, { method: 'HEAD', mode: 'no-cors' });

        // If the ping succeeds, open the primary link
        window.open(primaryUrl, '_blank');

        // Show the manual fallback toast in case of a 404
        setTimeout(() => {
            showToast(`Not working? <a href="${fallbackUrl}" target="_blank" style="color: #ffeb3b; font-weight: bold; text-decoration: underline;">Try Server 2</a>`, 'info');
        }, 1000);

    } catch (error) {
        // If the ping fails completely, open the fallback automatically
        console.warn("Primary download server is unreachable, switching to fallback.", error);

        showToast("Primary server down. Opening Fallback...", "success");
        window.open(fallbackUrl, '_blank');
    }
}

function restoreLastState() {
    // 1. Hide Player
    document.getElementById('view-player').classList.remove('active');
    document.getElementById('iframe-box').innerHTML = '';

    // 2. Check if we had a search query
    if (navState.query) {
        // If we were searching, restore the view AND the results
        if (navState.view === 'mobile-search') {
            router('mobile-search');
            performLiveSearch(navState.query);
        } else {
            // Desktop/Standard search (lives in 'movies' view)
            router('movies');
            navState.query = navState.query; // Ensure query persists
            performLiveSearch(navState.query);
        }
    } else {
        // 3. No search? Just go back to the previous page (Home, Anime, TV, etc.)
        router(navState.view || 'home');
    }
}

// --- SIDEBAR TOGGLE LOGIC ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const icon = document.getElementById('toggle-icon');

    // Toggle the 'collapsed' class
    sidebar.classList.toggle('collapsed');

    // Change the arrow icon direction
    if (sidebar.classList.contains('collapsed')) {
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
    } else {
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Online/Offline Detection Logic
const statusToast = document.getElementById('connection-status');

function showConnectionStatus(message, isOnline) {
    if (!statusToast) return;

    // Set the text and update classes
    statusToast.textContent = message;
    statusToast.className = `connection-toast show ${isOnline ? 'toast-online' : 'toast-offline'}`;

    // If we are back online, hide the message after 3 seconds
    if (isOnline) {
        setTimeout(() => {
            statusToast.classList.remove('show');
        }, 3000);
    }
}

// Listen for the browser losing internet connection
window.addEventListener('offline', () => {
    showConnectionStatus('You are offline. Showing cached movies.', false);
});

// Listen for the browser regaining internet connection
window.addEventListener('online', () => {
    showConnectionStatus('Back online! Ready to stream new movies.', true);
});

// Notification Modal Logic
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById('notification-modal');
    const btnLater = document.getElementById('btn-later');
    const btnEnable = document.getElementById('btn-enable');

    // 1. Check local storage to see if we've already prompted them
    const hasPrompted = localStorage.getItem('streamex_notif_prompted');

    // 2. Only show if supported, permission is default, AND we haven't asked yet
    if (!hasPrompted && 'Notification' in window && Notification.permission === 'default') {
        // Wait 3 seconds so we don't interrupt the user immediately
        setTimeout(() => {
            if (modal) modal.classList.remove('hidden');
        }, 3000);
    }

    // Handle "Maybe Later" click
    if (btnLater) {
        btnLater.addEventListener('click', () => {
            modal.classList.add('hidden');
            // Save their choice so it doesn't pop up again on next visit
            localStorage.setItem('streamex_notif_prompted', 'true');
        });
    }

    // Handle "Allow Notifications" click
    if (btnEnable) {
        btnEnable.addEventListener('click', () => {
            modal.classList.add('hidden');
            // Save their choice so it doesn't pop up again on next visit
            localStorage.setItem('streamex_notif_prompted', 'true');

            // Call the Firebase function we set up in index.html
            if (typeof window.enableNotifications === 'function') {
                window.enableNotifications();
            }
        });
    }
});

// --- EXPOSE TO HTML ---
window.router = router;
window.openPlayer = openPlayer;
window.shareContent = shareContent;
window.loadSeason = loadSeason;
window.setEpView = setEpView;
window.handleSearch = handleSearch;
window.toggleMobileMenu = toggleMobileMenu;
window.openMobileSearch = openMobileSearch;
window.closePlayer = closePlayer;
window.clearData = clearData;
window.toggleLib = toggleLib;
window.saveSettings = saveSettings;
window.loadVideo = loadVideo;
window.toggleMobileMenu = toggleMobileMenu;
window.showToast = showToast;
window.handleSmartSearch = handleSmartSearch;
window.downloadContent = downloadContent;
window.toggleSidebar = toggleSidebar;
