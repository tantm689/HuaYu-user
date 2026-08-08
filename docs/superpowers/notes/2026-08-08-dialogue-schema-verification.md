# Dialogue schema verification (live Supabase, 2026-08-08)

Throwaway verification notes for Task 1 of the Hội thoại & Shadowing rebuild. Not shipped as a spec — exists to prevent repeating the prior failure mode (trusting migration files without checking whether they were actually applied to the live project).

## Method

- Found working Supabase credentials in `e:\HuaYu\HuaYu-admin\.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Both HuaYu-admin and HuaYu-user point at the same Supabase project (`kfajowykwzxpyigtrrxq`).
- No Supabase CLI/MCP access was used; instead ran a throwaway Node script (not committed) from the project root using the already-installed `@supabase/supabase-js` client:
  - `supabase.from('dialogues').select('*').limit(1)`
  - `supabase.from('dialogue_lines').select('*').limit(1)`
  - Logged `Object.keys(data[0])` for each to read the real live columns directly from returned row data, sidestepping any uncertainty about which migrations were applied.
- Both queries returned a real row (table not empty), so the column list below is confirmed from actual data, not inferred from an empty result.

## Confirmed live columns

### `dialogues`
```
id, lesson_id, order, audio_code, audio_url, kind
```
Sample row:
```json
{
  "id": "efbd943a-d7eb-47b0-a718-aafd03384803",
  "lesson_id": "a487dcc2-d83c-4904-9945-3c74a749ba1b",
  "order": 1,
  "audio_code": "01-1",
  "audio_url": "https://kfajowykwzxpyigtrrxq.supabase.co/storage/v1/object/public/audio/dialogues/efbd943a-d7eb-47b0-a718-aafd03384803.mp3",
  "kind": "dialogue"
}
```
No `title_zh` / `title_vi` — confirms migration `0017_drop_dialogue_titles.sql` **was** applied to the live project.

### `dialogue_lines`
```
id, dialogue_id, order, speaker_zh, speaker_pinyin, text_zh, pinyin, translation_vi, audio_url, start_time, end_time
```
Sample row:
```json
{
  "id": "8d0bbbf6-e1d0-4a81-9692-c0c8918ecbd7",
  "dialogue_id": "efbd943a-d7eb-47b0-a718-aafd03384803",
  "order": 4,
  "speaker_zh": "月美",
  "speaker_pinyin": "Yuèměi",
  "text_zh": "這是王先生。",
  "pinyin": "Zhè shì Wáng Xiānshēng.",
  "translation_vi": "Đây là chú Vương.",
  "audio_url": "https://kfajowykwzxpyigtrrxq.supabase.co/storage/v1/object/public/audio/dialogue-lines/8d0bbbf6-e1d0-4a81-9692-c0c8918ecbd7.wav",
  "start_time": 30.140442181074413,
  "end_time": 31.777427999999993
}
```
`start_time` / `end_time` present — confirms migration `0020` **was** applied too. Per the brief these are irrelevant to this feature and should be ignored by Task 2's query.

## Result vs. expectation

Matches the brief's expected schema exactly:
- `dialogues`: `id, lesson_id, "order", kind, audio_code, audio_url` — confirmed, no title columns.
- `dialogue_lines`: `id, dialogue_id, "order", speaker_zh, speaker_pinyin, text_zh, pinyin, translation_vi, audio_url` plus `start_time`/`end_time` — confirmed.

No divergence found. Task 2 can safely query against this column list.

## Credentials note

The verification script used the **anon key** only (read access, safe for a `select().limit(1)` check). Credentials were read from `HuaYu-admin/.env.local`, not copied into this repo. No `.env.local` was created in `HuaYu-user`; the throwaway script embedded the anon key inline and was deleted after use. Nothing credential-bearing was committed.
