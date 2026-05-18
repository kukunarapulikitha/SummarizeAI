import { NextRequest, NextResponse } from "next/server";
import { parseCsvToText } from "@/lib/csv";
import { extractStructuredSummary } from "@/lib/groq";
import { postToWebhook } from "@/lib/webhook";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const inputType = String(form.get("inputType") ?? "");
  const webhookUrl = String(form.get("webhookUrl") ?? "").trim();

  if (inputType !== "text" && inputType !== "csv") {
    return NextResponse.json({ error: "inputType must be 'text' or 'csv'" }, { status: 400 });
  }

  let rawText = "";
  let rowCount: number | null = null;

  if (inputType === "text") {
    rawText = String(form.get("text") ?? "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "text input is empty" }, { status: 400 });
    }
  } else {
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required for csv input" }, { status: 400 });
    }
    const csvRaw = await file.text();
    if (!csvRaw.trim()) {
      return NextResponse.json({ error: "csv file is empty" }, { status: 400 });
    }
    const parsed = parseCsvToText(csvRaw);
    rawText = parsed.text;
    rowCount = parsed.rowCount;
  }

  let summary;
  try {
    summary = await extractStructuredSummary(rawText, inputType, rowCount);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("GROQ_API_KEY") ? 500 : 422;
    return NextResponse.json({ error: msg }, { status });
  }

  let delivery = null;
  if (webhookUrl) {
    try {
      new URL(webhookUrl);
      delivery = await postToWebhook(webhookUrl, summary);
    } catch {
      delivery = { ok: false, status: null, error: "Invalid webhook URL" };
    }
  }

  return NextResponse.json({ summary, delivery });
}
