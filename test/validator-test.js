/**
 * Automated test suite for freelance-gigs-studio validator & exporter
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGig, validateAllGigs } from '../core/gig-validator.js';
import { exportAllGigs } from '../core/export-gigs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Running Freelance Gigs Studio Test Suite...\n');

// 1. Test existing master gigs
console.log('Test 1: Validating all canonical master gigs in data/gigs/');
const canonicalResults = validateAllGigs();
assert.equal(canonicalResults.length, 2, 'Should have exactly 2 master gigs');
for (const res of canonicalResults) {
  assert.equal(res.valid, true, `Gig ${res.sourceFile} should be valid. Errors: ${res.errors.join('; ')}`);
  assert.equal(res.errors.length, 0, `Gig ${res.sourceFile} should have 0 errors`);
}
console.log('  ✅ Master gigs are 100% valid.');

// Clone a valid gig for mutation testing
const baseGig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/gigs/ai-rag-agent.json'), 'utf8'));

// 2. Test Fiverr title > 80 chars
console.log('Test 2: Reject Fiverr title > 80 chars');
const gigTitleTooLong = JSON.parse(JSON.stringify(baseGig));
gigTitleTooLong.platforms.fiverr.title = 'I will ' + 'a'.repeat(75); // 82 chars
const resTitle = validateGig(gigTitleTooLong);
assert.equal(resTitle.valid, false, 'Should fail when title > 80 chars');
assert.ok(resTitle.errors.some(e => e.includes('Titre trop long')), 'Should detect long title');
console.log('  ✅ Title length limit correctly enforced.');

// 3. Test Fiverr title prefix
console.log('Test 3: Reject Fiverr title not starting with "I will"');
const gigTitlePrefix = JSON.parse(JSON.stringify(baseGig));
gigTitlePrefix.platforms.fiverr.title = 'Build custom AI agents and secure RAG pipelines with MCP';
const resPrefix = validateGig(gigTitlePrefix);
assert.equal(resPrefix.valid, false, 'Should fail when title does not start with "I will"');
assert.ok(resPrefix.errors.some(e => e.includes("doit commencer par 'I will'")), 'Should enforce "I will" prefix');
console.log('  ✅ Fiverr prefix correctly enforced.');

// 4. Test Fiverr tags count !== 5
console.log('Test 4: Reject Fiverr tags count !== 5');
const gigBadTags = JSON.parse(JSON.stringify(baseGig));
gigBadTags.platforms.fiverr.tags = ['ai-agent', 'rag', 'mcp']; // 3 tags
const resTags = validateGig(gigBadTags);
assert.equal(resTags.valid, false, 'Should fail when tags count !== 5');
assert.ok(resTags.errors.some(e => e.includes('exactement 5 tags')), 'Should enforce exactly 5 tags');
console.log('  ✅ 5 tags requirement correctly enforced.');

// 5. Test Fiverr description > 1200 chars
console.log('Test 5: Reject Fiverr description > 1200 chars');
const gigDescTooLong = JSON.parse(JSON.stringify(baseGig));
gigDescTooLong.platforms.fiverr.description = 'a'.repeat(1201);
const resDesc = validateGig(gigDescTooLong);
assert.equal(resDesc.valid, false, 'Should fail when description > 1200 chars');
assert.ok(resDesc.errors.some(e => e.includes('Description trop longue')), 'Should enforce 1200 chars limit');
console.log('  ✅ Description length limit correctly enforced.');

// 6. Test Fiverr package description > 100 chars
console.log('Test 6: Reject Fiverr package description > 100 chars');
const gigPkgDesc = JSON.parse(JSON.stringify(baseGig));
gigPkgDesc.platforms.fiverr.packages.basic.description = 'b'.repeat(101);
const resPkg = validateGig(gigPkgDesc);
assert.equal(resPkg.valid, false, 'Should fail when package description > 100 chars');
assert.ok(resPkg.errors.some(e => e.includes('trop longue : 101 car')), 'Should enforce 100 chars package limit');
console.log('  ✅ Package description 100 chars limit correctly enforced.');

// 7. Test ComeUp title prefix "Je vais"
console.log('Test 7: Reject ComeUp title not starting with "Je vais"');
const gigComeupTitle = JSON.parse(JSON.stringify(baseGig));
gigComeupTitle.platforms.comeup.title = 'Création d\'Agent IA sur-mesure et système RAG';
const resComeupTitle = validateGig(gigComeupTitle);
assert.equal(resComeupTitle.valid, false, 'Should fail when ComeUp title does not start with "Je vais"');
assert.ok(resComeupTitle.errors.some(e => e.includes("DOIT commencer par 'Je vais'")), 'Should enforce "Je vais" prefix');
console.log('  ✅ ComeUp "Je vais" prefix correctly enforced.');

// 8. Test ComeUp forbidden HTML tags (e.g. <script>)
console.log('Test 8: Reject ComeUp forbidden HTML tags (<script>)');
const gigBadHtml = JSON.parse(JSON.stringify(baseGig));
gigBadHtml.platforms.comeup.description += '<script>alert(1)</script>';
const resBadHtml = validateGig(gigBadHtml);
assert.equal(resBadHtml.valid, false, 'Should fail on forbidden HTML tag');
assert.ok(resBadHtml.errors.some(e => e.includes('<script>')), 'Should detect forbidden <script> tag');
console.log('  ✅ Forbidden HTML tag correctly rejected.');

// 9. Test ComeUp forbidden direct email contact
console.log('Test 9: Reject ComeUp direct email contact in description');
const gigEmail = JSON.parse(JSON.stringify(baseGig));
gigEmail.platforms.comeup.description += '<p>Contactez-moi à direct@test.com</p>';
const resEmail = validateGig(gigEmail);
assert.equal(resEmail.valid, false, 'Should fail when direct email is present in description');
assert.ok(resEmail.errors.some(e => e.includes('Adresse email directe interdite')), 'Should detect email leak');
console.log('  ✅ Direct email forbidden pattern correctly enforced.');

// 10. Test Exporter execution & file generation
console.log('Test 10: Run exporter and verify output files');
const exports = exportAllGigs();
assert.equal(exports.length, 2, 'Should export 2 gigs');
const expectedFiles = [
  'INDEX.md',
  'ai-rag-agent-comeup.html',
  'ai-rag-agent-comeup.md',
  'ai-rag-agent-fiverr.md',
  'laravel-fullstack-comeup.html',
  'laravel-fullstack-comeup.md',
  'laravel-fullstack-fiverr.md'
];
const exportsDir = path.resolve(__dirname, '../data/output/exports');
for (const file of expectedFiles) {
  const fullPath = path.join(exportsDir, file);
  assert.ok(fs.existsSync(fullPath), `Exported file ${file} should exist`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.size > 0, `Exported file ${file} should not be empty`);
}
console.log('  ✅ All exported files verified and non-empty.');

console.log('\n🎉 ALL 10 TESTS PASSED SUCCESFULLY!\n');
