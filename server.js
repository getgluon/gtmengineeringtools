import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Deep Research Agent running at http://localhost:${PORT}`);
});
