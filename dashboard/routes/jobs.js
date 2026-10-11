/**
 * Freelance Gigs Studio - Radar Jobs Express Router
 */

import { Router } from 'express';
import { collectMarketOpportunities } from '../../core/market-radar.js';

export const jobsRouter = Router();

const handleRadarJobs = async (req, res) => {
  try {
    const {
      query = '',
      minScore = 0,
      source = 'all',
      limit = 30
    } = req.query;

    const result = await collectMarketOpportunities({
      query,
      minScore: parseInt(minScore, 10) || 0,
      source,
      limit: parseInt(limit, 10) || 30,
      persist: false,
      silent: true,
      refresh: false
    });

    const highMatches = result.jobs.filter(j => (j.matchScore || 0) >= 80).length;
    const mediumMatches = result.jobs.filter(j => (j.matchScore || 0) >= 60 && (j.matchScore || 0) < 80).length;
    const totalScores = result.jobs.reduce((acc, j) => acc + (j.matchScore || 0), 0);
    const avgScore = result.jobs.length > 0 ? Math.round(totalScores / result.jobs.length) : 0;

    res.json({
      total: result.total,
      filteredCount: result.jobs.length,
      jobs: result.jobs,
      sources: result.sources,
      stats: {
        highMatchCount: highMatches,
        mediumMatchCount: mediumMatches,
        averageScore: avgScore
      },
      filters: {
        query,
        minScore: parseInt(minScore, 10) || 0,
        source,
        limit: parseInt(limit, 10) || 30
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la consultation du radar', details: err.message });
  }
};

// Routes GET
jobsRouter.get('/jobs', handleRadarJobs);
jobsRouter.get('/', handleRadarJobs);

// POST /api/radar/refresh
jobsRouter.post('/refresh', async (req, res) => {
  try {
    const {
      query = '',
      minScore = 0,
      source = 'all',
      limit = 30
    } = req.body || {};

    const result = await collectMarketOpportunities({
      query,
      minScore: parseInt(minScore, 10) || 0,
      source,
      limit: parseInt(limit, 10) || 30,
      persist: true,
      silent: true,
      refresh: true
    });

    res.json({
      success: true,
      total: result.total,
      newlyDiscovered: result.newlyDiscovered,
      sources: result.sources,
      jobs: result.jobs
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du rafraîchissement MCP', details: err.message });
  }
});
