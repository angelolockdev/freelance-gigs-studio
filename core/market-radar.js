/**
 * Freelance Gigs Studio - Radar de Veille Marché
 * 
 * Collecteur & Moteur de Scoring d'opportunités Freelance & Contract
 * Interroge le serveur MCP public https://aidevboard.com/mcp (IA/ML, RAG, Agents, MCP)
 * et intègre le flux passif des missions Upwork (scripts/upwork-sweeper/jobs_log.json).
 * 
 * Fonctionnalités clés :
 *  - Client MCP streamable HTTP / HTTP2 avec transport JSON-RPC 2.0 résilient
 *  - Normalisation unifiée sous schéma strict : id, title, company, location, salary_or_rate, url, tags, source, summary, timestamp
 *  - Moteur de scoring de pertinence (0-100%) aligné sur le profil d'Angelo Lock To Hang
 *  - Cache anti-doublon glissant (seen_ids) et persistance dans data/radar_jobs.json
 *  - Passerelle passive avec le flux Upwork sweeper
 *  - Interface CLI riche avec filtrage (--query, --min-score, --limit, --source, --json, --help)
 */

import fs from 'node:fs';
import http2 from 'node:http2';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemins par défaut
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const RADAR_JOBS_FILE = path.join(DATA_DIR, 'radar_jobs.json');
export const UPWORK_JOBS_FILE = path.resolve(ROOT_DIR, '../upwork-sweeper/jobs_log.json');

// Configuration du Radar
export const DEFAULT_MCP_URL = 'https://aidevboard.com/mcp';
export const DEFAULT_MCP_TIMEOUT = 10000; // 10 secondes
export const MAX_SEEN_HISTORY = 500;
export const DEFAULT_LIMIT = 15;

/**
 * Taxonomie et pondération des compétences d'Angelo Lock To Hang
 * Profil : 6+ ans Fullstack (PHP/Laravel, React, SQL, Docker) + Spécialiste IA Appliquée (RAG, Agents, MCP, LangChain, Python)
 */
export const SKILL_TAXONOMY = [
  // Superpouvoirs IA & Architecture (Tier 1 : 25-30 pts)
  { id: 'mcp', label: 'MCP (Model Context Protocol)', weight: 30, regex: /\b(?:mcp|model[- ]context[- ]protocol)\b/i },
  { id: 'rag', label: 'RAG / Vector DB', weight: 30, regex: /\b(?:rag|retrieval[- ]augmented|vector(?:s|ial)?|chromadb|pinecone|qdrant|weaviate)\b/i },
  { id: 'laravel', label: 'Laravel', weight: 30, regex: /\blaravel\b/i },
  { id: 'agents', label: 'AI Agents / Agentic Workflows', weight: 25, regex: /\b(?:agentic|ai[- ]agents?|autonomous[- ]agents?|multi[- ]agents?|coding[- ]agents?|software[- ]agents?|intelligent[- ]agents?|replit[- ]agent|crewai|autogen|(?:ai|llm|rag|autonomous|software|coding|conversational)[- ]?\w*[- ]?agents?|agents?[- ](?:frameworks?|architectures?|workflows?|systems?|pipelines?))\b/i },
  { id: 'php', label: 'PHP', weight: 25, regex: /\bphp\b/i },
  
  // Écosystème IA & Orchestration (Tier 2 : 15-20 pts)
  { id: 'langchain', label: 'LangChain / LangGraph', weight: 20, regex: /\b(?:langchain|langgraph|llamaindex)\b/i },
  { id: 'llm', label: 'LLM & Prompt Engineering', weight: 15, regex: /\b(?:llm|llms|openai|claude|anthropic|gpt-?4|prompt[- ]engineering)\b/i },
  { id: 'python', label: 'Python / FastAPI', weight: 15, regex: /\b(?:python|fastapi)\b/i },

  // Stack Web Fullstack & Frontend (Tier 2 : 15-20 pts)
  { id: 'react', label: 'React / Next.js', weight: 20, regex: /\b(?:react(?:js|\.js)?|next(?:js|\.js)?)\b/i },
  { id: 'typescript', label: 'TypeScript / Node.js', weight: 15, regex: /\b(?:typescript|ts|nodejs|node\.js)\b/i },
  { id: 'fullstack', label: 'Fullstack Web Architecture', weight: 15, regex: /\b(?:fullstack|full-stack|full stack)\b/i },

  // Socle Backend, Bases de Données & DevOps (Tier 3 : 10-15 pts)
  { id: 'sql', label: 'SQL / PostgreSQL / MySQL', weight: 15, regex: /\b(?:sql|postgres(?:ql)?|mysql|database)\b/i },
  { id: 'docker', label: 'Docker / Conteneurisation', weight: 10, regex: /\b(?:docker|docker-compose|dockerfile|containeri[sz]ation|containeri[sz]ed|linux[- ]containers?)\b/i },
  { id: 'api', label: 'REST APIs & Webhooks', weight: 10, regex: /\b(?:rest[- ]?api|restful|webhook(?:s)?|microservices?)\b/i },
  { id: 'tailwind', label: 'Tailwind CSS', weight: 10, regex: /\btailwind(?:css)?\b/i }
];

/**
 * Modificateurs contextuels de scoring (télétravail, type de contrat, etc.)
 */
export const CONTEXT_MODIFIERS = {
  remote: {
    weight: 10,
    regex: /\b(?:remote|t[eé]l[eé]travail|work from home|anywhere)\b/i,
    label: 'Télétravail / Remote'
  },
  contract_freelance: {
    weight: 10,
    regex: /\b(?:contract|freelance|contractor|mission|tjm|hourly|fixed[- ]rate|ind[eé]pendant)\b/i,
    label: 'Mission Contractuelle / Freelance'
  },
  onsite_penalty: {
    weight: -20,
    regex: /\b(?:onsite only|must be on-site|in-office only)\b/i,
    label: 'Pénalité Présentiel Strict'
  }
};

/**
 * Extrait les compétences correspondantes à partir d'un texte et d'une liste de tags
 * @param {string} text 
 * @param {string[]} tags 
 * @returns {Array<{ id: string, label: string, weight: number }>}
 */
export function extractMatchedSkills(text = '', tags = []) {
  const safeTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',') : []);
  const normalizedTags = safeTags.map(t => String(t).toLowerCase().trim());
  const combinedText = `${text || ''} ${normalizedTags.join(' ')}`.toLowerCase();
  const matched = [];

  for (const skill of SKILL_TAXONOMY) {
    const isTagMatch = normalizedTags.includes(skill.id) || normalizedTags.includes(`${skill.id}s`);
    if (isTagMatch || skill.regex.test(combinedText)) {
      matched.push({ id: skill.id, label: skill.label, weight: skill.weight });
    }
  }

  return matched;
}

/**
 * Calcule le matchScore (0 à 100) pour une opportunité donnée
 * @param {object} job - Objet opportunité normalisé ou brut
 * @returns {{ matchScore: number, matchedSkills: string[], matchReasons: string[] }}
 */
export function calculateMatchScore(job = {}) {
  const safeJob = (job && typeof job === 'object') ? job : {};
  const safeTags = Array.isArray(safeJob.tags) ? safeJob.tags : (typeof safeJob.tags === 'string' ? safeJob.tags.split(',') : []);
  const text = `${safeJob.title || ''} ${safeJob.summary || safeJob.description || ''} ${safeTags.join(' ')}`.toLowerCase();
  const matchedSkills = extractMatchedSkills(text, safeTags);
  const matchReasons = [];

  // Si aucune compétence technique ne correspond, score 0 pour éviter d'inonder le radar de rôles hors-sujet
  if (matchedSkills.length === 0) {
    return {
      matchScore: 0,
      matchedSkills: [],
      matchReasons: []
    };
  }

  // Somme des compétences
  let rawScore = 0;
  for (const s of matchedSkills) {
    rawScore += s.weight;
    matchReasons.push(s.label);
  }

  // Modificateur télétravail
  const isRemote = safeJob.workplace === 'remote' || 
                   CONTEXT_MODIFIERS.remote.regex.test(safeJob.location || '') || 
                   CONTEXT_MODIFIERS.remote.regex.test(text);
  if (isRemote) {
    rawScore += CONTEXT_MODIFIERS.remote.weight;
    matchReasons.push('Télétravail (Remote)');
  }

  // Modificateur freelance / contractuel
  const isExplicitContract = safeJob.jobType === 'contract' || 
                             safeJob.jobType === 'freelance' || 
                             safeJob.jobType === 'hourly' || 
                             safeJob.jobType === 'fixed' ||
                             safeJob.source === 'upwork-sweeper';
  const hasContractKeyword = safeJob.jobType !== 'full-time' && 
                             (CONTEXT_MODIFIERS.contract_freelance.regex.test(safeJob.title || '') || 
                              CONTEXT_MODIFIERS.contract_freelance.regex.test(safeJob.summary || ''));
  const isContract = isExplicitContract || hasContractKeyword;
  if (isContract) {
    rawScore += CONTEXT_MODIFIERS.contract_freelance.weight;
    matchReasons.push('Format Freelance / Contractuel');
  }

  // Pénalité présentiel strict
  if (safeJob.workplace === 'onsite' && CONTEXT_MODIFIERS.onsite_penalty.regex.test(text)) {
    rawScore += CONTEXT_MODIFIERS.onsite_penalty.weight;
    matchReasons.push('Pénalité présentiel');
  }

  // Bornage strict [0, 100]
  const matchScore = Math.min(100, Math.max(0, Math.round(rawScore)));

  return {
    matchScore,
    matchedSkills: matchedSkills.map(s => s.id),
    matchReasons
  };
}

/**
 * Formatage d'une rémunération ou salaire estimé (taux horaire et annuel)
 * @param {number|null} min 
 * @param {number|null} max 
 * @param {string|null} fallback 
 * @returns {string}
 */
export function formatSalary(min, max, fallback = null) {
  const numMin = typeof min === 'number' ? min : (min ? parseFloat(min) : null);
  const numMax = typeof max === 'number' ? max : (max ? parseFloat(max) : null);

  // Cas 1 : Fourchette taux horaire (< 1000)
  if (numMin && numMax && numMax < 1000) {
    return `$${Math.round(numMin)} - $${Math.round(numMax)}/h`;
  }
  // Cas 2 : Taux horaire min seul (< 1000)
  if (numMin && numMin < 1000 && !numMax) {
    return `$${Math.round(numMin)}/h`;
  }
  // Cas 3 : Taux horaire max seul (< 1000)
  if (numMax && numMax < 1000 && !numMin) {
    return `Jusqu'à $${Math.round(numMax)}/h`;
  }

  // Cas 4 : Fourchette annuelle (>= 1000)
  if (numMin && numMax) {
    const kMin = Math.round(numMin / 1000);
    const kMax = Math.round(numMax / 1000);
    return `$${kMin}k - $${kMax}k/an`;
  }
  // Cas 5 : Salaire annuel min seul
  if (numMin) {
    return `$${Math.round(numMin / 1000)}k+/an`;
  }
  // Cas 6 : Salaire annuel max seul
  if (numMax) {
    return `Jusqu'à $${Math.round(numMax / 1000)}k/an`;
  }

  // Cas 7 : Fallback textuel
  if (fallback && typeof fallback === 'string' && fallback.trim()) {
    return fallback.trim();
  }
  return 'Rémunération non précisée';
}

/**
 * Envoie une requête JSON-RPC 2.0 au serveur MCP via HTTP/2 (node:http2)
 * Gère automatiquement la décompression gzip, les flux SSE et les réponses JSON
 * @param {string} mcpUrl 
 * @param {object} jsonRpcPayload 
 * @param {object} [options] 
 * @returns {Promise<any>}
 */
export function callMcpHttp2(mcpUrl = DEFAULT_MCP_URL, jsonRpcPayload = {}, options = {}) {
  const timeoutMs = options.timeout || DEFAULT_MCP_TIMEOUT;

  return new Promise((resolve, reject) => {
    let client;
    let timer;
    let settled = false;

    const safeReject = (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (client && !client.destroyed) {
        try { client.destroy(); } catch (_) {}
      }
      reject(err);
    };

    const safeResolve = (val) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (client && !client.destroyed) {
        try { client.destroy(); } catch (_) {}
      }
      resolve(val);
    };

    try {
      const parsed = new URL(mcpUrl);
      const tlsOptions = {
        rejectUnauthorized: options.rejectUnauthorized !== undefined 
          ? options.rejectUnauthorized 
          : false,
        ...options.tls
      };
      client = http2.connect(parsed.origin, tlsOptions);

      timer = setTimeout(() => {
        safeReject(new Error(`Timeout MCP dépassé (${timeoutMs}ms)`));
      }, timeoutMs);

      client.on('error', (err) => {
        safeReject(err);
      });

      const req = client.request({
        ':method': 'POST',
        ':path': parsed.pathname + parsed.search,
        'content-type': 'application/json',
        'accept': 'application/json, text/event-stream'
      });

      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      
      req.on('end', () => {
        try {
          const buf = Buffer.concat(chunks);
          if (buf.length === 0) {
            return safeReject(new Error('Réponse vide reçue du serveur MCP'));
          }

          // Décompression si en-tête gzip (0x1f, 0x8b)
          const text = (buf[0] === 0x1f && buf[1] === 0x8b)
            ? zlib.gunzipSync(buf).toString('utf-8')
            : buf.toString('utf-8');

          let parsedJson;
          try {
            parsedJson = JSON.parse(text);
          } catch (parseErr) {
            // Repli Server-Sent Events (SSE) : extraction des lignes 'data: {...}'
            const dataLines = text
              .split('\n')
              .filter(l => l.trim().startsWith('data:'))
              .map(l => l.trim().replace(/^data:\s*/, ''));
            if (dataLines.length > 0) {
              parsedJson = JSON.parse(dataLines.join(''));
            } else {
              return safeReject(new Error(`Erreur décodage réponse MCP : ${parseErr.message}`));
            }
          }

          if (parsedJson.error) {
            return safeReject(new Error(`Erreur JSON-RPC MCP : ${parsedJson.error.message || JSON.stringify(parsedJson.error)}`));
          }
          safeResolve(parsedJson);
        } catch (err) {
          safeReject(new Error(`Erreur décodage réponse MCP : ${err.message}`));
        }
      });

      req.on('error', (err) => {
        safeReject(err);
      });

      req.write(JSON.stringify(jsonRpcPayload));
      req.end();
    } catch (initErr) {
      safeReject(initErr);
    }
  });
}

/**
 * Transport de secours HTTPS 1.1 pour le serveur MCP en cas de défaillance HTTP/2
 * @param {string} mcpUrl 
 * @param {object} jsonRpcPayload 
 * @param {object} [options] 
 * @returns {Promise<any>}
 */
export function callMcpHttps1(mcpUrl = DEFAULT_MCP_URL, jsonRpcPayload = {}, options = {}) {
  const timeoutMs = options.timeout || DEFAULT_MCP_TIMEOUT;

  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(mcpUrl);
      const req = https.request({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        rejectUnauthorized: options.rejectUnauthorized !== undefined ? options.rejectUnauthorized : false,
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
          'user-agent': 'FreelanceStudio-Radar/1.0'
        },
        timeout: timeoutMs
      }, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            if (buf.length === 0) {
              return reject(new Error('Réponse vide reçue du serveur MCP (HTTPS 1.1)'));
            }

            const text = (buf[0] === 0x1f && buf[1] === 0x8b)
              ? zlib.gunzipSync(buf).toString('utf-8')
              : buf.toString('utf-8');

            let parsedJson;
            try {
              parsedJson = JSON.parse(text);
            } catch (pErr) {
              const dataLines = text
                .split('\n')
                .filter(l => l.trim().startsWith('data:'))
                .map(l => l.trim().replace(/^data:\s*/, ''));
              if (dataLines.length > 0) {
                parsedJson = JSON.parse(dataLines.join(''));
              } else {
                return reject(new Error(`Erreur décodage réponse MCP HTTPS : ${pErr.message}`));
              }
            }

            if (parsedJson.error) {
              return reject(new Error(`Erreur JSON-RPC MCP : ${parsedJson.error.message || JSON.stringify(parsedJson.error)}`));
            }
            resolve(parsedJson);
          } catch (err) {
            reject(new Error(`Erreur traitement réponse MCP HTTPS : ${err.message}`));
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout MCP HTTPS dépassé (${timeoutMs}ms)`));
      });

      req.on('error', reject);
      req.write(JSON.stringify(jsonRpcPayload));
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Appelle un outil MCP sur le serveur distant (tools/call)
 * Essaie en priorité HTTP/2 et bascule de manière transparente sur HTTPS 1.1 en cas d'incident
 * @param {string} toolName 
 * @param {object} args 
 * @param {object} [options]
 * @returns {Promise<any>}
 */
export async function callMcpTool(toolName, args = {}, options = {}) {
  // Support d'un transport simulé / mocké pour les tests unitaires
  if (typeof options.transport === 'function') {
    return options.transport(toolName, args, options);
  }

  const payload = {
    jsonrpc: '2.0',
    id: options.requestId || Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  };

  try {
    const res = await callMcpHttp2(options.url || DEFAULT_MCP_URL, payload, options);
    return res.result;
  } catch (h2Err) {
    if (!options.silent) {
      console.warn(`[MCP Client] Reconnexion de repli HTTPS 1.1 (${h2Err.message})`);
    }
    const res = await callMcpHttps1(options.url || DEFAULT_MCP_URL, payload, options);
    return res.result;
  }
}

/**
 * Normalise une offre brute issue de ai-dev-jobs-mcp
 * @param {object} raw 
 * @returns {object}
 */
export function normalizeMcpJob(raw = {}) {
  const safe = (raw && typeof raw === 'object') ? raw : {};
  const id = String(safe.id || safe.slug || Math.random().toString(36).slice(2));
  const title = String(safe.title || 'Opportunité Développeur IA').trim();
  const company = String(safe.company_name || safe.company || 'Entreprise Confidentielle').trim();
  const workplace = String(safe.workplace || (safe.remote_scope === 'not_remote' ? 'onsite' : 'remote')).toLowerCase();
  const location = safe.location 
    ? String(safe.location).trim() 
    : (workplace === 'remote' ? 'Remote' : 'Non précisé');
  
  const salary_or_rate = formatSalary(safe.salary_min, safe.salary_max, safe.salary_text);
  const url = safe.url || safe.apply_url || `https://aidevboard.com/job/${id}`;
  const tags = Array.isArray(safe.tags) 
    ? safe.tags.map(t => String(t).toLowerCase().trim()).filter(Boolean)
    : [];

  const rawSummary = safe.description || safe.snippet || '';
  const cleanSummary = String(rawSummary)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 350) + (rawSummary.length > 350 ? '...' : '');

  const timestamp = safe.published_at || safe.created_at || new Date().toISOString();
  const jobType = safe.job_type || 'full-time';

  const baseJob = {
    id: safe.id && String(safe.id).startsWith('mcp-') ? String(safe.id) : `mcp-${id}`,
    title,
    company,
    location,
    salary_or_rate,
    url,
    tags,
    source: 'ai-dev-jobs-mcp',
    summary: cleanSummary,
    timestamp,
    workplace,
    jobType
  };

  const scoring = calculateMatchScore(baseJob);

  return {
    ...baseJob,
    matchScore: scoring.matchScore,
    matchedSkills: scoring.matchedSkills,
    matchReasons: scoring.matchReasons
  };
}

/**
 * Normalise une annonce brute issue de scripts/upwork-sweeper/jobs_log.json
 * @param {object} raw 
 * @returns {object}
 */
export function normalizeUpworkJob(raw = {}) {
  const safe = (raw && typeof raw === 'object') ? raw : {};
  const id = String(safe.id || Math.random().toString(36).slice(2));
  const title = String(safe.title || 'Mission Upwork').trim();
  
  const clientCountry = safe.client?.country || '';
  const company = clientCountry ? `Client Upwork (${clientCountry})` : 'Client Upwork';
  const location = clientCountry ? `${clientCountry} (Remote)` : 'Remote (Worldwide)';

  let salary_or_rate = 'Budget à définir';
  if (safe.budget && typeof safe.budget === 'string' && safe.budget.trim()) {
    salary_or_rate = safe.budget.trim();
  } else if (safe.job_type === 'hourly') {
    salary_or_rate = 'Taux horaire à définir';
  } else if (safe.job_type === 'fixed') {
    salary_or_rate = 'Prix fixe à définir';
  }

  const url = safe.url || `https://www.upwork.com/jobs/~${id}`;
  
  // Extraction des tags à partir du titre et du snippet, avec fusion des tags/skills bruts
  const rawTags = Array.isArray(safe.tags) ? safe.tags : (Array.isArray(safe.skills) ? safe.skills : []);
  const textToScan = `${title} ${safe.description_snippet || ''} ${rawTags.join(' ')}`;
  const detectedSkills = extractMatchedSkills(textToScan, rawTags);
  const detectedIds = detectedSkills.map(s => s.id);
  const tags = Array.from(new Set([...rawTags.map(t => String(t).toLowerCase().trim()), ...detectedIds])).filter(Boolean);

  const rawSummary = safe.description_snippet || safe.description || '';
  const cleanSummary = String(rawSummary)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 350) + (rawSummary.length > 350 ? '...' : '');

  const timestamp = safe.detected_at || new Date().toISOString();
  const jobType = safe.job_type === 'hourly' ? 'hourly' : 'fixed';

  const baseJob = {
    id: safe.id && String(safe.id).startsWith('upwork-') ? String(safe.id) : `upwork-${id}`,
    title,
    company,
    location,
    salary_or_rate,
    url,
    tags,
    source: 'upwork-sweeper',
    summary: cleanSummary,
    timestamp,
    workplace: 'remote',
    jobType
  };

  const scoring = calculateMatchScore(baseJob);

  return {
    ...baseJob,
    matchScore: scoring.matchScore,
    matchedSkills: scoring.matchedSkills,
    matchReasons: scoring.matchReasons
  };
}

/**
 * Lecteur passif du journal de captures Upwork
 * @param {string} [filePath]
 * @returns {object[]}
 */
export function loadUpworkJobs(filePath = UPWORK_JOBS_FILE) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(item => item && typeof item === 'object')
      .map(normalizeUpworkJob);
  } catch (err) {
    console.warn(`[Upwork Bridge] Impossible de lire ${filePath} : ${err.message}`);
    return [];
  }
}

/**
 * Charge le cache persistant radar_jobs.json
 * @param {string} [filePath]
 * @returns {{ updated_at: string, total_jobs: number, seen_ids: string[], jobs: object[] }}
 */
export function loadRadarJobs(filePath = RADAR_JOBS_FILE) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return {
        updated_at: data.updated_at || new Date().toISOString(),
        total_jobs: Array.isArray(data.jobs) ? data.jobs.length : 0,
        seen_ids: Array.isArray(data.seen_ids) ? data.seen_ids : [],
        jobs: Array.isArray(data.jobs) ? data.jobs : []
      };
    }
  } catch (err) {
    console.warn(`[Radar Storage] Impossible de lire ${filePath} : ${err.message}. Initialisation.`);
  }

  return {
    updated_at: new Date().toISOString(),
    total_jobs: 0,
    seen_ids: [],
    jobs: []
  };
}

/**
 * Sauvegarde le cache persistant radar_jobs.json
 * @param {object} radarData 
 * @param {string} [filePath]
 */
export function saveRadarJobs(radarData = {}, filePath = RADAR_JOBS_FILE) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const slicedJobs = (radarData.jobs || []).slice(0, 300);
    const payload = {
      updated_at: new Date().toISOString(),
      total_jobs: slicedJobs.length,
      sources: {
        mcp: slicedJobs.filter(j => j.source === 'ai-dev-jobs-mcp').length,
        upwork: slicedJobs.filter(j => j.source === 'upwork-sweeper').length
      },
      seen_ids: (radarData.seen_ids || []).slice(-MAX_SEEN_HISTORY),
      jobs: slicedJobs
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[Radar Storage] Erreur écriture dans ${filePath} : ${err.message}`);
    return false;
  }
}

/**
 * Déduplication des opportunités via clé unique et rotation glissante
 * @param {object[]} newJobs 
 * @param {string[]} existingSeenIds 
 * @param {number} [maxHistory]
 * @returns {{ uniqueJobs: object[], updatedSeenIds: string[], duplicatesCount: number }}
 */
export function deduplicateJobs(newJobs = [], existingSeenIds = [], maxHistory = MAX_SEEN_HISTORY) {
  const seenSet = new Set(existingSeenIds);
  const uniqueJobs = [];
  let duplicatesCount = 0;

  for (const job of newJobs) {
    const key = job.id;
    if (seenSet.has(key)) {
      duplicatesCount++;
    } else {
      seenSet.add(key);
      uniqueJobs.push(job);
    }
  }

  const updatedSeenIds = Array.from(seenSet).slice(-maxHistory);

  return {
    uniqueJobs,
    updatedSeenIds,
    duplicatesCount
  };
}

/**
 * Extrait les opportunités depuis le résultat d'un outil MCP
 * Gère à la fois structuredContent (jobs/matches) et le fallback texte / JSON standard MCP
 * @param {object} toolResult 
 * @returns {object[]}
 */
export function extractJobsFromToolResult(toolResult = {}) {
  const jobs = [];

  // 1. structuredContent.jobs (search_jobs)
  if (Array.isArray(toolResult?.structuredContent?.jobs)) {
    for (const raw of toolResult.structuredContent.jobs) {
      if (raw) jobs.push(normalizeMcpJob(raw));
    }
  }

  // 2. structuredContent.matches (match_jobs)
  if (Array.isArray(toolResult?.structuredContent?.matches)) {
    for (const item of toolResult.structuredContent.matches) {
      if (item?.job) jobs.push(normalizeMcpJob(item.job));
    }
  }

  // 3. Fallback texte / JSON standard MCP si structuredContent est absent
  if (jobs.length === 0 && Array.isArray(toolResult?.content)) {
    for (const c of toolResult.content) {
      if (c?.type === 'text' && typeof c.text === 'string') {
        try {
          const parsed = JSON.parse(c.text);
          const list = Array.isArray(parsed) ? parsed : (parsed.jobs || parsed.matches || []);
          for (const item of list) {
            const raw = item.job || item;
            if (raw && (raw.title || raw.id)) {
              jobs.push(normalizeMcpJob(raw));
            }
          }
        } catch (_) {
          // Extraction par motif textuel : "1. Senior Developer — Company"
          const itemRegex = /(?:^|\n)\s*\d+\.\s+([^\n—–-]+)\s*[—–-]\s*([^\n]+)(?:\n\s*([^\n]+))?(?:\n\s*Salary:\s*([^\n]+))?/gi;
          let match;
          while ((match = itemRegex.exec(c.text)) !== null) {
            const [, title, company, loc, sal] = match;
            if (title && company) {
              jobs.push(normalizeMcpJob({
                title: title.trim(),
                company_name: company.trim(),
                location: loc ? loc.trim() : 'Remote',
                salary_text: sal ? sal.trim() : null,
                workplace: 'remote'
              }));
            }
          }
        }
      }
    }
  }

  return jobs;
}

/**
 * Interroge le serveur MCP pour plusieurs requêtes stratégiques (search_jobs & match_jobs)
 * @param {string[]} queries 
 * @param {object} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchMcpOpportunities(queries = ['rag', 'agent', 'mcp', 'laravel', 'react'], options = {}) {
  const collected = [];
  const tasks = [];

  const targetedSkills = options.query 
    ? [options.query.toLowerCase()] 
    : ['python', 'llm', 'rag', 'agents', 'mcp', 'react', 'laravel'];

  // 1. Recherche par profil (match_jobs)
  tasks.push(
    callMcpTool('match_jobs', {
      skills: targetedSkills,
      workplace: 'remote',
      limit: 15
    }, options).then(matchResult => {
      const matched = extractJobsFromToolResult(matchResult);
      collected.push(...matched);
    }).catch(err => {
      if (!options.silent) {
        console.warn(`[MCP Radar] Avertissement match_jobs : ${err.message}`);
      }
    })
  );

  // 2. Recherche ciblée par mots-clés (search_jobs) en parallèle
  for (const q of queries) {
    tasks.push(
      callMcpTool('search_jobs', {
        query: q,
        workplace: 'remote',
        limit: 10
      }, options).then(searchResult => {
        const searched = extractJobsFromToolResult(searchResult);
        collected.push(...searched);
      }).catch(err => {
        if (!options.silent) {
          console.warn(`[MCP Radar] Avertissement search_jobs("${q}") : ${err.message}`);
        }
      })
    );
  }

  await Promise.allSettled(tasks);
  return collected;
}

/**
 * Orchestrateur principal : Collecte, score, déduplique et filtre les opportunités
 * @param {object} [options]
 * @returns {Promise<{ jobs: object[], total: number, newlyDiscovered: number, sources: object }>}
 */
export async function collectMarketOpportunities(options = {}) {
  const sourceFilter = (options.source || 'all').toLowerCase(); // 'all' | 'mcp' | 'upwork'
  const minScore = typeof options.minScore === 'number' ? options.minScore : (parseInt(options.minScore, 10) || 0);
  const limit = parseInt(options.limit, 10) || DEFAULT_LIMIT;
  const keyword = (options.query || '').trim().toLowerCase();
  const persist = options.persist !== false;
  const isSilent = Boolean(options.silent || options.json);
  const isRefresh = Boolean(options.refresh);

  const radarStorage = loadRadarJobs(options.radarFilePath || RADAR_JOBS_FILE);
  let newlyCollected = [];

  // En mode refresh, on ne restreint pas la détection contre les anciens seen_ids
  const existingSeenIds = isRefresh ? [] : radarStorage.seen_ids;

  // 1. Collecte MCP
  if (sourceFilter === 'all' || sourceFilter === 'mcp') {
    const queries = keyword ? [keyword] : ['agent', 'rag', 'mcp', 'laravel', 'react'];
    try {
      const mcpJobs = await fetchMcpOpportunities(queries, { ...options, silent: isSilent });
      newlyCollected.push(...mcpJobs);
    } catch (err) {
      if (!isSilent) {
        console.warn(`[MCP Client] Erreur globale MCP : ${err.message}`);
      }
    }
  }

  // 2. Collecte Upwork
  if (sourceFilter === 'all' || sourceFilter === 'upwork') {
    const upworkJobs = loadUpworkJobs(options.upworkFilePath || UPWORK_JOBS_FILE);
    newlyCollected.push(...upworkJobs);
  }

  // 3. Déduplication & fusion avec l'historique existant
  const deduplication = deduplicateJobs(newlyCollected, existingSeenIds);
  
  // Fusion des nouvelles opportunités avec les opportunités déjà en mémoire
  const allMergedJobs = isRefresh 
    ? [...deduplication.uniqueJobs] 
    : [...deduplication.uniqueJobs, ...radarStorage.jobs];
  
  // Dédoublonnage sur la clé d'ID unique pour éviter toute collision
  const mapById = new Map();
  for (const j of allMergedJobs) {
    if (!mapById.has(j.id)) {
      mapById.set(j.id, j);
    }
  }
  let consolidatedJobs = Array.from(mapById.values());

  // 4. Recalcul ou mise à jour du matchScore
  consolidatedJobs = consolidatedJobs.map(job => {
    const scoring = calculateMatchScore(job);
    return {
      ...job,
      matchScore: scoring.matchScore,
      matchedSkills: scoring.matchedSkills,
      matchReasons: scoring.matchReasons
    };
  });

  // 5. Sauvegarde du cache mis à jour si demandé
  if (persist) {
    saveRadarJobs({
      seen_ids: deduplication.updatedSeenIds,
      jobs: consolidatedJobs
    }, options.radarFilePath || RADAR_JOBS_FILE);
  }

  // 6. Filtrage pour la sortie
  let filtered = consolidatedJobs;

  if (sourceFilter !== 'all') {
    const expectedSource = sourceFilter === 'mcp' ? 'ai-dev-jobs-mcp' : 'upwork-sweeper';
    filtered = filtered.filter(j => j.source === expectedSource);
  }

  if (minScore > 0) {
    filtered = filtered.filter(j => j.matchScore >= minScore);
  }

  if (keyword) {
    filtered = filtered.filter(j => {
      const fullText = `${j.title} ${j.summary} ${(j.tags || []).join(' ')} ${(j.matchedSkills || []).join(' ')} ${j.company}`.toLowerCase();
      return fullText.includes(keyword);
    });
  }

  // Tri par matchScore décroissant puis par timestamp récent
  filtered.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  // Limitation des résultats
  const limitedResults = filtered.slice(0, limit);

  return {
    jobs: limitedResults,
    total: limitedResults.length,
    newlyDiscovered: deduplication.uniqueJobs.length,
    sources: {
      mcp: limitedResults.filter(j => j.source === 'ai-dev-jobs-mcp').length,
      upwork: limitedResults.filter(j => j.source === 'upwork-sweeper').length
    }
  };
}

/**
 * Analyse des arguments de la ligne de commande CLI
 * @param {string[]} argv 
 * @returns {object}
 */
export function parseRadarCliArgs(argv = []) {
  const args = argv.slice();
  let query = '';
  let minScore = 0;
  let limit = DEFAULT_LIMIT;
  let source = 'all';
  let json = false;
  let showHelp = false;
  let refresh = false;
  let statsOnly = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--refresh') {
      refresh = true;
    } else if (arg === '--stats') {
      statsOnly = true;
    } else if (arg.startsWith('--query=')) {
      query = arg.slice(arg.indexOf('=') + 1).trim();
    } else if (arg === '--query' && i + 1 < args.length) {
      query = args[++i].trim();
    } else if (arg.startsWith('--min-score=')) {
      minScore = parseInt(arg.slice(arg.indexOf('=') + 1).trim(), 10) || 0;
    } else if (arg === '--min-score' && i + 1 < args.length) {
      minScore = parseInt(args[++i].trim(), 10) || 0;
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.slice(arg.indexOf('=') + 1).trim(), 10) || DEFAULT_LIMIT;
    } else if (arg === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[++i].trim(), 10) || DEFAULT_LIMIT;
    } else if (arg.startsWith('--source=')) {
      source = arg.slice(arg.indexOf('=') + 1).trim().toLowerCase();
    } else if (arg === '--source' && i + 1 < args.length) {
      source = args[++i].trim().toLowerCase();
    } else if (!arg.startsWith('-') && !query) {
      query = arg.trim();
    }
  }

  // Validation du filtre source
  if (!['all', 'mcp', 'upwork'].includes(source)) {
    throw new Error(`Source invalide "${source}". Options acceptées : all, mcp, upwork.`);
  }

  return {
    query,
    minScore,
    limit,
    source,
    json,
    showHelp,
    refresh,
    statsOnly
  };
}

/**
 * Affiche l'aide CLI
 */
export function printRadarHelp() {
  console.log(`
================================================================================
          FREELANCE GIGS STUDIO - RADAR DE VEILLE MARCHÉ & OPPORTUNITÉS         
================================================================================

Usage:
  npm run radar -- [options]
  node core/market-radar.js [options]

Options:
  --query=<keyword>      Filtrer par mot-clé (ex: rag, laravel, agent, react)
  --min-score=<n>        Score minimum de pertinence (0-100, ex: 60)
  --limit=<n>            Nombre maximum d'opportunités affichées (défaut: 15)
  --source=<source>      Source cible : all, mcp, ou upwork (défaut: all)
  --refresh              Forcer une nouvelle requête distante sur le serveur MCP
  --stats                Afficher uniquement les statistiques globales du marché
  --json                 Exporter le résultat brut au format JSON vers stdout
  --help, -h             Afficher cette documentation d'aide

Exemples:
  # Afficher les meilleures opportunités RAG & Agents IA (Score >= 70%) :
  node core/market-radar.js --query=rag --min-score=70

  # Afficher les missions Laravel & Fullstack :
  node core/market-radar.js --query=laravel

  # Obtenir un flux JSON pour intégration dans un script ou dashboard :
  node core/market-radar.js --source=all --json
`);
}

/**
 * Rendu visuel d'une carte opportunité dans la console
 * @param {object} job 
 * @param {number} index 
 */
export function formatJobCard(job, index) {
  const scoreBadge = job.matchScore >= 80 
    ? `🟢 ${job.matchScore}% MATCH EXCELLENT`
    : job.matchScore >= 60
      ? `🟡 ${job.matchScore}% MATCH SOLIDE`
      : `⚪ ${job.matchScore}% MATCH MODÉRÉ`;

  const sourceIcon = job.source === 'ai-dev-jobs-mcp' ? '🤖 AI Dev Board' : '💼 Upwork Sweeper';
  const tagsStr = (job.tags || []).slice(0, 6).join(' · ');

  return `
[#${index}] ${job.title}
    🏢 Entreprise : ${job.company} | 📍 ${job.location}
    💶 Rémunération : ${job.salary_or_rate}
    🎯 Pertinence : [${scoreBadge}]
    🏷️ Tags : ${tagsStr || 'N/A'}
    📡 Source : ${sourceIcon}
    🔗 URL : ${job.url}
    📝 Aperçu : ${job.summary}
--------------------------------------------------------------------------------`;
}

/**
 * Point d'entrée de l'exécution CLI
 * @param {string[]} argv 
 */
export async function runRadarCli(argv = process.argv.slice(2)) {
  const options = parseRadarCliArgs(argv);

  if (options.showHelp) {
    printRadarHelp();
    return;
  }

  // Mode statistiques MCP
  if (options.statsOnly) {
    try {
      console.log('📊 Récupération des statistiques du marché IA/ML via aidevboard.com/mcp...\n');
      const statsRes = await callMcpTool('get_stats', {}, { timeout: 8000 });
      if (options.json) {
        console.log(JSON.stringify(statsRes, null, 2));
      } else {
        const text = statsRes?.content?.[0]?.text || 'Statistiques indisponibles';
        console.log(text);
      }
      return;
    } catch (err) {
      console.error(`❌ Impossible de récupérer les statistiques : ${err.message}`);
      process.exit(1);
    }
  }

  if (!options.json) {
    console.log('================================================================================');
    console.log('      🛰️  FREELANCE GIGS STUDIO - RADAR DE VEILLE (MCP & UPWORK)                ');
    console.log('================================================================================');
    console.log(`Filtre : query="${options.query || '*'}" | source=${options.source} | minScore=${options.minScore} | limit=${options.limit}`);
    console.log('Synchronisation en cours...\n');
  }

  const results = await collectMarketOpportunities(options);

  if (options.json) {
    console.log(JSON.stringify(results.jobs, null, 2));
    return;
  }

  if (results.jobs.length === 0) {
    console.log('⚠️ Aucune opportunité ne correspond aux critères spécifiés.');
    console.log('   Essayez de réduire le --min-score ou d\'élargir le --query.');
    return;
  }

  results.jobs.forEach((job, idx) => {
    console.log(formatJobCard(job, idx + 1));
  });

  console.log(`\n✨ Bilan : ${results.jobs.length} opportunité(s) affichée(s) (${results.sources.mcp} MCP, ${results.sources.upwork} Upwork) | ${results.newlyDiscovered} nouvellement détectée(s).`);
  console.log(`📁 Cache synchronisé dans : data/radar_jobs.json\n`);
}

// Lancement automatique si exécuté en tant que script principal
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runRadarCli().catch(err => {
    console.error('❌ Erreur fatale Radar :', err.message);
    process.exit(1);
  });
}
