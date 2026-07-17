// HRT Dashboard - Main Application JavaScript

// Configuration - In production, these should be loaded from environment variables
const config = {
    PAYOUT_CAP: 200000,
    MAX_FILE_SIZE: 20971520,
    VALID_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    SESSION_KEY: 'hrt_session_key',
    // These would be loaded from .env in a proper setup
    DISCORD_WEBHOOK: "https://discord.com/api/webhooks/1523039203116711976/yrGIZBL_EvTIYhuWOXGZdRReVKjb10IFrcckMkOG4EVPSY3mZbwIwQB9XOUWocdJ0xgC",
    FIREBASE_CONFIG: {
        apiKey: "AIzaSyDUxM0DHEhQjtBsKOJWQNDmZrPEr-fqGLw",
        authDomain: "hrtbonusauszahlungen.firebaseapp.com",
        databaseURL: "https://hrtbonusauszahlungen-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "hrtbonusauszahlungen",
        storageBucket: "hrtbonusauszahlungen.firebasestorage.app",
        messagingSenderId: "77806251754",
        appId: "1:77806251754:web:56be35a7915de1ba69f193",
        measurementId: "G-NJ5DTV2QK5"
    }
};

// Global state
let currentRole = "user", 
    currentUserKey = "", 
    currentUserData = {}, 
    entriesData = {}, 
    keysData = {};

let sortState = { col: 'date', dir: 'desc' };

// DOM Elements
const DOM = {
    userFilter: document.getElementById('userFilter'),
    statusFilter: document.getElementById('statusFilter'),
    entrySearch: document.getElementById('entrySearch'),
    activitySelect: document.getElementById('activitySelect'),
    fileInput: document.getElementById('fileInput'),
    filePreviewContainer: document.getElementById('filePreviewContainer'),
    filePreviewImage: document.getElementById('filePreviewImage'),
    fileNameLabel: document.getElementById('fileNameLabel')
};

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(e) {
    const t = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'}; 
    return String(e).replace(/[&<>"']/g, m => t[m]);
}

// Generate acronym for activity search (e.g., "Fort Zancudo" -> "fz")
function getAcronym(text) {
    return text.toLowerCase()
        .replace(/[^a-zA-Z0-9\säöüß]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map(word => word[0])
        .join('');
}

function showToast(m, t = 'success') {
    const e = document.getElementById('toast');
    e.textContent = m; 
    e.className = `show ${t}`;
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(() => { e.className = ''; }, 3000);
}

function generateSecureRandomString(n) {
    const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const r = new Uint8Array(n);
    window.crypto.getRandomValues(r);
    let s = '';
    for (let i = 0; i < n; i++) s += c[r[i] % c.length];
    return s;
}

function derivePrefix(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AA';
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    const w = parts[0];
    return w.length >= 2 ? w.substring(0, 2).toUpperCase() : (w[0] + w[0]).toUpperCase();
}

function fileToBase64(f) {
    return new Promise((r, j) => {
        const e = new FileReader();
        e.onload = () => r(e.result);
        e.onerror = j;
        e.readAsDataURL(f);
    });
}

function isValidImageFile(f) {
    return config.VALID_IMAGE_TYPES.includes(f.type);
}

function parseAmount(a) {
    if (!a) return 0;
    const m = a.match(/([\d.]+)\$/);
    return m ? parseInt(m[1].replace(/\./g, ''), 10) : 0;
}

function parseGermanDate(d) {
    if (!d) return 0;
    const m = String(d).match(/(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return 0;
    const [, day, month, year, h, min, s] = m;
    return new Date(+year, +month - 1, +day, +h, +min, +(s || 0)).getTime();
}

async function copyToClipboard(text) {
    if (!text) return Promise.resolve(false);
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text) {
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch (e) {
        return false;
    }
}

function setBtnLoading(btn, loading, loadingLabel, normalLabel) {
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
        ? `<span class="btn-loader"></span> ${escapeHtml(loadingLabel)}`
        : escapeHtml(normalLabel);
}

// ==================== MODAL FUNCTIONS ====================

function openFormModal(title, content, footer) {
    document.getElementById('formModalTitle').textContent = title;
    document.getElementById('formModalBody').innerHTML = content;
    document.getElementById('formModalFooter').innerHTML = footer;
    document.getElementById('formModal').classList.add('active');
    document.getElementById('formModalOverlay').classList.add('active');
}

function closeFormModal() {
    document.getElementById('formModal').classList.remove('active');
    document.getElementById('formModalOverlay').classList.remove('active');
}

window.closeFormModal = closeFormModal;

document.getElementById('formModalClose').addEventListener('click', closeFormModal);
document.getElementById('formModalOverlay').addEventListener('click', closeFormModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('formModal').classList.contains('active')) 
        closeFormModal();
});

// ==================== CUSTOM SELECT ====================

function initCustomSelect(s) {
    const existingWrapper = s.nextElementSibling;
    if (existingWrapper && existingWrapper.classList.contains('custom-select-wrapper')) 
        existingWrapper.remove();

    const w = document.createElement('div');
    w.className = 'custom-select-wrapper';
    const t = document.createElement('div');
    t.className = 'custom-select-trigger';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'trigger-label';
    labelSpan.textContent = s.options[s.selectedIndex]?.text || '–';
    t.appendChild(labelSpan);
    if (s.disabled) t.classList.add('disabled');
    const o = document.createElement('div');
    o.className = 'custom-options';

    function b() {
        o.innerHTML = '';
        Array.from(s.options).forEach((opt, i) => {
            const d = document.createElement('div');
            d.className = 'custom-option' + (i === s.selectedIndex ? ' selected' : '');
            d.textContent = opt.text;
            d.addEventListener('click', () => {
                s.selectedIndex = i;
                labelSpan.textContent = opt.text;
                o.querySelectorAll('.custom-option').forEach(x => x.classList.remove('selected'));
                d.classList.add('selected');
                w.classList.remove('open');
                t.classList.remove('open');
                s.dispatchEvent(new Event('change'));
            });
            o.appendChild(d);
        });
    }

    b();
    t.addEventListener('click', (e) => {
        if (s.disabled) return;
        e.stopPropagation();
        document.querySelectorAll('.custom-select-wrapper.open').forEach(x => {
            if (x !== w) {
                x.classList.remove('open');
                x.querySelector('.custom-select-trigger')?.classList.remove('open');
            }
        });
        w.classList.toggle('open');
        t.classList.toggle('open');
    });

    w.appendChild(t);
    w.appendChild(o);
    s.parentNode.insertBefore(w, s.nextSibling);
    s._customSelectRefresh = b;
    s._customSelectLabel = labelSpan;
}

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-wrapper.open').forEach(w => {
        w.classList.remove('open');
        w.querySelector('.custom-select-trigger')?.classList.remove('open');
    });
});

// ==================== IMAGE MODAL ====================

const modal = document.getElementById('imageModal'), 
      modalImg = document.getElementById('modalImg');

function openModal(s) {
    modalImg.src = s;
    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
    setTimeout(() => {
        if (!modal.classList.contains('active')) modalImg.src = '';
    }, 350);
}

document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

function attachImageClicks(container) {
    (container || document).querySelectorAll('.entry-thumb').forEach(img => {
        if (img._clickBound) return;
        img._clickBound = true;
        img.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(img.dataset.full || img.src);
        });
    });
}

// ==================== PANEL TOGGLES ====================

document.querySelectorAll('[data-toggle-parent]').forEach(h => {
    h.addEventListener('click', () => {
        h.closest('.panel').classList.toggle('open');
    });
});

// ==================== TAB SYSTEM ====================

function showTab(t) {
    document.getElementById('tabAdmin').classList.toggle('active', t === 'admin');
    document.getElementById('tabExport').classList.toggle('active', t === 'export');
    document.getElementById('tabBonus').classList.toggle('active', t === 'bonus');
    document.getElementById('tabBtnAdmin').classList.toggle('active', t === 'admin');
    document.getElementById('tabBtnExport').classList.toggle('active', t === 'export');
    document.getElementById('tabBtnBonus').classList.toggle('active', t === 'bonus');
}

document.getElementById('tabBtnAdmin').addEventListener('click', () => showTab('admin'));
document.getElementById('tabBtnExport').addEventListener('click', () => showTab('export'));
document.getElementById('tabBtnBonus').addEventListener('click', () => showTab('bonus'));

// ==================== FIREBASE INITIALIZATION ====================

async function initFirebase() {
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js');
        const { getDatabase, ref, get, set, push, remove, update, onValue } = await import('https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js');

        const app = initializeApp(config.FIREBASE_CONFIG);
        const db = getDatabase(app);

        window.db = db;
        window.firebaseRef = ref;
        window.firebaseGet = get;
        window.firebaseSet = set;
        window.firebasePush = push;
        window.firebaseRemove = remove;
        window.firebaseUpdate = update;
        window.firebaseOnValue = onValue;

        console.log('Firebase initialized successfully');
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showToast('Fehler bei der Firebase-Initialisierung', 'error');
        return false;
    }
}

// ==================== AUTHENTICATION ====================

async function authenticate(k, silent = false) {
    if (!k || !window.db) return;
    const loginBtn = document.getElementById('loginBtn');
    if (!silent) setBtnLoading(loginBtn, true, 'Anmelden…', 'Anmelden');
    
    try {
        const snap = await window.firebaseGet(window.firebaseRef(window.db, `keys/${k}`));
        if (snap.exists()) {
            const v = snap.val();
            currentUserData = typeof v === 'object' ? v : { role: v, name: k, id: '' };
            currentRole = currentUserData.role || 'user';
            currentUserKey = k;
            
            // Fix: Match by ID if name doesn't match existing keys
            if (currentUserData.id) {
                const matchingKey = Object.entries(keysData || {}).find(([key, data]) => 
                    data.id === currentUserData.id && data.name !== currentUserData.name
                );
                if (matchingKey) {
                    currentUserData.name = matchingKey[1].name || currentUserData.name;
                }
            }
            
            localStorage.setItem(config.SESSION_KEY, k);
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('mainSection').classList.remove('hidden');
            document.getElementById('userRole').textContent = currentRole;
            document.getElementById('userNameLabel').textContent = currentUserData.name || k;

            if (['admin', 'owner'].includes(currentRole)) {
                document.getElementById('tabBtnAdmin').classList.remove('hidden');
                document.getElementById('tabBtnExport').classList.remove('hidden');
                showTab('admin');
            } else {
                document.getElementById('tabBar').classList.add('hidden');
                showTab('bonus');
            }

            initDataStream();
        } else {
            if (!silent) showToast('Ungültiger Key', 'error');
            localStorage.removeItem(config.SESSION_KEY);
        }
    } catch (e) {
        if (!silent) showToast('Authentifizierungsfehler', 'error');
        localStorage.removeItem(config.SESSION_KEY);
    } finally {
        if (!silent) setBtnLoading(loginBtn, false, '', 'Anmelden');
    }
}

async function initApp() {
    // Initialize Firebase first
    const firebaseReady = await initFirebase();
    if (!firebaseReady) {
        console.error('Firebase not ready, retrying...');
        setTimeout(initApp, 2000);
        return;
    }
    
    const k = localStorage.getItem(config.SESSION_KEY);
    if (k) {
        await authenticate(k, true);
    }
    
    // Initialize custom selects
    document.querySelectorAll('select:not(#activitySelect)').forEach(initCustomSelect);
}

// ==================== EVENT LISTENERS ====================

document.getElementById('loginBtn').addEventListener('click', () => {
    authenticate(document.getElementById('keyInput').value.trim());
});

document.getElementById('keyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') authenticate(document.getElementById('keyInput').value.trim());
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(config.SESSION_KEY);
    location.reload();
});

document.getElementById('linkToRegister').addEventListener('click', () => {
    document.getElementById('authPanelLogin').classList.add('hidden');
    document.getElementById('authPanelRegister').classList.remove('hidden');
});

document.getElementById('linkToLogin').addEventListener('click', () => {
    document.getElementById('authPanelRegister').classList.add('hidden');
    document.getElementById('authPanelLogin').classList.remove('hidden');
});

const registerBtn = document.getElementById('registerBtn');
registerBtn.addEventListener('click', async () => {
    const n = document.getElementById('regName').value.trim();
    const dc = document.getElementById('regDiscord').value.trim();
    const i = document.getElementById('regId').value.trim();
    const dept = document.getElementById('regDept').value.trim();

    if (!n) return showToast('Bitte deinen Ingame-Namen eingeben', 'error');
    if (!dc) return showToast('Bitte deinen Discord-Namen eingeben', 'error');
    if (!i) return showToast('Bitte eine Spieler-ID eingeben', 'error');
    if (!dept) return showToast('Bitte deine Abteilung eingeben', 'error');

    setBtnLoading(registerBtn, true, 'Wird gesendet…', 'Antrag absenden');

    try {
        const messageText = `${dc} | ${n} | ${i} | ${dept}`;
        await fetch(config.DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: messageText })
        });
        showToast('Antrag wurde gesendet!');
        document.getElementById('regName').value = '';
        document.getElementById('regDiscord').value = '';
        document.getElementById('regId').value = '';
        document.getElementById('regDept').value = '';
        document.getElementById('authPanelRegister').classList.add('hidden');
        document.getElementById('authPanelLogin').classList.remove('hidden');
    } catch (e) {
        showToast('Fehler beim Senden', 'error');
    } finally {
        setBtnLoading(registerBtn, false, '', 'Antrag absenden');
    }
});

// ==================== DATA STREAM ====================

function initDataStream() {
    if (!window.db) return;
    
    window.firebaseOnValue(window.firebaseRef(window.db, 'uploads'), (snap) => {
        entriesData = snap.val() || {};
        renderAll();
    });
    
    window.firebaseOnValue(window.firebaseRef(window.db, 'keys'), (snap) => {
        keysData = snap.val() || {};
        // Fix: Update current user data if keys change
        if (currentUserKey && keysData[currentUserKey]) {
            currentUserData = keysData[currentUserKey];
            document.getElementById('userNameLabel').textContent = currentUserData.name || currentUserKey;
        }
    });
}

function renderAll() {
    updateFilterDropdown();
    renderEntries();
    renderMyEntries();
    renderSummary();
    updateCapUI();
}

function updateFilterDropdown() {
    const c = DOM.userFilter.value;
    const u = [...new Set(Object.values(entriesData).map(i => i.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
    const newHtml = '<option value="all">-- Alle anzeigen --</option>' + 
        u.map(x => `<option value="${escapeHtml(x)}"${x === c ? ' selected' : ''}>${escapeHtml(x)}</option>`).join('');
    if (DOM.userFilter.innerHTML !== newHtml) {
        DOM.userFilter.innerHTML = newHtml;
        initCustomSelect(DOM.userFilter);
    }
}

function statusLabel(status) {
    const st = { 
        offen: ['open', 'Offen'], 
        gesehen: ['seen', 'Gesehen'], 
        geschlossen: ['closed', 'Ausgezahlt'] 
    };
    return st[status] || st.offen;
}

function buildCard(i, isAdmin) {
    const [cl, lb] = statusLabel(i.status);
    const isClosed = i.status === 'geschlossen';
    
    // Fix: Match entries by ID if name doesn't match
    let displayName = i.name || '–';
    if (i.playerId) {
        const matchingKey = Object.values(keysData).find(k => k.id === i.playerId);
        if (matchingKey && matchingKey.name) {
            displayName = matchingKey.name;
        }
    }
    
    const ac = isAdmin ? `<div class="admin-actions">
        <button class="btn-seen" data-action="seen" data-id="${escapeHtml(i.id)}" ${i.status === 'gesehen' || isClosed ? 'disabled' : ''}>Gesehen</button>
        <button class="btn-close" data-action="close" data-id="${escapeHtml(i.id)}" ${isClosed ? 'disabled' : ''}>Bezahlt</button>
        <button class="btn-delete" data-action="delete" data-id="${escapeHtml(i.id)}">Löschen</button>
    </div>` : '';
    
    const img = i.image
        ? `<img class="entry-thumb" loading="lazy" src="${escapeHtml(i.image)}" data-full="${escapeHtml(i.image)}" alt="Nachweis">`
        : '<div style="width:80px;height:80px;border-radius:10px;background:rgba(52,152,219,0.05);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;flex-shrink:0;">Kein Bild</div>';
    
    return `<div class="entry-card">
        <span class="badge ${cl}">${lb}</span>
        <div class="entry-content">
            <div class="entry-info">
                <p><strong>Name:</strong> ${escapeHtml(displayName)}</p>
                <p><strong>Aktivität:</strong> ${escapeHtml(i.activity || '–')}</p>
                <p><strong>Datum:</strong> ${escapeHtml(i.date || '–')}</p>
                ${ac}
            </div>
            ${img}
        </div>
    </div>`;
}

function getFilteredEntries() {
    const userF = DOM.userFilter.value || 'all';
    const statusF = DOM.statusFilter.value || 'all';
    const q = (DOM.entrySearch.value || '').trim().toLowerCase();

    let it = Object.entries(entriesData).map(([id, d]) => ({ id, ...d }));
    
    // Fix: Match by ID if name doesn't match
    it = it.map(entry => {
        if (entry.playerId) {
            const matchingKey = Object.values(keysData).find(k => k.id === entry.playerId);
            if (matchingKey && matchingKey.name) {
                return { ...entry, name: matchingKey.name };
            }
        }
        return entry;
    });
    
    if (userF !== 'all') it = it.filter(x => x.name === userF);
    if (statusF !== 'all') it = it.filter(x => (x.status || 'offen') === statusF);
    if (q) it = it.filter(x => (x.name || '').toLowerCase().includes(q) || (x.activity || '').toLowerCase().includes(q));
    return it;
}

function renderEntries() {
    let it = getFilteredEntries();
    it.sort((a, b) => parseGermanDate(b.date) - parseGermanDate(a.date));
    document.getElementById('entriesCountPill').textContent = it.length;
    const listEl = document.getElementById('entriesList');
    listEl.innerHTML = it.length ? it.map(x => buildCard(x, true)).join('') : '<p class="empty-state">Keine Einträge gefunden.</p>';
    attachImageClicks(listEl);
}

function renderMyEntries() {
    const n = currentUserData.name || '';
    const userId = currentUserData.id || '';
    
    let it = Object.entries(entriesData).map(([id, d]) => ({ id, ...d }))
        .filter(x => x.name === n || x.playerId === userId);
    
    // Fix: Match by ID if name doesn't match
    it = it.map(entry => {
        if (entry.playerId && !entry.name) {
            const matchingKey = Object.values(keysData).find(k => k.id === entry.playerId);
            if (matchingKey && matchingKey.name) {
                return { ...entry, name: matchingKey.name };
            }
        }
        return entry;
    });
    
    it.sort((a, b) => parseGermanDate(b.date) - parseGermanDate(a.date));
    document.getElementById('myEntriesCountPill').textContent = it.length;
    const listEl = document.getElementById('myEntriesList');
    listEl.innerHTML = n ? (it.length ? it.map(x => buildCard(x, false)).join('') : '<p class="empty-state">Noch keine Einreichungen vorhanden.</p>') : '<p class="empty-state">Kein Name gefunden.</p>';
    attachImageClicks(listEl);
}

function getSortedSummaryRows() {
    let rows = Object.entries(entriesData).map(([id, d]) => ({
        id,
        name: d.name || '–',
        dateRaw: d.date || '',
        dateSort: parseGermanDate(d.date),
        activityLabel: (d.activity || '').split('(')[0].trim() || '–',
        amount: parseAmount(d.activity),
        status: d.status || 'offen'
    }));

    // Fix: Match by ID if name doesn't match
    rows = rows.map(row => {
        if (row.name === '–' && row.id) {
            const entry = entriesData[row.id];
            if (entry && entry.playerId) {
                const matchingKey = Object.values(keysData).find(k => k.id === entry.playerId);
                if (matchingKey && matchingKey.name) {
                    return { ...row, name: matchingKey.name };
                }
            }
        }
        return row;
    });

    const { col, dir } = sortState;
    const mult = dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
        let av, bv;
        switch (col) {
            case 'name': av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
            case 'activity': av = a.activityLabel.toLowerCase(); bv = b.activityLabel.toLowerCase(); break;
            case 'amount': av = a.amount; bv = b.amount; break;
            case 'status': av = a.status; bv = b.status; break;
            case 'date':
            default: av = a.dateSort; bv = b.dateSort; break;
        }
        if (av < bv) return -1 * mult;
        if (av > bv) return 1 * mult;
        return 0;
    });
    return rows;
}

function renderSummary() {
    const rows = getSortedSummaryRows();
    const rs = rows.map(r => `<tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.dateRaw.split(',')[0] || '–')}</td>
        <td>${escapeHtml(r.activityLabel)}</td>
        <td>$${r.amount.toLocaleString('de-DE')}</td>
        <td>${escapeHtml(statusLabel(r.status)[1])}</td>
    </tr>`).join('');
    document.getElementById('adminSummaryBody').innerHTML = rs || '<tr><td colspan="5" style="color:var(--muted)">Keine Daten</td></tr>';
    updateSortArrows();
}

function updateSortArrows() {
    document.querySelectorAll('.sort-arrow').forEach(el => el.textContent = '');
    const arrowEl = document.getElementById(`sortArrow-${sortState.col}`);
    if (arrowEl) arrowEl.textContent = sortState.dir === 'asc' ? '▲' : '▼';
}

document.querySelectorAll('.summary-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortState.col === col) {
            sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.col = col;
            sortState.dir = col === 'date' ? 'desc' : 'asc';
        }
        renderSummary();
    });
});

DOM.userFilter.addEventListener('change', renderEntries);
DOM.statusFilter.addEventListener('change', renderEntries);
initCustomSelect(DOM.statusFilter);

let searchDebounce;
DOM.entrySearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderEntries, 150);
});

// ==================== CAP UI ====================

function updateCapUI() {
    const n = currentUserData.name || '';
    const userId = currentUserData.id || '';
    
    // Get entries by name or playerId
    const userEntries = Object.values(entriesData).filter(i => 
        i.name === n || i.playerId === userId
    );
    
    const t = userEntries.filter(i => i.status !== 'geschlossen').reduce((s, i) => s + parseAmount(i.activity), 0);
    const p = Math.min((t / config.PAYOUT_CAP) * 100, 100);
    
    document.getElementById('capLabel').textContent = `$${t.toLocaleString('de-DE')} / $${config.PAYOUT_CAP.toLocaleString('de-DE')}`;
    document.getElementById('capBarFill').style.width = `${p}%`;
    document.getElementById('capBarFill').classList.toggle('full', t >= config.PAYOUT_CAP);
    const isCapped = t >= config.PAYOUT_CAP;
    document.getElementById('capWarning').classList.toggle('hidden', !isCapped);

    const uploadArea = document.getElementById('uploadFormArea');
    if (isCapped) {
        if (!uploadArea.dataset.cappedRendered) {
            uploadArea.innerHTML = '<div class="cap-reached-notice"><strong>Cap erreicht</strong>Du hast dein Bonus-Limit von $200.000 erreicht. Warte, bis offene Einreichungen ausgezahlt wurden.</div>';
            uploadArea.dataset.cappedRendered = '1';
        }
    } else if (uploadArea.dataset.cappedRendered) {
        location.reload();
    }
}

// ==================== ADMIN ACTIONS ====================

document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (!action || !id) return;

    const originalHtml = btn.innerHTML;
    try {
        if (action === 'delete') {
            if (confirm('Eintrag wirklich löschen?')) {
                btn.disabled = true;
                await window.firebaseRemove(window.firebaseRef(window.db, `uploads/${id}`));
                showToast('Eintrag gelöscht');
            }
        } else if (action === 'seen') {
            btn.disabled = true;
            await window.firebaseUpdate(window.firebaseRef(window.db, `uploads/${id}`), { status: 'gesehen' });
            showToast('Als gesehen markiert');
        } else if (action === 'close') {
            btn.disabled = true;
            await window.firebaseUpdate(window.firebaseRef(window.db, `uploads/${id}`), { status: 'geschlossen' });
            showToast('Als ausgezahlt markiert', 'success');
        }
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        showToast('Fehler: ' + err.message, 'error');
    }
});

// ==================== FILE UPLOAD ====================

const fileUploadTrigger = document.getElementById('fileUploadTrigger');

document.getElementById('fileUploadWrapper').addEventListener('click', (e) => {
    if (e.target.closest('#filePreviewContainer')) return;
    DOM.fileInput.click();
});

['dragenter', 'dragover'].forEach(evt => {
    fileUploadTrigger.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileUploadTrigger.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach(evt => {
    fileUploadTrigger.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileUploadTrigger.classList.remove('dragover');
    });
});

fileUploadTrigger.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
        DOM.fileInput.files = e.dataTransfer.files;
        handleSelectedFile(f);
    }
});

DOM.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleSelectedFile(file);
});

function handleSelectedFile(file) {
    if (!isValidImageFile(file)) {
        showToast('Nur Bilddateien sind erlaubt', 'error');
        resetFileInput();
        return;
    }

    if (file.size > config.MAX_FILE_SIZE) {
        showToast('Bild zu groß (max. 20 MB)', 'error');
        resetFileInput();
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        DOM.filePreviewImage.src = e.target.result;
        DOM.fileNameLabel.textContent = file.name;
        DOM.filePreviewContainer.classList.remove('hidden');
        document.querySelector('.file-upload-trigger').classList.add('hidden');
        setTimeout(openActivityModal, 300);
    };
    reader.onerror = () => showToast('Bild konnte nicht gelesen werden', 'error');
    reader.readAsDataURL(file);
}

document.getElementById('removeFileBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    resetFileInput();
});

function resetFileInput() {
    DOM.fileInput.value = '';
    DOM.filePreviewContainer.classList.add('hidden');
    const trigger = document.querySelector('.file-upload-trigger');
    if (trigger) trigger.classList.remove('hidden');
}

function splitActivityLabel(text) {
    const m = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    return m ? { name: m[1], price: m[2] } : { name: text, price: '' };
}

// ==================== ACTIVITY MODAL ====================

// Cache for activity cards data
let activityCardsCache = null;

function getActivityCardsData() {
    if (activityCardsCache) return activityCardsCache;
    activityCardsCache = Array.from(DOM.activitySelect.options).map(opt => {
        const { name, price } = splitActivityLabel(opt.value);
        return {
            value: opt.value,
            name,
            price,
            search: name.toLowerCase(),
            acronym: getAcronym(name)
        };
    });
    return activityCardsCache;
}

function openActivityModal() {
    const cardsData = getActivityCardsData();

    const cardsHtml = cardsData.map(c => `<div class="activity-card" data-value="${escapeHtml(c.value)}" data-search="${escapeHtml(c.search)}" data-acronym="${escapeHtml(c.acronym)}" tabindex="0" role="button">
        <span class="activity-card-main">
            <span class="activity-card-check"></span>
            <span class="activity-card-name">${escapeHtml(c.name)}</span>
        </span>
        <span class="activity-card-price">${escapeHtml(c.price)}</span>
    </div>`).join('');

    const content = `
        <div class="activity-search-wrapper">
            <input type="search" id="activitySearchInput" placeholder="Suchen (z.B. FZ, AOT, Ter)..." autocomplete="off">
            <span class="activity-search-clear hidden" id="activitySearchClear" title="Suche leeren">&times;</span>
        </div>
        <p class="activity-count-hint" id="activityCountHint"></p>
        <div class="activity-grid" id="activityGrid">
            ${cardsHtml}
        </div>
        <p id="activityNoResults" class="empty-state hidden">Keine Treffer gefunden.</p>
    `;

    const footer = `
        <button id="modalSubmitBtn" disabled>Nachweis einreichen</button>
        <button class="btn-outline" id="modalCancelSubmitBtn">Abbrechen</button>
    `;

    openFormModal('Aktivität wählen', content, footer);

    let selectedValue = '';
    const grid = document.getElementById('activityGrid');
    const submitBtn = document.getElementById('modalSubmitBtn');
    const searchInput = document.getElementById('activitySearchInput');
    const clearBtn = document.getElementById('activitySearchClear');
    const noResultsEl = document.getElementById('activityNoResults');
    const countHintEl = document.getElementById('activityCountHint');
    const cardEls = Array.from(grid.querySelectorAll('.activity-card'));
    const total = cardEls.length;

    function updateCountHint(visible) {
        countHintEl.textContent = visible === total ? `${total} Aktivitäten` : `${visible} von ${total} Aktivitäten`;
    }
    updateCountHint(total);

    grid.querySelectorAll('.activity-card').forEach(card => {
        const select = () => {
            grid.querySelectorAll('.activity-card.selected').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedValue = card.dataset.value;
            submitBtn.disabled = false;
        };
        card.addEventListener('click', select);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select();
            }
        });
    });

    // Efficient filtering: only toggle visibility, no DOM rebuild
    let filterRaf = null;
    function filterActivities() {
        const q = searchInput.value.toLowerCase().trim();
        clearBtn.classList.toggle('hidden', q === '');
        let visible = 0;
        for (let i = 0; i < cardEls.length; i++) {
            const card = cardEls[i];
            const match = q === '' || card.dataset.search.includes(q) || card.dataset.acronym.includes(q);
            if (match) visible++;
            if (card.classList.contains('hidden') !== !match) {
                card.classList.toggle('hidden', !match);
            }
        }
        noResultsEl.classList.toggle('hidden', visible !== 0);
        updateCountHint(visible);
    }

    searchInput.addEventListener('input', () => {
        if (filterRaf) cancelAnimationFrame(filterRaf);
        filterRaf = requestAnimationFrame(filterActivities);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        filterActivities();
        searchInput.focus();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (searchInput.value) {
                searchInput.value = '';
                filterActivities();
            } else {
                searchInput.blur();
            }
        } else if (e.key === 'Enter') {
            const firstVisible = cardEls.find(c => !c.classList.contains('hidden'));
            if (firstVisible) firstVisible.click();
        }
    });

    setTimeout(() => searchInput.focus(), 300);

    document.getElementById('modalCancelSubmitBtn').addEventListener('click', () => {
        closeFormModal();
        resetFileInput();
    });

    submitBtn.addEventListener('click', async (ev) => {
        if (selectedValue) await submitEntry(selectedValue, ev.currentTarget);
    });
}

// ==================== SUBMIT ENTRY ====================

async function submitEntry(activity, submitBtn) {
    const n = currentUserData.name || '';
    const userId = currentUserData.id || '';
    const f = DOM.fileInput.files[0];

    if (!n) return showToast('Kein Name gefunden', 'error');
    if (!f) return showToast('Bitte ein Bild auswählen', 'error');

    // Calculate current cap based on name or playerId
    const userEntries = Object.values(entriesData).filter(i => 
        i.name === n || i.playerId === userId
    );
    const curCap = userEntries.filter(i => i.status !== 'geschlossen').reduce((s, i) => s + parseAmount(i.activity), 0);
    
    if (curCap >= config.PAYOUT_CAP) return showToast('Cap erreicht - keine weiteren Einsendungen möglich!', 'error');

    let finalActivity = activity;
    const entryAmount = parseAmount(activity);
    if (curCap + entryAmount > config.PAYOUT_CAP) {
        const allowedAmount = config.PAYOUT_CAP - curCap;
        const { name } = splitActivityLabel(activity);
        finalActivity = `${name} (${allowedAmount.toLocaleString('de-DE')}$)`;
        showToast(`Einsendung wurde auf das Restlimit von $${allowedAmount.toLocaleString('de-DE')} gekürzt.`, 'info');
    }

    if (submitBtn) setBtnLoading(submitBtn, true, 'Wird gesendet…', 'Nachweis einreichen');
    document.getElementById('loadingArea').classList.remove('hidden');

    try {
        const b = await fileToBase64(f);
        const newEntryRef = window.firebasePush(window.firebaseRef(window.db, 'uploads'));
        await window.firebaseSet(newEntryRef, {
            name: n,
            activity: finalActivity,
            image: b,
            date: new Date().toLocaleString('de-DE'),
            status: 'offen',
            playerId: userId
        });
        closeFormModal();
        resetFileInput();
        showToast('Nachweis erfolgreich eingereicht!', 'success');
    } catch (e) {
        showToast('Upload fehlgeschlagen: ' + e.message, 'error');
    } finally {
        document.getElementById('loadingArea').classList.add('hidden');
        if (submitBtn) setBtnLoading(submitBtn, false, '', 'Nachweis einreichen');
    }
}

// ==================== KEY GENERATOR ====================

document.getElementById('openKeyGeneratorBtn').addEventListener('click', () => {
    const content = `
        <div class="form-group">
            <label>Antrag aus Discord einfügen (Autofill)</label>
            <input type="text" id="modalAutofillInput" placeholder="Discord | Ingame | ID | Abteilung" autocomplete="off">
        </div>
        <div class="divider"></div>
        <div class="form-row">
            <div class="form-group">
                <label>Spieler-ID</label>
                <input type="number" id="modalKeyId" placeholder="z.B. 102476">
            </div>
            <div class="form-group">
                <label>Key Anfang</label>
                <input type="text" id="modalKeyPrefix" maxlength="2" placeholder="AA" value="AA">
            </div>
        </div>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="modalKeyName" placeholder="Vollständiger Name">
        </div>
        <div class="form-group">
            <label>Abteilung</label>
            <input type="text" id="modalKeyDept" placeholder="z.B. HRT">
        </div>
        <div class="form-group">
            <label>Key Rang</label>
            <select id="modalRoleSelect">
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
            </select>
        </div>
        <div class="form-group">
            <label>Generierter Key</label>
            <div class="readonly-key-row">
                <input type="text" id="modalOutputKey" readonly placeholder="Key erscheint hier…">
                <button type="button" class="btn-outline" id="modalCopyKeyBtn">Kopieren</button>
            </div>
        </div>
    `;
    const footer = `
        <button id="modalGenerateKeyBtn">Key erstellen</button>
        <button class="btn-outline" id="modalCloseKeyBtn">Schließen</button>
    `;
    openFormModal('Key Manager', content, footer);
    initCustomSelect(document.getElementById('modalRoleSelect'));

    document.getElementById('modalCloseKeyBtn').addEventListener('click', closeFormModal);

    document.getElementById('modalCopyKeyBtn').addEventListener('click', async () => {
        const val = document.getElementById('modalOutputKey').value;
        if (!val) return showToast('Kein Key vorhanden', 'error');
        const ok = await copyToClipboard(val);
        showToast(ok ? 'Key kopiert!' : 'Kopieren fehlgeschlagen', ok ? 'success' : 'error');
    });

    document.getElementById('modalAutofillInput').addEventListener('input', (e) => {
        const parts = e.target.value.split('|').map(s => s.trim());
        if (parts.length >= 4) {
            document.getElementById('modalKeyName').value = parts[1] || '';
            document.getElementById('modalKeyId').value = parts[2] || '';
            document.getElementById('modalKeyDept').value = parts[3] || '';
            if (parts[1]) document.getElementById('modalKeyPrefix').value = derivePrefix(parts[1]);
        }
    });

    document.getElementById('modalGenerateKeyBtn').addEventListener('click', async (ev) => {
        const id = document.getElementById('modalKeyId').value.trim();
        const nm = document.getElementById('modalKeyName').value.trim();
        const dp = document.getElementById('modalKeyDept').value.trim();
        const rl = document.getElementById('modalRoleSelect').value;
        const pr = (document.getElementById('modalKeyPrefix').value || 'AA').toUpperCase().substring(0, 2);

        if (!id || !nm) return showToast('ID und Name sind Pflichtfelder', 'error');

        const k = `${pr}_${generateSecureRandomString(16)}`;
        const genBtn = ev.currentTarget;
        setBtnLoading(genBtn, true, 'Wird erstellt…', 'Key erstellen');
        try {
            await window.firebaseSet(window.firebaseRef(window.db, `keys/${k}`), {
                id, name: nm, role: rl, department: dp
            });
            document.getElementById('modalOutputKey').value = k;
            showToast(`Key erstellt!`, 'success');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        } finally {
            setBtnLoading(genBtn, false, '', 'Key erstellen');
        }
    });
});

// ==================== CODE GENERATOR ====================

document.getElementById('openCodeGeneratorBtn').addEventListener('click', () => {
    const users = Object.entries(keysData).map(([k, v]) => ({ key: k, name: v.name || k, id: v.id || '0' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const userOptions = users.map(u => `<option value="${escapeHtml(u.key)}">${escapeHtml(u.name)} (ID: ${escapeHtml(u.id)})</option>`).join('');

    const content = `
        <div class="form-group">
            <label>User auswählen</label>
            <select id="modalCodeUserSelect">
                <option value="">-- User wählen --</option>
                ${userOptions}
            </select>
        </div>
        <div class="form-group">
            <label>Generierte Codes</label>
            <textarea id="modalOutputCodes" class="code-output" readonly placeholder="Codes erscheinen hier…"></textarea>
        </div>
    `;
    const footer = `
        <button id="modalGenerateCodeBtn">Code generieren</button>
        <button class="btn-outline" id="modalGenerateAllCodesBtn">Alle Codes</button>
        <button class="btn-outline" id="modalCopyCodesBtn">Kopieren</button>
        <button class="btn-outline" id="modalCloseCodesBtn">Schließen</button>
    `;
    openFormModal('Auszahlungs Codes', content, footer);
    initCustomSelect(document.getElementById('modalCodeUserSelect'));

    document.getElementById('modalCloseCodesBtn').addEventListener('click', closeFormModal);

    document.getElementById('modalCopyCodesBtn').addEventListener('click', async () => {
        const val = document.getElementById('modalOutputCodes').value;
        if (!val) return showToast('Keine Codes vorhanden', 'error');
        const ok = await copyToClipboard(val);
        showToast(ok ? 'Kopiert!' : 'Kopieren fehlgeschlagen', ok ? 'success' : 'error');
    });

    document.getElementById('modalGenerateCodeBtn').addEventListener('click', () => {
        const k = document.getElementById('modalCodeUserSelect').value;
        if (!k) return showToast('Bitte User wählen', 'error');
        const ud = keysData[k];
        if (!ud) return showToast('User nicht gefunden', 'error');
        
        const userId = ud.id || '';
        const userName = ud.name || k;
        
        // Get entries by name or playerId
        const us = Object.values(entriesData).filter(x => 
            x.name === userName || x.playerId === userId
        );
        const tm = us.filter(x => x.status !== 'geschlossen').reduce((s, x) => s + parseAmount(x.activity), 0);
        
        if (tm === 0) return showToast('Keine offenen Boni', 'error');
        document.getElementById('modalOutputCodes').value = `${userId};${tm};HRTPrämie\n`;
    });

    document.getElementById('modalGenerateAllCodesBtn').addEventListener('click', () => {
        let cd = '';
        Object.values(keysData).forEach(ud => {
            const userId = ud.id || '';
            const userName = ud.name || '';
            
            // Get entries by name or playerId
            const us = Object.values(entriesData).filter(x => 
                x.name === userName || x.playerId === userId
            );
            const tm = us.filter(x => x.status !== 'geschlossen').reduce((s, x) => s + parseAmount(x.activity), 0);
            if (tm > 0) cd += `${userId};${tm};HRTPrämie\n`;
        });
        document.getElementById('modalOutputCodes').value = cd || 'Keine offenen Boni gefunden.';
    });
});

// ==================== BONUS LIST GENERATOR ====================

document.getElementById('openBonusListBtn').addEventListener('click', () => {
    const users = {};
    Object.values(entriesData).forEach(e => {
        if (e.status === 'offen' || e.status === 'gesehen') {
            // Use name or try to find by playerId
            let name = e.name || 'Unbekannt';
            if (e.playerId) {
                const matchingKey = Object.values(keysData).find(k => k.id === e.playerId);
                if (matchingKey && matchingKey.name) {
                    name = matchingKey.name;
                }
            }
            users[name] = (users[name] || 0) + parseAmount(e.activity);
        }
    });

    let listText = "Bonusliste \n\n";
    let total = 0;
    Object.keys(users).sort((a, b) => a.localeCompare(b, 'de')).forEach(n => {
        listText += `- **${n}**: $${users[n].toLocaleString('de-DE')}\n`;
        total += users[n];
    });
    listText += `\n**Gesamtsumme: $${total.toLocaleString('de-DE')}**`;

    const content = `
        <div class="form-group">
            <label>Discord Liste</label>
            <textarea id="modalOutputBonusList" class="code-output" style="min-height:250px;" readonly>${escapeHtml(listText)}</textarea>
        </div>
    `;
    const footer = `
        <button id="modalCopyBonusBtn">Kopieren</button>
        <button class="btn-outline" id="modalCloseBonusBtn">Schließen</button>
    `;
    openFormModal('Boni Liste', content, footer);
    document.getElementById('modalCloseBonusBtn').addEventListener('click', closeFormModal);
    document.getElementById('modalCopyBonusBtn').addEventListener('click', async () => {
        const ok = await copyToClipboard(listText);
        showToast(ok ? 'Kopiert!' : 'Kopieren fehlgeschlagen', ok ? 'success' : 'error');
    });
});

// ==================== DELETE ALL ====================

document.getElementById('deleteAllBtn').addEventListener('click', async () => {
    if (confirm('Wirklich ALLE Einsendungen löschen?')) {
        const btn = document.getElementById('deleteAllBtn');
        setBtnLoading(btn, true, 'Wird gelöscht…', 'Alle Einsendungen löschen');
        try {
            await window.firebaseSet(window.firebaseRef(window.db, 'uploads'), null);
            showToast('Gelöscht');
        } catch (e) {
            showToast('Fehler: ' + e.message, 'error');
        } finally {
            setBtnLoading(btn, false, '', 'Alle Einsendungen löschen');
        }
    }
});

// ==================== EXPORT ====================

document.getElementById('exportBtn').addEventListener('click', async () => {
    const loading = document.getElementById('exportLoadingArea');
    const exportBtn = document.getElementById('exportBtn');
    loading.classList.remove('hidden');
    exportBtn.disabled = true;

    try {
        const zip = new JSZip();
        Object.entries(entriesData).forEach(([id, entry]) => {
            if (!entry.image || !entry.name) return;
            let safeName = String(entry.name).replace(/[\\/:*?"<>|]/g, '_');
            
            // Try to get better name from playerId
            if (entry.playerId) {
                const matchingKey = Object.values(keysData).find(k => k.id === entry.playerId);
                if (matchingKey && matchingKey.name) {
                    safeName = String(matchingKey.name).replace(/[\\/:*?"<>|]/g, '_');
                }
            }
            
            const folder = zip.folder(safeName);
            const imgData = entry.image.split(',')[1];
            if (imgData) folder.file(`${id}.png`, imgData, { base64: true });
        });

        const blob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HRT_Export_${new Date().toLocaleDateString('de-DE').replace(/\./g, '-')}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        showToast('Export erfolgreich!');
    } catch (e) {
        showToast('Fehler: ' + e.message, 'error');
    } finally {
        loading.classList.add('hidden');
        exportBtn.disabled = false;
    }
});

// ==================== INITIALIZE APP ====================

// Start the application
initApp();
