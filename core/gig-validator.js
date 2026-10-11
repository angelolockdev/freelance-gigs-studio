/**
 * Freelance Gigs Studio - Gig Canonical Validator
 *
 * Validates gig definitions against strict platform constraints for ComeUp & Fiverr,
 * plus psychological pricing and Value Equation completeness.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Motifs interdits de fuite de coordonnées et de contournement de plateforme (ComeUp & Fiverr)
export const FORBIDDEN_CONTACT_PATTERNS = [
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, label: 'Adresse email directe interdite' },
  { regex: /(?:\+33|0033|0)[1-9](?:[\s.-]?\d{2}){4}/, label: 'Numéro de téléphone direct (FR) interdit' },
  { regex: /(?:\+|00)[1-9]\d{0,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{2,9}/, label: 'Numéro de téléphone direct (international) interdit' },
  { regex: /paypal\.me|wa\.me|t\.me\/|telegram\.me|discord\.(?:gg|com\/invite)/i, label: 'Lien direct ou passerelle hors-plateforme interdit' },
  { regex: /(?:contact(?:ez)?[- ](?:moi|me)? (?:sur|on|via)|mon |my )(?:whatsapp|telegram|discord|skype|t[eé]l[eé]phone|phone)\b/i, label: 'Sollicitation directe hors-plateforme interdite' }
];

// Constantes de validation par plateforme
export const RULES = {
  fiverr: {
    title: {
      max: 80,
      prefix: 'I will',
      required: true
    },
    description: {
      max: 1200,
      min: 100,
      required: true
    },
    tags: {
      exactCount: 5,
      maxTagLength: 20,
      pattern: /^[a-z0-9 ]+$/i
    },
    packages: {
      requiredKeys: ['basic', 'standard', 'premium'],
      maxDescriptionLength: 100
    },
    forbiddenPatterns: FORBIDDEN_CONTACT_PATTERNS
  },
  comeup: {
    title: {
      max: 90,
      prefix: 'Je vais',
      required: true
    },
    description: {
      min: 200,
      allowedTags: [
        'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong',
        'b', 'em', 'i', 'u', 'a', 'hr', 'br', 'blockquote', 'span', 'div'
      ],
      forbiddenPatterns: FORBIDDEN_CONTACT_PATTERNS
    },
    baseOffer: {
      minPrice: 5,
      priceStep: 5
    },
    options: {
      priceStep: 5,
      maxNameLength: 100
    }
  }
};

/**
 * Valide un Gig complet
 * @param {object} gig - Objet Gig
 * @param {string} sourceFile - Nom de fichier source optionnel
 * @returns {{ valid: boolean, errors: string[], warnings: string[], stats: object }}
 */
export function validateGig(gig, sourceFile = 'in-memory') {
  const errors = [];
  const warnings = [];
  const stats = {
    id: gig?.id,
    slug: gig?.slug,
    fiverr: {},
    comeup: {}
  };

  if (!gig || typeof gig !== 'object') {
    return {
      valid: false,
      errors: ["[Schema] Le gig doit être un objet JSON valide."],
      warnings: [],
      stats: {},
      sourceFile
    };
  }

  if (!gig.id || typeof gig.id !== 'string') {
    errors.push(`[Schema] 'id' manquant ou invalide.`);
  }
  if (!gig.slug || typeof gig.slug !== 'string') {
    errors.push(`[Schema] 'slug' manquant ou invalide.`);
  }

  // Validation Meta & Value Equation
  if (!gig.meta) {
    errors.push(`[Meta] Section 'meta' obligatoire.`);
  } else {
    if (!gig.meta.experienceYears || gig.meta.experienceYears < 6) {
      warnings.push(`[Meta] Expérience indiquée inférieure à 6 ans (positionnement senior d'Angelo).`);
    }
    const ve = gig.meta.valueEquation;
    if (!ve || !ve.dreamOutcome || !ve.perceivedLikelihood || !ve.timeDelay || !ve.effortSacrifice) {
      errors.push(`[Value Equation] Les 4 composantes (dreamOutcome, perceivedLikelihood, timeDelay, effortSacrifice) sont obligatoires.`);
    }
  }

  const platforms = gig.platforms || {};

  // ==========================================
  // VALIDATION FIVERR
  // ==========================================
  const fiverr = platforms.fiverr;
  if (!fiverr) {
    errors.push(`[Fiverr] Section 'platforms.fiverr' manquante.`);
  } else {
    // 1. Titre
    if (!fiverr.title || typeof fiverr.title !== 'string') {
      errors.push(`[Fiverr] Titre manquant.`);
    } else {
      const len = fiverr.title.length;
      stats.fiverr.titleLength = len;
      if (len > RULES.fiverr.title.max) {
        errors.push(`[Fiverr] Titre trop long : ${len} caractères (max: ${RULES.fiverr.title.max}).`);
      }
      if (!/^I will\s+/i.test(fiverr.title)) {
        errors.push(`[Fiverr] Le titre doit commencer par '${RULES.fiverr.title.prefix}' suivi d'un espace.`);
      }
      const titleWithoutPrefix = fiverr.title.replace(/^I will\s+/i, '').trim();
      if (titleWithoutPrefix.length < 5) {
        errors.push(`[Fiverr] Le titre après 'I will' est trop court (${titleWithoutPrefix.length} car.).`);
      }
    }

    // 2. Tags
    if (!Array.isArray(fiverr.tags)) {
      errors.push(`[Fiverr] 'tags' doit être un tableau.`);
    } else {
      stats.fiverr.tagsCount = fiverr.tags.length;
      if (fiverr.tags.length !== RULES.fiverr.tags.exactCount) {
        errors.push(`[Fiverr] Doit comporter exactement ${RULES.fiverr.tags.exactCount} tags (actuel: ${fiverr.tags.length}).`);
      }
      const uniqueTags = new Set();
      fiverr.tags.forEach((tag, idx) => {
        if (typeof tag !== 'string') {
          errors.push(`[Fiverr] Tag #${idx + 1} n'est pas une chaîne.`);
          return;
        }
        if (tag.length > RULES.fiverr.tags.maxTagLength) {
          errors.push(`[Fiverr] Tag '${tag}' dépasse ${RULES.fiverr.tags.maxTagLength} car. (${tag.length}).`);
        }
        if (!RULES.fiverr.tags.pattern.test(tag)) {
          errors.push(`[Fiverr] Tag '${tag}' contient des caractères invalides (lettres, chiffres et espaces uniquement, pas de tirets ni caractères spéciaux).`);
        }
        if (uniqueTags.has(tag.toLowerCase())) {
          errors.push(`[Fiverr] Tag en doublon : '${tag}'.`);
        }
        uniqueTags.add(tag.toLowerCase());
      });
    }

    // 3. Description
    if (!fiverr.description || typeof fiverr.description !== 'string') {
      errors.push(`[Fiverr] Description manquante.`);
    } else {
      const len = fiverr.description.length;
      stats.fiverr.descriptionLength = len;
      if (len > RULES.fiverr.description.max) {
        errors.push(`[Fiverr] Description trop longue : ${len} caractères (max strict: ${RULES.fiverr.description.max}).`);
      }
      if (len < RULES.fiverr.description.min) {
        warnings.push(`[Fiverr] Description courte (${len} car.). Conseillé: > 500 car. pour le référencement.`);
      }

      // Vérification des motifs interdits sur Fiverr (anti-contact direct)
      for (const check of RULES.fiverr.forbiddenPatterns) {
        if (check.regex.test(fiverr.description)) {
          errors.push(`[Fiverr] Coordonnées ou lien direct interdit détecté dans la description : ${check.label}.`);
        }
      }
    }

    // 4. Packages (3 paliers)
    if (!fiverr.packages || typeof fiverr.packages !== 'object') {
      errors.push(`[Fiverr] 'packages' manquant ou invalide.`);
    } else {
      for (const tier of RULES.fiverr.packages.requiredKeys) {
        const pkg = fiverr.packages[tier];
        if (!pkg) {
          errors.push(`[Fiverr] Package obligatoire '${tier}' manquant.`);
          continue;
        }
        if (!pkg.name || typeof pkg.name !== 'string') {
          errors.push(`[Fiverr] Nom du package '${tier}' manquant.`);
        }
        if (typeof pkg.price !== 'number' || pkg.price <= 0) {
          errors.push(`[Fiverr] Prix du package '${tier}' invalide (doit être > 0).`);
        }
        if (typeof pkg.deliveryDays !== 'number' || pkg.deliveryDays <= 0) {
          errors.push(`[Fiverr] Délai de livraison '${tier}' invalide.`);
        }
        if (pkg.revisions !== undefined && (typeof pkg.revisions !== 'number' || pkg.revisions < 0)) {
          errors.push(`[Fiverr] Nombre de révisions du package '${tier}' invalide.`);
        }
        if (!pkg.description || typeof pkg.description !== 'string') {
          errors.push(`[Fiverr] Description du package '${tier}' manquante.`);
        } else {
          const dLen = pkg.description.length;
          stats.fiverr[`package_${tier}_descLength`] = dLen;
          if (dLen > RULES.fiverr.packages.maxDescriptionLength) {
            errors.push(`[Fiverr] Description package '${tier}' trop longue : ${dLen} car. (max strict: ${RULES.fiverr.packages.maxDescriptionLength}).`);
          }
        }
        if (!Array.isArray(pkg.features) || pkg.features.length === 0) {
          warnings.push(`[Fiverr] Package '${tier}' ne spécifie aucune 'features'.`);
        }
      }

      // Cohérence des paliers de prix (Alex Hormozi & price-psychology-strategist : Basic < Standard < Premium)
      const bPrice = fiverr.packages.basic?.price;
      const sPrice = fiverr.packages.standard?.price;
      const pPrice = fiverr.packages.premium?.price;
      if (typeof bPrice === 'number' && typeof sPrice === 'number' && typeof pPrice === 'number') {
        if (bPrice >= sPrice || sPrice >= pPrice) {
          errors.push(`[Fiverr] Incohérence des tarifs : les prix doivent respecter l'ordre strictement croissant Basic ($${bPrice}) < Standard ($${sPrice}) < Premium ($${pPrice}).`);
        }
      }
    }

    // 5. Requirements
    if (!Array.isArray(fiverr.requirements) || fiverr.requirements.length === 0) {
      errors.push(`[Fiverr] Liste 'requirements' (instructions acheteur) obligatoire.`);
    } else {
      fiverr.requirements.forEach((req, idx) => {
        if (typeof req !== 'string' || req.trim().length === 0) {
          errors.push(`[Fiverr] Requirement #${idx + 1} invalide ou vide.`);
        } else {
          for (const check of RULES.fiverr.forbiddenPatterns) {
            if (check.regex.test(req)) {
              errors.push(`[Fiverr] Requirement #${idx + 1} contient des coordonnées interdites : ${check.label}.`);
            }
          }
        }
      });
    }

    // 6. FAQ (Fiverr)
    if (Array.isArray(fiverr.faq)) {
      fiverr.faq.forEach((item, idx) => {
        if (!item.question || !item.answer) {
          errors.push(`[Fiverr] FAQ #${idx + 1} incomplète.`);
        } else {
          for (const check of RULES.fiverr.forbiddenPatterns) {
            if (check.regex.test(item.answer) || check.regex.test(item.question)) {
              errors.push(`[Fiverr] FAQ #${idx + 1} contient des coordonnées interdites : ${check.label}.`);
            }
          }
        }
      });
    }
  }

  // ==========================================
  // VALIDATION COMEUP
  // ==========================================
  const comeup = platforms.comeup;
  if (!comeup) {
    errors.push(`[ComeUp] Section 'platforms.comeup' manquante.`);
  } else {
    // 1. Titre
    if (!comeup.title || typeof comeup.title !== 'string') {
      errors.push(`[ComeUp] Titre manquant.`);
    } else {
      const len = comeup.title.length;
      stats.comeup.titleLength = len;
      if (len > RULES.comeup.title.max) {
        errors.push(`[ComeUp] Titre trop long : ${len} caractères (max strict: ${RULES.comeup.title.max}).`);
      }
      if (!/^Je vais\s+/i.test(comeup.title)) {
        errors.push(`[ComeUp] Le titre DOIT commencer par '${RULES.comeup.title.prefix}' suivi d'un espace.`);
      }
    }

    // 2. Offre de Base
    if (!comeup.baseOffer || typeof comeup.baseOffer !== 'object') {
      errors.push(`[ComeUp] 'baseOffer' manquante.`);
    } else {
      const bo = comeup.baseOffer;
      if (typeof bo.price !== 'number' || bo.price < RULES.comeup.baseOffer.minPrice) {
        errors.push(`[ComeUp] Prix de l'offre de base invalide (doit être >= ${RULES.comeup.baseOffer.minPrice} €).`);
      } else if (bo.price % RULES.comeup.baseOffer.priceStep !== 0) {
        errors.push(`[ComeUp] Le prix de l'offre de base (${bo.price} €) doit être un multiple de ${RULES.comeup.baseOffer.priceStep} €.`);
      }
      if (typeof bo.deliveryDays !== 'number' || bo.deliveryDays <= 0) {
        errors.push(`[ComeUp] Délai de l'offre de base invalide.`);
      }
      if (!bo.description || typeof bo.description !== 'string') {
        errors.push(`[ComeUp] Description de l'offre de base manquante.`);
      }
      if (!Array.isArray(bo.deliverables) || bo.deliverables.length === 0) {
        errors.push(`[ComeUp] L'offre de base doit spécifier au moins un livrable.`);
      }
    }

    // 3. Options
    if (!Array.isArray(comeup.options) || comeup.options.length === 0) {
      errors.push(`[ComeUp] Doit contenir au moins 1 option complémentaire.`);
    } else {
      stats.comeup.optionsCount = comeup.options.length;
      comeup.options.forEach((opt, idx) => {
        if (!opt.name || typeof opt.name !== 'string') {
          errors.push(`[ComeUp] Option #${idx + 1} sans nom.`);
        } else if (opt.name.length > RULES.comeup.options.maxNameLength) {
          errors.push(`[ComeUp] Option #${idx + 1} nom trop long : ${opt.name.length} car. (max: ${RULES.comeup.options.maxNameLength}).`);
        }
        if (typeof opt.price !== 'number' || opt.price <= 0) {
          errors.push(`[ComeUp] Option #${idx + 1} (${opt.name || 'Sans nom'}) prix invalide.`);
        } else if (opt.price % RULES.comeup.options.priceStep !== 0) {
          errors.push(`[ComeUp] Option #${idx + 1} (${opt.name}) : le tarif (${opt.price} €) doit être un multiple de ${RULES.comeup.options.priceStep} €.`);
        }
        if (typeof opt.additionalDays !== 'number' || opt.additionalDays < 0) {
          errors.push(`[ComeUp] Option #${idx + 1} délai additionnel invalide.`);
        }
        if (!opt.description || typeof opt.description !== 'string') {
          errors.push(`[ComeUp] Option #${idx + 1} description manquante.`);
        }
      });
    }

    // 4. Description HTML & Filtres
    if (!comeup.description || typeof comeup.description !== 'string') {
      errors.push(`[ComeUp] Description HTML manquante.`);
    } else {
      const len = comeup.description.length;
      stats.comeup.descriptionLength = len;
      if (len < RULES.comeup.description.min) {
        warnings.push(`[ComeUp] Description courte (${len} car.).`);
      }

      // Vérification des balises HTML non autorisées
      const tagRegex = /<\/?([a-z0-9]+)[^>]*>/gi;
      let match;
      const foundTags = new Set();
      while ((match = tagRegex.exec(comeup.description)) !== null) {
        foundTags.add(match[1].toLowerCase());
      }
      for (const tag of foundTags) {
        if (!RULES.comeup.description.allowedTags.includes(tag)) {
          errors.push(`[ComeUp] Balise HTML non autorisée détectée : <${tag}>.`);
        }
      }

      // Vérification des attributs dangereux (inline scripts, event handlers, styles)
      if (/(?:on\w+\s*=|javascript:|style\s*=)/i.test(comeup.description)) {
        errors.push(`[ComeUp] Attributs non sécurisés détectés dans le HTML (event handlers, javascript: ou style inline).`);
      }

      // Vérification des motifs interdits (coordonnées directes / bypass)
      for (const check of RULES.comeup.description.forbiddenPatterns) {
        if (check.regex.test(comeup.description)) {
          errors.push(`[ComeUp] Règle stricte violée dans la description : ${check.label}.`);
        }
      }
    }

    // 5. FAQ
    if (!Array.isArray(comeup.faq) || comeup.faq.length === 0) {
      warnings.push(`[ComeUp] Aucune FAQ définie (fortement recommandée pour lever les objections).`);
    } else {
      comeup.faq.forEach((item, idx) => {
        if (!item.question || !item.answer) {
          errors.push(`[ComeUp] FAQ #${idx + 1} incomplète.`);
        } else {
          for (const check of RULES.comeup.description.forbiddenPatterns) {
            if (check.regex.test(item.answer) || check.regex.test(item.question)) {
              errors.push(`[ComeUp] FAQ #${idx + 1} contient des coordonnées interdites : ${check.label}.`);
            }
          }
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
    sourceFile
  };
}

/**
 * Valide un fichier JSON de Gig
 * @param {string} filePath - Chemin absolu ou relatif du fichier
 */
export function validateGigFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const gig = JSON.parse(raw);
    return validateGig(gig, path.basename(filePath));
  } catch (err) {
    return {
      valid: false,
      errors: [`[File Error] Impossible de lire ou parser ${path.basename(filePath)} : ${err.message}`],
      warnings: [],
      stats: {},
      sourceFile: path.basename(filePath)
    };
  }
}

/**
 * Valide tous les gigs situés dans data/gigs/
 * @param {string} gigsDir - Dossier contenant les gigs
 */
export function validateAllGigs(gigsDir = path.resolve(__dirname, '../data/gigs')) {
  if (!fs.existsSync(gigsDir)) {
    throw new Error(`Le dossier des gigs n'existe pas : ${gigsDir}`);
  }

  const files = fs.readdirSync(gigsDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    throw new Error(`Aucun fichier .json trouvé dans : ${gigsDir}`);
  }

  const results = [];
  for (const file of files) {
    const fullPath = path.join(gigsDir, file);
    results.push(validateGigFile(fullPath));
  }

  return results;
}

// ==========================================
// CLI RUNNER
// ==========================================
function printReport(results) {
  console.log('\n======================================================');
  console.log('       FREELANCE GIGS STUDIO - VALIDATION DES FICHES  ');
  console.log('======================================================\n');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const res of results) {
    const statusSymbol = res.valid ? '✅ VALIDE' : '❌ ERREURS DÉTECTÉES';
    console.log(`📁 Fiche : ${res.sourceFile} [${statusSymbol}]`);

    if (res.stats.fiverr && res.stats.fiverr.titleLength) {
      console.log(`   🔹 Fiverr :`);
      console.log(`      • Titre        : ${res.stats.fiverr.titleLength}/80 car.`);
      console.log(`      • Tags         : ${res.stats.fiverr.tagsCount}/5 tags`);
      console.log(`      • Description  : ${res.stats.fiverr.descriptionLength}/1200 car.`);
      console.log(`      • Basic Desc   : ${res.stats.fiverr.package_basic_descLength}/100 car.`);
      console.log(`      • Standard Desc: ${res.stats.fiverr.package_standard_descLength}/100 car.`);
      console.log(`      • Premium Desc : ${res.stats.fiverr.package_premium_descLength}/100 car.`);
    }

    if (res.stats.comeup && res.stats.comeup.titleLength) {
      console.log(`   🔸 ComeUp :`);
      console.log(`      • Titre        : ${res.stats.comeup.titleLength} car.`);
      console.log(`      • Options      : ${res.stats.comeup.optionsCount} options définies`);
      console.log(`      • Description  : ${res.stats.comeup.descriptionLength} car. HTML`);
    }

    if (res.errors.length > 0) {
      console.log('\n   ⚠️  ERREURS BLOQUANTES :');
      for (const err of res.errors) {
        console.log(`      ❌ ${err}`);
      }
      totalErrors += res.errors.length;
    }

    if (res.warnings.length > 0) {
      console.log('\n   💡 AVERTISSEMENTS :');
      for (const warn of res.warnings) {
        console.log(`      ⚡ ${warn}`);
      }
      totalWarnings += res.warnings.length;
    }

    console.log('------------------------------------------------------');
  }

  console.log(`\nBilan Global : ${results.length} fichier(s) audité(s) | Erreurs: ${totalErrors} | Avertissements: ${totalWarnings}`);

  if (totalErrors === 0) {
    console.log('🎉 TOUTES LES FICHES SONT 100% CONFORMES AUX EXIGENCES !\n');
  } else {
    console.log('🚨 VEUILLEZ CORRIGER LES ERREURS AVANT EXPORT OU INJECTION.\n');
  }

  return totalErrors === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const results = validateAllGigs();
    const ok = printReport(results);
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error(`Erreur fatale lors de la validation :`, err.message);
    process.exit(1);
  }
}
