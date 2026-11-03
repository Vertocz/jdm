-- Schéma de la base tel qu'il existait en production avant le 3 novembre 2026
-- (reconstitué depuis le catalogue Postgres). Sert de point de départ pour
-- recréer une base de développement ; déjà présent en production.

create table if not exists public.candidats (
  id          serial primary key,
  nom         text not null,
  ddn         date not null,
  ddd         date,
  description text,
  photo       text,
  wikidata_id text not null unique
);
comment on column public.candidats.id is 'id du candidat dans la db';

create table if not exists public.paris (
  id          serial primary key,
  mort        boolean default false,
  candidat_id integer references public.candidats(id) on delete cascade,
  joueur      uuid references auth.users(id) on delete cascade,
  saison      integer not null,
  constraint unique_pari_joueur_candidat_saison unique (joueur, candidat_id, saison)
);
comment on column public.paris.joueur is 'id du joueur de l''authentication supabase';

create table if not exists public.cercles (
  id        serial primary key,
  ami_id    uuid references auth.users(id) on delete cascade,
  joueur_id uuid references auth.users(id) on delete cascade
);
create index if not exists cercles_ami_id_idx on public.cercles (ami_id);
create index if not exists cercles_joueur_id_idx on public.cercles (joueur_id);

create table if not exists public.profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete cascade,
  display_name           text,
  updated_at             timestamptz default now(),
  alert_mes_candidats    boolean default true,
  alert_autres_candidats boolean default true
);
create index if not exists profiles_user_id_idx on public.profiles (user_id);

create table if not exists public.victoires (
  id         bigint generated always as identity primary key,
  joueur_id  uuid not null references auth.users(id) on delete cascade,
  saison     integer not null,
  rang       integer not null,
  created_at timestamptz not null default now(),
  unique (joueur_id, saison)
);
create index if not exists victoires_joueur_rang on public.victoires (joueur_id, rang);
create index if not exists victoires_saison on public.victoires (saison);

-- RLS
alter table public.candidats enable row level security;
alter table public.paris     enable row level security;
alter table public.cercles   enable row level security;
alter table public.profiles  enable row level security;
alter table public.victoires enable row level security;

create policy candidats_select on public.candidats for select using (true);
create policy candidats_insert on public.candidats for insert to authenticated with check (true);
create policy paris_select on public.paris for select using (true);
create policy paris_insert on public.paris for insert with check (auth.uid() = joueur);
create policy cercles_select on public.cercles for select using (auth.uid() = joueur_id or auth.uid() = ami_id);
create policy cercles_insert on public.cercles for insert with check (auth.uid() = joueur_id);
create policy cercles_delete on public.cercles for delete using (auth.uid() = joueur_id);
create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (auth.uid() = user_id);
create policy profiles_update on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy victoires_select on public.victoires for select using (true);

-- Création du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id, display_name, alert_mes_candidats, alert_autres_candidats)
  values (new.id, 'Nouveau joueur', true, true);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 10 paris actifs maximum par saison
create or replace function public.check_limite_10_paris()
returns trigger language plpgsql as $$
begin
  if (select count(*) from paris where joueur = new.joueur and mort = false and saison = new.saison) >= 10 then
    raise exception 'Tu as déjà 10 paris actifs pour cette saison !';
  end if;
  return new;
end;
$$;
create trigger trigger_limite_10_paris before insert on public.paris
  for each row execute function public.check_limite_10_paris();
