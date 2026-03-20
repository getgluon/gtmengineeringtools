import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

app.use(express.json());
app.use(express.static(join(__dirname, "public")));

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

// ─── LinkedIn Content Engine ───────────────────────────────────────────────

function getWeekdayDates(count) {
  const dates = [];
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (dates.length < count) {
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(date));
    }
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

function distributeTopics(topics, count) {
  const result = [];
  // Interleave topics evenly across posts
  for (let i = 0; i < count; i++) {
    result.push(topics[i % topics.length]);
  }
  return result;
}

const TOPIC_COLORS = {
  "GTM Engineering & AI automation": "purple",
  "RevOps insights": "cyan",
  "Sales & outbound strategy": "green",
  "Personal journey & learning in public": "orange",
};

app.post("/api/linkedin/generate", async (req, res) => {
  const { name, jobTitle, bio, topics } = req.body ?? {};

  if (!name || !jobTitle || !bio || !Array.isArray(topics) || topics.length === 0) {
    return res.status(400).json({ error: "Please provide name, job title, bio, and at least one topic." });
  }

  const topicAssignments = distributeTopics(topics, 20);
  const dates = getWeekdayDates(20);

  const topicList = topicAssignments
    .map((t, i) => `Post ${i + 1}: ${t}`)
    .join("\n");

  const prompt = `You are an expert LinkedIn content strategist. Create 20 high-quality LinkedIn posts for:

Name: ${name}
Job Title: ${jobTitle}
Bio: ${bio}

Topic assignment for each post:
${topicList}

Guidelines:
- Voice: First-person, professional but conversational and authentic
- Hook: A single punchy sentence that stops the scroll — use a bold claim, surprising stat, contrarian take, or relatable pain point
- Body: 3-5 short paragraphs (2-4 sentences max each), scannable, no fluff
- CTA: End with a question, invitation, or next step (varies across posts)
- Vary the content format: some posts tell stories, some share tips/frameworks, some ask questions, some share lessons learned
- Make the content feel real and personal to ${name}'s journey as a ${jobTitle}
- For GTM Engineering & AI automation: focus on practical tools, workflows, automations, and AI use cases
- For RevOps insights: focus on data, processes, alignment between sales/marketing/CS, and revenue operations strategy
- For Sales & outbound strategy: focus on prospecting, messaging, sequencing, conversion tactics
- For Personal journey & learning in public: share real experiences, mistakes, growth moments, and behind-the-scenes insights

Return ONLY a valid JSON array with exactly 20 objects. Each object must have these exact keys:
- "hook": string (the first line/hook)
- "paragraphs": array of 3-5 strings (body paragraphs)
- "cta": string (closing call-to-action)

No markdown, no extra text, just the raw JSON array.`;

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const message = await stream.finalMessage();
    const text = message.content.find((b) => b.type === "text")?.text ?? "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "Could not parse posts from AI response." });
    }

    const rawPosts = JSON.parse(jsonMatch[0]);

    const posts = rawPosts.slice(0, 20).map((post, i) => ({
      id: `post-${Date.now()}-${i}`,
      topic: topicAssignments[i],
      topicColor: TOPIC_COLORS[topicAssignments[i]] || "purple",
      date: dates[i].toISOString().split("T")[0],
      dateLabel: dates[i].toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
      weekNum: Math.floor(i / 5) + 1,
      hook: post.hook,
      paragraphs: post.paragraphs,
      cta: post.cta,
    }));

    return res.json({ posts });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Invalid Anthropic API key. Check ANTHROPIC_API_KEY." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited. Please try again in a moment." });
    }
    console.error("LinkedIn generate error:", err.message);
    return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

app.post("/api/linkedin/regenerate", async (req, res) => {
  const { name, jobTitle, bio, topic } = req.body ?? {};

  if (!name || !jobTitle || !bio || !topic) {
    return res.status(400).json({ error: "Missing required fields for regeneration." });
  }

  const prompt = `You are an expert LinkedIn content strategist. Write a single high-quality LinkedIn post for:

Name: ${name}
Job Title: ${jobTitle}
Bio: ${bio}
Topic: ${topic}

Guidelines:
- Hook: A single punchy sentence that stops the scroll (bold claim, surprising insight, or relatable pain point)
- Body: 3-5 short paragraphs (2-4 sentences each), scannable and engaging
- CTA: End with a question or invitation
- Voice: First-person, authentic, professional but human

Return ONLY a valid JSON object with these exact keys:
- "hook": string
- "paragraphs": array of 3-5 strings
- "cta": string

No markdown, no extra text, just the raw JSON object.`;

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "Could not parse regenerated post." });
    }

    const post = JSON.parse(jsonMatch[0]);
    return res.json({ post });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Invalid Anthropic API key. Check ANTHROPIC_API_KEY." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited. Please try again in a moment." });
    }
    console.error("LinkedIn regenerate error:", err.message);
    return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
  }
});

// ──────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GTM Engineering Tools running at http://localhost:${PORT}`);
});
