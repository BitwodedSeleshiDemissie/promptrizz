import { liveApi } from '../lib/live.js';

export const POST = (request) => liveApi().scores(request);
