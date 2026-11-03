-- Corrections issues de l'audit du 2 novembre 2026.
-- À appliquer AVANT de déployer le code qui l'accompagne (le code appelle
-- les fonctions classement, saisons, top_candidats et refresh_victoires).
-- Compatible avec le code actuellement en production.

-- ─── 1. Plus aucune écriture directe du navigateur dans paris / candidats ─────
-- Les paris passent obligatoirement par /api/paris (clé service), qui vérifie
-- le candidat sur Wikidata. Avant, n'importe quel joueur connecté pouvait créer
-- un faux candidat déjà « mort » et parier dessus.
drop policy if exists paris_insert on public.paris;
drop policy if exists candidats_insert on public.candidats;

-- ─── 2. Date de création des paris ─────────────────────────────────────────────
-- Ajoutée SANS valeur pour les paris existants (NULL = pari historique, toujours
-- valable). Seuls les nouveaux paris reçoivent now().
alter table public.paris add column if not exists created_at timestamptz;
alter table public.paris alter column created_at set default now();

create index if not exists paris_saison_idx on public.paris (saison);
create index if not exists paris_candidat_id_idx on public.paris (candidat_id);

-- ─── 3. Profils : un profil par joueur, pseudo unique et propre ───────────────
create unique index if not exists profiles_user_id_key on public.profiles (user_id);
create unique index if not exists profiles_display_name_key
  on public.profiles (lower(btrim(display_name)));
alter table public.profiles drop constraint if exists profiles_display_name_format;
alter table public.profiles add constraint profiles_display_name_format
  check (display_name is null
         or (char_length(btrim(display_name)) between 3 and 30 and display_name !~ '[<>]'))
  not valid;

-- Le pseudo choisi à l'inscription arrive dans les métadonnées du compte.
-- S'il est absent, invalide ou déjà pris, on crée un pseudo provisoire unique.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted   text := nullif(btrim(new.raw_user_meta_data->>'display_name'), '');
  fallback text := 'Joueur-' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if wanted is not null
     and char_length(wanted) between 3 and 30
     and wanted !~ '[<>]' then
    begin
      insert into public.profiles (user_id, display_name, alert_mes_candidats, alert_autres_candidats)
      values (new.id, wanted, true, true);
      return new;
    exception when unique_violation then
      null; -- pseudo pris entre-temps : on retombe sur le pseudo provisoire
    end;
  end if;

  insert into public.profiles (user_id, display_name, alert_mes_candidats, alert_autres_candidats)
  values (new.id, fallback, true, true)
  on conflict do nothing;
  return new;
end;
$$;

create or replace function public.check_limite_10_paris()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.paris
      where joueur = new.joueur and mort = false and saison = new.saison) >= 10 then
    raise exception 'Tu as déjà 10 paris actifs pour cette saison !';
  end if;
  return new;
end;
$$;

-- ─── 4. Classement calculé en base (une seule règle, pas de limite de lignes) ──
create or replace function public.points_pour_age(age int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when age is null then 0
    when age < 55 then 10
    when age < 65 then 9
    when age < 75 then 8
    when age < 80 then 7
    when age < 85 then 5
    when age < 90 then 3
    else 1
  end
$$;

-- Un pari rapporte des points si le candidat meurt pendant la saison du pari,
-- et si le pari a été posé avant le jour du décès (heure de Paris).
create or replace function public.classement(p_saison int)
returns table (
  user_id        uuid,
  display_name   text,
  total_points   int,
  paris_gagnants int,
  moyenne_age    numeric,
  rang           int,
  candidats      jsonb
)
language sql
stable
set search_path = public
as $$
  with participants as (
    select distinct p.joueur from public.paris p where p.saison = p_saison
  ),
  gagnants as (
    select p.joueur, c.id, c.nom, c.ddn, c.ddd, c.photo, c.wikidata_id, c.description,
           extract(year from age(c.ddd, c.ddn))::int as age_deces
    from public.paris p
    join public.candidats c on c.id = p.candidat_id
    where p.saison = p_saison
      and c.ddd is not null
      and extract(year from c.ddd)::int = p_saison
      and (p.created_at is null
           or (p.created_at at time zone 'Europe/Paris')::date < c.ddd)
  ),
  scores as (
    select pa.joueur,
           coalesce(sum(public.points_pour_age(g.age_deces)), 0)::int as pts,
           count(g.id)::int as wins,
           coalesce(avg(g.age_deces), 0) as moy,
           coalesce(
             jsonb_agg(jsonb_build_object(
               'id', g.id, 'nom', g.nom, 'ddn', g.ddn, 'ddd', g.ddd, 'photo', g.photo,
               'wikidata_id', g.wikidata_id, 'description', g.description
             ) order by g.ddd) filter (where g.id is not null),
             '[]'::jsonb) as cands
    from participants pa
    left join gagnants g on g.joueur = pa.joueur
    group by pa.joueur
  )
  select s.joueur,
         coalesce(pr.display_name, 'Joueur inconnu'),
         s.pts,
         s.wins,
         round(s.moy, 2),
         (rank() over (order by s.pts desc, s.wins desc, s.moy asc))::int,
         s.cands
  from scores s
  join public.profiles pr on pr.user_id = s.joueur
  order by 6, 2
$$;

create or replace function public.saisons()
returns setof int
language sql
stable
set search_path = public
as $$
  select distinct saison from public.paris order by 1 desc
$$;

create or replace function public.top_candidats(
  p_saison int default null, p_min_votes int default 1, p_limit int default 3)
returns table (candidat_id int, votes int)
language sql
stable
set search_path = public
as $$
  select p.candidat_id, count(*)::int
  from public.paris p
  where p_saison is null or p.saison = p_saison
  group by p.candidat_id
  having count(*) >= p_min_votes
  order by 2 desc, 1
  limit p_limit
$$;

-- Recalcule les rangs d'une saison en une seule transaction (appelé par le cron).
create or replace function public.refresh_victoires(p_saison int)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.victoires where saison = p_saison;
  insert into public.victoires (joueur_id, saison, rang)
  select c.user_id, p_saison, c.rang
  from public.classement(p_saison) c
  where c.paris_gagnants > 0;
end;
$$;

revoke execute on function public.refresh_victoires(int) from public, anon, authenticated;

-- Fonction de trigger : n'a pas à être appelable via l'API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
