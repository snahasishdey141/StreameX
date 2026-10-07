export async function onRequest(context) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StreameX - Scene Missing</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700;900&family=Courier+Prime&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          :root {
            --bg-color: #050505;
            --card-bg: rgba(20, 20, 22, 0.85);
            --text-main: #ffffff;
            --text-muted: #a1a1aa;
            --accent: #e50914; /* Cinematic Red */
            --accent-glow: rgba(229, 9, 20, 0.6);
          }

          * { box-sizing: border-box; }

          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            background-image: radial-gradient(circle at 50% 0%, rgba(229, 9, 20, 0.15), transparent 50%);
            color: var(--text-main);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            overflow: hidden;
            position: relative;
          }

          /* Cinematic Film Grain Overlay */
          body::after {
            content: "";
            position: absolute;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background-image: url('data:image/svg+xml;utf8,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noiseFilter"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noiseFilter)" opacity="0.05"/%3E%3C/svg%3E');
            pointer-events: none;
            z-index: 10;
          }

          .cinema-card {
            background: var(--card-bg);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            padding: 0;
            max-width: 600px;
            width: 100%;
            text-align: center;
            box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.8), 0 0 40px rgba(229, 9, 20, 0.15);
            animation: cinematicReveal 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            transform: scale(0.95);
            opacity: 0;
            overflow: hidden;
            position: relative;
            z-index: 20;
          }

          /* The "Clapperboard" Top Bar */
          .clapper-top {
            background: repeating-linear-gradient(
              45deg,
              #111,
              #111 20px,
              #ddd 20px,
              #ddd 40px
            );
            height: 24px;
            width: 100%;
            border-bottom: 2px solid #000;
          }

          .card-content {
            padding: 50px 40px;
          }

          .logo {
            font-size: 24px;
            font-weight: 900;
            margin-bottom: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            letter-spacing: 2px;
            text-transform: uppercase;
          }

          .logo i { color: var(--accent); }

          .icon-wrapper {
            position: relative;
            margin: 0 auto 25px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .film-reel {
            font-size: 65px;
            color: var(--text-main);
            filter: drop-shadow(0 0 15px var(--accent-glow));
            animation: spinReel 8s linear infinite;
          }

          /* A broken piece of film floating away */
          .film-slash {
            position: absolute;
            font-size: 30px;
            color: var(--accent);
            top: 10px;
            right: 40%;
            animation: floatAway 3s infinite ease-in-out;
          }

          h1 {
            font-size: 38px;
            font-weight: 900;
            margin: 0 0 10px 0;
            letter-spacing: -1px;
            color: #fff;
            text-shadow: 2px 2px 0px var(--accent);
          }

          .subtitle {
            color: var(--text-muted);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin-bottom: 30px;
            font-weight: 500;
          }

          /* Movie Script Style Box */
          .script-box {
            background: #fdfdfd;
            color: #111;
            padding: 25px;
            border-radius: 4px;
            text-align: left;
            font-family: 'Courier Prime', monospace; /* Typewriter font */
            font-size: 15px;
            line-height: 1.6;
            position: relative;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.1);
            transform: rotate(-1deg);
          }

          /* Red "Top Secret" / "Director's Note" stamp */
          .script-box::after {
            content: "DIRECTOR'S NOTE";
            position: absolute;
            top: -12px;
            right: -10px;
            background: var(--accent);
            color: #fff;
            padding: 4px 12px;
            font-family: 'Outfit', sans-serif;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 1px;
            transform: rotate(5deg);
            border-radius: 4px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          }

          .script-box strong {
            display: block;
            text-align: center;
            margin-bottom: 10px;
            font-size: 16px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }

          /* Intermission Dots */
          .loading-dots {
            margin-top: 30px;
            display: flex;
            justify-content: center;
            gap: 8px;
          }

          .loading-dots div {
            width: 10px;
            height: 10px;
            background-color: var(--text-muted);
            border-radius: 50%;
            animation: bounce 1.4s infinite ease-in-out both;
          }
          .loading-dots div:nth-child(1) { animation-delay: -0.32s; }
          .loading-dots div:nth-child(2) { animation-delay: -0.16s; }

          /* --- Animations --- */
          @keyframes cinematicReveal {
            to { transform: scale(1); opacity: 1; }
          }
          @keyframes spinReel {
            100% { transform: rotate(360deg); }
          }
          @keyframes floatAway {
            0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.8; }
            50% { transform: translate(15px, -15px) rotate(15deg); opacity: 0.2; }
          }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
            40% { transform: scale(1); background-color: var(--accent); opacity: 1; }
          }

          /* --- Mobile --- */
          @media (max-width: 600px) {
            .card-content { padding: 40px 20px; }
            h1 { font-size: 30px; }
            .script-box { font-size: 13px; transform: rotate(0); }
          }
        </style>
      </head>
      <body>
        <div class="cinema-card">
          <div class="clapper-top"></div>
          
          <div class="card-content">
            <div class="logo">
              <i class="fas fa-play-circle"></i> StreameX
            </div>

            <div class="icon-wrapper">
              <i class="fas fa-film film-reel"></i>
              <i class="fas fa-bolt film-slash"></i>
            </div>

            <h1>PLOT TWIST!</h1>
            <div class="subtitle">Error 503 • Scene Missing</div>

            <div class="script-box">
              <strong>[SCENE: SERVER ROOM - DISASTER]</strong>
              The website owner has lost their mind due to exam pressure and completely forgot to maintain the servers. 
              <br><br>
              As a result, all video servers have crashed! If anyone knows the owner, please let them know their servers are currently down.
            </div>

            <div class="loading-dots">
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
    status: 503 
  });
}