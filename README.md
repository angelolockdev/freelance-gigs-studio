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
│   └── market-radar.js               # Radar de veille marché IA & freelancing (Phase 4)
├── dashboard/                        # Interface Web locale Express & Tailwind (Phase 5)
├── docs/                             # Spécifications et plans d'implémentation
│   ├── freelance-gigs-studio-design.md
│   └── 2026-10-09-freelance-gigs-studio-implementation.md
├── test/
│   └── validator-test.js             # Suite de tests automatisée (10 tests unitaires & de mutation)
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

### 3. Exécuter la suite de tests automatisée
Lance les 10 tests de conformité et de résistance aux mutations invalides :
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
