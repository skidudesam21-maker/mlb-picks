// AI writeups via Groq (Llama 3.3 70B). Free tier.
// If GROQ_API_KEY is missing or rate-limited, falls back to a deterministic template.

import Groq from "groq-sdk";

let client: Groq | null = null;
function getClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

const MODEL = "llama-3.3-70b-versatile";

type WriteupKind = "nrfi" | "moneyline" | "hit" | "strikeout";

export async function generateWriteup(
  kind: WriteupKind,
  headline: string,
  factors: { name: string; value: string; weight: number }[],
  confidence: number,
  grade: string,
  extraContext: string = ""
): Promise<string> {
  const c = getClient();
  if (!c) return fallback(kind, headline, factors, confidence, grade);

  const sorted = [...factors].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const factorList = sorted
    .map((f) => `- ${f.name}: ${f.value} (impact ${f.weight >= 0 ? "+" : ""}${f.weight.toFixed(1)})`)
    .join("\n");

  const kindInstruction = {
    nrfi: "This is a NRFI (No Run First Inning / Under 0.5 runs in the 1st inning) pick. Explain why neither team is likely to score in the 1st.",
    moneyline: "This is a moneyline pick — the team is picked to win the game outright. Explain why they have an edge.",
    hit: "This is a batter-to-record-a-hit prop (Over 0.5 hits). Explain why this batter is likely to get a hit.",
    strikeout: "This is a pitcher-strikeout alternate-line prop. Explain why this pitcher will clear the line.",
  }[kind];

  const prompt = `You are an expert MLB betting analyst. Write a confident, specific analysis for this pick.

PICK: ${headline}
CONFIDENCE: ${confidence}/100
GRADE: ${grade}
${kindInstruction}

KEY FACTORS (from analytical model, ordered by impact):
${factorList}

${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ""}

Write 4-6 sentences. Rules:
- Lead with the strongest factor.
- Weave in 3-4 specific numbers from the factors list. Use the exact values given.
- Do NOT invent stats not in the factors list.
- End with one honest line about the primary risk.
- No hype words ("lock", "hammer", "guaranteed"). No emojis. Confident but analytical tone.`;

  try {
    const res = await c.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 400,
    });
    const out = res.choices?.[0]?.message?.content?.trim();
    return out || fallback(kind, headline, factors, confidence, grade);
  } catch (e) {
    console.error("Groq writeup failed:", e);
    return fallback(kind, headline, factors, confidence, grade);
  }
}

function fallback(
  kind: WriteupKind,
  headline: string,
  factors: { name: string; value: string; weight: number }[],
  confidence: number,
  grade: string
): string {
  const top = [...factors]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 4);
  const lines: string[] = [];
  lines.push(`${headline} grades out at ${grade} (${confidence}/100 confidence).`);
  for (const f of top) {
    lines.push(`${f.name}: ${f.value}.`);
  }
  const negative = factors
    .filter((f) => f.weight < 0)
    .sort((a, b) => a.weight - b.weight)[0];
  if (negative) {
    lines.push(`Primary risk: ${negative.name} (${negative.value}).`);
  }
  return lines.join(" ");
}

// Letter grade from confidence score.
export function confidenceToGrade(c: number): string {
  if (c >= 93) return "A+";
  if (c >= 88) return "A";
  if (c >= 84) return "A-";
  if (c >= 80) return "B+";
  if (c >= 75) return "B";
  if (c >= 70) return "B-";
  if (c >= 65) return "C+";
  if (c >= 60) return "C";
  if (c >= 55) return "C-";
  if (c >= 50) return "D+";
  if (c >= 45) return "D";
  return "F";
}
