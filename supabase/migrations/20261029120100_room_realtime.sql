-- Online rooms (src/services/backend/roomChannel.ts) use private Realtime channels named room:<CODE>, with
-- Broadcast for the game messages and Presence for who is in the room. Realtime checks these policies when a
-- player joins a channel and never stores the messages in this table.
-- Only signed-in players (Supabase anonymous accounts included, created after consent), only topics that are
-- valid room codes, only Broadcast and Presence. For this to apply to every channel, "Allow public access"
-- must be off in the project's Realtime settings (otherwise clients could still open public channels).

create policy "prgb rooms: signed-in players receive"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) ~ '^room:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  and realtime.messages.extension in ('broadcast', 'presence')
);

create policy "prgb rooms: signed-in players send"
on realtime.messages
for insert
to authenticated
with check (
  (select realtime.topic()) ~ '^room:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'
  and realtime.messages.extension in ('broadcast', 'presence')
);
