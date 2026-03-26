import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an elite sales intelligence analyst who prepares comprehensive meeting briefs for B2B sales professionals. You use web search to find current, accurate information.

When given a contact name/LinkedIn URL, their company, the meeting type, and the seller's product/service:
1. Use web_search to research the contact (LinkedIn, interviews, articles, social media, conference talks)
2. Use web_search to research the company (recent news, funding, hiring signals, product changes, leadership moves — last 90 days)
3. Synthesize everything into a precise, actionable meeting brief

Return ONLY a valid JSON object (no markdown fences, no explanation text) with EXACTLY this structure:
{
  "contact": {
    "name": "Full name (corrected if needed)",
    "title": "Current job title",
    "company": "Current company",
    "background": "2-3 sentences: career background, how long in role, domain expertise",
    "linkedin_insights": "1-2 sentences: notable posts, thought leadership themes, or public statements relevant to this meeting",
    "likely_priorities": [
      "Priority 1 based on their role and company stage",
      "Priority 2",
      "Priority 3"
    ],
    "communication_style": "1 sentence: how they likely prefer to communicate based on public signals"
  },
  "company": {
    "name": "Company name",
    "industry": "Industry",
    "size": "Employee count range",
    "stage": "E.g. Series B startup, public enterprise, bootstrapped SMB",
    "description": "1-2 sentence company description",
    "recent_news": [
      {
        "headline": "News headline",
        "date": "Month Year",
        "relevance": "Why this matters for your meeting"
      }
    ],
    "growth_signals": [
      "Signal 1 (e.g. hiring spike in X dept)",
      "Signal 2",
      "Signal 3"
    ],
    "tech_stack": ["Tool 1", "Tool 2", "Tool 3"],
    "challenges": "1-2 sentences on known challenges at their company stage/industry"
  },
  "pain_points": [
    {
      "pain": "Specific pain point title",
      "evidence": "What signals this pain (news, role, company stage, etc.)",
      "our_angle": "How your product/service maps to this pain"
    },
    {
      "pain": "Pain point 2",
      "evidence": "Evidence",
      "our_angle": "Angle"
    },
    {
      "pain": "Pain point 3",
      "evidence": "Evidence",
      "our_angle": "Angle"
    }
  ],
  "discovery_questions": [
    {
      "question": "Open-ended question tailored to their role and company context",
      "intent": "What you're trying to learn",
      "follow_up": "Natural follow-up if they give a surface-level answer"
    },
    {
      "question": "Question 2",
      "intent": "Intent",
      "follow_up": "Follow-up"
    },
    {
      "question": "Question 3",
      "intent": "Intent",
      "follow_up": "Follow-up"
    }
  ],
  "talking_points": [
    {
      "point": "Key message or insight to share",
      "supporting_detail": "Specific data, story, or example to back it up",
      "when_to_use": "When in the conversation to deploy this"
    },
    {
      "point": "Talking point 2",
      "supporting_detail": "Detail",
      "when_to_use": "When"
    },
    {
      "point": "Talking point 3",
      "supporting_detail": "Detail",
      "when_to_use": "When"
    }
  ],
  "objections": [
    {
      "objection": "Likely objection they will raise",
      "response": "How to handle it with empathy and evidence",
      "pivot": "How to turn it into a discovery opportunity"
    },
    {
      "objection": "Objection 2",
      "response": "Response",
      "pivot": "Pivot"
    },
    {
      "objection": "Objection 3",
      "response": "Response",
      "pivot": "Pivot"
    }
  ],
  "next_steps": [
    {
      "step": "Specific action to propose at end of meeting",
      "timing": "Suggested timeline",
      "owner": "Who does it"
    },
    {
      "step": "Next step 2",
      "timing": "Timeline",
      "owner": "Owner"
    }
  ],
  "meeting_agenda": "Suggested 3-5 bullet agenda for the meeting, with time allocations",
  "executive_summary": "2-3 sentence executive summary: who you're meeting, why now is a good time, and what a win looks like"
}`;

function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function runMeetingPrep(input, onStatus) {
  const { contact, company, meetingType, product } = input;

  const messages = [
    {
      role: "user",
      content: `Prepare a meeting brief for the following:

Contact: ${contact.trim()}
Company: ${company.trim()}
Meeting Type: ${meetingType}
My Product/Service: ${product.trim()}

Use web search to research the contact and company thoroughly. Focus on news and signals from the last 90 days. Return the complete JSON brief as specified.`,
    },
  ];

  const statusSteps = [
    "Researching contact background...",
    "Scanning LinkedIn and public profiles...",
    "Analyzing company news and signals...",
    "Identifying growth indicators...",
    "Mapping pain points to your solution...",
    "Crafting discovery questions...",
    "Preparing objection handlers...",
    "Finalizing your meeting brief...",
  ];

  let stepIndex = 0;
  let iterations = 0;
  const maxIterations = 12;

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

    messages.push({ role: "assistant", content: response.content });
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { contact, company, meetingType, product } = req.body ?? {};

  if (!contact?.trim() || !company?.trim() || !meetingType || !product?.trim()) {
    return res.status(400).json({ error: "All fields are required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    sendEvent(res, "status", { message: "Initializing meeting prep agent..." });

    const result = await runMeetingPrep(
      { contact, company, meetingType, product },
      (msg) => sendEvent(res, "status", { message: msg })
    );

    if (!result) {
      sendEvent(res, "error", { message: "Could not generate brief. Please try again." });
    } else {
      sendEvent(res, "result", result);
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      sendEvent(res, "error", { message: "Invalid API key. Check ANTHROPIC_API_KEY." });
    } else if (err instanceof Anthropic.RateLimitError) {
      sendEvent(res, "error", { message: "Rate limited. Please try again in a moment." });
    } else {
      console.error("Meeting prep error:", err.message);
      sendEvent(res, "error", { message: "Research failed. Please try again." });
    }
  }

  sendEvent(res, "done", {});
  res.end();
}
