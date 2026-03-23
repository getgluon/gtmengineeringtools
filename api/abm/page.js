let _kv = null;
async function getKv() {
  if (_kv) return _kv;
  if (process.env.KV_REST_API_URL) {
    const mod = await import("@vercel/kv");
    _kv = mod.kv;
    return _kv;
  }
  return null;
}

const localPages = new Map();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ID comes from the URL path: /lp/[id]
  // Vercel rewrites /lp/(.*) → /api/abm/page.js?id=$1
  const id = req.query.id;

  if (!id) {
    return res.status(400).send("<h1>Missing page ID</h1>");
  }

  try {
    const kv = await getKv();
    let page = null;

    if (kv) {
      page = await kv.get(`abm:page:${id}`);
    } else {
      page = localPages.get(id) ?? null;
    }

    if (!page) {
      return res.status(404).send(`<!DOCTYPE html><html><head><title>Page Not Found</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d0f14;color:#e4e7f0}</style>
</head><body><div style="text-align:center"><h1 style="font-size:2rem;margin-bottom:8px">Page not found</h1>
<p style="color:#9ba3bc">This landing page doesn't exist or has expired.</p></div></body></html>`);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(page.html);
  } catch (err) {
    console.error("Page serve error:", err.message);
    return res.status(500).send("<h1>Error loading page</h1>");
  }
}
