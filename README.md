# 🎬 StreameX - Ultimate Streaming Hub

<div align="center">
  <img src="assets/icon-192.png" alt="StreameX Logo" width="120">
  <br>
  <div align="center">
  <a href="https://github.com/snahasishdey141/StreameX/releases/latest">
    <img src="https://img.shields.io/github/v/release/snahasishdey141/StreameX?style=for-the-badge&label=Download%20APK&color=green" alt="Download APK">
  </a>
</div>
  <b>Stream movies and TV shows in HD. No ads. registration required.</b>
  <br>
  <br>
  <a href="https://streamex.pages.dev/">Live Demo</a>
  ·
  <a href="#-getting-started">Setup Guide</a>
  ·
  <a href="#-key-features">Features</a>
</div>

---

## 📖 About The Project

**StreameX** is a modern, responsive web application that aggregates streaming links for Movies and TV Shows. Built with a focus on User Experience (UX), it utilizes the **TMDB API** for rich metadata and **Firebase** to sync user data across devices.

It operates as a Single Page Application (SPA) using vanilla JavaScript, offering a fast, app-like experience without page reloads.

## ✨ Key Features

* **📺 Massive Library:** Browse thousands of Movies, TV Shows, and Anime via The Movie Database (TMDB).
* **☁️ Cloud Sync:** Log in with Google to sync your **Watchlist** and **Watch History** across all your devices (Desktop & Mobile).
* **▶️ Multi-Server Support:** Auto-fetches video sources from multiple providers (VidSrc, RiveStream, etc.) to ensure content availability.
* **⏯️ Smart Resume:** Automatically remembers where you left off (Season, Episode, and Server).
* **🎨 Customization:** Toggle between **Dark/Light Mode**, change content region, and filter adult content.
* **📱 Fully Responsive:** Optimized layout for Desktop (Sidebar navigation) and Mobile (Bottom navigation & touch sliders).
* **🔍 Instant Search:** Live search functionality with skeleton loading states.
* **📥 Download Support:** Direct download options for offline viewing.
* **⚡ PWA Support:** Installable as a native app on Android/iOS via Progressive Web App standards.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Variables, Grid/Flexbox), JavaScript (ES6 Modules).
* **Backend / BaaS:** Firebase (Authentication, Cloud Firestore).
* **Data API:** TMDB (The Movie Database).
* **Hosting:** Cloudflare Pages (Recommended) or GitHub Pages.

## 🚀 Getting Started

To run this project locally, follow these steps:

### Prerequisites
* A code editor (VS Code recommended).
* A basic local web server (e.g., Live Server extension for VS Code).

### Installation

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/yourusername/streamex.git](https://github.com/yourusername/streamex.git)
    cd streamex
    ```

2.  **Configuration (Important)**
    You need to set up your own API keys for the app to function correctly. Open `script.js` and locate the configuration section at the top.

    **Step A: TMDB API**
    * Sign up at [The Movie Database](https://www.themoviedb.org/).
    * Go to Settings > API and generate an API Key.
    * Update `API_KEY` in `script.js`.

    **Step B: Firebase Setup**
    * Go to [Firebase Console](https://console.firebase.google.com/).
    * Create a new project.
    * Enable **Authentication** (Google Sign-In).
    * Enable **Cloud Firestore** (Create database in test mode or set appropriate rules).
    * Copy your Firebase SDK config and replace the `firebaseConfig` object in `script.js`.

    ```javascript
    // script.js
    const API_KEY = 'YOUR_TMDB_API_KEY';

    const firebaseConfig = {
        apiKey: "YOUR_FIREBASE_API_KEY",
        authDomain: "your-app.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-app.firebasestorage.app",
        messagingSenderId: "...",
        appId: "..."
    };
    ```

3.  **Run the App**
    * Open `index.html` with **Live Server** (or your preferred local server).
    * The app should now load, fetch data from TMDB, and allow login via Firebase.

## 📂 Project Structure

```text
streamex/
├── index.html          # Main HTML structure (Single Page)
├── style.css           # Global styles, Responsive design, Themes
├── script.js           # Core logic, API handling, Routing, Firebase
├── manifest.json       # PWA Configuration
├── assets/             # Icons and Logos
│   ├── logo.png
│   ├── icon-192.png
│   └── icon-512.png
└── .well-known/        # Android Asset Links (For TWA/PWA)
```

## ⚠️ Legal Disclaimer
**StreameX does not host any content.**
* This web application acts solely as a search engine and aggregator.
* It indexes publicly available links and embeds content from third-party sources (such as VidSrc, WPlay, etc.).
* StreameX has no control over the media files and accepts no responsibility for the legality of the content on linked sites.
* If you are a copyright owner, please contact the hosting provider directly to have the content removed.

## 🤝 Contributing
Contributions are welcome! If you have suggestions for new servers, UI improvements, or bug fixes:
 1. Fork the Project.
 2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
 3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
 4. Push to the Branch (`git push origin feature/AmazingFeature`).
 5. Open a Pull Request.

## 📄 License
Distributed under the MIT License. See `[LICENSE](LICENSE)` for more information.

---
<div align="center"> Made with ❤️ by <b>Snahasish Dey</b> </div>
