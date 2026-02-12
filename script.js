// --- CONFIGURATION ---
const API_KEY = 'c4b5b98972e172e60b95507bda07891b';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
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
let playerState = { id: null, type: null, season: 1, episode: 1 };
let seasonData = [];
let episodeView = 'list';

// --- SERVERS (YOUR CUSTOM LIST) ---
const servers = [
    { name: "StreameX", url: (id, type, s, e) => type === 'movie' ? `https://embed.wplay.me/embed/movie/${id}` : `https://embed.wplay.me/embed/tv/${id}/${s}/${e}` },
    { name: "Fast Server", url: (id, type, s, e) => `https://player.videasy.net/${type}/${id}` + (type === 'tv' ? `/${s}/${e}` : '') },
    { name: "Multi Server", url: (id, type, s, e) => type === 'movie' ? `https://watch.rivestream.app/embed?type=movie&id=${id}` : `https://watch.rivestream.app/embed?type=tv&id=${id}&season=${s}&episode=${e}` },
    { name: "VidSrc", url: (id, type, s, e) => type === 'movie' ? `https://vidsrc.me/embed/movie?tmdb=${id}` : `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
    { name: "Server 5", url: (id, type, s, e) => type === 'movie' ? `https://primesrc.me/embed/movie?tmdb=${id}` : `https://primesrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
    { name: "Vidpro", url: (id, type, s, e) => type === 'movie' ? `https://vidking.net/embed/movie/${id}` : `https://vidking.net/embed/tv/${id}/${s}/${e}` },
    { name: "CStream", url: (id, type, s, e) => type === 'movie' ? `https://zxcstream.xyz/player/movie/${id}/?autoplay=false&back=true&server=0` : `https://zxcstream.xyz/player/tv/${id}/${s}/${e}/?autoplay=false&back=true&server=0` },
    { name: "Vidking", url: (id, type, s, e) => type === 'movie' ? `https://vidrock.net/movie/${id}` : `https://vidrock.net/tv/${id}/${s}/${e}` },
];

// --- INITIALIZATION ---
window.onload = async () => {
    // 1. Initialize Firebase
    if (window.firebaseModules) {
        const { initializeApp, getAuth, getFirestore, onAuthStateChanged } = window.firebaseModules;
        const app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        // Auth Listener: Runs whenever user logs in or out
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            updateAuthUI(user);
            if (user) showToast(`Welcome back, ${user.displayName.split(' ')[0]}!`);

            // Refresh libraries if they are open
            if (document.getElementById('view-watchlist').classList.contains('active')) renderLibrary('watchlist-grid', 'watchlist');
            if (document.getElementById('view-history').classList.contains('active')) renderLibrary('history-grid', 'history');

            if (document.getElementById('view-home').classList.contains('active')) {
                refreshHomeHistory();
            }
        });
    }

    loadSettings();
    applyTheme();

    // 2. Settings API
    try {
        await populateSettingsAPI();
    } catch (error) {
        console.error("Settings API Error:", error);
        addFallbackSettings();
    }

    // 3. Check for Deep Links (Initial Load)
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');

    if (type && id) {
        // We pass 'true' to skipPush here so we don't duplicate the history entry on load
        openPlayer(id, type, true);
    } else {
        router('home');
    }

    // 4. Inject Login Button
    injectLoginUI();

    // Anti-DevTools Logic
    document.addEventListener('keydown', function (e) {
        if (e.keyCode == 123) { e.preventDefault(); }
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { e.preventDefault(); }
        if (e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) { e.preventDefault(); }
        if (e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) { e.preventDefault(); }
    });

    // --- BROWSER BACK BUTTON LISTENER ---
    // This handles when the user presses the physical Back/Forward button
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type');
        const id = params.get('id');

        if (type && id) {
            // If URL has params, open player (skipPush = true)
            openPlayer(id, type, true);
        } else {
            // If URL is clean, return to Home
            // 1. Hide Player
            document.getElementById('view-player').classList.remove('active');
            document.getElementById('iframe-box').innerHTML = ''; // Stop video

            // 2. Show Home
            router('home');
        }
    });
};
// --- AUTH LOGIC ---
async function login() {
    const { GoogleAuthProvider, signInWithPopup } = window.firebaseModules;
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error(error);
        showToast("Login Failed", "error");
    }
}

async function logout() {
    const { signOut } = window.firebaseModules;
    await signOut(auth);
    showToast("Logged Out");
    router('home');
}

// --- UPDATED: INJECT LOGIN UI (Desktop & Mobile) ---
function injectLoginUI() {
    // 1. DESKTOP (Sidebar)
    const sidebar = document.querySelector('.sidebar');
    const logo = document.querySelector('.logo');
    if (sidebar && logo && !document.getElementById('auth-container')) {
        const authContainer = document.createElement('div');
        authContainer.id = 'auth-container';
        sidebar.insertBefore(authContainer, logo.nextSibling);
    }

    // 2. MOBILE (Main Content Overlay)
    const mainContent = document.querySelector('.main-content');
    if (mainContent && !document.getElementById('mobile-auth-container')) {
        const mobContainer = document.createElement('div');
        mobContainer.id = 'mobile-auth-container';
        // Insert at the very top of main content (above the slider)
        mainContent.insertBefore(mobContainer, mainContent.firstChild);
    }
}

// --- UPDATED: HANDLE LOGIN STATE UI ---
function updateAuthUI(user) {
    // 1. Update DESKTOP Sidebar
    const deskContainer = document.getElementById('auth-container');
    if (deskContainer) {
        if (user) {
            // Full Profile Card
            deskContainer.innerHTML = `
                <div class="user-profile" onclick="logout()" title="Logout">
                    <img src="${user.photoURL}" class="user-avatar">
                    <div class="user-name">${user.displayName}</div>
                    <i class="fas fa-sign-out-alt" style="margin-left:auto; font-size:12px; color:#666;"></i>
                </div>
            `;
        } else {
            // Normal Login Button
            deskContainer.innerHTML = `
                <button class="login-btn" onclick="login()" style="margin-bottom:20px;">
                    <i class="fab fa-google"></i> Sign in to Sync
                </button>
            `;
        }
    }

    // 2. Update MOBILE Overlay
    const mobContainer = document.getElementById('mobile-auth-container');
    if (mobContainer) {
        if (user) {
            // JUST the Circle Picture
            mobContainer.innerHTML = `
                <div class="user-profile" onclick="logout()">
                    <img src="${user.photoURL}" class="user-avatar" title="${user.displayName}">
                </div>
            `;
        } else {
            // Compact Login Button
            mobContainer.innerHTML = `
                <button class="login-btn" onclick="login()">
                    <i class="fab fa-google"></i> Sign In
                </button>
            `;
        }
    }
}

// --- DATABASE LOGIC (SYNC) ---
async function toggleLib(key, id, type, title, poster) {
    // 1. Firebase Sync
    if (currentUser && db) {
        const { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } = window.firebaseModules;
        const userRef = doc(db, "users", currentUser.uid);

        try {
            const docSnap = await getDoc(userRef);
            let currentList = [];

            // Create user doc if it doesn't exist
            if (!docSnap.exists()) {
                await setDoc(userRef, { watchlist: [], history: [] });
            } else {
                currentList = docSnap.data()[key] || [];
            }

            const exists = currentList.find(i => i.id == id);

            if (exists) {
                // Remove
                await updateDoc(userRef, { [key]: arrayRemove(exists) });
                if (key === 'watchlist') showToast("Removed from Cloud Watchlist");
            } else {
                // Add
                const newItem = { id, type, title, poster };
                await updateDoc(userRef, { [key]: arrayUnion(newItem) });
                if (key === 'watchlist') showToast("Saved to Cloud Watchlist");
            }

            if (key === 'watchlist') updateWatchlistBtnStyles(id);

        } catch (e) {
            console.error("Sync Error", e);
            showToast("Sync Error: " + e.message, "error");
        }
    } else {
        // 2. LocalStorage Fallback
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
        // Fetch from Firebase
        const { doc, getDoc } = window.firebaseModules;
        const userRef = doc(db, "users", currentUser.uid);
        try {
            const docSnap = await getDoc(userRef);
            if (docSnap.exists()) {
                list = docSnap.data()[key] || [];
                // Sort history by newest first
                if (key === 'history') list.reverse();
            }
        } catch (e) { console.error("Fetch Error", e); }
    } else {
        // Fetch from LocalStorage
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
    langs.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.iso_639_1; opt.innerText = l.english_name;
        langSelect.appendChild(opt);
    });

    const countryRes = await fetch(`${BASE_URL}/configuration/countries?api_key=${API_KEY}`);
    const countries = await countryRes.json();
    countries.sort((a, b) => a.english_name.localeCompare(b.english_name));

    regionSelect.innerHTML = '';
    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.iso_3166_1; opt.innerText = c.english_name;
        regionSelect.appendChild(opt);
    });

    langSelect.value = appSettings.lang || 'en';
    regionSelect.value = appSettings.region || 'IN';
}

function addFallbackSettings() {
    const langSelect = document.getElementById('set-lang');
    const regionSelect = document.getElementById('set-region');
    if (langSelect) langSelect.innerHTML = '<option value="en">English</option>';
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
    // --- NEW: URL CLEANUP ---
    // If we have query params (like ?id=123) and we are navigating via buttons, clear them.
    if (window.location.search.length > 0) {
        const cleanURL = window.location.pathname;
        window.history.pushState({}, '', cleanURL);
    }
    // ------------------------

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.b-nav-item').forEach(el => el.classList.remove('active'));

    // Stop video if leaving player
    if (viewName !== 'player') {
        document.getElementById('iframe-box').innerHTML = ''; // Kill iframe to stop audio
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

// --- API HELPER (SMART CACHING) ---
async function fetchAPI(endpoint) {
    const CACHE_DURATION = 1000 * 60 * 60; // 1 Hour
    const cacheKey = 'api_cache_' + endpoint;

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) return data;
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const config = `language=${appSettings.lang}&include_adult=${appSettings.adult}`;

    try {
        const res = await fetch(`${BASE_URL}${endpoint}${separator}api_key=${API_KEY}&${config}`);
        const data = await res.json();
        if (data && !data.success === false) {
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data }));
        }
        return data;
    } catch (e) {
        console.error("API Error:", e);
        return { results: [] };
    }
}

// --- NEW FUNCTION: Handles History Rendering Separately ---
async function refreshHomeHistory() {
    const continueSection = document.getElementById('continue-watching-section');
    if (!continueSection) return;

    let historyList = [];

    if (currentUser && db) {
        // Logged In? Fetch from Cloud
        try {
            const { doc, getDoc } = window.firebaseModules;
            const docSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (docSnap.exists()) {
                historyList = docSnap.data().history || [];
            }
        } catch (e) { console.error("Cloud History Error:", e); }
    } else {
        // Logged Out? Fetch from LocalStorage
        historyList = getLib('history');
    }

    // Sort Newest First
    if (historyList && historyList.length > 0) {
        historyList.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        continueSection.style.display = 'block';
        renderGrid(historyList.slice(0, 4), 'home-history');
    } else {
        continueSection.style.display = 'none';
    }
}

// --- HOME PAGE ---
async function loadHome() {
    // 1. Show Skeletons Instantly
    showSkeletons('hero-slider', 1);
    showSkeletons('home-bollywood', 6);
    showSkeletons('home-hollywood', 6);
    showSkeletons('home-tv', 6);

    // Show skeleton for history too
    const continueSection = document.getElementById('continue-watching-section');
    if (continueSection) {
        continueSection.style.display = 'block';
        showSkeletons('home-history', 4);
    }

    const today = new Date().toISOString().split('T')[0];
    const currentRegion = appSettings.region || 'IN';

    // Set Titles
    const regionSelect = document.getElementById('set-region');
    let regionName = "Local";
    if (regionSelect && regionSelect.selectedIndex > -1) regionName = regionSelect.options[regionSelect.selectedIndex].text;
    const titleEl = document.getElementById('local-title');
    if (titleEl) titleEl.innerText = `Latest ${regionName} Movies`;
    const hTitle = document.querySelectorAll('.section-title')[1];
    if (hTitle) hTitle.innerText = (currentRegion !== 'US') ? "Latest Hollywood" : "Trending Worldwide";

    // Prepare Queries
    const localQuery = `/discover/movie?with_origin_country=${currentRegion}&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&vote_count.gte=5`;
    const hollyQuery = currentRegion !== 'US'
        ? `/discover/movie?with_origin_country=US&primary_release_date.lte=${today}&sort_by=primary_release_date.desc&vote_count.gte=5`
        : '/movie/trending/week';

    // 2. Fetch All in Parallel
    // We wrap this in try-catch to ensure we don't crash if API fails
    try {
        const [trending, localMovies, hollyData, tvShows] = await Promise.all([
            fetchAPI('/trending/all/week'),
            fetchAPI(localQuery),
            fetchAPI(hollyQuery),
            fetchAPI('/trending/tv/week')
        ]);

        // 3. Render Content IMMEDIATELY (So page is never empty)
        let slides = [];
        if (trending && trending.results) {
            const validSlides = trending.results.filter(item => item.backdrop_path);
            slides = validSlides.slice(0, 5);
        }
        renderSlider(slides);

        renderGrid(localMovies ? localMovies.results : [], 'home-bollywood');
        renderGrid(hollyData ? hollyData.results : [], 'home-hollywood');
        renderGrid(tvShows ? tvShows.results : [], 'home-tv', 'tv');

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
        const bg = item.backdrop_path ? `${IMG_ORIG}${item.backdrop_path}` : '';
        const title = item.title || item.name;
        const activeClass = index === 0 ? 'active' : '';
        const type = item.media_type || (item.name ? 'tv' : 'movie');

        const slide = document.createElement('div');
        slide.className = `slide ${activeClass}`;
        slide.style.backgroundImage = `url(${bg})`;
        slide.innerHTML = `
            <div class="hero-content">
                <div style="margin-bottom:10px;">
                    <span style="background:var(--accent); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:12px;">#${index + 1} Spotlight</span>
                </div>
                <div class="hero-title">${title}</div>
                <div class="hero-desc">${item.overview || ''}</div>
                <button class="btn btn-primary" onclick="openPlayer('${item.id}', '${type}')"><i class="fas fa-play"></i> Watch Now</button>
            </div>
        `;
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

// --- CATEGORIES ---
async function loadMoviesPage() {
    showSkeletons('movies-popular', 6);
    showSkeletons('movies-top', 6);
    showSkeletons('movies-action', 6);

    const [popular, topRated, action] = await Promise.all([
        fetchAPI('/movie/popular'),
        fetchAPI('/movie/top_rated'),
        fetchAPI('/discover/movie?with_genres=28')
    ]);

    renderGrid(popular.results, 'movies-popular', 'movie');
    renderGrid(topRated.results, 'movies-top', 'movie');
    renderGrid(action.results, 'movies-action', 'movie');
}

async function loadTVPage() {
    showSkeletons('tv-airing', 6);
    showSkeletons('tv-top', 6);

    const [trending, popular] = await Promise.all([
        fetchAPI('/tv/on_the_air'),
        fetchAPI('/tv/top_rated')
    ]);

    renderGrid(trending.results, 'tv-airing', 'tv');
    renderGrid(popular.results, 'tv-top', 'tv');
}

async function loadAnimePage() {
    showSkeletons('anime-trending', 6);
    showSkeletons('anime-popular', 6);

    const [trending, popular] = await Promise.all([
        fetchAPI('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc'),
        fetchAPI('/discover/tv?with_genres=16&with_origin_country=JP&sort_by=vote_count.desc')
    ]);

    renderGrid(trending.results, 'anime-trending', 'tv');
    renderGrid(popular.results, 'anime-popular', 'tv');
}

// --- GRID RENDERER ---
function renderGrid(items, containerId, forceType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = '<div style="color:#666; padding:20px;">No content found.</div>';
        return;
    }

    items.forEach(item => {
        const posterPath = item.poster_path || item.poster;
        if (!posterPath) return;

        const type = item.type || forceType || item.media_type || (item.name ? 'tv' : 'movie');
        const title = item.title || item.name;
        const dateStr = item.release_date || item.first_air_date || '';
        const year = dateStr ? dateStr.substring(0, 4) : '';

        const card = document.createElement('div');
        card.className = 'media-card';
        card.onclick = () => openPlayer(item.id, type);
        const ratingTag = item.vote_average ? `<div class="card-rating">${item.vote_average.toFixed(1)}</div>` : '';

        card.innerHTML = `
            <div class="poster">
                <img src="${posterPath.startsWith('http') ? posterPath : IMG_URL + posterPath}" loading="lazy" alt="${title}" onerror="this.style.display='none'">
                ${ratingTag}
                <div class="hover-overlay"><i class="fas fa-play-circle play-icon"></i></div>
            </div>
            <div class="media-title">${title}</div>
            <div class="media-year">${year} ${type === 'tv' ? '• TV' : ''}</div>
        `;
        container.appendChild(card);
    });
}

async function openPlayer(id, type, skipPush = false) {
    // 1. Initialize Default State
    playerState = { id, type, season: 1, episode: 1 };
    let preferredServer = 0; // Default to first server

    // 2. CHECK HISTORY (CLOUD FIRST)
    // This is the FIX: We check Firebase specifically for this item's progress
    let savedState = null;

    if (currentUser && db) {
        try {
            const { doc, getDoc } = window.firebaseModules;
            const docSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (docSnap.exists()) {
                const history = docSnap.data().history || [];
                // Find the specific show/movie in the cloud list
                savedState = history.find(i => i.id == id);
            }
        } catch (e) {
            console.error("Cloud Resume Error:", e);
        }
    }

    // Fallback: If not found in cloud (or not logged in), check LocalStorage
    if (!savedState) {
        savedState = getLib('history').find(i => i.id == id);
    }

    // 3. RESTORE PROGRESS (If found)
    if (savedState) {
        if (type === 'tv') {
            playerState.season = savedState.season || 1;
            playerState.episode = savedState.episode || 1;

            // Only show toast if we are actually resuming progress
            if (playerState.season > 1 || playerState.episode > 1) {
                showToast(`Resumed: S${playerState.season} E${playerState.episode}`, 'info');
            }
        }
        if (savedState.serverIdx !== undefined) {
            preferredServer = savedState.serverIdx;
        }
    }

    // 4. UI Setup & Navigation
    document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
    document.getElementById('view-player').classList.add('active');
    window.scrollTo(0, 0);

    // URL Management
    if (!skipPush) {
        const newUrl = `?type=${type}&id=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    // Loading State
    document.getElementById('iframe-box').innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center;"><i class="fas fa-spinner fa-spin" style="font-size:40px;"></i></div>';

    // 5. Fetch Details from API
    const data = await fetchAPI(`/${type}/${id}`);

    const title = data.title || data.name;
    const desc = data.overview;
    const poster = data.poster_path ? IMG_URL + data.poster_path : '';
    playerState.title = title;
    playerState.poster = poster;
    const year = (data.release_date || data.first_air_date || '').substring(0, 4);
    const genres = data.genres ? data.genres.map(g => g.name).slice(0, 2).join(', ') : '';
    const rating = data.vote_average ? data.vote_average.toFixed(1) : 'N/A';

    // Panels Setup
    const rightPanel = document.getElementById('episode-panel');
    const bottomDetails = document.querySelector('.media-details-box');
    if (rightPanel) rightPanel.innerHTML = '';
    if (bottomDetails) bottomDetails.innerHTML = '';

    // --- MOVIE LAYOUT ---
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
        // --- TV SHOW LAYOUT ---
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

        // TV Logic: Populate Seasons
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
            // Select the RESTORED season
            sSelect.value = playerState.season;
        }

        // Load the SPECIFIC season
        await loadSeason(playerState.season);

        // Auto-scroll to the saved episode
        setTimeout(() => {
            const activeEp = document.querySelector('.ep-item.active');
            if (activeEp) activeEp.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 500);
    }

    // 7. Final Player Launch
    renderServers();

    // Load the PREFERRED/RESTORED server
    loadVideo(preferredServer);

    // 8. Recommendations
    const recs = await fetchAPI(`/${type}/${id}/recommendations`);
    renderGrid(recs.results.slice(0, 12), 'player-recommendations');
}

// --- PLAYER HELPERS ---
function setupWatchlistBtn(id, btnId, type, title, poster) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    // Check initial state
    updateWatchlistBtnStyles(id, btnId);

    btn.onclick = () => {
        toggleLib('watchlist', id, type, title, poster);
        // Small delay to allow sync to happen then update UI
        setTimeout(() => updateWatchlistBtnStyles(id, btnId), 500);
    };
}

async function updateWatchlistBtnStyles(id, btnId) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    let exists = false;
    // Check Firebase if logged in
    if (currentUser && db) {
        const { doc, getDoc } = window.firebaseModules;
        try {
            const snap = await getDoc(doc(db, "users", currentUser.uid));
            if (snap.exists()) {
                const list = snap.data().watchlist || [];
                exists = list.find(i => i.id == id);
            }
        } catch (e) { }
    } else {
        // Fallback
        exists = getLib('watchlist').find(i => i.id == id);
    }

    if (exists) {
        btn.innerHTML = '<i class="fas fa-check"></i> Added';

        // Handle Movie Button (s-btn)
        if (btn.classList.contains('s-btn')) {
            btn.classList.remove('s-btn-red');
            btn.classList.add('s-btn-gray'); // Turn Gray
        }
        // Handle TV Button (btn-primary)
        else if (btn.classList.contains('btn-primary')) {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-glass'); // Turn Glass/Gray
        }
    } else {
        btn.innerHTML = '<i class="far fa-heart"></i> Watchlist';

        // Handle Movie Button
        if (btn.classList.contains('s-btn')) {
            btn.classList.remove('s-btn-gray');
            btn.classList.add('s-btn-red'); // Turn Red
        }
        // Handle TV Button
        else if (btn.classList.contains('btn-glass')) {
            btn.classList.remove('btn-glass');
            btn.classList.add('btn-primary'); // Turn Red
        }
    }
}

function shareContent(title) {
    if (navigator.share) {
        navigator.share({
            title: 'Watch on StreameX',
            text: `Check out "${title}" on StreameX!`,
            url: window.location.href
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href);
        showToast('Link copied!');
    }
}

async function loadSeason(seasonNum) {
    playerState.season = seasonNum;
    const box = document.getElementById('episode-list-box');
    if (box) box.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i></div>';

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
            loadVideo(0);
        };
        const imgUrl = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : '';

        if (episodeView === 'list') {
            div.innerHTML = `<div class="ep-number">${ep.episode_number}</div><div class="ep-info"><div class="ep-title">${ep.name}</div></div>`;
        } else {
            div.innerHTML = `
                <div class="ep-thumb">${imgUrl ? `<img src="${imgUrl}" loading="lazy">` : '<div style="width:100%;height:100%;background:#222;"></div>'}</div>
                <div class="ep-info"><div class="ep-title"><span style="color:var(--accent); font-weight:bold;">${ep.episode_number}.</span> ${ep.name}</div></div>
            `;
        }
        box.appendChild(div);
    });
}

function closePlayer() {
    document.getElementById('iframe-box').innerHTML = '<div style="color:#666;">Player Closed</div>';
    // We don't need history.pushState here anymore, router('home') will clean the URL.
    router('home');
}

function renderServers() {
    const list = document.getElementById('server-list');
    if (!list) return;
    list.innerHTML = '';
    servers.forEach((srv, idx) => {
        const btn = document.createElement('div');
        btn.className = `server-btn ${idx === 0 ? 'active' : ''}`;
        btn.innerHTML = `<i class="fas fa-play"></i> ${srv.name}`;
        btn.onclick = () => {
            document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadVideo(idx);
        }
        list.appendChild(btn);
    });
}

function loadVideo(serverIdx) {
    const iframeBox = document.getElementById('iframe-box');

    // 2. Save Progress (Episode & Server)
    if (!playerState) playerState = { season: 1, episode: 1 };
    updateHistory(serverIdx);

    // 3. Play Video
    const srv = servers[serverIdx];
    const url = srv.url(playerState.id, playerState.type, playerState.season, playerState.episode);
    iframeBox.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;

    // Update UI buttons
    document.querySelectorAll('.server-btn').forEach((b, i) => {
        b.classList.toggle('active', i === serverIdx);
    });
}

// --- LOCAL STORAGE HELPERS ---
function getLib(key) { return JSON.parse(localStorage.getItem('streamex_' + key)) || []; }
function saveLib(key, data) { localStorage.setItem('streamex_' + key, JSON.stringify(data)); }

function addToLib(key, item) {
    let list = getLib(key);
    list = list.filter(i => i.id != item.id);
    list.unshift(item);
    if (key === 'history' && list.length > 50) list.pop();
    saveLib(key, list);
}

// --- SEARCH & MOBILE HELPERS ---
function handleSearch(e) {
    if (e.key === 'Enter') {
        const query = e.target.value;
        if (!query) return;
        let resultContainerId = 'search-res';
        if (document.getElementById('view-mobile-search')?.classList.contains('active')) {
            resultContainerId = 'mobile-search-results';
        } else {
            router('movies');
            document.getElementById('view-movies').innerHTML = `<h1>Results: "${query}"</h1><div class="media-grid" id="search-res"></div>`;
        }
        fetchAPI(`/search/multi?query=${encodeURIComponent(query)}`).then(data => {
            const filtered = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
            renderGrid(filtered, resultContainerId);
        });
    }
}

function toggleMobileMenu() { document.getElementById('mobile-menu-overlay')?.classList.toggle('active'); }
function openMobileSearch() {
    document.getElementById('mobile-menu-overlay')?.classList.remove('active');
    router('mobile-search');
    setTimeout(() => { document.getElementById('mobile-search-input')?.focus(); }, 100);
}
function clearData(key) {
    if (confirm('Are you sure?')) {
        localStorage.removeItem('streamex_' + key);
        location.reload();
    }
}

// --- TOAST & SKELETONS ---
function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? '<i class="fas fa-check-circle" style="color:#4caf50;"></i>' : '<i class="fas fa-info-circle" style="color:#2196f3;"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) container.remove();
    }, 3000);
}

function showSkeletons(containerId, count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        container.innerHTML += `<div class="media-card sk-card"><div class="poster skeleton sk-poster"></div><div class="skeleton sk-text"></div><div class="skeleton sk-meta"></div></div>`;
    }
}

// --- SMART SEARCH LOGIC ---
let searchTimer;

function handleSmartSearch(query) {
    // 1. Clear previous timer
    clearTimeout(searchTimer);

    // --- NEW: HANDLE EMPTY INPUT (RESET) ---
    if (!query || query.trim().length === 0) {
        // Check if we are currently in the Mobile Search View
        const mobileView = document.getElementById('view-mobile-search');

        if (mobileView && mobileView.classList.contains('active')) {
            // Mobile: Just clean the page (clear results), stay on search tab
            const results = document.getElementById('mobile-search-results');
            if (results) results.innerHTML = '';
        } else {
            // Desktop: Switch back to Home view immediately
            router('home');
        }
        return; // Stop here
    }
    // ---------------------------------------

    // 2. Minimum length check (don't search for 1 letter)
    if (query.length < 2) return;

    // 3. Wait 500ms after user stops typing then search
    searchTimer = setTimeout(() => {
        performLiveSearch(query);
    }, 500);
}

function performLiveSearch(query) {
    let resultContainerId = 'search-res';
    const mobileView = document.getElementById('view-mobile-search');

    if (mobileView && mobileView.classList.contains('active')) {
        resultContainerId = 'mobile-search-results';
    } else {
        router('movies');
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

// --- INTELLIGENT HISTORY UPDATE ---
async function updateHistory(serverIdx) {
    // 1. Create Detailed History Object
    const item = {
        id: playerState.id,
        type: playerState.type,
        title: playerState.title || "Unknown Title",
        poster: playerState.poster || "",
        season: playerState.season,   // Save exact Season
        episode: playerState.episode, // Save exact Episode
        serverIdx: serverIdx,         // Save exact Server used
        savedAt: Date.now()
    };

    // 2. Sync to Firebase or LocalStorage
    if (currentUser && db) {
        const { doc, getDoc, updateDoc } = window.firebaseModules;
        const userRef = doc(db, "users", currentUser.uid);
        try {
            const docSnap = await getDoc(userRef);
            let history = docSnap.exists() ? (docSnap.data().history || []) : [];
            history = history.filter(i => i.id != item.id); // Remove old
            history.unshift(item); // Add new to top
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

// --- DOWNLOAD LOGIC ---
function downloadContent() {
    const { id, type, season, episode } = playerState;
    let downloadUrl = "";

    if (type === 'movie') {
        // Construct Movie Download URL
        downloadUrl = `https://dl.vidsrc.vip/movie/${id}`;
    } else {
        // Construct TV Series Download URL
        downloadUrl = `https://dl.vidsrc.vip/tv/${id}/${season}/${episode}`;
    }

    // Open the download link in a new tab
    window.open(downloadUrl, '_blank');
}

// --- EXPOSE FUNCTIONS TO HTML (REQUIRED FOR MODULES) ---
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
