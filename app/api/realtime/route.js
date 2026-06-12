// app/api/realtime/route.js
// Server-Sent Events endpoint — streams GA4 realtime visitor data to the dashboard

import { getRealtimeVisitors, getMockVisitors } from '@/lib/ga4';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || '5000');

export async function GET(request) {
  // Optional password protection
  const password = process.env.DASHBOARD_PASSWORD;
  if (password) {
    const authHeader = request.headers.get('x-dashboard-password');
    if (authHeader !== password) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const encoder = new TextEncoder();
  const useMock = !process.env.GA4_PROPERTY_ID || !process.env.GA4_SERVICE_ACCOUNT_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (_) {}
      };

      // Send initial connection confirmation
      send({ type: 'connected', mock: useMock, timestamp: new Date().toISOString() });

      const poll = async () => {
        try {
          const result = useMock
            ? getMockVisitors()
            : await getRealtimeVisitors();

          send({ type: 'update', ...result });
        } catch (err) {
          console.error('[GA4 API Error]', err.message);
          // On error, send mock data so dashboard stays alive
          const fallback = getMockVisitors();
          send({ type: 'update', ...fallback, error: err.message });
        }
      };

      // Send first batch immediately
      await poll();

      // Then poll on interval
      const interval = setInterval(poll, POLL_INTERVAL);

      // Cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try { controller.close(); } catch (_) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
