/**
 * Freelance Gigs Studio - Gigs Express Router
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateGig } from '../../core/gig-validator.js';
import { exportGig } from '../../core/export-gigs.js';
import { buildThumbnails, GIG_THUMBNAIL_CONFIGS } from '../../core/thumbnail-builder.js';
import { injectGig, DEFAULT_CDP_URL } from '../../core/browser-injector.js';
import { getThumbnailsForSlug, getExportsForSlug, GIGS_DIR } from '../server.js';

export const gigsRouter = Router();

// GET /api/gigs
gigsRouter.get('/', (req, res) => {
  try {
    if (!fs.existsSync(GIGS_DIR)) {
      return res.json({ total: 0, gigs: [] });
    }

    const files = fs.readdirSync(GIGS_DIR).filter(f => f.endsWith('.json'));
    const gigs = [];

    for (const file of files) {
      const raw = fs.readFileSync(path.join(GIGS_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      const validation = validateGig(data, file);
      const thumbnails = getThumbnailsForSlug(data.slug);
      const exportsList = getExportsForSlug(data.slug);

      gigs.push({
        id: data.id,
        slug: data.slug,
        meta: data.meta,
        platforms: data.platforms,
        validation: {
          valid: validation.valid,
          errorsCount: validation.errors.length,
          warningsCount: validation.warnings.length,
          errors: validation.errors,
          warnings: validation.warnings
        },
        thumbnails,
        exports: exportsList
      });
    }

    res.json({ total: gigs.length, gigs });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement des fiches', details: err.message });
  }
});

// GET /api/gigs/:slug
gigsRouter.get('/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = path.join(GIGS_DIR, `${slug}.json`);

    if (!fs.existsSync(filePath)) {
      const available = fs.existsSync(GIGS_DIR)
        ? fs.readdirSync(GIGS_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''))
        : [];
      return res.status(404).json({ error: `Gig "${slug}" introuvable`, available });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const validation = validateGig(data, `${slug}.json`);
    const thumbnails = getThumbnailsForSlug(slug);
    const exportsList = getExportsForSlug(slug);

    res.json({
      gig: data,
      validation,
      thumbnails,
      exports: exportsList
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement du gig', details: err.message });
  }
});

// POST /api/gigs/:slug/validate
gigsRouter.post('/:slug/validate', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = path.join(GIGS_DIR, `${slug}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Gig "${slug}" introuvable` });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = validateGig(data, `${slug}.json`);

    res.json({
      slug,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      stats: result.stats
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la validation', details: err.message });
  }
});

// POST /api/gigs/:slug/export
gigsRouter.post('/:slug/export', (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = path.join(GIGS_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Gig "${slug}" introuvable` });
    }
    const result = exportGig(slug);
    const exportsList = getExportsForSlug(slug);

    res.json({
      success: true,
      slug,
      files: result.files,
      exportedDetails: exportsList
    });
  } catch (err) {
    res.status(400).json({ error: "Échec de l'exportation", details: err.message });
  }
});

// POST /api/gigs/:slug/thumbnails
gigsRouter.post('/:slug/thumbnails', async (req, res) => {
  try {
    const { slug } = req.params;
    const { variant = null, platform = null } = req.body || {};

    if (!GIG_THUMBNAIL_CONFIGS[slug]) {
      return res.status(404).json({
        error: `Gig "${slug}" non configuré pour la génération visuelle`,
        available: Object.keys(GIG_THUMBNAIL_CONFIGS)
      });
    }

    const generated = await buildThumbnails({
      gigSlug: slug,
      variant,
      platform
    });

    const updatedThumbnails = getThumbnailsForSlug(slug);

    res.json({
      success: true,
      slug,
      generatedCount: generated.length,
      generated,
      thumbnails: updatedThumbnails
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la génération des miniatures', details: err.message });
  }
});

// POST /api/gigs/:slug/inject
gigsRouter.post('/:slug/inject', async (req, res) => {
  try {
    const { slug } = req.params;
    const filePath = path.join(GIGS_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Gig "${slug}" introuvable` });
    }
    const {
      platform = 'all',
      variant = 'dark-tech',
      dryRun = true,
      slowMo = 0,
      cdpUrl = DEFAULT_CDP_URL
    } = req.body || {};

    const injectResult = await injectGig({
      gigSlug: slug,
      platform,
      dryRun: Boolean(dryRun),
      preferredVariant: variant,
      slowMo: parseInt(slowMo, 10) || 0,
      cdpUrl,
      logOutput: false
    });

    res.json({
      success: true,
      gigSlug: slug,
      platform,
      dryRun: Boolean(dryRun),
      safetyPolicy: 'STRICT_DRAFT_ONLY',
      results: injectResult.results,
      message: dryRun
        ? 'Simulation validée avec succès. Aucune action navigateur effectuée.'
        : 'Brouillon injecté avec succès dans Chrome. Arrêt strict au stade brouillon.'
    });
  } catch (err) {
    const statusCode = err.name === 'CdpConnectionError' ? 503 : 400;
    res.status(statusCode).json({
      success: false,
      error: err.message,
      diagnostic: err.diagnostic || null,
      hint: err.name === 'CdpConnectionError'
        ? "Lancez Chrome via 'start-chrome-debug.bat' sur le port 9222 ou cochez le mode Dry-Run."
        : null
    });
  }
});
