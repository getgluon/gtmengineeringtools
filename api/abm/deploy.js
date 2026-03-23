import { randomUUID } from "crypto";

// ── KV helpers with in-memory fallback ───────────────────────────────────────
// Uses @vercel/kv when KV_REST_API_URL is set, otherwise falls back to
// a module-level Map (ephemeral — fine for local dev).

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

// Simple in-memory fallback
const localPages = new Map();
const localIds = [];

async function pageSet(id, data) {
  const kv = await getKv();
  if (kv) {
    await kv.set(`abm:page:${id}`, data, { ex: 60 * 60 * 24 * 90 }); // 90-day TTL
    await kv.lpush("abm:page_ids", id);
  } else {
    localPages.set(id, data);
    localIds.unshift(id);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html, meta, content } = req.body ?? {};
  if (!html || !meta?.company) {
    return res.status(400).json({ error: "html and meta.company are required." });
  }

  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const url = `/lp/${id}`;

  const pageData = {
    id,
    url,
    html,
    company: meta.company,
    contact: meta.contact || "",
    role: meta.role || "",
    painPoint: meta.painPoint || "",
    heroHeadline: content?.hero_headline || "",
    createdAt: new Date().toISOString(),
  };

  try {
    await pageSet(id, pageData);
  } catch (err) {
    console.error("Deploy storage error:", err.message);
    return res.status(500).json({ error: "Failed to store page. If on Vercel, connect a KV database in your project settings." });
  }

  return res.json({ url, id });
}
