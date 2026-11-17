-- Repertoire pieces that can be ranked (src/content/songs). The numbers are what the game counts for the piece
-- (notes the server can score, duration, best possible score); a test recomputes them from the notes and fails
-- if the piece changes without this file. register-part only returns rows that exist, so a piece is rankable
-- only after it is listed here AND in src/services/rankable.ts. Never edit a published row: a changed piece
-- needs a new migration that updates it. Safe to run twice.
insert into public.song_parts (
  song_id, part_id, revision_id, title, artist, track_name, scorable_notes, duration_ms, max_score
) values
  (-200010, 0, 0, 'Ode à Alegria', 'Beethoven', 'Melodia', 62, 53333, 32700)
on conflict (song_id, part_id) do nothing;
