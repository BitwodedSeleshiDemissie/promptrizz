import { liveApi } from '../lib/live.js';

export const GET = (request) => liveApi().leaderboard(request);
