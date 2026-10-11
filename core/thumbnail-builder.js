/**
 * Freelance Gigs Studio - Thumbnail Visual Builder
 * 
 * High-conversion thumbnail generator (1280x769 px) powered by Playwright.
 * Generates Retina (2x) PNG and WebP thumbnails with 2 A/B design variants:
 *  - Variant A: Dark Tech (Deep obsidian, neon cyan & purple, cyber grid)
 *  - Variant B: Navy Corporate (Midnight navy & pure white, executive CV theme)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
export const ROOT_DIR = path.resolve(__dirname, '..');
export const GIGS_DIR = path.join(ROOT_DIR, 'data/gigs');
export const ASSETS_DIR = path.join(ROOT_DIR, 'data/assets');
export const LOGOS_DIR = path.join(ASSETS_DIR, 'tech-logos');
export const OUTPUT_DIR = path.join(ROOT_DIR, 'data/output/thumbnails');
export const TEMPLATE_PATH = path.join(__dirname, 'templates/thumbnail-template.html');

// Thumbnail dimensions
export const THUMBNAIL_WIDTH = 1280;
export const THUMBNAIL_HEIGHT = 769;
export const DEVICE_SCALE_FACTOR = 2; // Retina sharpness

/**
 * Launch Chromium browser with resilient fallbacks
 */
export async function createBrowser() {
  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  };

  // 1. Try standard bundled playwright chromium
  try {
    return await chromium.launch(launchOptions);
  } catch (err1) {
    // 2. Fallback to system Google Chrome
    try {
      return await chromium.launch({ ...launchOptions, channel: 'chrome' });
    } catch (err2) {
      // 3. Fallback to system Microsoft Edge
      try {
        return await chromium.launch({ ...launchOptions, channel: 'msedge' });
      } catch (err3) {
        throw new Error(
          `Impossible d'initialiser Chromium pour la génération de miniatures :\n` +
          `- Bundled Chromium: ${err1.message}\n` +
          `- Google Chrome: ${err2.message}\n` +
          `- Microsoft Edge: ${err3.message}`
        );
      }
    }
  }
}

/**
 * Read asset as base64 data URI
 */
export function getAssetAsDataUri(filePath, mimeType = 'image/png') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Asset introuvable : ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Read SVG logo content
 */
export function getSvgContent(logoName) {
  const svgPath = path.join(LOGOS_DIR, `${logoName}.svg`);
  if (!fs.existsSync(svgPath)) {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>`;
  }
  return fs.readFileSync(svgPath, 'utf8').trim();
}

/**
 * High-conversion presets per gig and platform
 */
export const GIG_THUMBNAIL_CONFIGS = {
  'ai-rag-agent': {
    master: {
      categoryTag: '✨ IA & AUTOMATISATION',
      platformBadge: 'Senior Pro',
      titleLine1: 'AGENTS IA',
      titleLine2: '& RAG SÉCURISÉ',
      subtitle: 'Zéro Hallucination • Déploiement Docker • Serveurs MCP',
      badges: [
        { icon: '🏆', text: "6+ Ans d'Expérience" },
        { icon: '⚡', text: 'Production Ready' },
        { icon: '🛡️', text: 'Code Testé' },
        { icon: '🚀', text: 'RAG & MCP' }
      ],
      techStack: [
        { logo: 'python', label: 'Python 3.12' },
        { logo: 'openai', label: 'OpenAI / Claude' },
        { logo: 'mcp', label: 'MCP Server' },
        { logo: 'react', label: 'React UI' }
      ],
      authorRole: 'Ingénieur Senior IA & Fullstack',
      ratingTitle: '100% Satisfaction',
      ratingSubtitle: 'Code Garanti • Zéro Dette'
    },
    comeup: {
      categoryTag: '✨ IA & AUTOMATISATION',
      platformBadge: 'ComeUp Pro',
      titleLine1: 'AGENTS IA',
      titleLine2: '& RAG SÉCURISÉ',
      subtitle: 'Zéro Hallucination • Déploiement Docker • Serveurs MCP',
      badges: [
        { icon: '🏆', text: "6+ Ans d'Expérience" },
        { icon: '⚡', text: 'Production Ready' },
        { icon: '🛡️', text: 'Code Testé' },
        { icon: '🚀', text: 'RAG & MCP' }
      ],
      techStack: [
        { logo: 'python', label: 'Python 3.12' },
        { logo: 'openai', label: 'OpenAI / Claude' },
        { logo: 'mcp', label: 'MCP Server' },
        { logo: 'react', label: 'React UI' }
      ],
      authorRole: 'Ingénieur Senior IA & Fullstack',
      ratingTitle: '100% Satisfaction',
      ratingSubtitle: 'Code Garanti • Zéro Dette'
    },
    fiverr: {
      categoryTag: '✨ AI & AUTOMATION',
      platformBadge: 'Fiverr Verified',
      titleLine1: 'CUSTOM AI AGENTS',
      titleLine2: '& SECURE RAG',
      subtitle: 'Zero Hallucinations • Docker Deployed • MCP Protocol',
      badges: [
        { icon: '🏆', text: '6+ Years Experience' },
        { icon: '⚡', text: 'Production Ready' },
        { icon: '🛡️', text: 'Tested Code' },
        { icon: '🚀', text: 'RAG & MCP' }
      ],
      techStack: [
        { logo: 'python', label: 'Python 3.12' },
        { logo: 'openai', label: 'OpenAI / Claude' },
        { logo: 'mcp', label: 'MCP Server' },
        { logo: 'react', label: 'React UI' }
      ],
      authorRole: 'Senior AI & Software Engineer',
      ratingTitle: '100% Satisfaction',
      ratingSubtitle: 'Guaranteed Code • Zero Debt'
    }
  },
  'laravel-fullstack': {
    master: {
      categoryTag: '⚡ DÉVELOPPEMENT WEB SUR-MESURE',
      platformBadge: 'Senior Pro',
      titleLine1: 'DÉVELOPPEUR SENIOR',
      titleLine2: 'LARAVEL & REACT',
      subtitle: 'Applications Clé en Main • APIs Sécurisées • 0 Bug',
      badges: [
        { icon: '🏆', text: "6+ Ans d'Expérience" },
        { icon: '⚡', text: 'Production Ready' },
        { icon: '🛡️', text: 'Code Testé' },
        { icon: '🚀', text: 'Architecture Clean' }
      ],
      techStack: [
        { logo: 'laravel', label: 'Laravel 11' },
        { logo: 'react', label: 'React 19' },
        { logo: 'tailwind', label: 'Tailwind CSS' },
        { logo: 'docker', label: 'Docker Sail' }
      ],
      authorRole: 'Architecte Fullstack Senior',
      ratingTitle: '100% Satisfaction',
      ratingSubtitle: 'Code Garanti • Zéro Dette'
    },
    comeup: {
      categoryTag: '⚡ DÉVELOPPEMENT WEB SUR-MESURE',
      platformBadge: 'ComeUp Pro',
      titleLine1: 'DÉVELOPPEUR SENIOR',
      titleLine2: 'LARAVEL & REACT',
      subtitle: 'Applications Clé en Main • APIs Sécurisées • 0 Bug',
      badges: [
        { icon: '🏆', text: "6+ Ans d'Expérience" },
        { icon: '⚡', text: 'Production Ready' },
        { icon: '🛡️', text: 'Code Testé' },
        { icon: '🚀', text: 'Architecture Clean' }
      ],
      techStack: [
        { logo: 'laravel', label: 'Laravel 11' },
        { logo: 'react', label: 'React 19' },
        { logo: 'tailwind', label: 'Tailwind CSS' },
        { logo: 'docker', label: 'Docker Sail' }
      ],
      authorRole: 'Architecte Fullstack Senior',
      ratingTitle: '100% Satisfaction',
      ratingSubtitle: 'Code Garanti • Zéro Dette'
    },
    fiverr: {
      categoryTag: '⚡ FULLSTACK WEB DEVELOPMENT',
      platformBadge: 'Fiverr Verified',
      titleLine1: 'SENIOR FULLSTACK',
      titleLine2: 'LARAVEL & REACT',
      subtitle: 'Turnkey Web Apps • Secure REST APIs • Zero Tech Debt',
      badges: [
        { icon: '🏆', text: '6+ Years Experience' },
        { icon: '⚡', text: 'Production Ready' },
        { icon: '🛡️', text: 'Tested Code' },
        { icon: '🚀', text: 'Clean Architecture' }
      ],
      techStack: [
        { logo: 'laravel', label: 'Laravel 11' },
        { logo: 'react', label: 'React 19' },
        { logo: 'tailwind', label: 'Tailwind CSS' },
        { logo: 'docker', label: 'Docker Sail' }
      ],
      authorRole: 'Senior Fullstack Software Engineer',
      ratingTitle: '100% Satisfaction',
      ratingSubtitle: 'Guaranteed Code • Zero Debt'
    }
  }
};

/**
 * Render tech stack HTML
 */
export function buildTechStackHtml(techStack = []) {
  return techStack
    .map(t => {
      const svg = getSvgContent(t.logo);
      return `<div class="tech-pill">${svg}<span>${t.label}</span></div>`;
    })
    .join('\n        ');
}

/**
 * Generate full HTML string for a thumbnail
 */
export function renderThumbnailHtml({
  slug,
  variant = 'dark-tech', // 'dark-tech' | 'navy-corporate'
  platform = 'comeup'    // 'master' | 'comeup' | 'fiverr'
}) {
  const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  // Validate slug
  if (!slug || !GIG_THUMBNAIL_CONFIGS[slug]) {
    throw new Error(
      `Gig slug "${slug}" inconnu. Slugs valides : ${Object.keys(GIG_THUMBNAIL_CONFIGS).join(', ')}`
    );
  }

  // Validate variant
  const validVariants = ['dark-tech', 'navy-corporate'];
  if (!validVariants.includes(variant)) {
    throw new Error(
      `Variante "${variant}" invalide. Variantes valides : ${validVariants.join(', ')}`
    );
  }

  // Validate platform
  const validPlatforms = ['master', 'comeup', 'fiverr'];
  if (!validPlatforms.includes(platform)) {
    throw new Error(
      `Plateforme "${platform}" invalide. Plateformes valides : ${validPlatforms.join(', ')}`
    );
  }

  const gigConfig = GIG_THUMBNAIL_CONFIGS[slug][platform];

  const portraitPath = path.join(ASSETS_DIR, 'portrait.png');
  const portraitUri = getAssetAsDataUri(portraitPath, 'image/png');
  const techLogosHtml = buildTechStackHtml(gigConfig.techStack);

  const replacements = {
    '{{VARIANT}}': variant,
    '{{CATEGORY_TAG}}': gigConfig.categoryTag,
    '{{PLATFORM_BADGE}}': gigConfig.platformBadge,
    '{{TITLE_LINE_1}}': gigConfig.titleLine1,
    '{{TITLE_LINE_2}}': gigConfig.titleLine2,
    '{{SUBTITLE}}': gigConfig.subtitle,
    '{{BADGE_1}}': gigConfig.badges[0]?.text || "6+ Ans d'Expérience",
    '{{BADGE_2}}': gigConfig.badges[1]?.text || 'Production Ready',
    '{{BADGE_3}}': gigConfig.badges[2]?.text || 'Code Testé',
    '{{BADGE_4}}': gigConfig.badges[3]?.text || 'RAG & MCP',
    '{{TECH_LOGOS_HTML}}': techLogosHtml,
    '{{PORTRAIT_SRC}}': portraitUri,
    '{{AUTHOR_ROLE}}': gigConfig.authorRole,
    '{{RATING_TITLE}}': gigConfig.ratingTitle || '100% Satisfaction',
    '{{RATING_SUBTITLE}}': gigConfig.ratingSubtitle || 'Code Garanti • Zéro Dette'
  };

  let html = templateHtml;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, value);
  }

  return html;
}

/**
 * Render and save a single thumbnail view
 */
export async function generateThumbnailFile(page, {
  slug,
  variant = 'dark-tech',
  platform = 'comeup',
  outputDir = OUTPUT_DIR,
  baseFilename = null
}) {
  const html = renderThumbnailHtml({ slug, variant, platform });
  await page.setContent(html, { waitUntil: 'load' });

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const prefix = baseFilename || `${slug}-${variant}`;
  const pngPath = path.join(outputDir, `${prefix}.png`);
  const webpPath = path.join(outputDir, `${prefix}.webp`);

  // 1. Capture PNG Buffer (deviceScaleFactor = 2 -> 2560x1538 px)
  const pngBuffer = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }
  });
  fs.writeFileSync(pngPath, pngBuffer);

  // 2. Generate WebP via in-browser canvas (deviceScaleFactor = 2, quality = 0.92)
  const webpBase64 = await page.evaluate(async (pngBase64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/webp', 0.92);
        resolve(dataUrl.split(',')[1]);
      };
      img.src = 'data:image/png;base64,' + pngBase64;
    });
  }, pngBuffer.toString('base64'));

  const webpBuffer = Buffer.from(webpBase64, 'base64');
  fs.writeFileSync(webpPath, webpBuffer);

  return {
    slug,
    variant,
    platform,
    pngPath,
    webpPath,
    pngSize: pngBuffer.length,
    webpSize: webpBuffer.length
  };
}

/**
 * Build all thumbnails for a specific gig or all gigs
 */
export async function buildThumbnails({
  gigSlug = null,
  variant = null,
  platform = null,
  outputDir = OUTPUT_DIR
} = {}) {
  const startTime = Date.now();

  if (gigSlug && !GIG_THUMBNAIL_CONFIGS[gigSlug]) {
    throw new Error(
      `Gig slug "${gigSlug}" inconnu. Slugs valides : ${Object.keys(GIG_THUMBNAIL_CONFIGS).join(', ')}`
    );
  }

  const slugs = gigSlug ? [gigSlug] : Object.keys(GIG_THUMBNAIL_CONFIGS);
  const variants = variant ? [variant] : ['dark-tech', 'navy-corporate'];
  const platforms = platform ? [platform] : ['comeup', 'fiverr'];

  console.log('======================================================');
  console.log('       FREELANCE GIGS STUDIO - VISUAL BUILDER        ');
  console.log('======================================================');
  console.log(`📐 Format     : ${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT} px (Retina 2x)`);
  console.log(`🎨 Variantes  : ${variants.join(', ')}`);
  console.log(`🌐 Cibles     : ${platforms.join(', ')}`);
  console.log(`📁 Sortie     : ${path.relative(ROOT_DIR, outputDir)}\n`);

  const browser = await createBrowser();
  const page = await browser.newPage({
    viewport: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
    deviceScaleFactor: DEVICE_SCALE_FACTOR
  });

  const generatedFiles = [];

  try {
    for (const slug of slugs) {
      console.log(`🎨 Traitement du gig : [${slug}]`);

      for (const v of variants) {
        // 1. Primary Master files with Senior Pro badge
        if (!platform || platform === 'master') {
          const masterResult = await generateThumbnailFile(page, {
            slug,
            variant: v,
            platform: 'master',
            outputDir,
            baseFilename: `${slug}-${v}`
          });
          generatedFiles.push(masterResult);
          console.log(`   ✨ Master [${v}] -> ${path.basename(masterResult.pngPath)} (${(masterResult.pngSize / 1024).toFixed(1)} KB) & .webp (${(masterResult.webpSize / 1024).toFixed(1)} KB)`);
        }

        // 2. Specific files per platform (ComeUp & Fiverr)
        for (const p of platforms) {
          if (p === 'master') continue;
          const platformResult = await generateThumbnailFile(page, {
            slug,
            variant: v,
            platform: p,
            outputDir,
            baseFilename: `${slug}-${p}-${v}`
          });
          generatedFiles.push(platformResult);
          console.log(`      🔹 [${p.toUpperCase()} • ${v}] -> ${path.basename(platformResult.pngPath)}`);
        }
      }
      console.log('');
    }
  } finally {
    await browser.close();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('------------------------------------------------------');
  console.log(`🎉 ${generatedFiles.length} vues de miniatures générées en ${duration}s (PNG & WebP).`);
  console.log('======================================================\n');

  return generatedFiles;
}

/**
 * Parse and validate CLI arguments
 */
export function parseCliArgs(rawArgs = []) {
  let gigSlug = null;
  let variant = null;
  let platform = null;
  let isAll = false;
  let showHelp = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--all') {
      isAll = true;
      gigSlug = null;
    } else if (arg.startsWith('--gig=')) {
      gigSlug = arg.slice(6);
    } else if (arg === '--gig' && i + 1 < rawArgs.length) {
      gigSlug = rawArgs[++i];
    } else if (arg.startsWith('--variant=')) {
      variant = arg.slice(10);
    } else if (arg === '--variant' && i + 1 < rawArgs.length) {
      variant = rawArgs[++i];
    } else if (arg.startsWith('--platform=')) {
      platform = arg.slice(11);
    } else if (arg === '--platform' && i + 1 < rawArgs.length) {
      platform = rawArgs[++i];
    } else if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else {
      throw new Error(`Argument CLI non reconnu : "${arg}". Utilisez --help pour voir les options.`);
    }
  }

  if (isAll) {
    gigSlug = null;
  }

  const validSlugs = Object.keys(GIG_THUMBNAIL_CONFIGS);
  if (gigSlug && !validSlugs.includes(gigSlug)) {
    throw new Error(
      `Gig slug "${gigSlug}" inconnu. Slugs valides : ${validSlugs.join(', ')}`
    );
  }

  const validVariants = ['dark-tech', 'navy-corporate'];
  if (variant && !validVariants.includes(variant)) {
    throw new Error(
      `Variante "${variant}" inconnue. Variantes valides : ${validVariants.join(', ')}`
    );
  }

  const validPlatforms = ['master', 'comeup', 'fiverr'];
  if (platform && !validPlatforms.includes(platform)) {
    throw new Error(
      `Plateforme "${platform}" inconnue. Plateformes valides : ${validPlatforms.join(', ')}`
    );
  }

  return { gigSlug, variant, platform, isAll, showHelp };
}

// CLI Execution Support
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const parsed = parseCliArgs(process.argv.slice(2));

    if (parsed.showHelp) {
      console.log(`
Freelance Gigs Studio - Générateur de Miniatures (1280x769 px)
Usage:
  node core/thumbnail-builder.js [options]

Options:
  --all                 Générer toutes les miniatures de tous les gigs
  --gig=<slug>          Générer pour un gig spécifique (${Object.keys(GIG_THUMBNAIL_CONFIGS).join(', ')})
  --variant=<name>      Variante graphique (dark-tech, navy-corporate)
  --platform=<target>   Plateforme cible (comeup, fiverr, master)
  --help, -h            Afficher cette aide
`);
      process.exit(0);
    }

    buildThumbnails({
      gigSlug: parsed.gigSlug,
      variant: parsed.variant,
      platform: parsed.platform
    })
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('❌ Erreur génération miniatures :', err.message);
        process.exit(1);
      });
  } catch (err) {
    console.error('❌ Erreur arguments CLI :', err.message);
    process.exit(1);
  }
}
