# Migrations de base de données

## Pourquoi ce dossier existe

Jusqu'au 14 juin 2026, le schéma était appliqué en production avec
`prisma db push`. Cette commande synchronise la base sur le schéma sans rien
enregistrer : **aucun historique, aucun retour arrière possible**. Une
modification malheureuse (colonne renommée, table supprimée) était donc
irréversible sur des données clients réelles.

Le dossier `0_init/` est la **ligne de base** : il décrit le schéma tel qu'il
existait au moment du basculement. Il a été marqué comme déjà appliqué
(`prisma migrate resolve --applied 0_init`) — aucun SQL n'a été exécuté sur
la base existante, on a seulement enregistré l'état de départ.

## Ce qu'il ne faut PLUS faire

```
npx prisma db push        # ← NE PLUS UTILISER en production
```

Cela contournerait l'historique et remettrait la base dans un état
non traçable.

## Procédure pour modifier le schéma

1. Modifier `prisma/schema.prisma`.

2. Créer la migration (en local, sur une base de développement) :
   ```
   npx prisma migrate dev --name description_courte
   ```
   Prisma génère le SQL dans un nouveau dossier horodaté et l'applique en
   local. **Relire le SQL généré** avant d'aller plus loin : c'est le moment
   de repérer une suppression de colonne involontaire.

3. Commiter le dossier de migration avec le code.

4. Appliquer en production :
   ```
   npx prisma migrate deploy
   ```
   Cette commande n'applique que les migrations manquantes et ne génère
   jamais de SQL — elle est sûre en production.

## Retour arrière

Prisma ne fait pas de rollback automatique. Deux filets :

- **Neon** conserve un historique permettant de restaurer la base à un
  instant précédent (« point-in-time restore »). C'est le recours en cas de
  migration destructrice — à vérifier/activer selon le plan souscrit.
- Pour annuler proprement un changement, écrire une **migration inverse**
  (ex. recréer la colonne supprimée) plutôt que de modifier l'historique.

## Attention aux migrations destructrices

Avant d'appliquer en production, se demander systématiquement :
- Cette migration supprime-t-elle une colonne ou une table contenant des
  données clients ?
- Un renommage est-il interprété par Prisma comme « supprimer + créer »
  (ce qui perd les données) ?

En cas de doute, procéder en deux temps : ajouter la nouvelle colonne,
migrer les données, puis supprimer l'ancienne dans une migration ultérieure.
