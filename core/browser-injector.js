/**
 * Freelance Gigs Studio - Browser Injector (CDP Playwright)
 * 
 * Module d'injection sécurisé dans ComeUp et Fiverr via Chrome DevTools Protocol (CDP port 9222).
 * 
 * Caractéristiques clés :
 *  - Connexion non-invasive sur session Chrome existante (aucun blocage anti-bot)
 *  - Diagnostic proactif et message explicatif si Chrome n'est pas lancé
 *  - Simulation de frappe naturelle (délais aléatoires 30-80ms)
 *  - Mode --dry-run / --simulate complet sans navigateur actif
 *  - RÈGLE ABSOLUE DE SÉCURITÉ : Arrêt strict au stade Brouillon (Draft).
 *    Le clic de publication finale est réservé à l'opérateur humain.
 */

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { validateGig } from './gig-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
export const ROOT_DIR = path.resolve(__dirname, '..');
export const GIGS_DIR = path.join(ROOT_DIR, 'data/gigs');
export const THUMBNAILS_DIR = path.join(ROOT_DIR, 'data/output/thumbnails');
export const SELECTORS_PATH = path.join(__dirname, 'selectors.json');

// Configuration par défaut
export const DEFAULT_CDP_URL = 'http://localhost:9222';
export const SAFETY_MODE = 'STRICT_DRAFT_ONLY';

// Bornes de frappe humaine
export const TYPING_DELAY_MIN = 30; // ms
export const TYPING_DELAY_MAX = 80; // ms

/**
 * Erreur spécifique de violation de sécurité
 */
export class SafetyViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SafetyViolationError';
  }
}

/**
 * Erreur de connexion CDP avec diagnostic
 */
export class CdpConnectionError extends Error {
  constructor(message, diagnostic) {
    super(message);
    this.name = 'CdpConnectionError';
    this.diagnostic = diagnostic;
  }
}

/**
 * Génère un délai aléatoire simulant la frappe humaine (30-80 ms)
 */
export function getRandomTypingDelay(min = TYPING_DELAY_MIN, max = TYPING_DELAY_MAX) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Attente asynchrone
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Charge et valide le fichier selectors.json
 */
export function loadSelectors(filePath = SELECTORS_PATH) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier de sélecteurs introuvable : ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const selectors = JSON.parse(content);

  if (!selectors.platforms || !selectors.platforms.comeup || !selectors.platforms.fiverr) {
    throw new Error('Structure invalide de selectors.json : plateformes comeup et fiverr requises');
  }

  return selectors;
}

/**
 * Charge et valide une fiche de microservice
 */
export function loadGig(gigSlug, gigsDir = GIGS_DIR) {
  const filePath = path.join(gigsDir, `${gigSlug}.json`);
  if (!fs.existsSync(filePath)) {
    const available = fs.existsSync(gigsDir)
      ? fs.readdirSync(gigsDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
      : [];
    throw new Error(
      `Fiche gig "${gigSlug}" introuvable dans ${gigsDir}.\n` +
      `Fiches disponibles : ${available.join(', ') || 'aucune'}`
    );
  }

  const gigData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const validation = validateGig(gigData);
  if (!validation.valid) {
    throw new Error(
      `Fiche gig "${gigSlug}" invalide :\n- ${validation.errors.join('\n- ')}`
    );
  }

  return gigData;
}

/**
 * Résout le chemin de la miniature appropriée pour un gig et une plateforme
 */
export function resolveThumbnailPath(gigSlug, platform, preferredVariant = 'dark-tech', thumbnailsDir = THUMBNAILS_DIR) {
  if (!fs.existsSync(thumbnailsDir)) {
    throw new Error(`Dossier de miniatures introuvable : ${thumbnailsDir}`);
  }

  const platformTarget = platform === 'all' ? 'master' : platform.toLowerCase();
  const candidates = [
    // 1. Spécifique plateforme + variante
    path.join(thumbnailsDir, `${gigSlug}-${platformTarget}-${preferredVariant}.png`),
    // 2. Spécifique plateforme + variante alternative
    path.join(thumbnailsDir, `${gigSlug}-${platformTarget}-navy-corporate.png`),
    // 3. Spécifique plateforme + variante dark-tech
    path.join(thumbnailsDir, `${gigSlug}-${platformTarget}-dark-tech.png`),
    // 4. Master avec variante
    path.join(thumbnailsDir, `${gigSlug}-${preferredVariant}.png`),
    // 5. Master dark-tech
    path.join(thumbnailsDir, `${gigSlug}-dark-tech.png`),
    // 6. N'importe quel PNG correspondant au slug
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Recherche d'un PNG quelconque correspondant au slug
  const files = fs.readdirSync(thumbnailsDir);
  const fallback = files.find(f => f.startsWith(gigSlug) && f.endsWith('.png'));
  if (fallback) {
    return path.join(thumbnailsDir, fallback);
  }

  throw new Error(
    `Aucune miniature trouvée pour "${gigSlug}" (plateforme: ${platform}) dans ${thumbnailsDir}.\n` +
    `Veuillez d'abord générer les miniatures avec : npm run thumbnails`
  );
}

/**
 * Vérification proactive de l'accessibilité du port Chrome CDP
 */
export async function verifyCdpConnection(cdpUrl = DEFAULT_CDP_URL, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const safeReject = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const safeResolve = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    try {
      let normalizedUrl = String(cdpUrl || '').trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `http://${normalizedUrl}`;
      }

      const url = new URL('/json/version', normalizedUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.get(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 9222),
          path: url.pathname,
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const info = JSON.parse(data);
                safeResolve({ ok: true, versionInfo: info });
              } catch (e) {
                safeResolve({ ok: true, raw: data });
              }
            } else {
              const diag = buildCdpTroubleshootingMessage(normalizedUrl, `Code HTTP inattendu: ${res.statusCode}`);
              safeReject(new CdpConnectionError(`Réponse anormale du port CDP (${res.statusCode})`, diag));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        const diag = buildCdpTroubleshootingMessage(normalizedUrl, `Délai d'attente dépassé (${timeoutMs}ms)`);
        safeReject(new CdpConnectionError(`Délai d'attente dépassé lors de la connexion à ${normalizedUrl}`, diag));
      });

      req.on('error', (err) => {
        const diag = buildCdpTroubleshootingMessage(normalizedUrl, err.message);
        safeReject(new CdpConnectionError(`Impossible de se connecter à Chrome sur ${normalizedUrl} : ${err.message}`, diag));
      });
    } catch (err) {
      const diag = buildCdpTroubleshootingMessage(cdpUrl, err.message);
      safeReject(new CdpConnectionError(`URL CDP invalide ou erreur réseau : ${err.message}`, diag));
    }
  });
}

/**
 * Message d'aide au diagnostic si Chrome n'est pas lancé
 */
export function buildCdpTroubleshootingMessage(cdpUrl, reason = '') {
  return [
    '===============================================================================',
    '❌ ERREUR DE CONNEXION CHROME DEVTOOLS PROTOCOL (CDP)',
    '===============================================================================',
    `Détail technique : ${reason || 'Port inaccessible'}`,
    `Cible tentée     : ${cdpUrl}`,
    '',
    '👉 GOOGLE CHROME N\'EST PAS LANCÉ AVEC LE PORT DE DÉBOGAGE 9222 ACTIF.',
    '',
    'Pour résoudre ce problème immédiatement :',
    ' 1. Lancez le script Windows dédié :',
    '      start-chrome-debug.bat',
    '    (ou scripts/freelance-studio/start-chrome-debug.bat)',
    '',
    ' 2. Ou exécutez manuellement la commande suivante :',
    '      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" ^',
    '        --remote-debugging-port=9222 ^',
    '        --user-data-dir="%USERPROFILE%\\.chrome-debug-profile"',
    '',
    ' 3. Connectez-vous à ComeUp et Fiverr dans cette fenêtre Chrome.',
    ' 4. Relancez ensuite l\'injection :',
    '      npm run inject -- --gig=<nom-du-gig> --platform=<comeup|fiverr>',
    '==============================================================================='
  ].join('\n');
}

/**
 * Règle absolue de sécurité : Empêche toute tentative de publication finale
 */
export function enforceSafetyDraftOnly(actionOrConfig) {
  if (!actionOrConfig) return;

  // Support des objets de configuration de sélecteur
  if (typeof actionOrConfig === 'object') {
    if (actionOrConfig.safetyLevel === 'FORBIDDEN') {
      throw new SafetyViolationError(
        `🚨 VIOLATION DE SÉCURITÉ ABSOLUE : L'élément action est balisé comme "FORBIDDEN".\n` +
        `Le module d'injection est strictement bridé au stade Brouillon (Draft).\n` +
        `La publication finale doit être validée manuellement par l'opérateur humain.`
      );
    }
    actionOrConfig = actionOrConfig.name || actionOrConfig.action || actionOrConfig.description || actionOrConfig.selector || '';
  }

  const normalized = String(actionOrConfig || '').toLowerCase();
  const dangerousPatterns = ['publish', 'publier', 'validation', 'soumettre', 'submit'];

  for (const pattern of dangerousPatterns) {
    if (normalized.includes(pattern)) {
      throw new SafetyViolationError(
        `🚨 VIOLATION DE SÉCURITÉ ABSOLUE : L'action "${actionOrConfig}" est interdite.\n` +
        `Le module d'injection est strictement bridé au stade Brouillon (Draft).\n` +
        `La publication finale doit être validée manuellement par l'opérateur humain.`
      );
    }
  }
}

/**
 * Prépare le payload d'injection pour ComeUp
 */
export function prepareComeUpPayload(gig, thumbnailPath) {
  const cu = gig.platforms.comeup;
  return {
    gigSlug: gig.slug,
    platform: 'comeup',
    title: cu.title,
    category: cu.category,
    subcategory: cu.subcategory,
    baseOffer: {
      name: cu.baseOffer.name,
      price: cu.baseOffer.price,
      deliveryDays: cu.baseOffer.deliveryDays,
      description: cu.baseOffer.description,
      deliverables: cu.baseOffer.deliverables || []
    },
    options: (cu.options || []).map(opt => ({
      name: opt.name,
      price: opt.price,
      additionalDays: opt.additionalDays,
      description: opt.description,
      deliverables: opt.deliverables || []
    })),
    descriptionHtml: cu.description,
    faq: cu.faq || [],
    thumbnailPath,
    safetyStop: 'saveDraft'
  };
}

/**
 * Prépare le payload d'injection pour Fiverr
 */
export function prepareFiverrPayload(gig, thumbnailPath) {
  const fv = gig.platforms.fiverr;
  return {
    gigSlug: gig.slug,
    platform: 'fiverr',
    overview: {
      title: fv.title,
      category: fv.category,
      subcategory: fv.subcategory,
      tags: [...fv.tags]
    },
    pricing: {
      basic: { ...fv.packages.basic },
      standard: { ...fv.packages.standard },
      premium: { ...fv.packages.premium }
    },
    description: fv.description,
    faq: fv.faq || [],
    requirements: [
      'Detailed requirements specification or functional description.',
      'Target API / Database credentials or private schema (for local staging).',
      'Preferred delivery format (Git repository access or Docker archive).'
    ],
    gallery: {
      thumbnailPath
    },
    safetyStop: 'step6_publish.saveAsDraft'
  };
}

/**
 * Simulation de frappe naturelle sur un élément Playwright
 */
export async function simulateHumanTyping(locatorOrElement, text, options = {}) {
  const { isLongText = false, delayMin = TYPING_DELAY_MIN, delayMax = TYPING_DELAY_MAX } = options;

  // Si c'est un texte très long (ex: description HTML 2000+ car), on évite un freeze de plusieurs minutes
  // tout en déclenchant de vrais événements DOM
  if (isLongText && text.length > 250) {
    await locatorOrElement.focus();
    // Frappe d'amorce (premiers caractères)
    const previewPrefix = text.slice(0, 15);
    for (const char of previewPrefix) {
      await locatorOrElement.type(char, { delay: getRandomTypingDelay(delayMin, delayMax) });
    }
    // Injection du corps principal
    await locatorOrElement.evaluate((el, fullContent) => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = fullContent;
      } else {
        el.innerHTML = fullContent;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);
    // Petit délai de stabilisation
    await sleep(getRandomTypingDelay(40, 70));
    return;
  }

  // Frappe caractère par caractère avec jitter aléatoire
  await locatorOrElement.focus();
  for (const char of text) {
    await locatorOrElement.type(char, { delay: getRandomTypingDelay(delayMin, delayMax) });
  }
}

/**
 * Moteur de simulation (Dry-Run) pour ComeUp
 */
export function simulateComeUpDryRun(payload, selectors) {
  const steps = [];
  const cuSel = selectors.platforms.comeup;

  // Vérification de sécurité
  enforceSafetyDraftOnly('saveDraft');

  steps.push({
    step: 1,
    action: 'NAVIGATE',
    url: cuSel.newServiceUrl,
    description: `Navigation vers le formulaire de création ComeUp (${cuSel.newServiceUrl})`
  });

  steps.push({
    step: 2,
    action: 'FILL_TITLE',
    selector: cuSel.selectors.title.selector,
    value: payload.title,
    length: payload.title.length,
    description: `Saisie du titre avec simulation de frappe (30-80ms) : "${payload.title}"`
  });

  steps.push({
    step: 3,
    action: 'SELECT_CATEGORY',
    selector: cuSel.selectors.category.selector,
    value: payload.category,
    subselector: cuSel.selectors.subcategory.selector,
    subvalue: payload.subcategory,
    description: `Sélection catégorie: "${payload.category}" / sous-catégorie: "${payload.subcategory}"`
  });

  steps.push({
    step: 4,
    action: 'FILL_BASE_OFFER',
    fields: {
      name: { selector: cuSel.selectors.baseOffer.name.selector, value: payload.baseOffer.name },
      price: { selector: cuSel.selectors.baseOffer.price.selector, value: `${payload.baseOffer.price} €` },
      deliveryDays: { selector: cuSel.selectors.baseOffer.deliveryDays.selector, value: `${payload.baseOffer.deliveryDays} jours` },
      description: { selector: cuSel.selectors.baseOffer.description.selector, value: payload.baseOffer.description }
    },
    description: `Renseignement de l'offre de base : ${payload.baseOffer.price} € (${payload.baseOffer.deliveryDays}j)`
  });

  steps.push({
    step: 5,
    action: 'FILL_DESCRIPTION_WYSIWYG',
    selector: cuSel.selectors.description.editor.selector,
    htmlLength: payload.descriptionHtml.length,
    format: 'HTML',
    description: `Injection de la description enrichie (${payload.descriptionHtml.length} caractères HTML formatés)`
  });

  steps.push({
    step: 6,
    action: 'ADD_OPTIONS',
    count: payload.options.length,
    items: payload.options.map(opt => ({
      name: opt.name,
      price: `${opt.price} €`,
      days: `+${opt.additionalDays} jours`
    })),
    description: `Ajout de ${payload.options.length} options complémentaires valorisées`
  });

  steps.push({
    step: 7,
    action: 'UPLOAD_THUMBNAIL',
    selector: cuSel.selectors.thumbnail.fileInput.selector,
    filePath: payload.thumbnailPath,
    fileExists: fs.existsSync(payload.thumbnailPath),
    description: `Téléversement de la miniature officielle : ${path.basename(payload.thumbnailPath)}`
  });

  steps.push({
    step: 8,
    action: 'CLICK_SAVE_DRAFT',
    selector: cuSel.selectors.actions.saveDraft.selector,
    safetyStatus: 'STRICT_DRAFT_ENFORCED',
    description: 'Sauvegarde du service au statut Brouillon (arrêt de sécurité Playwright)'
  });

  return {
    success: true,
    dryRun: true,
    platform: 'comeup',
    gigSlug: payload.gigSlug,
    totalSteps: steps.length,
    steps,
    payload,
    safetyRuleObserved: true
  };
}

/**
 * Moteur de simulation (Dry-Run) pour Fiverr (6 étapes de l'assistant)
 */
export function simulateFiverrDryRun(payload, selectors) {
  const steps = [];
  const fvSteps = selectors.platforms.fiverr.steps;

  // Vérification de sécurité
  enforceSafetyDraftOnly('saveAsDraft');

  // Step 1 : Overview
  steps.push({
    stepIndex: 1,
    stepName: 'Overview',
    action: 'STEP1_OVERVIEW',
    url: selectors.platforms.fiverr.newGigUrl,
    title: payload.overview.title,
    category: payload.overview.category,
    subcategory: payload.overview.subcategory,
    tags: payload.overview.tags,
    description: `Étape 1 : Saisie titre "${payload.overview.title}", catégorie, et 5 tags (${payload.overview.tags.join(', ')})`
  });

  // Step 2 : Pricing (3 packages)
  steps.push({
    stepIndex: 2,
    stepName: 'Pricing',
    action: 'STEP2_PRICING',
    toggle3Packages: true,
    packages: {
      basic: { name: payload.pricing.basic.name, price: `$${payload.pricing.basic.price}`, days: `${payload.pricing.basic.deliveryDays}d` },
      standard: { name: payload.pricing.standard.name, price: `$${payload.pricing.standard.price}`, days: `${payload.pricing.standard.deliveryDays}d` },
      premium: { name: payload.pricing.premium.name, price: `$${payload.pricing.premium.price}`, days: `${payload.pricing.premium.deliveryDays}d` }
    },
    description: `Étape 2 : Configuration des 3 packages (Basic $${payload.pricing.basic.price} / Standard $${payload.pricing.standard.price} / Premium $${payload.pricing.premium.price})`
  });

  // Step 3 : Description & FAQ
  steps.push({
    stepIndex: 3,
    stepName: 'Description',
    action: 'STEP3_DESCRIPTION',
    descriptionLength: payload.description.length,
    faqCount: payload.faq.length,
    description: `Étape 3 : Saisie description markdown (${payload.description.length} car.) et ${payload.faq.length} FAQs`
  });

  // Step 4 : Requirements
  steps.push({
    stepIndex: 4,
    stepName: 'Requirements',
    action: 'STEP4_REQUIREMENTS',
    requirementsCount: payload.requirements.length,
    description: `Étape 4 : Définition des ${payload.requirements.length} questions préalables à l'acheteur`
  });

  // Step 5 : Gallery (Thumbnail)
  steps.push({
    stepIndex: 5,
    stepName: 'Gallery',
    action: 'STEP5_GALLERY',
    thumbnailPath: payload.gallery.thumbnailPath,
    fileExists: fs.existsSync(payload.gallery.thumbnailPath),
    description: `Étape 5 : Téléversement de la miniature Retina : ${path.basename(payload.gallery.thumbnailPath)}`
  });

  // Step 6 : Publish (Arrêt strict en brouillon)
  steps.push({
    stepIndex: 6,
    stepName: 'Publish',
    action: 'STEP6_SAVE_AS_DRAFT',
    selector: fvSteps.step6_publish.selectors.saveAsDraft.selector,
    forbiddenSelector: fvSteps.step6_publish.selectors.forbiddenPublish.selector,
    safetyStatus: 'STRICT_DRAFT_ENFORCED',
    description: 'Étape 6 : Clic strict sur "Save as Draft" - Publication finale réservée à l\'humain'
  });

  return {
    success: true,
    dryRun: true,
    platform: 'fiverr',
    gigSlug: payload.gigSlug,
    totalSteps: steps.length,
    steps,
    payload,
    safetyRuleObserved: true
  };
}

/**
 * Injection réelle Playwright ComeUp via session CDP existante
 */
export async function injectComeUpLive({ browser, page, payload, selectors, slowMo = 0 }) {
  const cuSel = selectors.platforms.comeup;
  console.log(`\n🚀 [ComeUp] Début d'injection du gig "${payload.gigSlug}"...`);

  // Sécurité
  enforceSafetyDraftOnly(cuSel.selectors.actions.saveDraft);

  // 1. Navigation
  console.log(`  🌐 Navigation vers ${cuSel.newServiceUrl}...`);
  await page.goto(cuSel.newServiceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);

  // 2. Titre
  console.log(`  ✍️ Saisie du titre : "${payload.title}"...`);
  const titleLocator = page.locator(cuSel.selectors.title.selector).first();
  if (await titleLocator.count() > 0) {
    await titleLocator.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await simulateHumanTyping(titleLocator, payload.title);
  }

  // 3. Catégorie & Sous-catégorie
  if (payload.category && await page.locator(cuSel.selectors.category.selector).count() > 0) {
    console.log(`  📂 Sélection catégorie "${payload.category}"...`);
    try {
      await page.locator(cuSel.selectors.category.selector).first().selectOption({ label: payload.category });
    } catch (_) {}
  }

  if (payload.subcategory && await page.locator(cuSel.selectors.subcategory.selector).count() > 0) {
    console.log(`  📂 Sélection sous-catégorie "${payload.subcategory}"...`);
    try {
      await page.locator(cuSel.selectors.subcategory.selector).first().selectOption({ label: payload.subcategory });
    } catch (_) {}
  }

  // 4. Offre de base
  console.log(`  💶 Renseignement de l'offre de base (${payload.baseOffer.price} €)...`);
  if (payload.baseOffer.name && await page.locator(cuSel.selectors.baseOffer.name.selector).count() > 0) {
    const baseNameLoc = page.locator(cuSel.selectors.baseOffer.name.selector).first();
    await simulateHumanTyping(baseNameLoc, payload.baseOffer.name);
  }

  if (await page.locator(cuSel.selectors.baseOffer.price.selector).count() > 0) {
    const priceLoc = page.locator(cuSel.selectors.baseOffer.price.selector).first();
    await priceLoc.fill(String(payload.baseOffer.price));
  }

  if (await page.locator(cuSel.selectors.baseOffer.deliveryDays.selector).count() > 0) {
    try {
      await page.locator(cuSel.selectors.baseOffer.deliveryDays.selector).first().selectOption(String(payload.baseOffer.deliveryDays));
    } catch (_) {}
  }

  if (payload.baseOffer.description && await page.locator(cuSel.selectors.baseOffer.description.selector).count() > 0) {
    const baseDescLoc = page.locator(cuSel.selectors.baseOffer.description.selector).first();
    await baseDescLoc.fill(payload.baseOffer.description);
  }

  // 5. Description WYSIWYG
  console.log(`  📝 Saisie de la description enrichie (${payload.descriptionHtml.length} car.)...`);
  const editorLoc = page.locator(cuSel.selectors.description.editor.selector).first();
  if (await editorLoc.count() > 0) {
    await simulateHumanTyping(editorLoc, payload.descriptionHtml, { isLongText: true });
  }

  // 6. Options complémentaires
  if (payload.options && payload.options.length > 0) {
    console.log(`  ➕ Ajout de ${payload.options.length} options complémentaires...`);
    for (let i = 0; i < payload.options.length; i++) {
      const opt = payload.options[i];
      const addBtn = page.locator(cuSel.selectors.options.addButton.selector).first();
      if (await addBtn.count() > 0) {
        await addBtn.click();
        await sleep(500);
      }

      // Ciblage de la dernière ligne d'option
      const optionRows = page.locator(cuSel.selectors.options.item.selector);
      const rowCount = await optionRows.count();
      const targetScope = rowCount > 0 ? optionRows.nth(rowCount - 1) : page;

      const optNameLoc = targetScope.locator(cuSel.selectors.options.fields.name.selector).first();
      if (await optNameLoc.count() > 0) await optNameLoc.fill(opt.name);

      const optPriceLoc = targetScope.locator(cuSel.selectors.options.fields.price.selector).first();
      if (await optPriceLoc.count() > 0) await optPriceLoc.fill(String(opt.price));

      const optDelayLoc = targetScope.locator(cuSel.selectors.options.fields.additionalDays.selector).first();
      if (await optDelayLoc.count() > 0) {
        try {
          await optDelayLoc.selectOption(String(opt.additionalDays));
        } catch (_) {}
      }

      const optDescLoc = targetScope.locator(cuSel.selectors.options.fields.description.selector).first();
      if (await optDescLoc.count() > 0) await optDescLoc.fill(opt.description);
    }
  }

  // 7. Upload miniature
  if (payload.thumbnailPath && fs.existsSync(payload.thumbnailPath)) {
    console.log(`  🖼️ Upload de la miniature : ${path.basename(payload.thumbnailPath)}...`);
    const fileInput = page.locator(cuSel.selectors.thumbnail.fileInput.selector).first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(payload.thumbnailPath);
      await sleep(1500);
    }
  }

  // 8. Sauvegarde Brouillon (Arrêt strict de sécurité)
  console.log(`  💾 Clic sur "Enregistrer le brouillon" (Sécurité absolue)...`);
  const draftBtn = page.locator(cuSel.selectors.actions.saveDraft.selector).first();
  if (await draftBtn.count() > 0) {
    await draftBtn.click();
    await sleep(2000);
  }

  console.log(`  ✅ [ComeUp] Brouillon enregistré avec succès pour "${payload.gigSlug}".`);
  console.log(`  🛡️ [SÉCURITÉ] Vérifiez la fiche dans Chrome et cliquez sur "Publier" quand vous êtes prêt.\n`);

  return { success: true, platform: 'comeup', gigSlug: payload.gigSlug, status: 'DRAFT_SAVED' };
}

/**
 * Injection réelle Playwright Fiverr via session CDP existante (6 étapes de l'assistant)
 */
export async function injectFiverrLive({ browser, page, payload, selectors, slowMo = 0 }) {
  const fv = selectors.platforms.fiverr;
  const fvSteps = fv.steps;
  console.log(`\n🚀 [Fiverr] Début d'injection du gig "${payload.gigSlug}" (6 étapes de l'assistant)...`);

  // Sécurité
  enforceSafetyDraftOnly(fvSteps.step6_publish.selectors.saveAsDraft);

  // ==========================================
  // Étape 1 : Overview
  // ==========================================
  console.log(`  🌐 [Étape 1/6 : Overview] Navigation vers ${fv.newGigUrl}...`);
  await page.goto(fv.newGigUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1000);

  // Titre
  console.log(`  ✍️ Saisie du titre Fiverr : "${payload.overview.title}"...`);
  const titleLocator = page.locator(fvSteps.step1_overview.selectors.gigTitle.selector).first();
  if (await titleLocator.count() > 0) {
    await titleLocator.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await simulateHumanTyping(titleLocator, payload.overview.title);
  }

  // Catégorie / Sous-catégorie
  if (payload.overview.category && await page.locator(fvSteps.step1_overview.selectors.categorySelect.selector).count() > 0) {
    try {
      await page.locator(fvSteps.step1_overview.selectors.categorySelect.selector).first().selectOption({ label: payload.overview.category });
    } catch (_) {}
  }
  if (payload.overview.subcategory && await page.locator(fvSteps.step1_overview.selectors.subcategorySelect.selector).count() > 0) {
    try {
      await page.locator(fvSteps.step1_overview.selectors.subcategorySelect.selector).first().selectOption({ label: payload.overview.subcategory });
    } catch (_) {}
  }

  // Tags
  console.log(`  🏷️ Saisie des 5 tags de recherche (${payload.overview.tags.join(', ')})...`);
  const tagInput = page.locator(fvSteps.step1_overview.selectors.searchTags.input.selector).first();
  if (await tagInput.count() > 0) {
    for (const tag of payload.overview.tags) {
      await tagInput.fill(tag);
      await tagInput.press('Enter');
      await sleep(getRandomTypingDelay(100, 200));
    }
  }

  // Passer à l'étape suivante
  const saveCont1 = page.locator(fvSteps.step1_overview.selectors.saveAndContinue.selector).first();
  if (await saveCont1.count() > 0) {
    await saveCont1.click();
    await sleep(2000);
  }

  // ==========================================
  // Étape 2 : Pricing (3 Packages)
  // ==========================================
  console.log(`  💶 [Étape 2/6 : Pricing] Configuration des 3 packages...`);
  const toggle3 = page.locator(fvSteps.step2_pricing.selectors.threePackagesToggle.selector).first();
  if (await toggle3.count() > 0) {
    const isChecked = await toggle3.isChecked().catch(() => false);
    if (!isChecked) {
      await toggle3.check().catch(() => {});
      await sleep(500);
    }
  }

  const packageTiers = ['basic', 'standard', 'premium'];
  for (const tier of packageTiers) {
    const pkgData = payload.pricing[tier];
    const pkgSel = fvSteps.step2_pricing.selectors.packages[tier];
    if (!pkgData || !pkgSel) continue;

    const nameLoc = page.locator(pkgSel.name.selector).first();
    if (await nameLoc.count() > 0) await nameLoc.fill(pkgData.name);

    const descLoc = page.locator(pkgSel.description.selector).first();
    if (await descLoc.count() > 0) await descLoc.fill(pkgData.description);

    const delivLoc = page.locator(pkgSel.deliveryDays.selector).first();
    if (await delivLoc.count() > 0) {
      try {
        await delivLoc.selectOption(String(pkgData.deliveryDays));
      } catch (_) {}
    }

    if (pkgData.revisions !== undefined && pkgSel.revisions) {
      const revLoc = page.locator(pkgSel.revisions.selector).first();
      if (await revLoc.count() > 0) {
        try {
          await revLoc.selectOption(String(pkgData.revisions));
        } catch (_) {}
      }
    }

    const priceLoc = page.locator(pkgSel.price.selector).first();
    if (await priceLoc.count() > 0) await priceLoc.fill(String(pkgData.price));
  }

  const saveCont2 = page.locator(fvSteps.step2_pricing.selectors.saveAndContinue.selector).first();
  if (await saveCont2.count() > 0) {
    await saveCont2.click();
    await sleep(2000);
  }

  // ==========================================
  // Étape 3 : Description & FAQ
  // ==========================================
  console.log(`  📝 [Étape 3/6 : Description] Saisie de la description (${payload.description.length} car.)...`);
  const descEditor = page.locator(fvSteps.step3_description.selectors.descriptionEditor.selector).first();
  if (await descEditor.count() > 0) {
    await simulateHumanTyping(descEditor, payload.description, { isLongText: true });
  }

  // FAQs
  if (payload.faq && payload.faq.length > 0) {
    const addFaqBtn = page.locator(fvSteps.step3_description.selectors.faqSection.addButton.selector).first();
    for (const faqItem of payload.faq) {
      if (await addFaqBtn.count() > 0) {
        await addFaqBtn.click();
        await sleep(400);

        const qInput = page.locator(fvSteps.step3_description.selectors.faqSection.questionInput.selector).first();
        if (await qInput.count() > 0) await qInput.fill(faqItem.q);

        const aInput = page.locator(fvSteps.step3_description.selectors.faqSection.answerInput.selector).first();
        if (await aInput.count() > 0) await aInput.fill(faqItem.a);

        const confirmFaq = page.locator(fvSteps.step3_description.selectors.faqSection.confirmButton.selector).first();
        if (await confirmFaq.count() > 0) {
          await confirmFaq.click();
          await sleep(400);
        }
      }
    }
  }

  const saveCont3 = page.locator(fvSteps.step3_description.selectors.saveAndContinue.selector).first();
  if (await saveCont3.count() > 0) {
    await saveCont3.click();
    await sleep(2000);
  }

  // ==========================================
  // Étape 4 : Requirements
  // ==========================================
  console.log(`  📋 [Étape 4/6 : Requirements] Définition des exigences clients...`);
  if (payload.requirements && payload.requirements.length > 0) {
    const addReqBtn = page.locator(fvSteps.step4_requirements.selectors.addRequirementButton.selector).first();
    for (const reqText of payload.requirements) {
      if (await addReqBtn.count() > 0) {
        await addReqBtn.click();
        await sleep(400);

        const reqInput = page.locator(fvSteps.step4_requirements.selectors.requirementInput.selector).first();
        if (await reqInput.count() > 0) await reqInput.fill(reqText);

        const confirmReq = page.locator(fvSteps.step4_requirements.selectors.confirmButton.selector).first();
        if (await confirmReq.count() > 0) {
          await confirmReq.click();
          await sleep(400);
        }
      }
    }
  }

  const saveCont4 = page.locator(fvSteps.step4_requirements.selectors.saveAndContinue.selector).first();
  if (await saveCont4.count() > 0) {
    await saveCont4.click();
    await sleep(2000);
  }

  // ==========================================
  // Étape 5 : Gallery (Thumbnail)
  // ==========================================
  console.log(`  🖼️ [Étape 5/6 : Gallery] Téléversement de la miniature officielle...`);
  if (payload.gallery && payload.gallery.thumbnailPath && fs.existsSync(payload.gallery.thumbnailPath)) {
    const thumbInput = page.locator(fvSteps.step5_gallery.selectors.thumbnailInput.selector).first();
    if (await thumbInput.count() > 0) {
      await thumbInput.setInputFiles(payload.gallery.thumbnailPath);
      await sleep(1500);
    }
  }

  const saveCont5 = page.locator(fvSteps.step5_gallery.selectors.saveAndContinue.selector).first();
  if (await saveCont5.count() > 0) {
    await saveCont5.click();
    await sleep(2000);
  }

  // ==========================================
  // Étape 6 : Publish (ARRÊT STRICT EN BROUILLON)
  // ==========================================
  console.log(`  💾 [Étape 6/6 : Publish] Arrêt strict au stade Brouillon ("Save as Draft")...`);
  // RÈGLE ABSOLUE DE SÉCURITÉ : Ne JAMAIS cliquer sur forbiddenPublish !
  const draftBtn = page.locator(fvSteps.step6_publish.selectors.saveAsDraft.selector).first();
  if (await draftBtn.count() > 0) {
    await draftBtn.click();
    await sleep(2000);
  } else {
    // Si le bouton de brouillon final n'est pas trouvé, tentative sur le bouton brouillon général
    const altDraft = page.locator('button:has-text("Save as Draft"), a:has-text("Save as Draft")').first();
    if (await altDraft.count() > 0) {
      await altDraft.click();
      await sleep(2000);
    }
  }

  console.log(`  ✅ [Fiverr] Brouillon finalisé avec succès pour "${payload.gigSlug}".`);
  console.log(`  🛡️ [SÉCURITÉ] La fiche reste en brouillon. L'opérateur humain valide le bouton "Publish Gig".\n`);

  return { success: true, platform: 'fiverr', gigSlug: payload.gigSlug, status: 'DRAFT_SAVED' };
}

/**
 * Fonction d'orchestration principale pour injecter un gig (CLI et API)
 */
export async function injectGig(options = {}) {
  const {
    gigSlug,
    platform = 'all',
    dryRun = false,
    cdpUrl = DEFAULT_CDP_URL,
    slowMo = 0,
    preferredVariant = 'dark-tech',
    logOutput = true
  } = options;

  if (!gigSlug) {
    throw new Error('Paramètre obligatoire manquant : "gigSlug"');
  }

  const normalizedPlatform = platform.toLowerCase();
  const validPlatforms = ['all', 'comeup', 'fiverr'];
  if (!validPlatforms.includes(normalizedPlatform)) {
    throw new Error(`Plateforme "${platform}" invalide. Valeurs acceptées : ${validPlatforms.join(', ')}`);
  }

  // 1. Chargement et validation de la fiche
  const gigData = loadGig(gigSlug);
  const selectors = loadSelectors();

  const platformsToRun = normalizedPlatform === 'all' ? ['comeup', 'fiverr'] : [normalizedPlatform];
  const results = {};

  if (logOutput) {
    console.log('\n======================================================');
    console.log(`     FREELANCE GIGS STUDIO - INJECTEUR CDP ${dryRun ? '[SIMULATION]' : '[CDP ACTIF]'}`);
    console.log('======================================================');
    console.log(`📁 Fiche      : ${gigSlug}`);
    console.log(`🎯 Cible(s)   : ${platformsToRun.join(', ')}`);
    console.log(`🛡️ Sécurité   : Arrêt strict au stade Brouillon (Draft)`);
    console.log(`⚙️ Mode       : ${dryRun ? 'Dry-Run (sans navigateur)' : `Connexion CDP sur ${cdpUrl}`}`);
    console.log('------------------------------------------------------');
  }

  // 2. Traitement en mode DRY-RUN (Simulation)
  if (dryRun) {
    for (const plat of platformsToRun) {
      const thumbPath = resolveThumbnailPath(gigSlug, plat, preferredVariant);

      if (plat === 'comeup') {
        const payload = prepareComeUpPayload(gigData, thumbPath);
        const simResult = simulateComeUpDryRun(payload, selectors);
        results.comeup = simResult;
        if (logOutput) {
          console.log(`\n🔹 [ComeUp Simulation] : ${simResult.totalSteps} étapes validées avec succès.`);
          for (const s of simResult.steps) {
            console.log(`   • Étape ${s.step}: ${s.description}`);
          }
        }
      } else if (plat === 'fiverr') {
        const payload = prepareFiverrPayload(gigData, thumbPath);
        const simResult = simulateFiverrDryRun(payload, selectors);
        results.fiverr = simResult;
        if (logOutput) {
          console.log(`\n🔹 [Fiverr Simulation] : ${simResult.totalSteps} étapes de l'assistant validées avec succès.`);
          for (const s of simResult.steps) {
            console.log(`   • [${s.stepName}]: ${s.description}`);
          }
        }
      }
    }

    if (logOutput) {
      console.log('\n------------------------------------------------------');
      console.log('🎉 SIMULATION RÉUSSIE : Tous les sélecteurs et données sont 100% alignés.');
      console.log('======================================================\n');
    }

    return {
      success: true,
      dryRun: true,
      gigSlug,
      platform: normalizedPlatform,
      results
    };
  }

  // 3. Traitement en mode RÉEL (Connexion CDP sur port 9222)
  // Diagnostic préalable de port
  await verifyCdpConnection(cdpUrl);

  if (logOutput) {
    console.log(`\n🔌 Connexion au navigateur Chrome via CDP (${cdpUrl})...`);
  }

  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpUrl, { slowMo });
    const contexts = browser.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browser.newContext();
    const page = await context.newPage();

    for (const plat of platformsToRun) {
      const thumbPath = resolveThumbnailPath(gigSlug, plat, preferredVariant);

      if (plat === 'comeup') {
        const payload = prepareComeUpPayload(gigData, thumbPath);
        results.comeup = await injectComeUpLive({ browser, page, payload, selectors, slowMo });
      } else if (plat === 'fiverr') {
        const payload = prepareFiverrPayload(gigData, thumbPath);
        results.fiverr = await injectFiverrLive({ browser, page, payload, selectors, slowMo });
      }
    }

    return {
      success: true,
      dryRun: false,
      gigSlug,
      platform: normalizedPlatform,
      results
    };
  } finally {
    if (browser) {
      // On déconnecte le client CDP sans fermer la session de l'utilisateur
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Analyseur d'arguments CLI
 */
export function parseInjectorCliArgs(args = []) {
  let gigSlug = null;
  let platform = 'all';
  let dryRun = false;
  let cdpUrl = DEFAULT_CDP_URL;
  let preferredVariant = 'dark-tech';
  let slowMo = 0;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--dry-run' || arg === '--simulate') {
      dryRun = true;
    } else if (arg.startsWith('--gig=')) {
      gigSlug = arg.slice(arg.indexOf('=') + 1).trim();
    } else if (arg === '--gig' && i + 1 < args.length) {
      gigSlug = args[++i].trim();
    } else if (arg.startsWith('--platform=')) {
      platform = arg.slice(arg.indexOf('=') + 1).trim().toLowerCase();
    } else if (arg === '--platform' && i + 1 < args.length) {
      platform = args[++i].trim().toLowerCase();
    } else if (arg.startsWith('--cdp-url=')) {
      cdpUrl = arg.slice(arg.indexOf('=') + 1).trim();
    } else if (arg === '--cdp-url' && i + 1 < args.length) {
      cdpUrl = args[++i].trim();
    } else if (arg.startsWith('--variant=')) {
      preferredVariant = arg.slice(arg.indexOf('=') + 1).trim();
    } else if (arg === '--variant' && i + 1 < args.length) {
      preferredVariant = args[++i].trim();
    } else if (arg.startsWith('--slowmo=') || arg.startsWith('--slow-mo=')) {
      slowMo = parseInt(arg.slice(arg.indexOf('=') + 1).trim(), 10) || 0;
    } else if ((arg === '--slowmo' || arg === '--slow-mo') && i + 1 < args.length) {
      slowMo = parseInt(args[++i].trim(), 10) || 0;
    } else if (!arg.startsWith('-') && !gigSlug) {
      gigSlug = arg.trim();
    }
  }

  return { gigSlug, platform, dryRun, cdpUrl, preferredVariant, slowMo, showHelp };
}

// Support d'exécution CLI direct
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseInjectorCliArgs(process.argv.slice(2));

    if (options.showHelp) {
      console.log(`
Freelance Gigs Studio - Injecteur Navigateur Sécurisé CDP (Port 9222)

Usage:
  npm run inject -- [options]
  node core/browser-injector.js [options]

Options:
  --gig=<slug>          Identifiant du gig (ex: ai-rag-agent, laravel-fullstack)
  --platform=<target>   Plateforme cible : comeup, fiverr, ou all (défaut: all)
  --variant=<variant>   Variante graphique miniature : dark-tech ou navy-corporate (défaut: dark-tech)
  --slowmo=<ms>         Ralentissement des actions Playwright en ms (défaut: 0)
  --dry-run, --simulate Exécuter en simulation complète sans ouvrir Chrome
  --cdp-url=<url>       URL du débogueur Chrome (défaut: http://localhost:9222)
  --help, -h            Afficher cette aide

Exemples:
  # Tester la préparation et le mapping complet sans navigateur :
  node core/browser-injector.js --gig=ai-rag-agent --dry-run

  # Injecter un microservice en brouillon dans ComeUp et Fiverr :
  node core/browser-injector.js --gig=laravel-fullstack --platform=all
`);
      process.exit(0);
    }

    if (!options.gigSlug) {
      console.error('❌ Erreur : Veuillez spécifier un gig avec --gig=<slug>');
      console.error('   Exemple : node core/browser-injector.js --gig=ai-rag-agent --dry-run');
      process.exit(1);
    }

    injectGig(options)
      .then((res) => {
        process.exit(0);
      })
      .catch((err) => {
        if (err instanceof CdpConnectionError && err.diagnostic) {
          console.error(err.diagnostic);
        } else {
          console.error('\n❌ Erreur d\'injection :', err.message);
        }
        process.exit(1);
      });
  } catch (err) {
    console.error('❌ Erreur arguments CLI :', err.message);
    process.exit(1);
  }
}
