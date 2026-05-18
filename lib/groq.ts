import Groq from "groq-sdk";
import { SummarySchema, SUMMARY_JSON_SHAPE, type Summary } from "./schema";

const MODEL = "llama-3.3-70b-versatile";

function client() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

const SYSTEM_PROMPT = `You are a structured-extraction engine. The user will give you a messy blob of text (raw notes, transcripts, or a CSV flattened to text). Extract a structured JSON summary.

Respond with a SINGLE JSON object only — no prose, no markdown fences. Match this shape exactly:

${SUMMARY_JSON_SHAPE}

Rules:
- Be faithful to the input; do not invent entities or action items.
- "owner" is null when no owner is clearly named.
- "priority" is your best inference from urgency cues (deadlines, severity words).
- Keep "summary" to 2-3 sentences.
- Use empty arrays if a section has nothing to report.`;

export async function extractStructuredSummary(
  rawText: string,
  inputType: "text" | "csv",
  rowCount: number | null
): Promise<Summary> {
  const groq = client();

  const userMsg = `Input type: ${inputType}\n\n---\n${rawText}\n---`;

  const callOnce = async (extraSystem?: string) => {
    const resp = await groq.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + (extraSystem ? `\n\n${extraSystem}` : "") },
        { role: "user", content: userMsg },
      ],
    });
    return resp.choices[0]?.message?.content ?? "";
  };

  let content = await callOnce();
  let parsed = safeJson(content);
  let validated = parsed ? SummarySchema.omit({ metadata: true }).safeParse(parsed) : null;

  if (!validated || !validated.success) {
    content = await callOnce(
      "Your previous response was not valid JSON matching the required shape. Try again, output JSON only."
    );
    parsed = safeJson(content);
    validated = parsed ? SummarySchema.omit({ metadata: true }).safeParse(parsed) : null;
    if (!validated || !validated.success) {
      const err = validated && "error" in validated ? validated.error.message : "unparseable";
      throw new Error(`LLM did not return valid JSON: ${err}. Raw: ${content.slice(0, 400)}`);
    }
  }

  return {
    ...validated.data,
    metadata: {
      input_type: inputType,
      input_size_chars: rawText.length,
      row_count: rowCount,
      model: MODEL,
      generated_at: new Date().toISOString(),
    },
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
