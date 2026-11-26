-- SODMUN portal: Points of Information (chair-moderated) and resolution uploads.
-- Run once in Supabase → SQL Editor. Safe to re-run: everything is "if not exists"
-- or "create or replace", and no existing table is altered.

-- ── Helpers ───────────────────────────────────────────────────────────────
-- The caller's committee and whether they chair it (any non-Delegate role).
create or replace function public.my_committee() returns text
  language sql stable security definer set search_path = public as
$$ select committee from public.users where id = auth.uid() $$;

create or replace function public.is_chair() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role <> 'Delegate' from public.users where id = auth.uid()), false) $$;

-- ── Points of Information ────────────────────────────────────────────────
-- Flow: delegate asks → chair approves question → recipient answers →
-- chair approves answer → asker sees it. Chairs may reject at either step.
create table if not exists public.pois (
  id              bigint generated always as identity primary key,
  committee       text        not null,
  from_user       uuid        not null references public.users(id) on delete cascade,
  to_user         uuid        not null references public.users(id) on delete cascade,
  question        text        not null check (char_length(question) between 1 and 1000),
  question_status text        not null default 'pending' check (question_status in ('pending','approved','rejected')),
  answer          text                 check (answer is null or char_length(answer) between 1 and 1000),
  answer_status   text                 check (answer_status in ('pending','approved','rejected')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists pois_committee_idx on public.pois (committee, created_at desc);

alter table public.pois enable row level security;

-- No select policy: row-level security can't hide a single column, and the
-- asker must not read an answer before the chair approves it. Everyone reads
-- through poi_feed() below, which applies the visibility rules and masks
-- unapproved answers. Any existing read policy from an earlier run is removed.
drop policy if exists pois_read on public.pois;

create or replace function public.poi_feed()
returns table (
  id bigint, committee text, from_user uuid, to_user uuid,
  question text, question_status text, answer text, answer_status text,
  created_at timestamptz, updated_at timestamptz,
  asker_delegation text, asker_role text, recipient_delegation text, recipient_role text
)
language sql stable security definer set search_path = public as
$$
  select p.id, p.committee, p.from_user, p.to_user,
         p.question, p.question_status,
         -- chairs and the answering delegate see the answer; the asker only once approved
         case when public.is_chair() or p.to_user = auth.uid() or p.answer_status = 'approved'
              then p.answer end,
         p.answer_status, p.created_at, p.updated_at,
         a.delegation, a.role, r.delegation, r.role
    from public.pois p
    join public.users a on a.id = p.from_user
    join public.users r on r.id = p.to_user
   where p.committee = public.my_committee()
     and (public.is_chair()
          or p.from_user = auth.uid()
          or (p.to_user = auth.uid() and p.question_status = 'approved'))
   order by p.created_at desc
   limit 300
$$;
grant execute on function public.poi_feed() to authenticated;

-- Ask: only as yourself, within your committee, always starting as pending.
drop policy if exists pois_ask on public.pois;
create policy pois_ask on public.pois for insert with check (
  from_user = auth.uid()
  and to_user <> auth.uid()
  and committee = public.my_committee()
  and question_status = 'pending'
  and answer is null and answer_status is null
);

-- No direct updates: answering and reviewing go through the functions below,
-- which enforce who may change what.

create or replace function public.poi_answer(p_id bigint, p_answer text) returns void
  language plpgsql security definer set search_path = public as
$$
begin
  update public.pois
     set answer = p_answer, answer_status = 'pending', updated_at = now()
   where id = p_id
     and to_user = auth.uid()
     and question_status = 'approved'
     and (answer_status is null or answer_status = 'rejected');
  if not found then raise exception 'You cannot answer this POI'; end if;
end $$;

-- p_stage: 'question' or 'answer'; p_approve: true approves, false rejects.
create or replace function public.poi_review(p_id bigint, p_stage text, p_approve boolean) returns void
  language plpgsql security definer set search_path = public as
$$
declare v_status text := case when p_approve then 'approved' else 'rejected' end;
begin
  if not public.is_chair() then raise exception 'Only chairs can review POIs'; end if;
  if p_stage = 'question' then
    update public.pois set question_status = v_status, updated_at = now()
     where id = p_id and committee = public.my_committee() and question_status = 'pending';
  elsif p_stage = 'answer' then
    update public.pois set answer_status = v_status, updated_at = now()
     where id = p_id and committee = public.my_committee() and answer_status = 'pending';
  else
    raise exception 'Unknown stage %', p_stage;
  end if;
  if not found then raise exception 'Nothing to review'; end if;
end $$;

grant execute on function public.poi_answer(bigint, text) to authenticated;
grant execute on function public.poi_review(bigint, text, boolean) to authenticated;

-- ── Resolution uploads ───────────────────────────────────────────────────
create table if not exists public.resolution_uploads (
  id          bigint generated always as identity primary key,
  committee   text        not null,
  uploaded_by uuid        not null references public.users(id) on delete cascade,
  title       text        not null check (char_length(title) between 1 and 200),
  file_path   text        not null unique,
  file_name   text        not null,
  file_size   bigint      not null,
  created_at  timestamptz not null default now()
);
create index if not exists resolution_uploads_committee_idx on public.resolution_uploads (committee, created_at desc);

alter table public.resolution_uploads enable row level security;

-- Delegates see their own uploads; chairs see everything in their committee.
drop policy if exists reso_read on public.resolution_uploads;
create policy reso_read on public.resolution_uploads for select using (
  committee = public.my_committee() and (public.is_chair() or uploaded_by = auth.uid())
);
drop policy if exists reso_insert on public.resolution_uploads;
create policy reso_insert on public.resolution_uploads for insert with check (
  uploaded_by = auth.uid() and committee = public.my_committee()
);
drop policy if exists reso_delete on public.resolution_uploads;
create policy reso_delete on public.resolution_uploads for delete using (uploaded_by = auth.uid());

-- Private bucket. Files live at <committee>/<user id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resolutions', 'resolutions', false, 10485760,
        array['application/pdf',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

drop policy if exists reso_files_read on storage.objects;
create policy reso_files_read on storage.objects for select using (
  bucket_id = 'resolutions'
  and (storage.foldername(name))[1] = public.my_committee()
  and (public.is_chair() or (storage.foldername(name))[2] = auth.uid()::text)
);
drop policy if exists reso_files_insert on storage.objects;
create policy reso_files_insert on storage.objects for insert with check (
  bucket_id = 'resolutions'
  and (storage.foldername(name))[1] = public.my_committee()
  and (storage.foldername(name))[2] = auth.uid()::text
);
drop policy if exists reso_files_delete on storage.objects;
create policy reso_files_delete on storage.objects for delete using (
  bucket_id = 'resolutions' and (storage.foldername(name))[2] = auth.uid()::text
);
