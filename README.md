# Messy → Structured

Mini-automation: paste a messy text blob or upload a CSV, get a structured JSON summary back, and POST it to a webhook.

## Stack

- **Next.js 14** (App Router, TypeScript) on **Vercel**
- **Groq** (`llama-3.3-70b-versatile`) for fast, JSON-mode LLM extraction
- **Zod** as the structured-output contract
- **PapaParse** for messy CSV handling
- **Tailwind** for the UI

## Local setup

```bash
npm install
cp .env.example .env.local   # then put your real GROQ_API_KEY in
npm run dev
```

Open http://localhost:3000.

Get a Groq API key (free) at https://console.groq.com.

## How it works

1. User pastes meeting notes in the browser
   ↓
2. Clicks "Summarize & send"
   ↓
3. Frontend sends POST to /api/summarize with:
   - inputType: "text"
   - text: "monday standup, q3 launch sync..."
   - webhookUrl: "https://webhook.site/abc123"
   ↓
4. Backend receives request in route.ts
   ↓
5. Extracts rawText = "monday standup, q3 launch sync..."
   ↓
6. Calls extractStructuredSummary(rawText) → groq.ts
   ↓
7. Groq API returns (example):
   {
     "title": "Q3 Launch Status",
     "summary": "Launch slipping to Aug 29 due to iOS crashes and QA.",
     "key_points": ["Marketing email booked for Aug 22", "Backend ready", "Need Carlos for platform help"],
     "entities": [{"name": "Carlos", "type": "person"}, {"name": "iOS", "type": "product"}],
     "action_items": [
       {"item": "Ping Carlos's manager", "owner": "Me", "priority": "high"},
       {"item": "Write iOS bug repro", "owner": "James", "priority": "high"}
     ],
     "sentiment": "neutral"
   }
   ↓
8. SummarySchema validates the JSON ✓
   ↓
9. postToWebhook sends it to https://webhook.site/abc123
   ↓
10. Frontend displays:
    - Title: "Q3 Launch Status"
    - Summary (2-3 sentences)
    - Key points list
    - Action items with owners & priority colors
    - Entities (people, orgs, products)
    - Sentiment chip (neutral)
    - Raw JSON in a collapsible details box

1. UI submits a `FormData` to `POST /api/summarize` with `inputType`, optional `webhookUrl`, and either `text` or a CSV `file`.
2. CSV inputs are flattened to LLM-friendly text via `lib/csv.ts` (PapaParse, capped at 200 rows / 30k chars).
3. `lib/groq.ts` calls Groq with `response_format: { type: "json_object" }` and a strict system prompt describing the schema. One retry on invalid JSON.
4. The model output is validated by `SummarySchema` (Zod) in `lib/schema.ts`.
5. If a webhook URL was provided, the validated summary is POSTed there (`lib/webhook.ts`, 5s timeout). Webhook failures don't fail the user's request — they show up as a delivery status badge.
6. UI renders the structured summary; raw JSON is viewable in a `<details>` block.

## The output contract

See `lib/schema.ts`. Every response includes:

- `title`, `summary` (2–3 sentences)
- `key_points[]`
- `entities[]` (typed: person / org / product / location / other)
- `action_items[]` with `owner` and `priority`
- `sentiment` (positive / neutral / negative / mixed)
- `metadata` (input type, size, row count, model, timestamp)

## Demo

Sample inputs live in `public/samples/`:

- `meeting-notes.txt` — a rambly Q3 launch standup transcript
- `support-tickets.csv` — 10 mixed-priority customer tickets

Recommended webhook target for the demo: https://webhook.site — paste your unique URL into the form and watch the structured JSON arrive in real time.

## Deploy

```bash
npx vercel              # link the project
npx vercel env add GROQ_API_KEY   # paste your key
npx vercel --prod
```

## Extending it (answering "can it also do [X]?")

Three extension points, each ~one file:

- **Add a field** to the structured output → edit `lib/schema.ts` (Zod) and the `SUMMARY_JSON_SHAPE` description.
- **Change extraction behavior** (translate, classify by department, summarize in a specific tone) → edit the system prompt in `lib/groq.ts`.
- **Change routing** (only send `high` priority items, fan out to multiple webhooks) → branch in `app/api/summarize/route.ts` before the `postToWebhook` call.

The Zod schema is the contract — keeping that explicit makes "can it also do X" usually a one-file change, not a rewrite.

### Common client requests & where to change

| Client Request | Solution | File to Edit |
|---|---|---|
| "Extract emails & phone numbers?" | Add field | `schema.ts` |
| "Summarize in different tones (executive vs technical)?" | Change prompt | `groq.ts` |
| "Only send urgent items?" | Filter before webhook | `route.ts` |
| "Tag by department (Sales/Support/Eng)?" | Add field + prompt | `schema.ts` + `groq.ts` |
| "Extract budget amounts?" | Add field | `schema.ts` |
| "Save to database instead of webhook?" | Add branch | `route.ts` |
| "Send to different Slack channels based on sentiment?" | Add conditional | `route.ts` |
| "Translate summaries to Spanish?" | Change prompt | `groq.ts` |
| "Extract due dates?" | Add field | `schema.ts` |

### The pattern

- **Schema** = structure (what fields exist)
- **Prompt** = behavior (what the LLM extracts/how it behaves)
- **Route** = routing logic (where data goes, what gets filtered)

Change the right file → solve the problem with minimal code.
