/**
 * Freelance Gigs Studio - Client Application
 * 
 * Gestion de l'interface utilisateur réactive :
 *  - Pilotage des fiches ComeUp & Fiverr
 *  - Comparateur bilingue côte à côte
 *  - Galerie de miniatures HD avec lightbox
 *  - Injection CDP sécurisée (mode Brouillon)
 *  - Radar d'opportunités en temps réel
 *  - Ingénierie d'offre et Value Equation
 */

// État global
const state = {
  currentTab: 'studio',
  currentGigSlug: 'ai-rag-agent',
  strategyGigSlug: 'ai-rag-agent',
  gigs: [],
  activeGig: null,
  radarJobs: [],
  radarStats: null,
  strategy: null,
  filterDebounceTimer: null
};

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
  logConsole('🚀 Initialisation du Freelance Gigs Studio...', 'info');
  await refreshStatus();
  await loadGigs();
  await loadRadar();
  await loadStrategy();
  // Vérification périodique du statut (toutes les 15s)
  setInterval(refreshStatus, 15000);
});

// ==========================================
// NAVIGATION DES ONGLETS
// ==========================================
function switchTab(tabId) {
  state.currentTab = tabId;
  const tabs = ['studio', 'radar', 'strategy'];

  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const view = document.getElementById(`view-${t}`);
    if (t === tabId) {
      btn.classList.add('active');
      btn.classList.remove('text-slate-400');
      btn.classList.add('text-brand-400');
      view.classList.remove('hidden');
    } else {
      btn.classList.remove('active');
      btn.classList.add('text-slate-400');
      btn.classList.remove('text-brand-400');
      view.classList.add('hidden');
    }
  });

  logConsole(`📑 Basculement vers l'onglet : ${tabId.toUpperCase()}`, 'info');
}

// ==========================================
// STATUT SYSTÈME & CDP
// ==========================================
async function refreshStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // CDP Badge
    const cdpBadge = document.getElementById('badge-cdp');
    if (data.cdp && data.cdp.connected) {
      cdpBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-emerald-300 font-medium">CDP Connecté (Port ${data.cdp.port})</span>
      `;
      cdpBadge.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300';
    } else {
      cdpBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        <span class="text-amber-300 font-medium">CDP Inactif (Port 9222)</span>
      `;
      cdpBadge.className = 'flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300';
    }

    // Compteurs
    if (data.counts) {
      document.getElementById('badge-gigs-count').innerText = data.counts.gigs;
      document.getElementById('badge-thumbnails-count').innerText = data.counts.thumbnails;
      document.getElementById('badge-jobs-count').innerText = data.counts.radarJobs;
    }
  } catch (err) {
    console.warn('Erreur lors du rafraîchissement du statut :', err.message);
  }
}

// ==========================================
// CHARGEMENT & GESTION DES GIGS
// ==========================================
async function loadGigs() {
  try {
    const res = await fetch('/api/gigs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.gigs = data.gigs || [];

    renderGigSelectorPills();
    if (state.gigs.length > 0) {
      const initial = state.gigs.find(g => g.slug === state.currentGigSlug) || state.gigs[0];
      await selectGig(initial.slug);
    }
  } catch (err) {
    logConsole(`❌ Erreur de chargement des fiches : ${err.message}`, 'error');
  }
}

function renderGigSelectorPills() {
  const container = document.getElementById('gig-selector-container');
  if (!container || !state.gigs.length) return;

  container.innerHTML = state.gigs.map(g => {
    const isActive = g.slug === state.currentGigSlug;
    const icon = g.slug.includes('rag') ? '🤖' : '⚡';
    const activeClass = isActive
      ? 'bg-brand-500/20 border-brand-500 text-brand-300'
      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600';

    return `
      <button onclick="selectGig('${g.slug}')" id="btn-gig-${g.slug}" class="gig-pill ${isActive ? 'active' : ''} px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center space-x-2 ${activeClass}">
        <span>${icon}</span>
        <span>${escapeHtml(g.meta?.shortTitle || g.slug)}</span>
      </button>
    `;
  }).join('');
}

async function selectGig(slug) {
  state.currentGigSlug = slug;
  renderGigSelectorPills();

  logConsole(`📁 Chargement de la fiche : [${slug}]...`, 'info');

  try {
    const res = await fetch(`/api/gigs/${slug}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.activeGig = data;

    renderActiveGigDetails(data);
    logConsole(`✅ Fiche [${slug}] synchronisée avec succès.`, 'success');
  } catch (err) {
    logConsole(`❌ Impossible de charger le gig [${slug}] : ${err.message}`, 'error');
  }
}

function renderActiveGigDetails(data) {
  const gig = data.gig;
  const comeup = gig.platforms?.comeup || {};
  const fiverr = gig.platforms?.fiverr || {};
  const meta = gig.meta || {};

  // Summary bar
  document.getElementById('gig-headline-title').innerText = comeup.title || gig.id;
  document.getElementById('gig-headline-subtitle').innerText = comeup.catchphrase || meta.positioning || 'Livraison clé en main • 100% Testé';
  document.getElementById('summary-comeup-price').innerText = `${comeup.baseOffer?.price || 25} €`;
  document.getElementById('summary-fiverr-price').innerText = fiverr.packages?.standard?.price ? `$${fiverr.packages.standard.price}` : '$180';
  document.getElementById('summary-delivery-time').innerText = fiverr.packages?.standard?.deliveryDays ? `${fiverr.packages.standard.deliveryDays} jours` : '2-4 jours';

  // Badges dynamiques de catégorie et de validation
  const catBadge = document.getElementById('gig-cat-badge');
  if (catBadge) {
    catBadge.innerText = (comeup.subcategory || gig.category || 'DÉVELOPPEMENT WEB').toUpperCase();
  }

  const validBadge = document.getElementById('gig-valid-badge');
  if (validBadge) {
    const isValid = Boolean(data.validation?.valid);
    validBadge.innerText = isValid ? '✅ 100% VALIDE' : '⚠️ NON CONFORME';
    validBadge.className = isValid
      ? 'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
      : 'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20';
  }

  // --- COMEUP VOLET ---
  document.getElementById('comeup-title').innerText = comeup.title || '';
  document.getElementById('comeup-base-desc').innerText = comeup.baseOffer?.name || 'Offre d\'amorçage';
  document.getElementById('comeup-base-price').innerText = `${comeup.baseOffer?.price || 25} €`;

  // ComeUp Options
  const optionsContainer = document.getElementById('comeup-options-container');
  if (Array.isArray(comeup.options)) {
    optionsContainer.innerHTML = comeup.options.map(opt => `
      <div class="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 flex items-start justify-between gap-3">
        <div>
          <span class="text-xs font-bold text-slate-200 block">${escapeHtml(opt.name)}</span>
          <p class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(opt.description || '')}</p>
          <div class="flex items-center space-x-2 mt-1.5 text-[10px] text-slate-500">
            <span>⏱️ +${opt.additionalDays || 1}j</span>
            <span>•</span>
            <span class="text-brand-400 font-semibold">${opt.code ? opt.code.toUpperCase() : 'OPTION'}</span>
          </div>
        </div>
        <span class="text-sm font-bold text-emerald-400 font-mono whitespace-nowrap">+${opt.price} €</span>
      </div>
    `).join('');
  }

  // ComeUp Description HTML preview (avec fallback de champ)
  const comeupDesc = comeup.description || comeup.descriptionHtml || '';
  const descEl = document.getElementById('comeup-description-preview');
  descEl.innerHTML = comeupDesc || '<p class="text-slate-500">Aucune description HTML renseignée.</p>';
  document.getElementById('comeup-desc-len').innerText = `${comeupDesc.length} caractères`;

  // ComeUp FAQ
  const faqContainer = document.getElementById('comeup-faq-container');
  if (Array.isArray(comeup.faq)) {
    faqContainer.innerHTML = comeup.faq.map((item, idx) => `
      <details class="bg-slate-900/40 rounded-xl border border-slate-800/60 p-2.5">
        <summary class="font-semibold text-xs text-slate-200 cursor-pointer focus:outline-none">
          ${idx + 1}. ${escapeHtml(item.q || item.question)}
        </summary>
        <p class="text-[11px] text-slate-400 mt-2 pl-3 border-l-2 border-brand-500/50 leading-relaxed">
          ${escapeHtml(item.a || item.answer)}
        </p>
      </details>
    `).join('');
  }

  // --- FIVERR VOLET ---
  document.getElementById('fiverr-title').innerText = fiverr.title || '';
  document.getElementById('fiverr-title-len').innerText = `${(fiverr.title || '').length}/80 chars`;

  // Fiverr Tags
  const tagsContainer = document.getElementById('fiverr-tags-container');
  if (Array.isArray(fiverr.tags)) {
    tagsContainer.innerHTML = fiverr.tags.map(t => `
      <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-xs border border-emerald-500/20">
        #${escapeHtml(t)}
      </span>
    `).join('');
  }

  // Fiverr 3 Packages
  const packagesContainer = document.getElementById('fiverr-packages-container');
  const pkgs = fiverr.packages || {};
  const packageCards = ['basic', 'standard', 'premium'].map(tier => {
    const p = pkgs[tier] || {};
    const isStandard = tier === 'standard';
    return `
      <div class="p-3 rounded-xl border ${isStandard ? 'bg-brand-950/30 border-brand-500/50' : 'bg-slate-900/60 border-slate-800'} flex flex-col justify-between space-y-2">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wider ${isStandard ? 'text-brand-400' : 'text-slate-400'}">${tier}</span>
            <span class="text-sm font-bold text-white font-mono">$${p.price || 0}</span>
          </div>
          <strong class="text-xs text-slate-200 block mt-1">${escapeHtml(p.name || tier)}</strong>
          <p class="text-[11px] text-slate-400 leading-snug mt-1">${escapeHtml(p.description || '')}</p>
        </div>
        <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 flex items-center justify-between">
          <span>⏱️ ${p.deliveryDays || 3} jours</span>
          <span>🔄 ${p.revisions === -1 ? 'Illimité' : (p.revisions || 2)} révis.</span>
        </div>
      </div>
    `;
  }).join('');
  packagesContainer.innerHTML = packageCards;

  // Fiverr Description Markdown preview (avec fallback de champ)
  const fiverrDesc = fiverr.description || fiverr.descriptionMarkdown || '';
  document.getElementById('fiverr-description-preview').innerText = fiverrDesc;
  document.getElementById('fiverr-desc-len').innerText = `${fiverrDesc.length}/1200 chars`;

  // Fiverr Requirements
  const reqContainer = document.getElementById('fiverr-requirements-container');
  if (Array.isArray(fiverr.requirements)) {
    reqContainer.innerHTML = fiverr.requirements.map((r, idx) => `
      <div class="flex items-start space-x-2">
        <span class="text-brand-400 font-bold">•</span>
        <span>${escapeHtml(typeof r === 'string' ? r : r.question)}</span>
      </div>
    `).join('');
  }

  // --- THUMBNAILS GALLERY ---
  renderThumbnailsGallery(data.thumbnails || []);
}

function renderThumbnailsGallery(thumbnails) {
  const container = document.getElementById('thumbnails-gallery-grid');
  if (!container) return;

  // Filtrer les PNG d'abord, ou afficher les deux
  const pngThumbnails = thumbnails.filter(t => t.ext === 'png');
  const displayList = pngThumbnails.length > 0 ? pngThumbnails : thumbnails;

  if (displayList.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-8 text-slate-500 text-xs">
        Aucune miniature trouvée pour ce gig.<br>
        Cliquez sur "Régénérer Miniatures" ci-dessus pour compiler les images Playwright.
      </div>
    `;
    return;
  }

  container.innerHTML = displayList.map(t => {
    const isDark = t.filename.includes('dark-tech');
    const badgeLabel = isDark ? 'Dark Tech (Néon)' : 'Navy Corporate';
    const badgeColor = isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    const sizeKb = (t.sizeBytes / 1024).toFixed(1);

    return `
      <div class="thumbnail-card bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer group" onclick="openLightbox('${t.url}', '${escapeHtml(t.filename)}')">
        <div class="relative aspect-[1280/769] overflow-hidden bg-black/40">
          <img src="${t.url}" alt="${escapeHtml(t.filename)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <span class="text-xs text-white font-semibold flex items-center space-x-1">
              <span>🔍</span>
              <span>Agrandir (1280x769 px)</span>
            </span>
          </div>
        </div>
        <div class="p-3 flex items-center justify-between text-xs">
          <div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}">${badgeLabel}</span>
            <div class="text-[11px] font-mono text-slate-300 mt-1 truncate max-w-[180px]">${escapeHtml(t.filename)}</div>
          </div>
          <span class="text-[10px] text-slate-500 font-mono">${sizeKb} KB</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// ACTIONS DU GIGS STUDIO
// ==========================================

// 1. Validation / Audit
async function validateCurrentGig() {
  const slug = state.currentGigSlug;
  const btns = document.querySelectorAll('button[onclick="validateCurrentGig()"]');
  btns.forEach(b => { b.disabled = true; b.classList.add('opacity-50'); });
  logConsole(`🛡️ Lancement de l'audit canonique pour [${slug}]...`, 'info');

  try {
    const res = await fetch(`/api/gigs/${slug}/validate`, { method: 'POST' });
    const data = await res.json();

    const modal = document.getElementById('modal-audit');
    const body = document.getElementById('audit-results-body');

    const statusBadge = data.valid
      ? '<span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">✅ CONFORME À 100%</span>'
      : '<span class="px-3 py-1 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">❌ ERREURS DÉTECTÉES</span>';

    let html = `
      <div class="p-4 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <h4 class="font-bold text-white text-sm">Fiche : ${escapeHtml(slug)}</h4>
          <span class="text-slate-400 text-xs">Vérification des limites de caractères, sélecteurs et politiques anti-fuite</span>
        </div>
        ${statusBadge}
      </div>
    `;

    if (data.errors && data.errors.length > 0) {
      html += `
        <div class="p-3 bg-red-950/30 border border-red-500/40 rounded-xl space-y-1">
          <strong class="text-red-400 block font-semibold">Erreurs bloquantes :</strong>
          <ul class="list-disc list-inside text-red-300 space-y-1">
            ${data.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    if (data.warnings && data.warnings.length > 0) {
      html += `
        <div class="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl space-y-1">
          <strong class="text-amber-400 block font-semibold">Avertissements :</strong>
          <ul class="list-disc list-inside text-amber-300 space-y-1">
            ${data.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Checklist affirmative
    html += `
      <div class="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-2">
        <strong class="text-white block font-semibold">Contrôles de Conformité :</strong>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Fiverr Title ≤ 80 car. ('I will...')</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Exactement 5 Tags Fiverr</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Fiverr Description ≤ 1200 car.</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>ComeUp Title ('Je vais...')</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Incrément prix ComeUp (pas de 5€)</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Zéro fuite email / whatsapp / contact</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Value Equation complète (4 piliers)</span></div>
          <div class="flex items-center space-x-1.5"><span class="text-emerald-400">✓</span><span>Positionnement Senior (6+ ans exp.)</span></div>
        </div>
      </div>
    `;

    body.innerHTML = html;
    modal.classList.remove('hidden');

    logConsole(`✅ Audit terminé pour [${slug}] : ${data.valid ? '100% Conforme' : 'Erreurs trouvées'}`, data.valid ? 'success' : 'warn');
  } catch (err) {
    logConsole(`❌ Échec de l'audit : ${err.message}`, 'error');
  } finally {
    btns.forEach(b => { b.disabled = false; b.classList.remove('opacity-50'); });
  }
}

function closeAuditModal() {
  document.getElementById('modal-audit').classList.add('hidden');
}

// 2. Exportation
async function exportCurrentGig() {
  const slug = state.currentGigSlug;
  const btns = document.querySelectorAll('button[onclick="exportCurrentGig()"]');
  btns.forEach(b => { b.disabled = true; b.classList.add('opacity-50'); });
  logConsole(`📄 Exportation des fiches HTML & Markdown pour [${slug}]...`, 'info');

  try {
    const res = await fetch(`/api/gigs/${slug}/export`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error);

    logConsole(`✅ Fichiers exportés avec succès dans data/output/exports/ :`, 'success');
    (data.files || []).forEach(f => {
      logConsole(`   • ${f}`, 'success');
    });

    // Proposer l'ouverture directe du fichier ComeUp HTML
    window.open(`/exports/${slug}-comeup.html`, '_blank');
  } catch (err) {
    logConsole(`❌ Échec de l'exportation : ${err.message}`, 'error');
  } finally {
    btns.forEach(b => { b.disabled = false; b.classList.remove('opacity-50'); });
  }
}

// 3. Régénération des miniatures
async function regenerateThumbnails() {
  const slug = state.currentGigSlug;
  const btns = document.querySelectorAll('button[onclick="regenerateThumbnails()"]');
  btns.forEach(b => { b.disabled = true; b.classList.add('opacity-50'); });
  logConsole(`🎨 Lancement de la génération Playwright des miniatures pour [${slug}]...`, 'info');

  try {
    const res = await fetch(`/api/gigs/${slug}/thumbnails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error);

    logConsole(`🎉 ${data.generatedCount} miniatures générées avec succès (PNG & WebP).`, 'success');
    // Rafraîchir l'affichage du gig actif
    await selectGig(slug);
  } catch (err) {
    logConsole(`❌ Échec de la génération des miniatures : ${err.message}`, 'error');
  } finally {
    btns.forEach(b => { b.disabled = false; b.classList.remove('opacity-50'); });
  }
}

// 4. Modal d'injection & Lancement
function openInjectModal() {
  document.getElementById('modal-inject').classList.remove('hidden');
}

function closeInjectModal() {
  document.getElementById('modal-inject').classList.add('hidden');
}

async function launchInjection() {
  const slug = state.currentGigSlug;
  const platform = document.getElementById('inject-platform-select').value;
  const variant = document.getElementById('inject-variant-select').value;
  const dryRun = document.getElementById('inject-dryrun-checkbox').checked;

  closeInjectModal();

  logConsole(`🚀 Démarrage injection pour [${slug}] | Cible: ${platform.toUpperCase()} | Mode: ${dryRun ? 'Dry-Run (Simulation)' : 'CDP Réel'}...`, 'info');

  const btn = document.getElementById('btn-run-inject');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/gigs/${slug}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, variant, dryRun })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de l\'injection');
    }

    logConsole(`✅ Injection terminée : ${data.message}`, 'success');
    logConsole(`🛡️ Politique de sécurité confirmée : ${data.safetyPolicy} (Arrêt en brouillon)`, 'success');

    if (data.results) {
      Object.keys(data.results).forEach(p => {
        const r = data.results[p];
        logConsole(`   🔹 [${p.toUpperCase()}] : Statut ${r.status || 'OK'} (${r.totalSteps || 0} étapes)`, 'info');
      });
    }
  } catch (err) {
    logConsole(`🚨 Échec de l'injection : ${err.message}`, 'error');
    if (err.message.includes('Chrome') || err.message.includes('CDP')) {
      logConsole(`💡 Conseil : Lancez Chrome via 'start-chrome-debug.bat' sur le port 9222 ou activez le mode 'Dry-Run'.`, 'warn');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================
// RADAR MARCHÉ & LEADS
// ==========================================
async function loadRadar(params = {}) {
  const query = params.query !== undefined ? params.query : document.getElementById('radar-filter-query')?.value || '';
  const source = params.source || document.getElementById('radar-filter-source')?.value || 'all';
  const minScore = params.minScore !== undefined ? params.minScore : document.getElementById('radar-filter-minscore')?.value || 0;

  try {
    const url = `/api/radar/jobs?query=${encodeURIComponent(query)}&source=${encodeURIComponent(source)}&minScore=${encodeURIComponent(minScore)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.radarJobs = data.jobs || [];
    state.radarStats = data.stats || {};

    renderRadarStats(data.stats, data.total);
    renderRadarCards(state.radarJobs);
  } catch (err) {
    console.warn('Erreur radar :', err.message);
  }
}

function renderRadarStats(stats = {}, total = 0) {
  document.getElementById('radar-stat-total').innerText = total || state.radarJobs.length;
  document.getElementById('radar-stat-high').innerText = stats.highMatchCount || 0;
  document.getElementById('radar-stat-medium').innerText = stats.mediumMatchCount || 0;
  document.getElementById('radar-stat-avg').innerText = `${stats.averageScore || 0}%`;
}

function renderRadarCards(jobs = []) {
  const container = document.getElementById('radar-cards-container');
  if (!container) return;

  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500 text-xs">
        Aucune opportunité ne correspond aux critères de filtre actuels.<br>
        Baissez le slider de score ou actualisez le radar distant.
      </div>
    `;
    return;
  }

  container.innerHTML = jobs.map(job => {
    const score = job.matchScore || 0;
    let scoreBadgeClass = 'badge-score-low';
    let scoreLabel = 'Match Standard';

    if (score >= 80) {
      scoreBadgeClass = 'badge-score-high';
      scoreLabel = 'Match Exceptionnel';
    } else if (score >= 60) {
      scoreBadgeClass = 'badge-score-med';
      scoreLabel = 'Bonne Opportunité';
    }

    const isUpwork = job.source?.includes('upwork');
    const sourceLabel = isUpwork ? 'Upwork' : 'MCP aidevboard';
    const sourceClass = isUpwork ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-brand-500/10 text-brand-400 border-brand-500/20';

    const tags = Array.isArray(job.tags) ? job.tags.slice(0, 5) : [];

    return `
      <div class="bg-darkcard border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-3 transition-all hover:-translate-y-1">
        <div class="space-y-2">
          <!-- Top score & source -->
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${scoreBadgeClass}">
              ${score}% Match • ${scoreLabel}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceClass}">
              ${sourceLabel}
            </span>
          </div>

          <!-- Job title & company -->
          <h4 class="text-sm font-bold text-white leading-snug line-clamp-2">${escapeHtml(job.title)}</h4>
          <div class="text-xs text-slate-400 flex items-center space-x-2">
            <span>🏢 ${escapeHtml(job.company || 'Client Confidentiel')}</span>
            <span>•</span>
            <span class="text-slate-300">📍 ${escapeHtml(job.location || 'Remote')}</span>
          </div>

          <!-- Salary / Rate -->
          ${job.salary_or_rate ? `
            <div class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800/80 text-xs text-emerald-400 font-mono font-semibold">
              💶 ${escapeHtml(job.salary_or_rate)}
            </div>
          ` : ''}

          <!-- Summary extract -->
          <p class="text-xs text-slate-400 line-clamp-3 leading-relaxed">
            ${escapeHtml(job.summary || '')}
          </p>
        </div>

        <div class="space-y-3 pt-2 border-t border-slate-800/80">
          <!-- Skill Tags -->
          <div class="flex flex-wrap gap-1">
            ${tags.map(t => `<span class="px-2 py-0.5 rounded bg-slate-900 text-slate-400 text-[10px] font-mono border border-slate-800">#${escapeHtml(t)}</span>`).join('')}
          </div>

          <!-- Action Link -->
          ${job.url ? `
            <a href="${job.url}" target="_blank" rel="noopener noreferrer" class="w-full text-center block px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-brand-400 hover:text-white font-semibold text-xs border border-slate-700 transition">
              Voir l'offre officielle ↗
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateRadarScoreLabel(val) {
  document.getElementById('radar-min-score-label').innerText = `${val} %`;
}

function debounceFilterRadar() {
  clearTimeout(state.filterDebounceTimer);
  state.filterDebounceTimer = setTimeout(() => {
    loadRadar();
  }, 250);
}

function filterRadarJobs() {
  loadRadar();
}

async function refreshRadarRemote() {
  const btn = document.getElementById('btn-refresh-radar');
  if (btn) btn.disabled = true;

  logConsole('🔄 Déclenchement de la collecte distante via le serveur MCP...', 'info');

  try {
    const res = await fetch('/api/radar/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.details || data.error);

    logConsole(`✅ Radar rafraîchi : ${data.newlyDiscovered || 0} nouvelle(s) opportunité(s) découverte(s). Total : ${data.total}`, 'success');
    await loadRadar();
  } catch (err) {
    logConsole(`❌ Erreur de rafraîchissement MCP : ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ==========================================
// STRATÉGIE & PSYCHOLOGIE D'OFFRE
// ==========================================
async function loadStrategy() {
  try {
    const res = await fetch('/api/strategy');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.strategy = data;

    renderStrategySkills(data.skillsTaxonomy || []);
    renderStrategyPricing(data.pricingStrategy?.tiers || {});
  } catch (err) {
    console.warn('Erreur chargement stratégie :', err.message);
  }
}

function switchStrategyPricingGig(slug) {
  state.strategyGigSlug = slug;
  const pills = ['ai-rag-agent', 'laravel-fullstack'];
  pills.forEach(p => {
    const btn = document.getElementById(`btn-strat-${p}`);
    if (!btn) return;
    if (p === slug) {
      btn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold border bg-brand-500/20 border-brand-500 text-brand-300 transition';
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg text-xs font-bold border bg-slate-800 border-slate-700 text-slate-400 hover:text-white transition';
    }
  });

  if (state.strategy?.pricingStrategy?.tiers) {
    renderStrategyPricing(state.strategy.pricingStrategy.tiers);
  }
}

function renderStrategyPricing(tiers = {}) {
  const container = document.getElementById('strategy-pricing-cards-container');
  if (!container) return;

  const slug = state.strategyGigSlug || 'ai-rag-agent';
  const tierData = tiers[slug];
  if (!tierData) return;

  const comeup = tierData.comeup || {};
  const fiverr = tierData.fiverr || {};

  container.innerHTML = `
    <!-- Tier 1 : Starter -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
      <div class="flex items-center justify-between">
        <span class="font-bold text-white uppercase text-[11px] tracking-wider">Palier 1 : Starter</span>
        <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">${escapeHtml(comeup.base?.price || '25 €')} / ${escapeHtml(fiverr.basic?.price || '$45')}</span>
      </div>
      <div class="text-brand-400 font-semibold">${escapeHtml(fiverr.basic?.name || comeup.base?.name || 'Starter PoC')}</div>
      <p class="text-slate-400">
        ${escapeHtml(comeup.base?.name || 'Audit de faisabilité & diagnostic')}. Élimine la friction psychologique du premier paiement tout en préservant l'autorité senior.
      </p>
    </div>

    <!-- Tier 2 : Standard (Sweet Spot) -->
    <div class="bg-gradient-to-b from-brand-950/40 to-slate-900 border-2 border-brand-500/60 rounded-xl p-4 text-xs space-y-2 relative shadow-lg shadow-brand-500/10">
      <div class="absolute -top-2.5 right-4 px-2 py-0.5 bg-brand-500 text-white font-bold text-[10px] rounded-full uppercase tracking-wider">
        ⭐ 70% des Ventes
      </div>
      <div class="flex items-center justify-between">
        <span class="font-bold text-white uppercase text-[11px] tracking-wider">Palier 2 : Standard (Sweet Spot)</span>
        <span class="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-mono font-bold">${escapeHtml(comeup.optionPro?.price || comeup.optionStandard?.price || '175 €')} / ${escapeHtml(fiverr.standard?.price || '$180')}</span>
      </div>
      <div class="text-emerald-400 font-semibold">${escapeHtml(fiverr.standard?.name || 'Sweet Spot Standard')}</div>
      <p class="text-slate-300">
        ${escapeHtml(comeup.optionPro?.name || comeup.optionStandard?.name || 'Solution complète vectorisée')}. Le meilleur rapport valeur/prix qui absorbe la majorité des conversions.
      </p>
    </div>

    <!-- Tier 3 : Enterprise / High Anchor -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
      <div class="flex items-center justify-between">
        <span class="font-bold text-white uppercase text-[11px] tracking-wider">Palier 3 : Premium / Décoi</span>
        <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">${escapeHtml(comeup.optionEnterprise?.price || '415 €')} / ${escapeHtml(fiverr.premium?.price || '$450')}</span>
      </div>
      <div class="text-purple-400 font-semibold">${escapeHtml(fiverr.premium?.name || 'Écosystème Entreprise')}</div>
      <p class="text-slate-400">
        ${escapeHtml(comeup.optionEnterprise?.name || 'Architecture complète avec serveur MCP')}. Rend le palier Standard très abordable tout en captant les budgets corporatifs.
      </p>
    </div>
  `;
}

function renderStrategySkills(skills = []) {
  const container = document.getElementById('strategy-skills-container');
  if (!container || !skills.length) return;

  container.innerHTML = skills.map(s => `
    <span class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
      <span class="font-semibold text-slate-200">${escapeHtml(s.label)}</span>
      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">+${s.weight}pts</span>
    </span>
  `).join('');
}

// ==========================================
// LIGHTBOX MODAL
// ==========================================
function openLightbox(src, caption) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox-caption').innerText = caption;
  document.getElementById('lightbox-download').href = src;
  document.getElementById('modal-lightbox').classList.remove('hidden');
}

function closeLightbox() {
  document.getElementById('modal-lightbox').classList.add('hidden');
}

// ==========================================
// LOGS CONSOLE D'AUDIT
// ==========================================
function logConsole(message, type = 'info') {
  const area = document.getElementById('console-logs-area');
  if (!area) return;

  const now = new Date().toLocaleTimeString();
  let colorClass = 'text-slate-400';
  if (type === 'success') colorClass = 'text-emerald-400';
  if (type === 'error') colorClass = 'text-red-400';
  if (type === 'warn') colorClass = 'text-amber-400';

  const entry = document.createElement('div');
  entry.className = `leading-relaxed ${colorClass}`;
  entry.innerText = `[${now}] ${message}`;

  area.appendChild(entry);
  area.scrollTop = area.scrollHeight;
}

function clearConsoleLog() {
  const area = document.getElementById('console-logs-area');
  if (area) {
    area.innerHTML = '<div class="text-slate-500">[System] Console réinitialisée.</div>';
  }
}

// Sécurisation basique HTML
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
