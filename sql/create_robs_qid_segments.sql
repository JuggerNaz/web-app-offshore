-- robs-extended desktop recorder: QID time-segment marks.
--
-- While recording, the ROBS operator clicks a QID (structure_components.q_id)
-- to mark "from this time to this time belonged to this QID". Each closed
-- segment is written here by the ROBS app (direct Postgres over the Supabase
-- session pooler, run once in the Supabase SQL editor).
--
-- Anchors recorded per segment:
--   wall_start / wall_end        UTC wall clock
--   elapsed_start_ms / _end_ms   recording elapsed ms (excludes paused spans)
--   frame_start / frame_end      exact file position in frames (clip-cut ready)
--
-- Raw evidence table: converting segments into insp_records stays a separate
-- workflow. The ROBS `postgres` role bypasses RLS (table owner); the policies
-- below let authenticated web-app users read/mark them later.

create table if not exists public.robs_qid_segments (
  id bigint generated always as identity primary key,
  structure_id bigint not null references public.structure (str_id) on delete cascade,
  component_id bigint not null,
  q_id text not null,
  recording_path text not null default '',
  wall_start timestamptz not null,
  wall_end timestamptz not null,
  elapsed_start_ms bigint not null default 0,
  elapsed_end_ms bigint not null default 0,
  frame_start bigint not null default 0,
  frame_end bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_robs_qid_segments_structure_wall
  on public.robs_qid_segments (structure_id, wall_start);

create index if not exists idx_robs_qid_segments_component
  on public.robs_qid_segments (component_id);

alter table public.robs_qid_segments enable row level security;

drop policy if exists "authenticated full access robs_qid_segments"
  on public.robs_qid_segments;
create policy "authenticated full access robs_qid_segments"
  on public.robs_qid_segments
  for all to authenticated
  using (true)
  with check (true);
