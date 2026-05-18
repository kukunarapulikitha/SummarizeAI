"use client";

import { useState } from "react";
import type { Summary } from "@/lib/schema";

type DeliveryResult = { ok: boolean; status: number | null; error?: string } | null;

type ApiResponse = { summary: Summary; delivery: DeliveryResult } | { error: string };

export default function Home() {
  const [tab, setTab] = useState<"text" | "csv">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Summary | null>(null);
  const [delivery, setDelivery] = useState<DeliveryResult>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setDelivery(null);

    const form = new FormData();
    form.set("inputType", tab);
    form.set("webhookUrl", webhookUrl);
    if (tab === "text") form.set("text", text);
    if (tab === "csv" && file) form.set("file", file);

    try {
      const res = await fetch("/api/summarize", { method: "POST", body: form });
      const json: ApiResponse = await res.json();
      if (!res.ok || "error" in json) {
        setError("error" in json ? json.error : `Request failed (${res.status})`);
      } else {
        setResult(json.summary);
        setDelivery(json.delivery);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Messy → Structured</h1>
          <p className="text-neutral-400 mt-1">
            Paste a messy text blob or upload a CSV. Get a structured summary back, delivered to a
            webhook of your choice.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="space-y-5 bg-neutral-900 rounded-xl p-5 border border-neutral-800"
        >
          <div className="flex gap-2">
            <TabButton active={tab === "text"} onClick={() => setTab("text")}>
              Paste text
            </TabButton>
            <TabButton active={tab === "csv"} onClick={() => setTab("csv")}>
              Upload CSV
            </TabButton>
          </div>

          {tab === "text" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a meeting transcript, customer feedback dump, raw notes..."
              rows={10}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-neutral-600"
            />
          ) : (
            <div className="border border-dashed border-neutral-700 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block mx-auto text-sm"
              />
              {file && (
                <p className="text-xs text-neutral-400 mt-2">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm text-neutral-300 mb-1">Webhook URL (optional)</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://webhook.site/your-unique-id"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-neutral-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (tab === "text" ? !text.trim() : !file)}
            className="w-full bg-white text-black font-medium rounded-lg py-2.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-200 transition"
          >
            {loading ? "Summarizing..." : "Summarize & send"}
          </button>
        </form>

        {error && (
          <div className="mt-6 bg-red-950/40 border border-red-900 text-red-200 rounded-lg p-4 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <section className="mt-6 space-y-4">
            {delivery && (
              <div
                className={`rounded-lg p-3 text-sm border ${
                  delivery.ok
                    ? "bg-emerald-950/40 border-emerald-900 text-emerald-200"
                    : "bg-amber-950/40 border-amber-900 text-amber-200"
                }`}
              >
                Webhook delivery:{" "}
                {delivery.ok
                  ? `OK (HTTP ${delivery.status})`
                  : `failed${delivery.status ? ` (HTTP ${delivery.status})` : ""}${
                      delivery.error ? ` — ${delivery.error}` : ""
                    }`}
              </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">{result.title}</h2>
                <SentimentChip sentiment={result.sentiment} />
              </div>
              <p className="text-neutral-300 mt-2">{result.summary}</p>

              {result.key_points.length > 0 && (
                <Block title="Key points">
                  <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-300">
                    {result.key_points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </Block>
              )}

              {result.action_items.length > 0 && (
                <Block title="Action items">
                  <ul className="space-y-1.5 text-sm">
                    {result.action_items.map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <PriorityChip priority={a.priority} />
                        <span className="text-neutral-200">{a.item}</span>
                        {a.owner && <span className="text-neutral-500">— {a.owner}</span>}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {result.entities.length > 0 && (
                <Block title="Entities">
                  <div className="flex flex-wrap gap-1.5">
                    {result.entities.map((e, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs bg-neutral-800 border border-neutral-700 rounded-full px-2 py-1"
                      >
                        <span className="text-neutral-200">{e.name}</span>
                        <span className="text-neutral-500">· {e.type}</span>
                      </span>
                    ))}
                  </div>
                </Block>
              )}

              <Block title="Metadata">
                <pre className="text-xs text-neutral-400 bg-neutral-950 border border-neutral-800 rounded p-2 overflow-x-auto">
                  {JSON.stringify(result.metadata, null, 2)}
                </pre>
              </Block>
            </div>

            <details className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
              <summary className="cursor-pointer text-sm text-neutral-300">
                Raw JSON (what was sent to the webhook)
              </summary>
              <pre className="text-xs text-neutral-400 mt-3 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-md text-sm transition ${
        active
          ? "bg-white text-black"
          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SentimentChip({ sentiment }: { sentiment: Summary["sentiment"] }) {
  const colors: Record<Summary["sentiment"], string> = {
    positive: "bg-emerald-950/60 text-emerald-300 border-emerald-900",
    neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
    negative: "bg-red-950/60 text-red-300 border-red-900",
    mixed: "bg-amber-950/60 text-amber-300 border-amber-900",
  };
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${colors[sentiment]}`}>
      {sentiment}
    </span>
  );
}

function PriorityChip({ priority }: { priority: "low" | "medium" | "high" }) {
  const colors = {
    low: "bg-neutral-800 text-neutral-400 border-neutral-700",
    medium: "bg-amber-950/60 text-amber-300 border-amber-900",
    high: "bg-red-950/60 text-red-300 border-red-900",
  } as const;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded border ${colors[priority]} uppercase tracking-wide shrink-0 mt-0.5`}
    >
      {priority}
    </span>
  );
}
