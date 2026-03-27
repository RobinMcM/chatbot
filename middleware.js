import { NextResponse } from 'next/server';
import { CHATBOT_FRAME_ANCESTORS } from './lib/server/env.js';

function buildFrameAncestors() {
  const tokens = String(CHATBOT_FRAME_ANCESTORS)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return tokens.length ? tokens.join(' ') : "'self'";
}

export function middleware(request) {
  const response = NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/chatbot')) {
    response.headers.set('Content-Security-Policy', `frame-ancestors ${buildFrameAncestors()};`);
    response.headers.delete('X-Frame-Options');
  }
  return response;
}

export const config = {
  matcher: ['/chatbot/:path*'],
};
