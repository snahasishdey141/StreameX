export async function onRequest(context) {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>StreameX - Intermission</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
          :root { --bg-color: #0f0f0f; --text-main: #ffffff; --text-muted: #a0a0a0; --accent: #e50914; }
          body { font-family: 'Inter', sans-serif; background-color: var(--bg-color); color: var(--text-main); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; overflow: hidden; }
          .logo-container { font-size: 32px; font-weight: 800; margin-bottom: 40px; display: flex; align-items: center; gap: 10px; letter-spacing: 1px; }
          .logo-container i { color: var(--accent); }
          .pulse-icon { font-size: 80px; color: var(--accent); margin-bottom: 30px; animation: pulse 2s infinite; filter: drop-shadow(0 0 20px rgba(229, 9, 20, 0.4)); }
          h1 { font-size: 42px; font-weight: 800; margin: 0 0 15px 0; letter-spacing: 2px; text-transform: uppercase; }
          p { font-size: 16px; color: var(--text-muted); max-width: 500px; line-height: 1.6; margin: 0 0 30px 0; }
          .progress-bar { width: 100%; max-width: 300px; height: 4px; background: #333; border-radius: 4px; overflow: hidden; position: relative; }
          .progress-bar::after { content: ''; position: absolute; top: 0; left: 0; height: 100%; width: 40%; background: var(--accent); animation: loading 1.5s infinite ease-in-out; border-radius: 4px; }
          @keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 30px rgba(229, 9, 20, 0.8)); } 100% { transform: scale(0.95); opacity: 0.8; } }
          @keyframes loading { 0% { left: -40%; } 100% { left: 100%; } }
        </style>
      </head>
      <body>
        <div class="logo-container"><i class="fas fa-play-circle"></i> StreameX</div>
        <i class="fas fa-film pulse-icon"></i>
        <h1> Forced Hydration Break! </h1>
          <p> We noticed you've been watching a lot lately, so we took the servers down to make you go outside. Just kidding! We're actually deploying some essential behind-the-scenes updates. Go grab a snack—the servers will be back online before your popcorn gets cold. </p>
        <div class="progress-bar"></div>
      </body>
    </html>
  `;

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
    status: 503 
  });
}
