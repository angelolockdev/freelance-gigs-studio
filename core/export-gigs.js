/**
 * Freelance Gigs Studio - Gig Exporter
 *
 * Generates ready-to-copy Markdown and HTML files in data/output/exports/
 * for both ComeUp and Fiverr.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGig } from './gig-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GIGS_DIR = path.resolve(__dirname, '../data/gigs');
const EXPORTS_DIR = path.resolve(__dirname, '../data/output/exports');

/**
 * Génère le fichier d'export ComeUp (HTML + guide)
 */
function buildComeupHtml(gig) {
  const c = gig.platforms.comeup;
  const meta = gig.meta || {};

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>ComeUp Export - ${escapeHtml(gig.slug)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 900px; margin: 40px auto; padding: 0 20px; background: #f8fafc; }
    .card { background: white; border-radius: 12px; padding: 28px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    h1 { color: #0f172a; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-top: 0; }
    h2 { color: #1e40af; margin-top: 24px; }
    h3 { color: #1e293b; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #dbeafe; color: #1e40af; margin-right: 6px; }
    .copy-block { position: relative; background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all; max-height: 350px; overflow-y: auto; }
    .preview-box { border: 2px dashed #94a3b8; border-radius: 8px; padding: 24px; background: #ffffff; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; color: #475569; font-weight: 600; }
    .price-tag { font-size: 16px; font-weight: 700; color: #059669; }
    .faq-item { margin-bottom: 16px; padding: 12px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; }
  </style>
</head>
<body>

  <h1>🚀 ComeUp - Fiche Prête à l'Emploi : ${escapeHtml(gig.title_internal)}</h1>
  <p><strong>Auteur :</strong> ${escapeHtml(meta.author || 'Angelo Lock To Hang')} | <strong>Expérience :</strong> ${meta.experienceYears || 6}+ ans | <strong>Généré le :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>

  <!-- PARAMÈTRES DU FORMULAIRE -->
  <div class="card">
    <h2>📋 Informations Générales du Service</h2>
    <table>
      <tr>
        <th style="width: 25%;">Champ ComeUp</th>
        <th>Valeur à coller</th>
      </tr>
      <tr>
        <td><strong>Titre du service</strong></td>
        <td><strong style="color: #2563eb; font-size: 16px;">${escapeHtml(c.title)}</strong> (${c.title.length} caractères)</td>
      </tr>
      <tr>
        <td><strong>Catégorie</strong></td>
        <td>${escapeHtml(c.category)} &gt; ${escapeHtml(c.subcategory)}</td>
      </tr>
      <tr>
        <td><strong>Prix de base</strong></td>
        <td><span class="price-tag">${c.baseOffer.price} €</span> (Délai : ${c.baseOffer.deliveryDays} jours)</td>
      </tr>
      <tr>
        <td><strong>Description de base</strong></td>
        <td>${escapeHtml(c.baseOffer.description)}</td>
      </tr>
      <tr>
        <td><strong>Livrables inclus</strong></td>
        <td>
          <ul>
            ${c.baseOffer.deliverables.map(d => `<li>${escapeHtml(d)}</li>`).join('\n')}
          </ul>
        </td>
      </tr>
    </table>
  </div>

  <!-- TABLEAU DES OPTIONS -->
  <div class="card">
    <h2>⚡ Options Complémentaires</h2>
    <table>
      <thead>
        <tr>
          <th>Option</th>
          <th>Tarif</th>
          <th>Délai add.</th>
          <th>Description & Livrables</th>
        </tr>
      </thead>
      <tbody>
        ${c.options.map(opt => `
        <tr>
          <td><strong>${escapeHtml(opt.name)}</strong></td>
          <td><span class="price-tag">+${opt.price} €</span></td>
          <td>+${opt.additionalDays} jour(s)</td>
          <td>
            <p>${escapeHtml(opt.description)}</p>
            ${opt.deliverables ? `<ul>${opt.deliverables.map(d => `<li><small>${escapeHtml(d)}</small></li>`).join('')}</ul>` : ''}
          </td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- CODE HTML SOURCE POUR LA DESCRIPTION -->
  <div class="card">
    <h2>📝 Description Complète (Code HTML Source à Copier)</h2>
    <p><em>Copiez le code brut ci-dessous et collez-le directement en mode HTML dans l'éditeur de ComeUp :</em></p>
    <div class="copy-block">${escapeHtml(c.description)}</div>
  </div>

  <!-- APERÇU DU RENDU -->
  <div class="card">
    <h2>👁️ Aperçu Visuel de la Description</h2>
    <div class="preview-box">
      ${c.description}
    </div>
  </div>

  <!-- FAQ -->
  ${c.faq && c.faq.length > 0 ? `
  <div class="card">
    <h2>❓ Foire Aux Questions (FAQ)</h2>
    ${c.faq.map(item => `
      <div class="faq-item">
        <strong>Q : ${escapeHtml(item.question)}</strong>
        <p style="margin: 6px 0 0 0;">R : ${escapeHtml(item.answer)}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}

</body>
</html>`;
}

/**
 * Génère le fichier d'export ComeUp Markdown
 */
function buildComeupMarkdown(gig) {
  const c = gig.platforms.comeup;
  const meta = gig.meta || {};

  return `# 🚀 ComeUp Export : ${gig.title_internal}

- **Titre ComeUp :** \`${c.title}\` (${c.title.length} car.)
- **Catégorie :** ${c.category} > ${c.subcategory}
- **Auteur :** ${meta.author} (Expérience : ${meta.experienceYears}+ ans)
- **Positionnement :** ${meta.positioning || ''}

---

## 1. Offre de Base (${c.baseOffer.price} € - ${c.baseOffer.deliveryDays} jours)

**Nom :** ${c.baseOffer.name}  
**Description :** ${c.baseOffer.description}

### Livrables inclus :
${c.baseOffer.deliverables.map(d => `- ${d}`).join('\n')}

---

## 2. Options Complémentaires

| Option | Tarif | Délai add. | Détails |
| :--- | :--- | :--- | :--- |
${c.options.map(opt => `| **${opt.name}** | +${opt.price} € | +${opt.additionalDays} j | ${opt.description} |`).join('\n')}

---

## 3. Description HTML à Copier/Coller

\`\`\`html
${c.description}
\`\`\`

---

## 4. Foire Aux Questions (FAQ)

${c.faq ? c.faq.map(item => `### Q: ${item.question}\n**R:** ${item.answer}\n`).join('\n') : ''}
`;
}

/**
 * Génère le fichier d'export Fiverr Markdown
 */
function buildFiverrMarkdown(gig) {
  const f = gig.platforms.fiverr;
  const meta = gig.meta || {};

  return `# 🎯 Fiverr Export : ${gig.title_internal}

## 1. Gig Overview
- **Gig Title (${f.title.length}/80 chars) :**
\`\`\`
${f.title}
\`\`\`
- **Category :** ${f.category} > ${f.subcategory}
- **Search Tags (5 tags required) :**
  1. \`${f.tags[0]}\` (${f.tags[0].length} chars)
  2. \`${f.tags[1]}\` (${f.tags[1].length} chars)
  3. \`${f.tags[2]}\` (${f.tags[2].length} chars)
  4. \`${f.tags[3]}\` (${f.tags[3].length} chars)
  5. \`${f.tags[4]}\` (${f.tags[4].length} chars)
- **Tags (Comma-separated for quick paste) :**
\`\`\`
${f.tags.join(', ')}
\`\`\`

---

## 2. Scope & Pricing (3 Packages Table)

| Field | Basic Tier | Standard Tier (⭐ Recommended) | Premium Tier |
| :--- | :--- | :--- | :--- |
| **Package Name** | **${f.packages.basic.name}** | **${f.packages.standard.name}** | **${f.packages.premium.name}** |
| **Price** | **$${f.packages.basic.price}** | **$${f.packages.standard.price}** | **$${f.packages.premium.price}** |
| **Delivery Time** | ${f.packages.basic.deliveryDays} days | ${f.packages.standard.deliveryDays} days | ${f.packages.premium.deliveryDays} days |
| **Revisions** | ${f.packages.basic.revisions} | ${f.packages.standard.revisions} | ${f.packages.premium.revisions} |
| **Description** (<= 100 chars) | \`${f.packages.basic.description}\` (${f.packages.basic.description.length}/100) | \`${f.packages.standard.description}\` (${f.packages.standard.description.length}/100) | \`${f.packages.premium.description}\` (${f.packages.premium.description.length}/100) |
| **Features Included** | ${f.packages.basic.features.map(f => `• ${f}`).join('<br>')} | ${f.packages.standard.features.map(f => `• ${f}`).join('<br>')} | ${f.packages.premium.features.map(f => `• ${f}`).join('<br>')} |

---

## 3. Description (${f.description.length}/1200 chars - Strict Limit: 1200)

\`\`\`markdown
${f.description}
\`\`\`

---

## 4. Buyer Requirements

${f.requirements.map((req, idx) => `${idx + 1}. ${req}`).join('\n')}

---

## 5. Frequently Asked Questions (FAQ)

${f.faq ? f.faq.map(item => `### Q: ${item.question}\nA: ${item.answer}\n`).join('\n') : ''}
`;
}

/**
 * Génère le fichier README global des exports
 */
function buildIndexMarkdown(gigs) {
  return `# 📁 Freelance Gigs Studio - Catalogue des Exports

Dernière compilation : ${new Date().toISOString()}

| Gig ID | Titre Interne | ComeUp (FR) | Fiverr (EN) | Paliers ComeUp | Paliers Fiverr |
| :--- | :--- | :--- | :--- | :--- | :--- |
${gigs.map(g => {
  const c = g.platforms.comeup;
  const f = g.platforms.fiverr;
  return `| \`${g.id}\` | **${g.title_internal}** | [HTML](file:///${path.join(EXPORTS_DIR, `${g.slug}-comeup.html`).replace(/\\/g, '/')}) / [MD](file:///${path.join(EXPORTS_DIR, `${g.slug}-comeup.md`).replace(/\\/g, '/')}) | [MD](file:///${path.join(EXPORTS_DIR, `${g.slug}-fiverr.md`).replace(/\\/g, '/')}) | ${c.baseOffer.price}€ / +${c.options[0].price}€ / +${c.options[1].price}€ | $${f.packages.basic.price} / $${f.packages.standard.price} / $${f.packages.premium.price} |`;
}).join('\n')}

### Directives d'utilisation :
1. **ComeUp :** Ouvrez le fichier \`*-comeup.html\` dans votre navigateur pour visualiser le rendu, copiez le titre et le bloc HTML de la description dans l'éditeur de ComeUp.
2. **Fiverr :** Ouvrez le fichier \`*-fiverr.md\`, copiez le titre (sans "I will" si déjà présent dans l'interface), les 5 tags, le tableau des prix et la description (strictement $\\le 1200$ caractères).
`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Exporte l'intégralité des gigs valides
 */
export function exportAllGigs() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }

  const gigFiles = fs.readdirSync(GIGS_DIR).filter(f => f.endsWith('.json'));
  const validGigs = [];
  const exportSummary = [];

  console.log('\n======================================================');
  console.log('       FREELANCE GIGS STUDIO - EXPORT DES FICHES      ');
  console.log('======================================================\n');

  for (const file of gigFiles) {
    const raw = fs.readFileSync(path.join(GIGS_DIR, file), 'utf8');
    const gig = JSON.parse(raw);

    const validation = validateGig(gig, file);
    if (!validation.valid) {
      console.error(`❌ Échec de validation pour ${file}. Export annulé pour ce gig.`);
      for (const err of validation.errors) {
        console.error(`   - ${err}`);
      }
      continue;
    }

    validGigs.push(gig);

    // 1. Export ComeUp HTML
    const comeupHtmlPath = path.join(EXPORTS_DIR, `${gig.slug}-comeup.html`);
    fs.writeFileSync(comeupHtmlPath, buildComeupHtml(gig), 'utf8');

    // 2. Export ComeUp Markdown
    const comeupMdPath = path.join(EXPORTS_DIR, `${gig.slug}-comeup.md`);
    fs.writeFileSync(comeupMdPath, buildComeupMarkdown(gig), 'utf8');

    // 3. Export Fiverr Markdown
    const fiverrMdPath = path.join(EXPORTS_DIR, `${gig.slug}-fiverr.md`);
    fs.writeFileSync(fiverrMdPath, buildFiverrMarkdown(gig), 'utf8');

    exportSummary.push({
      slug: gig.slug,
      files: [
        `${gig.slug}-comeup.html`,
        `${gig.slug}-comeup.md`,
        `${gig.slug}-fiverr.md`
      ]
    });

    console.log(`✅ ${gig.slug} :`);
    console.log(`   📄 [ComeUp HTML] -> data/output/exports/${gig.slug}-comeup.html`);
    console.log(`   📄 [ComeUp MD]   -> data/output/exports/${gig.slug}-comeup.md`);
    console.log(`   📄 [Fiverr MD]   -> data/output/exports/${gig.slug}-fiverr.md`);
  }

  // 4. Index global
  const indexPath = path.join(EXPORTS_DIR, 'INDEX.md');
  fs.writeFileSync(indexPath, buildIndexMarkdown(validGigs), 'utf8');
  console.log(`\n📑 [Index Global] -> data/output/exports/INDEX.md`);

  console.log(`\n✨ Export terminé avec succès ! ${exportSummary.length} gig(s) exporté(s).\n`);
  return exportSummary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    exportAllGigs();
  } catch (err) {
    console.error(`Erreur fatale lors de l'export :`, err);
    process.exit(1);
  }
}
