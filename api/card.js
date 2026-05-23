import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { buildCardHtml } from "../card-api/card-template.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, location, photo_url } = req.query;

  if (!name || !location) {
    return res.status(400).json({ error: "name and location query params are required" });
  }

  const html = buildCardHtml({
    name: String(name),
    location: String(location),
    photo_url: photo_url ? String(photo_url) : null,
  });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 480, height: 720, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 300));

    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 480, height: 720 },
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(screenshot));
  } catch (err) {
    console.error("Screenshot error:", err.message);
    res.status(500).json({ error: "Failed to generate card image" });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
