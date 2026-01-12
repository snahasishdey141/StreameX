export async function onRequest(context) {
    // 1. Get the URL request path (e.g., /movie/popular)
    const url = new URL(context.request.url);
    const path = url.pathname.replace('/api', ''); // Remove '/api' prefix
    const query = url.search; // Get existing query params (like &page=1)

    // 2. Get your Secret Key from Cloudflare Environment Variables
    const TMDB_KEY = context.env.TMDB_API_KEY; 
    const BASE_URL = 'https://api.themoviedb.org/3';

    // 3. Forward the request to TMDB with the hidden key
    const tmdbUrl = `${BASE_URL}${path}${query}&api_key=${TMDB_KEY}`;

    const response = await fetch(tmdbUrl, {
        method: context.request.method,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // 4. Return TMDB's response back to your website
    const data = await response.body;
    return new Response(data, {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // Allow your site to access this
        }
    });
}
