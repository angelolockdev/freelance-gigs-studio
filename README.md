# 🚀 Freelance Gigs Studio (ComeUp & Fiverr)

**Studio d'ingénierie, d'optimisation et d'export de microservices à fort taux de conversion pour ComeUp et Fiverr.**

Conçu pour valoriser les 6+ années d'expérience d'Angelo Lock To Hang en ingénierie logicielle (IA, RAG, MCP, Laravel, React).

---

## 📁 Architecture du Projet

```
freelance-gigs-studio/
├── data/
│   ├── gigs/                         # Définitions maîtresses des microservices (JSON)
│   │   ├── ai-rag-agent.json         # Offre IA, RAG, MCP & LangChain (bilingue)
│   │   └── laravel-fullstack.json     # Offre Fullstack Laravel 11 & React (bilingue)
│   ├── assets/                       # Photos de profil, logos vectoriels et badges
│   └── output/
│       ├── exports/                  # Fiches prêtes au copier-coller (HTML ComeUp & MD Fiverr)
│       │   ├── INDEX.md              # Catalogue récapitulatif avec liens directs
│       │   ├── ai-rag-agent-comeup.html
│       │   ├── ai-rag-agent-comeup.md
│       │   ├── ai-rag-agent-fiverr.md
│       │   ├── laravel-fullstack-comeup.html
│       │   ├── laravel-fullstack-comeup.md
│       │   └── laravel-fullstack-fiverr.md
│       └── thumbnails/               # Miniatures générées (Phase 2 - 1280x769 px)
├── core/
│   ├── gig-validator.js              # Moteur de validation strict (limites de caractères, tags, etc.)
│   ├── export-gigs.js                # Compilateur d'exports formatés pour chaque plateforme
│   ├── thumbnail-builder.js          # Rendu Playwright HD des miniatures (Phase 2)
│   ├── browser-injector.js           # Injection navigateur sécurisée via CDP (Phase 3)
│   ├── selectors.json                # Cartographie des sélecteurs DOM ComeUp & Fiverr (Phase 3)
│   └── market-radar.js               # Radar de veille marché IA & freelancing (Phase 4)
├── dashboard/                        # Interface Web locale Express & Tailwind (Phase 5)
├── docs/                             # Spécifications et plans d'implémentation
│   ├── freelance-gigs-studio-design.md
│   └── 2026-10-09-freelance-gigs-studio-implementation.md
├── start-chrome-debug.bat            # Lanceur Chrome Windows avec port 9222 & profil persistant
├── test/
│   ├── validator-test.js             # Tests fiches & exports (20 tests)
│   ├── thumbnail-test.js             # Tests moteur visuel (10 tests)
│   └── injector-test.js              # Tests injecteur CDP & sélecteurs (14 tests)
└── package.json
```

---

## ⚡ Commandes Rapides

### 1. Valider toutes les fiches de microservices
Vérifie programmatiquement les limites strictes de Fiverr (titre $\le$ 80 car, description $\le$ 1200 car, exactement 5 tags, descriptions des packages $\le$ 100 car) et ComeUp (titre débutant par "Je vais...", balises HTML autorisées, cohérence des prix et options) :
```bash
npm run validate
```

### 2. Exporter les fiches prêtes à l'emploi
Génère les fichiers `.html` et `.md` prêts au copier-coller dans `data/output/exports/` :
```bash
npm run export
```

### 3. Générer les miniatures haute conversion (1280x769 px, Retina 2x)
Produit les miniatures aux formats `.png` et `.webp` pour chaque gig (déclinaisons A/B Dark Tech & Navy Corporate) :
```bash
npm run thumbnails
# Options CLI :
# npm run thumbnails -- --all
# npm run thumbnails -- --gig=ai-rag-agent
# npm run thumbnails -- --variant=dark-tech
# npm run thumbnails -- --platform=comeup
# node core/thumbnail-builder.js --help
```

### 4. Démarrer Chrome en mode Remote Debugging (Windows)
Lance Google Chrome avec le port 9222 et un profil persistant (connexion préalable aux comptes sans risque anti-bot) :
```cmd
start-chrome-debug.bat
# Ou sans pause interactive :
start-chrome-debug.bat --no-pause
```

### 5. Injecter un microservice en mode Brouillon (CDP Playwright)
Pré-remplit les formulaires et téléverse la miniature, avec **arrêt strict au stade brouillon** (publication manuelle par l'humain) :
```bash
# Tester la simulation sans ouvrir de navigateur (Dry-Run) :
npm run inject -- --gig=ai-rag-agent --dry-run
npm run inject -- --gig=laravel-fullstack --platform=all --dry-run

# Injection réelle sur session Chrome active (port 9222) :
npm run inject -- --gig=ai-rag-agent --platform=comeup
npm run inject -- --gig=laravel-fullstack --platform=all

# Options avancées :
npm run inject -- --gig=ai-rag-agent --variant=navy-corporate --slowmo=50
```

### 6. Explorer les opportunités du marché (Radar MCP & Upwork)
Scanne en direct le serveur MCP `aidevboard.com` et le flux Upwork avec algorithme de matching sur le profil d'Angelo :
```bash
npm run radar
npm run radar -- --query=agent --min-score=70
```

### 7. Lancer le Dashboard Web Local
Démarre le serveur Express et ouvre l'interface moderne de pilotage :
```bash
npm start
# ou
open-studio.bat
```
Raccourci disponible à la racine du workspace : double-cliquez sur `open-freelance-studio.bat`.

### 8. Exécuter la suite de tests automatisée complète (101 tests)
Valide l'ensemble de la chaîne (validateur, miniatures, injecteur CDP, radar MCP et dashboard Express) :
```bash
npm test
```

---

## 🎯 Piliers Stratégiques

1. **Value Equation (Alex Hormozi Framework) :**
   $$\text{Valeur} = \frac{\text{Résultat Rêvé} \times \text{Certitude}}{\text{Délai} \times \text{Effort client}}$$
2. **Psychologie Tarifaire 3 Paliers (`price-psychology-strategist`) :**
   - **Basic :** Ticket d'entrée clair (audit, PoC ou résolution de bug bloquant).
   - **Standard (Cible 70% des ventes) :** Solution de production complète (RAG complet ou API sécurisée).
   - **Premium (Ancrage haut) :** Écosystème clé en main complet avec interface et accompagnement.
3. **Bilinguisme Natif :**
   - **ComeUp (Français) :** Codes rédactionnels français, storytelling centré sur l'accompagnement et la confiance.
   - **Fiverr (Anglais) :** Mots-clés SEO internationaux, livrables concrets et concision technique.
