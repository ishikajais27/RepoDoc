export { GET } from '../generate/route'
// Usage:
//   GET /api/metrics         → full JSON metrics
//   GET /api/metrics?fmt=txt → text summary (for quick terminal checks)
//
// Intentionally simple — metrics are already computed in route.js.
// This just re-exports the GET handler from the generate route.
// If you want a separate /api/health endpoint that just returns up/down status:
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { 'X-Status': 'healthy' },
  })
}
