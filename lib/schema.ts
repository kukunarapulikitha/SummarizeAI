import { z } from "zod";

export const SummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  key_points: z.array(z.string()).max(8),
  entities: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["person", "org", "product", "location", "other"]),
      })
    )
    .max(20),
  action_items: z
    .array(
      z.object({
        item: z.string(),
        owner: z.string().nullable(),
        priority: z.enum(["low", "medium", "high"]),
      })
    )
    .max(10),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  metadata: z.object({
    input_type: z.enum(["text", "csv"]),
    input_size_chars: z.number(),
    row_count: z.number().nullable(),
    model: z.string(),
    generated_at: z.string(),
  }),
});

export type Summary = z.infer<typeof SummarySchema>;

export const SUMMARY_JSON_SHAPE = `{
  "title": "string, one-line headline",
  "summary": "string, 2-3 sentence overview",
  "key_points": ["string", "..."],                     // max 8
  "entities": [
    { "name": "string", "type": "person|org|product|location|other" }
  ],                                                    // max 20
  "action_items": [
    { "item": "string", "owner": "string or null", "priority": "low|medium|high" }
  ],                                                    // max 10
  "sentiment": "positive|neutral|negative|mixed"
}`;
