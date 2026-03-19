import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const TOPIC_COLORS = {
  "GTM Engineering & AI automation": "purple",
  "RevOps insights": "cyan",
  "Sales & outbound strategy": "green",
  "Personal journey & learning in public": "orange",
};

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
  for (let i = 0; i < count; i++) {
    result.push(topics[i % topics.length]);
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}
