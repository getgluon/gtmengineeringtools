import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Landing pages store ───────────────────────────────────────────────────────

const PAGES_FILE = join(__dirname, "landing-pages.json");

function loadLandingPages() {
  try {
    if (existsSync(PAGES_FILE)) return JSON.parse(readFileSync(PAGES_FILE, "utf8"));
  } catch (_) {}
  return {};
}

function saveLandingPages(pages) {
  try { writeFileSync(PAGES_FILE, JSON.stringify(pages, null, 2)); } catch (_) {}
}

let landingPages = loadLandingPages();
const app = express();
const client = new Anthropic();

app.use(express.json());
app.use(express.static(__dirname));

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an elite GTM research analyst with deep expertise in B2B sales intelligence. Your job is to research companies using web search and generate complete, actionable intelligence briefs.

When given a company name or URL:
1. Use web_search extensively to gather current, accurate information
2. Search for: company overview, recent funding, leadership team, tech stack signals, job postings, recent news (last 90 days)
3. Generate highly personalized outreach based on your research findings
4. Be specific — avoid generic content, use actual names, events, and signals you find

Return ONLY a valid JSON object (no markdown fences, no explanation text) with this exact structure:
{
  "company_overview": {
    "name": "Official company name",
    "industry": "Primary industry",
    "size": "Employee range (e.g. 51-200)",
    "employees": "~1,500",
    "funding": "Series B – $45M (Jan 2025)",
    "hq": "San Francisco, CA",
    "founded": "2018",
    "description": "2-3 sentence description of what they do, mission, and key products",
    "website": "https://...",
    "valuation": "$450M or N/A"
  },
  "recent_news": [
    {
      "title": "News headline",
      "date": "March 2025",
      "summary": "1-2 sentence summary",
      "significance": "Why this matters for a sales conversation"
    }
  ],
  "tech_stack": [
    {
      "category": "CRM",
      "tools": ["Salesforce"],
      "signals": "Evidence from job postings or press releases"
    }
  ],
  "decision_makers": [
    {
      "name": "Full name",
      "title": "Job title",
      "linkedin": "linkedin.com/in/handle or null",
      "focus": "What they care about / their priorities",
      "recent_activity": "Recent post, talk, or news about them"
    }
  ],
  "pain_points": [
    {
      "pain": "Specific pain point",
      "evidence": "What signals indicate this pain",
      "our_angle": "How to position a solution around this"
    }
  ],
  "icp_fit": {
    "score": 8,
    "reasoning": "Detailed 2-3 sentence explanation of the score",
    "positives": ["Strength 1", "Strength 2", "Strength 3"],
    "risks": ["Risk 1", "Risk 2"]
  },
  "outreach": {
    "cold_emails": [
      {
        "variant": "Problem-Led",
        "subject": "Subject line",
        "body": "Full email with greeting, body paragraphs, and sign-off. Use actual company details."
      },
      {
        "variant": "Insight-Led",
        "subject": "Subject line",
        "body": "Full email referencing a specific insight or news item from your research."
      },
      {
        "variant": "Social Proof",
        "subject": "Subject line",
        "body": "Full email leading with a relevant customer success story."
      }
    ],
    "linkedin_connection": "Short personalized connection request under 300 characters. Reference something specific.",
    "linkedin_inmail": {
      "subject": "InMail subject line",
      "body": "Full InMail message. Professional, personalized, clear value prop."
    },
    "talking_points": [
      {
        "point": "Key talking point",
        "why": "Why this resonates with this specific company",
        "how_to_use": "How to naturally raise this in conversation"
      }
    ]
  }
}`;

// ── SSE helper ────────────────────────────────────────────────────────────────

function setupSSE(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  return (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

// ── Core research function ────────────────────────────────────────────────────

async function runResearch(company, onStatus) {
  const messages = [
    {
      role: "user",
      content: `Research this company and generate a complete GTM intelligence brief: "${company.trim()}"\n\nUse web search to find the most current information. Focus on news from the last 90 days. Return the complete JSON as specified in your system instructions.`,
    },
  ];

  const statusSteps = [
    "Searching company database...",
    "Analyzing recent news and signals...",
    "Identifying tech stack and tools...",
    "Researching decision makers...",
    "Mapping pain points and opportunities...",
    "Calculating ICP fit score...",
    "Generating personalized outreach...",
    "Finalizing intelligence brief...",
  ];

  let stepIndex = 0;
  let iterations = 0;
  const maxIterations = 10;

  while (iterations < maxIterations) {
    if (onStatus && stepIndex < statusSteps.length) {
      onStatus(statusSteps[stepIndex++]);
    }

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages,
    });

    iterations++;

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock) return null;

      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    }

    // pause_turn or tool_use — append assistant content and continue loop
    messages.push({ role: "assistant", content: response.content });
  }

  return null;
}

// ── POST /api/research ────────────────────────────────────────────────────────

app.post("/api/research", async (req, res) => {
  const { company } = req.body ?? {};
  if (!company || typeof company !== "string" || !company.trim()) {
    return res.status(400).json({ error: "Please provide a company name or URL." });
  }

  const send = setupSSE(res);

  try {
    send("status", { message: "Initializing deep research agent..." });

    const result = await runResearch(company, (msg) => send("status", { message: msg }));

    if (!result) {
      send("error", { message: "Could not generate research brief. Please try again." });
    } else {
      send("result", result);
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      send("error", { message: "Invalid API key. Check ANTHROPIC_API_KEY." });
    } else if (err instanceof Anthropic.RateLimitError) {
      send("error", { message: "Rate limited. Please try again in a moment." });
    } else {
      console.error("Research error:", err.message);
      send("error", { message: "Research failed. Please try again." });
    }
  }

  send("done", {});
  res.end();
});

// ── POST /api/webhook (Clay integration) ─────────────────────────────────────

app.post("/api/webhook", async (req, res) => {
  const { company, company_name, url, domain, callback_url, ...metadata } = req.body ?? {};
  const companyInput = (company || company_name || url || domain || "").trim();

  if (!companyInput) {
    return res.status(400).json({
      error: "Provide one of: company, company_name, url, or domain.",
      accepted_fields: ["company", "company_name", "url", "domain", "callback_url"],
    });
  }

  // Acknowledge immediately — Clay expects a fast response
  res.json({
    status: "accepted",
    company: companyInput,
    message: callback_url
      ? "Research initiated. Results will be POSTed to callback_url when ready."
      : "Research initiated. No callback_url provided.",
  });

  // Run research in background and POST results to callback_url if provided
  try {
    const result = await runResearch(companyInput, null);

    if (callback_url && result) {
      await fetch(callback_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: companyInput,
          research: result,
          metadata,
          timestamp: new Date().toISOString(),
        }),
      });
    }
  } catch (err) {
    console.error("Webhook research error:", err.message);
  }
});

// ── ABM Landing Page Generator ────────────────────────────────────────────────

const ABM_SYSTEM_PROMPT = `You are an expert B2B marketing copywriter specializing in account-based marketing (ABM). Your job is to write highly personalized, conversion-focused landing page copy for a specific prospect.

Return ONLY a valid JSON object (no markdown fences, no explanation). All copy must feel genuinely written for this specific person and company — avoid generic phrases.`;

app.get("/abm-landing", (req, res) => {
  res.sendFile(join(__dirname, "abm-landing.html"));
});

app.post("/api/abm/generate", async (req, res) => {
  const { company, contact, role, painPoint } = req.body ?? {};

  if (!company || !contact || !role || !painPoint) {
    return res.status(400).json({ error: "All fields are required: company, contact, role, painPoint." });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: ABM_SYSTEM_PROMPT,
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
    if (!textBlock) return res.status(502).json({ error: "No content returned from AI." });

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: "Could not parse AI response." });

    return res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: "Invalid API key. Check ANTHROPIC_API_KEY." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited. Please try again." });
    }
    console.error("ABM generate error:", err.message);
    return res.status(500).json({ error: "Generation failed. Please try again." });
  }
});

app.post("/api/abm/deploy", (req, res) => {
  const { html, meta, content } = req.body ?? {};

  if (!html || !meta?.company) {
    return res.status(400).json({ error: "html and meta.company are required." });
  }

  const id = randomUUID().replace(/-/g, "").slice(0, 12);
  const url = `/lp/${id}`;

  landingPages[id] = {
    id,
    url,
    html,
    company: meta.company,
    contact: meta.contact,
    role: meta.role,
    painPoint: meta.painPoint,
    heroHeadline: content?.hero_headline || "",
    createdAt: new Date().toISOString(),
  };

  saveLandingPages(landingPages);

  return res.json({ url, id });
});

app.get("/api/abm/pages", (req, res) => {
  const pages = Object.values(landingPages)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ id, url, company, contact, role, heroHeadline, createdAt }) => ({
      id, url, company, contact, role, heroHeadline, createdAt,
    }));

  return res.json(pages);
});

app.get("/lp/:id", (req, res) => {
  const page = landingPages[req.params.id];
  if (!page) return res.status(404).send("<h1>Page not found</h1>");
  res.setHeader("Content-Type", "text/html");
  res.send(page.html);
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Deep Research Agent running at http://localhost:${PORT}`);
});
