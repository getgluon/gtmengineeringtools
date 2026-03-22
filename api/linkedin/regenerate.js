import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}
