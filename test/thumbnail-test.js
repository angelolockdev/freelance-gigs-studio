/**
 * Automated test suite for Freelance Gigs Studio - Visual Builder (Phase 2)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT_DIR,
  OUTPUT_DIR,
  TEMPLATE_PATH,
  ASSETS_DIR,
  LOGOS_DIR,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  DEVICE_SCALE_FACTOR,
  GIG_THUMBNAIL_CONFIGS,
  getAssetAsDataUri,
  getSvgContent,
  buildTechStackHtml,
  renderThumbnailHtml,
  createBrowser,
  generateThumbnailFile,
  buildThumbnails,
  parseCliArgs
} from '../core/thumbnail-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running Freelance Gigs Studio Thumbnail Test Suite...\n');

// ---------------------------------------------------------------------------
// Test 1: Template HTML existence & structure
// ---------------------------------------------------------------------------
console.log('Test 1: Master thumbnail template existence and structure');
assert.ok(fs.existsSync(TEMPLATE_PATH), 'Template file must exist');
const templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
assert.ok(templateHtml.includes('width: 1280px'), 'Template must define 1280px width');
assert.ok(templateHtml.includes('height: 769px'), 'Template must define 769px height');
assert.ok(templateHtml.includes('.theme-dark-tech'), 'Template must include Dark Tech theme rules');
assert.ok(templateHtml.includes('.theme-navy-corporate'), 'Template must include Navy Corporate theme rules');
assert.ok(templateHtml.includes('{{PORTRAIT_SRC}}'), 'Template must contain portrait placeholder');
assert.ok(templateHtml.includes('{{TITLE_LINE_1}}'), 'Template must contain headline placeholder');
console.log('  ✅ Template HTML structure is verified.');

// ---------------------------------------------------------------------------
// Test 2: Assets & Vector SVG logos integrity
// ---------------------------------------------------------------------------
console.log('Test 2: Assets & Vector SVG logos integrity');
const portraitPath = path.join(ASSETS_DIR, 'portrait.png');
assert.ok(fs.existsSync(portraitPath), 'portrait.png must exist');
const portraitDataUri = getAssetAsDataUri(portraitPath);
assert.ok(portraitDataUri.startsWith('data:image/png;base64,'), 'Data URI must be valid base64 PNG');
assert.ok(portraitDataUri.length > 50000, 'Portrait Data URI must be substantial');

const expectedLogos = ['laravel', 'react', 'python', 'openai', 'mcp', 'tailwind', 'docker'];
for (const logo of expectedLogos) {
  const svg = getSvgContent(logo);
  assert.ok(svg.includes('<svg'), `Logo ${logo}.svg must contain <svg tag`);
  assert.ok(svg.includes('viewBox'), `Logo ${logo}.svg must contain viewBox`);
}
console.log(`  ✅ All ${expectedLogos.length} official vector SVG logos are valid.`);

// ---------------------------------------------------------------------------
// Test 3: Tech stack HTML builder
// ---------------------------------------------------------------------------
console.log('Test 3: Tech stack HTML generator');
const stack = [
  { logo: 'python', label: 'Python 3.12' },
  { logo: 'openai', label: 'OpenAI GPT-4o' },
  { logo: 'mcp', label: 'MCP Protocol' }
];
const stackHtml = buildTechStackHtml(stack);
assert.ok(stackHtml.includes('Python 3.12'), 'Must include Python label');
assert.ok(stackHtml.includes('OpenAI GPT-4o'), 'Must include OpenAI label');
assert.ok(stackHtml.includes('MCP Protocol'), 'Must include MCP label');
assert.equal((stackHtml.match(/<div class="tech-pill">/g) || []).length, 3, 'Must render exactly 3 tech pills');
console.log('  ✅ Tech stack HTML builder verified.');

// ---------------------------------------------------------------------------
// Test 4: Authority badges compliance per specification
// ---------------------------------------------------------------------------
console.log('Test 4: Authority badges compliance (« 6+ Ans d\'Expérience », « Production Ready », « Code Testé », « RAG & MCP »)');
const ragBadgesComeup = GIG_THUMBNAIL_CONFIGS['ai-rag-agent'].comeup.badges.map(b => b.text);
assert.ok(ragBadgesComeup.includes("6+ Ans d'Expérience"), 'Must include 6+ Ans d\'Expérience');
assert.ok(ragBadgesComeup.includes('Production Ready'), 'Must include Production Ready');
assert.ok(ragBadgesComeup.includes('Code Testé'), 'Must include Code Testé');
assert.ok(ragBadgesComeup.includes('RAG & MCP'), 'Must include RAG & MCP');

const ragBadgesFiverr = GIG_THUMBNAIL_CONFIGS['ai-rag-agent'].fiverr.badges.map(b => b.text);
assert.ok(ragBadgesFiverr.includes('6+ Years Experience'), 'Must include 6+ Years Experience');
assert.ok(ragBadgesFiverr.includes('Production Ready'), 'Must include Production Ready');
assert.ok(ragBadgesFiverr.includes('Tested Code'), 'Must include Tested Code');
assert.ok(ragBadgesFiverr.includes('RAG & MCP'), 'Must include RAG & MCP');
console.log('  ✅ Authority badges strictly conform to Phase 2 specification.');

// ---------------------------------------------------------------------------
// Test 5: HTML interpolation without unreplaced placeholders
// ---------------------------------------------------------------------------
console.log('Test 5: HTML interpolation across all platforms, gigs and variants');
for (const slug of ['ai-rag-agent', 'laravel-fullstack']) {
  for (const variant of ['dark-tech', 'navy-corporate']) {
    for (const platform of ['master', 'comeup', 'fiverr']) {
      const renderedHtml = renderThumbnailHtml({ slug, variant, platform });
      assert.ok(renderedHtml.includes(`theme-${variant}`), `Must apply theme-${variant}`);
      assert.ok(!renderedHtml.includes('{{'), `Should not contain unreplaced placeholders in ${slug} ${variant} ${platform}`);
      assert.ok(renderedHtml.includes('Angelo Lock To Hang'), 'Must include author identity');
    }
  }
}
console.log('  ✅ HTML rendering passes with zero unreplaced placeholders across all 12 combinations.');

// ---------------------------------------------------------------------------
// Test 6: Strict validation against unknown gig slug or variant
// ---------------------------------------------------------------------------
console.log('Test 6: Strict validation against unknown gig slug or variant');
assert.throws(
  () => renderThumbnailHtml({ slug: 'unknown-slug', variant: 'dark-tech', platform: 'comeup' }),
  /Gig slug "unknown-slug" inconnu/,
  'Must throw error on unknown gig slug'
);
assert.throws(
  () => renderThumbnailHtml({ slug: 'ai-rag-agent', variant: 'neon-green', platform: 'comeup' }),
  /Variante "neon-green" invalide/,
  'Must throw error on unknown variant'
);
assert.throws(
  () => renderThumbnailHtml({ slug: 'ai-rag-agent', variant: 'dark-tech', platform: 'etsy' }),
  /Plateforme "etsy" invalide/,
  'Must throw error on unknown platform'
);
console.log('  ✅ Strict validation prevents silent corruption.');

// ---------------------------------------------------------------------------
// Test 7: CLI Argument Parser Unit Tests
// ---------------------------------------------------------------------------
console.log('Test 7: CLI argument parser (--all, --gig, space-separated, --help, validation)');
// Default / empty
assert.deepEqual(parseCliArgs([]), { gigSlug: null, variant: null, platform: null, isAll: false, showHelp: false });
// --all flag
assert.equal(parseCliArgs(['--all']).isAll, true);
assert.equal(parseCliArgs(['--all']).gigSlug, null);
// --gig with equals
assert.equal(parseCliArgs(['--gig=ai-rag-agent']).gigSlug, 'ai-rag-agent');
// --gig space separated
assert.equal(parseCliArgs(['--gig', 'laravel-fullstack']).gigSlug, 'laravel-fullstack');
// --all overrides --gig
assert.equal(parseCliArgs(['--gig=ai-rag-agent', '--all']).gigSlug, null);
assert.equal(parseCliArgs(['--gig=ai-rag-agent', '--all']).isAll, true);
// --variant and --platform
assert.equal(parseCliArgs(['--variant=navy-corporate', '--platform=fiverr']).variant, 'navy-corporate');
assert.equal(parseCliArgs(['--variant=navy-corporate', '--platform=fiverr']).platform, 'fiverr');
// --help flag
assert.equal(parseCliArgs(['--help']).showHelp, true);
assert.equal(parseCliArgs(['-h']).showHelp, true);
// Invalid option rejection
assert.throws(() => parseCliArgs(['--invalid-flag']), /Argument CLI non reconnu/);
assert.throws(() => parseCliArgs(['--gig=unknown-gig']), /Gig slug "unknown-gig" inconnu/);
assert.throws(() => parseCliArgs(['--variant=unknown-var']), /Variante "unknown-var" inconnue/);
console.log('  ✅ CLI argument parser successfully tested for all permutations and error cases.');

// ---------------------------------------------------------------------------
// Test 8: Browser launch and page viewport verification
// ---------------------------------------------------------------------------
console.log('Test 8: Playwright browser launcher verification');
const browser = await createBrowser();
assert.ok(browser, 'Browser must be successfully instantiated');
const page = await browser.newPage({
  viewport: { width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT },
  deviceScaleFactor: DEVICE_SCALE_FACTOR
});
const viewport = page.viewportSize();
assert.equal(viewport.width, 1280, 'Viewport width must be 1280');
assert.equal(viewport.height, 769, 'Viewport height must be 769');
console.log('  ✅ Playwright browser initialized with exact 1280x769 viewport.');

// ---------------------------------------------------------------------------
// Test 9: Single thumbnail generation in custom isolated output directory
// ---------------------------------------------------------------------------
console.log('Test 9: Generation to isolated temporary test directory');
const testOutputDir = path.join(ROOT_DIR, 'data/output/test-thumbnails');
if (fs.existsSync(testOutputDir)) {
  fs.rmSync(testOutputDir, { recursive: true, force: true });
}

const singleResult = await generateThumbnailFile(page, {
  slug: 'ai-rag-agent',
  variant: 'dark-tech',
  platform: 'comeup',
  outputDir: testOutputDir,
  baseFilename: 'test-single'
});

assert.ok(fs.existsSync(singleResult.pngPath), 'PNG file must exist');
assert.ok(fs.existsSync(singleResult.webpPath), 'WebP file must exist');
assert.ok(singleResult.pngSize > 100000, 'PNG file size must be > 100KB');
assert.ok(singleResult.webpSize > 20000, 'WebP file size must be > 20KB');

// Verify image resolution in page
await page.goto('file:///' + singleResult.pngPath.replace(/\\/g, '/'));
const imgDimensions = await page.evaluate(() => {
  const img = document.querySelector('img');
  return { width: img.naturalWidth, height: img.naturalHeight };
});
assert.equal(imgDimensions.width, 2560, 'Retina width must be 2560 (1280 * 2)');
assert.equal(imgDimensions.height, 1538, 'Retina height must be 1538 (769 * 2)');

// Cleanup test output
await browser.close();
fs.rmSync(testOutputDir, { recursive: true, force: true });
console.log('  ✅ Single thumbnail generation verified at exact 2560x1538 Retina resolution.');

// ---------------------------------------------------------------------------
// Test 10: Output files in data/output/thumbnails/
// ---------------------------------------------------------------------------
console.log('Test 10: Validating production thumbnail files in data/output/thumbnails/');
const expectedSlugs = ['ai-rag-agent', 'laravel-fullstack'];
const expectedVariants = ['dark-tech', 'navy-corporate'];

for (const slug of expectedSlugs) {
  for (const variant of expectedVariants) {
    // Primary master files
    const pngMaster = path.join(OUTPUT_DIR, `${slug}-${variant}.png`);
    const webpMaster = path.join(OUTPUT_DIR, `${slug}-${variant}.webp`);
    assert.ok(fs.existsSync(pngMaster), `Master PNG missing: ${path.basename(pngMaster)}`);
    assert.ok(fs.existsSync(webpMaster), `Master WebP missing: ${path.basename(webpMaster)}`);
    assert.ok(fs.statSync(pngMaster).size > 200000, `${path.basename(pngMaster)} must be non-empty`);
    assert.ok(fs.statSync(webpMaster).size > 20000, `${path.basename(webpMaster)} must be non-empty`);

    // Platform ComeUp files
    const pngComeup = path.join(OUTPUT_DIR, `${slug}-comeup-${variant}.png`);
    const webpComeup = path.join(OUTPUT_DIR, `${slug}-comeup-${variant}.webp`);
    assert.ok(fs.existsSync(pngComeup), `ComeUp PNG missing: ${path.basename(pngComeup)}`);
    assert.ok(fs.existsSync(webpComeup), `ComeUp WebP missing: ${path.basename(webpComeup)}`);

    // Platform Fiverr files
    const pngFiverr = path.join(OUTPUT_DIR, `${slug}-fiverr-${variant}.png`);
    const webpFiverr = path.join(OUTPUT_DIR, `${slug}-fiverr-${variant}.webp`);
    assert.ok(fs.existsSync(pngFiverr), `Fiverr PNG missing: ${path.basename(pngFiverr)}`);
    assert.ok(fs.existsSync(webpFiverr), `Fiverr WebP missing: ${path.basename(webpFiverr)}`);
  }
}
console.log('  ✅ All 24 production thumbnails (PNG & WebP, Masters & Platform Variants) verified.');

console.log('\n🎉 ALL 10 THUMBNAIL TESTS PASSED SUCCESSFULLY!\n');
