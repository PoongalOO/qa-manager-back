# QA Manager Backend

Ce dépôt contient le backend Express de l'application **QA Manager**. Il expose l'API REST utilisée par le front-end QA Manager pour gérer les utilisateurs, les projets, les dossiers, les cas de test, les campagnes d'exécution, les membres, les tags, les commentaires et les pièces jointes.

Le service est une application Node.js en modules ES (`"type": "module"`) basée sur Express, Sequelize et SQLite.

## Rôle dans l'application QA Manager

Le backend fournit la couche API et persistance de QA Manager :

- authentification et gestion des utilisateurs ;
- gestion des rôles globaux et des permissions par projet ;
- création et administration des projets QA ;
- organisation des cas de test dans des dossiers ;
- gestion des étapes, tags et pièces jointes des cas de test ;
- création et suivi des runs/campagnes de test ;
- stockage des résultats d'exécution et commentaires ;
- endpoints de santé et données de synthèse pour les tableaux de bord.

Le front-end consomme cette API via le préfixe `/api` ou via l'URL configurée côté client.

## Stack technique

- Node.js
- Express 4
- Sequelize 6
- SQLite 3
- JWT (`jsonwebtoken`)
- `bcrypt` pour le hachage des mots de passe
- `multer` pour les uploads
- `cors` pour les accès front-end
- `express-rate-limit` pour limiter le volume de requêtes
- `papaparse`, `xlsx` et `xmlbuilder2` pour les imports/exports

## Structure du projet

```text
.
├── config/          # Configuration Sequelize, enums et helpers
├── middleware/      # Middlewares d'authentification et d'autorisation
├── migrations/      # Migrations Sequelize
├── models/          # Modèles Sequelize
├── public/          # Fichiers statiques et exemples
│   ├── sample/
│   └── uploads/     # Uploads locaux, non versionnés sauf placeholder
├── routes/          # Routes Express par domaine métier
├── seeders/         # Données initiales non sensibles
├── index.js         # Point d'entrée qui démarre le serveur
├── server.js        # Configuration de l'application Express
├── package.json
└── package-lock.json
```

## Domaines API principaux

L'application déclare les groupes de routes suivants :

| Préfixe | Rôle |
| --- | --- |
| `/` | endpoint racine de l'API |
| `/health` | vérification de santé |
| `/users` | inscription, connexion, profil, rôles, avatar, administration utilisateurs |
| `/projects` | projets QA |
| `/folders` | dossiers de cas de test |
| `/cases` | cas de test, import/export, clone, déplacement |
| `/steps` | étapes des cas de test |
| `/attachments` | upload, téléchargement et suppression de pièces jointes |
| `/runs` | campagnes/runs de test |
| `/runcases` | association et exécution des cas dans les runs |
| `/members` | membres et rôles de projet |
| `/tags` | tags de projet |
| `/casetags` | association tags/cas |
| `/comments` | commentaires d'exécution |
| `/home` | données de synthèse pour l'accueil/tableau de bord |

## Prérequis

- Node.js compatible avec les dépendances natives `bcrypt` et `sqlite3`.
- npm.
- Un environnement local autorisant la création du fichier SQLite dans `database/database.sqlite`.

## Installation

Installer les dépendances :

```bash
npm install
```

Si les dépendances natives ont été installées avec une autre version de Node.js ou sur une autre machine, reconstruire les bindings :

```bash
npm rebuild bcrypt
npm rebuild sqlite3
```

## Configuration

Le serveur lit les variables d'environnement suivantes :

| Variable | Défaut | Description |
| --- | --- | --- |
| `PORT` | `8001` | Port HTTP du backend |
| `FRONTEND_ORIGIN` | `http://localhost:8000` | Origine autorisée par CORS |
| `SECRET_KEY` | clé par défaut interne | Secret de signature des tokens JWT |

En production ou pour tout environnement partagé, définissez impérativement `SECRET_KEY` dans un fichier `.env` ou via l'environnement d'exécution.

Exemple `.env` local :

```dotenv
PORT=8001
FRONTEND_ORIGIN=http://localhost:4200
SECRET_KEY=change-me-with-a-long-random-secret
```

Le fichier `.env` est ignoré par Git et ne doit pas être commité.

## Base de données SQLite

Le backend utilise SQLite via Sequelize. Le fichier de base de données est attendu ici :

```text
database/database.sqlite
```

Ce fichier peut contenir des informations sensibles : comptes utilisateurs, mots de passe hashés, rôles, projets, cas de test, résultats, commentaires ou autres données métier. Il ne doit pas être diffusé ni commité.

Le `.gitignore` exclut donc :

```gitignore
database/*.sqlite
database/*.sqlite3
database/*.db
*.sqlite
*.sqlite3
*.db
```

Ce qui doit être versionné :

- le code source ;
- les modèles Sequelize ;
- les migrations ;
- les seeders non sensibles ;
- les fichiers de configuration sans secrets.

Ce qui ne doit pas être versionné :

- la base SQLite réelle ;
- les fichiers `.env` ;
- les uploads utilisateurs réels ;
- tout export contenant des données personnelles ou de production.

## Initialisation de la base

Créer ou mettre à jour le schéma avec les migrations :

```bash
npm run migrate
```

Charger les seeders si nécessaire :

```bash
npm run seed
```

Annuler toutes les migrations :

```bash
npm run drop
```

> Attention : `npm run drop` supprime le schéma géré par les migrations. À utiliser uniquement en développement ou sur une base jetable.

## Lancement

Démarrage en mode développement :

```bash
npm run dev
```

Démarrage avec chargement du fichier `.env` :

```bash
npm start
```

Par défaut, le backend écoute sur :

```text
http://localhost:8001
```

Si le front-end QA Manager est configuré pour appeler `http://localhost:8000` ou un proxy `/api` vers `localhost:8000`, définissez `PORT=8000` dans `.env` ou adaptez la configuration du proxy front-end.

## Vérification rapide

Une fois le serveur lancé :

```bash
curl http://localhost:8001/health
```

Réponse attendue :

```json
{"status":"ok"}
```

Endpoint racine :

```bash
curl http://localhost:8001/
```

Réponse attendue :

```text
This is UnitTCMS API server
```

## Scripts npm

| Commande | Description |
| --- | --- |
| `npm run dev` | lance le serveur avec `node index` |
| `npm start` | lance le serveur avec `node --env-file=.env index` |
| `npm run migrate` | applique les migrations Sequelize |
| `npm run seed` | exécute les seeders Sequelize |
| `npm run drop` | annule toutes les migrations |

## Sécurité et bonnes pratiques

- Ne jamais commiter `.env`.
- Ne jamais commiter `database/database.sqlite` ou toute autre base locale.
- Ne jamais commiter les uploads utilisateurs réels.
- Définir un `SECRET_KEY` robuste hors du dépôt.
- Restreindre `FRONTEND_ORIGIN` à l'origine réelle du front-end.
- Éviter d'utiliser des seeders contenant des données personnelles.
- Vérifier les dépendances avec `npm audit` avant une mise en production.

## Notes de développement

- `server.js` exporte l'application Express, ce qui facilite les tests des routes.
- `index.js` est uniquement responsable du démarrage HTTP.
- Les routes reçoivent l'instance Sequelize initialisée dans `server.js`.
- Les fichiers statiques sont servis depuis `public/`.
- Les uploads réels doivent rester locaux ou être externalisés vers un stockage adapté.
