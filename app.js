// app.js

/**
 * Répertoire de liens — Vanilla JS
 * - CRUD (Add/Edit/Delete)
 * - Recherche + filtre catégorie + tri
 * - Persistance localStorage
 * - Import/Export JSON
 * - Thème clair/sombre
 * - Accessibilité: modal accessible, navigation clavier, aria-live via toast
 */

(() => {
  'use strict';

  // ====== Constants ======
  const STORAGE_KEY = 'siteDirectory';
  const THEME_KEY = 'siteDirectoryTheme';

  // Dataset d’exemple (chargé si localStorage vide)
  const SAMPLE_SITES = [
    {
      id: cryptoId(),
      name: 'Microsoft Learn',
      url: 'https://learn.microsoft.com/',
      description: 'Docs & tutoriels Microsoft (M365, Azure, sécurité…).',
      category: 'Documentation',
      tags: ['microsoft', 'docs', 'learning'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 4
    },
    {
      id: cryptoId(),
      name: 'OWASP Top 10',
      url: 'https://owasp.org/www-project-top-ten/',
      description: 'Référentiel des vulnérabilités web les plus courantes.',
      category: 'Sécurité',
      tags: ['owasp', 'web', 'security'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 12
    },
    {
      id: cryptoId(),
      name: 'EIOPA (homepage)',
      url: 'https://www.eiopa.europa.eu/',
      description: 'Autorité européenne des assurances et des pensions professionnelles.',
      category: 'Réglementaire',
      tags: ['eiopa', 'regulation', 'insurance'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2
    },
    {
      id: cryptoId(),
      name: 'GitHub',
      url: 'https://github.com/',
      description: 'Hébergement de code, issues, projets et CI.',
      category: 'Dev',
      tags: ['git', 'code', 'tools'],
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 6
    }
  ];

  // ====== State ======
  let sites = [];
  let currentEditId = null;

  // ====== Elements ======
  const cardsGrid = document.getElementById('cardsGrid');
  const emptyState = document.getElementById('emptyState');
  const resultCount = document.getElementById('resultCount');
  const activeFilters = document.getElementById('activeFilters');

  const addSiteBtn = document.getElementById('addSiteBtn');
  const emptyAddBtn = document.getElementById('emptyAddBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importInput = document.getElementById('importInput');
  const resetBtn = document.getElementById('resetBtn');

  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const sortSelect = document.getElementById('sortSelect');

  const themeToggleBtn = document.getElementById('themeToggleBtn');

  // Modal elements
  const modal = document.getElementById('siteModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  const siteForm = document.getElementById('siteForm');
  const siteIdInput = document.getElementById('siteId');
  const nameInput = document.getElementById('nameInput');
  const urlInput = document.getElementById('urlInput');
  const descInput = document.getElementById('descInput');
  const categoryInput = document.getElementById('categoryInput');
  const tagsInput = document.getElementById('tagsInput');
  const formError = document.getElementById('formError');

  // Toast
  const toastEl = document.getElementById('toast');
  let toastTimer = null;

  // Focus trap (modal)
  let lastFocusedElement = null;

  // ====== Init ======
  initTheme();
  loadSites();
  bindEvents();
  refreshUI();

  // ====== Functions ======

  function bindEvents() {
    addSiteBtn.addEventListener('click', () => openModalForCreate());
    emptyAddBtn.addEventListener('click', () => openModalForCreate());

    exportBtn.addEventListener('click', exportToJsonFile);
    importInput.addEventListener('change', handleImportFile);
    resetBtn.addEventListener('click', handleReset);

    searchInput.addEventListener('input', refreshUI);
    categoryFilter.addEventListener('change', refreshUI);
    sortSelect.addEventListener('change', refreshUI);

    themeToggleBtn.addEventListener('click', toggleTheme);

    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      // ESC ferme la modal
      if (e.key === 'Escape' && isModalOpen()) {
        e.preventDefault();
        closeModal();
      }
      // Trap focus
      if (e.key === 'Tab' && isModalOpen()) {
        trapFocus(e);
      }
    });

    siteForm.addEventListener('submit', handleFormSubmit);
  }

  /** Charge depuis localStorage; si vide => dataset d’exemple */
  function loadSites() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      sites = SAMPLE_SITES.slice();
      saveSites();
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      sites = Array.isArray(parsed) ? parsed.map(normalizeSite).filter(Boolean) : [];
      if (sites.length === 0) {
        sites = SAMPLE_SITES.slice();
        saveSites();
      }
    } catch {
      // En cas de données corrompues, on repart sur un dataset safe
      sites = SAMPLE_SITES.slice();
      saveSites();
    }
  }

  /** Sauvegarde dans localStorage */
  function saveSites() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sites));
  }

  /** Rafraîchit la grille: recherche, filtre, tri, render */
  function refreshUI() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const cat = (categoryFilter.value || '').trim().toLowerCase();
    const sortValue = sortSelect.value;

    // Filtrage
    let filtered = sites.filter((s) => {
      if (cat && (s.category || '').toLowerCase() !== cat) return false;
      if (!query) return true;

      const hay = [
        s.name,
        s.url,
        s.description || '',
        (s.category || ''),
        ...(Array.isArray(s.tags) ? s.tags : [])
      ].join(' ').toLowerCase();

      return hay.includes(query);
    });

    // Tri
    filtered = sortSites(filtered, sortValue);

    // Met à jour dropdown catégories
    populateCategoryFilter(cat);

    // Compteur + libellé filtres
    resultCount.textContent = String(filtered.length);
    activeFilters.textContent = formatActiveFilters(query, cat);

    // Render
    renderCards(filtered);

    // Empty state
    emptyState.hidden = filtered.length !== 0;
  }

  function populateCategoryFilter(currentCatLower) {
    const categories = Array.from(new Set(
      sites
        .map(s => (s.category || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

    // Reconstruit la liste sans innerHTML à partir de données utilisateur
    const keepValue = categoryFilter.value;
    while (categoryFilter.options.length > 1) categoryFilter.remove(1);

    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });

    // Restaure la valeur si possible
    if (keepValue) {
      const exists = Array.from(categoryFilter.options).some(o => (o.value || '').toLowerCase() === keepValue.toLowerCase());
      if (!exists) categoryFilter.value = '';
    }

    // Si un filtre est en cours en minuscule, on tente d’aligner
    if (currentCatLower) {
      const match = Array.from(categoryFilter.options).find(o => (o.value || '').toLowerCase() === currentCatLower);
      if (match) categoryFilter.value = match.value;
    }
  }

  /** Render des cartes en createElement (pas de innerHTML avec données utilisateur) */
  function renderCards(list) {
    // Clear
    while (cardsGrid.firstChild) cardsGrid.removeChild(cardsGrid.firstChild);

    list.forEach((site) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('data-id', site.id);

      // Top row
      const top = document.createElement('div');
      top.className = 'card-top';

      const faviconWrap = document.createElement('div');
      faviconWrap.className = 'favicon';
      faviconWrap.setAttribute('aria-hidden', 'true');

      const favImg = document.createElement('img');
      favImg.alt = '';
      favImg.loading = 'lazy';

      // Favicon: tentative via origin + /favicon.ico
      const favUrl = getFaviconUrl(site.url);
      favImg.src = favUrl;
      favImg.addEventListener('error', () => {
        // fallback: petit svg data-uri (pas de dépendance externe)
        favImg.src = fallbackFaviconDataUri();
      });

      faviconWrap.appendChild(favImg);

      const titleWrap = document.createElement('div');
      titleWrap.className = 'card-title';

      const h3 = document.createElement('h3');
      h3.textContent = site.name;

      const urlP = document.createElement('div');
      urlP.className = 'url';
      urlP.textContent = displayUrl(site.url);

      titleWrap.appendChild(h3);
      titleWrap.appendChild(urlP);

      top.appendChild(faviconWrap);
      top.appendChild(titleWrap);

      // Description
      const desc = document.createElement('p');
      desc.className = 'desc';
      desc.textContent = site.description ? site.description : '—';

      // Badges
      const badges = document.createElement('div');
      badges.className = 'badges';

      // Catégorie
      if (site.category) {
        const catBadge = document.createElement('span');
        catBadge.className = 'badge category';
        catBadge.textContent = site.category;
        badges.appendChild(catBadge);
      }

      // Tags
      (site.tags || []).slice(0, 8).forEach((t) => {
        const tag = document.createElement('span');
        tag.className = 'badge tag';
        tag.textContent = `#${t}`;
        badges.appendChild(tag);
      });

      // Meta + actions
      const meta = document.createElement('div');
      meta.className = 'card-meta';

      const metaText = document.createElement('div');
      metaText.className = 'meta-text';
      metaText.textContent = buildMetaText(site);

      const actions = document.createElement('div');
      actions.className = 'card-actions';

      const openBtn = document.createElement('a');
      openBtn.className = 'btn btn-secondary';
      openBtn.href = site.url;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener noreferrer';
      openBtn.textContent = 'Ouvrir';
      openBtn.setAttribute('aria-label', `Ouvrir ${site.name} dans un nouvel onglet`);

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-ghost';
      editBtn.type = 'button';
      editBtn.textContent = 'Modifier';
      editBtn.addEventListener('click', () => openModalForEdit(site.id));

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.type = 'button';
      delBtn.textContent = 'Supprimer';
      delBtn.addEventListener('click', () => handleDelete(site.id));

      actions.appendChild(openBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      meta.appendChild(metaText);
      meta.appendChild(actions);

      // Assemble card
      card.appendChild(top);
      card.appendChild(desc);
      if (badges.childNodes.length > 0) card.appendChild(badges);
      card.appendChild(meta);

      cardsGrid.appendChild(card);
    });
  }

  /** Ajout */
  function openModalForCreate() {
    currentEditId = null;
    siteIdInput.value = '';
    modalTitle.textContent = 'Ajouter un site';
    clearForm();
    openModal();
  }

  /** Modification */
  function openModalForEdit(id) {
    const site = sites.find(s => s.id === id);
    if (!site) return;

    currentEditId = id;
    siteIdInput.value = id;
    modalTitle.textContent = 'Modifier le site';

    // Pré-remplissage
    nameInput.value = site.name || '';
    urlInput.value = site.url || '';
    descInput.value = site.description || '';
    categoryInput.value = site.category || '';
    tagsInput.value = (site.tags || []).join(', ');

    hideFormError();
    openModal();

    // Place focus sur le premier champ
    nameInput.focus();
  }

  /** Ouverture modal + gestion focus */
  function openModal() {
    lastFocusedElement = document.activeElement;

    modalOverlay.hidden = false;
    modal.hidden = false;

    // Evite le scroll du body
    document.body.style.overflow = 'hidden';

    hideFormError();

    // Focus initial (si non défini)
    setTimeout(() => {
      (nameInput || closeModalBtn).focus();
    }, 0);
  }

  function closeModal() {
    if (!isModalOpen()) return;

    modal.hidden = true;
    modalOverlay.hidden = true;
    document.body.style.overflow = '';

    hideFormError();

    // Restaure focus
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function isModalOpen() {
    return modal && modal.hidden === false;
  }

  /** Validation + Add/Edit + storage */
  function handleFormSubmit(e) {
    e.preventDefault();

    const payload = getFormPayload();
    const err = validatePayload(payload);
    if (err) {
      showFormError(err);
      return;
    }

    const now = Date.now();

    if (currentEditId) {
      const idx = sites.findIndex(s => s.id === currentEditId);
      if (idx === -1) {
        showFormError('Impossible de modifier : élément introuvable.');
        return;
      }

      // Update
      const existing = sites[idx];
      sites[idx] = normalizeSite({
        ...existing,
        ...payload,
        updatedAt: now
      });

      saveSites();
      refreshUI();
      closeModal();
      showToast('Site modifié ✅');
    } else {
      // Create
      const newSite = normalizeSite({
        id: cryptoId(),
        ...payload,
        createdAt: now,
        updatedAt: now
      });

      sites.unshift(newSite);
      saveSites();
      refreshUI();
      closeModal();
      showToast('Site ajouté ✅');
    }
  }

  function getFormPayload() {
    return {
      name: (nameInput.value || '').trim(),
      url: (urlInput.value || '').trim(),
      description: (descInput.value || '').trim(),
      category: (categoryInput.value || '').trim(),
      tags: parseTags(tagsInput.value || '')
    };
  }

  function validatePayload(p) {
    if (!p.name) return 'Le nom est obligatoire.';
    if (!p.url) return 'L’URL est obligatoire.';
    if (!isValidHttpUrl(p.url)) return 'URL invalide : elle doit commencer par http:// ou https:// et être bien formée.';
    return '';
  }

  /** Suppression avec confirmation */
  function handleDelete(id) {
    const site = sites.find(s => s.id === id);
    if (!site) return;

    const ok = window.confirm(`Supprimer "${site.name}" ? Cette action est irréversible.`);
    if (!ok) return;

    sites = sites.filter(s => s.id !== id);
    saveSites();
    refreshUI();
    showToast('Site supprimé 🗑️');
  }

  /** Reset total */
  function handleReset() {
    const ok = window.confirm('Réinitialiser le répertoire ? Cela efface toutes les données locales.');
    if (!ok) return;

    localStorage.removeItem(STORAGE_KEY);
    sites = SAMPLE_SITES.slice();
    saveSites();
    refreshUI();
    showToast('Répertoire réinitialisé ↺');
  }

  /** Export JSON (download) */
  function exportToJsonFile() {
    const data = JSON.stringify(sites, null, 2);
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `siteDirectory_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    showToast('Export JSON prêt ⤓');
  }

  /** Import JSON (upload) + validation basique */
  async function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    importInput.value = ''; // permet de re-sélectionner le même fichier plus tard
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        showToast('Import refusé : le JSON doit être un tableau de sites.', true);
        return;
      }

      const imported = parsed.map(normalizeSite).filter(Boolean);

      if (imported.length === 0) {
        showToast('Import refusé : aucun site valide trouvé.', true);
        return;
      }

      const ok = window.confirm(`Importer ${imported.length} site(s) ? Cela remplacera la liste actuelle.`);
      if (!ok) return;

      sites = imported;
      saveSites();
      refreshUI();
      showToast('Import réussi ✅');
    } catch {
      showToast('Import impossible : JSON invalide.', true);
    }
  }

  // ====== Theme ======
  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = saved || (prefersLight ? 'light' : 'dark');

    applyTheme(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const pressed = theme === 'dark' ? 'false' : 'true';
    themeToggleBtn.setAttribute('aria-pressed', pressed);
    showToast(theme === 'dark' ? 'Thème sombre 🌙' : 'Thème clair ☀️');
  }

  // ====== UI helpers ======
  function clearForm() {
    siteForm.reset();
    nameInput.value = '';
    urlInput.value = '';
    descInput.value = '';
    categoryInput.value = '';
    tagsInput.value = '';
    hideFormError();
  }

  function showFormError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }

  function hideFormError() {
    formError.textContent = '';
    formError.hidden = true;
  }

  function showToast(message, isError = false) {
    if (!toastEl) return;

    toastEl.hidden = false;
    toastEl.textContent = message;

    // Petit feedback visuel via bordure
    toastEl.style.borderColor = isError ? 'rgba(255,91,110,0.55)' : 'rgba(91,140,255,0.45)';

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
      toastEl.textContent = '';
    }, 2600);
  }

  function formatActiveFilters(query, catLower) {
    const parts = [];
    if (query) parts.push(`Recherche : "${query}"`);
    if (catLower) parts.push(`Catégorie : "${categoryFilter.value}"`);
    return parts.length ? `— ${parts.join(' • ')}` : '';
  }

  // ====== Sorting ======
  function sortSites(list, sortValue) {
    const copy = list.slice();
    const [field, dir] = (sortValue || 'updatedAt_desc').split('_');

    copy.sort((a, b) => {
      let va, vb;

      if (field === 'name') {
        va = (a.name || '').toLowerCase();
        vb = (b.name || '').toLowerCase();
        return va.localeCompare(vb, 'fr', { sensitivity: 'base' });
      }

      if (field === 'category') {
        va = (a.category || '').toLowerCase();
        vb = (b.category || '').toLowerCase();
        return va.localeCompare(vb, 'fr', { sensitivity: 'base' });
      }

      // createdAt / updatedAt
      va = Number(a[field] || 0);
      vb = Number(b[field] || 0);
      return va - vb;
    });

    if (dir === 'desc') copy.reverse();
    return copy;
  }

  // ====== Data normalization / validation ======

  /** Normalise un objet site (utilisé après lecture LS/import) */
  function normalizeSite(obj) {
    if (!obj || typeof obj !== 'object') return null;

    const name = safeTrim(obj.name);
    const url = safeTrim(obj.url);

    if (!name || !url || !isValidHttpUrl(url)) return null;

    const createdAt = Number(obj.createdAt || Date.now());
    const updatedAt = Number(obj.updatedAt || createdAt);

    return {
      id: safeTrim(obj.id) || cryptoId(),
      name,
      url,
      description: safeTrim(obj.description),
      category: safeTrim(obj.category),
      tags: Array.isArray(obj.tags) ? obj.tags.map(t => safeTrim(t)).filter(Boolean) : parseTags(obj.tags || ''),
      createdAt,
      updatedAt
    };
  }

  function safeTrim(v) {
    return (typeof v === 'string') ? v.trim() : '';
  }

  function parseTags(raw) {
    if (Array.isArray(raw)) {
      return raw.map(t => safeTrim(String(t))).filter(Boolean);
    }
    return String(raw || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.replace(/^#/, '')) // autorise l’utilisateur à saisir "#tag"
      .slice(0, 24);
  }

  function isValidHttpUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // ====== Misc helpers ======

  /** Génère un id */
  function cryptoId() {
    // crypto.randomUUID() supporté dans les navigateurs modernes; fallback sinon
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id_' + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  /** Déduit une favicon à partir de l’URL (origin + /favicon.ico) */
  function getFaviconUrl(siteUrl) {
    try {
      const u = new URL(siteUrl);
      return `${u.origin}/favicon.ico`;
    } catch {
      return fallbackFaviconDataUri();
    }
  }

  /** Fallback favicon inline (SVG data-uri) */
  function fallbackFaviconDataUri() {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#5b8cff"/>
            <stop offset="1" stop-color="#ff5b6e"/>
          </linearGradient>
        </defs>
        <rect rx="16" ry="16" x="6" y="6" width="52" height="52" fill="url(#g)"/>
        <path d="M26 40c6 0 10-4 10-10s-4-10-10-10h-2v4h2c3.3 0 6 2.7 6 6s-2.7 6-6 6h-2v4h2zm12 0h-2v-4h2c3.3 0 6-2.7 6-6s-2.7-6-6-6h-2v-4h2c6 0 10 4 10 10s-4 10-10 10z" fill="white" opacity="0.95"/>
      </svg>
    `.trim();
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function displayUrl(siteUrl) {
    try {
      const u = new URL(siteUrl);
      return u.host + (u.pathname === '/' ? '' : u.pathname);
    } catch {
      return siteUrl;
    }
  }

  function buildMetaText(site) {
    const created = formatDate(site.createdAt);
    const updated = formatDate(site.updatedAt);
    if (created === updated) return `Ajouté le ${created}`;
    return `Ajouté le ${created} • Modifié le ${updated}`;
  }

  function formatDate(ts) {
    const d = new Date(Number(ts) || Date.now());
    return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' });
  }

  // ====== Focus Trap (accessibilité modal) ======
  function trapFocus(e) {
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
})();