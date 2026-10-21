-- Floof: full Supabase setup (schema + starter content).
-- Paste this whole file into Supabase → SQL Editor → New query → Run. Safe to run again.

-- Floof database schema for Supabase.
-- Paste into Supabase → SQL Editor → Run (or use `supabase db push`).
-- Safe to re-run: everything is "create if not exists" / "create or replace".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.pets (
  id text primary key default gen_random_uuid()::text,
  owner_id uuid references auth.users (id) on delete cascade, -- null = Floof house pet (seed content)
  handle text not null unique check (handle ~ '^[a-z0-9._]{2,30}$'),
  name text not null check (char_length(name) between 1 and 40),
  species text not null check (species in ('dog', 'cat', 'bunny', 'hamster')),
  breed text not null default '',
  age text not null default '',
  city text not null default '',
  bio text[] not null default '{}',
  look jsonb not null,
  photo_url text,
  bg text not null default '#FDE7EC',
  clan text check (clan in ('cats', 'dogs')),
  verified boolean not null default false,
  meetups_opt_in boolean not null default false,
  -- starting numbers for house pets so the demo feels alive
  followers_base int not null default 0,
  following_base int not null default 0,
  biscuits_base int not null default 0,
  paw_score_base int not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists pets_owner_idx on public.pets (owner_id);
-- Added later: dates for birthday / Gotcha Day reminders.
alter table public.pets add column if not exists birthday date;
alter table public.pets add column if not exists gotcha_day date;

create table if not exists public.posts (
  id text primary key default gen_random_uuid()::text,
  pet_id text not null references public.pets (id) on delete cascade,
  scene text not null default 'park',
  accessory text not null default 'none',
  expression text not null default 'happy',
  image_url text,
  overlay text check (char_length(overlay) <= 40),
  caption text not null default '' check (char_length(caption) <= 500),
  tags text[] not null default '{}',
  location text,
  moment text,
  slides int,
  boops_base int not null default 0,
  biscuits_base int not null default 0,
  comments_base int not null default 0,
  created_at timestamptz not null default now()
);
-- Added later: every photo of a post, in order (image_url is the cover).
alter table public.posts add column if not exists image_urls text[] not null default '{}';
alter table public.posts drop constraint if exists posts_image_urls_max;
alter table public.posts add constraint posts_image_urls_max check (cardinality(image_urls) <= 6);

-- Added later: photo check. New photo posts start 'pending' and only appear to others once
-- the server (app/api/moderate) marks them 'approved'. Drawn posts are approved straight away.
alter table public.posts add column if not exists status text not null default 'approved';
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts add constraint posts_status_check check (status in ('pending', 'approved', 'rejected'));
alter table public.posts add column if not exists moderation_note text;
-- Added later: which day's Daily Floof prompt this post answers.
alter table public.posts add column if not exists daily_date date;
create index if not exists posts_daily_idx on public.posts (daily_date) where daily_date is not null;

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_pet_idx on public.posts (pet_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null references public.posts (id) on delete cascade,
  pet_id text not null references public.pets (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 300),
  likes int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id);

create table if not exists public.boops (
  post_id text not null references public.posts (id) on delete cascade,
  pet_id text not null references public.pets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, pet_id)
);

create table if not exists public.saves (
  post_id text not null references public.posts (id) on delete cascade,
  pet_id text not null references public.pets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, pet_id)
);

create table if not exists public.follows (
  follower_id text not null references public.pets (id) on delete cascade,
  followee_id text not null references public.pets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- Every biscuit movement. Wallet balance and earnings are sums over this table.
create table if not exists public.biscuit_ledger (
  id uuid primary key default gen_random_uuid(),
  pet_id text not null references public.pets (id) on delete cascade, -- whose wallet
  kind text not null check (kind in ('welcome', 'topup', 'sent', 'received', 'redeem')),
  amount int not null check (amount > 0),
  counterparty_id text references public.pets (id) on delete set null,
  post_id text references public.posts (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_pet_idx on public.biscuit_ledger (pet_id, created_at desc);
create index if not exists ledger_post_idx on public.biscuit_ledger (post_id) where post_id is not null;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  from_pet text not null references public.pets (id) on delete cascade,
  to_pet text not null references public.pets (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_to_idx on public.messages (to_pet, created_at);
create index if not exists messages_from_idx on public.messages (from_pet, created_at);

-- Events, meetups, competitions and packs are defined in the app (lib/data.ts);
-- these tables record what each pet did with them.
create table if not exists public.event_rsvps (
  event_id text not null,
  pet_id text not null references public.pets (id) on delete cascade,
  status text not null check (status in ('interested', 'going')),
  checked_in boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (event_id, pet_id)
);

create table if not exists public.competition_entries (
  competition_id text not null,
  pet_id text not null references public.pets (id) on delete cascade,
  post_id text not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (competition_id, pet_id)
);

create table if not exists public.competition_votes (
  competition_id text not null,
  voter_id text not null references public.pets (id) on delete cascade,
  post_id text not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (competition_id, voter_id)
);

create table if not exists public.pack_members (
  pack_id text not null,
  pet_id text not null references public.pets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pack_id, pet_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the signed-in user owns this pet.
create or replace function public.owns_pet(p_pet text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.pets where id = p_pet and owner_id = auth.uid());
$$;

-- Give every new (real) pet 50 welcome biscuits.
create or replace function public.welcome_biscuits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    insert into public.biscuit_ledger (pet_id, kind, amount, note)
    values (new.id, 'welcome', 50, 'Welcome gift from Floof 🎁');
  end if;
  return new;
end;
$$;

drop trigger if exists pets_welcome_biscuits on public.pets;
create trigger pets_welcome_biscuits
after insert on public.pets
for each row execute function public.welcome_biscuits();

-- Spendable wallet balance (welcome + top-ups − sent).
create or replace function public.wallet_balance(p_pet text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case when kind in ('welcome', 'topup') then amount
                           when kind = 'sent' then -amount else 0 end), 0)::int
  from public.biscuit_ledger where pet_id = p_pet;
$$;

-- Send biscuits from one of my pets to another pet (optionally for a post).
create or replace function public.send_biscuits(p_from text, p_to text, p_amount int, p_note text default null, p_post text default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  bal int;
begin
  if not public.owns_pet(p_from) then raise exception 'not your pet'; end if;
  if p_from = p_to then raise exception 'cannot send biscuits to yourself'; end if;
  if p_amount < 1 or p_amount > 100 then raise exception 'amount must be 1-100'; end if;
  if not exists (select 1 from public.pets where id = p_to) then raise exception 'unknown pet'; end if;
  if p_post is not null and not exists (select 1 from public.posts where id = p_post and pet_id = p_to) then
    p_post := null;
  end if;

  -- serialise spends per wallet so the balance can't go negative
  perform pg_advisory_xact_lock(hashtext('wallet:' || p_from));
  bal := public.wallet_balance(p_from);
  if bal < p_amount then raise exception 'not enough biscuits'; end if;

  insert into public.biscuit_ledger (pet_id, kind, amount, counterparty_id, post_id, note)
  values (p_from, 'sent', p_amount, p_to, p_post, left(p_note, 80)),
         (p_to, 'received', p_amount, p_from, p_post, left(p_note, 80));
  return bal - p_amount;
end;
$$;

-- DEMO top-up: adds biscuits without payment. Replace with a Stripe webhook before
-- biscuits are worth real money.
create or replace function public.topup_biscuits(p_pet text, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_pet(p_pet) then raise exception 'not your pet'; end if;
  if p_amount not in (10, 50, 140) then raise exception 'invalid pack'; end if;
  insert into public.biscuit_ledger (pet_id, kind, amount, note)
  values (p_pet, 'topup', p_amount, 'Demo top-up (no payment taken)');
  return public.wallet_balance(p_pet);
end;
$$;

-- Spend/donate received biscuits.
create or replace function public.redeem_biscuits(p_pet text, p_amount int, p_note text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  earned int;
begin
  if not public.owns_pet(p_pet) then raise exception 'not your pet'; end if;
  if p_amount < 1 then raise exception 'invalid amount'; end if;
  perform pg_advisory_xact_lock(hashtext('earnings:' || p_pet));
  select p.biscuits_base + coalesce(sum(case when l.kind = 'received' then l.amount
                                             when l.kind = 'redeem' then -l.amount else 0 end), 0)
    into earned
  from public.pets p left join public.biscuit_ledger l on l.pet_id = p.id
  where p.id = p_pet group by p.biscuits_base;
  if earned < p_amount then raise exception 'not enough received biscuits'; end if;
  insert into public.biscuit_ledger (pet_id, kind, amount, note) values (p_pet, 'redeem', p_amount, left(p_note, 80));
  return earned - p_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read models
-- ---------------------------------------------------------------------------

-- Public biscuit totals. The ledger itself is private, so these two views run with
-- the owner's rights and expose only totals (no notes, no who-sent-what).
create or replace view public.pet_biscuit_totals as
select pet_id,
       sum(case when kind = 'received' then amount when kind = 'redeem' then -amount else 0 end)::int as received_net
from public.biscuit_ledger
where kind in ('received', 'redeem')
group by pet_id;

create or replace view public.post_biscuit_totals as
select post_id, sum(amount)::int as total
from public.biscuit_ledger
where kind = 'received' and post_id is not null
group by post_id;

-- Recreated (not replaced) because its column list grows over time.
drop view if exists public.pet_profiles;
create view public.pet_profiles with (security_invoker = true) as
select
  p.id, p.owner_id, p.handle, p.name, p.species, p.breed, p.age, p.city, p.bio, p.look,
  p.photo_url, p.bg, p.clan, p.verified, p.paw_score_base, p.created_at, p.birthday, p.gotcha_day,
  p.followers_base + (select count(*) from public.follows f where f.followee_id = p.id)::int as followers,
  p.following_base + (select count(*) from public.follows f where f.follower_id = p.id)::int as following,
  p.biscuits_base + coalesce((select t.received_net from public.pet_biscuit_totals t where t.pet_id = p.id), 0) as biscuits_received,
  (select count(*) from public.posts x where x.pet_id = p.id)::int as post_count
from public.pets p;

-- Recreated (not replaced) because its column list changes when posts gains columns.
drop view if exists public.post_feed;
create view public.post_feed with (security_invoker = true) as
select
  x.*,
  x.boops_base + (select count(*) from public.boops b where b.post_id = x.id)::int as boop_count,
  x.comments_base + (select count(*) from public.comments c where c.post_id = x.id)::int as comment_count,
  x.biscuits_base + coalesce((select t.total from public.post_biscuit_totals t where t.post_id = x.id), 0) as biscuit_count
from public.posts x;

-- Live Clan War: +5 points per floof posted by each clan in the last 7 days.
create or replace view public.clan_totals with (security_invoker = true) as
select p.clan, (count(*) * 5)::int as points
from public.posts x join public.pets p on p.id = x.pet_id
where p.clan is not null and p.owner_id is not null and x.status = 'approved' and x.created_at > now() - interval '7 days'
group by p.clan;

create or replace view public.competition_vote_counts with (security_invoker = true) as
select competition_id, post_id, count(*)::int as votes
from public.competition_votes
group by competition_id, post_id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.pets enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.boops enable row level security;
alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.biscuit_ledger enable row level security;
alter table public.messages enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.competition_entries enable row level security;
alter table public.competition_votes enable row level security;
alter table public.pack_members enable row level security;

drop policy if exists floof_pets_read on public.pets;
drop policy if exists floof_pets_insert on public.pets;
drop policy if exists floof_pets_update on public.pets;
drop policy if exists floof_pets_delete on public.pets;
create policy floof_pets_read on public.pets for select using (true);
create policy floof_pets_insert on public.pets for insert to authenticated with check (owner_id = auth.uid());
create policy floof_pets_update on public.pets for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy floof_pets_delete on public.pets for delete to authenticated using (owner_id = auth.uid());

-- Owners can't edit the "base" numbers (only house pets have them).
create or replace function public.protect_pet_bases()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.followers_base := old.followers_base;
    new.following_base := old.following_base;
    new.biscuits_base := old.biscuits_base;
    new.paw_score_base := old.paw_score_base;
    new.verified := old.verified;
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;
drop trigger if exists pets_protect_bases on public.pets;
create trigger pets_protect_bases before update on public.pets for each row execute function public.protect_pet_bases();

create or replace function public.reset_pet_bases()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.followers_base := 0; new.following_base := 0; new.biscuits_base := 0;
    new.paw_score_base := 100; new.verified := false;
  end if;
  return new;
end;
$$;
drop trigger if exists pets_reset_bases on public.pets;
create trigger pets_reset_bases before insert on public.pets for each row execute function public.reset_pet_bases();

-- Same idea for posts: real users start every post at zero.
create or replace function public.reset_post_bases()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.boops_base := 0; new.biscuits_base := 0; new.comments_base := 0;
    if new.daily_date is not null and new.daily_date not between current_date - 1 and current_date + 1 then
      new.daily_date := null;
    end if;
    if tg_op = 'INSERT' then
      new.created_at := now();
      new.status := case when new.image_url is not null or cardinality(new.image_urls) > 0 then 'pending' else 'approved' end;
      new.moderation_note := null;
    end if;
    if tg_op = 'UPDATE' then
      new.created_at := old.created_at; new.pet_id := old.pet_id;
      -- Owners can't approve their own posts; changing the photos sends it back for checking.
      if new.image_url is distinct from old.image_url or new.image_urls is distinct from old.image_urls then
        new.status := case when new.image_url is not null or cardinality(new.image_urls) > 0 then 'pending' else 'approved' end;
        new.moderation_note := null;
      else
        new.status := old.status; new.moderation_note := old.moderation_note;
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_reset_bases on public.posts;
create trigger posts_reset_bases before insert or update on public.posts for each row execute function public.reset_post_bases();

drop policy if exists floof_posts_read on public.posts;
drop policy if exists floof_posts_insert on public.posts;
drop policy if exists floof_posts_update on public.posts;
drop policy if exists floof_posts_delete on public.posts;
create policy floof_posts_read on public.posts for select using (status = 'approved' or public.owns_pet(pet_id));
create policy floof_posts_insert on public.posts for insert to authenticated with check (public.owns_pet(pet_id));
create policy floof_posts_update on public.posts for update to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));
create policy floof_posts_delete on public.posts for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_comments_read on public.comments;
drop policy if exists floof_comments_insert on public.comments;
drop policy if exists floof_comments_delete on public.comments;
create policy floof_comments_read on public.comments for select using (true);
create policy floof_comments_insert on public.comments for insert to authenticated with check (public.owns_pet(pet_id) and likes = 0);
create policy floof_comments_delete on public.comments for delete to authenticated using (public.owns_pet(pet_id));

-- Simple "my pet did X" tables: everyone can read, you can add/remove your own rows.
drop policy if exists floof_boops_read on public.boops;
drop policy if exists floof_boops_write on public.boops;
drop policy if exists floof_boops_delete on public.boops;
create policy floof_boops_read on public.boops for select using (true);
create policy floof_boops_write on public.boops for insert to authenticated with check (public.owns_pet(pet_id));
create policy floof_boops_delete on public.boops for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_saves_read on public.saves;
drop policy if exists floof_saves_write on public.saves;
drop policy if exists floof_saves_delete on public.saves;
create policy floof_saves_read on public.saves for select to authenticated using (public.owns_pet(pet_id)); -- private
create policy floof_saves_write on public.saves for insert to authenticated with check (public.owns_pet(pet_id));
create policy floof_saves_delete on public.saves for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_follows_read on public.follows;
drop policy if exists floof_follows_write on public.follows;
drop policy if exists floof_follows_delete on public.follows;
create policy floof_follows_read on public.follows for select using (true);
create policy floof_follows_write on public.follows for insert to authenticated with check (public.owns_pet(follower_id));
create policy floof_follows_delete on public.follows for delete to authenticated using (public.owns_pet(follower_id));

-- Ledger: read your own rows only. Writes happen only through the functions above.
drop policy if exists floof_ledger_read on public.biscuit_ledger;
create policy floof_ledger_read on public.biscuit_ledger for select to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_messages_read on public.messages;
drop policy if exists floof_messages_write on public.messages;
create policy floof_messages_read on public.messages for select to authenticated using (public.owns_pet(from_pet) or public.owns_pet(to_pet));
create policy floof_messages_write on public.messages for insert to authenticated with check (public.owns_pet(from_pet) and from_pet <> to_pet);

drop policy if exists floof_rsvps_read on public.event_rsvps;
drop policy if exists floof_rsvps_insert on public.event_rsvps;
drop policy if exists floof_rsvps_update on public.event_rsvps;
drop policy if exists floof_rsvps_delete on public.event_rsvps;
create policy floof_rsvps_read on public.event_rsvps for select using (true);
create policy floof_rsvps_insert on public.event_rsvps for insert to authenticated with check (public.owns_pet(pet_id));
create policy floof_rsvps_update on public.event_rsvps for update to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));
create policy floof_rsvps_delete on public.event_rsvps for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_entries_read on public.competition_entries;
drop policy if exists floof_entries_write on public.competition_entries;
create policy floof_entries_read on public.competition_entries for select using (true);
create policy floof_entries_write on public.competition_entries for insert to authenticated
  with check (public.owns_pet(pet_id) and exists (select 1 from public.posts x where x.id = post_id and x.pet_id = competition_entries.pet_id));

drop policy if exists floof_votes_read on public.competition_votes;
drop policy if exists floof_votes_insert on public.competition_votes;
drop policy if exists floof_votes_update on public.competition_votes;
create policy floof_votes_read on public.competition_votes for select using (true);
create policy floof_votes_insert on public.competition_votes for insert to authenticated with check (public.owns_pet(voter_id));
create policy floof_votes_update on public.competition_votes for update to authenticated using (public.owns_pet(voter_id)) with check (public.owns_pet(voter_id));

drop policy if exists floof_packs_read on public.pack_members;
drop policy if exists floof_packs_write on public.pack_members;
drop policy if exists floof_packs_delete on public.pack_members;
create policy floof_packs_read on public.pack_members for select using (true);
create policy floof_packs_write on public.pack_members for insert to authenticated with check (public.owns_pet(pet_id));
create policy floof_packs_delete on public.pack_members for delete to authenticated using (public.owns_pet(pet_id));

-- Table access for the Data API (row level security above still decides which rows).
grant usage on schema public to anon, authenticated;
grant select on public.pets, public.posts, public.comments, public.boops, public.follows, public.event_rsvps,
  public.competition_entries, public.competition_votes, public.pack_members,
  public.pet_profiles, public.post_feed, public.clan_totals, public.competition_vote_counts,
  public.pet_biscuit_totals, public.post_biscuit_totals to anon, authenticated;
grant select on public.saves, public.biscuit_ledger, public.messages to authenticated;
grant insert, update, delete on public.pets, public.posts, public.event_rsvps, public.competition_votes to authenticated;
grant insert, delete on public.comments, public.boops, public.saves, public.follows, public.pack_members, public.competition_entries to authenticated;
grant insert on public.messages to authenticated;
grant execute on function public.owns_pet(text) to anon, authenticated;

-- Only expose the biscuit functions to signed-in users.
revoke all on function public.send_biscuits(text, text, int, text, text) from public, anon;
revoke all on function public.topup_biscuits(text, int) from public, anon;
revoke all on function public.redeem_biscuits(text, int, text) from public, anon;
revoke all on function public.wallet_balance(text) from public, anon;
grant execute on function public.send_biscuits(text, text, int, text, text) to authenticated;
grant execute on function public.topup_biscuits(text, int) to authenticated;
grant execute on function public.redeem_biscuits(text, int, text) to authenticated;
grant execute on function public.wallet_balance(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: public bucket, each user writes only inside their own folder.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists floof_media_insert on storage.objects;
drop policy if exists floof_media_update on storage.objects;
drop policy if exists floof_media_delete on storage.objects;
create policy floof_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy floof_media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy floof_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Live updates for direct messages.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;


-- ===========================================================================
-- Engagement features (added later)
-- ===========================================================================

-- Daily Floof votes: one vote per pet per day, for someone else's answer to that day's prompt.
create table if not exists public.daily_votes (
  day date not null,
  voter_id text not null references public.pets (id) on delete cascade,
  post_id text not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (day, voter_id)
);
create index if not exists daily_votes_post_idx on public.daily_votes (post_id);

-- Private pet-care reminders (vaccinations, flea treatment, vet check-ups...).
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  pet_id text not null references public.pets (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kind text not null default 'other',
  due_date date not null,
  repeat text not null default 'none' check (repeat in ('none', 'monthly', 'quarterly', 'yearly')),
  created_at timestamptz not null default now()
);
create index if not exists reminders_pet_idx on public.reminders (pet_id, due_date);

-- Private weight / growth log.
create table if not exists public.pet_weights (
  id uuid primary key default gen_random_uuid(),
  pet_id text not null references public.pets (id) on delete cascade,
  measured_on date not null default current_date,
  kg numeric(6, 2) not null check (kg > 0 and kg < 200),
  created_at timestamptz not null default now()
);
create index if not exists pet_weights_pet_idx on public.pet_weights (pet_id, measured_on);

-- Lost & found alerts, visible to everyone.
create table if not exists public.lost_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('lost', 'found')),
  reporter_id text not null references public.pets (id) on delete cascade,
  pet_id text references public.pets (id) on delete set null, -- the missing pet, when it's on Floof
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 600),
  suburb text not null default '',
  city text not null default '',
  last_seen text not null default '',
  photo_url text,
  status text not null default 'active' check (status in ('active', 'resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lost_alerts_status_idx on public.lost_alerts (status, created_at desc);

-- Phone/browser push subscriptions.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pet_id text references public.pets (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.daily_votes enable row level security;
alter table public.reminders enable row level security;
alter table public.pet_weights enable row level security;
alter table public.lost_alerts enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists floof_daily_votes_read on public.daily_votes;
drop policy if exists floof_daily_votes_insert on public.daily_votes;
drop policy if exists floof_daily_votes_update on public.daily_votes;
drop policy if exists floof_daily_votes_delete on public.daily_votes;
create policy floof_daily_votes_read on public.daily_votes for select using (true);
create policy floof_daily_votes_insert on public.daily_votes for insert to authenticated with check (
  public.owns_pet(voter_id)
  and exists (select 1 from public.posts x where x.id = post_id and x.daily_date = day and x.pet_id <> voter_id and x.status = 'approved')
);
create policy floof_daily_votes_update on public.daily_votes for update to authenticated using (public.owns_pet(voter_id)) with check (
  public.owns_pet(voter_id)
  and exists (select 1 from public.posts x where x.id = post_id and x.daily_date = day and x.pet_id <> voter_id and x.status = 'approved')
);
create policy floof_daily_votes_delete on public.daily_votes for delete to authenticated using (public.owns_pet(voter_id));

drop policy if exists floof_reminders_all on public.reminders;
create policy floof_reminders_all on public.reminders for all to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));

drop policy if exists floof_weights_all on public.pet_weights;
create policy floof_weights_all on public.pet_weights for all to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));

drop policy if exists floof_lost_read on public.lost_alerts;
drop policy if exists floof_lost_insert on public.lost_alerts;
drop policy if exists floof_lost_update on public.lost_alerts;
drop policy if exists floof_lost_delete on public.lost_alerts;
create policy floof_lost_read on public.lost_alerts for select using (true);
create policy floof_lost_insert on public.lost_alerts for insert to authenticated
  with check (public.owns_pet(reporter_id) and (pet_id is null or public.owns_pet(pet_id)) and status = 'active');
create policy floof_lost_update on public.lost_alerts for update to authenticated using (public.owns_pet(reporter_id)) with check (public.owns_pet(reporter_id));
create policy floof_lost_delete on public.lost_alerts for delete to authenticated using (public.owns_pet(reporter_id));

drop policy if exists floof_push_select on public.push_subscriptions;
drop policy if exists floof_push_insert on public.push_subscriptions;
drop policy if exists floof_push_update on public.push_subscriptions;
drop policy if exists floof_push_delete on public.push_subscriptions;
create policy floof_push_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy floof_push_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid() and (pet_id is null or public.owns_pet(pet_id)));
create policy floof_push_update on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and (pet_id is null or public.owns_pet(pet_id)));
create policy floof_push_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

grant select on public.daily_votes, public.lost_alerts to anon, authenticated;
grant insert, update, delete on public.daily_votes, public.lost_alerts to authenticated;
grant select, insert, update, delete on public.reminders, public.pet_weights, public.push_subscriptions to authenticated;

-- A warm welcome: when a new member posts their first floof, the Floof crew (Mochi) says hi.
create or replace function public.welcome_first_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.pets where id = new.pet_id and owner_id is not null)
     and exists (select 1 from public.pets where id = 'mochi' and owner_id is null)
     and (select count(*) from public.posts where pet_id = new.pet_id) = 1 then
    insert into public.boops (post_id, pet_id) values (new.id, 'mochi') on conflict do nothing;
    insert into public.comments (post_id, pet_id, text)
    values (new.id, 'mochi', 'Welcome to Floof from the Floof crew! 🐾 So happy you''re here.');
  end if;
  return new;
end;
$$;
drop trigger if exists posts_welcome_first on public.posts;
create trigger posts_welcome_first after insert on public.posts for each row execute function public.welcome_first_post();

-- Make the Data API pick up new columns and tables straight away.
notify pgrst, 'reload schema';
-- Floof starter content: house pets and sample floofs. Safe to re-run.
-- Generated by scripts/gen-seed.mts from lib/data.ts.

insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('bigmac', null, 'bigmac.golden', 'Big Mac', 'dog', 'Golden Retriever', '3 years old', 'Sydney', array['Professional snack inspector 🍔', 'Zoomies at 9pm sharp', 'Clan Dogs captain']::text[], '{"fur":"#E3B270","ear":"#CF9752","muzzle":"#F6D7A8","earStyle":"floppy"}'::jsonb, '/photos/pet-bigmac.jpg', '#FFE6CC', 'dogs', true, 18400, 289, 342, 8742)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('mochi', null, 'mochi.the.samoyed', 'Mochi', 'dog', 'Samoyed', '2 years old', 'Sydney', array['Small floof, big adventures', 'Snacks, walks, and making friends ♡']::text[], '{"fur":"#FFFBF4","ear":"#F6EADB","muzzle":"#FFFFFF","earStyle":"fluffy"}'::jsonb, '/photos/pet-mochi.jpg', '#FDE7EC', 'dogs', true, 52100, 412, 1288, 12930)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('luna', null, 'luna.the.cat', 'Luna', 'cat', 'Scottish Fold', '3 years old', 'Sydney', array['Certified menace 😼', 'Professional napper • Food enthusiast', 'World domination ♡']::text[], '{"fur":"#9EA3AA","ear":"#888D94","muzzle":"#E6E8EB","earStyle":"cat"}'::jsonb, '/photos/pet-luna.jpg', '#E7E3F7', 'cats', true, 28700, 301, 904, 11204)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('biscuit', null, 'biscuit.corgi', 'Biscuit', 'dog', 'Pembroke Corgi', '4 years old', 'Melbourne', array['Loaf mode: activated 🍞', 'Short legs, long walks']::text[], '{"fur":"#E9A15A","ear":"#DC8C42","muzzle":"#FFFFFF","earStyle":"pointy"}'::jsonb, '/photos/pet-biscuit.jpg', '#FFF1C9', 'dogs', false, 41300, 520, 2104, 10388)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('toby', null, 'toby.the.toller', 'Toby', 'dog', 'Duck Tolling Retriever', '5 years old', 'Sydney', array['Fetch is a lifestyle 🎾', 'Good boy, level 12']::text[], '{"fur":"#C9743E","ear":"#B5622F","muzzle":"#F2D2B2","earStyle":"floppy"}'::jsonb, '/photos/pet-toby.jpg', '#E2F0DA', 'dogs', false, 33800, 198, 1502, 9120)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('nala', null, 'nala.the.ragdoll', 'Nala', 'cat', 'Ragdoll', '2 years old', 'Brisbane', array['Blue eyes, soft paws', 'Will flop on command']::text[], '{"fur":"#FBF5EC","ear":"#7C6656","muzzle":"#FFFFFF","earStyle":"cat"}'::jsonb, '/photos/pet-nala.jpg', '#DDEBF7', 'cats', false, 22900, 150, 811, 7610)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('ollie', null, 'ollie.doodle', 'Ollie', 'dog', 'Chow Chow', '1 year old', 'Perth', array['Lion mane, golden heart 🦁', 'Never seen without my shades']::text[], '{"fur":"#D9A877","ear":"#C08B5B","muzzle":"#EBC79E","earStyle":"fluffy"}'::jsonb, '/photos/pet-ollie.jpg', '#F7E3D3', 'dogs', false, 12800, 344, 402, 5820)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('pepper', null, 'pepper.tux', 'Pepper', 'cat', 'Tuxedo', '6 years old', 'Sydney', array['Dressed for dinner. Always.', 'Knocks things off tables 🍽️']::text[], '{"fur":"#3E3A3A","ear":"#2E2A2A","muzzle":"#FFFFFF","earStyle":"cat"}'::jsonb, '/photos/pet-pepper.jpg', '#EDE6DD', 'cats', false, 9700, 88, 377, 6044)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('peanut', null, 'peanut.hamster', 'Peanut', 'hamster', 'Syrian Hamster', '8 months', 'Adelaide', array['Cheeks: full', 'Wheel PB: 4.2km']::text[], '{"fur":"#EDBF8A","ear":"#E5A97A","muzzle":"#FFF6EA","earStyle":"round"}'::jsonb, '/photos/pet-peanut.jpg', '#FFF0DA', 'cats', false, 6100, 75, 129, 3402)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('clover', null, 'clover.bun', 'Clover', 'bunny', 'Holland Lop', '1 year old', 'Canberra', array['Binky champion 🐇', 'Carrot critic']::text[], '{"fur":"#F4ECE2","ear":"#E0CBB6","muzzle":"#FFFFFF","earStyle":"bunny"}'::jsonb, '/photos/pet-clover.jpg', '#E6F3E2', 'dogs', false, 8800, 120, 260, 4390)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('miso', null, 'miso.ginger', 'Miso', 'cat', 'Ginger Tabby', '4 years old', 'Gold Coast', array['Orange cat energy, one shared brain cell', 'Sunbeam collector ☀️']::text[], '{"fur":"#F0A55E","ear":"#E08F45","muzzle":"#FFF4E6","stripes":"#C9752F","earStyle":"cat"}'::jsonb, '/photos/pet-miso.jpg', '#FFE3CF', 'cats', false, 15600, 210, 690, 6880)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;
insert into public.pets (id, owner_id, handle, name, species, breed, age, city, bio, look, photo_url, bg, clan, verified, followers_base, following_base, biscuits_base, paw_score_base)
values ('rex', null, 'rex.frenchie', 'Rex', 'dog', 'French Bulldog', '2 years old', 'Sydney', array['Snores in surround sound', 'Bat ears, big heart']::text[], '{"fur":"#9C8E83","ear":"#857669","muzzle":"#D8CFC6","earStyle":"pointy"}'::jsonb, '/photos/pet-rex.jpg', '#E3E8EE', 'dogs', false, 11200, 260, 318, 5130)
on conflict (id) do update set handle = excluded.handle, breed = excluded.breed, look = excluded.look, bio = excluded.bio, photo_url = excluded.photo_url,
  followers_base = excluded.followers_base, biscuits_base = excluded.biscuits_base, paw_score_base = excluded.paw_score_base
  where public.pets.owner_id is null;

insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p1', 'mochi', 'salon', 'bow', 'happy', '/photos/post-p1.jpg', array['/photos/post-p1.jpg', '/photos/post-p1-2.jpg']::text[], 'first haircut ♡', 'First haircut! ✂️🎀 Looking fresh for the weekend 😎', array['firstmoment', 'samoyed', 'glowup']::text[], 'Sydney, Australia', 'first-haircut', null, 12400, 180, 0, now() - interval '2 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '64f766f2-91ac-4975-bd84-d62f698fce5d'::uuid, 'p1', 'luna', 'So cute!! I would never let them do this to me', 14, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'luna' and text = 'So cute!! I would never let them do this to me');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'bc3b89fc-efff-4296-81af-ea18b9d2768f'::uuid, 'p1', 'ollie', 'Happiness in a photo 🥹', 8, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'ollie' and text = 'Happiness in a photo 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3963a832-bff6-4ecd-ba89-55c46e83a240'::uuid, 'p1', 'biscuit', 'Hair goals tbh', 5, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'biscuit' and text = 'Hair goals tbh');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p2', 'biscuit', 'expo', 'bandana', 'happy', '/photos/post-p2.jpg', array['/photos/post-p2.jpg', '/photos/post-p2-2.jpg', '/photos/post-p2-3.jpg']::text[], null, 'First time at the Pet Expo! Made a new bestie 😍', array['PetExpo', 'GoodBoy', 'FloofLife']::text[], 'Sydney Showground', 'first-expo', null, 28700, 420, 0, now() - interval '5 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5c6d78dc-1e22-4a72-8250-f64b79e3df50'::uuid, 'p2', 'toby', 'Was that you at the treat stand?? 👀', 22, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'toby' and text = 'Was that you at the treat stand?? 👀');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a600225d-0aba-4239-b9e6-2cf057fe78f4'::uuid, 'p2', 'mochi', 'See you next year bestie!', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'See you next year bestie!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e583a093-fd54-4e47-9d5c-97214bf16cdd'::uuid, 'p2', 'luna', 'Iconic.', 27, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'luna' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd03024bd-4610-4b13-801d-266be78592e5'::uuid, 'p2', 'peanut', 'Boop boop boop 🐾', 34, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '59f4b246-9ff5-432f-b2df-54b376b84236'::uuid, 'p2', 'mochi', 'Can we be friends?', 1, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p3', 'toby', 'beach', 'none', 'happy', '/photos/post-p3.jpg', array['/photos/post-p3.jpg', '/photos/post-p3-2.jpg']::text[], 'first time at the beach!', 'First swim of the season! 🌊 Wouldn''t have it any other way 💙', array['firstmoment', 'beachday', 'goodboy']::text[], 'Bondi Beach', 'first-beach', null, 1200, 12, 0, now() - interval '7 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c2ff62f9-3619-4ef9-b23c-dbd73e28c8c4'::uuid, 'p3', 'rex', 'I''ll stick to the sand thanks', 3, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'I''ll stick to the sand thanks');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5869e84b-bdd6-4729-b8a0-c14abad2ffed'::uuid, 'p3', 'bigmac', 'Need this energy today', 33, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6e67e9a6-f1c8-4caf-b5d8-f39ded66bfea'::uuid, 'p3', 'ollie', 'So cute!! 😍', 0, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'ollie' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '301d8d0f-8d03-48ff-8b29-5304ef4c767c'::uuid, 'p3', 'rex', 'Iconic.', 7, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4e33aee4-e32f-4752-a74f-d1f14a7f9d45'::uuid, 'p3', 'nala', 'Boop boop boop 🐾', 14, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7e21f86b-4721-4859-8771-e7a447df0fed'::uuid, 'p3', 'miso', 'Can we be friends?', 21, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c6dbee6d-df4e-416c-8874-0e28d9f80005'::uuid, 'p3', 'biscuit', 'Absolute floof goals', 28, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'biscuit' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p4', 'luna', 'night', 'none', 'sleepy', '/photos/post-p4.jpg', array['/photos/post-p4.jpg']::text[], null, 'Do not disturb. Ever. 😎', array['catnap', 'sleepy']::text[], 'Sydney, Australia', null, null, 9800, 96, 0, now() - interval '9 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8f9eefcc-26dd-4cbf-85b7-bfd873c67761'::uuid, 'p4', 'pepper', 'Respect.', 30, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'pepper' and text = 'Respect.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7966c294-c07e-4cf5-872a-7e38c124bdc4'::uuid, 'p4', 'toby', 'The cutest thing on Floof today', 6, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3cc959e6-a409-40ee-9899-bf840ef2b953'::uuid, 'p4', 'clover', 'Need this energy today', 13, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8b2488a1-e09d-470e-847e-32cd846f0f33'::uuid, 'p4', 'biscuit', 'So cute!! 😍', 20, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p5', 'mochi', 'blossom', 'flowers', 'happy', '/photos/post-p5.jpg', array['/photos/post-p5.jpg']::text[], 'good day!!', 'Park zoomies 🌸 More walks, more sniffing, more happiness ♡', array['flooflife', 'samoyed', 'happydog', 'sunnyday']::text[], 'Royal Botanic Garden', null, null, 15200, 230, 0, now() - interval '12 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7931886e-76d7-47d3-bae5-33dfb95276e7'::uuid, 'p5', 'nala', 'Prettiest floof in the garden', 11, now() - interval '12 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Prettiest floof in the garden');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e12b7452-689c-4771-bee9-7688794aa5cc'::uuid, 'p5', 'pepper', 'Look at that face 🥹', 19, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'pepper' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '633cbde2-382a-42ef-87a4-e3bf40bd5d32'::uuid, 'p5', 'bigmac', 'The cutest thing on Floof today', 26, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'bigmac' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '53333ee2-51d3-4eb9-b6bf-c791955f5c71'::uuid, 'p5', 'ollie', 'Need this energy today', 33, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'ollie' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a84319c6-d0b4-4e8a-81cf-de2ac863854c'::uuid, 'p5', 'rex', 'So cute!! 😍', 0, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'rex' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8839abc5-94ce-424c-bc40-2da4ad728658'::uuid, 'p5', 'nala', 'Iconic.', 7, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Iconic.');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p6', 'miso', 'cozy', 'none', 'smile', '/photos/post-p6.jpg', array['/photos/post-p6.jpg']::text[], null, 'Found the one warm patch in the house ☀️', array['orangecat', 'sunbeam']::text[], 'Gold Coast', null, null, 6400, 44, 0, now() - interval '14 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ac7411cc-034b-4ad9-a5cf-ac5f92c988c3'::uuid, 'p6', 'toby', 'This made my day ♡', 25, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'toby' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '24836f5c-1e05-4f3a-adf9-249a210e4c7d'::uuid, 'p6', 'clover', 'My human would steal you instantly', 32, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '02c53dff-e1c9-47af-89c1-c82b033e74fb'::uuid, 'p6', 'biscuit', 'Look at that face 🥹', 39, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'biscuit' and text = 'Look at that face 🥹');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p7', 'bigmac', 'park', 'bandana', 'happy', '/photos/post-p7.jpg', array['/photos/post-p7.jpg']::text[], null, 'Park zoomies with my bestie Mochi 🐾', array['zoomies', 'shiba', 'bestfriends']::text[], 'Centennial Park', 'first-park', null, 4200, 61, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1ec16bee-d760-43fc-832e-6a8e5b67cf27'::uuid, 'p7', 'mochi', 'Best day ever!!', 19, now() - interval '1 days'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Best day ever!!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '80a3c47e-6e80-4ae6-8e13-221f648c8c9c'::uuid, 'p7', 'luna', 'This made my day ♡', 5, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'luna' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f1969f5a-b52c-4042-8139-ecd2e05399da'::uuid, 'p7', 'pepper', 'My human would steal you instantly', 12, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'pepper' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'df6b629d-d124-48c8-b43e-748b58d125ab'::uuid, 'p7', 'mochi', 'Look at that face 🥹', 19, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6ff18789-6bb2-4681-92af-a752a8d31105'::uuid, 'p7', 'ollie', 'The cutest thing on Floof today', 26, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'ollie' and text = 'The cutest thing on Floof today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p8', 'nala', 'blossom', 'flowers', 'smile', '/photos/post-p8.jpg', array['/photos/post-p8.jpg']::text[], null, 'Spring princess reporting for duty 🌼', array['ragdoll', 'spring']::text[], 'Brisbane', null, null, 7300, 81, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8195fc5d-16a0-4dc0-9aa4-0bac4f18d24f'::uuid, 'p8', 'rex', '10/10 would boop again', 11, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'rex' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ff52e35b-e54f-4ded-9f42-3d4ba7161aa9'::uuid, 'p8', 'toby', 'Sending biscuits your way 🍪', 18, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'toby' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5d04666a-6e0f-432d-8a4b-a403531a5fb9'::uuid, 'p8', 'miso', 'This made my day ♡', 25, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'miso' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '24386636-602a-4eb8-9e08-04cc2c8d516b'::uuid, 'p8', 'biscuit', 'My human would steal you instantly', 32, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'biscuit' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c79f92fb-aabd-49cf-98ca-ef61e43c06b4'::uuid, 'p8', 'clover', 'Look at that face 🥹', 39, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'clover' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '024fddfe-4946-4fac-80e0-441064dbcece'::uuid, 'p8', 'luna', 'The cutest thing on Floof today', 6, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'luna' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c73332bd-7644-4733-b47c-bb1cb1645891'::uuid, 'p8', 'peanut', 'Need this energy today', 13, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'peanut' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p9', 'peanut', 'cozy', 'party', 'smile', '/photos/post-p9.jpg', array['/photos/post-p9.jpg']::text[], '8 months old!', 'Celebrated with a sunflower seed cake 🎉', array['hamster', 'birthday']::text[], null, 'first-birthday', null, 2100, 33, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '76a7822c-1b12-4053-b69f-6ec85cf5156c'::uuid, 'p9', 'luna', 'Absolute floof goals', 24, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'luna' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1fb59326-16d1-4be5-bb89-afb1b6eb9d09'::uuid, 'p9', 'pepper', '10/10 would boop again', 31, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'pepper' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4bb7b0b5-e090-448f-ba78-8416902ce749'::uuid, 'p9', 'mochi', 'Sending biscuits your way 🍪', 38, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'mochi' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '15e79f37-74e8-4480-9ac0-9f30844c4ece'::uuid, 'p9', 'ollie', 'This made my day ♡', 5, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'ollie' and text = 'This made my day ♡');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p10', 'ollie', 'vet', 'bandana', 'smile', '/photos/post-p10.jpg', array['/photos/post-p10.jpg']::text[], 'brave boy', 'First vet visit — wore my disguise 😎🩺', array['firstmoment', 'chowchow']::text[], 'Perth', 'first-vet', null, 3100, 27, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1614014c-8c08-42c3-ac04-064d7c76aab0'::uuid, 'p10', 'nala', 'Can we be friends?', 37, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'nala' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '077f6013-54cb-47aa-81fc-3f863182d690'::uuid, 'p10', 'rex', 'Absolute floof goals', 4, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'rex' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd1b29cf1-368c-4818-b550-adea8d22d5bc'::uuid, 'p10', 'toby', '10/10 would boop again', 11, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'toby' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '95cfe1ab-5306-4d90-a050-a7d53dfa1196'::uuid, 'p10', 'miso', 'Sending biscuits your way 🍪', 18, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'miso' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '0da212d2-8858-4e55-bb7f-7727623cdc9b'::uuid, 'p10', 'biscuit', 'This made my day ♡', 25, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'biscuit' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7c17fd9d-6e4d-430a-bed1-21fd811d7531'::uuid, 'p10', 'clover', 'My human would steal you instantly', 32, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p11', 'clover', 'park', 'flowers', 'smile', '/photos/post-p11.jpg', array['/photos/post-p11.jpg']::text[], null, 'Binkies in the clover patch 🍀', array['bunny', 'binky']::text[], null, null, null, 5100, 52, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b49313b3-e213-433b-9314-4a99c204b388'::uuid, 'p11', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '35f87477-c1ca-48ad-a34f-b591cc36f7fe'::uuid, 'p11', 'luna', 'Can we be friends?', 17, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4a825109-0e85-4d5a-aba8-9e561269d210'::uuid, 'p11', 'pepper', 'Absolute floof goals', 24, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'pepper' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p12', 'rex', 'sunset', 'sunglasses', 'happy', '/photos/post-p12.jpg', array['/photos/post-p12.jpg']::text[], null, 'New hoodie, who dis 😎', array['frenchie', 'ootd']::text[], null, null, null, 20400, 140, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1484adce-ee65-43ab-9de5-af7557a7768b'::uuid, 'p12', 'bigmac', 'Iconic.', 23, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'bigmac' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '374fc1e9-dcb4-4d01-9d66-3646a95e438e'::uuid, 'p12', 'nala', 'Boop boop boop 🐾', 30, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '886ae48f-b1e9-470a-bd8c-3a909bc89493'::uuid, 'p12', 'miso', 'Can we be friends?', 37, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b07444ee-0b5f-437c-bcd4-bf3002b7820c'::uuid, 'p12', 'toby', 'Absolute floof goals', 4, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'toby' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c338b83c-c9ca-4672-9976-853732c9567f'::uuid, 'p12', 'clover', '10/10 would boop again', 11, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'clover' and text = '10/10 would boop again');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p13', 'pepper', 'party', 'crown', 'wink', '/photos/post-p13.jpg', array['/photos/post-p13.jpg']::text[], null, 'Gotcha Day #6. Exhausted from ruling this house 👑', array['tuxedocat', 'gotchaday']::text[], null, 'gotcha-day', null, 4800, 70, 0, now() - interval '3 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '222cc1db-7ab0-4a5c-be23-8743ab57a2f4'::uuid, 'p13', 'biscuit', 'So cute!! 😍', 36, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '751154dc-5c2c-4da4-bf59-50ee36e75b5e'::uuid, 'p13', 'clover', 'Iconic.', 3, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'clover' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b45eb9ba-23ba-4d66-8eb4-a7547b84b65e'::uuid, 'p13', 'luna', 'Boop boop boop 🐾', 10, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'luna' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '14963cc0-e2d3-4813-9e71-ce6a1cbdb06c'::uuid, 'p13', 'peanut', 'Can we be friends?', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'peanut' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '93dfc4df-d8e5-42de-a89c-ed94424a49d9'::uuid, 'p13', 'mochi', 'Absolute floof goals', 24, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'mochi' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'dc7171e9-4110-4758-981b-b91118422490'::uuid, 'p13', 'ollie', '10/10 would boop again', 31, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'ollie' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '52479545-b9d0-485b-8a94-d8c99a0e81a4'::uuid, 'p13', 'bigmac', 'Sending biscuits your way 🍪', 38, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'bigmac' and text = 'Sending biscuits your way 🍪');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p14', 'bigmac', 'expo', 'hat', 'happy', '/photos/post-p14.jpg', array['/photos/post-p14.jpg', '/photos/post-p14-2.jpg', '/photos/post-p14-3.jpg']::text[], null, 'Brought a flower to the Pet Expo 🌷 Treat stand: located.', array['PetExpo', 'goldenretriever']::text[], 'Sydney Showground', 'first-expo', null, 3900, 48, 0, now() - interval '4 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c1caf3ca-fcf1-4ad3-b404-f8a7dfc5beac'::uuid, 'p14', 'pepper', 'Need this energy today', 9, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'pepper' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '56696e77-0231-4d44-b637-d336afa1a8b0'::uuid, 'p14', 'mochi', 'So cute!! 😍', 16, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'mochi' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '57ad4bae-22b9-4444-99c1-826898b0906b'::uuid, 'p14', 'ollie', 'Iconic.', 23, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'ollie' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b366df02-82bd-4833-9a6a-24c040842109'::uuid, 'p14', 'rex', 'Boop boop boop 🐾', 30, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'rex' and text = 'Boop boop boop 🐾');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p15', 'mochi', 'park', 'duck', 'happy', '/photos/post-p15.jpg', array['/photos/post-p15.jpg']::text[], null, 'Puppy throwback 🥹 Look how tiny I was', array['throwback', 'puppy']::text[], null, null, null, 18000, 260, 0, now() - interval '5 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6b2fb370-ca74-4428-b5e1-901975998660'::uuid, 'p15', 'miso', 'The cutest thing on Floof today', 22, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'miso' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f49fcd93-ab40-4776-b8e7-a7345ef27597'::uuid, 'p15', 'toby', 'Need this energy today', 29, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'toby' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '54c72433-88b7-40f9-976b-d67b48ab04ba'::uuid, 'p15', 'clover', 'So cute!! 😍', 36, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'clover' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '25153666-cdb8-4f8f-966d-8e30b245259e'::uuid, 'p15', 'biscuit', 'Iconic.', 3, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'biscuit' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd75fa622-e3a7-412f-91dc-933d2f0559c2'::uuid, 'p15', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6dca4c9b-537a-4f68-a8f4-29bf5fe2321a'::uuid, 'p15', 'luna', 'Can we be friends?', 17, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p16', 'luna', 'blossom', 'none', 'smile', '/photos/post-p16.jpg', array['/photos/post-p16.jpg']::text[], null, 'Watching the birds. Planning. 🐦', array['catsofinstagram', 'windowcat']::text[], null, null, null, 11000, 120, 0, now() - interval '6 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b72effca-274a-48a1-9519-e2311778b480'::uuid, 'p16', 'mochi', 'Look at that face 🥹', 35, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5220d28d-473a-468d-8eb2-79ebad17f964'::uuid, 'p16', 'pepper', 'The cutest thing on Floof today', 2, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'pepper' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd454995a-2ff8-4a85-802b-9366e3808238'::uuid, 'p16', 'bigmac', 'Need this energy today', 9, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p17', 'bigmac', 'snow', 'bandana', 'happy', '/photos/post-p17.jpg', array['/photos/post-p17.jpg']::text[], null, 'Gotcha Day throwback! The day I came home 🏡', array['gotchaday', 'goldenretriever']::text[], null, 'gotcha-day', null, 5200, 73, 0, now() - interval '2 weeks')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '732b95f7-eefc-438d-820f-296e50a836ce'::uuid, 'p17', 'nala', 'My human would steal you instantly', 8, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'nala' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b983b013-995a-4b25-8823-5b09d280fe0d'::uuid, 'p17', 'miso', 'Look at that face 🥹', 15, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'miso' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '236fa43a-c481-4887-a05e-9a378973d5c9'::uuid, 'p17', 'toby', 'The cutest thing on Floof today', 22, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd210ba65-4160-49ec-aa99-6ae2c9498220'::uuid, 'p17', 'clover', 'Need this energy today', 29, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '619e5e94-9897-4ab3-8591-8d4597b333f5'::uuid, 'p17', 'biscuit', 'So cute!! 😍', 36, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'biscuit' and text = 'So cute!! 😍');

-- House pets follow their friends (from AFFINITY).
insert into public.follows (follower_id, followee_id) values ('bigmac', 'mochi') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('bigmac', 'biscuit') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('bigmac', 'luna') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('bigmac', 'toby') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('bigmac', 'rex') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('mochi', 'bigmac') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('mochi', 'luna') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('mochi', 'nala') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('luna', 'mochi') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('luna', 'pepper') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('luna', 'nala') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('biscuit', 'toby') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('biscuit', 'bigmac') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('toby', 'biscuit') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('toby', 'ollie') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('nala', 'luna') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('nala', 'miso') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('ollie', 'toby') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('ollie', 'clover') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('pepper', 'luna') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('peanut', 'clover') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('clover', 'peanut') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('miso', 'nala') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('miso', 'pepper') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('rex', 'bigmac') on conflict do nothing;
insert into public.follows (follower_id, followee_id) values ('rex', 'toby') on conflict do nothing;
