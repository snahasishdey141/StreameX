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
    { name: "VidNest (Sub)", isAnime: true, key: "vidnest_anime_sub", useSandbox: false },
    { name: "VidNest (Dub)", isAnime: true, key: "vidnest_anime_dub", useSandbox: false },
    { name: "Anime (Sub)", isAnime: true, key: "animepahe_sub", useSandbox: false },
    { name: "Anime (Dub)", isAnime: true, key: "animepahe_dub", useSandbox: false },
    { name: "VidLink (Sub)", isAnime: true, key: "vidlink_anime_sub", useSandbox: false },
    { name: "VidLink (Dub)", isAnime: true, key: "vidlink_anime_dub", useSandbox: false },

    // --- MOVIE/TV SERVERS (Use TMDB ID) ---
    { name: "StreameX", key: "streamex", useSandbox: false },
    { name: "Server1", key: "fastserver", useSandbox: false },
    { name: "Server2", key: "multiserver", useSandbox: true },
    { name: "VidSrc", key: "vidsrc", useSandbox: false },
    { name: "Server4", key: "server5", useSandbox: false },       // Maps to PrimeSrc in worker
    { name: "Vidpro", key: "vidpro", useSandbox: false },        // Maps to VidKing in worker
    { name: "Stream", key: "cstream", useSandbox: true },
    { name: "king", key: "vidking_direct", useSandbox: false }, // Maps to VidRock in worker
    { name: "pro", key: "vidlink_standard", useSandbox: false },
    { name: "nest", key: "vidnest_standard", useSandbox: false },
    { name: "letest", key: "nontongo", useSandbox: false },
    { name: "Api1", key: "Multi_server", useSandbox: false },
    { name: "Multilang", key: "Multi_lang", useSandbox: false },
    { name: "Premium", key: "Premium", useSandbox: false },
    { name: "MovieApi", key: "MoviesApi", useSandbox: false },
    { name: "EmbedApi", key: "EmbedApi", useSandbox: false },
    { name: "Vidapi", key: "Vidapi", useSandbox: true },
    { name: "NextGen", key: "NextGen", useSandbox: true },
    
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

// --- INITIALIZATION ---
window.onload = async () => {

    loadSettings();
    applyTheme();

    // 2. Settings API
    try { await populateSettingsAPI(); } catch (error) { console.error("Settings API Error:", error); addFallbackSettings(); }

    // 3. Deep Links
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');

    if (type && id) {
        openPlayer(id, type, true);
    } else {
        router('home');
    }

    // Browser Back Button
    // --- BROWSER BACK BUTTON LISTENER ---
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        const id = params.get('id');

        if (type && id) {
            openPlayer(id, type, true);
        } else {
            // If no ID in URL, we are going BACK from the player
            // Instead of forcing 'home', use our restore function
            restoreLastState();
        }
    });
};

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
        if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(`router('${viewName}')`)) {
            el.classList.add('active');
        }
    });

    // --- PAGE TRANSITION ANIMATION ---
    const currentActive = document.querySelector('.page-view.active');
    const target = document.getElementById(`view-${viewName}`);

    if (currentActive && currentActive !== target) {
        currentActive.classList.add('exiting');
        setTimeout(() => {
            currentActive.classList.remove('exiting');
            currentActive.classList.remove('active');
            if (target) target.classList.add('active');
        }, 200);
    } else {
        document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
        if (target) target.classList.add('active');
    }

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
    } catch(e) {
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
    try {
        const [trending, localMovies, hollyData, tvShows] = await Promise.all([
            fetchAPI('/trending/all/week'), fetchAPI(localQuery), fetchAPI(hollyQuery), fetchAPI('/trending/tv/week')
        ]);
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
        let slides = [];
        if (trending && trending.results) slides = trending.results.filter(item => item.backdrop_path).slice(0, 5);
        renderSlider(slides);
        renderGrid(localMovies ? localMovies.results : [], 'home-bollywood');
        renderGrid(hollyData ? hollyData.results : [], 'home-hollywood');
        renderGrid(tvShows ? tvShows.results : [], 'home-tv', 'tv');
    } catch (error) { console.error("Home Data Load Error:", error); }
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
            bg = `${IMG_ORIG}${item.backdrop_path}`;
            const img = new Image();
            img.src = bg;
        }
        const slide = document.createElement('div');
        slide.className = `slide ${activeClass}`;
        slide.style.backgroundImage = `url(${bg})`;
        slide.innerHTML = `<div class="hero-content"><div style="margin-bottom:10px;"><span style="background:var(--accent); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:12px;">#${index + 1} Spotlight</span></div><div class="hero-title">${title}</div><div class="hero-desc">${item.overview || ''}</div><button class="btn btn-primary" onclick="openPlayer('${item.id}', '${type}')"><i class="fas fa-play"></i> Watch Now</button></div>`;
        container.appendChild(slide);
    });

    // --- DOT INDICATORS ---
    let dotsContainer = document.querySelector('.slider-dots');
    if (dotsContainer) dotsContainer.remove();
    dotsContainer = document.createElement('div');
    dotsContainer.className = 'slider-dots';
    items.forEach((_, i) => {
        const dot = document.createElement('span');
        dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
        dot.onclick = () => {
            if (slideInterval) clearInterval(slideInterval);
            const allSlides = container.querySelectorAll('.slide');
            allSlides.forEach(s => s.classList.remove('active'));
            container.querySelectorAll('.slider-dot')?.forEach(d => d.classList.remove('active'));
            currentSlide = i;
            allSlides[currentSlide]?.classList.add('active');
            dot.classList.add('active');
            restartSliderProgress();
            startSliderInterval();
        };
        dotsContainer.appendChild(dot);
    });
    container.appendChild(dotsContainer);

    // --- PROGRESS BAR ---
    let progressBar = document.querySelector('.slider-progress');
    if (progressBar) progressBar.remove();
    progressBar = document.createElement('div');
    progressBar.className = 'slider-progress';
    progressBar.innerHTML = '<div class="slider-progress-bar"></div>';
    container.appendChild(progressBar);

    function restartSliderProgress() {
        const bar = document.querySelector('.slider-progress-bar');
        if (bar) {
            bar.style.animation = 'none';
            bar.offsetHeight; // force reflow
            bar.style.animation = 'sliderProgress 5s linear forwards';
        }
    }

    function updateDotsAndProgress() {
        dotsContainer.querySelectorAll('.slider-dot').forEach((d, i) => {
            d.classList.toggle('active', i === currentSlide);
        });
        restartSliderProgress();
    }

    // --- TOUCH SWIPE SUPPORT ---
    let touchStartX = 0;
    let touchEndX = 0;
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const delta = touchStartX - touchEndX;
        if (Math.abs(delta) > 50) {
            if (slideInterval) clearInterval(slideInterval);
            const allSlides = container.querySelectorAll('.slide');
            allSlides[currentSlide]?.classList.remove('active');
            if (delta > 0) {
                currentSlide = (currentSlide + 1) % allSlides.length;
            } else {
                currentSlide = (currentSlide - 1 + allSlides.length) % allSlides.length;
            }
            allSlides[currentSlide]?.classList.add('active');
            updateDotsAndProgress();
            startSliderInterval();
        }
    }, { passive: true });

    // --- AUTO SLIDE ---
    if (slideInterval) clearInterval(slideInterval);
    const slides = container.querySelectorAll('.slide');
    currentSlide = 0;

    function startSliderInterval() {
        if (slideInterval) clearInterval(slideInterval);
        slideInterval = setInterval(() => {
            if (slides.length > 0) {
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('active');
                updateDotsAndProgress();
            }
        }, 5000);
    }

    startSliderInterval();
    restartSliderProgress();
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
    let globalCardIndex = 0;

    function renderBatch() {
        const slice = items.slice(currentIndex, currentIndex + visibleCount);

        slice.forEach((item, batchIdx) => {
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
            card.className = "media-card card-animate-in";
            card.style.animationDelay = `${Math.min(globalCardIndex * 50, 400)}ms`;
            card.setAttribute('data-id', item.id);
            card.setAttribute('data-type', type);
            card.onclick = () => openPlayer(item.id, type);

            const ratingTag = item.vote_average
                ? `<div class="card-rating">${item.vote_average.toFixed(1)}</div>`
                : "";

            // Optimized image size
            const imageUrl = posterPath.startsWith("http")
                ? posterPath
                : `https://image.tmdb.org/t/p/w342${posterPath}`;

            card.innerHTML = `
        <div class="poster">
          <img src="${imageUrl}" loading="lazy" alt="${title}" onerror="this.style.display='none'">
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
            globalCardIndex++;
        });

        currentIndex += visibleCount;
    }

    renderBatch();

    // Initialize card hover popup on desktop
    initCardHoverPopup(container);

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
                initCardHoverPopup(container);
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
    document.querySelector('.main-content').scrollTop = 0;

    if (!skipPush) {
        const newUrl = `?type=${type}&id=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }
    document.getElementById('iframe-box').innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center;"><i class="fas fa-spinner fa-spin" style="font-size:40px;"></i></div>';

    // 5. Fetch Details from API
    const [data, creditsData] = await Promise.all([
        fetchAPI(`/${type}/${id}`),
        fetchAPI(`/${type}/${id}/credits`)
    ]);

    const title = data.title || data.name;
    const desc = data.overview;
    const poster = data.poster_path ? IMG_URL + data.poster_path : '';

    // Extract top 5 cast members with profile_path
    const castList = (creditsData && creditsData.cast)
        ? creditsData.cast.filter(c => c.profile_path).slice(0, 5)
        : [];

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
        if (preferredServer === -1) {
            if (!isAnime) preferredServer = servers.findIndex(s => !s.isAnime);
            else preferredServer = servers.findIndex(s => s.isAnime);
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

    // --- BREADCRUMB ---
    const breadcrumbEl = document.getElementById('player-breadcrumb');
    if (breadcrumbEl) {
        breadcrumbEl.innerHTML = `<span onclick="router('home')" style="cursor:pointer;color:var(--accent)">Home</span> &gt; <span onclick="router('${type === 'movie' ? 'movies' : 'tv'}')" style="cursor:pointer;color:var(--accent)">${type === 'movie' ? 'Movies' : 'TV Shows'}</span> &gt; <span>${title}</span>`;
    }
    const titleBarEl = document.getElementById('player-title-bar');
    if (titleBarEl) titleBarEl.textContent = title;

    // --- UI RENDERING (Common for both) ---
    const year = (data.release_date || data.first_air_date || '').substring(0, 4);
    const genres = data.genres ? data.genres.map(g => g.name).slice(0, 2).join(', ') : '';
    const allGenres = data.genres ? data.genres.map(g => g.name) : [];
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';
    const ratingNum = data.vote_average || 0;
    const runtime = data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : '';

    // Panels Setup
    const rightPanel = document.getElementById('episode-panel');
    const bottomDetails = document.querySelector('.media-details-box');
    if (rightPanel) rightPanel.innerHTML = '';
    if (bottomDetails) bottomDetails.innerHTML = '';

    // --- Generate star rating HTML ---
    function renderStars(voteAvg) {
        const starCount = Math.round(voteAvg / 2);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += i <= starCount
                ? '<i class="fas fa-star" style="color:#f5c518;"></i>'
                : '<i class="far fa-star" style="color:#555;"></i>';
        }
        return starsHtml;
    }

    // --- Generate cast HTML ---
    function renderCastHtml(castArr) {
        if (!castArr || castArr.length === 0) return '';
        let html = '<div class="cast-section"><h4 style="margin-bottom:8px;color:var(--text-muted);font-size:13px;">TOP CAST</h4><div class="cast-avatars">';
        castArr.forEach(c => {
            html += `<div class="cast-avatar-item">
                <img src="https://image.tmdb.org/t/p/w185${c.profile_path}" alt="${c.name}" class="cast-avatar-img" loading="lazy">
                <span class="cast-avatar-name">${c.name.split(' ')[0]}</span>
            </div>`;
        });
        html += '</div></div>';
        return html;
    }

    // --- Generate genre pills HTML ---
    function renderGenrePills(genreArr) {
        return genreArr.map(g => `<span class="genre-pill-glass">${g}</span>`).join('');
    }

    if (type === 'movie') {
        if (rightPanel) {
            rightPanel.style.display = 'flex';
            const status = data.status || "Released";
            const studio = (data.production_companies && data.production_companies.length > 0) ? data.production_companies[0].name : "Unknown";
            const date = data.release_date || "N/A";
            const backdropUrl = data.backdrop_path ? `${IMG_ORIG}${data.backdrop_path}` : '';

            rightPanel.innerHTML = `
                <div class="movie-sidebar">
                    ${backdropUrl ? `<div class="sidebar-backdrop" style="background-image:url(${backdropUrl})"></div>` : ''}
                    <div class="movie-sidebar-header">
                        <img src="${poster}" class="sidebar-poster" alt="${title}">
                        <div class="sidebar-meta-info">
                            <div class="meta-item"><span class="meta-label">Status</span><span class="meta-value">${status}</span></div>
                            <div class="meta-item"><span class="meta-label">Runtime</span><span class="meta-value">${runtime || 'N/A'}</span></div>
                            <div class="meta-item"><span class="meta-label">Production</span><span class="meta-value">${studio}</span></div>
                            <div class="meta-item"><span class="meta-label">Released</span><span class="meta-value">${date}</span></div>
                        </div>
                    </div>
                    <div class="movie-sidebar-body">
                        <h1>${title}</h1>
                        <div class="sidebar-badges">
                            <span class="badge-year">${year}</span>
                            <span class="badge-rating">${rating}</span>
                            <span class="star-rating">${renderStars(ratingNum)}</span>
                        </div>
                        <div class="genre-pills-row">${renderGenrePills(allGenres)}</div>
                        ${renderCastHtml(castList)}
                        <div class="sidebar-buttons">
                            <button class="s-btn s-btn-icon" id="watchlist-btn-movie" title="Watchlist"><i class="far fa-heart"></i></button>
                            <button class="s-btn s-btn-icon" onclick="downloadContent()" title="Download"><i class="fas fa-download"></i></button>
                            <button class="s-btn s-btn-icon" onclick="shareContent('${title.replace(/'/g, "\\'")}')" title="Share"><i class="fas fa-share-alt"></i></button>
                        </div>
                        <div class="sidebar-desc expandable-desc" id="movie-desc-box">
                            <p>${desc}</p>
                        </div>
                        <button class="read-more-btn" onclick="toggleDescription(this)">Read More</button>
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
            bottomDetails.innerHTML = `
                <div class="details-header">
                    <img src="${poster}" class="details-poster-img" alt="${title}">
                    <div class="details-text">
                        <h1>${title}</h1>
                        <div class="meta-tags">
                            <span class="tag-pill">${year}</span>
                            <span class="tag-pill" style="background:var(--accent)">${rating}</span>
                            <span class="star-rating">${renderStars(ratingNum)}</span>
                        </div>
                        <div class="genre-pills-row">${renderGenrePills(allGenres)}</div>
                        ${renderCastHtml(castList)}
                        <div class="expandable-desc" id="tv-desc-box"><p>${desc}</p></div>
                        <button class="read-more-btn" onclick="toggleDescription(this)">Read More</button>
                        <div class="action-buttons">
                             <button id="watchlist-btn-tv" class="btn btn-primary"><i class="far fa-heart"></i> Add</button>
                             <button class="btn btn-glass" onclick="downloadContent()"><i class="fas fa-download"></i> Download</button>
                             <button onclick="shareContent('${title.replace(/'/g, "\\'")}')" class="btn s-btn-gray"><i class="fas fa-share-alt"></i> Share</button>
                        </div>
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
            if (activeEp) activeEp.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 500);
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
                const serverIdx = currentServerBtn ? Array.from(currentServerBtn.parentNode.children).indexOf(currentServerBtn) : 0;
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

function renderEpisodeList(filteredData) {
    const box = document.getElementById('episode-list-box');
    if (!box) return;
    box.innerHTML = '';



    const episodes = filteredData || seasonData;
    if (!episodes.length) { box.innerHTML += '<div style="padding:10px; color:#666;">No episodes found.</div>'; return; }

    episodes.forEach(ep => {
        const div = document.createElement('div');
        const isActive = ep.episode_number == playerState.episode;
        div.className = `ep-item ${isActive ? 'active' : ''}`;
        div.onclick = () => {
            playerState.episode = ep.episode_number;
            renderEpisodeList();
            const currentServerBtn = document.querySelector('.server-btn.active');
            const serverIdx = currentServerBtn ? Array.from(currentServerBtn.parentNode.children).indexOf(currentServerBtn) : 0;
            loadVideo(serverIdx);
        };
        const imgUrl = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : '';
        const airDate = ep.air_date ? `<span class="ep-air-date">${ep.air_date}</span>` : '';
        const playingDot = isActive ? '<span class="ep-playing-dot"></span>' : '';

        // Check watch progress from localStorage
        const progressKey = `streamex_progress_${playerState.id}_s${playerState.season}_e${ep.episode_number}`;
        const savedProgress = localStorage.getItem(progressKey);
        const progressBar = savedProgress ? `<div class="ep-progress-bar"><div class="ep-progress-fill" style="width:${savedProgress}%"></div></div>` : '';

        if (episodeView === 'list') {
            div.innerHTML = `${playingDot}<div class="ep-number">${ep.episode_number}</div><div class="ep-info"><div class="ep-title">${ep.name}</div>${airDate}</div>${progressBar}`;
        } else {
            div.innerHTML = `<div class="ep-thumb">${imgUrl ? `<img src="${imgUrl}" loading="lazy">` : '<div style="width:100%;height:100%;background:#222;"></div>'}</div><div class="ep-info">${playingDot}<div class="ep-title"><span style="color:var(--accent); font-weight:bold;">${ep.episode_number}.</span> ${ep.name}</div>${airDate}</div>${progressBar}`;
        }
        box.appendChild(div);
    });

    // Auto-scroll to active episode
    setTimeout(() => {
        const activeEp = box.querySelector('.ep-item.active');
        if (activeEp) activeEp.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 300);
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
            if (!srv.isAnime) primaryServers.push({ srv, idx });
        } else {
            if (srv.isAnime) {
                primaryServers.push({ srv, idx });
            } else {
                fallbackServers.push({ srv, idx });
            }
        }
    });

    // 2. Determine the default active server
    if (primaryServers.length > 0) {
        firstVisibleIndex = primaryServers[0].idx;
    } else if (fallbackServers.length > 0) {
        firstVisibleIndex = fallbackServers[0].idx;
    }

    // Helper function to render a block of servers
    function renderServerBlock(group, titleText) {
        if (group.length === 0) return;

        if (titleText) {
            const title = document.createElement('div');
            title.innerHTML = titleText;
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

        // Render the actual server pill buttons
        group.forEach((item, groupIdx) => {
            const { srv, idx } = item;
            const btn = document.createElement('div');
            const isActive = (activeIdx !== -1) ? (idx === activeIdx) : (idx === firstVisibleIndex);

            btn.className = `server-btn server-pill ${isActive ? 'active' : ''}`;
            // Green dot indicator for first/recommended server
            const recommendedDot = groupIdx === 0 ? '<span class="server-dot-green"></span>' : '';
            btn.innerHTML = `${recommendedDot}<i class="fas fa-play"></i> ${srv.name}`;

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
        renderServerBlock(primaryServers, null); 
    } else {
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
    for (let i = 0; i < count; i++) { container.innerHTML += `<div class="media-card sk-card"><div class="poster skeleton sk-poster"></div><div class="skeleton sk-text" style="width:80%;height:14px;margin-top:10px;border-radius:4px;"></div><div class="skeleton sk-meta" style="width:40%;height:10px;margin-top:6px;border-radius:4px;"></div></div>`; }
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

function downloadContent() {
    const { id, type, season, episode } = playerState;
    let downloadUrl = type === 'movie' ? `https://dl.vidsrc.vip/movie/${id}` : `https://dl.vidsrc.vip/tv/${id}/${season}/${episode}`;
    window.open(downloadUrl, '_blank');
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

// --- TOGGLE DESCRIPTION (Read More / Show Less) ---
function toggleDescription(btn) {
    const descBox = btn.previousElementSibling;
    if (!descBox) return;
    descBox.classList.toggle('expanded');
    btn.textContent = descBox.classList.contains('expanded') ? 'Show Less' : 'Read More';
}

// --- CARD HOVER INFO POPUP ---
let cardPopupTimer = null;
let currentCardPopup = null;

function initCardHoverPopup(container) {
    if (window.innerWidth <= 768) return; // Desktop only

    const cards = container.querySelectorAll('.media-card[data-id]');
    cards.forEach(card => {
        if (card._hoverBound) return; // Prevent duplicate listeners
        card._hoverBound = true;

        card.addEventListener('mouseenter', () => {
            clearTimeout(cardPopupTimer);
            cardPopupTimer = setTimeout(async () => {
                const cardId = card.getAttribute('data-id');
                const cardType = card.getAttribute('data-type');
                if (!cardId || !cardType) return;

                try {
                    const details = await fetchAPI(`/${cardType}/${cardId}`);
                    if (!details) return;

                    // Remove existing popup
                    removeCardPopup();

                    const popupTitle = details.title || details.name;
                    const popupYear = (details.release_date || details.first_air_date || '').substring(0, 4);
                    const popupRating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
                    const popupGenres = details.genres ? details.genres.map(g => g.name).slice(0, 3).join(', ') : '';
                    const popupDesc = details.overview ? (details.overview.length > 120 ? details.overview.substring(0, 120) + '...' : details.overview) : '';
                    const popupBackdrop = details.backdrop_path ? `${IMG_ORIG}${details.backdrop_path}` : '';

                    const popup = document.createElement('div');
                    popup.className = 'card-popup';
                    popup.innerHTML = `
                        ${popupBackdrop ? `<div class="card-popup-backdrop ken-burns" style="background-image:url(${popupBackdrop})"></div>` : ''}
                        <div class="card-popup-content">
                            <div class="card-popup-title">${popupTitle}</div>
                            <div class="card-popup-meta">
                                <span>${popupYear}</span>
                                <span class="card-popup-rating"><i class="fas fa-star" style="color:#f5c518"></i> ${popupRating}</span>
                            </div>
                            <div class="card-popup-genres">${popupGenres}</div>
                            <div class="card-popup-desc">${popupDesc}</div>
                            <div class="card-popup-actions">
                                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openPlayer('${cardId}', '${cardType}')"><i class="fas fa-play"></i> Watch</button>
                                <button class="btn btn-glass btn-sm" onclick="event.stopPropagation(); toggleLib('watchlist', '${cardId}', '${cardType}', '${popupTitle.replace(/'/g, "\\'")}')"><i class="far fa-heart"></i></button>
                            </div>
                        </div>
                    `;

                    // Position popup using getBoundingClientRect
                    const rect = card.getBoundingClientRect();
                    const vpW = window.innerWidth;
                    const vpH = window.innerHeight;

                    popup.style.position = 'fixed';
                    popup.style.zIndex = '9999';

                    // Horizontal positioning
                    if (rect.left > vpW / 2) {
                        popup.style.right = (vpW - rect.left + 10) + 'px';
                    } else {
                        popup.style.left = (rect.right + 10) + 'px';
                    }

                    // Vertical positioning
                    if (rect.top > vpH / 2) {
                        popup.style.bottom = (vpH - rect.bottom + 10) + 'px';
                    } else {
                        popup.style.top = rect.top + 'px';
                    }

                    document.body.appendChild(popup);
                    currentCardPopup = popup;
                } catch (e) {
                    console.error('Card popup error:', e);
                }
            }, 500);
        });

        card.addEventListener('mouseleave', () => {
            clearTimeout(cardPopupTimer);
            removeCardPopup();
        });
    });
}

function removeCardPopup() {
    if (currentCardPopup) {
        currentCardPopup.classList.add('exiting');
        const popupRef = currentCardPopup;
        setTimeout(() => {
            if (popupRef && popupRef.parentNode) popupRef.remove();
        }, 150);
        currentCardPopup = null;
    }
}

// --- FILTER EPISODES ---
function filterEpisodes(query) {
    if (!query || query.trim() === '') {
        renderEpisodeList();
        return;
    }
    const filtered = seasonData.filter(ep =>
        ep.name && ep.name.toLowerCase().includes(query.toLowerCase())
    );
    renderEpisodeList(filtered);
}

// --- RANDOM MOVIE PICKER ---
let pickerItems = [];

function openRandomPicker() {
    const modal = document.getElementById('random-picker-modal');
    if (!modal) return;
    modal.classList.add('active');

    // Set default filter
    document.querySelectorAll('.picker-filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.picker-filter-btn[data-filter="all"]')?.classList.add('active');

    fetchAPI('/trending/all/week').then(data => {
        if (data && data.results) {
            pickerItems = data.results.filter(i => i.poster_path).slice(0, 20);
            renderPickerReel();
        }
    });
}

function renderPickerReel() {
    const reel = document.getElementById('picker-reel');
    if (!reel) return;
    reel.innerHTML = '';
    reel.style.transform = 'translateY(0)';
    reel.style.transition = 'none';

    // Clear previous result
    const resultBox = document.getElementById('picker-result');
    if (resultBox) resultBox.innerHTML = '';

    pickerItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'picker-reel-item';
        const posterUrl = item.poster_path.startsWith('http') ? item.poster_path : `https://image.tmdb.org/t/p/w342${item.poster_path}`;
        div.innerHTML = `<img src="${posterUrl}" alt="${item.title || item.name}" loading="lazy">`;
        reel.appendChild(div);
    });
}

function spinPicker() {
    if (!pickerItems.length) return;
    const reel = document.getElementById('picker-reel');
    if (!reel) return;

    // Reset state
    reel.querySelectorAll('.picker-reel-item').forEach(i => i.classList.remove('selected'));
    const resultBox = document.getElementById('picker-result');
    if (resultBox) resultBox.innerHTML = '';

    const targetIndex = Math.floor(Math.random() * pickerItems.length);
    const itemHeight = 200; // approximate height of each reel item
    const totalSpins = pickerItems.length * 3; // spin 3 full rounds
    const targetOffset = -((totalSpins + targetIndex) * itemHeight);

    // Duplicate items for smooth spinning
    const existingItems = reel.innerHTML;
    for (let i = 0; i < 3; i++) {
        reel.innerHTML += existingItems;
    }

    reel.style.transition = 'none';
    reel.style.transform = 'translateY(0)';
    reel.offsetHeight; // force reflow

    reel.style.transition = 'transform 1.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
    reel.style.transform = `translateY(${targetOffset}px)`;

    setTimeout(() => {
        const selected = pickerItems[targetIndex];
        if (!selected) return;

        // Mark selected
        const allItems = reel.querySelectorAll('.picker-reel-item');
        const selectedItem = allItems[totalSpins + targetIndex];
        if (selectedItem) selectedItem.classList.add('selected');

        // Show result card
        const selType = selected.media_type || (selected.name ? 'tv' : 'movie');
        const selTitle = selected.title || selected.name;
        const selRating = selected.vote_average ? selected.vote_average.toFixed(1) : 'N/A';
        const selGenres = '';
        const selDesc = selected.overview ? (selected.overview.length > 150 ? selected.overview.substring(0, 150) + '...' : selected.overview) : '';
        const selPoster = selected.poster_path ? `https://image.tmdb.org/t/p/w342${selected.poster_path}` : '';

        if (resultBox) {
            resultBox.innerHTML = `
                <div class="picker-result-card">
                    <img src="${selPoster}" alt="${selTitle}" class="picker-result-poster">
                    <div class="picker-result-info">
                        <h3>${selTitle}</h3>
                        <div class="picker-result-meta"><i class="fas fa-star" style="color:#f5c518"></i> ${selRating}</div>
                        <p>${selDesc}</p>
                        <div class="picker-result-actions">
                            <button class="btn btn-primary" onclick="openPlayer('${selected.id}', '${selType}'); closeRandomPicker();"><i class="fas fa-play"></i> Watch Now</button>
                            <button class="btn btn-glass" onclick="spinPicker()"><i class="fas fa-dice"></i> Spin Again</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }, 1600);
}

function setPickerFilter(filter) {
    document.querySelectorAll('.picker-filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.picker-filter-btn[data-filter="${filter}"]`)?.classList.add('active');

    let endpoint;
    switch (filter) {
        case 'movie': endpoint = '/trending/movie/week'; break;
        case 'tv': endpoint = '/trending/tv/week'; break;
        case 'anime': endpoint = '/discover/tv?with_genres=16&with_origin_country=JP'; break;
        default: endpoint = '/trending/all/week'; break;
    }

    fetchAPI(endpoint).then(data => {
        if (data && data.results) {
            pickerItems = data.results.filter(i => i.poster_path).slice(0, 20);
            renderPickerReel();
        }
    });
}

function closeRandomPicker() {
    const modal = document.getElementById('random-picker-modal');
    if (modal) modal.classList.remove('active');
}

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
window.openRandomPicker = openRandomPicker;
window.spinPicker = spinPicker;
window.closeRandomPicker = closeRandomPicker;
window.setPickerFilter = setPickerFilter;
window.filterEpisodes = filterEpisodes;
window.toggleDescription = toggleDescription;
