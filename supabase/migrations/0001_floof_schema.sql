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

-- Buy an item with wallet biscuits (p_from = 'wallet') or with biscuits fans sent (p_from = 'earnings').
-- Buying something you already own costs nothing. Returns what's left in the chosen balance.
drop function if exists public.buy_shop_item(text, text);
create or replace function public.buy_shop_item(p_pet text, p_item text, p_from text default 'wallet')
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
  if p_from not in ('wallet', 'earnings') then raise exception 'pay from wallet or earnings'; end if;
  -- the same locks send_biscuits and redeem_biscuits use, so balances can't go negative
  perform pg_advisory_xact_lock(hashtext('wallet:' || p_pet));
  perform pg_advisory_xact_lock(hashtext('earnings:' || p_pet));
  if exists (select 1 from public.shop_unlocks where pet_id = p_pet and item = p_item) then
    return 0;
  end if;
  if p_from = 'wallet' then
    bal := public.wallet_balance(p_pet);
    if bal < price then raise exception 'not enough biscuits'; end if;
    insert into public.biscuit_ledger (pet_id, kind, amount, note) values (p_pet, 'shop', price, 'Biscuit Shop: ' || p_item);
  else
    select p.biscuits_base + coalesce(sum(case when l.kind = 'received' then l.amount
                                               when l.kind = 'redeem' then -l.amount else 0 end), 0)
      into bal
    from public.pets p left join public.biscuit_ledger l on l.pet_id = p.id
    where p.id = p_pet group by p.biscuits_base;
    if bal < price then raise exception 'not enough earned biscuits'; end if;
    insert into public.biscuit_ledger (pet_id, kind, amount, note) values (p_pet, 'redeem', price, 'Biscuit Shop: ' || p_item);
  end if;
  insert into public.shop_unlocks (pet_id, item) values (p_pet, p_item);
  return bal - price;
end;
$$;
revoke all on function public.buy_shop_item(text, text, text) from public, anon;
grant execute on function public.buy_shop_item(text, text, text) to authenticated;

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
