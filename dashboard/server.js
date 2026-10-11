/**
 * Freelance Gigs Studio - Backend Express Local
 * 
 * Serveur de pilotage local pour l'ingénierie des offres ComeUp & Fiverr,
 * l'audit canonique, l'exportation, la génération de miniatures,
 * l'injection sécurisée CDP (brouillon) et le radar de missions tech/IA.
 */

import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Core modules
import { validateGig, validateAllGigs } from '../core/gig-validator.js';
import { exportAllGigs, exportGig } from '../core/export-gigs.js';
import { buildThumbnails, GIG_THUMBNAIL_CONFIGS, OUTPUT_DIR as THUMBNAILS_OUTPUT_DIR } from '../core/thumbnail-builder.js';
import { injectGig, DEFAULT_CDP_URL, loadGig } from '../core/browser-injector.js';
import { collectMarketOpportunities, loadRadarJobs, RADAR_JOBS_FILE, SKILL_TAXONOMY, CONTEXT_MODIFIERS } from '../core/market-radar.js';

import { gigsRouter } from './routes/gigs.js';
import { jobsRouter } from './routes/jobs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins
export const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(__dirname, 'public');
export const GIGS_DIR = path.join(ROOT_DIR, 'data/gigs');
export const THUMBNAILS_DIR = path.join(ROOT_DIR, 'data/output/thumbnails');
export const EXPORTS_DIR = path.join(ROOT_DIR, 'data/output/exports');
export const ASSETS_DIR = path.join(ROOT_DIR, 'data/assets');

export const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3840;

/**
 * Diagnostic de connexion à Chrome CDP (port 9222) avec timeout non-bloquant
 */
export async function checkCdpStatus(cdpUrl = DEFAULT_CDP_URL, timeoutMs = 400) {
  let timer = null;
  try {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    const parsed = new URL(cdpUrl);
    const versionUrl = `${parsed.protocol}//${parsed.hostname}:${parsed.port || 9222}/json/version`;
    
    const res = await fetch(versionUrl, { signal: controller.signal });
    if (res.ok) {
      const data = await res.json();
      return {
        connected: true,
        port: parsed.port || 9222,
        url: cdpUrl,
        browser: data.Browser || 'Chrome',
        webSocketDebuggerUrl: data.webSocketDebuggerUrl,
        message: 'Chrome CDP actif et accessible pour injection directe.'
      };
    }
  } catch (_) {
    // Échec attendu si Chrome n'est pas lancé en mode debug
  } finally {
    if (timer) clearTimeout(timer);
  }
  return {
    connected: false,
    port: 9222,
    url: cdpUrl,
    message: "Chrome CDP non détecté (port 9222). Lancez 'start-chrome-debug.bat' ou utilisez le mode Dry-Run."
  };
}

/**
 * Scanne les miniatures associées à un slug sur le disque
 */
export function getThumbnailsForSlug(slug) {
  if (!slug || !fs.existsSync(THUMBNAILS_DIR)) return [];
  const files = fs.readdirSync(THUMBNAILS_DIR);
  const pattern = new RegExp(`^${slug}-(comeup|fiverr|master|dark-tech|navy-corporate)`);
  return files
    .filter(f => pattern.test(f) && (f.endsWith('.png') || f.endsWith('.webp')))
    .map(filename => ({
      filename,
      ext: path.extname(filename).replace('.', ''),
      isWebp: filename.endsWith('.webp'),
      url: `/thumbnails/${filename}`,
      sizeBytes: fs.statSync(path.join(THUMBNAILS_DIR, filename)).size
    }));
}

/**
 * Scanne les fichiers d'export associés à un slug sur le disque
 */
export function getExportsForSlug(slug) {
  if (!slug || !fs.existsSync(EXPORTS_DIR)) return [];
  const files = fs.readdirSync(EXPORTS_DIR);
  const pattern = new RegExp(`^${slug}-(comeup|fiverr)\\.(html|md)$`);
  return files
    .filter(f => pattern.test(f))
    .map(filename => ({
      filename,
      ext: path.extname(filename).replace('.', ''),
      url: `/exports/${filename}`,
      sizeBytes: fs.statSync(path.join(EXPORTS_DIR, filename)).size
    }));
}

/**
 * Création et configuration de l'application Express
 */
export function createApp() {
  const app = express();

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Headers de sécurité
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // Fichiers statiques
  app.use('/', express.static(PUBLIC_DIR));
  app.use('/thumbnails', express.static(THUMBNAILS_DIR));
  app.use('/data/output/thumbnails', express.static(THUMBNAILS_DIR));
  app.use('/exports', express.static(EXPORTS_DIR));
  app.use('/data/output/exports', express.static(EXPORTS_DIR));
  app.use('/assets', express.static(ASSETS_DIR));

  // ==========================================
  // API ROUTES
  // ==========================================

  // 1. GET /api/status : Statut général du système
  app.get('/api/status', async (req, res) => {
    try {
      const cdp = await checkCdpStatus();
      
      const gigsFiles = fs.existsSync(GIGS_DIR) 
        ? fs.readdirSync(GIGS_DIR).filter(f => f.endsWith('.json')) 
        : [];
      
      const thumbnailsFiles = fs.existsSync(THUMBNAILS_DIR)
        ? fs.readdirSync(THUMBNAILS_DIR).filter(f => f.endsWith('.png') || f.endsWith('.webp'))
        : [];

      const exportsFiles = fs.existsSync(EXPORTS_DIR)
        ? fs.readdirSync(EXPORTS_DIR)
        : [];

      let radarJobsCount = 0;
      if (fs.existsSync(RADAR_JOBS_FILE)) {
        try {
          const radarData = JSON.parse(fs.readFileSync(RADAR_JOBS_FILE, 'utf8'));
          radarJobsCount = Array.isArray(radarData.jobs) ? radarData.jobs.length : 0;
        } catch (_) {}
      }

      res.json({
        status: 'online',
        version: '1.0.0',
        author: 'Angelo Lock To Hang',
        uptimeSeconds: Math.floor(process.uptime()),
        cdp,
        counts: {
          gigs: gigsFiles.length,
          thumbnails: thumbnailsFiles.length,
          exports: exportsFiles.length,
          radarJobs: radarJobsCount
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Erreur lors de la récupération du statut', details: err.message });
    }
  });

  // 2. Routers modulaires
  app.use('/api/gigs', gigsRouter);
  app.use('/api/radar', jobsRouter);
  app.use('/api/jobs', jobsRouter);

  app.post('/api/thumbnails/generate', async (req, res) => {
    try {
      const { gigSlug = null, variant = null, platform = null } = req.body || {};
      const generated = await buildThumbnails({ gigSlug, variant, platform });
      res.json({ success: true, count: generated.length, generated });
    } catch (err) {
      res.status(500).json({ error: 'Erreur de génération des miniatures', details: err.message });
    }
  });

  // 10. GET /api/strategy : Matrice d'offre, Value Equation & Psychologie
  app.get('/api/strategy', (req, res) => {
    res.json({
      valueEquation: {
        framework: 'Alex Hormozi ($100M Offers)',
        formula: 'Valeur = (Résultat Rêvé × Certitude Perçue) / (Délai d\'Obtention × Effort & Sacrifice)',
        numerator: {
          dreamOutcome: {
            score: 'Maximal',
            description: 'Système IA ou application web en production, zéro bug critique, architecture pérenne et scalable.'
          },
          perceivedLikelihood: {
            score: 'Très Élevé',
            proofs: [
              '6+ années d\'expérience en développement web & ingénierie logicielle',
              'Démonstration vidéo Loom offerte avec explications d\'architecture',
              'Code couvert par des tests automatisés (100% test pass guarantee)',
              'Garantie satisfaction et support d\'intégration post-livraison'
            ]
          }
        },
        denominator: {
          timeDelay: {
            target: 'Compressé (24h à 4 jours selon formule)',
            mitigation: 'Pipelines pré-packagés, templates de code éprouvés et automatisation CI/CD.'
          },
          effortSacrifice: {
            target: 'Réduit à zéro pour le client',
            mitigation: 'Livraison clé en main, conteneurs Docker prêts à lancer, documentation OpenAPI / README pas-à-pas.'
          }
        }
      },
      pricingStrategy: {
        framework: 'Tarification Asymétrique & Ancrage Décoy (price-psychology-strategist)',
        rules: [
          'Bannissement formel des micro-services à 5 € dégradant la perception d\'expertise.',
          'Offre d\'amorçage Starter calibrée pour lever la friction du premier achat sans brader le TJM.',
          'Sweet-spot Standard calibré pour absorber 70% des conversions à haute marge.',
          'Option Entreprise / Premium servant d\'ancre haute psychologique et captant les budgets corporatifs.'
        ],
        tiers: {
          'ai-rag-agent': {
            name: 'Agents IA Autonomes & RAG Sécurisé (MCP)',
            comeup: {
              base: { price: '25 €', name: 'Audit de faisabilité & Spécification technique' },
              optionPro: { price: '+150 € (175 € total)', name: 'Pipeline RAG Complet Vectorisé (ChromaDB / Pinecone) [Sweet Spot]' },
              optionEnterprise: { price: '+390 € (415 € total)', name: 'Écosystème Multi-Agents + Serveur MCP Dédié' }
            },
            fiverr: {
              basic: { price: '$45', name: 'Starter Script & Connecteur API' },
              standard: { price: '$180', name: 'Full RAG Agent with Vector DB & Memory [Sweet Spot]' },
              premium: { price: '$450', name: 'Autonomous Multi-Agent System + React UI + MCP Server' }
            }
          },
          'laravel-fullstack': {
            name: 'Développement Web Fullstack & Maintenance Laravel / React',
            comeup: {
              base: { price: '35 €', name: 'Diagnostic & Correction d\'un Bug Critique' },
              optionStandard: { price: '+180 € (215 € total)', name: 'API REST Complète ou Module Web Métier [Sweet Spot]' },
              optionEnterprise: { price: '+480 € (515 € total)', name: 'Application Web Sur-Mesure Clé en Main' }
            },
            fiverr: {
              basic: { price: '$50', name: 'Bug Fix & Performance Optimization' },
              standard: { price: '$190', name: 'Custom RESTful API & Feature Development [Sweet Spot]' },
              premium: { price: '$520', name: 'Complete Fullstack Web Application (Laravel + React)' }
            }
          }
        }
      },
      skillsTaxonomy: SKILL_TAXONOMY.map(s => ({ id: s.id, label: s.label, weight: s.weight })),
      contextModifiers: Object.values(CONTEXT_MODIFIERS).map(m => ({ label: m.label, weight: m.weight }))
    });
  });

  // Fallback 404 pour l'API
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Route API introuvable : ${req.method} ${req.path}` });
  });

  // Fallback SPA pour les autres requêtes HTML
  app.get('*', (req, res) => {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Dashboard frontend public/index.html not found');
    }
  });

  return app;
}

/**
 * Démarre le serveur HTTP
 */
export function startServer(port = DEFAULT_PORT) {
  const app = createApp();
  const server = app.listen(port, () => {
    console.log('\n======================================================');
    console.log('       FREELANCE GIGS STUDIO - DASHBOARD LOCAL        ');
    console.log('======================================================');
    console.log(`🌐 Serveur Web : http://localhost:${port}`);
    console.log(`📡 API REST    : http://localhost:${port}/api/status`);
    console.log(`📁 Fiches Gigs : ${path.relative(ROOT_DIR, GIGS_DIR)}`);
    console.log(`🖼️ Miniatures  : http://localhost:${port}/thumbnails`);
    console.log(`📄 Exports     : http://localhost:${port}/exports`);
    console.log('------------------------------------------------------');
    console.log('⚡ Prêt pour audit, export, génération et injection.');
    console.log('======================================================\n');
  });

  return server;
}

// Lancement automatique si exécuté directement
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer(DEFAULT_PORT);
}
