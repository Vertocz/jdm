# Le Jeu de la Mort

Chaque année, chaque joueur choisit jusqu'à 10 personnalités vivantes. Si l'une
d'elles meurt pendant la saison, le joueur marque des points : plus elle était
jeune, plus le pari rapporte. Site : [lejeudelamort.fr](https://lejeudelamort.fr).

Next.js 16 (App Router) · Supabase (Postgres + Auth) · Resend (emails) · Vercel (hébergement et crons) · Wikidata (données des candidats).

## Règles de score

| Âge au décès | Points |
| --- | --- |
| moins de 55 ans | 10 |
| 55 à 64 | 9 |
| 65 à 74 | 8 |
| 75 à 79 | 7 |
| 80 à 84 | 5 |
| 85 à 89 | 3 |
| 90 et plus | 1 |

Un pari rapporte des points si le candidat meurt pendant la saison du pari **et**
si le pari a été posé avant le jour du décès (heure de Paris).

Départage, dans l'ordre : nombre de paris gagnants, moyenne d'âge au décès la
plus basse, puis âge exact (au jour près) du candidat gagnant le plus jeune, du
deuxième plus jeune, etc. Si tout est identique, les joueurs sont ex æquo.

Ces règles existent à deux endroits, à modifier ensemble :
`lib/regles.ts` (pages joueur) et les fonctions SQL `points_pour_age` / `classement`
(classement, trophées, cron).

## Installation

```bash
npm ci
cp .env.example .env.local   # puis remplir les valeurs
npm run dev
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (navigateur) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé de service, côté serveur uniquement (routes API, crons) |
| `CRON_SECRET` | Protège les crons et `/api/admin/broadcast` (`Authorization: Bearer …`) |
| `RESEND_API_KEY` | Envoi des emails |
| `NEXT_PUBLIC_APP_URL` | URL publique du site (liens dans les emails), par défaut `https://lejeudelamort.fr` |
| `ADMIN_EMAIL` | Facultatif : reçoit un email quand le cron de décès rencontre une erreur |

## Base de données

Le schéma est versionné dans `supabase/migrations/`. Toute modification de la
base passe par un nouveau fichier de migration.

Principes de sécurité :

- le navigateur ne peut **écrire** que dans `profiles` (sa propre ligne) et `cercles` ;
- les paris passent par `POST /api/paris`, qui relit le candidat sur Wikidata
  (clé de service côté serveur) ;
- les décès, les rangs (`victoires`) et les photos sont mis à jour par les crons.

## Tâches planifiées (`vercel.json`, heures UTC)

| Route | Quand | Rôle |
| --- | --- | --- |
| `/api/cron/check-deaths` | tous les jours 23h59 | Détecte les décès sur Wikidata, met à jour paris et rangs, envoie les emails |
| `/api/cron/update-photos` | lundi 3h00 | Met à jour les photos depuis Wikidata |
| `/api/cron/keep-alive` | lundi 12h00 | Garde le projet Supabase actif |

Lancer un cron à la main :

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://lejeudelamort.fr/api/cron/check-deaths
```

## Vérifications

```bash
npm run typecheck
npm run lint
npm test
```
