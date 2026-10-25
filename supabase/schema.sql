create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  monthly_character_limit integer not null default 10000 check (monthly_character_limit >= 0),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voices (
  id text primary key,
  name text not null,
  language text not null,
  accent text,
  gender text,
  provider_voice_id text,
  is_public boolean not null default true,
  owner_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  voice_id text references public.voices (id) on delete set null,
  text_snippet text not null,
  character_count integer not null check (character_count between 1 and 5000),
  audio_path text,
  created_at timestamptz not null default now()
);

create index if not exists generation_history_user_created_idx
  on public.generation_history (user_id, created_at desc);
create index if not exists voices_owner_idx on public.voices (owner_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.voices enable row level security;
alter table public.generation_history enable row level security;

create policy "Users read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users read public and owned voices" on public.voices
  for select to authenticated using (is_public or owner_id = (select auth.uid()));
create policy "Users create owned voices" on public.voices
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Users delete owned voices" on public.voices
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "Users read own history" on public.generation_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own history" on public.generation_history
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete own history" on public.generation_history
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select on public.voices to anon, authenticated;
grant insert, delete on public.voices to authenticated;
grant select, insert, delete on public.generation_history to authenticated;
revoke update on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (plan, monthly_character_limit, stripe_customer_id, updated_at) on public.profiles to service_role;

insert into public.voices (id, name, language, accent, gender, is_public) values
  ('arabic-saudi-male', 'راشد', 'ar', 'Saudi', 'male', true),
  ('arabic-egyptian-female', 'ليلى', 'ar', 'Egyptian', 'female', true),
  ('arabic-modern-female', 'نور', 'ar', 'Modern Standard Arabic', 'female', true),
  ('english-british-male', 'Oliver', 'en', 'British', 'male', true),
  ('english-american-female', 'Maya', 'en', 'American', 'female', true)
on conflict (id) do nothing;

create table if not exists public.floosak_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  token text not null,
  source_wallets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.floosak_credentials enable row level security;
revoke all on public.floosak_credentials from anon, authenticated;
grant all on public.floosak_credentials to service_role;

create table if not exists public.floosak_purchases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  provider_purchase_id bigint not null unique,
  target_phone text not null,
  amount numeric(12, 2) not null check (amount > 0),
  purpose text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floosak_purchases_owner_created_idx
  on public.floosak_purchases (owner_id, created_at desc);

alter table public.floosak_purchases enable row level security;
revoke all on public.floosak_purchases from anon, authenticated;
grant all on public.floosak_purchases to service_role;
