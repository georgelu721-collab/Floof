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
select '841d1f36-4102-47a1-8c66-2ef7879e3ee4'::uuid, 'p1', 'luna', 'So cute!! I would never let them do this to me', 14, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'luna' and text = 'So cute!! I would never let them do this to me');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '902446c9-82f2-4556-a7c4-36eb29fcefe3'::uuid, 'p1', 'ollie', 'Happiness in a photo 🥹', 8, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'ollie' and text = 'Happiness in a photo 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3c41d1d9-a74d-49b2-9e80-d96e06640af7'::uuid, 'p1', 'biscuit', 'Hair goals tbh', 5, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'biscuit' and text = 'Hair goals tbh');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p2', 'biscuit', 'expo', 'bandana', 'happy', '/photos/post-p2.jpg', array['/photos/post-p2.jpg', '/photos/post-p2-2.jpg', '/photos/post-p2-3.jpg']::text[], null, 'First time at the Pet Expo! Made a new bestie 😍', array['PetExpo', 'GoodBoy', 'FloofLife']::text[], 'Sydney Showground', 'first-expo', null, 28700, 420, 0, now() - interval '5 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'db15eff8-6a54-42ef-a8d7-0ed668a4f95b'::uuid, 'p2', 'toby', 'Was that you at the treat stand?? 👀', 22, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'toby' and text = 'Was that you at the treat stand?? 👀');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8be3933e-def8-4317-9cd0-39df302c198c'::uuid, 'p2', 'mochi', 'See you next year bestie!', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'See you next year bestie!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b5093560-6f3f-40ec-960c-f9b99299e9f9'::uuid, 'p2', 'luna', 'Iconic.', 27, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'luna' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b82d7275-083b-4fa9-8080-7313b7f88ea4'::uuid, 'p2', 'peanut', 'Boop boop boop 🐾', 34, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '36b5d378-c7fe-4f4e-b8d1-7559fd63f10f'::uuid, 'p2', 'mochi', 'Can we be friends?', 1, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p3', 'toby', 'beach', 'none', 'happy', '/photos/post-p3.jpg', array['/photos/post-p3.jpg', '/photos/post-p3-2.jpg']::text[], 'first time at the beach!', 'First swim of the season! 🌊 Wouldn''t have it any other way 💙', array['firstmoment', 'beachday', 'goodboy']::text[], 'Bondi Beach', 'first-beach', null, 1200, 12, 0, now() - interval '7 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'baa18f57-e095-4dec-8bb2-456a2297dc6e'::uuid, 'p3', 'rex', 'I''ll stick to the sand thanks', 3, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'I''ll stick to the sand thanks');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '723a3333-8701-4e43-b006-7d42b239869f'::uuid, 'p3', 'bigmac', 'Need this energy today', 33, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2b15346f-d265-4505-9f78-6b59e37fffd2'::uuid, 'p3', 'ollie', 'So cute!! 😍', 0, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'ollie' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c280c5e8-7516-41f8-9f3e-6d56f516dc5a'::uuid, 'p3', 'rex', 'Iconic.', 7, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8b557d10-1c7d-4ca4-957b-a945817835fb'::uuid, 'p3', 'nala', 'Boop boop boop 🐾', 14, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8b379ebe-1da3-429c-955f-3b27f6a896c6'::uuid, 'p3', 'miso', 'Can we be friends?', 21, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'dd04320d-ba53-4b1c-93e5-2bc605e433e7'::uuid, 'p3', 'biscuit', 'Absolute floof goals', 28, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'biscuit' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p4', 'luna', 'night', 'none', 'sleepy', '/photos/post-p4.jpg', array['/photos/post-p4.jpg']::text[], null, 'Do not disturb. Ever. 😎', array['catnap', 'sleepy']::text[], 'Sydney, Australia', null, null, 9800, 96, 0, now() - interval '9 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e6b6db08-6d91-4948-b23e-910a98791501'::uuid, 'p4', 'pepper', 'Respect.', 30, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'pepper' and text = 'Respect.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e8fddd7f-8b8b-4d1c-8449-5f7b511b61a9'::uuid, 'p4', 'toby', 'The cutest thing on Floof today', 6, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f5d25484-b733-44b6-87bf-01998698cceb'::uuid, 'p4', 'clover', 'Need this energy today', 13, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'aa570bba-1b3a-44a7-b7cd-9b73cd5ca091'::uuid, 'p4', 'biscuit', 'So cute!! 😍', 20, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p5', 'mochi', 'blossom', 'flowers', 'happy', '/photos/post-p5.jpg', array['/photos/post-p5.jpg']::text[], 'good day!!', 'Park zoomies 🌸 More walks, more sniffing, more happiness ♡', array['flooflife', 'samoyed', 'happydog', 'sunnyday']::text[], 'Royal Botanic Garden', null, null, 15200, 230, 0, now() - interval '12 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f963efb3-19af-46e2-a8f6-71a9347d994e'::uuid, 'p5', 'nala', 'Prettiest floof in the garden', 11, now() - interval '12 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Prettiest floof in the garden');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e087e8fc-ca8b-4836-8d78-9b2142efd0e7'::uuid, 'p5', 'pepper', 'Look at that face 🥹', 19, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'pepper' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8f560b1d-0226-4632-bca7-fec3f83c8dca'::uuid, 'p5', 'bigmac', 'The cutest thing on Floof today', 26, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'bigmac' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '230048e9-8d2c-487b-9c3f-0d867745bc40'::uuid, 'p5', 'ollie', 'Need this energy today', 33, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'ollie' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '84aa8959-09e0-4727-a9a4-b253706d2c95'::uuid, 'p5', 'rex', 'So cute!! 😍', 0, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'rex' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1b0bae27-1612-4355-867f-1715771fe8aa'::uuid, 'p5', 'nala', 'Iconic.', 7, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Iconic.');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p6', 'miso', 'cozy', 'none', 'smile', '/photos/post-p6.jpg', array['/photos/post-p6.jpg']::text[], null, 'Found the one warm patch in the house ☀️', array['orangecat', 'sunbeam']::text[], 'Gold Coast', null, null, 6400, 44, 0, now() - interval '14 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '418e4358-b2b4-4794-aba0-f1d137cfb5c7'::uuid, 'p6', 'toby', 'This made my day ♡', 25, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'toby' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9f3a446d-9eec-4296-911b-13b222f4ae75'::uuid, 'p6', 'clover', 'My human would steal you instantly', 32, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2aeb988d-8952-4663-b7e7-7396858f5aa1'::uuid, 'p6', 'biscuit', 'Look at that face 🥹', 39, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'biscuit' and text = 'Look at that face 🥹');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p7', 'bigmac', 'park', 'bandana', 'happy', '/photos/post-p7.jpg', array['/photos/post-p7.jpg']::text[], null, 'Park zoomies with my bestie Mochi 🐾', array['zoomies', 'shiba', 'bestfriends']::text[], 'Centennial Park', 'first-park', null, 4200, 61, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6ea6af9e-b40c-4f64-9525-fe3c9e692a90'::uuid, 'p7', 'mochi', 'Best day ever!!', 19, now() - interval '1 days'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Best day ever!!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5178345e-5e1c-4fa8-9d9d-1938b0996c71'::uuid, 'p7', 'luna', 'This made my day ♡', 5, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'luna' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c6fb6da1-7de9-4e5e-9e13-e267c2a4f3bf'::uuid, 'p7', 'pepper', 'My human would steal you instantly', 12, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'pepper' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c8d005f1-c5e9-483a-8f06-82371373a706'::uuid, 'p7', 'mochi', 'Look at that face 🥹', 19, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '459c881c-901b-44c8-a355-cc750eb18725'::uuid, 'p7', 'ollie', 'The cutest thing on Floof today', 26, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'ollie' and text = 'The cutest thing on Floof today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p8', 'nala', 'blossom', 'flowers', 'smile', '/photos/post-p8.jpg', array['/photos/post-p8.jpg']::text[], null, 'Spring princess reporting for duty 🌼', array['ragdoll', 'spring']::text[], 'Brisbane', null, null, 7300, 81, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4cbf589c-25f7-4220-a7bc-62283d650c54'::uuid, 'p8', 'rex', '10/10 would boop again', 11, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'rex' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a5d8111d-3174-4af3-9cf5-ca3af988746f'::uuid, 'p8', 'toby', 'Sending biscuits your way 🍪', 18, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'toby' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5c7b79c1-cc44-4457-a9bf-b1d5b8b3359d'::uuid, 'p8', 'miso', 'This made my day ♡', 25, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'miso' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c9745028-02c5-40a2-a8c2-d02c2c32897d'::uuid, 'p8', 'biscuit', 'My human would steal you instantly', 32, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'biscuit' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '15e4ba06-e71e-4c44-9b98-2a5a0d578341'::uuid, 'p8', 'clover', 'Look at that face 🥹', 39, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'clover' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4a6e7bf3-86de-491a-995c-bb0cb406f477'::uuid, 'p8', 'luna', 'The cutest thing on Floof today', 6, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'luna' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b21b3a72-c4bf-4d6b-a060-efd2361ce0e3'::uuid, 'p8', 'peanut', 'Need this energy today', 13, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'peanut' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p9', 'peanut', 'cozy', 'party', 'smile', '/photos/post-p9.jpg', array['/photos/post-p9.jpg']::text[], '8 months old!', 'Celebrated with a sunflower seed cake 🎉', array['hamster', 'birthday']::text[], null, 'first-birthday', null, 2100, 33, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '63fa92da-b69d-484b-bfc7-e18650f69def'::uuid, 'p9', 'luna', 'Absolute floof goals', 24, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'luna' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '05cdfd6e-b18f-4ac0-ad02-8b2ae4d24775'::uuid, 'p9', 'pepper', '10/10 would boop again', 31, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'pepper' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a71e79c7-bcfd-4bed-bdf9-902277624988'::uuid, 'p9', 'mochi', 'Sending biscuits your way 🍪', 38, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'mochi' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c7100d3f-f880-4a24-b6b3-5b3de6cae758'::uuid, 'p9', 'ollie', 'This made my day ♡', 5, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'ollie' and text = 'This made my day ♡');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p10', 'ollie', 'vet', 'bandana', 'smile', '/photos/post-p10.jpg', array['/photos/post-p10.jpg']::text[], 'brave boy', 'First vet visit — wore my disguise 😎🩺', array['firstmoment', 'chowchow']::text[], 'Perth', 'first-vet', null, 3100, 27, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '96aa5dfc-21c2-4738-9af7-cf1a1a8c06d1'::uuid, 'p10', 'nala', 'Can we be friends?', 37, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'nala' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b38a82cb-36d8-4377-b0b8-6eaf667c76f0'::uuid, 'p10', 'rex', 'Absolute floof goals', 4, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'rex' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c155777d-91a6-4387-af0e-18542b878462'::uuid, 'p10', 'toby', '10/10 would boop again', 11, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'toby' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4258444d-7d02-40b2-b6b4-58af823a6e5f'::uuid, 'p10', 'miso', 'Sending biscuits your way 🍪', 18, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'miso' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '887258e7-7690-458c-aa3d-160c19c1fa69'::uuid, 'p10', 'biscuit', 'This made my day ♡', 25, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'biscuit' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'fec1ea74-f33d-4249-9a96-ba38a9defbe5'::uuid, 'p10', 'clover', 'My human would steal you instantly', 32, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p11', 'clover', 'park', 'flowers', 'smile', '/photos/post-p11.jpg', array['/photos/post-p11.jpg']::text[], null, 'Binkies in the clover patch 🍀', array['bunny', 'binky']::text[], null, null, null, 5100, 52, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'adf45a24-d9a5-478c-b761-783a6a8d4043'::uuid, 'p11', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f5b5d2c0-5be8-4819-91b3-a063d224fd1a'::uuid, 'p11', 'luna', 'Can we be friends?', 17, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1fe253ab-e387-44d2-8ef3-26b9431629b9'::uuid, 'p11', 'pepper', 'Absolute floof goals', 24, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'pepper' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p12', 'rex', 'sunset', 'sunglasses', 'happy', '/photos/post-p12.jpg', array['/photos/post-p12.jpg']::text[], null, 'New hoodie, who dis 😎', array['frenchie', 'ootd']::text[], null, null, null, 20400, 140, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3bb85767-acf8-4947-bb96-571cbb852d90'::uuid, 'p12', 'bigmac', 'Iconic.', 23, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'bigmac' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '739cdb19-75de-4a3a-b4e5-104a7a9a2f08'::uuid, 'p12', 'nala', 'Boop boop boop 🐾', 30, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '02f90dfa-9362-4a70-b8c1-b253fb3b63dc'::uuid, 'p12', 'miso', 'Can we be friends?', 37, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '53dc908e-e446-4be7-9b49-d0587023c859'::uuid, 'p12', 'toby', 'Absolute floof goals', 4, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'toby' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '96af6edc-8af1-43fe-a89d-5247f3e22938'::uuid, 'p12', 'clover', '10/10 would boop again', 11, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'clover' and text = '10/10 would boop again');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p13', 'pepper', 'party', 'crown', 'wink', '/photos/post-p13.jpg', array['/photos/post-p13.jpg']::text[], null, 'Gotcha Day #6. Exhausted from ruling this house 👑', array['tuxedocat', 'gotchaday']::text[], null, 'gotcha-day', null, 4800, 70, 0, now() - interval '3 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '09916096-e268-4521-a76c-9233321750e3'::uuid, 'p13', 'biscuit', 'So cute!! 😍', 36, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '45ed196e-06ce-42f4-a782-1191ce452096'::uuid, 'p13', 'clover', 'Iconic.', 3, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'clover' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e5c4585c-8d50-40ac-bef2-59360804f6a3'::uuid, 'p13', 'luna', 'Boop boop boop 🐾', 10, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'luna' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ae16213c-28c8-4388-bb1a-77e313a20293'::uuid, 'p13', 'peanut', 'Can we be friends?', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'peanut' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3dd9beb2-ba07-4563-9f60-95dae0314112'::uuid, 'p13', 'mochi', 'Absolute floof goals', 24, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'mochi' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f40fb852-5c0f-4226-b472-358f776a8b57'::uuid, 'p13', 'ollie', '10/10 would boop again', 31, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'ollie' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4a7a16cc-5153-4728-86cb-dadb829e9636'::uuid, 'p13', 'bigmac', 'Sending biscuits your way 🍪', 38, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'bigmac' and text = 'Sending biscuits your way 🍪');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p14', 'bigmac', 'expo', 'hat', 'happy', '/photos/post-p14.jpg', array['/photos/post-p14.jpg', '/photos/post-p14-2.jpg', '/photos/post-p14-3.jpg']::text[], null, 'Brought a flower to the Pet Expo 🌷 Treat stand: located.', array['PetExpo', 'goldenretriever']::text[], 'Sydney Showground', 'first-expo', null, 3900, 48, 0, now() - interval '4 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f9e22cb9-ac6d-46a0-8fd9-591474d463dc'::uuid, 'p14', 'pepper', 'Need this energy today', 9, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'pepper' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '650e8e59-d9e7-4877-9a7d-dbcafd63f1c7'::uuid, 'p14', 'mochi', 'So cute!! 😍', 16, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'mochi' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '22ac04c5-8f9d-43d2-ae24-1b485f1e12da'::uuid, 'p14', 'ollie', 'Iconic.', 23, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'ollie' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '051b7aef-5ca2-4152-b40a-9420467da549'::uuid, 'p14', 'rex', 'Boop boop boop 🐾', 30, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'rex' and text = 'Boop boop boop 🐾');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p15', 'mochi', 'park', 'duck', 'happy', '/photos/post-p15.jpg', array['/photos/post-p15.jpg']::text[], null, 'Puppy throwback 🥹 Look how tiny I was', array['throwback', 'puppy']::text[], null, null, null, 18000, 260, 0, now() - interval '5 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '74f1214c-4155-4ff7-952b-032c92cd9967'::uuid, 'p15', 'miso', 'The cutest thing on Floof today', 22, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'miso' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c4605762-f836-48ab-8db2-05bf649ef3d3'::uuid, 'p15', 'toby', 'Need this energy today', 29, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'toby' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'cb205820-6d08-4570-a7d0-d85edbe56d09'::uuid, 'p15', 'clover', 'So cute!! 😍', 36, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'clover' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd8fc9b0b-e74c-4098-adc3-71054ce481e9'::uuid, 'p15', 'biscuit', 'Iconic.', 3, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'biscuit' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a9f49be3-c8e9-4329-9b23-47c2e02615e0'::uuid, 'p15', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4de7d060-d2a0-4864-aa09-3dfcba36342c'::uuid, 'p15', 'luna', 'Can we be friends?', 17, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p16', 'luna', 'blossom', 'none', 'smile', '/photos/post-p16.jpg', array['/photos/post-p16.jpg']::text[], null, 'Watching the birds. Planning. 🐦', array['catsofinstagram', 'windowcat']::text[], null, null, null, 11000, 120, 0, now() - interval '6 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'db13c79a-eaa6-4cf6-bcd1-78cbc7d03acd'::uuid, 'p16', 'mochi', 'Look at that face 🥹', 35, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4208ae02-e3ce-4a89-a22a-7bc7beb04139'::uuid, 'p16', 'pepper', 'The cutest thing on Floof today', 2, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'pepper' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7b8332a4-f80a-468f-9df4-2e9fa87853c2'::uuid, 'p16', 'bigmac', 'Need this energy today', 9, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p17', 'bigmac', 'snow', 'bandana', 'happy', '/photos/post-p17.jpg', array['/photos/post-p17.jpg']::text[], null, 'Gotcha Day throwback! The day I came home 🏡', array['gotchaday', 'goldenretriever']::text[], null, 'gotcha-day', null, 5200, 73, 0, now() - interval '2 weeks')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4833872d-753d-4443-8b2f-8c52f831ee40'::uuid, 'p17', 'nala', 'My human would steal you instantly', 8, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'nala' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7a82110a-8c08-497f-9adf-28e7614a085a'::uuid, 'p17', 'miso', 'Look at that face 🥹', 15, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'miso' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2eab43cc-791e-42dc-97b4-ced6fb501669'::uuid, 'p17', 'toby', 'The cutest thing on Floof today', 22, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e932985f-8f25-44f7-a592-06eecfa30983'::uuid, 'p17', 'clover', 'Need this energy today', 29, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c2091987-6659-4b40-b039-1424155da40c'::uuid, 'p17', 'biscuit', 'So cute!! 😍', 36, now() - interval '5 hours'
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
