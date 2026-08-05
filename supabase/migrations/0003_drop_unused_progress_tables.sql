-- 0003_drop_unused_progress_tables.sql
-- quiz_attempts and typing_progress turned out to have no real payoff for
-- the learner: quiz_attempts only ever backed a "best score" badge with no
-- history view anywhere, and typing_progress was written to (upsert) on
-- every keystroke but never read back - its streak always reset to 0 on
-- every page revisit, so the column existed purely as write-only dead
-- weight. Dropped instead of left unused, since a future "learning streak"
-- or "lesson progress" feature (discussed, not yet designed) would need a
-- different shape anyway, not a resurrection of these two tables.
--
-- vocabulary_progress (the SRS flashcard table, from the same original
-- migration 0001_progress_tables.sql) is untouched - it backs the "Ôn hôm
-- nay" due-cards feature on the home page, which is actually used.

drop table if exists quiz_attempts;
drop table if exists typing_progress;
