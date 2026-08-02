# 🍿 StreameX — The Ultimate Cross-Platform Streaming Hub

<div align="center">
  <img src="assets/icon-192.png" alt="StreameX Logo" width="130" style="border-radius: 24px;">
  <br>
  <h3>Stream Movies, TV Shows & Anime in HD — Anytime, Anywhere.</h3>
  <p>Available as a Native Android Application & Modern Web Platform.</p>

  <p align="center">
    <a href="https://github.com/snahasishdey141/StreameX/releases/latest">
      <img src="https://img.shields.io/github/v/release/snahasishdey141/StreameX?style=for-the-badge&label=Download%20Android%20APK&color=E50914&logo=android" alt="Download APK"></a>&nbsp;
    <a href="https://streamex.pages.dev/">
      <img src="https://img.shields.io/badge/Live%20Web%20App-Cloudflare%20Pages-0A84FF?style=for-the-badge&logo=cloudflare" alt="Live Demo">
    </a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Android-14%2B-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Android Version">
    <img src="https://img.shields.io/badge/Built%20With-Jetpack%20Compose-4285F4?style=flat-square&logo=jetpackcompose&logoColor=white" alt="Jetpack Compose">
    <img src="https://img.shields.io/badge/Language-Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white" alt="Kotlin">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
  </p>

  <a href="#-key-features">Features</a> •
  <a href="#-tech-stack--architecture">Tech Stack</a> •
  <a href="#-getting-started">Installation</a> •
  <a href="#%EF%B8%8F-legal-disclaimer">Legal Disclaimer</a>
</div>

---

## 📖 About StreameX

**StreameX** is an ultra-fast, modern, cross-platform streaming platform designed for smooth entertainment delivery across **Android mobile devices** and the **Web**.

Powered by the **TMDB (The Movie Database) API**, **Cloudflare Workers**, and **Firebase**, StreameX aggregates high-definition media sources for Movies, TV Series, and Anime. The native Android application is engineered from the ground up using **Kotlin** and **Jetpack Compose**, featuring a custom **Ad-Shield Video Engine** and **Media3 ExoPlayer** for seamless full-screen playback.

---

## ✨ Key Features

### 📱 Native Android App (Jetpack Compose)
* **⚡ High-Performance UI:** Modern Material 3 dark-themed design built with 100% Declarative Jetpack Compose.
* **🛡️ Smart Ad-Shield Player:** Built-in Chromium WebView protection that neutralizes popups, invisible ad overlays, and intrusive pop-under redirects automatically.
* **📺 Live TV & ExoPlayer Integration:** Native Media3 ExoPlayer integration for low-latency HLS (`.m3u8`) Live TV channels with dynamic resolution quality selection.
* **↔️ Seamless Full-Screen Support:** Smart orientation handling, immersive system bar hiding, and native Android gesture support.
* **🌐 Smart Server Fallbacks:** Dynamic server router featuring dedicated Anime servers, primary movie nodes, and fallback streaming engines.
* **⏯️ Automatic Progress Tracking:** Remembers your exact watch progress (Season, Episode, and active Server) locally and in the cloud.

### 🌐 Web Application (Single Page Architecture)
* **🚀 Blazing Fast SPA:** Zero page reloads with lightweight Vanilla ES6 modules hosted on **Cloudflare Pages**.
* **☁️ Cloud Watchlist & Sync:** Firebase Authentication & Firestore integration for real-time synchronization across Desktop, Mobile, and Web.
* **🔍 Instant Search & Filters:** Real-time search with skeleton loading states, region preferences, and adult content filtering.
* **📥 Multi-Source Download Manager:** Direct multi-server download buttons for offline viewing.
* **📱 Progressive Web App (PWA):** Installable directly on desktop and mobile browsers.

---

## 🛠️ Tech Stack & Architecture

### 🤖 Android Application
| Layer | Technologies & Libraries |
| :--- | :--- |
| **Language** | Kotlin 2.0 |
| **UI Framework** | Jetpack Compose (Material 3, Navigation, Animations) |
| **Video Playback** | Media3 ExoPlayer (Live TV) & Custom Ad-Shield WebView Engine |
| **Architecture** | MVVM (ViewModel, StateFlow, Coroutines) |
| **Networking** | Retrofit 2, OkHttp 4, Gson |
| **Image Loading** | Coil Compose |
| **Local Storage** | Jetpack DataStore / SharedPreferences |

### 🌐 Web & Server Infrastructure
| Layer | Technologies & Services |
| :--- | :--- |
| **Frontend** | HTML5, Modern CSS3 (CSS Variables, Flexbox/Grid), JavaScript ES6 |
| **Cloud Proxy / Router**| Cloudflare Workers (Token Generation & Dynamic Server Injection) |
| **Backend / Auth** | Firebase (Google Sign-In, Cloud Firestore Data Sync) |
| **Metadata API** | TMDB (The Movie Database API) |
| **Hosting** | Cloudflare Pages / PWA |

---

## 🚀 Getting Started

### 📱 Building the Android App

#### Prerequisites
* **Android Studio** (Ladybug / Jellyfish or newer)
* **JDK 17+** / **Java 21**
* Android SDK 24+ (Android 7.0 Nougat or higher)

#### Steps
1. **Clone the Repository**
   ```bash
   git clone https://github.com/snahasishdey141/StreameX.git
   cd StreameX
   ```

2. **Open in Android Studio**
   Open the root `StreameX` directory in Android Studio. Gradle will automatically sync dependencies.

3. **Build & Run**
   Connect your Android device or start an Emulator, then run:
   ```bash
   ./gradlew assembleDebug
   ```
   The generated APK will be available in `app/build/outputs/apk/debug/app-debug.apk`.

---

### 🌐 Running the Web Application Locally

#### Prerequisites
* A basic web server (e.g. VS Code **Live Server** extension or `npx serve`).

#### Steps
1. Navigate to the web source directory.
2. Open `index.html` with your local server.
3. Configure your `API_KEY` (TMDB) and `firebaseConfig` keys inside your web JavaScript script if hosting your own instance.

---

## 📂 Project Structure

```text
StreameX/
├── app/                                  # Android Application Module
│   ├── src/main/java/com/movie/streamex/
│   │   ├── api/                          # Retrofit API Services
│   │   ├── model/                        # Data Models (Server, Media, Channel)
│   │   ├── ui/
│   │   │   ├── components/               # Compose UI Components & Hero Slider
│   │   │   ├── screens/                  # PlayerScreen, HomeScreen, LiveTvScreen, etc.
│   │   │   └── theme/                    # Color Palette, Typography, Shapes
│   │   ├── utils/                        # ExoPlayer Manager, Ad Blockers
│   │   └── viewmodel/                    # PlayerViewModel, LiveTvViewModel
│   └── build.gradle.kts                  # App Module Dependencies & Versioning
├── gradle/                               # Gradle Wrapper & Version Catalogs
├── build.gradle.kts                      # Root Gradle Configuration
└── README.md                             # Project Documentation
```

---

## ⚠️ Legal Disclaimer

**StreameX does not host, store, or upload any media files.**
* This project functions strictly as a client-side user interface and search aggregator.
* Media streams are dynamically resolved from third-party publicly available embed services.
* StreameX holds no ownership over third-party media content and bears no liability for linked external servers.
* For copyright removal requests, please contact the respective hosting server provider directly.

---

## 🤝 Contributing

Contributions, bug reports, and server suggestions are welcome!
1. **Fork** the Repository.
2. Create a Feature Branch (`git checkout -b feature/NewServer`).
3. **Commit** your Changes (`git commit -m 'Add New Fast Server'`).
4. **Push** to the Branch (`git push origin feature/NewServer`).
5. Open a **Pull Request**.

---

<div align="center">
  Made with ❤️ by <b>Snahasish Dey</b>
  <br>
  © 2026 StreameX. All Rights Reserved.
</div>
