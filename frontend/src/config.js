// KrishiMitra Frontend Config
// Use relative URL by default so Vite dev server proxies /api and /auth seamlessly
// over both localhost and Cloudflare tunnel (avoiding Mixed Content HTTPS/HTTP blocks)
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? '';
