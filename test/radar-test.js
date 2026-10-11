/**
 * Automated test suite for freelance-gigs-studio Market Radar (Phase 4)
 * 
 * Tests:
 *  1. Skill taxonomy & weighting integrity
 *  2. Competency extraction with word boundaries & case insensitivity
 *  3. Match score calculation (high-priority AI/RAG/MCP jobs)
 *  4. Match score calculation (Laravel / Fullstack jobs)
 *  5. Match score calculation (unrelated roles, boundaries [0, 100])
 *  6. Context modifiers (remote bonus, freelance bonus, onsite penalty)
 *  7. Salary formatter edge cases
 *  8. MCP job normalization under common schema
 *  9. Upwork job normalization under common schema
 * 10. Upwork sweeper bridge (existing file reading & missing file resilience)
 * 11. Deduplication engine (seen_ids, sliding window pruning)
 * 12. Cache persistence (loadRadarJobs & saveRadarJobs to isolated temp file)
 * 13. Mock MCP tool communication via custom transport
 * 14. MCP opportunities aggregator with mock transport
 * 15. collectMarketOpportunities source filtering (all, mcp, upwork)
 * 16. collectMarketOpportunities keyword search & minScore filtering
 * 17. CLI argument parsing & validation errors
 * 18. formatJobCard terminal rendering
 * 19. Live MCP connectivity (with graceful offline handling)
 * 20. End-to-end pipeline execution with isolated storage
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SKILL_TAXONOMY,
  CONTEXT_MODIFIERS,
  extractMatchedSkills,
  calculateMatchScore,
  formatSalary,
  normalizeMcpJob,
  normalizeUpworkJob,
  loadUpworkJobs,
  loadRadarJobs,
  saveRadarJobs,
  deduplicateJobs,
  callMcpTool,
  fetchMcpOpportunities,
  collectMarketOpportunities,
  parseRadarCliArgs,
  formatJobCard,
  callMcpHttp2,
  callMcpHttps1,
  extractJobsFromToolResult,
  DEFAULT_MCP_URL
} from '../core/market-radar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DATA_DIR = path.join(__dirname, 'temp-radar-data');
const TEMP_RADAR_FILE = path.join(TEMP_DATA_DIR, 'test_radar_jobs.json');

// Cleanup temporary test directory
function cleanupTemp() {
  if (fs.existsSync(TEMP_DATA_DIR)) {
    fs.rmSync(TEMP_DATA_DIR, { recursive: true, force: true });
  }
}

cleanupTemp();

console.log('🧪 Running Freelance Gigs Studio Market Radar Test Suite (Phase 4)...\n');

try {
  // Test 1: Skill taxonomy and weight constants integrity
  console.log('Test 1: Skill taxonomy and weight constants integrity');
  assert.ok(Array.isArray(SKILL_TAXONOMY), 'SKILL_TAXONOMY must be an array');
  assert.ok(SKILL_TAXONOMY.length >= 10, 'Should define at least 10 core skills');
  for (const s of SKILL_TAXONOMY) {
    assert.ok(s.id && typeof s.id === 'string', 'Skill must have an id string');
    assert.ok(s.label && typeof s.label === 'string', 'Skill must have a label');
    assert.ok(typeof s.weight === 'number' && s.weight > 0, `Skill ${s.id} weight must be positive number`);
    assert.ok(s.regex instanceof RegExp, `Skill ${s.id} must define a RegExp`);
  }
  assert.ok(CONTEXT_MODIFIERS.remote && CONTEXT_MODIFIERS.contract_freelance, 'Context modifiers must exist');
  console.log('  ✅ Skill taxonomy and weights verified.');

  // Test 2: Competency extraction with word boundaries & case insensitivity
  console.log('Test 2: Competency extraction logic and regex boundaries');
  const matched1 = extractMatchedSkills('Looking for an expert in Laravel and RAG architectures', ['mysql', 'docker']);
  const matchedIds1 = matched1.map(m => m.id);
  assert.ok(matchedIds1.includes('laravel'), 'Should match laravel');
  assert.ok(matchedIds1.includes('rag'), 'Should match rag');
  assert.ok(matchedIds1.includes('sql'), 'Should match mysql via sql');
  assert.ok(matchedIds1.includes('docker'), 'Should match docker');

  // Test word boundary safety (e.g. "courage" should NOT match "rag")
  const matchedFalse = extractMatchedSkills('Having great courage and outrage in management', []);
  assert.equal(matchedFalse.some(m => m.id === 'rag'), false, 'Should not match rag in courage/outrage');

  // Test anti-faux-positifs (customer service agent / travel agent != AI agents, CSS container != Docker)
  const falseAgent = extractMatchedSkills('Customer service agent needed for travel booking desk', []);
  assert.equal(falseAgent.some(m => m.id === 'agents'), false, 'Non-tech agent should not match AI agents');
  const falseDocker = extractMatchedSkills('Fix CSS flexbox layout container on mobile devices', []);
  assert.equal(falseDocker.some(m => m.id === 'docker'), false, 'CSS layout container should not match Docker');

  // Empty input safety
  assert.deepEqual(extractMatchedSkills('', []), [], 'Empty text should return empty array');
  console.log('  ✅ Competency extraction and word boundary safety verified.');

  // Test 3: Match score calculation on high-priority AI/RAG/MCP job
  console.log('Test 3: Match score calculation on AI/RAG/MCP job');
  const aiJob = {
    title: 'Senior AI Engineer - Autonomous Agents & MCP Server',
    summary: 'Build scalable RAG pipelines using LangChain, Python, ChromaDB, and Model Context Protocol.',
    tags: ['mcp', 'rag', 'agents', 'python'],
    workplace: 'remote',
    jobType: 'contract'
  };
  const aiScore = calculateMatchScore(aiJob);
  assert.ok(aiScore.matchScore >= 80, `AI Job should score >= 80%, got ${aiScore.matchScore}%`);
  assert.ok(aiScore.matchedSkills.includes('mcp'), 'Should detect mcp');
  assert.ok(aiScore.matchedSkills.includes('rag'), 'Should detect rag');
  assert.ok(aiScore.matchedSkills.includes('agents'), 'Should detect agents');
  assert.ok(aiScore.matchReasons.some(r => r.includes('Télétravail')), 'Should include remote reason');
  console.log(`  ✅ AI/RAG/MCP job scoring verified (${aiScore.matchScore}%).`);

  // Test 4: Match score calculation on Laravel / Fullstack job
  console.log('Test 4: Match score calculation on Laravel/Fullstack job');
  const webJob = {
    title: 'Senior Laravel & React Developer',
    summary: 'Develop REST APIs, maintain PostgreSQL database schema and optimize Tailwind UI.',
    tags: ['laravel', 'react', 'sql'],
    workplace: 'remote',
    jobType: 'freelance'
  };
  const webScore = calculateMatchScore(webJob);
  assert.ok(webScore.matchScore >= 70, `Laravel Job should score >= 70%, got ${webScore.matchScore}%`);
  assert.ok(webScore.matchedSkills.includes('laravel'), 'Should detect laravel');
  assert.ok(webScore.matchedSkills.includes('react'), 'Should detect react');
  assert.ok(webScore.matchedSkills.includes('sql'), 'Should detect sql');
  console.log(`  ✅ Laravel/Fullstack job scoring verified (${webScore.matchScore}%).`);

  // Test 5: Match score on unrelated roles & boundary clamping
  console.log('Test 5: Match score on unrelated roles and clamping [0, 100]');
  const unrelatedJob = {
    title: 'Pediatric Registered Nurse',
    summary: 'Hospital nursing staff position in maternity ward.',
    tags: ['healthcare', 'clinical'],
    workplace: 'onsite',
    jobType: 'full-time'
  };
  const unrelatedScore = calculateMatchScore(unrelatedJob);
  assert.equal(unrelatedScore.matchScore, 0, `Unrelated job should score exactly 0%, got ${unrelatedScore.matchScore}%`);
  assert.equal(unrelatedScore.matchedSkills.length, 0, 'Should match 0 technical skills');

  // Extreme job with all skills combined (must not exceed 100)
  const superJob = {
    title: 'Laravel PHP RAG MCP AI Agents LangChain React Next.js TypeScript SQL Docker REST API',
    summary: 'Everything remote contract freelance python fastAPI postgres',
    tags: ['laravel', 'php', 'rag', 'mcp', 'agents', 'langchain', 'react', 'sql', 'docker'],
    workplace: 'remote',
    jobType: 'freelance'
  };
  const superScore = calculateMatchScore(superJob);
  assert.equal(superScore.matchScore, 100, 'Score must be clamped at exactly 100%');
  console.log('  ✅ Low-relevance scoring and 100% boundary clamping verified.');

  // Test 6: Context modifiers (remote bonus, freelance bonus, onsite penalty)
  console.log('Test 6: Context modifiers (remote, contract, onsite)');
  const baseJob = {
    title: 'Laravel Developer',
    summary: 'Build web applications.',
    tags: ['laravel'],
    workplace: 'unknown',
    jobType: 'full-time'
  };
  const scoreBase = calculateMatchScore(baseJob).matchScore;

  const remoteJob = { ...baseJob, workplace: 'remote' };
  const scoreRemote = calculateMatchScore(remoteJob).matchScore;
  assert.equal(scoreRemote, scoreBase + CONTEXT_MODIFIERS.remote.weight, 'Remote job should receive remote bonus');

  const contractJob = { ...baseJob, jobType: 'contract' };
  const scoreContract = calculateMatchScore(contractJob).matchScore;
  assert.equal(scoreContract, scoreBase + CONTEXT_MODIFIERS.contract_freelance.weight, 'Contract job should receive freelance bonus');
  console.log('  ✅ Context modifiers verified.');

  // Test 7: formatSalary helper
  console.log('Test 7: Salary formatting helper edge cases');
  assert.equal(formatSalary(140000, 160000), '$140k - $160k/an');
  assert.equal(formatSalary(120000, null), '$120k+/an');
  assert.equal(formatSalary(null, 150000), 'Jusqu\'à $150k/an');
  assert.equal(formatSalary(75, 120), '$75 - $120/h');
  assert.equal(formatSalary(80, null), '$80/h');
  assert.equal(formatSalary(null, 65), 'Jusqu\'à $65/h');
  assert.equal(formatSalary(null, null, '$75/hr'), '$75/hr');
  assert.equal(formatSalary(null, null, null), 'Rémunération non précisée');
  console.log('  ✅ Salary formatting helper verified.');

  // Test 8: MCP job normalization under common schema
  console.log('Test 8: MCP job normalization under common schema');
  const rawMcp = {
    id: 'test-mcp-uuid-123',
    title: 'Machine Learning Agent Architect',
    company_name: 'Anthropic Partner',
    location: 'Remote (US)',
    salary_min: 150000,
    salary_max: 200000,
    url: 'https://aidevboard.com/job/test-mcp-uuid-123',
    tags: ['AGENTS', 'RAG', 'PYTHON'],
    description: 'We are seeking an agent architect to build production RAG systems with MCP protocol.',
    published_at: '2026-10-09T12:00:00Z',
    workplace: 'remote',
    job_type: 'contract'
  };
  const normalizedMcp = normalizeMcpJob(rawMcp);
  assert.equal(normalizedMcp.id, 'mcp-test-mcp-uuid-123');
  assert.equal(normalizedMcp.title, 'Machine Learning Agent Architect');
  assert.equal(normalizedMcp.company, 'Anthropic Partner');
  assert.equal(normalizedMcp.location, 'Remote (US)');
  assert.equal(normalizedMcp.salary_or_rate, '$150k - $200k/an');
  assert.equal(normalizedMcp.url, 'https://aidevboard.com/job/test-mcp-uuid-123');
  assert.deepEqual(normalizedMcp.tags, ['agents', 'rag', 'python']);
  assert.equal(normalizedMcp.source, 'ai-dev-jobs-mcp');
  assert.ok(normalizedMcp.summary.length > 0);
  assert.equal(normalizedMcp.timestamp, '2026-10-09T12:00:00Z');
  assert.ok(typeof normalizedMcp.matchScore === 'number');
  assert.ok(Array.isArray(normalizedMcp.matchedSkills));
  
  // Test null-safety
  const nullMcp = normalizeMcpJob(null);
  assert.ok(nullMcp.id.startsWith('mcp-'), 'Null raw MCP must produce valid default object');
  console.log('  ✅ MCP normalization conforms to required schema.');

  // Test 9: Upwork job normalization under common schema
  console.log('Test 9: Upwork job normalization under common schema');
  const rawUpwork = {
    id: '9876543210',
    title: 'Laravel 11 API bug fix and MySQL query optimization',
    budget: '$150.00 (Fixed)',
    job_type: 'fixed',
    description_snippet: 'Need an expert to fix authentication and optimize database queries on Laravel backend.',
    client: { country: 'France', rating: 5 },
    url: 'https://www.upwork.com/jobs/~029876543210',
    detected_at: '2026-10-08T15:30:00Z'
  };
  const normalizedUpwork = normalizeUpworkJob(rawUpwork);
  assert.equal(normalizedUpwork.id, 'upwork-9876543210');
  assert.equal(normalizedUpwork.title, 'Laravel 11 API bug fix and MySQL query optimization');
  assert.equal(normalizedUpwork.company, 'Client Upwork (France)');
  assert.equal(normalizedUpwork.location, 'France (Remote)');
  assert.equal(normalizedUpwork.salary_or_rate, '$150.00 (Fixed)');
  assert.equal(normalizedUpwork.source, 'upwork-sweeper');
  assert.ok(normalizedUpwork.tags.includes('laravel'));
  assert.ok(normalizedUpwork.tags.includes('sql'));
  assert.ok(normalizedUpwork.matchScore >= 60);

  // Test null-safety
  const nullUpwork = normalizeUpworkJob(null);
  assert.ok(nullUpwork.id.startsWith('upwork-'), 'Null raw Upwork must produce valid default object');
  console.log('  ✅ Upwork normalization conforms to required schema.');

  // Test 10: Upwork sweeper bridge (existing file reading & missing file resilience)
  console.log('Test 10: Upwork sweeper passive bridge');
  const loadedUpwork = loadUpworkJobs();
  assert.ok(Array.isArray(loadedUpwork), 'loadUpworkJobs must return array');
  assert.ok(loadedUpwork.length > 0, `Should load existing Upwork jobs (found ${loadedUpwork.length})`);
  assert.equal(loadedUpwork[0].source, 'upwork-sweeper');

  // Resilience against non-existent file
  const missingBridge = loadUpworkJobs('/non/existent/path/jobs.json');
  assert.deepEqual(missingBridge, [], 'Missing file should safely return empty array');
  console.log(`  ✅ Upwork bridge loaded ${loadedUpwork.length} real jobs and handles missing files gracefully.`);

  // Test 11: Deduplication engine
  console.log('Test 11: Deduplication engine with sliding rotation');
  const incoming = [
    { id: 'job-1', title: 'Job 1' },
    { id: 'job-2', title: 'Job 2' },
    { id: 'job-3', title: 'Job 3' },
    { id: 'job-1', title: 'Job 1 Duplicate' }
  ];
  const existingSeen = ['job-1', 'job-old'];
  const dedup = deduplicateJobs(incoming, existingSeen, 5);

  assert.equal(dedup.uniqueJobs.length, 2, 'Should only retain job-2 and job-3');
  assert.equal(dedup.duplicatesCount, 2, 'Should count 2 duplicates (job-1 twice)');
  assert.ok(dedup.updatedSeenIds.includes('job-2') && dedup.updatedSeenIds.includes('job-3'));
  assert.ok(dedup.updatedSeenIds.length <= 5, 'Sliding cache should be bounded');
  console.log('  ✅ Deduplication engine strictly prunes duplicates.');

  // Test 12: Cache persistence (loadRadarJobs & saveRadarJobs)
  console.log('Test 12: Cache persistence to isolated file');
  const testData = {
    seen_ids: ['mcp-1', 'upwork-1'],
    jobs: [
      { id: 'mcp-1', title: 'Job 1', source: 'ai-dev-jobs-mcp' },
      { id: 'upwork-1', title: 'Job 2', source: 'upwork-sweeper' }
    ]
  };
  const saveSuccess = saveRadarJobs(testData, TEMP_RADAR_FILE);
  assert.equal(saveSuccess, true, 'saveRadarJobs should return true on success');
  assert.ok(fs.existsSync(TEMP_RADAR_FILE), 'Saved file must exist on disk');

  const loadedData = loadRadarJobs(TEMP_RADAR_FILE);
  assert.equal(loadedData.total_jobs, 2);
  assert.deepEqual(loadedData.seen_ids, ['mcp-1', 'upwork-1']);
  assert.equal(loadedData.jobs[0].title, 'Job 1');

  // Test load non-existent file
  const emptyStorage = loadRadarJobs('/non/existent/radar.json');
  assert.equal(emptyStorage.total_jobs, 0);
  assert.deepEqual(emptyStorage.jobs, []);
  console.log('  ✅ Cache persistence and loading verified.');

  // Test 13: Mock MCP tool communication via custom transport
  console.log('Test 13: Mock MCP tool communication via custom transport');
  const mockTransport = async (toolName, args, options) => {
    assert.equal(toolName, 'search_jobs');
    assert.equal(args.query, 'mcp');
    return {
      content: [{ type: 'text', text: 'Found 1 job' }],
      structuredContent: {
        total: 1,
        jobs: [
          {
            id: 'mock-1',
            title: 'MCP Engineer',
            company_name: 'AI Labs',
            tags: ['mcp', 'agent'],
            workplace: 'remote'
          }
        ]
      }
    };
  };

  const toolRes = await callMcpTool('search_jobs', { query: 'mcp' }, { transport: mockTransport });
  assert.equal(toolRes.structuredContent.total, 1);
  assert.equal(toolRes.structuredContent.jobs[0].title, 'MCP Engineer');
  console.log('  ✅ Mock MCP tool transport verified.');

  // Test 14: MCP opportunities aggregator with mock transport
  console.log('Test 14: MCP opportunities aggregator with mock transport');
  const multiMockTransport = async (toolName, args) => {
    if (toolName === 'match_jobs') {
      return {
        structuredContent: {
          matches: [
            {
              job: {
                id: 'match-1',
                title: 'Senior RAG Developer',
                company_name: 'OpenCorp',
                tags: ['rag', 'python'],
                workplace: 'remote'
              }
            }
          ]
        }
      };
    }
    if (toolName === 'search_jobs') {
      return {
        structuredContent: {
          jobs: [
            {
              id: `search-${args.query}`,
              title: `${args.query.toUpperCase()} Specialist`,
              company_name: 'SearchCorp',
              tags: [args.query],
              workplace: 'remote'
            }
          ]
        }
      };
    }
    return {};
  };

  const mcpAggregated = await fetchMcpOpportunities(['agent', 'laravel'], { transport: multiMockTransport, silent: true });
  assert.ok(mcpAggregated.length >= 3, `Should aggregate match_jobs + search_jobs results, got ${mcpAggregated.length}`);
  assert.ok(mcpAggregated.some(j => j.title.includes('RAG Developer')));
  assert.ok(mcpAggregated.some(j => j.title.includes('AGENT Specialist')));
  console.log('  ✅ MCP aggregator verified.');

  // Test 15: collectMarketOpportunities with source filtering (all, mcp, upwork)
  console.log('Test 15: collectMarketOpportunities source filtering');
  const isolatedRadarFile = path.join(TEMP_DATA_DIR, 'filter_radar.json');

  // Source = upwork only
  const upworkOnly = await collectMarketOpportunities({
    source: 'upwork',
    limit: 5,
    persist: false,
    silent: true,
    radarFilePath: isolatedRadarFile
  });
  assert.ok(upworkOnly.jobs.every(j => j.source === 'upwork-sweeper'), 'All jobs must be from Upwork');
  assert.ok(upworkOnly.total <= 5, 'Must respect limit');

  // Source = mcp only (with mock)
  const mcpOnly = await collectMarketOpportunities({
    source: 'mcp',
    limit: 5,
    persist: false,
    silent: true,
    transport: multiMockTransport,
    radarFilePath: isolatedRadarFile
  });
  assert.ok(mcpOnly.jobs.every(j => j.source === 'ai-dev-jobs-mcp'), 'All jobs must be from MCP');
  console.log('  ✅ Source filtering (upwork / mcp) verified.');

  // Test 16: collectMarketOpportunities keyword search & minScore filtering
  console.log('Test 16: Keyword query and minScore filtering');
  const filteredScore = await collectMarketOpportunities({
    source: 'all',
    minScore: 75,
    limit: 10,
    persist: false,
    silent: true,
    transport: multiMockTransport,
    radarFilePath: isolatedRadarFile
  });
  for (const j of filteredScore.jobs) {
    assert.ok(j.matchScore >= 75, `Job score must be >= 75, got ${j.matchScore}`);
  }

  // Keyword query
  const filteredKeyword = await collectMarketOpportunities({
    source: 'all',
    query: 'laravel',
    persist: false,
    silent: true,
    transport: multiMockTransport,
    radarFilePath: isolatedRadarFile
  });
  for (const j of filteredKeyword.jobs) {
    const text = `${j.title} ${j.summary} ${(j.tags || []).join(' ')} ${j.company}`.toLowerCase();
    assert.ok(text.includes('laravel'), `Job must contain keyword "laravel"`);
  }
  console.log('  ✅ Query and minScore filtering verified.');

  // Test 17: CLI argument parsing and validation
  console.log('Test 17: CLI argument parser permutations and validation');
  const cli1 = parseRadarCliArgs(['--query=rag', '--min-score=60', '--limit=20', '--source=mcp', '--json', '--refresh']);
  assert.equal(cli1.query, 'rag');
  assert.equal(cli1.minScore, 60);
  assert.equal(cli1.limit, 20);
  assert.equal(cli1.source, 'mcp');
  assert.equal(cli1.json, true);
  assert.equal(cli1.refresh, true);

  // Space-separated CLI syntax
  const cli2 = parseRadarCliArgs(['--query', 'laravel', '--min-score', '50', '--source', 'upwork', '-h']);
  assert.equal(cli2.query, 'laravel');
  assert.equal(cli2.minScore, 50);
  assert.equal(cli2.source, 'upwork');
  assert.equal(cli2.showHelp, true);

  // Invalid source rejection
  assert.throws(() => {
    parseRadarCliArgs(['--source=invalid_source']);
  }, /Source invalide/, 'Should reject invalid source');
  console.log('  ✅ CLI argument parser and validation verified.');

  // Test 18: formatJobCard terminal rendering
  console.log('Test 18: Terminal job card formatting');
  const sampleCardJob = {
    title: 'Senior AI Agent Engineer',
    company: 'Tech Corp',
    location: 'Remote',
    salary_or_rate: '$150k - $180k/an',
    matchScore: 85,
    tags: ['mcp', 'agents', 'rag'],
    source: 'ai-dev-jobs-mcp',
    url: 'https://aidevboard.com/job/sample',
    summary: 'Build high-performance AI agents.'
  };
  const cardOutput = formatJobCard(sampleCardJob, 1);
  assert.ok(cardOutput.includes('[#1] Senior AI Agent Engineer'));
  assert.ok(cardOutput.includes('🟢 85% MATCH EXCELLENT'));
  assert.ok(cardOutput.includes('Tech Corp'));
  assert.ok(cardOutput.includes('https://aidevboard.com/job/sample'));
  console.log('  ✅ Terminal job card rendering verified.');

  // Test 19: Live MCP endpoint connectivity test (real HTTP/2 over TLS)
  console.log('Test 19: Live MCP remote connectivity (https://aidevboard.com/mcp)');
  try {
    const liveStats = await callMcpTool('get_stats', {}, { timeout: 8000 });
    assert.ok(liveStats, 'Live MCP get_stats should return response');
    assert.ok(liveStats.content || liveStats.structuredContent, 'Live response should contain content or structuredContent');
    console.log('  ✅ Live MCP endpoint https://aidevboard.com/mcp reachable and verified.');
  } catch (liveErr) {
    // If running in an offline sandbox, handle gracefully without failing test suite
    console.log(`  ℹ️ Live MCP check skipped or offline (${liveErr.message}). Mock tests guarantee correctness.`);
  }

  // Test 20: Full pipeline end-to-end integration test
  console.log('Test 20: Full pipeline end-to-end integration with cache update');
  const pipelineResult = await collectMarketOpportunities({
    source: 'all',
    limit: 10,
    persist: true,
    silent: true,
    transport: multiMockTransport,
    radarFilePath: TEMP_RADAR_FILE
  });
  assert.ok(pipelineResult.jobs.length > 0, 'Pipeline must return jobs');
  assert.ok(pipelineResult.sources.mcp > 0, 'Pipeline must contain MCP jobs');
  assert.ok(pipelineResult.sources.upwork > 0, 'Pipeline must contain Upwork jobs');

  // Verify that the file was written to disk and can be read back
  const persistedCheck = loadRadarJobs(TEMP_RADAR_FILE);
  assert.ok(persistedCheck.total_jobs > 0, 'Persisted file must have jobs');
  assert.ok(persistedCheck.seen_ids.length > 0, 'Persisted file must have seen_ids');
  console.log('  ✅ Full pipeline end-to-end integration verified.');

  // Test 21: extractJobsFromToolResult defensive fallback text & markdown parsing
  console.log('Test 21: Defensive fallback extraction when structuredContent is absent');
  const mockTextToolRes = {
    content: [
      {
        type: 'text',
        text: 'Found 2 matching roles:\n\n1. Autonomous Agent Architect — OpenAI Ecosystem\n   Remote (Worldwide)\n   Salary: $180000–$220000\n\n2. Senior Laravel & Vue Lead — SaaS Global\n   Paris, France\n   Salary: $95000'
      }
    ]
  };
  const extractedFromText = extractJobsFromToolResult(mockTextToolRes);
  assert.equal(extractedFromText.length, 2, 'Should parse 2 jobs from plain text listing');
  assert.equal(extractedFromText[0].title, 'Autonomous Agent Architect');
  assert.equal(extractedFromText[0].company, 'OpenAI Ecosystem');
  assert.equal(extractedFromText[1].title, 'Senior Laravel & Vue Lead');

  // Test JSON-stringified content fallback
  const mockJsonStringRes = {
    content: [
      {
        type: 'text',
        text: JSON.stringify([
          { id: 'json-1', title: 'RAG Pipeline Engineer', company_name: 'VectorDB Inc', tags: ['rag', 'python'] }
        ])
      }
    ]
  };
  const extractedFromJsonString = extractJobsFromToolResult(mockJsonStringRes);
  assert.equal(extractedFromJsonString.length, 1);
  assert.equal(extractedFromJsonString[0].title, 'RAG Pipeline Engineer');
  console.log('  ✅ Defensive fallback extraction verified for text & stringified JSON.');

  // Test 22: Refresh mode in collectMarketOpportunities (--refresh flag)
  console.log('Test 22: Refresh flag behavior in collectMarketOpportunities');
  const refreshResult = await collectMarketOpportunities({
    source: 'upwork',
    refresh: true,
    persist: false,
    silent: true,
    radarFilePath: TEMP_RADAR_FILE
  });
  assert.ok(refreshResult.jobs.length > 0, 'Refresh mode must return jobs');
  assert.equal(refreshResult.newlyDiscovered, refreshResult.jobs.length, 'In refresh mode, seen_ids must not filter fresh jobs');
  console.log('  ✅ Refresh mode verified.');

  // Test 23: Cache total_jobs & sources consistency on bounded persistence
  console.log('Test 23: Cache slice consistency in saveRadarJobs (max 300)');
  const dummyJobs = Array.from({ length: 350 }, (_, i) => ({
    id: `mcp-dummy-${i}`,
    title: `Dummy Job ${i}`,
    source: i % 2 === 0 ? 'ai-dev-jobs-mcp' : 'upwork-sweeper'
  }));
  const boundedStorageFile = path.join(TEMP_DATA_DIR, 'bounded_radar.json');
  saveRadarJobs({ seen_ids: [], jobs: dummyJobs }, boundedStorageFile);
  const reloadedBounded = loadRadarJobs(boundedStorageFile);
  assert.equal(reloadedBounded.jobs.length, 300, 'Jobs array must be clamped to 300');
  assert.equal(reloadedBounded.total_jobs, 300, 'total_jobs must strictly equal jobs.length (300)');
  console.log('  ✅ Cache boundary consistency verified.');

  // Test 24: HTTPS 1.1 fallback client error rejection
  console.log('Test 24: Resilient HTTPS 1.1 client fallback handling');
  await assert.rejects(async () => {
    await callMcpHttps1('https://127.0.0.1:1/mcp', {}, { timeout: 500 });
  }, 'Unreachable host should reject cleanly without unhandled rejection');
  console.log('  ✅ HTTPS 1.1 fallback rejection verified.');

  // Test 25: Non-tech zero score validation on remote/contract roles
  console.log('Test 25: Zero matchScore for non-tech remote contract roles');
  const remoteNurse = {
    title: 'Remote Contract Travel Nurse Recruiter',
    summary: 'Coordinate schedules for clinical nursing staff. 100% remote freelance contract.',
    tags: ['recruiting', 'healthcare'],
    workplace: 'remote',
    jobType: 'freelance'
  };
  const nurseScore = calculateMatchScore(remoteNurse);
  assert.equal(nurseScore.matchScore, 0, 'Non-tech role must receive exactly 0% score even if remote & contract');
  assert.equal(nurseScore.matchedSkills.length, 0);
  assert.equal(nurseScore.matchReasons.length, 0);
  console.log('  ✅ Non-tech zero score validation verified.');

  // Clean temp files
  cleanupTemp();

  console.log('\n🎉 ALL 25 MARKET RADAR TESTS PASSED SUCCESSFULLY!\n');
} catch (err) {
  cleanupTemp();
  console.error('\n❌ Radar test failure :', err);
  process.exit(1);
}
