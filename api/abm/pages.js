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
const localIds = [];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const kv = await getKv();
    let pages = [];

    if (kv) {
      // Get all IDs from the list (up to 200 most recent)
      const ids = await kv.lrange("abm:page_ids", 0, 199);
      if (ids && ids.length > 0) {
        const results = await Promise.all(ids.map((id) => kv.get(`abm:page:${id}`)));
        pages = results
          .filter(Boolean)
          .map(({ id, url, company, contact, role, heroHeadline, createdAt }) => ({
            id, url, company, contact, role, heroHeadline, createdAt,
          }));
      }
    } else {
      pages = localIds
        .map((id) => localPages.get(id))
        .filter(Boolean)
        .map(({ id, url, company, contact, role, heroHeadline, createdAt }) => ({
          id, url, company, contact, role, heroHeadline, createdAt,
        }));
    }

    return res.json(pages);
  } catch (err) {
    console.error("Pages list error:", err.message);
    return res.json([]);
  }
}
