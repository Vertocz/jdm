-- Départage du classement, dans l'ordre :
--   1. points (desc)
--   2. nombre de paris gagnants (desc)
--   3. moyenne d'âge au décès (asc)
--   4. âge exact (au jour près) du candidat gagnant le plus jeune, puis du
--      deuxième plus jeune, etc. (asc)
-- Si tout est identique, les joueurs sont ex æquo (même rang).
-- Le barème et la moyenne restent calculés en années révolues.

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
           extract(year from age(c.ddd, c.ddn))::int as age_deces,
           (c.ddd - c.ddn) as age_jours
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
           -- âges exacts (en jours) triés du plus jeune au plus vieux : la
           -- comparaison de deux tableaux se fait élément par élément
           coalesce(array_agg(g.age_jours order by g.age_jours) filter (where g.id is not null),
                    '{}'::int[]) as ages,
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
         (rank() over (order by s.pts desc, s.wins desc, s.moy asc, s.ages asc))::int,
         s.cands
  from scores s
  join public.profiles pr on pr.user_id = s.joueur
  order by 6, 2
$$;

-- Paris dont le candidat est mort pendant la saison mais restés « actifs »
-- (non traités par l'ancien cron) : on les marque, comme le fait le cron.
update public.paris p
set mort = true
from public.candidats c
where c.id = p.candidat_id
  and c.ddd is not null
  and extract(year from c.ddd)::int = p.saison
  and p.mort = false;

-- Recalcule les rangs de toutes les saisons avec la nouvelle règle.
select public.refresh_victoires(s) from public.saisons() s;
