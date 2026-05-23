import express from "express";
import puppeteer from "puppeteer";
import { buildCardHtml } from "./card-template.js";

const app = express();

let browser;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
      ],
    });
  }
  return browser;
}

app.get("/card", async (req, res) => {
  const { name, location, photo_url } = req.query;

  if (!name || !location) {
    return res.status(400).json({ error: "name and location query params are required" });
  }

  const html = buildCardHtml({
    name: String(name),
    location: String(location),
    photo_url: photo_url ? String(photo_url) : null,
  });

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    await page.setViewport({ width: 480, height: 720, deviceScaleFactor: 2 });

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });

    // Give emoji/fonts a moment to render
    await new Promise((r) => setTimeout(r, 300));

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 480, height: 720 },
    });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(screenshot);
  } catch (err) {
    console.error("Screenshot error:", err.message);
    res.status(500).json({ error: "Failed to generate card image" });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`Tea Party Card API running at http://localhost:${PORT}`);
  // Warm up browser at startup
  try {
    await getBrowser();
    console.log("Browser ready");
  } catch (e) {
    console.warn("Browser warm-up failed:", e.message);
  }
});
