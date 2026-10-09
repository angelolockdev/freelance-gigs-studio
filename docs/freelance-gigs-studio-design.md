# Spécification Technique & Design : Freelance Gigs Studio (ComeUp & Fiverr)

**Date :** 09 Octobre 2026  
**Auteur :** Angelo Lock To Hang & Assistant IA  
**Statut :** Validé (Brainstorming terminé)  
**Emplacement :** `docs/freelance-gigs-studio-design.md`

---

## 1. Synthèse de Cadrage (Understanding Summary)

* **Objectif :** Concevoir une boîte à outils locale et semi-automatisée (**Freelance Gigs Studio**) pour concevoir, optimiser (SEO & psychologie tarifaire) et déployer des microservices à fort taux de conversion sur **ComeUp** et **Fiverr**, tout en surveillant activement les opportunités de missions.
* **Positionnement des offres :**
  1. *Pôle IA Appliquée & Automatisation :* Intégration d'Agents IA autonomes, pipelines RAG sécurisés, serveurs/connecteurs MCP, flux n8n/Python.
  2. *Pôle Développement Web & Maintenance :* Applications web sur-mesure Laravel / React, conception d'APIs REST, refonte, optimisation et débogage d'architectures existantes.
* **Stratégie bilingue native :**
  - **ComeUp :** Rédigé en français, adapté aux codes et attentes de la clientèle francophone.
  - **Fiverr :** Rédigé en anglais, calibré pour le SEO et l'algorithme international.
* **Niveau d'automatisation :** Hybride (Kits de vente structurés + Générateur de miniatures haute conversion + Pré-remplissage sécurisé des formulaires en mode **brouillon** par navigateur via Chrome DevTools Protocol).
* **Non-Goals :** Aucun spam de prospection dans les messageries internes des plateformes ; aucune publication finale sans validation humaine directe.

---

## 2. Hypothèses et Gestion des Risques

| Risque identifié | Niveau | Stratégie de mitigation |
| :--- | :--- | :--- |
| **Bannissement anti-bot (Cloudflare, PerimeterX)** | Élevé si bot headless | Utilisation exclusive du **Chrome DevTools Protocol (CDP)** rattaché à la session active de l'utilisateur (port 9222). Aucun mot de passe manipulé, cookies réels. |
| **Effondrement du signal de qualité (Low-cost trap)** | Moyen | Tarification asymétrique respectant `price-psychology-strategist` : bannissement des prix à 5€ dégradants, ancrage haut et mise en valeur des 6+ années d'expérience. |
| **Rupture des sélecteurs DOM des plateformes** | Faible | Découplage strict des sélecteurs CSS dans un fichier de configuration isolé (`selectors.json`). |

---

## 3. Journal des Décisions (Decision Log)

| Décision | Choix retenu | Alternatives envisagées | Rationale |
| :--- | :--- | :--- | :--- |
| **Priorité n°1** | Création assistée de Gigs + Veille | Radar seul ou Publication 100% manuelle | Nécessité d'établir des vitrines de vente optimisées avant de capter du trafic. |
| **Architecture** | Hybride (CLI Node.js + Dashboard local Express) | CLI pure ou Serveur MCP isolé | Permet la prévisualisation visuelle des miniatures et des fiches avec déclenchement en un clic. |
| **Ingénierie de l'offre** | Value Equation (`offers`) + Paliers asymétriques | Prix fixes uniques ou alignement aveugle sur le bas du marché | Augmente la valeur moyenne par commande (AOV) et focalise 70% des conversions sur le palier Standard. |
| **Génération visuelle** | Moteur HTML/Tailwind piloté par Playwright/Canvas | Canva manuel ou API tierce payante | Autonomie totale, respect des dimensions 1280x769 px et génération instantanée des variantes A/B. |

---

## 4. Architecture Globale du Système

```
scripts/freelance-studio/
├── data/
│   ├── gigs/
│   │   ├── ai-rag-agent.json         # Spécification complète du service IA
│   │   └── laravel-fullstack.json     # Spécification complète du service Web
│   ├── assets/
│   │   ├── portrait.png              # Photo de profil détourée (Angelo)
│   │   └── tech-logos/               # Badges vectoriels (Laravel, React, MCP, OpenAI)
│   └── output/
│       ├── thumbnails/               # Miniatures générées (1280x769 px, PNG/WebP)
│       └── exports/                  # Fiches prêtes au copier-coller (Markdown/HTML)
├── core/
│   ├── gig-validator.js              # Vérification des limites (longueurs, balises, tags)
│   ├── thumbnail-builder.js          # Rendu automatisé des miniatures (Playwright screenshot)
│   ├── browser-injector.js           # Raccordement CDP (port 9222) et injection en brouillon
│   └── market-radar.js               # Collecteur d'opportunités (ai-dev-jobs-mcp + flux projets)
├── dashboard/
│   ├── server.js                     # Serveur Express local
│   ├── public/
│   │   ├── index.html                # Interface Web locale (Tailwind CSS)
│   │   ├── app.js                    # Logique UI (prévisualisation, déclenchement injection)
│   │   └── style.css
│   └── routes/
│       ├── gigs.js                   # API locale de gestion des fiches
│       └── jobs.js                   # API locale du radar de veille
└── open-studio.bat                   # Lanceur rapide sous Windows
```

---

## 5. Matrice Psychologique des Prix & Construction d'Offre

### 5.1. Équation de Valeur appliquée (Alex Hormozi Framework)
$$\text{Valeur} = \frac{\text{Résultat Rêvé (Production-ready, zéro bug)} \times \text{Certitude (Preuve 6+ ans, Démo Loom)}}{\text{Délai (2 à 4 jours)} \times \text{Effort Client (Livraison clé en main, guide de déploiement)}}$$

### 5.2. Paliers Tarifaires Types

#### Gig 1 : Systèmes RAG, Agents IA & Serveurs MCP
* **ComeUp (Français) :**
  - *Offre de base (25 €) :* Audit faisabilité + Cahier des charges technique ou script d'amorçage.
  - *Option Pro - RAG Standard (150 €) :* Pipeline RAG complet avec base vectorielle ChromaDB/Pinecone + connecteur API.
  - *Option Entreprise (390 €) :* Écosystème Agentique complet avec interface React + serveur MCP dédié.
* **Fiverr (Anglais) :**
  - *Basic - Starter Script ($45) :* Single LLM pipeline or custom prompt/tool connector (48h).
  - *Standard - Full RAG Agent ($180) :* Secure RAG system connected to your documents/APIs + memory + testing (4 days).
  - *Premium - Autonomous Agent Ecosystem ($450) :* End-to-end architecture (React UI + FastAPI/Laravel backend + MCP server + deployment guide) (7 days).

#### Gig 2 : Développement Web Fullstack & Maintenance Laravel / React
* **ComeUp (Français) :**
  - *Offre de base (35 €) :* Résolution d'un bug critique ou optimisation de performance SQL/Laravel.
  - *Option Standard (180 €) :* Création d'une API REST sécurisée ou intégration d'un module complet.
  - *Option Entreprise (480 €) :* Application web sur-mesure clé en main avec dashboard et authentification.
* **Fiverr (Anglais) :**
  - *Basic - Bug Fix & Optimization ($50) :* Rapid diagnostic and resolution of 1 critical issue (24-48h).
  - *Standard - Custom API & Features ($190) :* RESTful API, third-party webhook integration, or database refactoring (4 days).
  - *Premium - Complete Web Application ($520) :* Fullstack production-grade app (Laravel 11, React/Blade, Tailwind, Stripe/Auth) (7 days).

---

## 6. Protocole d'Injection Navigateur (CDP)

1. **Lancement de Chrome en mode Debug :**
   ```powershell
   & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebugProfile"
   ```
2. **Attachement Playwright :**
   ```javascript
   const browser = await chromium.connectOverCDP('http://localhost:9222');
   const context = browser.contexts()[0];
   const page = await context.newPage();
   ```
3. **Saisie & Upload de la miniature :**
   - Le script injecte les données validées dans les sélecteurs de ComeUp ou Fiverr.
   - Il upload le fichier `thumbnail.png` pré-généré.
   - Il clique sur **Enregistrer comme brouillon**.
4. **Validation par l'opérateur :** L'utilisateur visualise le brouillon et clique manuellement sur le bouton final de soumission.

---

## 7. Critères de Réussite & Handoff

* Les fiches de services respectent à 100% les limites de caractères et les exigences SEO de chaque plateforme.
* Les miniatures produites sont percutantes, au format 1280x769 px, et incorporent les badges de crédibilité.
* Le tableau de bord local permet de piloter l'ensemble du workflow sans friction technique.
