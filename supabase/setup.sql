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

create or replace view public.pet_profiles with (security_invoker = true) as
select
  p.id, p.owner_id, p.handle, p.name, p.species, p.breed, p.age, p.city, p.bio, p.look,
  p.photo_url, p.bg, p.clan, p.verified, p.paw_score_base, p.created_at,
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
where p.clan is not null and p.owner_id is not null and x.created_at > now() - interval '7 days'
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
    if tg_op = 'INSERT' then new.created_at := now(); end if;
    if tg_op = 'UPDATE' then new.created_at := old.created_at; new.pet_id := old.pet_id; end if;
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
create policy floof_posts_read on public.posts for select using (true);
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
select '3764d030-a404-4ce1-8145-15aec2e21215'::uuid, 'p1', 'luna', 'So cute!! I would never let them do this to me', 14, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'luna' and text = 'So cute!! I would never let them do this to me');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4b583cf8-d8fd-47ea-849b-ff316675b7d3'::uuid, 'p1', 'ollie', 'Happiness in a photo 🥹', 8, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'ollie' and text = 'Happiness in a photo 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c46fbbea-aad9-4faa-87c5-32aae5242065'::uuid, 'p1', 'biscuit', 'Hair goals tbh', 5, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'biscuit' and text = 'Hair goals tbh');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p2', 'biscuit', 'expo', 'bandana', 'happy', '/photos/post-p2.jpg', array['/photos/post-p2.jpg', '/photos/post-p2-2.jpg', '/photos/post-p2-3.jpg']::text[], null, 'First time at the Pet Expo! Made a new bestie 😍', array['PetExpo', 'GoodBoy', 'FloofLife']::text[], 'Sydney Showground', 'first-expo', null, 28700, 420, 0, now() - interval '5 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b2442db2-d0c6-4950-ad14-d04fb92c4f68'::uuid, 'p2', 'toby', 'Was that you at the treat stand?? 👀', 22, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'toby' and text = 'Was that you at the treat stand?? 👀');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '917d4e38-f9bf-4940-9988-75511c1dc11f'::uuid, 'p2', 'mochi', 'See you next year bestie!', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'See you next year bestie!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9135d9ba-81ee-4753-94c1-495d4e1f40bc'::uuid, 'p2', 'luna', 'Iconic.', 27, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'luna' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c9ffe411-98f3-4d68-83ee-cca8d271def4'::uuid, 'p2', 'peanut', 'Boop boop boop 🐾', 34, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '049069ba-4b5d-4641-97cd-20e2513d79e3'::uuid, 'p2', 'mochi', 'Can we be friends?', 1, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p3', 'toby', 'beach', 'none', 'happy', '/photos/post-p3.jpg', array['/photos/post-p3.jpg', '/photos/post-p3-2.jpg']::text[], 'first time at the beach!', 'First swim of the season! 🌊 Wouldn''t have it any other way 💙', array['firstmoment', 'beachday', 'goodboy']::text[], 'Bondi Beach', 'first-beach', null, 1200, 12, 0, now() - interval '7 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'cb433621-fa55-48d0-b018-1a81c3f55027'::uuid, 'p3', 'rex', 'I''ll stick to the sand thanks', 3, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'I''ll stick to the sand thanks');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'be916da7-dd4e-4f7e-b2bc-5ca900ea6c08'::uuid, 'p3', 'bigmac', 'Need this energy today', 33, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '26628e29-3cd6-4de0-ab88-e28a0c6f42da'::uuid, 'p3', 'ollie', 'So cute!! 😍', 0, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'ollie' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1dad7bb3-c7d1-4865-b852-2510ed8080fb'::uuid, 'p3', 'rex', 'Iconic.', 7, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5315706e-307d-43b3-923b-319f529414b8'::uuid, 'p3', 'nala', 'Boop boop boop 🐾', 14, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '95f26fe7-01dc-491f-9e25-d01d31085987'::uuid, 'p3', 'miso', 'Can we be friends?', 21, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '41b980ba-53c9-4b41-8bd5-91c828f83ff2'::uuid, 'p3', 'biscuit', 'Absolute floof goals', 28, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'biscuit' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p4', 'luna', 'night', 'none', 'sleepy', '/photos/post-p4.jpg', array['/photos/post-p4.jpg']::text[], null, 'Do not disturb. Ever. 😎', array['catnap', 'sleepy']::text[], 'Sydney, Australia', null, null, 9800, 96, 0, now() - interval '9 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ef756f71-4a20-435a-ab85-6015b7c14f8e'::uuid, 'p4', 'pepper', 'Respect.', 30, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'pepper' and text = 'Respect.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1d6444a9-4c7c-4aec-baee-ab74a2d04313'::uuid, 'p4', 'toby', 'The cutest thing on Floof today', 6, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8dbbd9bc-bc67-4ca5-9a7f-e3e693948bf2'::uuid, 'p4', 'clover', 'Need this energy today', 13, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2a219a44-fb7c-4690-81b8-5ec5e5437469'::uuid, 'p4', 'biscuit', 'So cute!! 😍', 20, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p5', 'mochi', 'blossom', 'flowers', 'happy', '/photos/post-p5.jpg', array['/photos/post-p5.jpg']::text[], 'good day!!', 'Park zoomies 🌸 More walks, more sniffing, more happiness ♡', array['flooflife', 'samoyed', 'happydog', 'sunnyday']::text[], 'Royal Botanic Garden', null, null, 15200, 230, 0, now() - interval '12 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4722e933-9668-4b50-a9bb-737680ad2e1d'::uuid, 'p5', 'nala', 'Prettiest floof in the garden', 11, now() - interval '12 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Prettiest floof in the garden');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '46915b63-6a64-4e70-b20a-06a175a08af9'::uuid, 'p5', 'pepper', 'Look at that face 🥹', 19, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'pepper' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '26c9b13d-564f-43d1-8d84-c64d575cfa6f'::uuid, 'p5', 'bigmac', 'The cutest thing on Floof today', 26, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'bigmac' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5edbaba5-b585-4d30-b6e9-64deaf69f232'::uuid, 'p5', 'ollie', 'Need this energy today', 33, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'ollie' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '513181a5-c302-4a9b-a65b-1caead666f90'::uuid, 'p5', 'rex', 'So cute!! 😍', 0, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'rex' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '69a9b501-e3f7-4dac-b389-e8e70e6b083e'::uuid, 'p5', 'nala', 'Iconic.', 7, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Iconic.');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p6', 'miso', 'cozy', 'none', 'smile', '/photos/post-p6.jpg', array['/photos/post-p6.jpg']::text[], null, 'Found the one warm patch in the house ☀️', array['orangecat', 'sunbeam']::text[], 'Gold Coast', null, null, 6400, 44, 0, now() - interval '14 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '30ad4f53-c699-4abb-8f05-46e2cad8f5ee'::uuid, 'p6', 'toby', 'This made my day ♡', 25, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'toby' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a17a8063-64d8-4c1c-9191-7adff704976b'::uuid, 'p6', 'clover', 'My human would steal you instantly', 32, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4a8c9b61-5f98-4a09-ac1c-5dccfdd8f711'::uuid, 'p6', 'biscuit', 'Look at that face 🥹', 39, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'biscuit' and text = 'Look at that face 🥹');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p7', 'bigmac', 'park', 'bandana', 'happy', '/photos/post-p7.jpg', array['/photos/post-p7.jpg']::text[], null, 'Park zoomies with my bestie Mochi 🐾', array['zoomies', 'shiba', 'bestfriends']::text[], 'Centennial Park', 'first-park', null, 4200, 61, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7c4c976b-48f9-47d2-bf53-0de18824d9df'::uuid, 'p7', 'mochi', 'Best day ever!!', 19, now() - interval '1 days'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Best day ever!!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '519b8aaa-0c05-46b9-8ac5-8a141843f8f5'::uuid, 'p7', 'luna', 'This made my day ♡', 5, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'luna' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e1d5b399-d16b-49a1-9c8d-d2e2f3c5f2e2'::uuid, 'p7', 'pepper', 'My human would steal you instantly', 12, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'pepper' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '32216573-f256-408a-9d30-960c02863040'::uuid, 'p7', 'mochi', 'Look at that face 🥹', 19, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '37963a89-fa2c-461b-9d96-cffea78ff6d2'::uuid, 'p7', 'ollie', 'The cutest thing on Floof today', 26, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'ollie' and text = 'The cutest thing on Floof today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p8', 'nala', 'blossom', 'flowers', 'smile', '/photos/post-p8.jpg', array['/photos/post-p8.jpg']::text[], null, 'Spring princess reporting for duty 🌼', array['ragdoll', 'spring']::text[], 'Brisbane', null, null, 7300, 81, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '76bb8ca8-bfaa-49e0-975d-5d5d5431dfbd'::uuid, 'p8', 'rex', '10/10 would boop again', 11, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'rex' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a32c87f0-d22d-4cda-a2bf-d8d2198decc5'::uuid, 'p8', 'toby', 'Sending biscuits your way 🍪', 18, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'toby' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '62335686-e989-4186-91e1-a61c2bd24ea3'::uuid, 'p8', 'miso', 'This made my day ♡', 25, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'miso' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a38308ab-fff7-44f4-9661-d7101b6bdc5c'::uuid, 'p8', 'biscuit', 'My human would steal you instantly', 32, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'biscuit' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9c032891-374c-4469-a15f-95a80156ecee'::uuid, 'p8', 'clover', 'Look at that face 🥹', 39, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'clover' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '68cc46f3-a35d-4267-90bb-b84fa14bcd5a'::uuid, 'p8', 'luna', 'The cutest thing on Floof today', 6, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'luna' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '255c03c6-bfcb-4220-b479-c6312ccde752'::uuid, 'p8', 'peanut', 'Need this energy today', 13, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'peanut' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p9', 'peanut', 'cozy', 'party', 'smile', '/photos/post-p9.jpg', array['/photos/post-p9.jpg']::text[], '8 months old!', 'Celebrated with a sunflower seed cake 🎉', array['hamster', 'birthday']::text[], null, 'first-birthday', null, 2100, 33, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4dc1efd4-7dd6-4f42-8722-fec38bc6ce78'::uuid, 'p9', 'luna', 'Absolute floof goals', 24, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'luna' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '469844db-29ff-4299-9cf4-d4193d96ac76'::uuid, 'p9', 'pepper', '10/10 would boop again', 31, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'pepper' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f0d6f5ca-86e0-4444-9134-f3c868bcdb03'::uuid, 'p9', 'mochi', 'Sending biscuits your way 🍪', 38, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'mochi' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f16a1597-2ade-4854-8485-89b6a51c98b5'::uuid, 'p9', 'ollie', 'This made my day ♡', 5, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'ollie' and text = 'This made my day ♡');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p10', 'ollie', 'vet', 'bandana', 'smile', '/photos/post-p10.jpg', array['/photos/post-p10.jpg']::text[], 'brave boy', 'First vet visit — wore my disguise 😎🩺', array['firstmoment', 'chowchow']::text[], 'Perth', 'first-vet', null, 3100, 27, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '85913789-d44a-4465-80b2-b0d1658dfebb'::uuid, 'p10', 'nala', 'Can we be friends?', 37, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'nala' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'e2646f9a-6551-47f3-84d8-7059745f0ad8'::uuid, 'p10', 'rex', 'Absolute floof goals', 4, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'rex' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '68574c93-7383-46c3-9273-c84640d715d2'::uuid, 'p10', 'toby', '10/10 would boop again', 11, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'toby' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ed5ff12c-6f42-401b-bf4b-12597d7bab68'::uuid, 'p10', 'miso', 'Sending biscuits your way 🍪', 18, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'miso' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '98cbc385-cbba-4256-81e4-9f7b14e0869e'::uuid, 'p10', 'biscuit', 'This made my day ♡', 25, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'biscuit' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '0eca7e31-88ce-492c-94ce-21a315d7dc63'::uuid, 'p10', 'clover', 'My human would steal you instantly', 32, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p11', 'clover', 'park', 'flowers', 'smile', '/photos/post-p11.jpg', array['/photos/post-p11.jpg']::text[], null, 'Binkies in the clover patch 🍀', array['bunny', 'binky']::text[], null, null, null, 5100, 52, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b99173f9-cf73-4f52-af68-ff869b0189b2'::uuid, 'p11', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c40bf491-04fc-4576-a6fd-7e55d271c010'::uuid, 'p11', 'luna', 'Can we be friends?', 17, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '43e03061-d67d-4bfe-b57c-4a35a233c484'::uuid, 'p11', 'pepper', 'Absolute floof goals', 24, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'pepper' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p12', 'rex', 'sunset', 'sunglasses', 'happy', '/photos/post-p12.jpg', array['/photos/post-p12.jpg']::text[], null, 'New hoodie, who dis 😎', array['frenchie', 'ootd']::text[], null, null, null, 20400, 140, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ef1adc85-d97b-4e9b-8d90-2aaef80df4b4'::uuid, 'p12', 'bigmac', 'Iconic.', 23, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'bigmac' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '861317dc-7ac5-4d0b-aab0-2d9adb4318fd'::uuid, 'p12', 'nala', 'Boop boop boop 🐾', 30, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '04d34f3c-c8d7-4199-9b35-e61b70c21c82'::uuid, 'p12', 'miso', 'Can we be friends?', 37, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b90829c9-7aa5-4f4a-a5ed-97b133a7ee01'::uuid, 'p12', 'toby', 'Absolute floof goals', 4, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'toby' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'dd42ea6e-08f9-46f8-a9ea-cf493d81733c'::uuid, 'p12', 'clover', '10/10 would boop again', 11, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'clover' and text = '10/10 would boop again');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p13', 'pepper', 'party', 'crown', 'wink', '/photos/post-p13.jpg', array['/photos/post-p13.jpg']::text[], null, 'Gotcha Day #6. Exhausted from ruling this house 👑', array['tuxedocat', 'gotchaday']::text[], null, 'gotcha-day', null, 4800, 70, 0, now() - interval '3 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5360781e-c093-4f91-8152-7db7c3ca1e5a'::uuid, 'p13', 'biscuit', 'So cute!! 😍', 36, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f86e7ef8-20eb-46f3-a548-c3d92fa8ae70'::uuid, 'p13', 'clover', 'Iconic.', 3, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'clover' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1d4df8bd-2fce-40b6-905c-a8fe52cc9bf8'::uuid, 'p13', 'luna', 'Boop boop boop 🐾', 10, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'luna' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '137140f8-edff-43a3-83a3-d359ffcd9f36'::uuid, 'p13', 'peanut', 'Can we be friends?', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'peanut' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3c6e9a2d-5d7c-4c47-b9be-ec78860a4976'::uuid, 'p13', 'mochi', 'Absolute floof goals', 24, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'mochi' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '966d5184-3e37-4691-90c7-fba2a8c0fc4b'::uuid, 'p13', 'ollie', '10/10 would boop again', 31, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'ollie' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1c4bf7d6-81eb-4156-8d91-c89912cfd24b'::uuid, 'p13', 'bigmac', 'Sending biscuits your way 🍪', 38, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'bigmac' and text = 'Sending biscuits your way 🍪');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p14', 'bigmac', 'expo', 'hat', 'happy', '/photos/post-p14.jpg', array['/photos/post-p14.jpg', '/photos/post-p14-2.jpg', '/photos/post-p14-3.jpg']::text[], null, 'Brought a flower to the Pet Expo 🌷 Treat stand: located.', array['PetExpo', 'goldenretriever']::text[], 'Sydney Showground', 'first-expo', null, 3900, 48, 0, now() - interval '4 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '460d8289-9747-43c4-a0ec-c9c2c523c5a9'::uuid, 'p14', 'pepper', 'Need this energy today', 9, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'pepper' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3d0571e5-f9ed-4a2d-b953-3d594d5c19fc'::uuid, 'p14', 'mochi', 'So cute!! 😍', 16, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'mochi' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3d3d8379-0392-4763-9d3c-e0cead2f754a'::uuid, 'p14', 'ollie', 'Iconic.', 23, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'ollie' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '965474dc-6311-4cde-b162-2eb9a0ab3479'::uuid, 'p14', 'rex', 'Boop boop boop 🐾', 30, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'rex' and text = 'Boop boop boop 🐾');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p15', 'mochi', 'park', 'duck', 'happy', '/photos/post-p15.jpg', array['/photos/post-p15.jpg']::text[], null, 'Puppy throwback 🥹 Look how tiny I was', array['throwback', 'puppy']::text[], null, null, null, 18000, 260, 0, now() - interval '5 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3bb1fb6c-a636-4369-b5fe-08e37d325462'::uuid, 'p15', 'miso', 'The cutest thing on Floof today', 22, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'miso' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f4d56b4a-f45a-4dd7-9a5f-e378288557e6'::uuid, 'p15', 'toby', 'Need this energy today', 29, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'toby' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2c30d162-3c08-4315-9d19-afcc1879c2e9'::uuid, 'p15', 'clover', 'So cute!! 😍', 36, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'clover' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '0986bb40-6fad-4c66-a67e-0fd09517020a'::uuid, 'p15', 'biscuit', 'Iconic.', 3, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'biscuit' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'c9f31757-8df5-4387-bcf7-d87dcdf9e983'::uuid, 'p15', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a627bf87-d71a-4e0d-b8f7-5dd2e7a87af3'::uuid, 'p15', 'luna', 'Can we be friends?', 17, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p16', 'luna', 'blossom', 'none', 'smile', '/photos/post-p16.jpg', array['/photos/post-p16.jpg']::text[], null, 'Watching the birds. Planning. 🐦', array['catsofinstagram', 'windowcat']::text[], null, null, null, 11000, 120, 0, now() - interval '6 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '93c864c0-93db-4081-b305-37b4f46c9bb2'::uuid, 'p16', 'mochi', 'Look at that face 🥹', 35, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1b8c520e-b93f-418d-bad2-7783b559e277'::uuid, 'p16', 'pepper', 'The cutest thing on Floof today', 2, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'pepper' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6f5cfcbf-0cfc-41bb-8705-1539c6066d3a'::uuid, 'p16', 'bigmac', 'Need this energy today', 9, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p17', 'bigmac', 'snow', 'bandana', 'happy', '/photos/post-p17.jpg', array['/photos/post-p17.jpg']::text[], null, 'Gotcha Day throwback! The day I came home 🏡', array['gotchaday', 'goldenretriever']::text[], null, 'gotcha-day', null, 5200, 73, 0, now() - interval '2 weeks')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '818342f8-6013-483a-9d15-4504519191c2'::uuid, 'p17', 'nala', 'My human would steal you instantly', 8, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'nala' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ff611f98-bb53-4576-8308-792c431fc125'::uuid, 'p17', 'miso', 'Look at that face 🥹', 15, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'miso' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '503082f8-fc67-441c-9e5e-4a85d6e33512'::uuid, 'p17', 'toby', 'The cutest thing on Floof today', 22, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a4c8bb0c-fe24-4cec-a2f9-6199ad0f74c0'::uuid, 'p17', 'clover', 'Need this energy today', 29, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9c1df5f7-6cc4-4766-bf77-17b34db3924b'::uuid, 'p17', 'biscuit', 'So cute!! 😍', 36, now() - interval '5 hours'
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
