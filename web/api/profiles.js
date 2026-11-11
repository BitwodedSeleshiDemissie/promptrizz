import { liveApi } from '../lib/live.js';

export const POST = (request) => liveApi().profiles(request);
export const DELETE = (request) => liveApi().profiles(request);
