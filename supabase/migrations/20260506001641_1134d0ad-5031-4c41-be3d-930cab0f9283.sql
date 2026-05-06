
-- Enums
create type public.med_frequency as enum ('daily','alternate','weekly','interval_hours','interval_days');
create type public.med_icon as enum ('pill','syrup','injection','capsule','drop');
create type public.med_status as enum ('active','paused','archived');
create type public.dose_status as enum ('taken','missed','pending','delayed');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- Medications
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text not null,
  category text,
  icon public.med_icon not null default 'pill',
  photo text,
  frequency public.med_frequency not null default 'daily',
  weekdays smallint[],
  interval_hours smallint,
  interval_days smallint,
  start_time text,
  times text[] not null default '{}',
  start_date date not null default current_date,
  duration_days int,
  stock int,
  low_stock_threshold int,
  status public.med_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.medications enable row level security;
create index medications_user_idx on public.medications(user_id);

create policy "meds select own" on public.medications for select using (auth.uid() = user_id);
create policy "meds insert own" on public.medications for insert with check (auth.uid() = user_id);
create policy "meds update own" on public.medications for update using (auth.uid() = user_id);
create policy "meds delete own" on public.medications for delete using (auth.uid() = user_id);

-- Adherence logs
create table public.adherence_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time text not null,
  taken_at timestamptz,
  status public.dose_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medication_id, scheduled_date, scheduled_time)
);
alter table public.adherence_logs enable row level security;
create index adherence_user_date_idx on public.adherence_logs(user_id, scheduled_date);

create policy "logs select own" on public.adherence_logs for select using (auth.uid() = user_id);
create policy "logs insert own" on public.adherence_logs for insert with check (auth.uid() = user_id);
create policy "logs update own" on public.adherence_logs for update using (auth.uid() = user_id);
create policy "logs delete own" on public.adherence_logs for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_meds_updated before update on public.medications for each row execute function public.set_updated_at();
create trigger trg_logs_updated before update on public.adherence_logs for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime
alter table public.medications replica identity full;
alter table public.adherence_logs replica identity full;
alter publication supabase_realtime add table public.medications;
alter publication supabase_realtime add table public.adherence_logs;
