// --- CONFIGURATION ---
const API_KEY = 'c4b5b98972e172e60b95507bda07891b';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w342';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';

// --- FIREBASE CONFIG (YOURS) ---
const firebaseConfig = {
    apiKey: "AIzaSyCvJxtMLl-M21Kpi5JkcpioLGI9RMwD3R0",
    authDomain: "streamex-v1.firebaseapp.com",
    projectId: "streamex-v1",
    storageBucket: "streamex-v1.firebasestorage.app",
    messagingSenderId: "87040295346",
    appId: "1:87040295346:web:4369ebb00242756e5f24ab"
};

// --- GLOBAL VARIABLES ---
let auth, db, currentUser = null;
let appSettings = { theme: 'dark', lang: 'en', region: 'IN', adult: 'false' };
let currentSlide = 0;
let slideInterval;
// Added 'anilistId' and 'isAnime' to playerState
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


// --- SERVERS (YOUR CUSTOM LIST) ---
const servers = [
    // --- ANIME SERVERS (Require Anilist ID) ---
    { name: "VidNest (Sub)", isAnime: true, url: () => `https://vidnest.fun/anime/${playerState.anilistId}/${playerState.episode}/sub` },
    { name: "VidNest (Dub)", isAnime: true, url: () => `https://vidnest.fun/anime/${playerState.anilistId}/${playerState.episode}/dub` },
    { name: "Anime (Sub)", isAnime: true, url: () => `https://vidnest.fun/animepahe/${playerState.anilistId}/${playerState.episode}/sub` },
    { name: "Anime (Dub)", isAnime: true, url: () => `https://vidnest.fun/animepahe/${playerState.anilistId}/${playerState.episode}/dub` },
    { name: "VidLink (Sub)", isAnime: true, url: () => `https://vidlink.pro/anime/${playerState.anilistId}/${playerState.episode}/sub` },
    { name: "VidLink (Dub)", isAnime: true, url: () => `https://vidlink.pro/anime/${playerState.anilistId}/${playerState.episode}/dub` },
    // --- MOVIE/TV SERVERS ---
    { name: "StreameX", url: (id, type, s, e) => type === 'movie' ? `https://embed.wplay.me/embed/movie/${id}` : `https://embed.wplay.me/embed/tv/${id}/${s}/${e}` },
    { name: "Fast Server", url: (id, type, s, e) => `https://player.videasy.net/${type}/${id}` + (type === 'tv' ? `/${s}/${e}` : '') },
    { name: "Multi Server", url: (id, type, s, e) => type === 'movie' ? `https://watch.rivestream.app/embed?type=movie&id=${id}` : `https://watch.rivestream.app/embed?type=tv&id=${id}&season=${s}&episode=${e}` },
    { name: "VidSrc", url: (id, type, s, e) => type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
    { name: "Server 5", url: (id, type, s, e) => type === 'movie' ? `https://primesrc.me/embed/movie?tmdb=${id}` : `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
    { name: "Vidpro", url: (id, type, s, e) => type === 'movie' ? `https://vidking.net/embed/movie/${id}` : `https://vidking.net/embed/tv/${id}/${s}/${e}` },
    { name: "CStream", url: (id, type, s, e) => type === 'movie' ? `https://zxcstream.xyz/player/movie/${id}/?autoplay=false&back=true&server=0` : `https://zxcstream.xyz/player/tv/${id}/${s}/${e}/?autoplay=false&back=true&server=0` },
    { name: "Vidking", url: (id, type, s, e) => type === 'movie' ? `https://vidrock.net/movie/${id}` : `https://vidrock.net/tv/${id}/${s}/${e}` },
    { name: "Vidlink", url: (id, type, s, e) => type === 'movie' ? `https://vidlink.pro/movie/${id}` : `https://vidlink.pro/tv/${id}/${s}/${e}` },
    { name: "Vidnest", url: (id, type, s, e) => type === 'movie' ? `https://vidnest.fun/movie/${id}` : `https://vidnest.fun/tv/${id}/${s}/${e}` },
    { name: "NontonGo", url: (id, type, s, e) => type === 'movie' ? `https://www.NontonGo.win/embed/movie/${id}` : `https://www.NontonGo.win/embed/tv/?id=${id}&s=${s}&e=${e}` },
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
    // 1. Initialize Firebase
    if (window.firebaseModules) {
        const { initializeApp, getAuth, getFirestore, onAuthStateChanged } = window.firebaseModules;
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Auth Listener
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            updateAuthUI(user);
            if (user) showToast(`Welcome back, ${user.displayName.split(' ')[0]}!`);

            if (document.getElementById('view-watchlist').classList.contains('active')) renderLibrary('watchlist-grid', 'watchlist');
            if (document.getElementById('view-history').classList.contains('active')) renderLibrary('history-grid', 'history');
            if (document.getElementById('view-home').classList.contains('active')) refreshHomeHistory();
        });
    }

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

    injectLoginUI();

    // // Anti-DevTools
    // document.addEventListener('keydown', function (e) {
    //     if (e.keyCode == 123) { e.preventDefault(); }
    //     if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { e.preventDefault(); }
    //     if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) { e.preventDefault(); }
    //     if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) { e.preventDefault(); }
    // });

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

// --- AUTH LOGIC ---
async function login() {
    const { GoogleAuthProvider, signInWithPopup } = window.firebaseModules;
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } catch (error) { console.error(error); showToast("Login Failed", "error"); }
}

async function logout() {
    const { signOut } = window.firebaseModules;
    await signOut(auth);
    showToast("Logged Out");
    router('home');
}

function injectLoginUI() {
    const sidebar = document.querySelector('.sidebar');
    const logo = document.querySelector('.logo');
    if (sidebar && logo && !document.getElementById('auth-container')) {
        const authContainer = document.createElement('div');
        authContainer.id = 'auth-container';
        sidebar.insertBefore(authContainer, logo.nextSibling);
    }
    const mainContent = document.querySelector('.main-content');
    if (mainContent && !document.getElementById('mobile-auth-container')) {
        const mobContainer = document.createElement('div');
        mobContainer.id = 'mobile-auth-container';
        mainContent.insertBefore(mobContainer, mainContent.firstChild);
    }
}

function updateAuthUI(user) {
    const deskContainer = document.getElementById('auth-container');
    if (deskContainer) {
        if (user) {
            deskContainer.innerHTML = `<div class="user-profile" onclick="logout()" title="Logout"><img src="${user.photoURL}" class="user-avatar"><div class="user-name">${user.displayName}</div><i class="fas fa-sign-out-alt" style="margin-left:auto; font-size:12px; color:#666;"></i></div>`;
        } else {
            deskContainer.innerHTML = `<button class="login-btn" onclick="login()" style="margin-bottom:20px;"><i class="fab fa-google"></i> Sign in to Sync</button>`;
        }
    }
    const mobContainer = document.getElementById('mobile-auth-container');
    if (mobContainer) {
        if (user) {
            mobContainer.innerHTML = `<div class="user-profile" onclick="logout()"><img src="${user.photoURL}" class="user-avatar" title="${user.displayName}"></div>`;
        } else {
            mobContainer.innerHTML = `<button class="login-btn" onclick="login()"><i class="fab fa-google"></i> Sign In</button>`;
        }
    }
}

// --- DATABASE LOGIC ---
async function toggleLib(key, id, type, title, poster) {
    if (currentUser && db) {
        const { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } = window.firebaseModules;
        const userRef = doc(db, "users", currentUser.uid);
        try {
            const docSnap = await getDoc(userRef);
            if (!docSnap.exists()) await setDoc(userRef, { watchlist: [], history: [] });
            const currentList = docSnap.data()[key] || [];
            const exists = currentList.find(i => i.id == id);
            if (exists) {
                await updateDoc(userRef, { [key]: arrayRemove(exists) });
                if (key === 'watchlist') showToast("Removed from Cloud Watchlist");
            } else {
                await updateDoc(userRef, { [key]: arrayUnion({ id, type, title, poster }) });
                if (key === 'watchlist') showToast("Saved to Cloud Watchlist");
            }
            if (key === 'watchlist') updateWatchlistBtnStyles(id);
        } catch (e) { console.error("Sync Error", e); showToast("Sync Error: " + e.message, "error"); }
    } else {
        let list = getLib(key);
        if (list.find(i => i.id == id)) {
            list = list.filter(i => i.id != id);
            if (key === 'watchlist') showToast("Removed from Device");
        } else {
            list.unshift({ id, type, title, poster });
            if (key === 'watchlist') showToast("Saved to Device");
        }
        saveLib(key, list);
        if (key === 'watchlist') updateWatchlistBtnStyles(id);
    }
}

async function renderLibrary(containerId, key) {
    const container = document.getElementById(containerId);
    showSkeletons(containerId, 6);
    let list = [];
    if (currentUser && db) {
        const { doc, getDoc } = window.firebaseModules;
        try {
            const docSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (docSnap.exists()) {
                list = docSnap.data()[key] || [];
                if (key === 'history') list.reverse();
            }
        } catch (e) { console.error("Fetch Error", e); }
    } else {
        list = getLib(key);
    }
    renderGrid(list, containerId, null);
}

// --- SETTINGS LOGIC ---
async function populateSettingsAPI() {
    const langSelect = document.getElementById('set-lang');
    const regionSelect = document.getElementById('set-region');
    if (!langSelect || !regionSelect) return;
    const langRes = await fetch(`${BASE_URL}/configuration/languages?api_key=${API_KEY}`);
    const langs = await langRes.json();
    langs.sort((a, b) => a.english_name.localeCompare(b.english_name));
    langSelect.innerHTML = '';
    langs.forEach(l => { const opt = document.createElement('option'); opt.value = l.iso_639_1; opt.innerText = l.english_name; langSelect.appendChild(opt); });
    const countryRes = await fetch(`${BASE_URL}/configuration/countries?api_key=${API_KEY}`);
    const countries = await countryRes.json();
    countries.sort((a, b) => a.english_name.localeCompare(b.english_name));
    regionSelect.innerHTML = '';
    countries.forEach(c => { const opt = document.createElement('option'); opt.value = c.iso_3166_1; opt.innerText = c.english_name; regionSelect.appendChild(opt); });
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

    // 2. TRACK HISTORY (The Fix)
    // Only save the view if we are NOT going to the player
    if (viewName !== 'player') {
        navState.view = viewName;
        // If we are navigating to a main page (like clicking "Home" or "Movies" in menu), 
        // we assume the user wants a fresh start, so we clear the search query.
        // (The search functions will put the query back if needed).
        if (viewName !== 'movies' && viewName !== 'mobile-search') {
            navState.query = null;
        }
    }

    // 3. Update UI (Existing Code)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
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
        window.scrollTo(0, 0);
        if (viewName === 'movies') loadMoviesPage();
        if (viewName === 'tv') loadTVPage();
        if (viewName === 'anime') loadAnimePage();
        if (viewName === 'watchlist') renderLibrary('watchlist-grid', 'watchlist');
        if (viewName === 'history') renderLibrary('history-grid', 'history');
    }
}

// --- API HELPER ---
async function fetchAPI(endpoint) {
    if (prefetchedData[endpoint]) {
        return prefetchedData[endpoint];
    }

    const res = await fetch(
        `https://streamex-proxy.snahasishdey141.workers.dev/?endpoint=${encodeURIComponent(endpoint)}`
    );
    return await res.json();
}


// --- HOME & CATEGORIES ---
async function refreshHomeHistory() {
    const continueSection = document.getElementById('continue-watching-section');
    if (!continueSection) return;
    let historyList = [];
    if (currentUser && db) {
        try {
            const { doc, getDoc } = window.firebaseModules;
            const docSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (docSnap.exists()) historyList = docSnap.data().history || [];
        } catch (e) { }
    } else {
        historyList = getLib('history');
    }
    if (historyList && historyList.length > 0) {
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
    const hTitle = document.querySelectorAll('.section-title')[1];
    if (hTitle) hTitle.innerText = (currentRegion !== 'US') ? "Latest Hollywood" : "Trending Worldwide";
    const localQuery = `/discover/movie?with_origin_country=${currentRegion}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&vote_count.gte=5`;
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
        });

        currentIndex += visibleCount;
    }

    renderBatch();

    // Scroll on window instead of container (important)
    window.addEventListener("scroll", handleScroll);

    function handleScroll() {
        if (
            window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 400
        ) {
            renderBatch();
        }
    }
}

// --- player---
async function openPlayer(id, type, skipPush = false) {
    // 1. Initialize Default State
    let preferredServer = -1;
    // Reset player state completely
    playerState = { id, type, season: 1, episode: 1, anilistId: null, isAnime: false };

    // 2. CHECK HISTORY (CLOUD FIRST)
    let savedState = null;
    if (currentUser && db) {
        try {
            const { doc, getDoc } = window.firebaseModules;
            const docSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (docSnap.exists()) {
                const history = docSnap.data().history || [];
                savedState = history.find(i => i.id == id);
            }
        } catch (e) { console.error("Cloud Resume Error:", e); }
    }
    // Fallback to local history
    if (!savedState) savedState = getLib('history').find(i => i.id == id);

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
            bottomDetails.innerHTML = `
                <div class="details-header">
                    <img src="${poster}" class="details-poster-img" alt="${title}">
                    <div class="details-text">
                        <h1>${title}</h1>
                        <div class="meta-tags">
                            <span class="tag-pill">${year}</span>
                            <span class="tag-pill" style="background:var(--accent)">${rating}</span>
                            <span>${genres}</span>
                        </div>
                        <p>${desc}</p>
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
        setTimeout(() => updateWatchlistBtnStyles(id, btnId), 500);
    };
}

async function updateWatchlistBtnStyles(id, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    let exists = false;
    if (currentUser && db) {
        const { doc, getDoc } = window.firebaseModules;
        try {
            const snap = await getDoc(doc(db, "users", currentUser.uid));
            if (snap.exists()) { const list = snap.data().watchlist || []; exists = list.find(i => i.id == id); }
        } catch (e) { }
    } else {
        exists = getLib('watchlist').find(i => i.id == id);
    }
    if (exists) {
        btn.innerHTML = '<i class="fas fa-check"></i> Added';
        if (btn.classList.contains('s-btn')) { btn.classList.remove('s-btn-red'); btn.classList.add('s-btn-gray'); }
        else if (btn.classList.contains('btn-primary')) { btn.classList.remove('btn-primary'); btn.classList.add('btn-glass'); }
    } else {
        btn.innerHTML = '<i class="far fa-heart"></i> Watchlist';
        if (btn.classList.contains('s-btn')) { btn.classList.remove('s-btn-gray'); btn.classList.add('s-btn-red'); }
        else if (btn.classList.contains('btn-glass')) { btn.classList.remove('btn-glass'); btn.classList.add('btn-primary'); }
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
            // Determine active server
            const currentServerBtn = document.querySelector('.server-btn.active');
            const serverIdx = currentServerBtn ? Array.from(currentServerBtn.parentNode.children).indexOf(currentServerBtn) : 0;
            loadVideo(serverIdx);
        };
        const imgUrl = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : '';
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

    let firstVisibleIndex = -1;

    servers.forEach((srv, idx) => {
        // --- STRICT FILTERING LOGIC ---

        // 1. If content is Regular (Not Anime), HIDE Anime servers
        if (!playerState.isAnime && srv.isAnime) return;

        // 2. If content IS Anime, HIDE Regular servers
        // (This was missing before!)
        if (playerState.isAnime && !srv.isAnime) return;

        // ------------------------------

        // Capture the index of the first valid server to make it active by default
        if (firstVisibleIndex === -1) firstVisibleIndex = idx;

        const btn = document.createElement('div');
        // Check if this is the currently active server (or the first valid one if none active)
        const isActive = (activeIdx !== -1) ? (idx === activeIdx) : (idx === firstVisibleIndex);

        btn.className = `server-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = `<i class="fas fa-play"></i> ${srv.name}`;

        btn.onclick = () => {
            document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadVideo(idx);
        }
        list.appendChild(btn);
    });

    // If we found a valid server, make sure the video loads for it
    if (firstVisibleIndex !== -1) {
        // Optional: Auto-load the first valid server if nothing is playing
        // loadVideo(firstVisibleIndex); 
    } else {
        list.innerHTML = '<div style="color:#fff; padding:10px;">No compatible servers found.</div>';
    }
}

function loadVideo(serverIdx) {
    const iframeBox = document.getElementById('iframe-box');
    if (!playerState) playerState = { season: 1, episode: 1 };
    updateHistory(serverIdx);
    const srv = servers[serverIdx];
    // Ensure we have a valid server
    if (!srv) return;

    const url = srv.url(playerState.id, playerState.type, playerState.season, playerState.episode);
    iframeBox.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
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
        // Ensure history knows we are in mobile search
        navState.view = 'mobile-search';
    } else {
        router('movies');
        // Restore query because router('movies') might have cleared it
        navState.query = query;

        const container = document.getElementById('view-movies');
        container.innerHTML = `
            <h1>Results for: "<span style="color:var(--accent)">${query}</span>"</h1>
            <div class="media-grid" id="search-res"></div>
        `;
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

async function updateHistory(serverIdx) {
    const item = { id: playerState.id, type: playerState.type, title: playerState.title || "Unknown Title", poster: playerState.poster || "", season: playerState.season, episode: playerState.episode, serverIdx: serverIdx, savedAt: Date.now() };
    if (currentUser && db) {
        const { doc, getDoc, updateDoc } = window.firebaseModules;
        const userRef = doc(db, "users", currentUser.uid);
        try {
            const docSnap = await getDoc(userRef);
            let history = docSnap.exists() ? (docSnap.data().history || []) : [];
            history = history.filter(i => i.id != item.id);
            history.unshift(item);
            if (history.length > 50) history.pop();
            await updateDoc(userRef, { history: history });
        } catch (e) { console.error("History Sync Error", e); }
    } else {
        let history = getLib('history');
        history = history.filter(i => i.id != item.id);
        history.unshift(item);
        if (history.length > 50) history.pop();
        saveLib('history', history);
    }
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

// Expose to HTML
window.toggleSidebar = toggleSidebar;

// --- EXPOSE TO HTML ---
window.router = router;
window.openPlayer = openPlayer;
window.login = login;
window.logout = logout;
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