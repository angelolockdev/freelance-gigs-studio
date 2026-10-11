# Plan d'Implémentation : Freelance Gigs Studio (ComeUp & Fiverr)

**Date :** 09 Octobre 2026  
**Document de conception associé :** [docs/freelance-gigs-studio-design.md](file:///d:/works/antigravity/projects/angelo-lock-to-hang-resume/docs/freelance-gigs-studio-design.md)  
**Objectif :** Développer et déployer l'écosystème local Freelance Gigs Studio (Catalogue de fiches, Générateur de miniatures, Injection navigateur CDP, Radar de veille `ai-dev-jobs-mcp`, et Dashboard local).

---

## Architecture des Tâches & Dépendances

```mermaid
flowchart TD
    P1["Phase 1 : Données, Catalogue & Validateur"] --> P2["Phase 2 : Générateur Visuel de Miniatures"]
    P1 --> P3["Phase 3 : Module d'Injection Navigateur CDP"]
    P1 --> P4["Phase 4 : Radar de Veille Marché (ai-dev-jobs-mcp)"]
    P2 --> P5["Phase 5 : Dashboard Web Local & Lanceur Unifié"]
    P3 --> P5
    P4 --> P5
```

---

## Phase 1 : Données, Catalogue des Offres & Validation Canonique

- [x] **Tâche 1.1 : Structure des répertoires**
  - Créer `scripts/freelance-studio/data/gigs/`, `scripts/freelance-studio/core/`, `scripts/freelance-studio/dashboard/`.
  - Configurer `scripts/freelance-studio/package.json` avec les dépendances nécessaires (`express`, `playwright`, `cors`).

- [x] **Tâche 1.2 : Rédaction des Fiches Gigs Maîtresses (JSON)**
  - Créer `data/gigs/ai-rag-agent.json` :
    - Volet ComeUp (FR) : Titre "Je vais créer votre Agent IA sur-mesure et système RAG sécurisé", accroche, description HTML structurée, offre de base (25€), options Pro (150€) et Entreprise (390€), FAQ, garanties.
    - Volet Fiverr (EN) : Titre "I will build custom AI agents and secure RAG pipelines with MCP", tags, packages (Basic $45, Standard $180, Premium $450), description markdown, requirements.
  - Créer `data/gigs/laravel-fullstack.json` :
    - Volet ComeUp (FR) : Titre "Je vais développer ou optimiser votre application web Laravel et React", offre de base (35€), options Standard (180€) et Entreprise (480€), FAQ.
    - Volet Fiverr (EN) : Titre "I will build secure fullstack web apps with Laravel and React", packages ($50 / $190 / $520), description SEO, requirements.

- [x] **Tâche 1.3 : Validateur de Règles (`core/gig-validator.js`)**
  - Vérifier les contraintes de limites de caractères (Fiverr $\le$ 80c pour titre, $\le$ 1200c pour description, tags $\le$ 20c ; ComeUp débutant par "Je vais...").
  - Vérifier la présence de tous les livrables, bonus, et garanties définis dans le framework `offers`.

- [x] **Tâche 1.4 : Exporteur Markdown / HTML (`core/export-gigs.js`)**
  - Générer des fichiers exportés prêts à l'emploi dans `data/output/exports/` pour relecture ou copie manuelle instantanée en cas de besoin.

---

## Phase 2 : Moteur Visuel & Générateur de Miniatures (1280x769 px)

- [x] **Tâche 2.1 : Gabarit HTML5 / CSS Haute Conversion**
  - Créer un modèle HTML responsive au format $1280 \times 769\text{ px}$.
  - Intégrer :
    - Titre géant à fort contraste (3 à 5 mots clés).
    - Photo de profil détourée avec liséré (réutilisation des assets de `cv-template/assets/`).
    - Badges d'autorité ("6+ Ans d'Expérience", "Production Ready", "100% Testé").
    - Logos officiels vectoriels (Laravel, React, OpenAI, MCP, Python, Tailwind, Docker).

- [x] **Tâche 2.2 : Script de Rendu Automatique (`core/thumbnail-builder.js`)**
  - Utiliser Playwright en mode capture d'écran HD (`page.screenshot()`) pour compiler le template en images `PNG` et `WebP`.
  - Générer 2 déclinaisons graphiques par Gig (Mode Sombre Cyber/Tech vs Mode Bleu Corporate Pro).

- [x] **Tâche 2.3 : Vérification et Validation Visuelle**
  - Contrôler le rendu visuel et la netteté des miniatures générées dans `data/output/thumbnails/`.

---

## Phase 3 : Module d'Injection Navigateur Sécurisé (CDP)

- [x] **Tâche 3.1 : Cartographie des Sélecteurs (`core/selectors.json`)**
  - Définir les sélecteurs DOM pour ComeUp (`/dashboard/services/nouveau`) : champ titre, catégorie, description riche, prix de base, ajout d'options, upload de miniature.
  - Définir les sélecteurs DOM pour Fiverr (`/manage_gigs/new`) : gig title, category, search tags, scope & pricing (3 packages), description, requirements, gallery upload.

- [x] **Tâche 3.2 : Script de lancement Chrome Debug (`scripts/start-chrome-debug.bat`)**
  - Script simple lançant Chrome avec le port de débogage activé (`--remote-debugging-port=9222`) et profil isolé.

- [x] **Tâche 3.3 : Injecteur Playwright CDP (`core/browser-injector.js`)**
  - Raccordement sur `http://localhost:9222`.
  - Simulation de frappe naturelle avec délais progressifs.
  - Remplissage des champs textuels, sélection des catégories, renseignement des tableaux de prix.
  - Injection du fichier image de la miniature.
  - Clic automatique sur **"Enregistrer comme brouillon"** (arrêt strict avant publication finale).

---

## Phase 4 : Radar de Veille Marché (`ai-dev-jobs-mcp` & Flux)

- [x] **Tâche 4.1 : Client MCP Remote (`core/market-radar.js`)**
  - Interroger l'endpoint `https://aidevboard.com/mcp` (outils `search_jobs`, `get_stats`, `match_jobs`) via client HTTP/2 et JSON-RPC 2.0 avec décompression gzip automatique.
  - Normaliser les offres reçues sous un schéma unifié strict (`id`, `title`, `company`, `location`, `salary_or_rate`, `url`, `tags`, `source`, `summary`, `timestamp`, `matchScore`, `matchedSkills`).

- [x] **Tâche 4.2 : Système de Scoring & Déduplication**
  - Algorithme de correspondance pondéré (0-100%) aligné sur les compétences phares d'Angelo (PHP/Laravel 6+ ans, RAG, Agents IA, MCP, LangChain, React, SQL, Docker).
  - Modificateurs contextuels (bonus télétravail +10, bonus freelance/contrat +10, pénalité présentiel).
  - Filtrage anti-doublon glissant (`seen_ids`) et persistance dans `scripts/freelance-studio/data/radar_jobs.json`.

- [x] **Tâche 4.3 : Passerelle avec `upwork-sweeper` existant**
  - Lecteur passif `loadUpworkJobs()` intégrant `scripts/upwork-sweeper/jobs_log.json` et harmonisant les opportunités dans le flux unifié.

- [x] **Tâche 4.4 : Script NPM & Suite de Tests (`test/radar-test.js`)**
  - Ajout des scripts `"radar": "node core/market-radar.js"` et `"test:radar": "node test/radar-test.js"` dans `package.json`.
  - Suite de 20 tests automatisés avec 100% de réussite (70 tests cumulés sur tout le studio).

---

## Phase 5 : Dashboard Web Local & Lanceur Unifié

- [x] **Tâche 5.1 : Backend Express Local (`dashboard/server.js`)**
  - Exposer l'API REST locale :
    - `GET /api/status` : Statut général du système, port CDP 9222 et compteurs.
    - `GET /api/gigs` & `GET /api/gigs/:slug` : Catalogue et fiches détaillées.
    - `POST /api/gigs/:slug/validate` : Audit canonique en 1 clic.
    - `POST /api/gigs/:slug/export` : Exportation instantanée HTML & MD.
    - `POST /api/gigs/:slug/thumbnails` & `POST /api/thumbnails/generate` : Rendu des miniatures.
    - `POST /api/gigs/:slug/inject` : Injection CDP sécurisée (politique stricte brouillon).
    - `GET /api/radar/jobs` & `GET /api/jobs` : Opportunités captées par le radar.
    - `POST /api/radar/refresh` : Rafraîchissement MCP distant en temps réel.
    - `GET /api/strategy` : Value Equation Hormozi & Tarification asymétrique.

- [x] **Tâche 5.2 : Frontend Interactif (`dashboard/public/index.html`, `app.js`, `style.css`)**
  - Onglet **Gigs Studio** : Affichage bilingue FR/EN côte à côte, aperçu miniatures HD avec lightbox, bouton `⚡ Injecter Brouillon`, audit et export en 1 clic.
  - Onglet **Radar Opportunités** : Liste filtrable des opportunités tech/IA (MCP & Upwork), badges de matching colorés, liens vers les annonces.
  - Onglet **Offre & Psychologie** : Tableau récapitulatif des leviers de la Value Equation d'Alex Hormozi, structure tarifaire asymétrique, checklist de réassurance.

- [x] **Tâche 5.3 : Lanceurs Unifiés Windows**
  - `scripts/freelance-studio/open-studio.bat` : Lanceur rapide avec vérification du port 3840 et ouverture du navigateur.
  - `open-freelance-studio.bat` : Raccourci à la racine du workspace pour accès direct d'un double-clic.

- [x] **Tâche 5.4 : Suite de Tests du Dashboard (`test/dashboard-test.js`)**
  - 22 tests automatisés couvrant le cycle de vie serveur, les routes REST, les filtres, la livraison statique et l'arrêt propre (97 tests cumulés sur tout le studio).

