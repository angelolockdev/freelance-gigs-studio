/**
 * Automated Test Suite for Freelance Gigs Studio Dashboard (Phase 5)
 *
 * Validates Express server lifecycle, static file serving, REST API endpoints,
 * CDP diagnostic handling, dry-run simulation, radar filtering, and clean shutdown.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, startServer, checkCdpStatus, getThumbnailsForSlug, getExportsForSlug } from '../dashboard/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PORT = 3849;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

console.log('🧪 Running Freelance Gigs Studio Dashboard Test Suite (Phase 5)...\n');

let server = null;

try {
  // ========================================================
  // Test 1: Start Express server on test port
  // ========================================================
  console.log(`Test 1: Starting Express server on test port ${TEST_PORT}`);
  server = startServer(TEST_PORT);
  assert.ok(server, 'Server instance should be returned');
  
  // Wait a moment for server to bind
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.ok(server.listening, 'Server should be actively listening');
  console.log('  ✅ Server started and listening successfully.');

  // ========================================================
  // Test 2: Helper functions unit tests
  // ========================================================
  console.log('Test 2: Verifying helper functions (checkCdpStatus, getThumbnailsForSlug, getExportsForSlug)');
  const cdpCheck = await checkCdpStatus('http://localhost:9222', 150);
  assert.equal(typeof cdpCheck.connected, 'boolean', 'CDP check should return boolean connected');
  assert.equal(cdpCheck.port, 9222, 'CDP port should be 9222');

  const ragThumbs = getThumbnailsForSlug('ai-rag-agent');
  assert.ok(Array.isArray(ragThumbs), 'Thumbnails should be an array');
  assert.ok(ragThumbs.length > 0, 'Should find thumbnails for ai-rag-agent');
  assert.ok(ragThumbs.some(t => t.filename.endsWith('.png')), 'Should contain PNG thumbnails');

  const ragExports = getExportsForSlug('ai-rag-agent');
  assert.ok(Array.isArray(ragExports), 'Exports should be an array');
  assert.ok(ragExports.length >= 3, 'Should find at least 3 exports for ai-rag-agent');

  // Delimiter boundary check: "ai-rag" prefix should NOT match "ai-rag-agent" files
  const prefixThumbs = getThumbnailsForSlug('ai-rag');
  assert.equal(prefixThumbs.length, 0, 'Prefix without delimiter should not match other gigs');
  const prefixExports = getExportsForSlug('ai-rag');
  assert.equal(prefixExports.length, 0, 'Prefix without delimiter should not match other gigs');
  console.log('  ✅ Helper functions verified.');

  // ========================================================
  // Test 3: GET /api/status endpoint
  // ========================================================
  console.log('Test 3: Testing GET /api/status endpoint');
  const resStatus = await fetch(`${BASE_URL}/api/status`);
  assert.equal(resStatus.status, 200, 'Status endpoint should return 200');
  const dataStatus = await resStatus.json();
  assert.equal(dataStatus.status, 'online', 'Status should be online');
  assert.equal(dataStatus.version, '1.0.0', 'Version should be 1.0.0');
  assert.equal(dataStatus.author, 'Angelo Lock To Hang', 'Author should match');
  assert.ok(typeof dataStatus.uptimeSeconds === 'number', 'Uptime should be numeric');
  assert.ok(dataStatus.counts, 'Counts object should be present');
  assert.equal(dataStatus.counts.gigs, 2, 'Should report 2 canonical gigs');
  assert.ok(dataStatus.counts.thumbnails >= 20, 'Should report 20+ thumbnails');
  assert.ok(dataStatus.counts.exports >= 6, 'Should report 6+ exports');
  console.log('  ✅ GET /api/status verified.');

  // ========================================================
  // Test 4: GET /api/gigs catalog list
  // ========================================================
  console.log('Test 4: Testing GET /api/gigs catalog list');
  const resGigs = await fetch(`${BASE_URL}/api/gigs`);
  assert.equal(resGigs.status, 200, 'Gigs endpoint should return 200');
  const dataGigs = await resGigs.json();
  assert.equal(dataGigs.total, 2, 'Should return total of 2 gigs');
  assert.equal(dataGigs.gigs.length, 2, 'Gigs array should have length 2');

  const slugs = dataGigs.gigs.map(g => g.slug);
  assert.ok(slugs.includes('ai-rag-agent'), 'Should contain ai-rag-agent');
  assert.ok(slugs.includes('laravel-fullstack'), 'Should contain laravel-fullstack');

  for (const g of dataGigs.gigs) {
    assert.equal(g.validation.valid, true, `Gig ${g.slug} should be 100% valid`);
    assert.ok(g.thumbnails.length > 0, `Gig ${g.slug} should have thumbnails`);
    assert.ok(g.exports.length > 0, `Gig ${g.slug} should have exports`);
  }
  console.log('  ✅ GET /api/gigs verified.');

  // ========================================================
  // Test 5: GET /api/gigs/:slug detail (ai-rag-agent)
  // ========================================================
  console.log('Test 5: Testing GET /api/gigs/ai-rag-agent detail');
  const resGigRag = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent`);
  assert.equal(resGigRag.status, 200, 'Specific gig should return 200');
  const dataGigRag = await resGigRag.json();
  assert.equal(dataGigRag.gig.slug, 'ai-rag-agent');
  assert.equal(dataGigRag.gig.platforms.comeup.baseOffer.price, 25);
  assert.equal(dataGigRag.gig.platforms.fiverr.packages.standard.price, 180);
  assert.equal(dataGigRag.validation.valid, true);
  console.log('  ✅ GET /api/gigs/ai-rag-agent verified.');

  // ========================================================
  // Test 6: GET /api/gigs/:slug detail (laravel-fullstack)
  // ========================================================
  console.log('Test 6: Testing GET /api/gigs/laravel-fullstack detail');
  const resGigWeb = await fetch(`${BASE_URL}/api/gigs/laravel-fullstack`);
  assert.equal(resGigWeb.status, 200, 'Specific gig should return 200');
  const dataGigWeb = await resGigWeb.json();
  assert.equal(dataGigWeb.gig.slug, 'laravel-fullstack');
  assert.equal(dataGigWeb.gig.platforms.comeup.baseOffer.price, 35);
  assert.equal(dataGigWeb.gig.platforms.fiverr.packages.standard.price, 190);
  console.log('  ✅ GET /api/gigs/laravel-fullstack verified.');

  // ========================================================
  // Test 7: GET /api/gigs/:slug 404 for unknown slug
  // ========================================================
  console.log('Test 7: Testing GET /api/gigs/unknown-slug returns 404');
  const resNotFound = await fetch(`${BASE_URL}/api/gigs/non-existent-gig`);
  assert.equal(resNotFound.status, 404, 'Unknown gig should return 404');
  const dataNotFound = await resNotFound.json();
  assert.ok(dataNotFound.error.includes('introuvable'), 'Error message should mention not found');
  assert.ok(Array.isArray(dataNotFound.available), 'Should list available gigs');
  console.log('  ✅ Unknown gig 404 verified.');

  // ========================================================
  // Test 8: POST /api/gigs/:slug/validate
  // ========================================================
  console.log('Test 8: Testing POST /api/gigs/ai-rag-agent/validate');
  const resValidate = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent/validate`, { method: 'POST' });
  assert.equal(resValidate.status, 200, 'Validation endpoint should return 200');
  const dataValidate = await resValidate.json();
  assert.equal(dataValidate.slug, 'ai-rag-agent');
  assert.equal(dataValidate.valid, true);
  assert.equal(dataValidate.errors.length, 0);
  assert.equal(dataValidate.stats.fiverr.tagsCount, 5);
  console.log('  ✅ POST /api/gigs/:slug/validate verified.');

  // ========================================================
  // Test 9: POST /api/gigs/:slug/validate on invalid slug
  // ========================================================
  console.log('Test 9: Testing POST /api/gigs/bad-slug/validate returns 404');
  const resValBad = await fetch(`${BASE_URL}/api/gigs/bad-slug/validate`, { method: 'POST' });
  assert.equal(resValBad.status, 404);
  console.log('  ✅ Validation 404 verified.');

  // ========================================================
  // Test 10: POST /api/gigs/:slug/export
  // ========================================================
  console.log('Test 10: Testing POST /api/gigs/ai-rag-agent/export');
  const resExport = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent/export`, { method: 'POST' });
  assert.equal(resExport.status, 200, 'Export endpoint should return 200');
  const dataExport = await resExport.json();
  assert.equal(dataExport.success, true);
  assert.equal(dataExport.slug, 'ai-rag-agent');
  assert.ok(dataExport.files.length >= 3, 'Should generate ComeUp HTML, ComeUp MD, Fiverr MD');
  console.log('  ✅ POST /api/gigs/:slug/export verified.');

  // Test 10b: POST /api/gigs/:slug/export on invalid slug returns 404
  console.log('Test 10b: Testing POST /api/gigs/bad-slug/export returns 404');
  const resExportBad = await fetch(`${BASE_URL}/api/gigs/bad-slug/export`, { method: 'POST' });
  assert.equal(resExportBad.status, 404, 'Unknown gig export should return 404');
  console.log('  ✅ Export 404 verified.');

  // Test 10c: POST /api/gigs/:slug/thumbnails on invalid slug returns 404
  console.log('Test 10c: Testing POST /api/gigs/bad-slug/thumbnails returns 404');
  const resThumbBad = await fetch(`${BASE_URL}/api/gigs/bad-slug/thumbnails`, { method: 'POST' });
  assert.equal(resThumbBad.status, 404, 'Unknown gig thumbnails should return 404');
  console.log('  ✅ Thumbnails 404 verified.');

  // Test 10d: POST /api/gigs/:slug/thumbnails targeted Playwright compilation
  console.log('Test 10d: Testing POST /api/gigs/ai-rag-agent/thumbnails targeted generation');
  const resThumbGen = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent/thumbnails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variant: 'dark-tech', platform: 'comeup' })
  });
  assert.equal(resThumbGen.status, 200, 'Thumbnails generation should return 200');
  const dataThumbGen = await resThumbGen.json();
  assert.equal(dataThumbGen.success, true);
  assert.equal(dataThumbGen.slug, 'ai-rag-agent');
  assert.ok(dataThumbGen.generatedCount >= 1, 'Should generate at least 1 view');
  assert.ok(Array.isArray(dataThumbGen.thumbnails));
  console.log('  ✅ POST /api/gigs/:slug/thumbnails targeted generation verified.');

  // ========================================================
  // Test 11: POST /api/gigs/:slug/inject Dry-Run (ComeUp)
  // ========================================================
  console.log('Test 11: Testing POST /api/gigs/ai-rag-agent/inject Dry-Run for ComeUp');
  const resInjectComeup = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'comeup',
      variant: 'dark-tech',
      dryRun: true
    })
  });
  assert.equal(resInjectComeup.status, 200, 'Dry-run should succeed with 200');
  const dataInjectComeup = await resInjectComeup.json();
  assert.equal(dataInjectComeup.success, true);
  assert.equal(dataInjectComeup.dryRun, true);
  assert.equal(dataInjectComeup.safetyPolicy, 'STRICT_DRAFT_ONLY');
  assert.equal(dataInjectComeup.results.comeup.totalSteps, 8);
  console.log('  ✅ Dry-run ComeUp injection verified.');

  // ========================================================
  // Test 12: POST /api/gigs/:slug/inject Dry-Run (Fiverr)
  // ========================================================
  console.log('Test 12: Testing POST /api/gigs/ai-rag-agent/inject Dry-Run for Fiverr');
  const resInjectFiverr = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'fiverr',
      variant: 'navy-corporate',
      dryRun: true
    })
  });
  assert.equal(resInjectFiverr.status, 200, 'Dry-run should succeed with 200');
  const dataInjectFiverr = await resInjectFiverr.json();
  assert.equal(dataInjectFiverr.success, true);
  assert.equal(dataInjectFiverr.dryRun, true);
  assert.equal(dataInjectFiverr.results.fiverr.totalSteps, 6);
  console.log('  ✅ Dry-run Fiverr injection verified.');

  // ========================================================
  // Test 13: POST /api/gigs/:slug/inject Dry-Run (All Platforms)
  // ========================================================
  console.log('Test 13: Testing POST /api/gigs/laravel-fullstack/inject Dry-Run for all platforms');
  const resInjectAll = await fetch(`${BASE_URL}/api/gigs/laravel-fullstack/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'all',
      dryRun: true
    })
  });
  assert.equal(resInjectAll.status, 200);
  const dataInjectAll = await resInjectAll.json();
  assert.ok(dataInjectAll.results.comeup, 'Should contain comeup result');
  assert.ok(dataInjectAll.results.fiverr, 'Should contain fiverr result');
  console.log('  ✅ Dry-run all platforms verified.');

  // Test 13b: POST /api/gigs/:slug/inject on invalid slug returns 404
  console.log('Test 13b: Testing POST /api/gigs/bad-slug/inject returns 404');
  const resInjectBad = await fetch(`${BASE_URL}/api/gigs/bad-slug/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform: 'all', dryRun: true })
  });
  assert.equal(resInjectBad.status, 404, 'Unknown gig inject should return 404');
  console.log('  ✅ Inject 404 verified.');

  // ========================================================
  // Test 14: POST /api/gigs/:slug/inject CDP failure handling when Chrome offline
  // ========================================================
  console.log('Test 14: Testing POST /api/gigs/:slug/inject CDP live error handling');
  const resInjectLiveFail = await fetch(`${BASE_URL}/api/gigs/ai-rag-agent/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform: 'comeup',
      dryRun: false, // Live CDP mode
      cdpUrl: 'http://localhost:9222'
    })
  });
  // Since Chrome CDP is likely not running in headless automated test, it should return 503 CdpConnectionError
  assert.ok([200, 503].includes(resInjectLiveFail.status), 'Should return 503 if Chrome not running or 200 if open');
  if (resInjectLiveFail.status === 503) {
    const dataFail = await resInjectLiveFail.json();
    assert.equal(dataFail.success, false);
    assert.ok(dataFail.hint.includes('start-chrome-debug.bat'));
  }
  console.log('  ✅ Live CDP connection resilience and diagnostic verified.');

  // ========================================================
  // Test 15: GET /api/radar/jobs endpoint
  // ========================================================
  console.log('Test 15: Testing GET /api/radar/jobs endpoint');
  const resRadar = await fetch(`${BASE_URL}/api/radar/jobs`);
  assert.equal(resRadar.status, 200, 'Radar jobs should return 200');
  const dataRadar = await resRadar.json();
  assert.ok(Array.isArray(dataRadar.jobs), 'Jobs should be an array');
  assert.ok(dataRadar.total >= 10, 'Should load existing jobs cache (at least 10)');
  assert.ok(dataRadar.stats, 'Stats object should be present');
  assert.ok(typeof dataRadar.stats.highMatchCount === 'number');
  assert.ok(typeof dataRadar.stats.averageScore === 'number');
  console.log('  ✅ GET /api/radar/jobs verified.');

  // ========================================================
  // Test 16: GET /api/radar/jobs filtering parameters
  // ========================================================
  console.log('Test 16: Testing GET /api/radar/jobs with minScore and source filters');
  const resFiltered = await fetch(`${BASE_URL}/api/radar/jobs?source=upwork&minScore=50`);
  assert.equal(resFiltered.status, 200);
  const dataFiltered = await resFiltered.json();
  for (const j of dataFiltered.jobs) {
    assert.ok(j.matchScore >= 50, `Job score ${j.matchScore} should be >= 50`);
    assert.ok(j.source.includes('upwork'), `Job source ${j.source} should be upwork`);
  }
  console.log('  ✅ Radar filters (source & minScore) verified.');

  // ========================================================
  // Test 17: GET /api/jobs route alias
  // ========================================================
  console.log('Test 17: Testing GET /api/jobs route alias');
  const resJobsAlias = await fetch(`${BASE_URL}/api/jobs`);
  assert.equal(resJobsAlias.status, 200);
  const dataJobsAlias = await resJobsAlias.json();
  assert.ok(Array.isArray(dataJobsAlias.jobs), 'Alias /api/jobs should return jobs array');
  console.log('  ✅ Route alias /api/jobs verified.');

  // ========================================================
  // Test 18: POST /api/radar/refresh endpoint
  // ========================================================
  console.log('Test 18: Testing POST /api/radar/refresh endpoint');
  const resRefresh = await fetch(`${BASE_URL}/api/radar/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'agent' })
  });
  assert.equal(resRefresh.status, 200);
  const dataRefresh = await resRefresh.json();
  assert.equal(dataRefresh.success, true);
  assert.ok(typeof dataRefresh.total === 'number');
  assert.ok(Array.isArray(dataRefresh.jobs));
  console.log('  ✅ POST /api/radar/refresh verified.');

  // ========================================================
  // Test 19: GET /api/strategy Value Equation & Pricing
  // ========================================================
  console.log('Test 19: Testing GET /api/strategy endpoint');
  const resStrat = await fetch(`${BASE_URL}/api/strategy`);
  assert.equal(resStrat.status, 200);
  const dataStrat = await resStrat.json();
  assert.ok(dataStrat.valueEquation, 'Should contain valueEquation');
  assert.ok(dataStrat.valueEquation.framework.includes('Alex Hormozi'));
  assert.ok(dataStrat.valueEquation.formula.includes('Valeur'));
  assert.ok(dataStrat.pricingStrategy.tiers['ai-rag-agent'], 'Should contain pricing for ai-rag-agent');
  assert.ok(dataStrat.pricingStrategy.tiers['laravel-fullstack'], 'Should contain pricing for laravel-fullstack');
  assert.ok(dataStrat.valueEquation.numerator.dreamOutcome, 'Should specify dreamOutcome');
  assert.ok(dataStrat.valueEquation.numerator.perceivedLikelihood, 'Should specify perceivedLikelihood');
  assert.ok(dataStrat.valueEquation.denominator.timeDelay, 'Should specify timeDelay');
  assert.ok(dataStrat.valueEquation.denominator.effortSacrifice, 'Should specify effortSacrifice');
  assert.ok(Array.isArray(dataStrat.skillsTaxonomy), 'Skills taxonomy should be present');
  assert.ok(Array.isArray(dataStrat.contextModifiers), 'Context modifiers should be present');
  console.log('  ✅ GET /api/strategy verified.');

  // ========================================================
  // Test 20: Static assets delivery (HTML, CSS, JS, Images, Exports)
  // ========================================================
  console.log('Test 20: Testing static assets delivery');
  // Root index.html
  const resIndex = await fetch(`${BASE_URL}/`);
  assert.equal(resIndex.status, 200);
  const htmlIndex = await resIndex.text();
  assert.ok(htmlIndex.includes('Freelance Gigs Studio'), 'index.html should have studio title');

  // CSS
  const resCss = await fetch(`${BASE_URL}/style.css`);
  assert.equal(resCss.status, 200);
  const css = await resCss.text();
  assert.ok(css.includes('nav-tab'), 'CSS should contain dashboard rules');

  // JS
  const resJs = await fetch(`${BASE_URL}/app.js`);
  assert.equal(resJs.status, 200);
  const js = await resJs.text();
  assert.ok(js.includes('switchTab'), 'app.js should contain client logic');

  // Thumbnails
  const resThumb = await fetch(`${BASE_URL}/thumbnails/ai-rag-agent-comeup-dark-tech.png`);
  assert.equal(resThumb.status, 200);
  assert.equal(resThumb.headers.get('content-type'), 'image/png');

  // Exports
  const resExportHtml = await fetch(`${BASE_URL}/exports/ai-rag-agent-comeup.html`);
  assert.equal(resExportHtml.status, 200);
  console.log('  ✅ Static files (HTML, CSS, JS, Thumbnails, Exports) verified.');

  // ========================================================
  // Test 21: Security headers & 404 API fallback
  // ========================================================
  console.log('Test 21: Verifying security headers and 404 fallback');
  assert.equal(resIndex.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(resIndex.headers.get('x-frame-options'), 'SAMEORIGIN');

  const resApi404 = await fetch(`${BASE_URL}/api/non-existent-route`);
  assert.equal(resApi404.status, 404);
  const dataApi404 = await resApi404.json();
  assert.ok(dataApi404.error.includes('Route API introuvable'));
  console.log('  ✅ Security headers and API 404 verified.');

  // ========================================================
  // Test 22: Server clean shutdown
  // ========================================================
  console.log('Test 22: Clean server shutdown');
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log('  ✅ Server cleanly stopped and port released.');

  console.log('\n🎉 ALL 26 DASHBOARD & EXPRESS TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);

} catch (err) {
  console.error('\n❌ TEST FAILURE in dashboard-test.js:');
  console.error(err);
  if (server && server.listening) {
    server.close();
  }
  process.exit(1);
}
