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
-- Added later: personality quiz result.
alter table public.pets add column if not exists personality text check (char_length(personality) <= 40);

-- Added later: family sharing. Other people who help manage a pet (owner stays in pets.owner_id).
create table if not exists public.pet_members (
  pet_id text not null references public.pets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);

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
-- Added later: pet tags, photo frame + stickers, edit time.
alter table public.posts add column if not exists tagged_pets text[] not null default '{}';
alter table public.posts add column if not exists frame text;
alter table public.posts add column if not exists stickers jsonb not null default '[]';
alter table public.posts add column if not exists edited_at timestamptz;
alter table public.posts drop constraint if exists posts_tagged_max;
alter table public.posts add constraint posts_tagged_max check (cardinality(tagged_pets) <= 10);
create index if not exists posts_tagged_idx on public.posts using gin (tagged_pets);
-- Added later: photo shape (square 1:1 or portrait 4:5).
alter table public.posts add column if not exists aspect text not null default 'square';
alter table public.posts drop constraint if exists posts_aspect_check;
alter table public.posts add constraint posts_aspect_check check (aspect in ('square', 'portrait'));

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
-- Added later: replies (one level deep).
alter table public.comments add column if not exists parent_id uuid references public.comments (id) on delete cascade;

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
  kind text not null,
  amount int not null check (amount > 0),
  counterparty_id text references public.pets (id) on delete set null,
  post_id text references public.posts (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
-- 'shop' = biscuits spent in the Biscuit Shop (frames, stickers, filters).
alter table public.biscuit_ledger drop constraint if exists biscuit_ledger_kind_check;
alter table public.biscuit_ledger add constraint biscuit_ledger_kind_check check (kind in ('welcome', 'topup', 'sent', 'received', 'redeem', 'shop'));
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
-- Added later: reply to a specific message.
alter table public.messages add column if not exists reply_to uuid references public.messages (id) on delete set null;
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
  select exists (select 1 from public.pets where id = p_pet and owner_id = auth.uid())
      or exists (select 1 from public.pet_members where pet_id = p_pet and user_id = auth.uid());
$$;

-- Give every new (real) pet 50 welcome biscuits.
create or replace function public.welcome_biscuits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only an account's first pet gets the welcome gift (stops farming biscuits with extra pets).
  if new.owner_id is not null and (select count(*) from public.pets where owner_id = new.owner_id) = 1 then
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

-- Spendable wallet balance (welcome + top-ups − sent − shop).
create or replace function public.wallet_balance(p_pet text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case when kind in ('welcome', 'topup') then amount
                           when kind in ('sent', 'shop') then -amount else 0 end), 0)::int
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
  p.photo_url, p.bg, p.clan, p.verified, p.paw_score_base, p.created_at, p.birthday, p.gotcha_day, p.personality,
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
create policy floof_pets_update on public.pets for update to authenticated using (public.owns_pet(id)) with check (public.owns_pet(id));
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
      if new.caption is distinct from old.caption or new.tags is distinct from old.tags or new.tagged_pets is distinct from old.tagged_pets then
        new.edited_at := now();
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
create policy floof_comments_insert on public.comments for insert to authenticated with check (
  public.owns_pet(pet_id) and likes = 0
  and (comments.parent_id is null or exists (select 1 from public.comments c where c.id = comments.parent_id and c.post_id = comments.post_id))
);
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
create policy floof_messages_write on public.messages for insert to authenticated with check (
  public.owns_pet(from_pet) and from_pet <> to_pet
  and (messages.reply_to is null or exists (
    select 1 from public.messages m where m.id = messages.reply_to
      and ((m.from_pet = messages.from_pet and m.to_pet = messages.to_pet) or (m.from_pet = messages.to_pet and m.to_pet = messages.from_pet))
  ))
);

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

-- ===========================================================================
-- Social features (added later)
-- ===========================================================================

-- At most 6 pets per account.
create or replace function public.limit_pets_per_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is not null and (select count(*) from public.pets where owner_id = new.owner_id) >= 6 then
    raise exception 'You can have up to 6 pets per account';
  end if;
  return new;
end;
$$;
drop trigger if exists pets_limit_per_owner on public.pets;
create trigger pets_limit_per_owner before insert on public.pets for each row execute function public.limit_pets_per_owner();

-- Comment likes.
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  pet_id text not null references public.pets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, pet_id)
);
create or replace view public.comment_like_counts with (security_invoker = true) as
select comment_id, count(*)::int as likes from public.comment_likes group by comment_id;

-- Message reactions (one per pet per message).
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  pet_id text not null references public.pets (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, pet_id)
);

-- 24-hour stories.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  pet_id text not null references public.pets (id) on delete cascade,
  image_url text,
  text text check (char_length(text) <= 200),
  bg text not null default '#F7A07A',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists stories_live_idx on public.stories (expires_at desc);
create table if not exists public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id text not null references public.pets (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create or replace function public.story_times()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.created_at := now();
    new.expires_at := now() + interval '24 hours';
  end if;
  return new;
end;
$$;
drop trigger if exists stories_times on public.stories;
create trigger stories_times before insert on public.stories for each row execute function public.story_times();

-- Saved-post collections (private).
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  pet_id text not null references public.pets (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);
create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  post_id text not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);

-- Paw-fives: a quick hello, once per pet pair per day.
create table if not exists public.paw_fives (
  id uuid primary key default gen_random_uuid(),
  from_pet text not null references public.pets (id) on delete cascade,
  to_pet text not null references public.pets (id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  unique (from_pet, to_pet, day),
  check (from_pet <> to_pet)
);

-- Playdate invites.
create table if not exists public.playdates (
  id uuid primary key default gen_random_uuid(),
  from_pet text not null references public.pets (id) on delete cascade,
  to_pet text not null references public.pets (id) on delete cascade,
  place text not null check (char_length(place) between 1 and 100),
  starts_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  check (from_pet <> to_pet)
);
-- Only the invited pet can accept/decline; only the inviter can cancel; nothing else changes.
create or replace function public.playdate_rules()
returns trigger
language plpgsql
as $$
declare
  next_status text := new.status;
begin
  if auth.uid() is null then return new; end if;
  if next_status = old.status then return old; end if;
  if not (
    (next_status in ('accepted', 'declined') and old.status = 'pending' and public.owns_pet(old.to_pet))
    or (next_status = 'cancelled' and old.status in ('pending', 'accepted') and public.owns_pet(old.from_pet))
  ) then
    raise exception 'That change is not allowed';
  end if;
  new := old;
  new.status := next_status;
  return new;
end;
$$;
drop trigger if exists playdates_rules on public.playdates;
create trigger playdates_rules before update on public.playdates for each row execute function public.playdate_rules();

-- Family invites.
create table if not exists public.pet_invites (
  code text primary key,
  pet_id text not null references public.pets (id) on delete cascade,
  created_by uuid not null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid,
  used_at timestamptz
);

create or replace function public.create_family_invite(p_pet text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  c text;
begin
  if not public.owns_pet(p_pet) then raise exception 'not your pet'; end if;
  c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.pet_invites (code, pet_id, created_by) values (c, p_pet, auth.uid());
  return c;
end;
$$;

create or replace function public.accept_family_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.pet_invites;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into inv from public.pet_invites where code = lower(trim(p_code)) for update;
  if inv.code is null then raise exception 'That invite code doesn''t exist'; end if;
  if inv.used_at is not null then raise exception 'That invite has already been used'; end if;
  if inv.expires_at < now() then raise exception 'That invite has expired'; end if;
  if public.owns_pet(inv.pet_id) then return inv.pet_id; end if;
  insert into public.pet_members (pet_id, user_id) values (inv.pet_id, auth.uid()) on conflict do nothing;
  update public.pet_invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.pet_id;
end;
$$;

-- Row level security for the social tables.
alter table public.pet_members enable row level security;
alter table public.pet_invites enable row level security;
alter table public.comment_likes enable row level security;
alter table public.message_reactions enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.paw_fives enable row level security;
alter table public.playdates enable row level security;

drop policy if exists floof_members_read on public.pet_members;
drop policy if exists floof_members_delete on public.pet_members;
create policy floof_members_read on public.pet_members for select to authenticated using (user_id = auth.uid() or public.owns_pet(pet_id));
create policy floof_members_delete on public.pet_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()));

drop policy if exists floof_invites_read on public.pet_invites;
drop policy if exists floof_invites_delete on public.pet_invites;
create policy floof_invites_read on public.pet_invites for select to authenticated using (public.owns_pet(pet_id));
create policy floof_invites_delete on public.pet_invites for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_clikes_read on public.comment_likes;
drop policy if exists floof_clikes_insert on public.comment_likes;
drop policy if exists floof_clikes_delete on public.comment_likes;
create policy floof_clikes_read on public.comment_likes for select using (true);
create policy floof_clikes_insert on public.comment_likes for insert to authenticated with check (public.owns_pet(pet_id));
create policy floof_clikes_delete on public.comment_likes for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_reactions_read on public.message_reactions;
drop policy if exists floof_reactions_insert on public.message_reactions;
drop policy if exists floof_reactions_update on public.message_reactions;
drop policy if exists floof_reactions_delete on public.message_reactions;
create policy floof_reactions_read on public.message_reactions for select to authenticated using (
  exists (select 1 from public.messages m where m.id = message_id and (public.owns_pet(m.from_pet) or public.owns_pet(m.to_pet)))
);
create policy floof_reactions_insert on public.message_reactions for insert to authenticated with check (
  public.owns_pet(pet_id) and exists (select 1 from public.messages m where m.id = message_id and pet_id in (m.from_pet, m.to_pet))
);
create policy floof_reactions_update on public.message_reactions for update to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));
create policy floof_reactions_delete on public.message_reactions for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_stories_read on public.stories;
drop policy if exists floof_stories_insert on public.stories;
drop policy if exists floof_stories_delete on public.stories;
create policy floof_stories_read on public.stories for select using (expires_at > now() or public.owns_pet(pet_id));
create policy floof_stories_insert on public.stories for insert to authenticated with check (public.owns_pet(pet_id) and (image_url is not null or coalesce(text, '') <> ''));
create policy floof_stories_delete on public.stories for delete to authenticated using (public.owns_pet(pet_id));

drop policy if exists floof_views_read on public.story_views;
drop policy if exists floof_views_insert on public.story_views;
create policy floof_views_read on public.story_views for select to authenticated using (
  public.owns_pet(viewer_id) or exists (select 1 from public.stories s where s.id = story_id and public.owns_pet(s.pet_id))
);
create policy floof_views_insert on public.story_views for insert to authenticated with check (public.owns_pet(viewer_id));

drop policy if exists floof_collections_all on public.collections;
create policy floof_collections_all on public.collections for all to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));
drop policy if exists floof_collection_items_all on public.collection_items;
create policy floof_collection_items_all on public.collection_items for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and public.owns_pet(c.pet_id)))
  with check (exists (select 1 from public.collections c where c.id = collection_id and public.owns_pet(c.pet_id)));

drop policy if exists floof_pawfives_read on public.paw_fives;
drop policy if exists floof_pawfives_insert on public.paw_fives;
create policy floof_pawfives_read on public.paw_fives for select to authenticated using (public.owns_pet(from_pet) or public.owns_pet(to_pet));
create policy floof_pawfives_insert on public.paw_fives for insert to authenticated with check (public.owns_pet(from_pet) and day = current_date);

drop policy if exists floof_playdates_read on public.playdates;
drop policy if exists floof_playdates_insert on public.playdates;
drop policy if exists floof_playdates_update on public.playdates;
create policy floof_playdates_read on public.playdates for select to authenticated using (public.owns_pet(from_pet) or public.owns_pet(to_pet));
create policy floof_playdates_insert on public.playdates for insert to authenticated with check (public.owns_pet(from_pet) and status = 'pending');
create policy floof_playdates_update on public.playdates for update to authenticated using (public.owns_pet(from_pet) or public.owns_pet(to_pet)) with check (true);

grant select on public.comment_likes, public.comment_like_counts, public.stories to anon, authenticated;
grant insert, delete on public.comment_likes, public.stories, public.pet_members, public.pet_invites to authenticated;
grant select on public.pet_members, public.pet_invites, public.message_reactions, public.story_views, public.paw_fives, public.playdates to authenticated;
grant insert, update, delete on public.message_reactions to authenticated;
grant insert on public.story_views, public.paw_fives, public.playdates to authenticated;
grant update on public.playdates to authenticated;
grant select, insert, update, delete on public.collections, public.collection_items to authenticated;
revoke all on function public.create_family_invite(text) from public, anon;
revoke all on function public.accept_family_invite(text) from public, anon;
grant execute on function public.create_family_invite(text) to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;

-- Live updates for message reactions too.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Biscuit Shop (premium frames, sticker packs, filters) and Pet Care notes
-- ---------------------------------------------------------------------------

-- Prices must match lib/shop.ts. NULL = not for sale.
create or replace function public.shop_price(p_item text)
returns int
language sql
immutable
as $$
  select case p_item
    when 'frame:neon' then 20 when 'frame:rainbow' then 20 when 'frame:film' then 15
    when 'frame:royal' then 25 when 'frame:stars' then 15 when 'frame:bones' then 15 when 'frame:blossom' then 15
    when 'stickers:party' then 10 when 'stickers:spooky' then 10 when 'stickers:fancy' then 15
    when 'stickers:snacks' then 10 when 'stickers:nature' then 10
    when 'filter:shiba' then 10 when 'filter:siamese' then 10 when 'filter:dalmatian' then 10
    when 'filter:poodle' then 10 when 'filter:persian' then 10
  end;
$$;

-- Which sticker pack a premium sticker belongs to (NULL = free sticker).
create or replace function public.shop_sticker_item(p_emoji text)
returns text
language sql
immutable
as $$
  select case
    when p_emoji in ('🥳', '🎂', '🎁', '🎈', '🪅') then 'stickers:party'
    when p_emoji in ('🎃', '👻', '🦇', '🕸️', '🍬') then 'stickers:spooky'
    when p_emoji in ('💎', '🎩', '🦄', '🌟', '💅') then 'stickers:fancy'
    when p_emoji in ('🍕', '🍩', '🧁', '🍦', '🥓') then 'stickers:snacks'
    when p_emoji in ('🍀', '🌻', '🦋', '🌙', '☀️') then 'stickers:nature'
  end;
$$;

create table if not exists public.shop_unlocks (
  pet_id text not null references public.pets (id) on delete cascade,
  item text not null,
  created_at timestamptz not null default now(),
  primary key (pet_id, item)
);
alter table public.shop_unlocks enable row level security;
drop policy if exists floof_unlocks_read on public.shop_unlocks;
create policy floof_unlocks_read on public.shop_unlocks for select to authenticated using (public.owns_pet(pet_id));
grant select on public.shop_unlocks to authenticated;

-- Buy an item with wallet biscuits. Buying something you already own costs nothing.
create or replace function public.buy_shop_item(p_pet text, p_item text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  price int := public.shop_price(p_item);
  bal int;
begin
  if not public.owns_pet(p_pet) then raise exception 'not your pet'; end if;
  if price is null then raise exception 'unknown item'; end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || p_pet));
  if exists (select 1 from public.shop_unlocks where pet_id = p_pet and item = p_item) then
    return public.wallet_balance(p_pet);
  end if;
  bal := public.wallet_balance(p_pet);
  if bal < price then raise exception 'not enough biscuits'; end if;
  insert into public.biscuit_ledger (pet_id, kind, amount, note) values (p_pet, 'shop', price, 'Biscuit Shop: ' || p_item);
  insert into public.shop_unlocks (pet_id, item) values (p_pet, p_item);
  return bal - price;
end;
$$;
revoke all on function public.buy_shop_item(text, text) from public, anon;
grant execute on function public.buy_shop_item(text, text) to authenticated;

-- Premium frames and stickers can only be used by pets that unlocked them.
create or replace function public.check_post_unlocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  need text;
begin
  if new.frame is not null and new.frame <> '' and public.shop_price('frame:' || new.frame) is not null
     and (tg_op = 'INSERT' or new.frame is distinct from old.frame)
     and not exists (select 1 from public.shop_unlocks u where u.pet_id = new.pet_id and u.item = 'frame:' || new.frame) then
    raise exception 'unlock this frame in the Biscuit Shop first';
  end if;
  if tg_op = 'INSERT' or new.stickers is distinct from old.stickers then
    for need in
      select distinct public.shop_sticker_item(st ->> 'e')
      from jsonb_array_elements(case when jsonb_typeof(new.stickers) = 'array' then new.stickers else '[]'::jsonb end) st
    loop
      if need is not null and not exists (select 1 from public.shop_unlocks u where u.pet_id = new.pet_id and u.item = need) then
        raise exception 'unlock this sticker pack in the Biscuit Shop first';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_check_unlocks on public.posts;
create trigger posts_check_unlocks before insert or update of frame, stickers on public.posts
  for each row execute function public.check_post_unlocks();

-- Private notes in Pet Care (vet instructions, food, quirks…). Shared with family members.
create table if not exists public.pet_notes (
  id uuid primary key default gen_random_uuid(),
  pet_id text not null references public.pets (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  body text not null default '' check (char_length(body) <= 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pet_notes_pet_idx on public.pet_notes (pet_id, updated_at desc);
alter table public.pet_notes enable row level security;
drop policy if exists floof_notes_all on public.pet_notes;
create policy floof_notes_all on public.pet_notes for all to authenticated using (public.owns_pet(pet_id)) with check (public.owns_pet(pet_id));
grant select, insert, update, delete on public.pet_notes to authenticated;

create or replace function public.touch_note()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  new.pet_id := old.pet_id;
  return new;
end;
$$;
drop trigger if exists pet_notes_touch on public.pet_notes;
create trigger pet_notes_touch before update on public.pet_notes for each row execute function public.touch_note();

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
select '6bc872a0-9571-461b-9999-0ec7e178d1d5'::uuid, 'p1', 'luna', 'So cute!! I would never let them do this to me', 14, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'luna' and text = 'So cute!! I would never let them do this to me');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '65e9820b-d1e4-42de-90b6-a853b5d34f65'::uuid, 'p1', 'ollie', 'Happiness in a photo 🥹', 8, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'ollie' and text = 'Happiness in a photo 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '944dd8ae-a510-447b-bb73-870f6baa36a1'::uuid, 'p1', 'biscuit', 'Hair goals tbh', 5, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p1' and pet_id = 'biscuit' and text = 'Hair goals tbh');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p2', 'biscuit', 'expo', 'bandana', 'happy', '/photos/post-p2.jpg', array['/photos/post-p2.jpg', '/photos/post-p2-2.jpg', '/photos/post-p2-3.jpg']::text[], null, 'First time at the Pet Expo! Made a new bestie 😍', array['PetExpo', 'GoodBoy', 'FloofLife']::text[], 'Sydney Showground', 'first-expo', null, 28700, 420, 0, now() - interval '5 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3b2eddbe-5585-4d27-868a-b5bb1fc0ea1b'::uuid, 'p2', 'toby', 'Was that you at the treat stand?? 👀', 22, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'toby' and text = 'Was that you at the treat stand?? 👀');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2c129877-5aa4-45c8-a13c-cd61845a2af2'::uuid, 'p2', 'mochi', 'See you next year bestie!', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'See you next year bestie!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '77789b4f-17f5-4c54-9a2e-2b04aa081d0f'::uuid, 'p2', 'luna', 'Iconic.', 27, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'luna' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '6825906f-d2de-42c4-964e-c5c4f9056383'::uuid, 'p2', 'peanut', 'Boop boop boop 🐾', 34, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f74c4e82-a8a6-494a-a134-546f7ab080f1'::uuid, 'p2', 'mochi', 'Can we be friends?', 1, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p2' and pet_id = 'mochi' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p3', 'toby', 'beach', 'none', 'happy', '/photos/post-p3.jpg', array['/photos/post-p3.jpg', '/photos/post-p3-2.jpg']::text[], 'first time at the beach!', 'First swim of the season! 🌊 Wouldn''t have it any other way 💙', array['firstmoment', 'beachday', 'goodboy']::text[], 'Bondi Beach', 'first-beach', null, 1200, 12, 0, now() - interval '7 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'eb3386d3-1f00-4357-9fa4-2f6f513fbb11'::uuid, 'p3', 'rex', 'I''ll stick to the sand thanks', 3, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'I''ll stick to the sand thanks');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3c67adb5-93bb-4539-9005-33529b3dde2e'::uuid, 'p3', 'bigmac', 'Need this energy today', 33, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'bfc158d8-1985-47ee-9e21-e654bc636aa1'::uuid, 'p3', 'ollie', 'So cute!! 😍', 0, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'ollie' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9e560038-d3a9-4b21-b993-387625513da6'::uuid, 'p3', 'rex', 'Iconic.', 7, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'rex' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '66f1183b-44f4-4da3-bb7a-91674f5742a0'::uuid, 'p3', 'nala', 'Boop boop boop 🐾', 14, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '0dd51084-10af-481b-b063-a79107e9ec51'::uuid, 'p3', 'miso', 'Can we be friends?', 21, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f7537b3e-9a57-414b-93b9-62860715a7ef'::uuid, 'p3', 'biscuit', 'Absolute floof goals', 28, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p3' and pet_id = 'biscuit' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p4', 'luna', 'night', 'none', 'sleepy', '/photos/post-p4.jpg', array['/photos/post-p4.jpg']::text[], null, 'Do not disturb. Ever. 😎', array['catnap', 'sleepy']::text[], 'Sydney, Australia', null, null, 9800, 96, 0, now() - interval '9 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a2ea6c88-97a4-4717-bbb8-6df00394b4f4'::uuid, 'p4', 'pepper', 'Respect.', 30, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'pepper' and text = 'Respect.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8340a509-1d5e-48d3-9cab-a5e37ced65d7'::uuid, 'p4', 'toby', 'The cutest thing on Floof today', 6, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b4075e31-dee7-477b-972e-2f9caa16daec'::uuid, 'p4', 'clover', 'Need this energy today', 13, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '991b75e7-15a4-4551-a2db-327117479015'::uuid, 'p4', 'biscuit', 'So cute!! 😍', 20, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p4' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p5', 'mochi', 'blossom', 'flowers', 'happy', '/photos/post-p5.jpg', array['/photos/post-p5.jpg']::text[], 'good day!!', 'Park zoomies 🌸 More walks, more sniffing, more happiness ♡', array['flooflife', 'samoyed', 'happydog', 'sunnyday']::text[], 'Royal Botanic Garden', null, null, 15200, 230, 0, now() - interval '12 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f25c5413-5bb7-423f-9d6c-1ee58a35e38d'::uuid, 'p5', 'nala', 'Prettiest floof in the garden', 11, now() - interval '12 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Prettiest floof in the garden');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '26656682-a35a-437d-9480-8a75a543399f'::uuid, 'p5', 'pepper', 'Look at that face 🥹', 19, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'pepper' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f592c237-59a5-4e24-9480-efa4afbf45d1'::uuid, 'p5', 'bigmac', 'The cutest thing on Floof today', 26, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'bigmac' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8769857f-0f31-4c67-a7a8-b12a3daa9dc1'::uuid, 'p5', 'ollie', 'Need this energy today', 33, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'ollie' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'af749a42-503f-49d2-a691-e5bd9322a694'::uuid, 'p5', 'rex', 'So cute!! 😍', 0, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'rex' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '694a9cfa-e5ff-485d-9ef9-334467f344b0'::uuid, 'p5', 'nala', 'Iconic.', 7, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p5' and pet_id = 'nala' and text = 'Iconic.');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p6', 'miso', 'cozy', 'none', 'smile', '/photos/post-p6.jpg', array['/photos/post-p6.jpg']::text[], null, 'Found the one warm patch in the house ☀️', array['orangecat', 'sunbeam']::text[], 'Gold Coast', null, null, 6400, 44, 0, now() - interval '14 hours')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f6045564-e9e3-47b3-bb28-1a07d699855f'::uuid, 'p6', 'toby', 'This made my day ♡', 25, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'toby' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7592de7c-5aed-4ff6-a04a-fdb74f90b840'::uuid, 'p6', 'clover', 'My human would steal you instantly', 32, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '1bd1af62-8d61-4413-8bb5-091e6efba98d'::uuid, 'p6', 'biscuit', 'Look at that face 🥹', 39, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p6' and pet_id = 'biscuit' and text = 'Look at that face 🥹');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p7', 'bigmac', 'park', 'bandana', 'happy', '/photos/post-p7.jpg', array['/photos/post-p7.jpg']::text[], null, 'Park zoomies with my bestie Mochi 🐾', array['zoomies', 'shiba', 'bestfriends']::text[], 'Centennial Park', 'first-park', null, 4200, 61, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '862c38ec-10d8-4ae8-b514-e39bbd0f0e9d'::uuid, 'p7', 'mochi', 'Best day ever!!', 19, now() - interval '1 days'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Best day ever!!');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '932abf0a-679c-4435-940b-796b45145d93'::uuid, 'p7', 'luna', 'This made my day ♡', 5, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'luna' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5c062669-2d1d-4390-8ad9-26f3ef84e9d9'::uuid, 'p7', 'pepper', 'My human would steal you instantly', 12, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'pepper' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '81e37da7-3ca4-47da-8a52-a7e3a30786aa'::uuid, 'p7', 'mochi', 'Look at that face 🥹', 19, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2e847a9b-fb7a-4f84-8623-e23846ec366e'::uuid, 'p7', 'ollie', 'The cutest thing on Floof today', 26, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p7' and pet_id = 'ollie' and text = 'The cutest thing on Floof today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p8', 'nala', 'blossom', 'flowers', 'smile', '/photos/post-p8.jpg', array['/photos/post-p8.jpg']::text[], null, 'Spring princess reporting for duty 🌼', array['ragdoll', 'spring']::text[], 'Brisbane', null, null, 7300, 81, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '18fb2a35-df04-4174-9e0b-348d87e12175'::uuid, 'p8', 'rex', '10/10 would boop again', 11, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'rex' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7bcca432-3206-43e2-95e8-cffda28c0a61'::uuid, 'p8', 'toby', 'Sending biscuits your way 🍪', 18, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'toby' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ea093657-b50e-43c0-bf88-ec36e981f2b7'::uuid, 'p8', 'miso', 'This made my day ♡', 25, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'miso' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '70215ea4-bd9c-43ef-a5b1-dcdfedeb84d1'::uuid, 'p8', 'biscuit', 'My human would steal you instantly', 32, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'biscuit' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '7e13e713-d21c-48e1-a90b-be6ae43c693d'::uuid, 'p8', 'clover', 'Look at that face 🥹', 39, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'clover' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f07a15fe-0643-4e7f-bd23-2b97c5f9a6f7'::uuid, 'p8', 'luna', 'The cutest thing on Floof today', 6, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'luna' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4f7ba9a4-5c8a-452b-805e-750fef8acc6e'::uuid, 'p8', 'peanut', 'Need this energy today', 13, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p8' and pet_id = 'peanut' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p9', 'peanut', 'cozy', 'party', 'smile', '/photos/post-p9.jpg', array['/photos/post-p9.jpg']::text[], '8 months old!', 'Celebrated with a sunflower seed cake 🎉', array['hamster', 'birthday']::text[], null, 'first-birthday', null, 2100, 33, 0, now() - interval '1 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '82d2f6ac-ae8a-4a92-b147-e3f3c0669281'::uuid, 'p9', 'luna', 'Absolute floof goals', 24, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'luna' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '03cf255a-383a-4ea9-ab94-10a0b96182fc'::uuid, 'p9', 'pepper', '10/10 would boop again', 31, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'pepper' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'be57a146-e7d1-4280-9135-065fe03d6fa8'::uuid, 'p9', 'mochi', 'Sending biscuits your way 🍪', 38, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'mochi' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '860b003d-49d0-4cfb-a800-da4e55c94914'::uuid, 'p9', 'ollie', 'This made my day ♡', 5, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p9' and pet_id = 'ollie' and text = 'This made my day ♡');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p10', 'ollie', 'vet', 'bandana', 'smile', '/photos/post-p10.jpg', array['/photos/post-p10.jpg']::text[], 'brave boy', 'First vet visit — wore my disguise 😎🩺', array['firstmoment', 'chowchow']::text[], 'Perth', 'first-vet', null, 3100, 27, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '748bd8ee-f025-426d-8e3c-077e91fccd9c'::uuid, 'p10', 'nala', 'Can we be friends?', 37, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'nala' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a865d7fc-acdd-4424-bb45-daaaa200b64d'::uuid, 'p10', 'rex', 'Absolute floof goals', 4, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'rex' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2a40d42c-488c-4743-931f-801f2e15386c'::uuid, 'p10', 'toby', '10/10 would boop again', 11, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'toby' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '234948e2-8de0-49d9-9351-0ddaa26b2720'::uuid, 'p10', 'miso', 'Sending biscuits your way 🍪', 18, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'miso' and text = 'Sending biscuits your way 🍪');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9532caeb-bdbf-41eb-8cb4-7b0c7c7fe566'::uuid, 'p10', 'biscuit', 'This made my day ♡', 25, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'biscuit' and text = 'This made my day ♡');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '33806e04-aee3-43d4-9bc1-592475edcb98'::uuid, 'p10', 'clover', 'My human would steal you instantly', 32, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p10' and pet_id = 'clover' and text = 'My human would steal you instantly');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p11', 'clover', 'park', 'flowers', 'smile', '/photos/post-p11.jpg', array['/photos/post-p11.jpg']::text[], null, 'Binkies in the clover patch 🍀', array['bunny', 'binky']::text[], null, null, null, 5100, 52, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '8eb5c643-fb9f-4b57-9c45-c7e94634e3de'::uuid, 'p11', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '45e5bb7b-7568-4deb-add3-b645c2bf0399'::uuid, 'p11', 'luna', 'Can we be friends?', 17, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'da52c38c-3a29-4b4d-bd48-57342a59004d'::uuid, 'p11', 'pepper', 'Absolute floof goals', 24, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p11' and pet_id = 'pepper' and text = 'Absolute floof goals');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p12', 'rex', 'sunset', 'sunglasses', 'happy', '/photos/post-p12.jpg', array['/photos/post-p12.jpg']::text[], null, 'New hoodie, who dis 😎', array['frenchie', 'ootd']::text[], null, null, null, 20400, 140, 0, now() - interval '2 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '45e84c51-baa2-4499-8191-f7903ebcbc7a'::uuid, 'p12', 'bigmac', 'Iconic.', 23, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'bigmac' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '839576ad-9dce-4574-9ed5-54c99f1a4e2e'::uuid, 'p12', 'nala', 'Boop boop boop 🐾', 30, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'nala' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '93d4df5c-692d-496a-872f-9fd42420121c'::uuid, 'p12', 'miso', 'Can we be friends?', 37, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'miso' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'd507425c-6e17-4f14-a3fb-658466e7fefa'::uuid, 'p12', 'toby', 'Absolute floof goals', 4, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'toby' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4451919a-5d73-47f8-a2ac-1c01b1361974'::uuid, 'p12', 'clover', '10/10 would boop again', 11, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p12' and pet_id = 'clover' and text = '10/10 would boop again');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p13', 'pepper', 'party', 'crown', 'wink', '/photos/post-p13.jpg', array['/photos/post-p13.jpg']::text[], null, 'Gotcha Day #6. Exhausted from ruling this house 👑', array['tuxedocat', 'gotchaday']::text[], null, 'gotcha-day', null, 4800, 70, 0, now() - interval '3 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'fb9d7d6c-ed17-430a-8a95-7fd4c1fddfd9'::uuid, 'p13', 'biscuit', 'So cute!! 😍', 36, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'biscuit' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'bdc62a1e-8fb4-456d-aafb-9a19af07e8fc'::uuid, 'p13', 'clover', 'Iconic.', 3, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'clover' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'a1c52843-95e5-4dd0-aed4-02384e344c40'::uuid, 'p13', 'luna', 'Boop boop boop 🐾', 10, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'luna' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '74600e49-94cf-4b35-8cd9-256866590573'::uuid, 'p13', 'peanut', 'Can we be friends?', 17, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'peanut' and text = 'Can we be friends?');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'ae352bb3-c9cb-435b-8473-1ba340fe615c'::uuid, 'p13', 'mochi', 'Absolute floof goals', 24, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'mochi' and text = 'Absolute floof goals');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'bf7fba78-5c5d-4966-a120-bb2686691841'::uuid, 'p13', 'ollie', '10/10 would boop again', 31, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'ollie' and text = '10/10 would boop again');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '99f5cf34-59f5-4154-a504-326fc58e0bb4'::uuid, 'p13', 'bigmac', 'Sending biscuits your way 🍪', 38, now() - interval '7 hours'
where not exists (select 1 from public.comments where post_id = 'p13' and pet_id = 'bigmac' and text = 'Sending biscuits your way 🍪');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p14', 'bigmac', 'expo', 'hat', 'happy', '/photos/post-p14.jpg', array['/photos/post-p14.jpg', '/photos/post-p14-2.jpg', '/photos/post-p14-3.jpg']::text[], null, 'Brought a flower to the Pet Expo 🌷 Treat stand: located.', array['PetExpo', 'goldenretriever']::text[], 'Sydney Showground', 'first-expo', null, 3900, 48, 0, now() - interval '4 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b46ad13d-a4f9-4411-ac1b-317960a51cce'::uuid, 'p14', 'pepper', 'Need this energy today', 9, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'pepper' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2363dc4f-bc63-44da-9ede-6e15e1385dc3'::uuid, 'p14', 'mochi', 'So cute!! 😍', 16, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'mochi' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '40423181-52fb-4071-865e-e7a3dfadde59'::uuid, 'p14', 'ollie', 'Iconic.', 23, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'ollie' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '88b9ee6c-48ff-4a8c-88cc-751aeff6df48'::uuid, 'p14', 'rex', 'Boop boop boop 🐾', 30, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p14' and pet_id = 'rex' and text = 'Boop boop boop 🐾');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p15', 'mochi', 'park', 'duck', 'happy', '/photos/post-p15.jpg', array['/photos/post-p15.jpg']::text[], null, 'Puppy throwback 🥹 Look how tiny I was', array['throwback', 'puppy']::text[], null, null, null, 18000, 260, 0, now() - interval '5 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '9ce17893-7fe0-444c-b50c-3a2bbcb9d247'::uuid, 'p15', 'miso', 'The cutest thing on Floof today', 22, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'miso' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'f6b2b31c-2cd8-4d4c-9763-0399d72a23ba'::uuid, 'p15', 'toby', 'Need this energy today', 29, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'toby' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '08d52be8-9eef-4121-b269-3f2c7e41c51a'::uuid, 'p15', 'clover', 'So cute!! 😍', 36, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'clover' and text = 'So cute!! 😍');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '5e6feb01-a74f-4517-9ebf-a033202353a3'::uuid, 'p15', 'biscuit', 'Iconic.', 3, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'biscuit' and text = 'Iconic.');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'db79f17c-7dd4-4af4-8c3b-46216eb299f3'::uuid, 'p15', 'peanut', 'Boop boop boop 🐾', 10, now() - interval '5 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'peanut' and text = 'Boop boop boop 🐾');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '0caa32c6-6f48-4090-bd67-1795c72ea1e0'::uuid, 'p15', 'luna', 'Can we be friends?', 17, now() - interval '6 hours'
where not exists (select 1 from public.comments where post_id = 'p15' and pet_id = 'luna' and text = 'Can we be friends?');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p16', 'luna', 'blossom', 'none', 'smile', '/photos/post-p16.jpg', array['/photos/post-p16.jpg']::text[], null, 'Watching the birds. Planning. 🐦', array['catsofinstagram', 'windowcat']::text[], null, null, null, 11000, 120, 0, now() - interval '6 days')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '4f267c2c-b65f-439d-ba3c-03368f5b5226'::uuid, 'p16', 'mochi', 'Look at that face 🥹', 35, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'mochi' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '2fa4bc75-0c77-41b1-95dc-6ec95c7ac8b2'::uuid, 'p16', 'pepper', 'The cutest thing on Floof today', 2, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'pepper' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '197ce5e0-f4c5-44e2-b5d5-e684386d7f91'::uuid, 'p16', 'bigmac', 'Need this energy today', 9, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p16' and pet_id = 'bigmac' and text = 'Need this energy today');
insert into public.posts (id, pet_id, scene, accessory, expression, image_url, image_urls, overlay, caption, tags, location, moment, slides, boops_base, biscuits_base, comments_base, created_at)
values ('p17', 'bigmac', 'snow', 'bandana', 'happy', '/photos/post-p17.jpg', array['/photos/post-p17.jpg']::text[], null, 'Gotcha Day throwback! The day I came home 🏡', array['gotchaday', 'goldenretriever']::text[], null, 'gotcha-day', null, 5200, 73, 0, now() - interval '2 weeks')
on conflict (id) do update set image_url = excluded.image_url, image_urls = excluded.image_urls, comments_base = excluded.comments_base, overlay = excluded.overlay, caption = excluded.caption, tags = excluded.tags,
  location = excluded.location, moment = excluded.moment
  where public.posts.pet_id in (select id from public.pets where owner_id is null);
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3f5911e8-60bf-473c-84e8-6a99d6dd7bd5'::uuid, 'p17', 'nala', 'My human would steal you instantly', 8, now() - interval '1 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'nala' and text = 'My human would steal you instantly');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select 'b113b125-d1f6-4f1c-807d-496d21688cc8'::uuid, 'p17', 'miso', 'Look at that face 🥹', 15, now() - interval '2 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'miso' and text = 'Look at that face 🥹');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '82c72669-94b6-4dc8-a127-435874112880'::uuid, 'p17', 'toby', 'The cutest thing on Floof today', 22, now() - interval '3 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'toby' and text = 'The cutest thing on Floof today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '3fa7ef2c-5b53-4811-a2a5-c8c925624eeb'::uuid, 'p17', 'clover', 'Need this energy today', 29, now() - interval '4 hours'
where not exists (select 1 from public.comments where post_id = 'p17' and pet_id = 'clover' and text = 'Need this energy today');
insert into public.comments (id, post_id, pet_id, text, likes, created_at)
select '03d8a094-024d-4503-af7e-843a94c4f2fa'::uuid, 'p17', 'biscuit', 'So cute!! 😍', 36, now() - interval '5 hours'
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
