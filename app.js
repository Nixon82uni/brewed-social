/* ═══════════════════════════════════════
   BREWED — Phase 4: Auth, Storage & Privacy
═══════════════════════════════════════ */
'use strict';

const SUPABASE_URL = 'https://fnchjxyputztlyzumiwo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TwGD61EkPM_W-CGK2sPcQw_hl7KVOYZ';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utils ─────────────────────────────────────────────────
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fmtDate(d) { if (!d) return ''; try { return new Date(d).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return d; } }
function timeAgo(d) { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return 'hace un momento'; if (s < 3600) return `hace ${Math.floor(s / 60)}m`; if (s < 86400) return `hace ${Math.floor(s / 3600)}h`; return fmtDate(d); }
const GRIND_LABELS = { 1: 'Muy Fino', 2: 'Muy Fino', 3: 'Fino', 4: 'Fino', 5: 'Medio', 6: 'Medio', 7: 'Grueso', 8: 'Grueso', 9: 'Muy Grueso', 10: 'Muy Grueso' };
const VIS_LABELS = { publica: '🌍 Pública', seguidores: '👥 Seguidores', privada: '🔒 Privada' };
let tempUnit = 'C', stageCount = 0;

// ── Toast ─────────────────────────────────────────────────
const toast = document.getElementById('toast'); let toastTimer;
function showToast(msg, type = '') { clearTimeout(toastTimer); toast.textContent = msg; toast.className = `toast ${type} show`; toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); }

// ── Loading / Skeleton ────────────────────────────────────
const loadingOverlay = document.getElementById('loading-overlay');
const skeletonGrid = document.getElementById('skeleton-grid');
function showLoading() { loadingOverlay.classList.add('visible'); }
function hideLoading() { loadingOverlay.classList.remove('visible'); }
function showSkeleton() { skeletonGrid?.classList.remove('hidden'); }
function hideSkeleton() { skeletonGrid?.classList.add('hidden'); }

// ═══════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════
let currentUser = null, currentProfile = null;

async function getSession() {
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

function uid() { return currentUser?.id || null; }

// Login
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Falta el ingrediente principal', 'error'); return; }
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    showToast('¡Bienvenido!', 'success');
  } catch (err) { showToast('Algo salió mal, intenta de nuevo', 'error'); }
});

// Register
document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const username = document.getElementById('reg-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const display_name = document.getElementById('reg-displayname').value.trim();
  if (!email || !pass || !username || !display_name) { showToast('Falta el ingrediente principal', 'error'); return; }
  try {
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if (error) throw error;
    // Store pending profile data for when session becomes active
    localStorage.setItem('brewed_pending_profile', JSON.stringify({ username, display_name }));
    // If session is returned immediately (no email confirmation), profile will be created in onAuthStateChange
    if (data.session) {
      showToast('¡Cuenta creada!', 'success');
    } else {
      showToast('¡Cuenta creada! Revisa tu email para confirmar.', 'success');
    }
  } catch (err) { showToast('Algo salió mal, intenta de nuevo', 'error'); }
});

// Toggle Login / Register / Forgot
const loginFormEl = document.getElementById('login-form');
const registerFormEl = document.getElementById('register-form');
const forgotFormEl = document.getElementById('forgot-form');

document.getElementById('show-register').addEventListener('click', () => {
  loginFormEl.classList.add('hidden');
  forgotFormEl.classList.add('hidden');
  registerFormEl.classList.remove('hidden');
});
document.getElementById('show-login').addEventListener('click', () => {
  registerFormEl.classList.add('hidden');
  forgotFormEl.classList.add('hidden');
  loginFormEl.classList.remove('hidden');
});
document.getElementById('show-forgot').addEventListener('click', () => {
  loginFormEl.classList.add('hidden');
  registerFormEl.classList.add('hidden');
  forgotFormEl.classList.remove('hidden');
});
document.getElementById('show-login-from-forgot').addEventListener('click', () => {
  forgotFormEl.classList.add('hidden');
  registerFormEl.classList.add('hidden');
  loginFormEl.classList.remove('hidden');
});

document.getElementById('forgot-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { showToast('Falta el ingrediente principal', 'error'); return; }
  try {
    await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://brewed.me'
    });
    showToast('Revisa tu correo para restablecer tu contraseña ☕', 'success');
  } catch (err) {
    showToast('Algo salió mal, intenta de nuevo', 'error');
  }
});

function ensurePasswordRecoveryForm() {
  let f = document.getElementById('recovery-form');
  if (f) return f;
  const container = document.querySelector('#auth-modal .auth-container') || loginFormEl.parentElement;
  f = document.createElement('form');
  f.id = 'recovery-form';
  f.className = 'auth-card hidden';
  f.innerHTML = `<h2>Nueva contraseña</h2>
    <div class="field-group">
      <label for="recovery-new-password">Contraseña nueva</label>
      <input type="password" id="recovery-new-password" placeholder="••••••••" required minlength="6" />
    </div>
    <div class="field-group">
      <label for="recovery-confirm-password">Confirmar contraseña</label>
      <input type="password" id="recovery-confirm-password" placeholder="••••••••" required minlength="6" />
    </div>
    <button type="submit" class="btn-primary btn-auth">Guardar contraseña</button>
    <p class="auth-switch">
      <button type="button" id="show-login-from-recovery">Volver al inicio de sesión</button>
    </p>`;
  container.appendChild(f);
  console.log('PASSWORD_RECOVERY UI created', { form: f, container });

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const newPassword = document.getElementById('recovery-new-password').value.trim();
    const confirmPassword = document.getElementById('recovery-confirm-password').value.trim();
    if (!newPassword || !confirmPassword) { showToast('Algo salió mal, intenta de nuevo', 'error'); return; }
    if (newPassword !== confirmPassword) { showToast('Las contraseñas no coinciden', 'error'); return; }
    try {
      await sb.auth.updateUser({ password: newPassword });
      showToast('¡Contraseña actualizada! ☕', 'success');
      f.classList.add('hidden');
      document.getElementById('recovery-new-password').value = '';
      document.getElementById('recovery-confirm-password').value = '';
      loginFormEl.classList.remove('hidden');
      registerFormEl.classList.add('hidden');
      forgotFormEl.classList.add('hidden');
      closeAuthModal();
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Algo salió mal, intenta de nuevo', 'error');
    }
  });

  document.getElementById('show-login-from-recovery').addEventListener('click', () => {
    f.classList.add('hidden');
    loginFormEl.classList.remove('hidden');
    registerFormEl.classList.add('hidden');
    forgotFormEl.classList.add('hidden');
  });

  return f;
}

function showPasswordRecoveryForm() {
  openAuthModal();
  const f = ensurePasswordRecoveryForm();
  loginFormEl.classList.add('hidden');
  registerFormEl.classList.add('hidden');
  forgotFormEl.classList.add('hidden');
  f.classList.remove('hidden');
  const m = document.getElementById('auth-modal');
  console.log('PASSWORD_RECOVERY UI shown', { authModalHidden: m?.classList?.contains('hidden'), recoveryHidden: f.classList.contains('hidden') });
  document.getElementById('recovery-new-password')?.focus();
}

// Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await sb.auth.signOut();
  showToast('Sesión cerrada', 'success');
});

// Auth state listener — MUST be synchronous to avoid Supabase lock timeout
let authHandled = false;
sb.auth.onAuthStateChange((event, session) => {
  // Defer all async work to avoid blocking the auth lock
  handleAuthChange(event, session);
});

function openAuthModal() {
  const m = document.getElementById('auth-modal');
  if (!m) return;
  m.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  const m = document.getElementById('auth-modal');
  if (!m) return;
  m.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('btn-auth-close')?.addEventListener('click', closeAuthModal);

function requireAuth() {
  if (uid()) return true;
  showToast('Necesitas tu taza para esto — inicia sesión', 'error');
  openAuthModal();
  return false;
}

async function handleAuthChange(event, session) {
  try {
    if (event === 'PASSWORD_RECOVERY') {
      // Supabase requires the user to set a new password after the recovery link loads
      console.log('PASSWORD_RECOVERY fired', { event, session });
      showPasswordRecoveryForm();
      return;
    }
    if (session?.user) {
      // Prevent re-entry if same user already loaded (INITIAL_SESSION + SIGNED_IN fire back-to-back)
      if (authHandled && currentUser?.id === session.user.id) return;
      authHandled = true;
      currentUser = session.user;
      // Try loading existing profile — use maybeSingle to avoid 406 on 0 rows
      let { data } = await sb.from('perfiles').select('*').eq('id', currentUser.id).maybeSingle();
      // If no profile exists, create from pending registration data
      if (!data) {
        const pending = localStorage.getItem('brewed_pending_profile');
        if (pending) {
          const { username, display_name } = JSON.parse(pending);
          const { data: newProfile, error: pErr } = await sb.from('perfiles').insert([{ id: currentUser.id, username, display_name }]).select().maybeSingle();
          if (pErr) {
            if (pErr.code === '23505') showToast('Ese username ya existe, edita tu perfil', 'error');
            else console.error('Profile creation error:', pErr);
          } else {
            data = newProfile;
          }
          localStorage.removeItem('brewed_pending_profile');
        }
      }
      currentProfile = data;
      enterApp();
    } else {
      authHandled = false;
      currentUser = null; currentProfile = null;
      exitApp();
    }
  } catch (err) {
    console.error('Auth state change error:', err);
    authHandled = false;
    exitApp();
  }
}

function enterApp() {
  hideLoading();
  const recoveryForm = document.getElementById('recovery-form');
  // Keep auth modal open while password recovery UI is visible
  if (!(recoveryForm && !recoveryForm.classList.contains('hidden'))) closeAuthModal();
  document.getElementById('main-navbar').classList.remove('hidden');
  showAppView('feed');
  updateNavAvatar();
  updateAuthNav();
  renderFeed();
  refreshNotifBadge();
}
function exitApp() {
  hideLoading();
  const recoveryForm = document.getElementById('recovery-form');
  // Keep auth modal open while password recovery UI is visible
  if (!(recoveryForm && !recoveryForm.classList.contains('hidden'))) closeAuthModal();
  document.getElementById('main-navbar').classList.remove('hidden');
  document.querySelectorAll('main .view').forEach(v => v.classList.remove('active'));
  showAppView('feed');
  updateNavAvatar();
  updateAuthNav();
  renderFeed();
}

function updateNavAvatar() {
  const img = document.getElementById('nav-avatar');
  const fb = document.getElementById('nav-avatar-fallback');
  if (currentProfile?.foto_perfil) { img.src = currentProfile.foto_perfil; img.style.display = 'block'; fb.style.display = 'none'; }
  else { img.style.display = 'none'; fb.style.display = 'flex'; fb.textContent = currentProfile ? currentProfile.display_name[0].toUpperCase() : '?'; }
}

function updateAuthNav() {
  const hasUser = !!uid();
  const newBtn = document.getElementById('btn-new-recipe');
  const emptyBtn = document.getElementById('btn-empty-new');
  const profileBtn = document.getElementById('btn-profile');
  const logoutBtn = document.getElementById('btn-logout');
  const loginBtn = document.getElementById('btn-login-open');
  if (newBtn) newBtn.style.display = hasUser ? '' : 'none';
  if (emptyBtn) emptyBtn.style.display = hasUser ? '' : 'none';
  if (profileBtn) profileBtn.style.display = hasUser ? '' : 'none';
  if (logoutBtn) logoutBtn.style.display = hasUser ? '' : 'none';
  if (loginBtn) loginBtn.style.display = hasUser ? 'none' : '';
}

// ═══════════════════════════════════════════════════════════
// STORAGE UPLOADS
// ═══════════════════════════════════════════════════════════
async function compressImage(file, maxPx = 800) {
  return new Promise(resolve => {
    const reader = new FileReader(); reader.onload = e => {
      const img = new Image(); img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxPx || h > maxPx) { if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; } else { w = Math.round(w * maxPx / h); h = maxPx; } }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(blob => resolve(blob), 'image/webp', 0.75);
      }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
  });
}

async function uploadAvatar(file) {
  const blob = await compressImage(file, 200);
  const path = `${uid()}/avatar.webp`;
  const { error } = await sb.storage.from('avatars').upload(path, blob, { upsert: true, contentType: 'image/webp' });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(path);
  return publicUrl + '?t=' + Date.now();
}

async function uploadRecipePhoto(file) {
  const blob = await compressImage(file, 800);
  const name = `${uid()}/${crypto.randomUUID()}.webp`;
  const { error } = await sb.storage.from('recipes').upload(name, blob, { contentType: 'image/webp' });
  if (error) throw error;
  const { data: { publicUrl } } = sb.storage.from('recipes').getPublicUrl(name);
  return publicUrl;
}

// ═══════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════
const RecipeStore = {
  async all(filter, feedMode, followingIds) {
    let q = sb.from('recetas').select('*').order('created_at', { ascending: false });
    if (filter && filter !== 'all') q = q.eq('metodo', filter);
    if (feedMode === 'global') {
      q = q.eq('visibilidad', 'publica');
    } else if (feedMode === 'following' && followingIds) {
      // Show public + seguidores from followed users
      q = q.in('perfil_id', followingIds).in('visibilidad', ['publica', 'seguidores']);
    }
    const { data, error } = await q; if (error) { console.error(error); return []; } return data || [];
  },
  async get(id) { const { data } = await sb.from('recetas').select('*').eq('id', id).single(); return data; },
  async insert(r) { const { data, error } = await sb.from('recetas').insert([r]).select(); if (error) throw error; return data?.[0]; },
  async update(id, f) { const { data, error } = await sb.from('recetas').update(f).eq('id', id).select(); if (error) throw error; return data?.[0]; },
  async delete(id) { const { error } = await sb.from('recetas').delete().eq('id', id); if (error) throw error; },
  async search(filters) {
    const { q, method, roast, process, sortBy } = filters;
    let query = sb.from('recetas').select('*').eq('visibilidad', 'publica');
    
    // Apply filters
    if (q) {
      query = query.or(`nombre.ilike.%${q}%,metodo.ilike.%${q}%,nombre_cafe.ilike.%${q}%,origen.ilike.%${q}%`);
    }
    if (method) query = query.eq('metodo', method);
    if (roast) query = query.eq('tueste', roast);
    if (process) query = query.eq('proceso', process);
    
    // Apply base ordering / limits depending on sort mode
    const effectiveSort = sortBy || 'recent';
    if (effectiveSort === 'recent') {
      // For recent, let Postgres handle ordering by date
      query = query.order('created_at', { ascending: false }).limit(30);
    } else {
      // For likes/comments, fetch a larger slice without forcing created_at order,
      // then sort in JS using the aggregated counts.
      query = query.limit(200);
    }
    
    const { data } = await query;
    if (!data || data.length === 0) return [];

    if (effectiveSort === 'recent') return data;

    // Fetch counts for sorting
    const ids = data.map(r => r.id);
    if (effectiveSort === 'likes') {
      const { data: likesData } = await sb.from('recipe_likes').select('receta_id').in('receta_id', ids);
      const counts = {};
      (likesData || []).forEach(l => counts[l.receta_id] = (counts[l.receta_id] || 0) + 1);
      return data.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    } else if (effectiveSort === 'comments') {
      const { data: commentsData } = await sb.from('comentarios').select('receta_id').in('receta_id', ids);
      const counts = {};
      (commentsData || []).forEach(c => counts[c.receta_id] = (counts[c.receta_id] || 0) + 1);
      return data.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0));
    }
    
    return data;
  },
  async byUser(pid) {
    let q = sb.from('recetas').select('*').eq('perfil_id', pid).order('created_at', { ascending: false });
    // If viewing someone else, filter only visible
    if (pid !== uid()) q = q.in('visibilidad', ['publica', 'seguidores']);
    const { data } = await q; return data || [];
  }
};

const FollowStore = {
  async follow(followingId) { if (followingId === uid()) return; const { error } = await sb.from('follows').insert([{ follower_id: uid(), following_id: followingId }]); if (error && error.code !== '23505') throw error; NotificationStore.create(followingId, 'follow'); },
  async unfollow(followingId) { await sb.from('follows').delete().match({ follower_id: uid(), following_id: followingId }); },
  async isFollowing(followingId) { if (!uid()) return false; const { data } = await sb.from('follows').select('id').match({ follower_id: uid(), following_id: followingId }); return data && data.length > 0; },
  async myFollowingIds() { if (!uid()) return []; const { data } = await sb.from('follows').select('following_id').eq('follower_id', uid()); return (data || []).map(r => r.following_id); },
  async followersCount(pid) { const { count } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', pid); return count || 0; },
  async followingCount(pid) { const { count } = await sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', pid); return count || 0; },
  async followersList(pid) { const { data } = await sb.from('follows').select('follower_id, perfiles!follows_follower_id_fkey(id,username,display_name,foto_perfil)').eq('following_id', pid); return (data || []).map(r => r.perfiles).filter(Boolean); },
  async followingList(pid) { const { data } = await sb.from('follows').select('following_id, perfiles!follows_following_id_fkey(id,username,display_name,foto_perfil)').eq('follower_id', pid); return (data || []).map(r => r.perfiles).filter(Boolean); }
};

const LikeStore = {
  async toggle(recetaId) {
    const { data: existing } = await sb.from('recipe_likes').select('id').match({ receta_id: recetaId, perfil_id: uid() });
    if (existing?.length > 0) await sb.from('recipe_likes').delete().match({ receta_id: recetaId, perfil_id: uid() });
    else {
      await sb.from('recipe_likes').insert([{ receta_id: recetaId, perfil_id: uid() }]);
      // Notify recipe owner (fire-and-forget, must not crash toggle)
      try { const recipe = await RecipeStore.get(recetaId); if (recipe?.perfil_id) NotificationStore.create(recipe.perfil_id, 'like', recetaId); } catch (e) { console.error('Like notification error:', e); }
    }
    const { count } = await sb.from('recipe_likes').select('*', { count: 'exact', head: true }).eq('receta_id', recetaId);
    return { liked: !(existing?.length > 0), count: count || 0 };
  },
  async count(recetaId) { const { count } = await sb.from('recipe_likes').select('*', { count: 'exact', head: true }).eq('receta_id', recetaId); return count || 0; },
  async isLiked(recetaId) { if (!uid()) return false; const { data } = await sb.from('recipe_likes').select('id').match({ receta_id: recetaId, perfil_id: uid() }); return data && data.length > 0; },
  async totalForUser(pid) { const { count } = await sb.from('recipe_likes').select('*, recetas!inner(perfil_id)', { count: 'exact', head: true }).eq('recetas.perfil_id', pid); return count || 0; }
};

const CommentStore = {
  async list(recetaId) { const { data } = await sb.from('comentarios').select('*, perfiles(id,username,display_name,foto_perfil)').eq('receta_id', recetaId).order('created_at', { ascending: true }); return data || []; },
  async add(recetaId, contenido, parentId = null) {
    const row = { receta_id: recetaId, perfil_id: uid(), contenido };
    if (parentId) row.parent_id = parentId;
    const { data, error } = await sb.from('comentarios').insert([row]).select('*, perfiles(id,username,display_name,foto_perfil)');
    if (error) throw error;
    const comment = data?.[0];

    // Notify recipe owner on new top-level comment (not replies)
    if (!parentId && recetaId && uid()) {
      try {
        const recipe = await RecipeStore.get(recetaId);
        if (recipe?.perfil_id && recipe.perfil_id !== uid()) {
          NotificationStore.create(recipe.perfil_id, 'comment', recetaId, comment?.id);
        }
      } catch (e) {
        console.error('Comment notification error:', e);
      }
    }

    return comment;
  },
};

const CommentLikeStore = {
  async toggle(commentId) {
    const { data: existing } = await sb.from('comment_likes').select('id').match({ comment_id: commentId, perfil_id: uid() });
    if (existing?.length > 0) await sb.from('comment_likes').delete().match({ comment_id: commentId, perfil_id: uid() });
    else await sb.from('comment_likes').insert([{ comment_id: commentId, perfil_id: uid() }]);
    const { count } = await sb.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', commentId);
    return { liked: !(existing?.length > 0), count: count || 0 };
  },
  async count(commentId) { const { count } = await sb.from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', commentId); return count || 0; },
  async isLiked(commentId) { if (!uid()) return false; const { data } = await sb.from('comment_likes').select('id').match({ comment_id: commentId, perfil_id: uid() }); return data && data.length > 0; },
};

const SaveStore = {
  async toggle(recipeId) {
    const { data: existing } = await sb.from('recipe_saves').select('id').match({ recipe_id: recipeId, perfil_id: uid() });
    if (existing?.length > 0) {
      await sb.from('recipe_saves').delete().match({ recipe_id: recipeId, perfil_id: uid() });
    } else {
      const { error } = await sb.from('recipe_saves').insert([{ recipe_id: recipeId, perfil_id: uid() }]);
      if (error) { console.error('Error saving recipe:', error); return { saved: false, count: await this.count(recipeId) }; }
    }
    return { saved: !(existing?.length > 0), count: await this.count(recipeId) };
  },
  async count(recipeId) {
    const { count } = await sb.from('recipe_saves').select('*', { count: 'exact', head: true }).eq('recipe_id', recipeId);
    return count || 0;
  },
  async isSaved(recipeId) { if (!uid()) return false; const { data } = await sb.from('recipe_saves').select('id').match({ recipe_id: recipeId, perfil_id: uid() }); return data && data.length > 0; },
  async savedByUser(pid) {
    const { data, error } = await sb.from('recipe_saves').select('recipe_id, recetas!inner(*, perfiles(id, display_name, foto_perfil))').eq('perfil_id', pid).order('created_at', { ascending: false });
    if (error) { console.error('Error fetching saved:', error); return []; }
    return (data || []).map(r => r.recetas).filter(Boolean);
  }
};

const NotificationStore = {
  async create(userId, type, recipeId = null, commentId = null) {
    if (!uid() || userId === uid()) return; // Don't notify yourself
    try { await sb.from('notificaciones').insert([{ user_id: userId, actor_id: uid(), type, recipe_id: recipeId, comment_id: commentId }]); } catch (e) { console.error('Notification create error:', e); }
  },
  async list() { const { data } = await sb.from('notificaciones').select('*, actor:perfiles!notificaciones_actor_id_fkey(id,username,display_name,foto_perfil), receta:recetas!notificaciones_recipe_id_fkey(id,nombre)').eq('user_id', uid()).order('created_at', { ascending: false }).limit(50); return data || []; },
  async unreadCount() { const { count } = await sb.from('notificaciones').select('*', { count: 'exact', head: true }).eq('user_id', uid()).eq('read', false); return count || 0; },
  async markRead(id) { await sb.from('notificaciones').update({ read: true }).eq('id', id).eq('user_id', uid()); },
  async markAllRead() { await sb.from('notificaciones').update({ read: true }).eq('user_id', uid()).eq('read', false); },
};

const UserStore = {
  async search(q) { const { data } = await sb.from('perfiles').select('*').or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20); return data || []; },
  async getById(id) { const { data } = await sb.from('perfiles').select('*').eq('id', id).single(); return data; }
};

// ═══════════════════════════════════════════════════════════
// NAV & VIEWS
// ═══════════════════════════════════════════════════════════
const appViews = { feed: document.getElementById('view-feed'), form: document.getElementById('view-form'), search: document.getElementById('view-search'), notifications: document.getElementById('view-notifications') };
function showAppView(name) {
  Object.values(appViews).forEach(v => v.classList.remove('active'));
  appViews[name].classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => { 
  showAppView(b.dataset.view); 
  if (b.dataset.view === 'feed') renderFeed(); 
  if (b.dataset.view === 'notifications') renderNotifications(); 
  if (b.dataset.view === 'search' && searchTab === 'recipes') runSearch();
}));

// ═══════════════════════════════════════════════════════════
// FEED
// ═══════════════════════════════════════════════════════════
const grid = document.getElementById('recipe-grid');
const emptyState = document.getElementById('empty-state');
let activeFilter = 'all', activeFeedMode = 'global', profilesCache = {};
let renderVersion = 0; // Guard against concurrent renders

async function getProfile(pid) { if (!pid) return null; if (profilesCache[pid]) return profilesCache[pid]; const p = await UserStore.getById(pid); if (p) profilesCache[pid] = p; return p; }

async function renderFeed(filter) {
  activeFilter = filter ?? activeFilter;
  const myVersion = ++renderVersion; // Increment version to cancel stale renders
  showSkeleton(); grid.innerHTML = ''; emptyState.classList.add('hidden');
  try {
    let followingIds = null;
    if (activeFeedMode === 'following') {
      followingIds = await FollowStore.myFollowingIds();
      if (followingIds.length === 0) { hideSkeleton(); document.getElementById('empty-title').textContent = 'Sin recetas de seguidos'; document.getElementById('empty-sub').textContent = 'Sigue a otros usuarios para ver sus recetas aquí.'; emptyState.classList.remove('hidden'); grid.style.display = 'none'; return; }
    }
    if (myVersion !== renderVersion) return; // Another render started, abort this one
    const recipes = await RecipeStore.all(activeFilter, activeFeedMode, followingIds);
    if (myVersion !== renderVersion) return; // Check again after async
    const pids = [...new Set(recipes.map(r => r.perfil_id).filter(Boolean))];
    await Promise.all(pids.map(pid => getProfile(pid)));
    const likeCounts = await Promise.all(recipes.map(r => LikeStore.count(r.id)));
    const saveCounts = await Promise.all(recipes.map(r => SaveStore.count(r.id)));
    const myLikes = uid() ? await Promise.all(recipes.map(r => LikeStore.isLiked(r.id))) : recipes.map(() => false);
    const mySaves = uid() ? await Promise.all(recipes.map(r => SaveStore.isSaved(r.id))) : recipes.map(() => false);
    if (myVersion !== renderVersion) return; // Final check before DOM mutation
    hideSkeleton();
    grid.innerHTML = ''; // Clear again before painting (safety)
    if (recipes.length === 0) { document.getElementById('empty-title').textContent = 'Sin recetas aún'; document.getElementById('empty-sub').textContent = 'Sé el primero en compartir una receta.'; emptyState.classList.remove('hidden'); grid.style.display = 'none'; }
    else {
      emptyState.classList.add('hidden'); grid.style.display = '';
      const renderedIds = new Set();
      recipes.forEach((r, i) => {
        if (renderedIds.has(r.id)) return; // Skip duplicate IDs
        renderedIds.add(r.id);
        grid.appendChild(buildCard(r, profilesCache[r.perfil_id], likeCounts[i], myLikes[i], saveCounts[i], mySaves[i]));
      });
    }
  } catch (err) { console.error(err); hideSkeleton(); showToast('Se enfrió el café ☕ Recarga e intenta de nuevo', 'error'); }
}

function buildCard(r, author, likeCount, isLiked, saveCount, isSaved) {
  const card = document.createElement('article'); card.className = 'recipe-card'; card.dataset.id = r.id;
  const cg = parseFloat(r.coffee_grams), wg = parseFloat(r.water_grams);
  const ratio = (cg > 0 && wg > 0) ? `1:${(wg / cg).toFixed(1)}` : '—';
  const authorHTML = author ? `<div class="card-author" data-uid="${author.id}"><div class="card-author-avatar">${author.foto_perfil ? `<img src="${author.foto_perfil}" alt="">` : `<span>${author.display_name[0].toUpperCase()}</span>`}</div><span class="card-author-name">${esc(author.display_name)}</span></div>` : '';
  const photoHTML = r.foto_url ? `<img class="card-photo" src="${r.foto_url}" alt="" loading="lazy"/>` : `<div class="card-photo-placeholder">☕</div>`;

  card.innerHTML = `${photoHTML}<div class="card-body">${authorHTML}<div class="card-header"><div><div class="card-title">${esc(r.nombre)}</div>${(r.nombre_cafe || r.origen) ? `<div class="card-origin">${esc([r.nombre_cafe, r.origen].filter(Boolean).join(' · '))}</div>` : ''}</div><span class="card-method-badge">${esc(r.metodo || '')}</span></div><div class="card-params"><div class="card-param"><div class="card-param-label">Café</div><div class="card-param-value">${cg ? cg + 'g' : '—'}</div></div><div class="card-param"><div class="card-param-label">Agua</div><div class="card-param-value">${wg ? wg + 'g' : '—'}</div></div><div class="card-param"><div class="card-param-label">Ratio</div><div class="card-param-value">${ratio}</div></div><div class="card-param"><div class="card-param-label">Temp.</div><div class="card-param-value">${r.temperatura ? r.temperatura + '°C' : '—'}</div></div><div class="card-param"><div class="card-param-label">Tueste</div><div class="card-param-value">${esc(r.tueste || '—')}</div></div><div class="card-param"><div class="card-param-label">Molienda</div><div class="card-param-value">${r.clicks_molienda ? GRIND_LABELS[r.clicks_molienda] || r.clicks_molienda : '—'}</div></div></div><div class="card-footer"><span class="card-date">${timeAgo(r.created_at)}</span><div class="card-footer-right"><button class="card-save-btn${isSaved ? ' saved' : ''}" data-id="${r.id}" title="Guardar"><svg viewBox="0 0 20 20" fill="${isSaved ? 'currentColor' : 'none'}"><path d="M5 2h10a1 1 0 011 1v15l-6-4-6 4V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>${saveCount}</span></button><button class="card-like-btn${isLiked ? ' liked' : ''}" data-id="${r.id}"><svg viewBox="0 0 20 20" fill="${isLiked ? 'currentColor' : 'none'}"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>${likeCount}</span></button>${r.etapas?.length ? `<span class="card-stages-count">${r.etapas.length} etapa${r.etapas.length > 1 ? 's' : ''}</span>` : ''}</div></div></div>`;

  card.querySelector('.card-save-btn').addEventListener('click', async e => {
    e.stopPropagation();
    if (!requireAuth()) return;
    const btn = e.currentTarget;
    try {
      const res = await SaveStore.toggle(r.id);
      btn.classList.toggle('saved', res.saved);
      btn.querySelector('svg path').setAttribute('fill', res.saved ? 'currentColor' : 'none');
      btn.querySelector('span').textContent = res.count;
      btn.classList.add('pulse');
      setTimeout(() => btn.classList.remove('pulse'), 400);
      showToast(res.saved ? 'En tu recetario 🔖' : 'Eliminada del recetario', 'success');
    } catch {
      showToast('Algo salió mal, intenta de nuevo', 'error');
    }
  });

  card.querySelector('.card-like-btn').addEventListener('click', async e => {
    e.stopPropagation();
    if (!requireAuth()) return;
    const btn = e.currentTarget;
    try {
      const res = await LikeStore.toggle(r.id);
      btn.querySelector('span').textContent = res.count;
      btn.classList.toggle('liked', res.liked);
      btn.querySelector('svg path').setAttribute('fill', res.liked ? 'currentColor' : 'none');
      btn.classList.add('pulse');
      setTimeout(() => btn.classList.remove('pulse'), 400);
    } catch {
      showToast('Algo salió mal, intenta de nuevo', 'error');
    }
  });
  const authorEl = card.querySelector('.card-author'); if (authorEl) authorEl.addEventListener('click', e => { e.stopPropagation(); openProfileView(authorEl.dataset.uid); });
  card.addEventListener('click', () => openModal(r.id));
  return card;
}

// Feed tabs
document.querySelectorAll('.feed-tab').forEach(t => t.addEventListener('click', () => { document.querySelectorAll('.feed-tab').forEach(x => x.classList.remove('active')); t.classList.add('active'); activeFeedMode = t.dataset.feed; renderFeed(); }));
document.querySelectorAll('.filter-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); renderFeed(b.dataset.method); }));

// ═══════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════
let searchTab = 'recipes', searchDebounce;
document.querySelectorAll('.search-tab').forEach(t => t.addEventListener('click', () => { 
  document.querySelectorAll('.search-tab').forEach(x => x.classList.remove('active')); 
  t.classList.add('active'); 
  searchTab = t.dataset.target; 
  document.getElementById('advanced-filters').classList.toggle('hidden', searchTab !== 'recipes');
  runSearch(); 
}));
document.getElementById('search-input').addEventListener('input', () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(runSearch, 300); });
document.querySelectorAll('.search-select').forEach(s => s.addEventListener('change', runSearch));

async function runSearch() {
  const q = document.getElementById('search-input').value.trim();
  const method = document.getElementById('filter-method').value;
  const roast = document.getElementById('filter-roast').value;
  const process = document.getElementById('filter-process').value;
  const sortBy = document.getElementById('filter-sort').value;
  
  const results = document.getElementById('search-results');
  const empty = document.getElementById('search-empty');

  if (searchTab === 'recipes') {
    // Always run the search for recipes, even with no text/filters,
    // so we can show all public recipes sorted by the selected option.
    empty.classList.add('hidden');
    const recipes = await RecipeStore.search({ q, method, roast, process, sortBy });
    
    // Fetch counts and timestamps for each recipe in search results
    const [likeCounts, commentCounts] = await Promise.all([
      Promise.all(recipes.map(r => LikeStore.count(r.id))),
      Promise.all(recipes.map(async r => {
        const { count } = await sb.from('comentarios').select('*', { count: 'exact', head: true }).eq('receta_id', r.id);
        return count || 0;
      }))
    ]);

    results.innerHTML = recipes.length
      ? recipes.map((r, i) => `<div class="search-result-card" data-id="${r.id}"><div class="sr-left">${r.foto_url ? `<img src="${r.foto_url}" class="sr-thumb" alt="">` : `<div class="sr-thumb-ph">☕</div>`}</div><div class="sr-body"><div class="sr-title">${esc(r.nombre)}</div><div class="sr-meta">${esc(r.metodo || '')} · ${r.coffee_grams ? r.coffee_grams + 'g' : ''}</div><div class="sr-stats"><span>${likeCounts[i]} likes</span><span>${commentCounts[i]} comentarios</span><span>${timeAgo(r.created_at)}</span></div></div><span class="card-method-badge">${esc(r.metodo || '')}</span></div>`).join('')
      : '<div class="search-no-results">No se encontraron recetas.</div>';
    results.querySelectorAll('.search-result-card').forEach(c => c.addEventListener('click', () => openModal(c.dataset.id)));
  } else {
    // For user search, preserve the "type something to search" empty state behavior
    if (!q) {
      results.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    const users = await UserStore.search(q);
    results.innerHTML = users.length
      ? users.map(u => `<div class="search-result-user" data-uid="${u.id}"><div class="sr-avatar">${u.foto_perfil ? `<img src="${u.foto_perfil}" alt="">` : `<span>${u.display_name[0].toUpperCase()}</span>`}</div><div class="sr-body"><div class="sr-title">${esc(u.display_name)}</div><div class="sr-meta">@${esc(u.username)}</div></div></div>`).join('')
      : '<div class="search-no-results">No se encontraron usuarios.</div>';
    results.querySelectorAll('.search-result-user').forEach(c => c.addEventListener('click', () => openProfileView(c.dataset.uid)));
  }
}

// ═══════════════════════════════════════════════════════════
// PROFILE VIEW
// ═══════════════════════════════════════════════════════════
const pvModal = document.getElementById('profile-view-modal'); let pvUserId = null;

async function openProfileView(id) {
  const u = await UserStore.getById(id); if (!u) return; pvUserId = id;
  const av = document.getElementById('pv-avatar'), fb = document.getElementById('pv-avatar-fb');
  if (u.foto_perfil) { av.src = u.foto_perfil; av.style.display = 'block'; fb.style.display = 'none'; }
  else { av.style.display = 'none'; fb.style.display = 'flex'; fb.textContent = u.display_name[0].toUpperCase(); }
  document.getElementById('pv-displayname').textContent = u.display_name;
  document.getElementById('pv-username').textContent = '@' + u.username;
  document.getElementById('pv-bio').textContent = u.bio || '';
  const eq = []; if (u.equipo_molino) eq.push('⚙️ ' + u.equipo_molino); if (u.equipo_cafetera) eq.push('☕ ' + u.equipo_cafetera);
  document.getElementById('pv-equipment').innerHTML = eq.map(e => `<span class="pv-eq-tag">${esc(e)}</span>`).join('');
  const [recipes, followers, following, totalLikes] = await Promise.all([RecipeStore.byUser(id), FollowStore.followersCount(id), FollowStore.followingCount(id), LikeStore.totalForUser(id)]);
  document.getElementById('pv-recipes').textContent = recipes.length;
  document.getElementById('pv-followers').textContent = followers;
  document.getElementById('pv-following-count').textContent = following;
  document.getElementById('pv-total-likes').textContent = totalLikes;

  // Make followers/following counts clickable
  document.getElementById('pv-stat-followers').onclick = async () => { const users = await FollowStore.followersList(id); openUserListModal('Seguidores', users); };
  document.getElementById('pv-stat-following').onclick = async () => { const users = await FollowStore.followingList(id); openUserListModal('Siguiendo', users); };

  const followBtn = document.getElementById('btn-follow');
  const editBtn = document.getElementById('btn-edit-profile');
  const isMe = uid() === id;
  if (isMe) { followBtn.style.display = 'none'; editBtn.classList.remove('hidden'); }
  else {
    followBtn.style.display = ''; editBtn.classList.add('hidden'); followBtn.classList.remove('hidden');
    const isF = await FollowStore.isFollowing(id);
    followBtn.textContent = isF ? 'Siguiendo' : 'Seguir'; followBtn.className = `btn-follow${isF ? ' following' : ''}`;
    followBtn.onclick = async () => {
      if (!requireAuth()) return;
      const cur = followBtn.classList.contains('following');
      if (cur) { await FollowStore.unfollow(id); followBtn.textContent = 'Seguir'; followBtn.classList.remove('following'); document.getElementById('pv-followers').textContent = Math.max(0, parseInt(document.getElementById('pv-followers').textContent) - 1); }
      else { await FollowStore.follow(id); followBtn.textContent = 'Siguiendo'; followBtn.classList.add('following'); document.getElementById('pv-followers').textContent = parseInt(document.getElementById('pv-followers').textContent) + 1; }
    };
  }
  // Profile tabs — only show Saved tab for own profile
  const pvTabs = document.getElementById('pv-tabs');
  const savedTab = pvTabs.querySelector('[data-pv-tab="saved"]');
  if (isMe) savedTab.style.display = ''; else savedTab.style.display = 'none';
  // Reset to Recipes tab
  pvTabs.querySelectorAll('.pv-tab').forEach(t => t.classList.toggle('active', t.dataset.pvTab === 'recipes'));
  document.getElementById('pv-recipes-grid').classList.remove('hidden');
  document.getElementById('pv-saved-grid').classList.add('hidden');

  const rg = document.getElementById('pv-recipes-grid');
  rg.innerHTML = recipes.slice(0, 9).map(r => `<div class="pv-recipe-mini" data-id="${r.id}">${r.foto_url ? `<img src="${r.foto_url}" alt="">` : `<div class="pv-mini-ph">☕</div>`}<div class="pv-mini-name">${esc(r.nombre)}</div></div>`).join('');
  rg.querySelectorAll('.pv-recipe-mini').forEach(c => c.addEventListener('click', () => { closePV(); openModal(c.dataset.id); }));

  // Load saved recipes if own profile
  if (isMe) {
    const sg = document.getElementById('pv-saved-grid');
    const savedRecipes = await SaveStore.savedByUser(uid());
    if (savedRecipes.length) {
      sg.innerHTML = savedRecipes.slice(0, 9).map(r => `<div class="pv-recipe-mini" data-id="${r.id}">${r.foto_url ? `<img src="${r.foto_url}" alt="">` : `<div class="pv-mini-ph">☕</div>`}<div class="pv-mini-name">${esc(r.nombre)}</div></div>`).join('');
      sg.querySelectorAll('.pv-recipe-mini').forEach(c => c.addEventListener('click', () => { closePV(); openModal(c.dataset.id); }));
    } else {
      sg.innerHTML = '<div class="pv-saved-empty"><div class="pv-saved-empty-icon">🔖</div><p>No has guardado recetas aún.</p></div>';
    }
  }

  pvModal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function closePV() { pvModal.classList.add('hidden'); document.body.style.overflow = ''; }
document.getElementById('btn-pv-close').addEventListener('click', closePV);
pvModal.addEventListener('click', e => { if (e.target === pvModal) closePV(); });

// Profile tabs switching
document.querySelectorAll('.pv-tab').forEach(t => {
  t.addEventListener('click', () => {
    // Update active tab styling
    document.querySelectorAll('.pv-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');

    // Toggle grids based on selected tab
    const showRecipes = t.dataset.pvTab === 'recipes';
    const recipesGrid = document.getElementById('pv-recipes-grid');
    const savedGrid = document.getElementById('pv-saved-grid');

    if (recipesGrid && savedGrid) {
      recipesGrid.classList.toggle('hidden', !showRecipes);
      savedGrid.classList.toggle('hidden', showRecipes);
    }
  });
});

// ── User List Modal (Followers / Following) ───────────────
const ulModal = document.getElementById('user-list-modal');
function openUserListModal(title, users) {
  document.getElementById('ul-title').textContent = title;
  const list = document.getElementById('ul-list');
  const empty = document.getElementById('ul-empty');
  if (users.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); }
  else {
    empty.classList.add('hidden');
    list.innerHTML = users.map(u => `<div class="ul-item" data-uid="${u.id}"><div class="ul-avatar">${u.foto_perfil ? `<img src="${u.foto_perfil}" alt="">` : `<span>${(u.display_name || '?')[0].toUpperCase()}</span>`}</div><div class="ul-info"><div class="ul-name">${esc(u.display_name)}</div><div class="ul-username">@${esc(u.username)}</div></div></div>`).join('');
    list.querySelectorAll('.ul-item').forEach(item => item.addEventListener('click', () => { closeUserListModal(); closePV(); openProfileView(item.dataset.uid); }));
  }
  ulModal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function closeUserListModal() { ulModal.classList.add('hidden'); document.body.style.overflow = ''; }
document.getElementById('btn-ul-close').addEventListener('click', closeUserListModal);
ulModal.addEventListener('click', e => { if (e.target === ulModal) closeUserListModal(); });

// ═══════════════════════════════════════════════════════════
// EDIT PROFILE
// ═══════════════════════════════════════════════════════════
const epModal = document.getElementById('edit-profile-modal');
let epPhotoFile = null;

document.getElementById('btn-edit-profile').addEventListener('click', () => {
  closePV();
  if (!currentProfile) return;
  document.getElementById('ep-displayname').value = currentProfile.display_name || '';
  document.getElementById('ep-bio').value = currentProfile.bio || '';
  document.getElementById('ep-molino').value = currentProfile.equipo_molino || '';
  document.getElementById('ep-cafetera').value = currentProfile.equipo_cafetera || '';
  const prev = document.getElementById('ep-avatar-preview');
  if (currentProfile.foto_perfil) { prev.src = currentProfile.foto_perfil; prev.classList.remove('hidden'); document.getElementById('ep-avatar-prompt').style.display = 'none'; }
  else { prev.classList.add('hidden'); document.getElementById('ep-avatar-prompt').style.display = ''; }
  epPhotoFile = null;
  epModal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
});
function closeEP() { epModal.classList.add('hidden'); document.body.style.overflow = ''; }
document.getElementById('btn-ep-close').addEventListener('click', closeEP);
epModal.addEventListener('click', e => { if (e.target === epModal) closeEP(); });

const epDrop = document.getElementById('ep-avatar-drop');
const epInput = document.getElementById('ep-photo');
epDrop.addEventListener('click', () => epInput.click());
epInput.addEventListener('change', () => { if (epInput.files[0]) previewEPAvatar(epInput.files[0]); });
function previewEPAvatar(file) {
  epPhotoFile = file; const reader = new FileReader(); reader.onload = e => { const p = document.getElementById('ep-avatar-preview'); p.src = e.target.result; p.classList.remove('hidden'); document.getElementById('ep-avatar-prompt').style.display = 'none'; }; reader.readAsDataURL(file);
}

document.getElementById('edit-profile-form').addEventListener('submit', async e => {
  e.preventDefault();
  const display_name = document.getElementById('ep-displayname').value.trim();
  if (!display_name) { showToast('El nombre es obligatorio', 'error'); return; }
  try {
    const updates = { display_name, bio: document.getElementById('ep-bio').value.trim(), equipo_molino: document.getElementById('ep-molino').value.trim(), equipo_cafetera: document.getElementById('ep-cafetera').value.trim() };
    if (epPhotoFile) { updates.foto_perfil = await uploadAvatar(epPhotoFile); }
    const { error } = await sb.from('perfiles').update(updates).eq('id', uid());
    if (error) throw error;
    currentProfile = { ...currentProfile, ...updates };
    profilesCache[uid()] = currentProfile;
    updateNavAvatar(); closeEP(); showToast('Perfil actualizado ✓', 'success');
  } catch (err) { showToast('Algo salió mal, intenta de nuevo', 'error'); }
});

// ═══════════════════════════════════════════════════════════
// FORM
// ═══════════════════════════════════════════════════════════
const form = document.getElementById('recipe-form'), formTitle = document.getElementById('form-title');
let recipePhotoFile = null, editingId = null;

function resetForm() {
  form.reset();
  document.getElementById('field-id').value = '';
  document.getElementById('ratio-value').textContent = '—';
  document.getElementById('grind-label-text').textContent = 'Medio';
  document.getElementById('grind-number').textContent = '5/10';
  document.getElementById('field-grind-level').value = 5;
  updateGrindSliderTrack(5);
  recipePhotoFile = null;
  editingId = null;
  document.getElementById('photo-preview').classList.add('hidden');
  document.getElementById('photo-prompt').style.display = '';
  document.getElementById('stages-container').innerHTML = '';
  document.getElementById('stages-hint').classList.remove('hidden');
  stageCount = 0;
  tempUnit = 'C';
  document.querySelectorAll('.temp-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === 'C'));
  document.getElementById('field-date').value = new Date().toISOString().split('T')[0];
  form.querySelector('input[name="visibility"][value="publica"]').checked = true;
  // Ensure method-specific fields are reset
  updateMethodFields();
}
function openNewForm() { resetForm(); editingId = null; formTitle.textContent = 'Nueva Receta'; showAppView('form'); }

async function openEditForm(id) {
  const r = await RecipeStore.get(id); if (!r) return; resetForm(); editingId = id; formTitle.textContent = 'Editar Receta';
  document.getElementById('field-id').value = r.id; document.getElementById('field-name').value = r.nombre || ''; document.getElementById('field-method').value = r.metodo || ''; document.getElementById('field-date').value = r.fecha || ''; document.getElementById('field-notes').value = r.notas || ''; document.getElementById('field-coffee-name').value = r.nombre_cafe || ''; document.getElementById('field-origin').value = r.origen || ''; document.getElementById('field-roaster').value = r.tostador || ''; document.getElementById('field-process').value = r.proceso || ''; document.getElementById('field-grinder').value = r.tipo_molino || ''; document.getElementById('field-grinder-model').value = r.modelo_molino || '';
  const gl = r.clicks_molienda || 5; document.getElementById('field-grind-level').value = gl; document.getElementById('grind-label-text').textContent = GRIND_LABELS[gl] || 'Medio'; document.getElementById('grind-number').textContent = `${gl}/10`; updateGrindSliderTrack(gl);
  document.getElementById('field-grind-setting').value = r.grind_setting || ''; document.getElementById('field-temp').value = r.temperatura || ''; tempUnit = r.temp_unit || 'C'; document.querySelectorAll('.temp-btn').forEach(b => b.classList.toggle('active', b.dataset.unit === tempUnit));   document.getElementById('field-water-quality').value = r.calidad_agua || ''; document.getElementById('field-coffee-grams').value = r.coffee_grams || ''; document.getElementById('field-water-grams').value = r.water_grams || ''; document.getElementById('field-yield-grams').value = r.yield_grams || ''; document.getElementById('field-total-time').value = r.tiempo_total || '';
  document.getElementById('field-moka-model').value = r.moka_model || '';
  document.getElementById('field-moka-cups').value = r.moka_cups != null ? r.moka_cups : '';
  document.getElementById('field-moka-heat-source').value = r.moka_heat_source || '';
  document.getElementById('field-moka-water-temp').value = r.moka_water_temp || '';
  document.getElementById('field-moka-preheated').value = r.moka_preheated === true ? 'yes' : r.moka_preheated === false ? 'no' : '';
  document.getElementById('field-moka-heat-level').value = r.moka_heat_level || '';
  document.getElementById('field-moka-first-drops').value = r.moka_first_drops || '';
  document.getElementById('field-moka-total-time').value = r.moka_total_time || r.tiempo_total || '';
  // Cold Brew fields
  document.getElementById('field-cold-brew-steep-hours').value = r.cold_brew_steep_hours ?? '';
  document.getElementById('field-cold-brew-temp').value = r.cold_brew_temp || '';
  document.getElementById('field-cold-brew-filter').value = r.cold_brew_filter || '';
  document.getElementById('field-cold-brew-concentrate').value = r.cold_brew_concentrate === true ? 'yes' : r.cold_brew_concentrate === false ? 'no' : '';
  document.getElementById('field-cold-brew-dilution').value = r.cold_brew_dilution || '';
  // Chemex fields
  document.getElementById('field-chemex-size').value = r.chemex_size || '';
  document.getElementById('field-chemex-filter').value = r.chemex_filter || '';
  document.getElementById('field-chemex-bloom-time').value = r.chemex_bloom_time_seg ?? '';
  document.getElementById('field-chemex-bloom-water').value = r.chemex_bloom_water_g ?? '';
  document.getElementById('field-chemex-pours').value = r.chemex_pours ?? '';
  // Sifón fields
  document.getElementById('field-siphon-steep').value = r.siphon_steep_seg ?? '';
  document.getElementById('field-siphon-heat-source').value = r.siphon_heat_source || '';
  document.getElementById('field-siphon-stir-method').value = r.siphon_stir_method || '';
  document.getElementById('field-siphon-stirs').value = r.siphon_stirs ?? '';
  updateMethodFields();
  if (r.tueste) { const rad = form.querySelector(`input[name="roast"][value="${r.tueste}"]`); if (rad) rad.checked = true; }
  if (r.visibilidad) { const vr = form.querySelector(`input[name="visibility"][value="${r.visibilidad}"]`); if (vr) vr.checked = true; }
  if (r.foto_url) { document.getElementById('photo-preview').src = r.foto_url; document.getElementById('photo-preview').classList.remove('hidden'); document.getElementById('photo-prompt').style.display = 'none'; }
  updateRatio(); (r.etapas || []).forEach(s => addStage(s)); showAppView('form');
}

// Photo
const photoDrop = document.getElementById('photo-drop'), photoInput = document.getElementById('field-photo');
photoDrop.addEventListener('click', () => photoInput.click());
photoDrop.addEventListener('dragover', e => { e.preventDefault(); photoDrop.classList.add('drag-over'); });
photoDrop.addEventListener('dragleave', () => photoDrop.classList.remove('drag-over'));
photoDrop.addEventListener('drop', e => { e.preventDefault(); photoDrop.classList.remove('drag-over'); if (e.dataTransfer.files[0]) previewRecipePhoto(e.dataTransfer.files[0]); });
photoInput.addEventListener('change', () => { if (photoInput.files[0]) previewRecipePhoto(photoInput.files[0]); });
function previewRecipePhoto(file) { recipePhotoFile = file; const reader = new FileReader(); reader.onload = e => { document.getElementById('photo-preview').src = e.target.result; document.getElementById('photo-preview').classList.remove('hidden'); document.getElementById('photo-prompt').style.display = 'none'; }; reader.readAsDataURL(file); }

// Ratio & method-specific fields
function isEspressoMethod() {
  return document.getElementById('field-method').value === 'Espresso';
}
function isFrenchPressMethod() {
  return document.getElementById('field-method').value === 'French Press';
}
function isAeroPressMethod() {
  return document.getElementById('field-method').value === 'AeroPress';
}
function isMokaMethod() {
  return document.getElementById('field-method').value === 'Moka';
}
function isColdBrewMethod() {
  return document.getElementById('field-method').value === 'Cold Brew';
}

function isChemexMethod() {
  return document.getElementById('field-method').value === 'Chemex';
}

function isSiphonMethod() {
  return document.getElementById('field-method').value === 'Sifón';
}

function updateBloomFields() {
  const bloomSelect = document.getElementById('field-bloom');
  const yes = bloomSelect && bloomSelect.value === 'yes';
  document.querySelectorAll('.fp-bloom-extra').forEach(el => el.classList.toggle('hidden', !yes));
}

function updateCrustFields() {
  const crustSelect = document.getElementById('field-break-crust');
  const yes = crustSelect && crustSelect.value === 'yes';
  document.querySelectorAll('.fp-crust-extra').forEach(el => el.classList.toggle('hidden', !yes));
}

function updateMethodFields() {
  const espresso = isEspressoMethod();
  const french = isFrenchPressMethod();
  const aeropress = isAeroPressMethod();
  const moka = isMokaMethod();
  const coldBrew = isColdBrewMethod();
  const chemex = isChemexMethod();
  const siphon = isSiphonMethod();

  const waterGroup = document.getElementById('group-water-grams');
  const waterQualityGroup = document.getElementById('group-water-quality');
  const totalTimeGroup = document.getElementById('group-total-time');
  const espressoSection = document.getElementById('espresso-section');
  const yieldInput = document.getElementById('field-yield-grams');
  const waterInput = document.getElementById('field-water-grams');
  const yieldGroup = document.getElementById('field-yield-grams')?.closest('.field-group');
  const ratioWrap = document.getElementById('ratio-display-wrap');
  const tempFieldGroup = document.getElementById('field-temp')?.closest('.field-group');

  // Espresso-specific visibility
  if (espressoSection) espressoSection.classList.toggle('hidden', !espresso);
  document.querySelectorAll('.espresso-only').forEach(el => el.classList.toggle('hidden', !espresso));

  // French Press–specific visibility
  document.querySelectorAll('.fp-only').forEach(el => el.classList.toggle('hidden', !french));
  updateBloomFields();
  updateCrustFields();

  // AeroPress–specific visibility
  document.querySelectorAll('.ap-only').forEach(el => el.classList.toggle('hidden', !aeropress));

  // Moka-specific visibility
  document.querySelectorAll('.moka-only').forEach(el => el.classList.toggle('hidden', !moka));
  if (ratioWrap) ratioWrap.classList.toggle('hidden', moka);

  // Cold Brew–specific visibility
  document.querySelectorAll('.cold-brew-only').forEach(el => el.classList.toggle('hidden', !coldBrew));
  const concentrateSelect = document.getElementById('field-cold-brew-concentrate');
  const dilutionYes = concentrateSelect && concentrateSelect.value === 'yes';
  document.querySelectorAll('.cold-brew-dilution-extra').forEach(el => el.classList.toggle('hidden', !coldBrew || !dilutionYes));

  // Water grams: hidden for espresso and Moka
  if (waterGroup) waterGroup.classList.toggle('hidden', espresso || moka);

  // Water quality + total time: hidden for espresso, French Press, AeroPress, and Moka
  const hideWaterMeta = espresso || french || aeropress || moka || coldBrew || chemex || siphon;
  if (waterQualityGroup) waterQualityGroup.classList.toggle('hidden', hideWaterMeta);
  if (totalTimeGroup) totalTimeGroup.classList.toggle('hidden', hideWaterMeta);

  // Yield group: hidden for French Press, AeroPress, Moka, Cold Brew, Chemex, and Sifón
  if (yieldGroup) yieldGroup.classList.toggle('hidden', french || aeropress || moka || coldBrew || chemex || siphon);

  // Temperature field: hidden for Cold Brew
  if (tempFieldGroup) tempFieldGroup.classList.toggle('hidden', coldBrew);

  // Required flags
  if (yieldInput) yieldInput.required = espresso;     // required only for espresso
  if (waterInput) waterInput.required = !espresso && !moka;

  // Chemex/Sifón visibility
  document.querySelectorAll('.chemex-only').forEach(el => el.classList.toggle('hidden', !chemex));
  document.querySelectorAll('.siphon-only').forEach(el => el.classList.toggle('hidden', !siphon));

  updateRatio();
}
function updateRatio() {
  const c = parseFloat(document.getElementById('field-coffee-grams').value);
  const w = parseFloat(document.getElementById('field-water-grams').value);
  const y = parseFloat(document.getElementById('field-yield-grams').value);
  let ratio = null;
  if (isEspressoMethod()) {
    if (c > 0 && y > 0) ratio = (y / c).toFixed(1);
  } else {
    if (c > 0 && w > 0) ratio = (w / c).toFixed(1);
  }
  document.getElementById('ratio-value').textContent = ratio || '—';
}
document.getElementById('field-coffee-grams').addEventListener('input', updateRatio);
document.getElementById('field-water-grams').addEventListener('input', updateRatio);
document.getElementById('field-yield-grams').addEventListener('input', updateRatio);

// French Press bloom/crust toggles
document.getElementById('field-bloom')?.addEventListener('change', updateBloomFields);
document.getElementById('field-break-crust')?.addEventListener('change', updateCrustFields);
// Cold Brew concentrate toggle
document.getElementById('field-cold-brew-concentrate')?.addEventListener('change', updateMethodFields);

// Grind
const grindSlider = document.getElementById('field-grind-level');
function updateGrindSliderTrack(v) { const p = ((v - 1) / 9) * 100; grindSlider.style.background = `linear-gradient(to right,var(--accent) 0%,var(--accent) ${p}%,var(--bg-3) ${p}%,var(--bg-3) 100%)`; }
grindSlider.addEventListener('input', () => { const v = +grindSlider.value; document.getElementById('grind-label-text').textContent = GRIND_LABELS[v]; document.getElementById('grind-number').textContent = `${v}/10`; updateGrindSliderTrack(v); });
updateGrindSliderTrack(5);

// Temp toggle
document.querySelectorAll('.temp-btn').forEach(b => b.addEventListener('click', () => { const nu = b.dataset.unit; if (nu === tempUnit) return; const v = parseFloat(document.getElementById('field-temp').value); if (!isNaN(v)) document.getElementById('field-temp').value = nu === 'F' ? Math.round(v * 9 / 5 + 32) : Math.round((v - 32) * 5 / 9); tempUnit = nu; document.querySelectorAll('.temp-btn').forEach(x => x.classList.toggle('active', x.dataset.unit === tempUnit)); }));

// Stages
function addStage(data = {}) { stageCount++; const n = stageCount; document.getElementById('stages-hint').classList.add('hidden'); const card = document.createElement('div'); card.className = 'stage-card'; card.dataset.stage = n; card.innerHTML = `<div class="stage-header"><div class="stage-number">${n}</div><div class="stage-header-title">Etapa ${n}</div><button type="button" class="btn-remove-stage">✕</button></div><div class="stage-fields"><div class="stage-field"><label>Duración</label><input type="text" name="stage-duration-${n}" placeholder="0:30" value="${esc(data.duration || '')}" /></div><div class="stage-field"><label>Vertido (g)</label><input type="number" name="stage-pour-${n}" placeholder="60" min="0" value="${esc(data.pour || '')}" /></div><div class="stage-field"><label>Temp</label><input type="text" name="stage-temp-${n}" placeholder="93°C" value="${esc(data.temp || '')}" /></div><div class="stage-field stage-notes"><label>Notas</label><input type="text" name="stage-notes-${n}" placeholder="Pre-infusión…" value="${esc(data.notes || '')}" /></div></div>`; card.querySelector('.btn-remove-stage').addEventListener('click', () => { card.remove(); const rem = document.querySelectorAll('.stage-card'); if (!rem.length) document.getElementById('stages-hint').classList.remove('hidden'); rem.forEach((c, i) => { c.querySelector('.stage-number').textContent = i + 1; c.querySelector('.stage-header-title').textContent = `Etapa ${i + 1}`; }); stageCount = rem.length; }); document.getElementById('stages-container').appendChild(card); }
document.getElementById('btn-add-stage').addEventListener('click', () => addStage());

// Submit
form.addEventListener('submit', async e => {
  e.preventDefault(); const nombre = document.getElementById('field-name').value.trim(), metodo = document.getElementById('field-method').value;
  if (!nombre) { showToast('¿Cómo se llama esta receta?', 'error'); return; } if (!metodo) { showToast('¿Con qué la preparaste?', 'error'); return; }
  const stageCards = document.querySelectorAll('.stage-card');
  const etapas = Array.from(stageCards).map((c, i) => { const n = c.dataset.stage; return { name: `Etapa ${i + 1}`, duration: c.querySelector(`[name="stage-duration-${n}"]`)?.value.trim() || '', pour: c.querySelector(`[name="stage-pour-${n}"]`)?.value || '', temp: c.querySelector(`[name="stage-temp-${n}"]`)?.value.trim() || '', notes: c.querySelector(`[name="stage-notes-${n}"]`)?.value.trim() || '' }; });
  const rc = form.querySelector('input[name="roast"]:checked');
  const visRadio = form.querySelector('input[name="visibility"]:checked');
  const cg = document.getElementById('field-coffee-grams').value;
  const wg = document.getElementById('field-water-grams').value;
  const yg = document.getElementById('field-yield-grams').value;
  const mokaTotal = document.getElementById('field-moka-total-time')?.value.trim() || null;
  const coldBrewSteepHours = document.getElementById('field-cold-brew-steep-hours')?.value.trim() || null;
  const coldBrewTotalTime = coldBrewSteepHours ? `${coldBrewSteepHours} h` : null;
  const chemexBloomTime = document.getElementById('field-chemex-bloom-time')?.value.trim() || null;
  const chemexBloomWater = document.getElementById('field-chemex-bloom-water')?.value.trim() || null;
  const chemexPours = document.getElementById('field-chemex-pours')?.value.trim() || null;
  const siphonSteep = document.getElementById('field-siphon-steep')?.value.trim() || null;
  const siphonStirs = document.getElementById('field-siphon-stirs')?.value.trim() || null;
  let ratioVal = null;
  if (isEspressoMethod()) {
    if (parseFloat(cg) > 0 && parseFloat(yg) > 0) {
      ratioVal = `1:${(parseFloat(yg) / parseFloat(cg)).toFixed(1)}`;
    }
  } else if (!isMokaMethod() && parseFloat(cg) > 0 && parseFloat(wg) > 0) {
    ratioVal = `1:${(parseFloat(wg) / parseFloat(cg)).toFixed(1)}`;
  }

  const btn = document.getElementById('btn-save'); btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    let foto_url = editingId ? (await RecipeStore.get(editingId))?.foto_url : null;
    if (recipePhotoFile) foto_url = await uploadRecipePhoto(recipePhotoFile);

    const row = {
      nombre,
      metodo,
      perfil_id: uid(),
      visibilidad: visRadio?.value || 'publica',
      fecha: document.getElementById('field-date').value || null,
      notas: document.getElementById('field-notes').value.trim() || null,
      nombre_cafe: document.getElementById('field-coffee-name').value.trim() || null,
      origen: document.getElementById('field-origin').value.trim() || null,
      tostador: document.getElementById('field-roaster').value.trim() || null,
      proceso: document.getElementById('field-process').value || null,
      tueste: rc?.value || null,
      foto_url,
      tipo_molino: document.getElementById('field-grinder').value || null,
      modelo_molino: document.getElementById('field-grinder-model').value.trim() || null,
      clicks_molienda: parseInt(document.getElementById('field-grind-level').value) || null,
      grind_setting: document.getElementById('field-grind-setting').value.trim() || null,
      temperatura: isColdBrewMethod() ? null : (document.getElementById('field-temp').value || null),
      temp_unit: isColdBrewMethod() ? null : tempUnit,
      calidad_agua: isMokaMethod() || isColdBrewMethod() || isChemexMethod() || isSiphonMethod()
        ? null
        : (document.getElementById('field-water-quality').value || null),
      coffee_grams: cg || null,
      water_grams: isMokaMethod() ? null : (wg || null),
      ratio: isMokaMethod() ? null : ratioVal,
      yield_grams: isMokaMethod() || isColdBrewMethod() || isChemexMethod() || isSiphonMethod()
        ? null
        : (yg || null),
      tiempo_total: (isEspressoMethod()
        ? document.getElementById('field-extraction-time').value.trim() || null
        : isMokaMethod()
          ? mokaTotal
          : isColdBrewMethod()
            ? coldBrewTotalTime
            : (isChemexMethod() || isSiphonMethod())
              ? null
              : document.getElementById('field-total-time').value.trim() || null),
      maquina: document.getElementById('field-machine').value.trim() || null,
      presion_bars: document.getElementById('field-pressure').value || null,
      pre_infusion_seg: document.getElementById('field-preinfusion').value || null,
      // French Press fields
      bloom: document.getElementById('field-bloom')?.value === 'yes' || null,
      bloom_time_seg: document.getElementById('field-bloom-time')?.value || null,
      bloom_water_g: document.getElementById('field-bloom-water')?.value || null,
      steeping_time_min: document.getElementById('field-steeping-time')?.value || null,
      break_crust: document.getElementById('field-break-crust')?.value === 'yes' || null,
      break_crust_time_seg: document.getElementById('field-crust-extra-time')?.value || null,
      // AeroPress fields
      aeropress_position: document.getElementById('field-ap-position')?.value || null,
      aeropress_steep_seg: document.getElementById('field-ap-steep')?.value || null,
      aeropress_press_seg: document.getElementById('field-ap-press')?.value || null,
      aeropress_filter: document.getElementById('field-ap-filter')?.value || null,
      moka_model: isMokaMethod() ? (document.getElementById('field-moka-model')?.value.trim() || null) : null,
      moka_cups: isMokaMethod() && document.getElementById('field-moka-cups')?.value ? parseInt(document.getElementById('field-moka-cups').value, 10) : null,
      moka_heat_source: isMokaMethod() ? (document.getElementById('field-moka-heat-source')?.value || null) : null,
      moka_water_temp: isMokaMethod() ? (document.getElementById('field-moka-water-temp')?.value || null) : null,
      moka_preheated: isMokaMethod()
        ? (document.getElementById('field-moka-preheated')?.value === 'yes' ? true : document.getElementById('field-moka-preheated')?.value === 'no' ? false : null)
        : null,
      moka_heat_level: isMokaMethod() ? (document.getElementById('field-moka-heat-level')?.value || null) : null,
      moka_first_drops: isMokaMethod() ? (document.getElementById('field-moka-first-drops')?.value.trim() || null) : null,
      moka_total_time: isMokaMethod() ? mokaTotal : null,
      // Cold Brew fields
      cold_brew_steep_hours: isColdBrewMethod() ? (coldBrewSteepHours ? parseFloat(coldBrewSteepHours) : null) : null,
      cold_brew_temp: isColdBrewMethod() ? (document.getElementById('field-cold-brew-temp')?.value || null) : null,
      cold_brew_filter: isColdBrewMethod() ? (document.getElementById('field-cold-brew-filter')?.value || null) : null,
      cold_brew_concentrate: isColdBrewMethod()
        ? (document.getElementById('field-cold-brew-concentrate')?.value === 'yes'
          ? true
          : document.getElementById('field-cold-brew-concentrate')?.value === 'no'
            ? false
            : null)
        : null,
      cold_brew_dilution: isColdBrewMethod() && document.getElementById('field-cold-brew-concentrate')?.value === 'yes'
        ? (document.getElementById('field-cold-brew-dilution')?.value.trim() || null)
        : null,
      // Chemex fields
      chemex_size: isChemexMethod() ? document.getElementById('field-chemex-size')?.value || null : null,
      chemex_filter: isChemexMethod() ? document.getElementById('field-chemex-filter')?.value || null : null,
      chemex_bloom_time_seg: isChemexMethod() ? (chemexBloomTime ? parseInt(chemexBloomTime, 10) : null) : null,
      chemex_bloom_water_g: isChemexMethod() ? (chemexBloomWater ? parseFloat(chemexBloomWater) : null) : null,
      chemex_pours: isChemexMethod() ? (chemexPours ? parseInt(chemexPours, 10) : null) : null,
      // Sifón fields
      siphon_steep_seg: isSiphonMethod() ? (siphonSteep ? parseInt(siphonSteep, 10) : null) : null,
      siphon_heat_source: isSiphonMethod() ? document.getElementById('field-siphon-heat-source')?.value || null : null,
      siphon_stir_method: isSiphonMethod() ? document.getElementById('field-siphon-stir-method')?.value || null : null,
      siphon_stirs: isSiphonMethod() ? (siphonStirs ? parseInt(siphonStirs, 10) : null) : null,
      etapas
    };
    if (editingId) await RecipeStore.update(editingId, row); else await RecipeStore.insert(row);
    showToast(editingId ? '¡Receta actualizada! ☕' : '¡Receta en el menú! ☕', 'success'); await renderFeed(); showAppView('feed');
  } catch (err) { console.error(err); showToast('Algo salió mal, intenta de nuevo', 'error'); }
  btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 20 20" fill="none"><path d="M5 10l4.5 4.5L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Publicar';
});

// ═══════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════
const modal = document.getElementById('detail-modal'); let modalRecipeId = null;

async function openModal(id) {
  const r = await RecipeStore.get(id); if (!r) return; modalRecipeId = id;
  // Deep link: update URL to /recipe/[id] without reload
  try {
    const targetPath = `/recipe/${id}`;
    if (window.location.pathname !== targetPath) {
      history.pushState({ recipeId: id }, '', targetPath);
    }
  } catch {}
  const wrap = document.getElementById('modal-photo-wrap'), img = document.getElementById('modal-photo');
  if (r.foto_url) { img.src = r.foto_url; wrap.classList.remove('hidden'); } else wrap.classList.add('hidden');
  const author = r.perfil_id ? await getProfile(r.perfil_id) : null;
  document.getElementById('modal-author').innerHTML = author ? `<div class="modal-author-inner" data-uid="${author.id}"><div class="modal-author-av">${author.foto_perfil ? `<img src="${author.foto_perfil}" alt="">` : `<span>${author.display_name[0].toUpperCase()}</span>`}</div><span>${esc(author.display_name)}</span></div>` : '';
  const aEl = document.querySelector('.modal-author-inner'); if (aEl) aEl.addEventListener('click', () => { closeModal(); openProfileView(aEl.dataset.uid); });
  document.getElementById('modal-method-badge').textContent = r.metodo || '';
  document.getElementById('modal-vis-badge').textContent = VIS_LABELS[r.visibilidad] || '';
  document.getElementById('modal-vis-badge').className = `modal-vis-badge vis-${r.visibilidad || 'publica'}`;
  document.getElementById('modal-title').textContent = r.nombre;
  // Show edit/delete only for own recipes
  const isOwner = r.perfil_id === uid();
  document.getElementById('btn-modal-edit').style.display = isOwner ? '' : 'none';
  document.getElementById('btn-modal-delete').style.display = isOwner ? '' : 'none';
  const [likeCount, isLiked, saveCount, isSaved] = await Promise.all([LikeStore.count(id), LikeStore.isLiked(id), SaveStore.count(id), SaveStore.isSaved(id)]);
  document.getElementById('modal-like-count').textContent = likeCount;
  document.getElementById('modal-save-count').textContent = saveCount;
  const likeBtn = document.getElementById('btn-modal-like'); likeBtn.classList.toggle('liked', isLiked); likeBtn.querySelector('svg path').setAttribute('fill', isLiked ? 'currentColor' : 'none');
  const saveBtn = document.getElementById('btn-modal-save'); saveBtn.classList.toggle('saved', isSaved); saveBtn.querySelector('svg path').setAttribute('fill', isSaved ? 'currentColor' : 'none');
  const mp = []; if (r.created_at) mp.push(fmtDate(r.created_at)); if (r.tostador) mp.push(r.tostador);
  document.getElementById('modal-meta').textContent = mp.join(' · ');
  const cg = parseFloat(r.coffee_grams), wg = parseFloat(r.water_grams); const ratio = (cg > 0 && wg > 0) ? `1:${(wg / cg).toFixed(1)}` : null;
  const cbTemp = r.cold_brew_temp === 'room' ? 'Ambiente' : r.cold_brew_temp === 'fridge' ? 'Heladera' : '';
  const cbFilter = r.cold_brew_filter === 'paper' ? 'Papel' : r.cold_brew_filter === 'cloth' ? 'Tela' : r.cold_brew_filter === 'metal' ? 'Metal' : r.cold_brew_filter === 'none' ? 'Ninguno' : '';
  const cbConcentrate = r.cold_brew_concentrate === true ? 'Sí' : r.cold_brew_concentrate === false ? 'No' : '';
  const cbDilution = r.cold_brew_concentrate === true ? (r.cold_brew_dilution || '—') : '—';

  const hasVal = v => v !== null && v !== undefined && String(v).trim() !== '';
  const yesNo = v => v === true ? 'Sí' : v === false ? 'No' : '—';

  const espressoChips = r.metodo === 'Espresso'
    ? [
      { icon: '⚙️', label: 'Máquina', value: r.maquina || '—' },
      { icon: '🌡️', label: 'Presión', value: hasVal(r.presion_bars) ? `${r.presion_bars} bar` : '—' },
      { icon: '⏳', label: 'Pre-infusión (seg)', value: hasVal(r.pre_infusion_seg) ? `${r.pre_infusion_seg} seg` : '—' },
      { icon: '⏱️', label: 'Extracción', value: hasVal(r.tiempo_total) ? `${r.tiempo_total}` : '—' }
    ]
    : [];

  const frenchChips = r.metodo === 'French Press'
    ? [
      { icon: '🫧', label: '¿Hiciste bloom?', value: yesNo(r.bloom) },
      { icon: '⏳', label: 'Tiempo de bloom (seg)', value: hasVal(r.bloom_time_seg) ? `${r.bloom_time_seg} seg` : '—' },
      { icon: '💧', label: 'Agua de bloom (g)', value: hasVal(r.bloom_water_g) ? `${r.bloom_water_g} g` : '—' },
      { icon: '⏱️', label: 'Tiempo de infusión (min)', value: hasVal(r.steeping_time_min) ? `${r.steeping_time_min} min` : '—' },
      { icon: '🫧', label: '¿Rompiste la costra?', value: yesNo(r.break_crust) },
      { icon: '⏳', label: 'Tiempo extra post-costra (seg)', value: hasVal(r.break_crust_time_seg) ? `${r.break_crust_time_seg} seg` : '—' }
    ]
    : [];

  const aeroChips = r.metodo === 'AeroPress'
    ? [
      { icon: '🧠', label: 'Posición', value: r.aeropress_position ? (r.aeropress_position === 'normal' ? 'Normal' : 'Invertida') : '—' },
      { icon: '⏱️', label: 'Tiempo de infusión (seg)', value: hasVal(r.aeropress_steep_seg) ? `${r.aeropress_steep_seg} seg` : '—' },
      { icon: '⏱️', label: 'Tiempo de presión (seg)', value: hasVal(r.aeropress_press_seg) ? `${r.aeropress_press_seg} seg` : '—' },
      { icon: '🧫', label: 'Tipo de filtro', value: r.aeropress_filter ? (r.aeropress_filter === 'paper' ? 'Papel' : r.aeropress_filter === 'metal' ? 'Metal' : r.aeropress_filter === 'cloth' ? 'Tela' : r.aeropress_filter) : '—' }
    ]
    : [];

  const mokaChips = r.metodo === 'Moka'
    ? [
      { icon: '⚙️', label: 'Modelo', value: r.moka_model || '—' },
      { icon: '☕', label: 'Tazas', value: hasVal(r.moka_cups) ? `${r.moka_cups}` : '—' },
      { icon: '🔥', label: 'Fuente de calor', value: r.moka_heat_source ? (r.moka_heat_source === 'gas' ? 'Gas' : r.moka_heat_source === 'electric' ? 'Eléctrica' : r.moka_heat_source) : '—' },
      { icon: '🌡️', label: 'Temperatura del agua', value: r.moka_water_temp ? (r.moka_water_temp === 'cold' ? 'Fría' : r.moka_water_temp === 'warm' ? 'Tibia' : r.moka_water_temp === 'hot' ? 'Caliente' : r.moka_water_temp === 'boiling' ? 'Hirviendo' : r.moka_water_temp) : '—' },
      { icon: '🫧', label: '¿Precalentaste el agua?', value: yesNo(r.moka_preheated) },
      { icon: '🔥', label: 'Nivel de calor', value: r.moka_heat_level ? (r.moka_heat_level === 'low' ? 'Bajo' : r.moka_heat_level === 'medium' ? 'Medio' : r.moka_heat_level === 'high' ? 'Alto' : r.moka_heat_level) : '—' },
      { icon: '⏱️', label: 'Tiempo hasta primeras gotas', value: r.moka_first_drops || '—' }
    ]
    : [];

  const coldChips = r.metodo === 'Cold Brew'
    ? [
      { icon: '🫧', label: 'Infusión (h)', value: hasVal(r.cold_brew_steep_hours) ? `${r.cold_brew_steep_hours} h` : '—' },
      { icon: '🌡️', label: 'Temperatura de infusión', value: cbTemp || '—' },
      { icon: '🧫', label: 'Tipo de filtro', value: cbFilter || '—' },
      { icon: '🧊', label: '¿Es concentrado?', value: cbConcentrate || '—' },
      { icon: '🧪', label: 'Ratio de dilución', value: cbDilution || '—' }
    ]
    : [];

  const chemexChips = r.metodo === 'Chemex'
    ? [
      { icon: '🫙', label: 'Tamaño Chemex', value: hasVal(r.chemex_size) ? `${r.chemex_size} tazas` : '—' },
      { icon: '🧫', label: 'Tipo de filtro', value: r.chemex_filter ? (r.chemex_filter === 'square' ? 'Square' : r.chemex_filter === 'circle' ? 'Circle' : r.chemex_filter === 'half moon' ? 'Half moon' : r.chemex_filter) : '—' },
      { icon: '⏳', label: 'Tiempo de bloom (seg)', value: hasVal(r.chemex_bloom_time_seg) ? `${r.chemex_bloom_time_seg} seg` : '—' },
      { icon: '💧', label: 'Agua de bloom (g)', value: hasVal(r.chemex_bloom_water_g) ? `${r.chemex_bloom_water_g} g` : '—' },
      { icon: '↕️', label: 'Número de vertidos', value: hasVal(r.chemex_pours) ? `${r.chemex_pours}` : '—' }
    ]
    : [];

  const siphonChips = r.metodo === 'Sifón'
    ? [
      { icon: '⏱️', label: 'Tiempo en cámara superior (seg)', value: hasVal(r.siphon_steep_seg) ? `${r.siphon_steep_seg} seg` : '—' },
      { icon: '🔥', label: 'Fuente de calor', value: r.siphon_heat_source ? (r.siphon_heat_source === 'alcohol' ? 'Alcohol' : r.siphon_heat_source === 'butane' ? 'Butane' : r.siphon_heat_source === 'electric' ? 'Eléctrica' : r.siphon_heat_source === 'halogen' ? 'Halógena' : r.siphon_heat_source) : '—' },
      { icon: '🪄', label: 'Tipo de paleta', value: r.siphon_stir_method ? (r.siphon_stir_method === 'bamboo' ? 'Bambú' : r.siphon_stir_method === 'metal' ? 'Metal' : r.siphon_stir_method === 'glass' ? 'Vidrio' : r.siphon_stir_method) : '—' },
      { icon: '↕️', label: 'Número de movimientos', value: hasVal(r.siphon_stirs) ? `${r.siphon_stirs}` : '—' }
    ]
    : [];

  const params = [
    { icon: '🫘', label: 'Café', value: r.nombre_cafe || '—' },
    { icon: '🌍', label: 'Origen', value: r.origen || '—' },
    { icon: '🔥', label: 'Tueste', value: r.tueste || '—' },
    { icon: '🧪', label: 'Proceso', value: r.proceso || '—' },
    { icon: '⚙️', label: 'Molino', value: r.modelo_molino || r.tipo_molino || '—' },
    { icon: '📏', label: 'Molienda', value: r.clicks_molienda ? `${GRIND_LABELS[r.clicks_molienda] || ''} (${r.clicks_molienda}/10)` : '—' },
    { icon: '⚖️', label: 'Café', value: cg ? `${cg}g` : '—' },
    { icon: '💧', label: 'Agua', value: wg ? `${wg}g` : '—' },
    { icon: '📊', label: 'Ratio', value: ratio || '—', hl: true },
    { icon: '🌡️', label: 'Temp.', value: r.temperatura ? `${r.temperatura}°${r.temp_unit || 'C'}` : '—' },
    { icon: '🥛', label: 'Agua', value: r.calidad_agua || '—' },
    { icon: '⏱️', label: 'Tiempo', value: r.tiempo_total || '—' },
    ...espressoChips,
    ...frenchChips,
    ...aeroChips,
    ...mokaChips,
    ...coldChips,
    ...chemexChips,
    ...siphonChips
  ];
  document.getElementById('modal-params').innerHTML = params.filter(p => p.value !== '—').map(p => `<div class="param-chip"><div class="param-chip-icon">${p.icon}</div><div class="param-chip-label">${esc(p.label)}</div><div class="param-chip-value${p.hl ? ' highlight' : ''}">${esc(p.value)}</div></div>`).join('');
  const sw = document.getElementById('modal-stages-wrap'), se = document.getElementById('modal-stages');
  if (r.etapas?.length) { se.innerHTML = r.etapas.map((s, i) => `<div class="timeline-step"><div class="timeline-dot"><div class="timeline-dot-circle">${i + 1}</div><div class="timeline-dot-line"></div></div><div class="timeline-body"><div class="timeline-step-name">${esc(s.name)}</div>${s.pour ? `<div class="timeline-notes">Vertido: ${esc(s.pour)}g${s.temp ? ' · ' + esc(s.temp) : ''}</div>` : ''}${s.notes ? `<div class="timeline-notes">${esc(s.notes)}</div>` : ''}</div><div class="timeline-time">${esc(s.duration || '')}</div></div>`).join(''); sw.classList.remove('hidden'); } else sw.classList.add('hidden');
  const nw = document.getElementById('modal-notes-wrap'); if (r.notas) { document.getElementById('modal-notes-text').textContent = r.notas; nw.classList.remove('hidden'); } else nw.classList.add('hidden');
  await loadComments(id);
  modal.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}

let replyToCommentId = null, replyToAuthorName = null;

function setReplyTo(commentId, authorName) {
  replyToCommentId = commentId;
  replyToAuthorName = authorName;
  const indicator = document.getElementById('comment-reply-indicator');
  document.getElementById('comment-reply-to').textContent = `↩ Respondiendo a ${authorName}`;
  indicator.classList.remove('hidden');
  document.getElementById('comment-input').focus();
  document.getElementById('comment-input').placeholder = `Responder a ${authorName}…`;
}

function clearReplyTo() {
  replyToCommentId = null;
  replyToAuthorName = null;
  document.getElementById('comment-reply-indicator').classList.add('hidden');
  document.getElementById('comment-input').placeholder = 'Escribe un comentario…';
}

document.getElementById('btn-cancel-reply').addEventListener('click', clearReplyTo);

async function loadComments(recetaId) {
  const comments = await CommentStore.list(recetaId);
  document.getElementById('comment-count-badge').textContent = comments.length;
  // Fetch like data for each comment
  const likeCounts = await Promise.all(comments.map(c => CommentLikeStore.count(c.id)));
  const myCommentLikes = uid() ? await Promise.all(comments.map(c => CommentLikeStore.isLiked(c.id))) : comments.map(() => false);
  // Separate parents and replies
  const parents = comments.filter(c => !c.parent_id);
  const repliesByParent = {};
  comments.filter(c => c.parent_id).forEach(c => { (repliesByParent[c.parent_id] = repliesByParent[c.parent_id] || []).push(c); });
  const commentIndexMap = {};
  comments.forEach((c, i) => { commentIndexMap[c.id] = i; });

  function renderComment(c, isReply) {
    const u = c.perfiles;
    const idx = commentIndexMap[c.id];
    const lc = likeCounts[idx] || 0;
    const il = myCommentLikes[idx] || false;
    return `<div class="comment-item${isReply ? ' reply' : ''}" data-comment-id="${c.id}"><div class="comment-avatar">${u?.foto_perfil ? `<img src="${u.foto_perfil}" alt="">` : `<span>${(u?.display_name || '?')[0].toUpperCase()}</span>`}</div><div class="comment-body"><div class="comment-header"><span class="comment-author">${esc(u?.display_name || 'Anónimo')}</span><span class="comment-time">${timeAgo(c.created_at)}</span></div><p class="comment-text">${esc(c.contenido)}</p><div class="comment-actions"><button class="comment-action-btn comment-like-btn${il ? ' liked' : ''}" data-cid="${c.id}"><svg viewBox="0 0 20 20" fill="${il ? 'currentColor' : 'none'}"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>${lc}</span></button><button class="comment-action-btn comment-reply-btn" data-cid="${c.id}" data-author="${esc(u?.display_name || 'Anónimo')}">Responder</button></div></div></div>`;
  }

  let html = '';
  parents.forEach(c => {
    html += renderComment(c, false);
    (repliesByParent[c.id] || []).forEach(r => { html += renderComment(r, true); });
  });
  // Orphan replies (parent deleted)
  comments.filter(c => c.parent_id && !comments.find(p => p.id === c.parent_id && !p.parent_id)).forEach(c => {
    if (!parents.find(p => p.id === c.id) && !Object.values(repliesByParent).flat().find(r => r.id === c.id)) html += renderComment(c, true);
  });

  const list = document.getElementById('comments-list');
  list.innerHTML = html || '<p class="no-comments">Sin comentarios aún. ¡Sé el primero!</p>';

  // Attach comment like handlers
  list.querySelectorAll('.comment-like-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!requireAuth()) return;
      try {
        const cid = btn.dataset.cid;
        const res = await CommentLikeStore.toggle(cid);
        btn.querySelector('span').textContent = res.count;
        btn.classList.toggle('liked', res.liked);
        btn.querySelector('svg path').setAttribute('fill', res.liked ? 'currentColor' : 'none');
        // Notify comment author
        if (res.liked) {
          const comment = comments.find(c => c.id === cid);
          if (comment?.perfil_id) NotificationStore.create(comment.perfil_id, 'comment_like', recetaId, cid);
        }
      } catch { showToast('Error', 'error'); }
    });
  });

  // Attach reply handlers
  list.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setReplyTo(btn.dataset.cid, btn.dataset.author);
    });
  });

  clearReplyTo();
}

document.getElementById('btn-send-comment').addEventListener('click', async () => {
  if (!requireAuth()) return;
  const input = document.getElementById('comment-input');
  const t = input.value.trim();
  if (!t) return;
  try {
    const newComment = await CommentStore.add(modalRecipeId, t, replyToCommentId);
    // Notify parent comment author on replies
    if (replyToCommentId) {
      const allComments = await CommentStore.list(modalRecipeId);
      const parent = allComments.find(c => c.id === replyToCommentId);
      if (parent?.perfil_id) NotificationStore.create(parent.perfil_id, 'reply', modalRecipeId, newComment?.id);
    }
    input.value = '';
    clearReplyTo();
    await loadComments(modalRecipeId);
  } catch (err) { showToast('Algo salió mal, intenta de nuevo', 'error'); }
});
document.getElementById('comment-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('btn-send-comment').click(); } });
document.getElementById('btn-modal-like').addEventListener('click', async () => {
  if (!requireAuth()) return;
  try {
    const res = await LikeStore.toggle(modalRecipeId);
    document.getElementById('modal-like-count').textContent = res.count;
    const btn = document.getElementById('btn-modal-like');
    btn.classList.toggle('liked', res.liked);
    btn.querySelector('svg path').setAttribute('fill', res.liked ? 'currentColor' : 'none');
    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 400);
    syncCardLikeState(modalRecipeId, res.liked, res.count);
  } catch {
    showToast('Algo salió mal, intenta de nuevo', 'error');
  }
});

document.getElementById('btn-modal-save').addEventListener('click', async () => {
  if (!requireAuth()) return;
  try {
    const res = await SaveStore.toggle(modalRecipeId);
    const btn = document.getElementById('btn-modal-save');
    btn.classList.toggle('saved', res.saved);
    document.getElementById('modal-save-count').textContent = res.count;
    btn.querySelector('svg path').setAttribute('fill', res.saved ? 'currentColor' : 'none');
    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 400);
    syncCardSaveState(modalRecipeId, res.saved, res.count);
    showToast(res.saved ? 'En tu recetario 🔖' : 'Eliminada del recetario', 'success');
  } catch {
    showToast('Algo salió mal, intenta de nuevo', 'error');
  }
});

document.getElementById('btn-modal-share').addEventListener('click', async () => {
  if (!modalRecipeId) return;
  const url = `https://brewed.me/recipe/${modalRecipeId}`;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('Enlace copiado ☕', 'success');
    } else {
      // Fallback: try using a temporary input
      const tmp = document.createElement('input');
      tmp.value = url;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
      showToast('Enlace copiado ☕', 'success');
    }
  } catch (err) {
    showToast('Algo salió mal, intenta de nuevo', 'error');
  }
});

// Sync feed card like button after modal toggle
function syncCardLikeState(recipeId, isLiked, count) {
  const card = grid.querySelector(`.recipe-card[data-id="${recipeId}"]`);
  if (!card) return;
  const btn = card.querySelector('.card-like-btn');
  if (!btn) return;
  btn.classList.toggle('liked', isLiked);
  btn.querySelector('span').textContent = count;
  btn.querySelector('svg path').setAttribute('fill', isLiked ? 'currentColor' : 'none');
}

// Sync feed card save button after modal toggle
function syncCardSaveState(recipeId, isSaved, count) {
  const card = grid.querySelector(`.recipe-card[data-id="${recipeId}"]`);
  if (!card) return;
  const btn = card.querySelector('.card-save-btn');
  if (!btn) return;
  btn.classList.toggle('saved', isSaved);
  btn.querySelector('span').textContent = count;
  btn.querySelector('svg path').setAttribute('fill', isSaved ? 'currentColor' : 'none');
}

function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
  modalRecipeId = null;
  // Restore root URL when modal closes
  try {
    if (window.location.pathname.startsWith('/recipe/')) {
      history.pushState({}, '', '/');
    }
  } catch {}
}
document.getElementById('btn-modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.getElementById('btn-modal-edit').addEventListener('click', () => { const id = modalRecipeId; closeModal(); openEditForm(id); });

// Delete
const confirmOverlay = document.getElementById('confirm-overlay'); let pendingDeleteId = null;
document.getElementById('btn-modal-delete').addEventListener('click', () => { pendingDeleteId = modalRecipeId; confirmOverlay.classList.remove('hidden'); });
document.getElementById('btn-confirm-cancel').addEventListener('click', () => { confirmOverlay.classList.add('hidden'); pendingDeleteId = null; });
document.getElementById('btn-confirm-ok').addEventListener('click', async () => { if (pendingDeleteId) { try { await RecipeStore.delete(pendingDeleteId); confirmOverlay.classList.add('hidden'); closeModal(); await renderFeed(); showToast('Receta eliminada', 'error'); } catch { showToast('Algo salió mal, intenta de nuevo', 'error'); } } });
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) { confirmOverlay.classList.add('hidden'); pendingDeleteId = null; } });

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
const NOTIF_TYPE_META = {
  follow: { icon: '👤', msg: (a) => `<strong>${esc(a)}</strong> te empezó a seguir` },
  like: { icon: '❤️', msg: (a, r) => `<strong>${esc(a)}</strong> le dio like a <strong>${esc(r)}</strong>` },
  comment: { icon: '💬', msg: (a, r) => `<strong>${esc(a)}</strong> comentó en <strong>${esc(r)}</strong>` },
  reply: { icon: '↩️', msg: (a, r) => `<strong>${esc(a)}</strong> respondió a tu comentario en <strong>${esc(r)}</strong>` },
  comment_like: { icon: '💜', msg: (a, r) => `<strong>${esc(a)}</strong> le gustó tu comentario en <strong>${esc(r)}</strong>` },
};

async function refreshNotifBadge() {
  if (!uid()) return;
  try {
    const count = await NotificationStore.unreadCount();
    const badge = document.getElementById('notif-badge');
    if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
  } catch (e) { console.error('Badge refresh error:', e); }
}

async function renderNotifications() {
  const list = document.getElementById('notif-list');
  const empty = document.getElementById('notif-empty');
  list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);font-size:0.85rem;">Cargando…</div>';
  try {
    const notifications = await NotificationStore.list();
    // Auto-mark all as read on page open
    const hasUnread = notifications.some(n => !n.read);
    if (hasUnread) {
      await NotificationStore.markAllRead();
      notifications.forEach(n => n.read = true);
      refreshNotifBadge();
    }
    if (notifications.length === 0) { list.innerHTML = ''; empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    list.innerHTML = notifications.map(n => {
      const actor = n.actor;
      const meta = NOTIF_TYPE_META[n.type] || { icon: '🔔', msg: (a) => `<strong>${esc(a)}</strong> interactuó contigo` };
      const recipeName = n.receta?.nombre || '';
      return `<div class="notif-item" data-nid="${n.id}" data-type="${n.type}" data-recipe="${n.recipe_id || ''}" data-actor="${actor?.id || ''}">
        <div class="notif-avatar">${actor?.foto_perfil ? `<img src="${actor.foto_perfil}" alt="">` : `<span>${(actor?.display_name || '?')[0].toUpperCase()}</span>`}<div class="notif-type-icon type-${n.type}">${meta.icon}</div></div>
        <div class="notif-body"><div class="notif-text">${meta.msg(actor?.display_name || 'Alguien', recipeName)}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div>
      </div>`;
    }).join('');

    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const type = item.dataset.type;
        const recipeId = item.dataset.recipe;
        const actorId = item.dataset.actor;
        // Navigate
        if (type === 'follow' && actorId) openProfileView(actorId);
        else if (recipeId) openModal(recipeId);
      });
    });
  } catch (err) { console.error(err); list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-3);">Error cargando notificaciones</div>'; }
}

document.getElementById('btn-mark-all-read').addEventListener('click', async () => {
  try {
    await NotificationStore.markAllRead();
    document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
    refreshNotifBadge();
    showToast('Todo marcado como leído', 'success');
  } catch { showToast('Algo salió mal, intenta de nuevo', 'error'); }
});

// ── Nav ───────────────────────────────────────────────────
document.getElementById('btn-new-recipe').addEventListener('click', () => { if (!requireAuth()) return; openNewForm(); });
document.getElementById('btn-empty-new')?.addEventListener('click', () => { if (!requireAuth()) return; openNewForm(); });
document.getElementById('btn-brand').addEventListener('click', () => { closeModal(); closePV(); showAppView('feed'); renderFeed(); });
document.getElementById('btn-back').addEventListener('click', () => showAppView('feed'));
document.getElementById('btn-cancel').addEventListener('click', () => showAppView('feed'));
document.getElementById('btn-profile').addEventListener('click', () => { if (!requireAuth()) return; if (uid()) openProfileView(uid()); });
document.getElementById('btn-login-open').addEventListener('click', () => { openAuthModal(); });
document.getElementById('auth-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuthModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!confirmOverlay.classList.contains('hidden')) { confirmOverlay.classList.add('hidden'); return; } if (!ulModal.classList.contains('hidden')) { closeUserListModal(); return; } if (!modal.classList.contains('hidden')) { closeModal(); return; } if (!pvModal.classList.contains('hidden')) { closePV(); return; } if (!epModal.classList.contains('hidden')) { closeEP(); return; } const authModal = document.getElementById('auth-modal'); if (authModal && !authModal.classList.contains('hidden')) { closeAuthModal(); return; } } });

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.getElementById('field-date').value = new Date().toISOString().split('T')[0];
// Auth state is handled entirely by onAuthStateChange listener above

// Initialize method-specific form state
document.getElementById('field-method').addEventListener('change', updateMethodFields);
updateMethodFields();

// Deep link: open recipe modal if URL is /recipe/[id] on load
try {
  const path = window.location.pathname || '';
  const match = path.match(/^\/recipe\/(.+)$/);
  if (match && match[1]) {
    const deepLinkId = match[1];
    // Defer to allow initial view/render to settle
    setTimeout(() => {
      openModal(deepLinkId);
    }, 400);
  }
} catch {}
