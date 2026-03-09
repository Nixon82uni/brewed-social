/* ═══════════════════════════════════════
   BREWED — App Logic (Supabase Backend)
═══════════════════════════════════════ */

'use strict';

// ── Supabase Config ───────────────────────────────────────
const SUPABASE_URL = 'https://fnchjxyputztlyzumiwo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TwGD61EkPM_W-CGK2sPcQw_hl7KVOYZ';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const TABLE = 'recetas';

// ── Supabase Store ────────────────────────────────────────
const Store = {
  async all(filter) {
    let q = sb.from(TABLE).select('*').order('created_at', { ascending: false });
    if (filter && filter !== 'all') q = q.eq('metodo', filter);
    const { data, error } = await q;
    if (error) { console.error('Supabase fetch error:', error); return []; }
    return data || [];
  },
  async get(id) {
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).single();
    if (error) { console.error('Supabase get error:', error); return null; }
    return data;
  },
  async insert(recipe) {
    const { data, error } = await sb.from(TABLE).insert([recipe]).select();
    if (error) throw error;
    return data?.[0];
  },
  async update(id, fields) {
    const { data, error } = await sb.from(TABLE).update(fields).eq('id', id).select();
    if (error) throw error;
    return data?.[0];
  },
  async delete(id) {
    const { error } = await sb.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
  async like(id) {
    // Increment likes using raw RPC or read-then-write
    const current = await this.get(id);
    if (!current) return;
    const newLikes = (current.likes || 0) + 1;
    const { error } = await sb.from(TABLE).update({ likes: newLikes }).eq('id', id);
    if (error) throw error;
    return newLikes;
  }
};

// ── Utils ─────────────────────────────────────────────────
function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/<>/g,'&lt;'); }
function formatDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('es-MX', { year:'numeric', month:'short', day:'numeric' }); }
  catch { return d; }
}

// ── Toast ─────────────────────────────────────────────────
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg, type = '') {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 2800);
}

// ── Grind labels ──────────────────────────────────────────
const GRIND_LABELS = {
  1:'Muy Fino', 2:'Muy Fino', 3:'Fino', 4:'Fino',
  5:'Medio', 6:'Medio', 7:'Grueso', 8:'Grueso',
  9:'Muy Grueso', 10:'Muy Grueso'
};

// ── Temperature state ─────────────────────────────────────
let tempUnit = 'C';

// ── Stage counter ─────────────────────────────────────────
let stageCount = 0;

// ── Loading overlay ───────────────────────────────────────
const loadingOverlay = document.getElementById('loading-overlay');
function showLoading() { loadingOverlay.classList.add('visible'); }
function hideLoading() { loadingOverlay.classList.remove('visible'); }

// ── Navigation ────────────────────────────────────────────
const views = { feed: document.getElementById('view-feed'), form: document.getElementById('view-form') };
function showView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  window.scrollTo(0, 0);
}

// ── FEED ──────────────────────────────────────────────────
const grid = document.getElementById('recipe-grid');
const emptyState = document.getElementById('empty-state');
let activeFilter = 'all';
let recipesCache = [];

async function renderFeed(filter) {
  activeFilter = filter ?? activeFilter;
  showLoading();
  try {
    recipesCache = await Store.all(activeFilter);
    grid.innerHTML = '';
    if (recipesCache.length === 0) {
      emptyState.classList.remove('hidden');
      grid.style.display = 'none';
    } else {
      emptyState.classList.add('hidden');
      grid.style.display = '';
      recipesCache.forEach(r => grid.appendChild(buildCard(r)));
    }
  } catch (err) {
    console.error(err);
    showToast('Error cargando recetas', 'error');
  }
  hideLoading();
}

function buildCard(r) {
  const card = document.createElement('article');
  card.className = 'recipe-card';
  card.dataset.id = r.id;

  const cg = parseFloat(r.coffee_grams);
  const wg = parseFloat(r.water_grams);
  const ratio = (cg > 0 && wg > 0) ? `1:${(wg / cg).toFixed(1)}` : '—';
  const tempStr = r.temperatura ? `${r.temperatura}°C` : '—';
  const coffeeTxt = [r.nombre_cafe, r.origen].filter(Boolean).join(' · ') || '';
  const likes = r.likes || 0;

  card.innerHTML = `
    ${r.foto_url ? `<img class="card-photo" src="${r.foto_url}" alt="Foto" loading="lazy" />` : `<div class="card-photo-placeholder">☕</div>`}
    <div class="card-body">
      <div class="card-header">
        <div>
          <div class="card-title">${esc(r.nombre)}</div>
          ${coffeeTxt ? `<div class="card-origin">${esc(coffeeTxt)}</div>` : ''}
        </div>
        <span class="card-method-badge">${esc(r.metodo || '—')}</span>
      </div>
      <div class="card-params">
        <div class="card-param">
          <div class="card-param-label">Café</div>
          <div class="card-param-value">${cg ? cg + 'g' : '—'}</div>
        </div>
        <div class="card-param">
          <div class="card-param-label">Agua</div>
          <div class="card-param-value">${wg ? wg + 'g' : '—'}</div>
        </div>
        <div class="card-param">
          <div class="card-param-label">Ratio</div>
          <div class="card-param-value">${ratio}</div>
        </div>
        <div class="card-param">
          <div class="card-param-label">Temp.</div>
          <div class="card-param-value">${tempStr}</div>
        </div>
        <div class="card-param">
          <div class="card-param-label">Tueste</div>
          <div class="card-param-value">${esc(r.tueste || '—')}</div>
        </div>
        <div class="card-param">
          <div class="card-param-label">Molienda</div>
          <div class="card-param-value">${r.clicks_molienda ? GRIND_LABELS[r.clicks_molienda] || r.clicks_molienda : '—'}</div>
        </div>
      </div>
      <div class="card-footer">
        <span class="card-date">${formatDate(r.created_at)}</span>
        <div class="card-footer-right">
          <button class="card-like-btn" data-id="${r.id}" title="Me gusta">
            <svg viewBox="0 0 20 20" fill="none"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            <span>${likes}</span>
          </button>
          <span class="card-stages-count">${r.etapas?.length ? `${r.etapas.length} etapa${r.etapas.length > 1 ? 's' : ''}` : ''}</span>
        </div>
      </div>
    </div>`;

  // Like button on card (stop propagation)
  card.querySelector('.card-like-btn').addEventListener('click', async e => {
    e.stopPropagation();
    try {
      const newLikes = await Store.like(r.id);
      const span = e.currentTarget.querySelector('span');
      span.textContent = newLikes;
      e.currentTarget.classList.add('liked');
      setTimeout(() => e.currentTarget.classList.remove('liked'), 400);
    } catch(err) { showToast('Error al dar like', 'error'); }
  });

  card.addEventListener('click', () => openModal(r.id));
  return card;
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFeed(btn.dataset.method);
  });
});

// ── FORM ──────────────────────────────────────────────────
const form = document.getElementById('recipe-form');
const formTitle = document.getElementById('form-title');
let photoData = null;
let editingId = null;

function resetForm() {
  form.reset();
  document.getElementById('field-id').value = '';
  document.getElementById('ratio-value').textContent = '—';
  document.getElementById('grind-label-text').textContent = 'Medio';
  document.getElementById('grind-number').textContent = '5/10';
  document.getElementById('field-grind-level').value = 5;
  updateGrindSliderTrack(5);
  photoData = null;
  editingId = null;
  document.getElementById('photo-preview').classList.add('hidden');
  document.getElementById('photo-prompt').style.display = '';
  document.getElementById('stages-container').innerHTML = '';
  document.getElementById('stages-hint').classList.remove('hidden');
  stageCount = 0;
  tempUnit = 'C';
  document.querySelectorAll('.temp-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === 'C'));
  document.getElementById('field-date').value = new Date().toISOString().split('T')[0];
}

function openNewForm() {
  resetForm();
  editingId = null;
  formTitle.textContent = 'Nueva Receta';
  showView('form');
}

async function openEditForm(id) {
  const r = await Store.get(id);
  if (!r) return;
  resetForm();
  editingId = id;
  formTitle.textContent = 'Editar Receta';

  document.getElementById('field-id').value = r.id;
  document.getElementById('field-name').value = r.nombre || '';
  document.getElementById('field-method').value = r.metodo || '';
  document.getElementById('field-date').value = r.fecha || '';
  document.getElementById('field-notes').value = r.notas || '';
  document.getElementById('field-coffee-name').value = r.nombre_cafe || '';
  document.getElementById('field-origin').value = r.origen || '';
  document.getElementById('field-roaster').value = r.tostador || '';
  document.getElementById('field-process').value = r.proceso || '';
  document.getElementById('field-grinder').value = r.tipo_molino || '';
  document.getElementById('field-grinder-model').value = r.modelo_molino || '';
  const gl = r.clicks_molienda || 5;
  document.getElementById('field-grind-level').value = gl;
  document.getElementById('grind-label-text').textContent = GRIND_LABELS[gl] || 'Medio';
  document.getElementById('grind-number').textContent = `${gl}/10`;
  updateGrindSliderTrack(gl);
  document.getElementById('field-grind-setting').value = r.grind_setting || '';
  document.getElementById('field-temp').value = r.temperatura || '';
  tempUnit = r.temp_unit || 'C';
  document.querySelectorAll('.temp-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === tempUnit));
  document.getElementById('field-water-quality').value = r.calidad_agua || '';
  document.getElementById('field-coffee-grams').value = r.coffee_grams || '';
  document.getElementById('field-water-grams').value = r.water_grams || '';
  document.getElementById('field-yield-grams').value = r.yield_grams || '';
  document.getElementById('field-total-time').value = r.tiempo_total || '';

  if (r.tueste) {
    const radio = form.querySelector(`input[name="roast"][value="${r.tueste}"]`);
    if (radio) radio.checked = true;
  }

  if (r.foto_url) {
    photoData = r.foto_url;
    const preview = document.getElementById('photo-preview');
    preview.src = r.foto_url;
    preview.classList.remove('hidden');
    document.getElementById('photo-prompt').style.display = 'none';
  }

  updateRatio();
  (r.etapas || []).forEach(s => addStage(s));
  showView('form');
}

// Photo upload
const photoDrop = document.getElementById('photo-drop');
const photoInput = document.getElementById('field-photo');
const photoPrompt = document.getElementById('photo-prompt');
const photoPreview = document.getElementById('photo-preview');

photoDrop.addEventListener('click', () => photoInput.click());
photoDrop.addEventListener('dragover', e => { e.preventDefault(); photoDrop.classList.add('drag-over'); });
photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('drag-over'));
photoDrop.addEventListener('drop', e => {
  e.preventDefault();
  photoDrop.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadPhoto(file);
});
photoInput.addEventListener('change', () => {
  if (photoInput.files[0]) loadPhoto(photoInput.files[0]);
});

function loadPhoto(file) {
  // Compress to max 800px for efficient Supabase storage
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      photoData = canvas.toDataURL('image/webp', 0.75);
      photoPreview.src = photoData;
      photoPreview.classList.remove('hidden');
      photoPrompt.style.display = 'none';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Ratio calculator
function updateRatio() {
  const c = parseFloat(document.getElementById('field-coffee-grams').value);
  const w = parseFloat(document.getElementById('field-water-grams').value);
  const el = document.getElementById('ratio-value');
  if (c > 0 && w > 0) { el.textContent = (w / c).toFixed(1); }
  else { el.textContent = '—'; }
}
document.getElementById('field-coffee-grams').addEventListener('input', updateRatio);
document.getElementById('field-water-grams').addEventListener('input', updateRatio);

// Grind slider
const grindSlider = document.getElementById('field-grind-level');
function updateGrindSliderTrack(val) {
  const pct = ((val - 1) / 9) * 100;
  grindSlider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--bg-3) ${pct}%, var(--bg-3) 100%)`;
}
grindSlider.addEventListener('input', () => {
  const v = parseInt(grindSlider.value);
  document.getElementById('grind-label-text').textContent = GRIND_LABELS[v];
  document.getElementById('grind-number').textContent = `${v}/10`;
  updateGrindSliderTrack(v);
});
updateGrindSliderTrack(5);

// Temperature toggle
document.querySelectorAll('.temp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const newUnit = btn.dataset.unit;
    if (newUnit === tempUnit) return;
    const val = parseFloat(document.getElementById('field-temp').value);
    if (!isNaN(val)) {
      if (newUnit === 'F') document.getElementById('field-temp').value = Math.round(val * 9/5 + 32);
      else document.getElementById('field-temp').value = Math.round((val - 32) * 5/9);
    }
    tempUnit = newUnit;
    document.querySelectorAll('.temp-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === tempUnit));
  });
});

// ── Stages ────────────────────────────────────────────────
function addStage(data = {}) {
  stageCount++;
  const n = stageCount;
  document.getElementById('stages-hint').classList.add('hidden');

  const card = document.createElement('div');
  card.className = 'stage-card';
  card.dataset.stage = n;
  card.innerHTML = `
    <div class="stage-header">
      <div class="stage-number">${n}</div>
      <div class="stage-header-title">Etapa ${n}</div>
      <button type="button" class="btn-remove-stage" data-n="${n}">✕</button>
    </div>
    <div class="stage-fields">
      <div class="stage-field">
        <label>Duración</label>
        <input type="text" name="stage-duration-${n}" placeholder="Ej. 0:30" value="${esc(data.duration || '')}" />
      </div>
      <div class="stage-field">
        <label>Vertido (g)</label>
        <input type="number" name="stage-pour-${n}" placeholder="Ej. 60" min="0" value="${esc(data.pour || '')}" />
      </div>
      <div class="stage-field">
        <label>Temperatura</label>
        <input type="text" name="stage-temp-${n}" placeholder="Ej. 93°C" value="${esc(data.temp || '')}" />
      </div>
      <div class="stage-field stage-notes">
        <label>Notas de la etapa</label>
        <input type="text" name="stage-notes-${n}" placeholder="Ej. Pre-infusión, circular, centro..." value="${esc(data.notes || '')}" />
      </div>
    </div>`;

  card.querySelector('.btn-remove-stage').addEventListener('click', () => {
    card.remove();
    const remaining = document.querySelectorAll('.stage-card');
    if (remaining.length === 0) document.getElementById('stages-hint').classList.remove('hidden');
    remaining.forEach((c, i) => {
      c.querySelector('.stage-number').textContent = i + 1;
      c.querySelector('.stage-header-title').textContent = `Etapa ${i + 1}`;
    });
    stageCount = remaining.length;
  });

  document.getElementById('stages-container').appendChild(card);
}

document.getElementById('btn-add-stage').addEventListener('click', () => addStage());

// ── Form Submit ───────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();

  const nombre = document.getElementById('field-name').value.trim();
  const metodo = document.getElementById('field-method').value;
  if (!nombre) { showToast('El nombre es obligatorio.', 'error'); return; }
  if (!metodo) { showToast('Selecciona un método de preparación.', 'error'); return; }

  const stageCards = document.querySelectorAll('.stage-card');
  const etapas = Array.from(stageCards).map((c, i) => {
    const n = c.dataset.stage;
    return {
      name: `Etapa ${i + 1}`,
      duration: c.querySelector(`[name="stage-duration-${n}"]`)?.value.trim() || '',
      pour: c.querySelector(`[name="stage-pour-${n}"]`)?.value || '',
      temp: c.querySelector(`[name="stage-temp-${n}"]`)?.value.trim() || '',
      notes: c.querySelector(`[name="stage-notes-${n}"]`)?.value.trim() || ''
    };
  });

  const roastChecked = form.querySelector('input[name="roast"]:checked');
  const cg = document.getElementById('field-coffee-grams').value;
  const wg = document.getElementById('field-water-grams').value;
  const ratioVal = (parseFloat(cg) > 0 && parseFloat(wg) > 0)
    ? `1:${(parseFloat(wg) / parseFloat(cg)).toFixed(1)}` : null;

  const row = {
    nombre,
    metodo,
    fecha: document.getElementById('field-date').value || null,
    notas: document.getElementById('field-notes').value.trim() || null,
    nombre_cafe: document.getElementById('field-coffee-name').value.trim() || null,
    origen: document.getElementById('field-origin').value.trim() || null,
    tostador: document.getElementById('field-roaster').value.trim() || null,
    proceso: document.getElementById('field-process').value || null,
    tueste: roastChecked?.value || null,
    foto_url: photoData || null,
    tipo_molino: document.getElementById('field-grinder').value || null,
    modelo_molino: document.getElementById('field-grinder-model').value.trim() || null,
    clicks_molienda: parseInt(document.getElementById('field-grind-level').value) || null,
    grind_setting: document.getElementById('field-grind-setting').value.trim() || null,
    temperatura: document.getElementById('field-temp').value || null,
    temp_unit: tempUnit,
    calidad_agua: document.getElementById('field-water-quality').value || null,
    coffee_grams: cg || null,
    water_grams: wg || null,
    ratio: ratioVal,
    yield_grams: document.getElementById('field-yield-grams').value || null,
    tiempo_total: document.getElementById('field-total-time').value.trim() || null,
    etapas
  };

  const saveBtn = document.getElementById('btn-save');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando…';

  try {
    if (editingId) {
      await Store.update(editingId, row);
      showToast('✓ Receta actualizada', 'success');
    } else {
      await Store.insert(row);
      showToast('✓ Receta publicada', 'success');
    }
    await renderFeed();
    showView('feed');
  } catch (err) {
    console.error('Save error:', err);
    showToast(`Error: ${err.message || 'No se pudo guardar'}`, 'error');
  }
  saveBtn.disabled = false;
  saveBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><path d="M5 10l4.5 4.5L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Publicar Receta';
});

// ── MODAL ─────────────────────────────────────────────────
const modal = document.getElementById('detail-modal');
let modalRecipeId = null;

async function openModal(id) {
  const r = await Store.get(id);
  if (!r) return;
  modalRecipeId = id;

  const wrap = document.getElementById('modal-photo-wrap');
  const img = document.getElementById('modal-photo');
  if (r.foto_url) { img.src = r.foto_url; wrap.classList.remove('hidden'); }
  else wrap.classList.add('hidden');

  document.getElementById('modal-method-badge').textContent = r.metodo || '';
  document.getElementById('modal-title').textContent = r.nombre;
  document.getElementById('modal-like-count').textContent = r.likes || 0;

  const metaParts = [];
  if (r.created_at) metaParts.push(formatDate(r.created_at));
  if (r.tostador) metaParts.push(r.tostador);
  document.getElementById('modal-meta').textContent = metaParts.join(' · ');

  const cg = parseFloat(r.coffee_grams);
  const wg = parseFloat(r.water_grams);
  const ratio = (cg > 0 && wg > 0) ? `1:${(wg / cg).toFixed(1)}` : null;

  const params = [
    { icon: '🫘', label: 'Café', value: r.nombre_cafe || '—' },
    { icon: '🌍', label: 'Origen', value: r.origen || '—' },
    { icon: '🔥', label: 'Tueste', value: r.tueste || '—' },
    { icon: '🧪', label: 'Proceso', value: r.proceso || '—' },
    { icon: '⚙️', label: 'Molino', value: r.modelo_molino || r.tipo_molino || '—' },
    { icon: '📏', label: 'Molienda', value: r.clicks_molienda ? `${GRIND_LABELS[r.clicks_molienda] || ''} (${r.clicks_molienda}/10)` : '—' },
    { icon: '⚖️', label: 'Café', value: cg ? `${cg}g` : '—' },
    { icon: '💧', label: 'Agua', value: wg ? `${wg}g` : '—' },
    { icon: '📊', label: 'Ratio', value: ratio || '—', highlight: true },
    { icon: '🌡️', label: 'Temp.', value: r.temperatura ? `${r.temperatura}°${r.temp_unit || 'C'}` : '—' },
    { icon: '🥛', label: 'Calidad agua', value: r.calidad_agua || '—' },
    { icon: '⏱️', label: 'Tiempo', value: r.tiempo_total || '—' },
  ];

  document.getElementById('modal-params').innerHTML = params
    .filter(p => p.value && p.value !== '—')
    .map(p => `
    <div class="param-chip">
      <div class="param-chip-icon">${p.icon}</div>
      <div class="param-chip-label">${esc(p.label)}</div>
      <div class="param-chip-value${p.highlight ? ' highlight' : ''}">${esc(p.value)}</div>
    </div>`).join('');

  const stagesWrap = document.getElementById('modal-stages-wrap');
  const stagesEl = document.getElementById('modal-stages');
  if (r.etapas && r.etapas.length > 0) {
    stagesEl.innerHTML = r.etapas.map((s, i) => `
      <div class="timeline-step">
        <div class="timeline-dot">
          <div class="timeline-dot-circle">${i + 1}</div>
          <div class="timeline-dot-line"></div>
        </div>
        <div class="timeline-body">
          <div class="timeline-step-name">${esc(s.name)}</div>
          ${s.pour ? `<div class="timeline-notes">Vertido: ${esc(s.pour)}g${s.temp ? ' · ' + esc(s.temp) : ''}</div>` : ''}
          ${s.notes ? `<div class="timeline-notes">${esc(s.notes)}</div>` : ''}
        </div>
        <div class="timeline-time">${esc(s.duration || '')}</div>
      </div>`).join('');
    stagesWrap.classList.remove('hidden');
  } else {
    stagesWrap.classList.add('hidden');
  }

  const notesWrap = document.getElementById('modal-notes-wrap');
  if (r.notas) {
    document.getElementById('modal-notes-text').textContent = r.notas;
    notesWrap.classList.remove('hidden');
  } else {
    notesWrap.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  modalRecipeId = null;
}

document.getElementById('btn-modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

document.getElementById('btn-modal-edit').addEventListener('click', () => {
  const id = modalRecipeId;
  closeModal();
  openEditForm(id);
});

// Like in modal
document.getElementById('btn-modal-like').addEventListener('click', async () => {
  if (!modalRecipeId) return;
  try {
    const newLikes = await Store.like(modalRecipeId);
    document.getElementById('modal-like-count').textContent = newLikes;
    document.getElementById('btn-modal-like').classList.add('liked');
    setTimeout(() => document.getElementById('btn-modal-like').classList.remove('liked'), 400);
  } catch(err) { showToast('Error al dar like', 'error'); }
});

// ── Delete ────────────────────────────────────────────────
const confirmOverlay = document.getElementById('confirm-overlay');
let pendingDeleteId = null;

function openConfirm(id) { pendingDeleteId = id; confirmOverlay.classList.remove('hidden'); }
function closeConfirm() { confirmOverlay.classList.add('hidden'); pendingDeleteId = null; }

document.getElementById('btn-modal-delete').addEventListener('click', () => openConfirm(modalRecipeId));
document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirm);
document.getElementById('btn-confirm-ok').addEventListener('click', async () => {
  if (pendingDeleteId) {
    try {
      await Store.delete(pendingDeleteId);
      closeConfirm();
      closeModal();
      await renderFeed();
      showToast('Receta eliminada', 'error');
    } catch(err) {
      showToast('Error eliminando receta', 'error');
    }
  }
});
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirm(); });

// ── Nav bindings ──────────────────────────────────────────
document.getElementById('btn-new-recipe').addEventListener('click', openNewForm);
document.getElementById('btn-empty-new').addEventListener('click', openNewForm);
document.getElementById('btn-brand').addEventListener('click', () => { closeModal(); showView('feed'); renderFeed(); });
document.getElementById('btn-back').addEventListener('click', () => showView('feed'));
document.getElementById('btn-cancel').addEventListener('click', () => showView('feed'));

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!confirmOverlay.classList.contains('hidden')) { closeConfirm(); return; }
    if (!modal.classList.contains('hidden')) { closeModal(); return; }
  }
});

// ── Init ──────────────────────────────────────────────────
document.getElementById('field-date').value = new Date().toISOString().split('T')[0];
renderFeed();
