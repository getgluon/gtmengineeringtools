import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/company", async (req, res) => {
  const { company } = req.body ?? {};
  if (!company || typeof company !== "string" || !company.trim()) {
    return res.status(400).json({ error: "Please provide a company name." });
  }

  const prompt = `You are a business intelligence assistant. Given a company name, return a JSON object with factual information about that company. If the company is not well-known or you are unsure about specific details, provide reasonable estimates and clearly indicate when a field is an estimate.

Company: ${company.trim()}

Return ONLY a valid JSON object with these exact keys (no extra text, no markdown fences):
{
  "name": "Official company name (corrected spelling/casing)",
  "tagline": "A short memorable tagline or motto (1 sentence, or null if unknown)",
  "industry": "Primary industry (e.g. Cloud Computing, E-commerce, Financial Services)",
  "size": "Employee count range (e.g. 1-50, 51-200, 201-1000, 1001-5000, 5000-10000, 10000+)",
  "founded": "Year founded as a string (e.g. 2004), or null if unknown",
  "hq": "City, Country (e.g. San Francisco, USA), or null if unknown",
  "description": "2-3 sentence description of what the company does, its mission, and notable products or services.",
  "employees": "Approximate employee count as a short string (e.g. ~8,000, ~250,000, or null if unknown)",
  "revenue": "Latest annual revenue estimate as a short string (e.g. $1.2B, $500M, or null if unknown)",
  "valuation": "Latest valuation or market cap as a short string (e.g. $2.5T, $45B, or null if unknown)"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    // Extract JSON — strip any accidental markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "Could not parse company data from AI response." });
    }

    const data = JSON.parse(jsonMatch[0]);
    return res.json(data);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Invalid Anthropic API key. Check ANTHROPIC_API_KEY." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited. Please try again in a moment." });
    }
    console.error("API error:", err.message);
    return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Company Profile Lookup running at http://localhost:${PORT}`);
});
