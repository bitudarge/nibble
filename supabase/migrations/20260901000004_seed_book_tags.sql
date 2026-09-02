-- Nibble — Phase 2: starter tag vocabulary.
--
-- A sensible default list per type. Safe to re-run (on conflict do nothing),
-- and easy to extend later with more inserts in a new migration.

insert into public.book_tags (type, name) values
  ('mood', 'cozy'),
  ('mood', 'dark'),
  ('mood', 'funny'),
  ('mood', 'heartwarming'),
  ('mood', 'tense'),
  ('mood', 'melancholic'),
  ('mood', 'uplifting'),
  ('mood', 'thought-provoking'),
  ('mood', 'romantic'),
  ('mood', 'eerie'),

  ('pace', 'slow-burn'),
  ('pace', 'moderate'),
  ('pace', 'fast-paced'),
  ('pace', 'page-turner'),

  ('spice_level', 'none'),
  ('spice_level', 'mild'),
  ('spice_level', 'moderate'),
  ('spice_level', 'spicy'),
  ('spice_level', 'explicit'),

  ('genre', 'fantasy'),
  ('genre', 'sci-fi'),
  ('genre', 'romance'),
  ('genre', 'mystery'),
  ('genre', 'thriller'),
  ('genre', 'literary-fiction'),
  ('genre', 'historical-fiction'),
  ('genre', 'horror'),
  ('genre', 'non-fiction'),
  ('genre', 'memoir'),
  ('genre', 'young-adult'),
  ('genre', 'contemporary'),
  ('genre', 'classics'),
  ('genre', 'poetry'),
  ('genre', 'graphic-novel')
on conflict (type, name) do nothing;
