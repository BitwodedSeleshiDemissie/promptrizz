import { liveApi } from '../lib/live.js';

// The public page. vercel.json serves it at "/".
export const GET = (request) => liveApi().page(request);
