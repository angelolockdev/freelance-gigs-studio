/**
 * Automated test suite for Freelance Gigs Studio - Browser Injector (Phase 3)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT_DIR,
  GIGS_DIR,
  THUMBNAILS_DIR,
  SELECTORS_PATH,
  DEFAULT_CDP_URL,
  TYPING_DELAY_MIN,
  TYPING_DELAY_MAX,
  SafetyViolationError,
  CdpConnectionError,
  loadSelectors,
  loadGig,
  resolveThumbnailPath,
  verifyCdpConnection,
  buildCdpTroubleshootingMessage,
  enforceSafetyDraftOnly,
  prepareComeUpPayload,
  prepareFiverrPayload,
  simulateComeUpDryRun,
  simulateFiverrDryRun,
  injectGig,
  parseInjectorCliArgs,
  getRandomTypingDelay,
  injectComeUpLive,
  injectFiverrLive
} from '../core/browser-injector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running Freelance Gigs Studio Browser Injector Test Suite (Phase 3)...\n');

// ---------------------------------------------------------------------------
// Test 1: selectors.json syntax, schema integrity & required platforms
// ---------------------------------------------------------------------------
console.log('Test 1: Validating selectors.json syntax, schema integrity and platforms');
assert.ok(fs.existsSync(SELECTORS_PATH), 'selectors.json must exist');
const selectors = loadSelectors(SELECTORS_PATH);
assert.equal(typeof selectors, 'object', 'selectors must be an object');
assert.ok(selectors.platforms, 'selectors must define platforms');
assert.ok(selectors.platforms.comeup, 'platforms must include comeup');
assert.ok(selectors.platforms.fiverr, 'platforms must include fiverr');
assert.equal(selectors.platforms.comeup.newServiceUrl, 'https://comeup.com/dashboard/services/nouveau');
assert.equal(selectors.platforms.fiverr.newGigUrl, 'https://www.fiverr.com/manage_gigs/new');
console.log('  ✅ selectors.json syntax & root platforms structure verified.');

// ---------------------------------------------------------------------------
// Test 2: ComeUp selectors mapping completeness & safety policy
// ---------------------------------------------------------------------------
console.log('Test 2: Validating ComeUp DOM selectors mapping and draft safety policy');
const cu = selectors.platforms.comeup;
assert.equal(cu.safetyPolicy.allowPublish, false, 'ComeUp safetyPolicy must forbid automatic publishing');
assert.equal(cu.safetyPolicy.enforceDraft, true, 'ComeUp safetyPolicy must enforce draft mode');
assert.ok(cu.selectors.title.selector.includes('input[name="title"]'), 'Title selector must include name="title"');
assert.ok(cu.selectors.category.selector.includes('select[name="category"]'), 'Category select must be present');
assert.ok(cu.selectors.subcategory.selector.includes('select[name="subcategory"]'), 'Subcategory select must be present');
assert.ok(cu.selectors.baseOffer.price.selector.includes('input[name="price"]'), 'Base price selector must be present');
assert.ok(cu.selectors.baseOffer.deliveryDays.selector.includes('select[name="delivery_days"]'), 'Base delivery days select must be present');
assert.ok(cu.selectors.description.editor.selector.includes('.ck-editor__editable'), 'WYSIWYG editor selector must be present');
assert.ok(cu.selectors.options.addButton.selector.includes('Ajouter une option'), 'Options add button must be mapped');
assert.ok(cu.selectors.thumbnail.fileInput.selector.includes('input[type="file"]'), 'Thumbnail file input must be present');
assert.equal(cu.selectors.actions.saveDraft.safetyLevel, 'SAFE', 'saveDraft must have safetyLevel SAFE');
assert.equal(cu.selectors.actions.forbiddenPublish.safetyLevel, 'FORBIDDEN', 'forbiddenPublish must have safetyLevel FORBIDDEN');
console.log('  ✅ ComeUp selectors mapping & safety policy strictly verified.');

// ---------------------------------------------------------------------------
// Test 3: Fiverr 6-steps wizard structure & completeness
// ---------------------------------------------------------------------------
console.log('Test 3: Validating Fiverr 6-steps wizard structure & completeness');
const fv = selectors.platforms.fiverr;
assert.equal(fv.safetyPolicy.allowPublish, false, 'Fiverr safetyPolicy must forbid publishing');
assert.equal(fv.safetyPolicy.enforceDraft, true, 'Fiverr safetyPolicy must enforce draft mode');
assert.ok(fv.steps.step1_overview, 'Step 1 Overview must exist');
assert.ok(fv.steps.step2_pricing, 'Step 2 Pricing must exist');
assert.ok(fv.steps.step3_description, 'Step 3 Description must exist');
assert.ok(fv.steps.step4_requirements, 'Step 4 Requirements must exist');
assert.ok(fv.steps.step5_gallery, 'Step 5 Gallery must exist');
assert.ok(fv.steps.step6_publish, 'Step 6 Publish must exist');

// Step 1
assert.ok(fv.steps.step1_overview.selectors.gigTitle.selector.includes('textarea[name="gig[title]"]'));
assert.equal(fv.steps.step1_overview.selectors.searchTags.input.maxTags, 5);
// Step 2
assert.ok(fv.steps.step2_pricing.selectors.threePackagesToggle.selector.includes('packages'));
assert.ok(fv.steps.step2_pricing.selectors.packages.basic, 'Basic package must be defined');
assert.ok(fv.steps.step2_pricing.selectors.packages.standard, 'Standard package must be defined');
assert.ok(fv.steps.step2_pricing.selectors.packages.premium, 'Premium package must be defined');
// Step 3
assert.ok(fv.steps.step3_description.selectors.descriptionEditor.selector.includes('.ql-editor'));
assert.ok(fv.steps.step3_description.selectors.faqSection.addButton.selector.includes('Add FAQ'));
// Step 4
assert.ok(fv.steps.step4_requirements.selectors.addRequirementButton.selector.includes('Add'));
// Step 5
assert.ok(fv.steps.step5_gallery.selectors.thumbnailInput.selector.includes('input[type="file"]'));
// Step 6
assert.equal(fv.steps.step6_publish.selectors.saveAsDraft.safetyLevel, 'SAFE');
assert.equal(fv.steps.step6_publish.selectors.forbiddenPublish.safetyLevel, 'FORBIDDEN');
console.log('  ✅ Fiverr 6-steps wizard architecture verified.');

// ---------------------------------------------------------------------------
// Test 4: Windows Debug Launcher batch file (start-chrome-debug.bat) existence & compliance
// ---------------------------------------------------------------------------
console.log('Test 4: Checking start-chrome-debug.bat existence, parameters & diagnostic guide');
const batPath = path.join(ROOT_DIR, 'start-chrome-debug.bat');
assert.ok(fs.existsSync(batPath), 'start-chrome-debug.bat must exist');
const batContent = fs.readFileSync(batPath, 'utf8');
assert.ok(batContent.includes('--remote-debugging-port=9222'), 'Batch must specify port 9222');
assert.ok(batContent.includes('.chrome-debug-profile'), 'Batch must use isolated persistent profile');
assert.ok(batContent.includes('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'), 'Batch must check standard Chrome 64-bit path');
assert.ok(batContent.includes('%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe'), 'Batch must check LOCALAPPDATA path');
assert.ok(batContent.includes('comeup.com'), 'Batch must guide login to ComeUp');
assert.ok(batContent.includes('fiverr.com'), 'Batch must guide login to Fiverr');
console.log('  ✅ start-chrome-debug.bat launcher verified.');

// ---------------------------------------------------------------------------
// Test 5: CLI Arguments Parser (all variations & edge cases)
// ---------------------------------------------------------------------------
console.log('Test 5: Testing CLI argument parsing permutations and error validation');
const p1 = parseInjectorCliArgs(['--gig=ai-rag-agent', '--platform=comeup', '--dry-run']);
assert.equal(p1.gigSlug, 'ai-rag-agent');
assert.equal(p1.platform, 'comeup');
assert.equal(p1.dryRun, true);
assert.equal(p1.cdpUrl, DEFAULT_CDP_URL);

const p2 = parseInjectorCliArgs(['--gig', 'laravel-fullstack', '--platform', 'fiverr', '--simulate', '--cdp-url', 'http://127.0.0.1:9333']);
assert.equal(p2.gigSlug, 'laravel-fullstack');
assert.equal(p2.platform, 'fiverr');
assert.equal(p2.dryRun, true);
assert.equal(p2.cdpUrl, 'http://127.0.0.1:9333');

const p3 = parseInjectorCliArgs(['ai-rag-agent', '--dry-run']);
assert.equal(p3.gigSlug, 'ai-rag-agent');
assert.equal(p3.platform, 'all');
assert.equal(p3.dryRun, true);

const p4 = parseInjectorCliArgs(['--help']);
assert.equal(p4.showHelp, true);
console.log('  ✅ CLI argument parser correctly tested.');

// ---------------------------------------------------------------------------
// Test 6: Payload preparation & mapping for ai-rag-agent (ComeUp & Fiverr)
// ---------------------------------------------------------------------------
console.log('Test 6: Testing payload preparation and mapping for ai-rag-agent');
const gigAi = loadGig('ai-rag-agent');
const thumbAiComeup = resolveThumbnailPath('ai-rag-agent', 'comeup');
const thumbAiFiverr = resolveThumbnailPath('ai-rag-agent', 'fiverr');

const payloadAiComeup = prepareComeUpPayload(gigAi, thumbAiComeup);
assert.equal(payloadAiComeup.gigSlug, 'ai-rag-agent');
assert.ok(payloadAiComeup.title.startsWith('Je vais'));
assert.equal(payloadAiComeup.baseOffer.price, 25);
assert.equal(payloadAiComeup.options.length, 3);
assert.equal(payloadAiComeup.options[0].price, 150);
assert.equal(payloadAiComeup.options[1].price, 390);
assert.equal(payloadAiComeup.safetyStop, 'saveDraft');

const payloadAiFiverr = prepareFiverrPayload(gigAi, thumbAiFiverr);
assert.equal(payloadAiFiverr.gigSlug, 'ai-rag-agent');
assert.ok(payloadAiFiverr.overview.title.startsWith('I will'));
assert.equal(payloadAiFiverr.overview.tags.length, 5);
assert.equal(payloadAiFiverr.pricing.basic.price, 45);
assert.equal(payloadAiFiverr.pricing.standard.price, 180);
assert.equal(payloadAiFiverr.pricing.premium.price, 450);
assert.equal(payloadAiFiverr.safetyStop, 'step6_publish.saveAsDraft');
console.log('  ✅ Payload mapping for ai-rag-agent verified.');

// ---------------------------------------------------------------------------
// Test 7: Payload preparation & mapping for laravel-fullstack (ComeUp & Fiverr)
// ---------------------------------------------------------------------------
console.log('Test 7: Testing payload preparation and mapping for laravel-fullstack');
const gigLaravel = loadGig('laravel-fullstack');
const thumbLaravelComeup = resolveThumbnailPath('laravel-fullstack', 'comeup');
const thumbLaravelFiverr = resolveThumbnailPath('laravel-fullstack', 'fiverr');

const payloadLaravelComeup = prepareComeUpPayload(gigLaravel, thumbLaravelComeup);
assert.equal(payloadLaravelComeup.baseOffer.price, 35);
assert.equal(payloadLaravelComeup.options[0].price, 180);
assert.equal(payloadLaravelComeup.options[1].price, 480);

const payloadLaravelFiverr = prepareFiverrPayload(gigLaravel, thumbLaravelFiverr);
assert.equal(payloadLaravelFiverr.overview.tags.length, 5);
assert.equal(payloadLaravelFiverr.pricing.basic.price, 50);
assert.equal(payloadLaravelFiverr.pricing.standard.price, 190);
assert.equal(payloadLaravelFiverr.pricing.premium.price, 520);
console.log('  ✅ Payload mapping for laravel-fullstack verified.');

// ---------------------------------------------------------------------------
// Test 8: Thumbnail resolution for each gig and platform
// ---------------------------------------------------------------------------
console.log('Test 8: Verifying thumbnail file resolution on disk');
assert.ok(fs.existsSync(thumbAiComeup), 'ComeUp thumbnail for ai-rag-agent must exist');
assert.ok(fs.existsSync(thumbAiFiverr), 'Fiverr thumbnail for ai-rag-agent must exist');
assert.ok(fs.existsSync(thumbLaravelComeup), 'ComeUp thumbnail for laravel-fullstack must exist');
assert.ok(fs.existsSync(thumbLaravelFiverr), 'Fiverr thumbnail for laravel-fullstack must exist');

assert.throws(() => {
  resolveThumbnailPath('non-existent-gig', 'comeup');
}, /Aucune miniature trouvée/, 'Should throw when thumbnail does not exist');
console.log('  ✅ Thumbnail resolution and existence confirmed.');

// ---------------------------------------------------------------------------
// Test 9: Strict Safety Guardrail: enforceSafetyDraftOnly
// ---------------------------------------------------------------------------
console.log('Test 9: Testing strict safety guardrail (enforceSafetyDraftOnly)');
assert.doesNotThrow(() => enforceSafetyDraftOnly('saveDraft'), 'saveDraft must be allowed');
assert.doesNotThrow(() => enforceSafetyDraftOnly('saveAsDraft'), 'saveAsDraft must be allowed');
assert.doesNotThrow(() => enforceSafetyDraftOnly('STEP6_SAVE_AS_DRAFT'), 'Draft action must be allowed');

assert.throws(() => enforceSafetyDraftOnly('publish'), SafetyViolationError, 'Should reject "publish"');
assert.throws(() => enforceSafetyDraftOnly('publier'), SafetyViolationError, 'Should reject "publier"');
assert.throws(() => enforceSafetyDraftOnly('submitForReview'), SafetyViolationError, 'Should reject "submit"');
assert.throws(() => enforceSafetyDraftOnly('demande_validation'), SafetyViolationError, 'Should reject "validation"');
console.log('  ✅ Safety guardrail strictly prevents auto-publication.');

// ---------------------------------------------------------------------------
// Test 10: Dry-Run simulation for ai-rag-agent (ComeUp & Fiverr)
// ---------------------------------------------------------------------------
console.log('Test 10: Executing Dry-Run simulation for ai-rag-agent (both platforms)');
const dryRunAi = await injectGig({
  gigSlug: 'ai-rag-agent',
  platform: 'all',
  dryRun: true,
  logOutput: false
});
assert.equal(dryRunAi.success, true);
assert.equal(dryRunAi.dryRun, true);
assert.ok(dryRunAi.results.comeup, 'ComeUp simulation result must exist');
assert.ok(dryRunAi.results.fiverr, 'Fiverr simulation result must exist');
assert.equal(dryRunAi.results.comeup.totalSteps, 8);
assert.equal(dryRunAi.results.comeup.steps[7].action, 'CLICK_SAVE_DRAFT');
assert.equal(dryRunAi.results.fiverr.totalSteps, 6);
assert.equal(dryRunAi.results.fiverr.steps[5].action, 'STEP6_SAVE_AS_DRAFT');
console.log('  ✅ Dry-run for ai-rag-agent passed completely.');

// ---------------------------------------------------------------------------
// Test 11: Dry-Run simulation for laravel-fullstack (ComeUp & Fiverr)
// ---------------------------------------------------------------------------
console.log('Test 11: Executing Dry-Run simulation for laravel-fullstack (both platforms)');
const dryRunLaravel = await injectGig({
  gigSlug: 'laravel-fullstack',
  platform: 'all',
  dryRun: true,
  logOutput: false
});
assert.equal(dryRunLaravel.success, true);
assert.equal(dryRunLaravel.dryRun, true);
assert.equal(dryRunLaravel.results.comeup.totalSteps, 8);
assert.equal(dryRunLaravel.results.fiverr.totalSteps, 6);
console.log('  ✅ Dry-run for laravel-fullstack passed completely.');

// ---------------------------------------------------------------------------
// Test 12: Invalid gig slug and invalid platform rejection
// ---------------------------------------------------------------------------
console.log('Test 12: Rejecting invalid gig slug and platform');
await assert.rejects(
  async () => {
    await injectGig({ gigSlug: 'unknown-service-xyz', dryRun: true, logOutput: false });
  },
  /introuvable/,
  'Should reject non-existent gig slug'
);

await assert.rejects(
  async () => {
    await injectGig({ gigSlug: 'ai-rag-agent', platform: 'malt', dryRun: true, logOutput: false });
  },
  /invalide/,
  'Should reject non-supported platform'
);
console.log('  ✅ Invalid gig slug and platform correctly rejected.');

// ---------------------------------------------------------------------------
// Test 13: CDP Connection Error & Diagnostic Message Generation
// ---------------------------------------------------------------------------
console.log('Test 13: Verifying proactive diagnostic error when Chrome CDP is not running');
// Testing on an unused port (e.g., 54321)
await assert.rejects(
  async () => {
    await verifyCdpConnection('http://127.0.0.1:54321', 400);
  },
  (err) => {
    assert.ok(err instanceof CdpConnectionError, 'Error must be instance of CdpConnectionError');
    assert.ok(err.diagnostic.includes('start-chrome-debug.bat'), 'Diagnostic must mention start-chrome-debug.bat');
    assert.ok(err.diagnostic.includes('9222'), 'Diagnostic must mention port 9222');
    return true;
  },
  'Should produce rich diagnostic when CDP port is closed'
);

const customDiag = buildCdpTroubleshootingMessage('http://localhost:9222', 'Connection refused');
assert.ok(customDiag.includes('GOOGLE CHROME N\'EST PAS LANCÉ'));
console.log('  ✅ Proactive CDP diagnostic message verified.');

// ---------------------------------------------------------------------------
// Test 14: Human Typing simulation parameters
// ---------------------------------------------------------------------------
console.log('Test 14: Checking natural typing jitter bounds (30-80ms)');
for (let i = 0; i < 50; i++) {
  const delay = getRandomTypingDelay(TYPING_DELAY_MIN, TYPING_DELAY_MAX);
  assert.ok(delay >= 30, `Delay must be >= 30 (got ${delay})`);
  assert.ok(delay <= 80, `Delay must be <= 80 (got ${delay})`);
}
console.log('  ✅ Natural typing jitter boundaries (30-80ms) verified.');

// ---------------------------------------------------------------------------
// Helper: Mock Playwright Page for Live Injection Tests
// ---------------------------------------------------------------------------
function createMockPage() {
  const actions = [];
  const fills = {};
  const selects = {};
  const clicks = [];
  const fileUploads = [];

  const createMockLocator = (selector) => {
    return {
      _selector: selector,
      async count() {
        return 1;
      },
      first() {
        return this;
      },
      nth(index) {
        return this;
      },
      locator(subSel) {
        return createMockLocator(`${selector} >> ${subSel}`);
      },
      async waitFor() {
        return true;
      },
      async focus() {
        actions.push({ type: 'focus', selector });
      },
      async type(text) {
        actions.push({ type: 'type', selector, text });
      },
      async fill(text) {
        actions.push({ type: 'fill', selector, text });
        fills[selector] = text;
      },
      async selectOption(opt) {
        actions.push({ type: 'selectOption', selector, opt });
        selects[selector] = opt;
      },
      async setInputFiles(filePath) {
        actions.push({ type: 'setInputFiles', selector, filePath });
        fileUploads.push({ selector, filePath });
      },
      async click() {
        actions.push({ type: 'click', selector });
        clicks.push(selector);
      },
      async press(key) {
        actions.push({ type: 'press', selector, key });
      },
      async isChecked() {
        return false;
      },
      async check() {
        actions.push({ type: 'check', selector });
      },
      async evaluate(fn, ...args) {
        actions.push({ type: 'evaluate', selector, args });
        const mockEl = { tagName: 'TEXTAREA', value: '', dispatchEvent: () => {} };
        fn(mockEl, ...args);
      }
    };
  };

  return {
    actions,
    fills,
    selects,
    clicks,
    fileUploads,
    navigatedUrls: [],
    async goto(url) {
      this.navigatedUrls.push(url);
    },
    locator(selector) {
      return createMockLocator(selector);
    }
  };
}

// ---------------------------------------------------------------------------
// Test 15: Mock Playwright execution for injectComeUpLive
// ---------------------------------------------------------------------------
console.log('Test 15: Validating full ComeUp live injection workflow via mock Playwright page');
const mockComeUpPage = createMockPage();
const comeUpLiveResult = await injectComeUpLive({
  browser: null,
  page: mockComeUpPage,
  payload: payloadAiComeup,
  selectors,
  slowMo: 0
});
assert.equal(comeUpLiveResult.success, true);
assert.equal(comeUpLiveResult.status, 'DRAFT_SAVED');
assert.equal(mockComeUpPage.navigatedUrls[0], 'https://comeup.com/dashboard/services/nouveau');
assert.ok(mockComeUpPage.fileUploads.length > 0, 'Thumbnail must be uploaded');
assert.equal(mockComeUpPage.fileUploads[0].filePath, payloadAiComeup.thumbnailPath);
assert.ok(mockComeUpPage.clicks.includes(cu.selectors.actions.saveDraft.selector), 'Must click saveDraft button');
assert.ok(!mockComeUpPage.clicks.includes(cu.selectors.actions.forbiddenPublish.selector), 'Must NEVER click forbiddenPublish');
console.log('  ✅ ComeUp live injection workflow (options, base offer, thumbnail, draft save) verified.');

// ---------------------------------------------------------------------------
// Test 16: Mock Playwright execution for injectFiverrLive (all 6 wizard steps)
// ---------------------------------------------------------------------------
console.log('Test 16: Validating full Fiverr 6-steps live injection workflow via mock Playwright page');
const mockFiverrPage = createMockPage();
const fiverrLiveResult = await injectFiverrLive({
  browser: null,
  page: mockFiverrPage,
  payload: payloadAiFiverr,
  selectors,
  slowMo: 0
});
assert.equal(fiverrLiveResult.success, true);
assert.equal(fiverrLiveResult.status, 'DRAFT_SAVED');
assert.equal(mockFiverrPage.navigatedUrls[0], 'https://www.fiverr.com/manage_gigs/new');
assert.ok(mockFiverrPage.fileUploads.some(f => f.filePath === payloadAiFiverr.gallery.thumbnailPath), 'Gallery thumbnail must be uploaded');
assert.ok(mockFiverrPage.clicks.includes(fv.steps.step6_publish.selectors.saveAsDraft.selector), 'Must click saveAsDraft on step 6');
assert.ok(!mockFiverrPage.clicks.includes(fv.steps.step6_publish.selectors.forbiddenPublish.selector), 'Must NEVER click forbiddenPublish');
console.log('  ✅ Fiverr 6-steps live injection workflow verified.');

// ---------------------------------------------------------------------------
// Test 17: Strict Safety Guardrail with selector configuration objects
// ---------------------------------------------------------------------------
console.log('Test 17: Enforcing safety guardrails on selector configuration objects');
assert.throws(() => {
  enforceSafetyDraftOnly(cu.selectors.actions.forbiddenPublish);
}, SafetyViolationError, 'Must reject ComeUp forbiddenPublish selector config');

assert.throws(() => {
  enforceSafetyDraftOnly(fv.steps.step6_publish.selectors.forbiddenPublish);
}, SafetyViolationError, 'Must reject Fiverr forbiddenPublish selector config');

assert.throws(() => {
  enforceSafetyDraftOnly({ safetyLevel: 'FORBIDDEN', name: 'Auto Submit' });
}, SafetyViolationError, 'Must reject any FORBIDDEN action object');

assert.doesNotThrow(() => {
  enforceSafetyDraftOnly(cu.selectors.actions.saveDraft);
}, 'Must allow ComeUp saveDraft selector config');

assert.doesNotThrow(() => {
  enforceSafetyDraftOnly(fv.steps.step6_publish.selectors.saveAsDraft);
}, 'Must allow Fiverr saveAsDraft selector config');
console.log('  ✅ Safety guardrail verified on selector configuration objects.');

// ---------------------------------------------------------------------------
// Test 18: CLI argument parser advanced options (--variant, --slowmo, uppercase platforms)
// ---------------------------------------------------------------------------
console.log('Test 18: Testing advanced CLI argument parser options');
const pAdv = parseInjectorCliArgs([
  '--gig=ai-rag-agent',
  '--platform=COMEUP',
  '--variant=navy-corporate',
  '--slowmo=150',
  '--cdp-url=localhost:9222'
]);
assert.equal(pAdv.gigSlug, 'ai-rag-agent');
assert.equal(pAdv.platform, 'comeup');
assert.equal(pAdv.preferredVariant, 'navy-corporate');
assert.equal(pAdv.slowMo, 150);
assert.equal(pAdv.cdpUrl, 'localhost:9222');

const pAdv2 = parseInjectorCliArgs(['--variant', 'dark-tech', '--slow-mo', '75']);
assert.equal(pAdv2.preferredVariant, 'dark-tech');
assert.equal(pAdv2.slowMo, 75);
console.log('  ✅ Advanced CLI options parser verified.');

// ---------------------------------------------------------------------------
// Test 19: Thumbnail resolver resilience and edge cases
// ---------------------------------------------------------------------------
console.log('Test 19: Testing thumbnail resolver resilience and edge cases');
const thumbNavy = resolveThumbnailPath('ai-rag-agent', 'comeup', 'navy-corporate');
assert.ok(fs.existsSync(thumbNavy), 'Navy corporate thumbnail variant must exist');
assert.ok(thumbNavy.includes('navy-corporate'), 'Resolved thumbnail must match requested variant');

assert.throws(() => {
  resolveThumbnailPath('ai-rag-agent', 'comeup', 'dark-tech', path.join(ROOT_DIR, 'non-existent-thumbnails-dir'));
}, /Dossier de miniatures introuvable/, 'Should throw when thumbnails directory does not exist');
console.log('  ✅ Thumbnail resolver resilience verified.');

// ---------------------------------------------------------------------------
// Test 20: Windows batch script non-interactive execution support (--no-pause)
// ---------------------------------------------------------------------------
console.log('Test 20: Verifying start-chrome-debug.bat non-interactive execution (--no-pause)');
assert.ok(batContent.includes('--no-pause'), 'Batch script must support --no-pause parameter for automation');
console.log('  ✅ start-chrome-debug.bat automation friendliness verified.');

console.log('\n🎉 ALL 20 BROWSER INJECTOR TESTS PASSED SUCCESSFULLY!\n');

