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
const gigBadTagsCount = JSON.parse(JSON.stringify(baseGig));
gigBadTagsCount.platforms.fiverr.tags = ['ai agent', 'rag system', 'mcp server']; // 3 tags
const resTagsCount = validateGig(gigBadTagsCount);
assert.equal(resTagsCount.valid, false, 'Should fail when tags count !== 5');
assert.ok(resTagsCount.errors.some(e => e.includes('exactement 5 tags')), 'Should enforce exactly 5 tags');
console.log('  ✅ 5 tags requirement correctly enforced.');

// 5. Test Fiverr tags with hyphens or special characters
console.log('Test 5: Reject Fiverr tags containing hyphens or special characters');
const gigHyphenTags = JSON.parse(JSON.stringify(baseGig));
gigHyphenTags.platforms.fiverr.tags[0] = 'ai-agent';
const resHyphenTags = validateGig(gigHyphenTags);
assert.equal(resHyphenTags.valid, false, 'Should fail when tag has hyphen');
assert.ok(resHyphenTags.errors.some(e => e.includes('caractères invalides')), 'Should reject hyphen in tag');
console.log('  ✅ Fiverr tag character restrictions (alphanumeric + space only) correctly enforced.');

// 6. Test Fiverr tag > 20 chars
console.log('Test 6: Reject Fiverr tag > 20 chars');
const gigLongTag = JSON.parse(JSON.stringify(baseGig));
gigLongTag.platforms.fiverr.tags[0] = 'a'.repeat(21);
const resLongTag = validateGig(gigLongTag);
assert.equal(resLongTag.valid, false, 'Should fail when tag > 20 chars');
assert.ok(resLongTag.errors.some(e => e.includes('dépasse 20 car')), 'Should reject tag > 20 chars');
console.log('  ✅ Fiverr tag 20 chars limit correctly enforced.');

// 7. Test Fiverr description > 1200 chars
console.log('Test 7: Reject Fiverr description > 1200 chars');
const gigDescTooLong = JSON.parse(JSON.stringify(baseGig));
gigDescTooLong.platforms.fiverr.description = 'a'.repeat(1201);
const resDesc = validateGig(gigDescTooLong);
assert.equal(resDesc.valid, false, 'Should fail when description > 1200 chars');
assert.ok(resDesc.errors.some(e => e.includes('Description trop longue')), 'Should enforce 1200 chars limit');
console.log('  ✅ Description length limit correctly enforced.');

// 8. Test Fiverr contact leak detection in description
console.log('Test 8: Reject direct contact info in Fiverr description');
const gigFiverrContact = JSON.parse(JSON.stringify(baseGig));
gigFiverrContact.platforms.fiverr.description += '\nContact me at direct@myagency.com or wa.me/12345';
const resFiverrContact = validateGig(gigFiverrContact);
assert.equal(resFiverrContact.valid, false, 'Should fail when Fiverr description has contact leak');
assert.ok(resFiverrContact.errors.some(e => e.includes('Coordonnées ou lien direct interdit')), 'Should catch contact leak on Fiverr');
console.log('  ✅ Fiverr contact leak protection correctly enforced.');

// 9. Test Fiverr package description > 100 chars
console.log('Test 9: Reject Fiverr package description > 100 chars');
const gigPkgDesc = JSON.parse(JSON.stringify(baseGig));
gigPkgDesc.platforms.fiverr.packages.basic.description = 'b'.repeat(101);
const resPkg = validateGig(gigPkgDesc);
assert.equal(resPkg.valid, false, 'Should fail when package description > 100 chars');
assert.ok(resPkg.errors.some(e => e.includes('trop longue : 101 car')), 'Should enforce 100 chars package limit');
console.log('  ✅ Package description 100 chars limit correctly enforced.');

// 10. Test Fiverr price monotonicity (Basic < Standard < Premium)
console.log('Test 10: Reject inverted Fiverr tiered pricing (Basic > Standard)');
const gigInvertedPrice = JSON.parse(JSON.stringify(baseGig));
gigInvertedPrice.platforms.fiverr.packages.basic.price = 300;
gigInvertedPrice.platforms.fiverr.packages.standard.price = 150;
const resInvertedPrice = validateGig(gigInvertedPrice);
assert.equal(resInvertedPrice.valid, false, 'Should fail when tiered pricing is not monotonically increasing');
assert.ok(resInvertedPrice.errors.some(e => e.includes('Incohérence des tarifs')), 'Should detect inverted pricing');
console.log('  ✅ Pricing monotonicity (Basic < Standard < Premium) correctly enforced.');

// 11. Test ComeUp title prefix "Je vais"
console.log('Test 11: Reject ComeUp title not starting with "Je vais"');
const gigComeupTitle = JSON.parse(JSON.stringify(baseGig));
gigComeupTitle.platforms.comeup.title = 'Création d\'Agent IA sur-mesure et système RAG';
const resComeupTitle = validateGig(gigComeupTitle);
assert.equal(resComeupTitle.valid, false, 'Should fail when ComeUp title does not start with "Je vais"');
assert.ok(resComeupTitle.errors.some(e => e.includes("DOIT commencer par 'Je vais'")), 'Should enforce "Je vais" prefix');
console.log('  ✅ ComeUp "Je vais" prefix correctly enforced.');

// 12. Test ComeUp title > 90 chars
console.log('Test 12: Reject ComeUp title > 90 chars');
const gigComeupLongTitle = JSON.parse(JSON.stringify(baseGig));
gigComeupLongTitle.platforms.comeup.title = 'Je vais ' + 'a'.repeat(85); // 93 chars
const resComeupLongTitle = validateGig(gigComeupLongTitle);
assert.equal(resComeupLongTitle.valid, false, 'Should fail when ComeUp title > 90 chars');
assert.ok(resComeupLongTitle.errors.some(e => e.includes('Titre trop long')), 'Should detect long ComeUp title');
console.log('  ✅ ComeUp title 90 chars limit correctly enforced.');

// 13. Test ComeUp base offer price multiple of 5 €
console.log('Test 13: Reject ComeUp base offer price not multiple of 5 €');
const gigComeupBadPrice = JSON.parse(JSON.stringify(baseGig));
gigComeupBadPrice.platforms.comeup.baseOffer.price = 23;
const resComeupBadPrice = validateGig(gigComeupBadPrice);
assert.equal(resComeupBadPrice.valid, false, 'Should fail when base price is not multiple of 5');
assert.ok(resComeupBadPrice.errors.some(e => e.includes('multiple de 5 €')), 'Should enforce multiple of 5');
console.log('  ✅ ComeUp base offer 5 € increment rule correctly enforced.');

// 14. Test ComeUp option price multiple of 5 €
console.log('Test 14: Reject ComeUp option price not multiple of 5 €');
const gigComeupBadOptPrice = JSON.parse(JSON.stringify(baseGig));
gigComeupBadOptPrice.platforms.comeup.options[0].price = 47;
const resComeupBadOptPrice = validateGig(gigComeupBadOptPrice);
assert.equal(resComeupBadOptPrice.valid, false, 'Should fail when option price is not multiple of 5');
assert.ok(resComeupBadOptPrice.errors.some(e => e.includes('multiple de 5 €')), 'Should enforce multiple of 5 on options');
console.log('  ✅ ComeUp option 5 € increment rule correctly enforced.');

// 15. Test ComeUp forbidden HTML tags (<script>)
console.log('Test 15: Reject ComeUp forbidden HTML tags (<script>)');
const gigBadHtml = JSON.parse(JSON.stringify(baseGig));
gigBadHtml.platforms.comeup.description += '<script>alert(1)</script>';
const resBadHtml = validateGig(gigBadHtml);
assert.equal(resBadHtml.valid, false, 'Should fail on forbidden HTML tag');
assert.ok(resBadHtml.errors.some(e => e.includes('<script>')), 'Should detect forbidden <script> tag');
console.log('  ✅ Forbidden HTML tag correctly rejected.');

// 16. Test ComeUp dangerous attributes (onclick / javascript:)
console.log('Test 16: Reject ComeUp dangerous attributes (onclick, javascript:)');
const gigDangerousAttr = JSON.parse(JSON.stringify(baseGig));
gigDangerousAttr.platforms.comeup.description += '<p onclick="alert(1)">Cliquez ici</p>';
const resDangerousAttr = validateGig(gigDangerousAttr);
assert.equal(resDangerousAttr.valid, false, 'Should fail on inline event handler');
assert.ok(resDangerousAttr.errors.some(e => e.includes('Attributs non sécurisés')), 'Should detect dangerous attribute');
console.log('  ✅ Dangerous HTML attributes correctly rejected.');

// 17. Test ComeUp direct email / phone leak
console.log('Test 17: Reject ComeUp direct email contact in description');
const gigEmail = JSON.parse(JSON.stringify(baseGig));
gigEmail.platforms.comeup.description += '<p>Contactez-moi à direct@test.com</p>';
const resEmail = validateGig(gigEmail);
assert.equal(resEmail.valid, false, 'Should fail when direct email is present in description');
assert.ok(resEmail.errors.some(e => e.includes('Adresse email directe interdite')), 'Should detect email leak');
console.log('  ✅ Direct email forbidden pattern correctly enforced.');

// 18. Test Exporter execution & file generation
console.log('Test 18: Run exporter and verify output files');
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

// 19. Test INDEX.md relative links format
console.log('Test 19: Verify INDEX.md uses portable relative links');
const indexContent = fs.readFileSync(path.join(exportsDir, 'INDEX.md'), 'utf8');
assert.ok(!indexContent.includes('file:///'), 'INDEX.md should not contain machine-specific file:/// URLs');
assert.ok(indexContent.includes('./ai-rag-agent-comeup.html'), 'INDEX.md should contain relative links');
console.log('  ✅ Relative links in INDEX.md verified.');

// 20. Test Exporter resilience (defensive handling of missing features or 1 option)
console.log('Test 20: Exporter resilience with minimal options & empty features');
const minimalGig = JSON.parse(JSON.stringify(baseGig));
minimalGig.id = 'gig-test';
minimalGig.slug = 'test-minimal';
minimalGig.platforms.comeup.options = [minimalGig.platforms.comeup.options[0]]; // Exactly 1 option
delete minimalGig.platforms.fiverr.packages.basic.features; // Missing features
delete minimalGig.platforms.fiverr.packages.standard.features;
delete minimalGig.platforms.fiverr.packages.premium.features;
const tempGigPath = path.resolve(__dirname, '../data/gigs/test-minimal.json');
try {
  fs.writeFileSync(tempGigPath, JSON.stringify(minimalGig, null, 2), 'utf8');
  assert.doesNotThrow(() => {
    exportAllGigs();
  }, 'exportAllGigs should not throw on minimal options or missing features');
} finally {
  if (fs.existsSync(tempGigPath)) fs.unlinkSync(tempGigPath);
  // Re-export clean files and remove temp minimal outputs
  exportAllGigs();
  for (const f of ['test-minimal-comeup.html', 'test-minimal-comeup.md', 'test-minimal-fiverr.md']) {
    const p = path.join(exportsDir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
console.log('  ✅ Exporter resilience verified.');

console.log('\n🎉 ALL 20 TESTS PASSED SUCCESFULLY!\n');
