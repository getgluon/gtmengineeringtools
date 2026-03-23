import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert B2B marketing copywriter specializing in account-based marketing (ABM). Your job is to write highly personalized, conversion-focused landing page copy for a specific prospect.

Return ONLY a valid JSON object (no markdown fences, no explanation). All copy must feel genuinely written for this specific person and company — avoid generic phrases.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { company, contact, role, painPoint } = req.body ?? {};

  if (!company || !contact || !role || !painPoint) {
    return res.status(400).json({ error: "All fields are required: company, contact, role, painPoint." });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Generate personalized landing page copy for this account:

Company: ${company.trim()}
Contact Name: ${contact.trim()}
Their Role: ${role.trim()}
Main Pain Point: ${painPoint.trim()}

Return a JSON object with exactly this structure:
{
  "hero_headline": "Compelling, personalized headline referencing their company or role — bold, specific, benefit-driven",
  "hero_subheadline": "1-2 sentence subheadline that speaks directly to their situation and hints at the solution",
  "pain_headline": "A headline that names their exact pain point with empathy — make them feel understood",
  "pain_copy": "2-3 sentences acknowledging the pain in depth, using language their role would use. Be specific to their context.",
  "benefits": [
    {
      "icon": "⚡",
      "title": "Benefit title (5-7 words)",
      "description": "2-3 sentence benefit description directly tied to their pain point and role"
    },
    {
      "icon": "🎯",
      "title": "Benefit title",
      "description": "2-3 sentence description"
    },
    {
      "icon": "📈",
      "title": "Benefit title",
      "description": "2-3 sentence description"
    }
  ],
  "social_proof": {
    "quote": "A compelling testimonial quote from a similar role at a similar company. Should be specific and results-oriented.",
    "author_name": "First Last",
    "author_role": "Job Title",
    "author_company": "Company Name",
    "stats": [
      { "number": "3×", "label": "metric label (e.g. faster onboarding)" },
      { "number": "67%", "label": "another relevant metric" },
      { "number": "14 days", "label": "time-to-value metric" }
    ]
  },
  "cta_headline": "Strong, action-oriented headline for the CTA section — personalized to their company",
  "cta_subtext": "1 sentence that removes friction and reinforces value for their specific use case",
  "cta_button": "Book Your Demo"
}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "No content returned from AI." });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: "Could not parse AI response as JSON." });
    }

    const data = JSON.parse(jsonMatch[0]);
    return res.json(data);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Invalid Anthropic API key." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited. Please try again in a moment." });
    }
    console.error("ABM generate error:", err.message);
    return res.status(500).json({ error: "Generation failed. Please try again." });
  }
}
