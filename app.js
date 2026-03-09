/* ═══════════════════════════════════════
   BREWED — Social Network App Logic
═══════════════════════════════════════ */
'use strict';

const SUPABASE_URL = 'https://fnchjxyputztlyzumiwo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TwGD61EkPM_W-CGK2sPcQw_hl7KVOYZ';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Utils ─────────────────────────────────────────────────
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtDate(d){if(!d)return '';try{return new Date(d).toLocaleDateString('es-MX',{year:'numeric',month:'short',day:'numeric'});}catch{return d;}}
function timeAgo(d){if(!d)return '';const s=Math.floor((Date.now()-new Date(d).getTime())/1000);if(s<60)return 'hace un momento';if(s<3600)return `hace ${Math.floor(s/60)}m`;if(s<86400)return `hace ${Math.floor(s/3600)}h`;return fmtDate(d);}
const GRIND_LABELS={1:'Muy Fino',2:'Muy Fino',3:'Fino',4:'Fino',5:'Medio',6:'Medio',7:'Grueso',8:'Grueso',9:'Muy Grueso',10:'Muy Grueso'};
let tempUnit='C', stageCount=0;

// ── Toast ─────────────────────────────────────────────────
const toast=document.getElementById('toast'); let toastTimer;
function showToast(msg,type=''){clearTimeout(toastTimer);toast.textContent=msg;toast.className=`toast ${type} show`;toastTimer=setTimeout(()=>toast.classList.remove('show'),2800);}

// ── Loading / Skeleton ────────────────────────────────────
const loadingOverlay=document.getElementById('loading-overlay');
const skeletonGrid=document.getElementById('skeleton-grid');
function showLoading(){loadingOverlay.classList.add('visible');}
function hideLoading(){loadingOverlay.classList.remove('visible');}
function showSkeleton(){skeletonGrid.classList.remove('hidden');}
function hideSkeleton(){skeletonGrid.classList.add('hidden');}

// ═══════════════════════════════════════════════════════════
// PROFILE MANAGER
// ═══════════════════════════════════════════════════════════
const Profile={
  KEY:'brewed_profile_id',
  id(){return localStorage.getItem(this.KEY);},
  save(id){localStorage.setItem(this.KEY,id);},
  _cache:null,
  async me(){
    const id=this.id();if(!id)return null;
    if(this._cache&&this._cache.id===id)return this._cache;
    const{data}=await sb.from('perfiles').select('*').eq('id',id).single();
    this._cache=data;return data;
  },
  async create(p){
    const{data,error}=await sb.from('perfiles').insert([p]).select();
    if(error)throw error;
    const prof=data[0];this.save(prof.id);this._cache=prof;return prof;
  },
  async getById(id){
    const{data}=await sb.from('perfiles').select('*').eq('id',id).single();
    return data;
  },
  clearCache(){this._cache=null;}
};

// ═══════════════════════════════════════════════════════════
// STORES
// ═══════════════════════════════════════════════════════════
const RecipeStore={
  async all(filter,feedMode,followingIds){
    let q=sb.from('recetas').select('*').order('created_at',{ascending:false});
    if(filter&&filter!=='all')q=q.eq('metodo',filter);
    if(feedMode==='following'&&followingIds)q=q.in('perfil_id',followingIds);
    const{data,error}=await q;
    if(error){console.error(error);return[];}return data||[];
  },
  async get(id){const{data}=await sb.from('recetas').select('*').eq('id',id).single();return data;},
  async insert(r){const{data,error}=await sb.from('recetas').insert([r]).select();if(error)throw error;return data?.[0];},
  async update(id,f){const{data,error}=await sb.from('recetas').update(f).eq('id',id).select();if(error)throw error;return data?.[0];},
  async delete(id){const{error}=await sb.from('recetas').delete().eq('id',id);if(error)throw error;},
  async search(q){const{data}=await sb.from('recetas').select('*').or(`nombre.ilike.%${q}%,metodo.ilike.%${q}%,nombre_cafe.ilike.%${q}%,origen.ilike.%${q}%`).order('created_at',{ascending:false}).limit(30);return data||[];},
  async byUser(pid){const{data}=await sb.from('recetas').select('*').eq('perfil_id',pid).order('created_at',{ascending:false});return data||[];}
};

const FollowStore={
  async follow(followingId){
    const myId=Profile.id();if(!myId)return;
    const{error}=await sb.from('follows').insert([{follower_id:myId,following_id:followingId}]);
    if(error&&error.code!=='23505')throw error;
  },
  async unfollow(followingId){
    const myId=Profile.id();if(!myId)return;
    await sb.from('follows').delete().match({follower_id:myId,following_id:followingId});
  },
  async isFollowing(followingId){
    const myId=Profile.id();if(!myId)return false;
    const{data}=await sb.from('follows').select('id').match({follower_id:myId,following_id:followingId});
    return data&&data.length>0;
  },
  async myFollowingIds(){
    const myId=Profile.id();if(!myId)return[];
    const{data}=await sb.from('follows').select('following_id').eq('follower_id',myId);
    return(data||[]).map(r=>r.following_id);
  },
  async followersCount(pid){const{count}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('following_id',pid);return count||0;},
  async followingCount(pid){const{count}=await sb.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',pid);return count||0;}
};

const LikeStore={
  async toggle(recetaId){
    const myId=Profile.id();if(!myId)return{liked:false,count:0};
    const{data:existing}=await sb.from('recipe_likes').select('id').match({receta_id:recetaId,perfil_id:myId});
    if(existing&&existing.length>0){
      await sb.from('recipe_likes').delete().match({receta_id:recetaId,perfil_id:myId});
    }else{
      await sb.from('recipe_likes').insert([{receta_id:recetaId,perfil_id:myId}]);
    }
    const{count}=await sb.from('recipe_likes').select('*',{count:'exact',head:true}).eq('receta_id',recetaId);
    return{liked:!(existing&&existing.length>0),count:count||0};
  },
  async count(recetaId){const{count}=await sb.from('recipe_likes').select('*',{count:'exact',head:true}).eq('receta_id',recetaId);return count||0;},
  async isLiked(recetaId){
    const myId=Profile.id();if(!myId)return false;
    const{data}=await sb.from('recipe_likes').select('id').match({receta_id:recetaId,perfil_id:myId});
    return data&&data.length>0;
  }
};

const CommentStore={
  async list(recetaId){
    const{data}=await sb.from('comentarios').select('*, perfiles(id,username,display_name,foto_perfil)').eq('receta_id',recetaId).order('created_at',{ascending:true});
    return data||[];
  },
  async add(recetaId,contenido){
    const myId=Profile.id();if(!myId)return null;
    const{data,error}=await sb.from('comentarios').insert([{receta_id:recetaId,perfil_id:myId,contenido}]).select('*, perfiles(id,username,display_name,foto_perfil)');
    if(error)throw error;return data?.[0];
  },
  async count(recetaId){const{count}=await sb.from('comentarios').select('*',{count:'exact',head:true}).eq('receta_id',recetaId);return count||0;}
};

const UserStore={
  async search(q){const{data}=await sb.from('perfiles').select('*').or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20);return data||[];}
};

// ═══════════════════════════════════════════════════════════
// NAV & VIEWS
// ═══════════════════════════════════════════════════════════
const views={feed:document.getElementById('view-feed'),form:document.getElementById('view-form'),search:document.getElementById('view-search')};
function showView(name){
  Object.values(views).forEach(v=>v.classList.remove('active'));
  views[name].classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  window.scrollTo(0,0);
}
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>{
  showView(b.dataset.view);
  if(b.dataset.view==='feed')renderFeed();
}));

// ═══════════════════════════════════════════════════════════
// PROFILE SETUP
// ═══════════════════════════════════════════════════════════
const profileModal=document.getElementById('profile-setup-modal');
const profileForm=document.getElementById('profile-form');
let profilePhotoData=null;

function showProfileSetup(){profileModal.classList.remove('hidden');document.body.style.overflow='hidden';}
function hideProfileSetup(){profileModal.classList.add('hidden');document.body.style.overflow='';}

const avatarDrop=document.getElementById('avatar-drop');
const avatarInput=document.getElementById('pf-photo');
avatarDrop.addEventListener('click',()=>avatarInput.click());
avatarInput.addEventListener('change',()=>{if(avatarInput.files[0])loadAvatar(avatarInput.files[0]);});
avatarDrop.addEventListener('dragover',e=>{e.preventDefault();avatarDrop.classList.add('drag-over');});
avatarDrop.addEventListener('dragleave',()=>avatarDrop.classList.remove('drag-over'));
avatarDrop.addEventListener('drop',e=>{e.preventDefault();avatarDrop.classList.remove('drag-over');if(e.dataTransfer.files[0])loadAvatar(e.dataTransfer.files[0]);});

function loadAvatar(file){
  const reader=new FileReader();reader.onload=e=>{
    const img=new Image();img.onload=()=>{
      const S=200,canvas=document.createElement('canvas');canvas.width=S;canvas.height=S;
      const ctx=canvas.getContext('2d');const m=Math.min(img.width,img.height);
      ctx.drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S);
      profilePhotoData=canvas.toDataURL('image/webp',0.8);
      document.getElementById('avatar-preview').src=profilePhotoData;
      document.getElementById('avatar-preview').classList.remove('hidden');
      document.getElementById('avatar-prompt').style.display='none';
    };img.src=e.target.result;
  };reader.readAsDataURL(file);
}

profileForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const username=document.getElementById('pf-username').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
  const display_name=document.getElementById('pf-displayname').value.trim();
  if(!username||!display_name){showToast('Username y nombre son obligatorios','error');return;}
  try{
    await Profile.create({username,display_name,bio:document.getElementById('pf-bio').value.trim(),foto_perfil:profilePhotoData,equipo_molino:document.getElementById('pf-molino').value.trim(),equipo_cafetera:document.getElementById('pf-cafetera').value.trim()});
    hideProfileSetup();updateNavAvatar();showToast('¡Perfil creado!','success');await renderFeed();
  }catch(err){
    if(err.code==='23505')showToast('Ese username ya está tomado','error');
    else showToast(`Error: ${err.message}`,'error');
  }
});

function updateNavAvatar(){
  const me=Profile._cache;
  const img=document.getElementById('nav-avatar');
  const fb=document.getElementById('nav-avatar-fallback');
  if(me&&me.foto_perfil){img.src=me.foto_perfil;img.style.display='block';fb.style.display='none';}
  else{img.style.display='none';fb.style.display='flex';fb.textContent=me?me.display_name[0].toUpperCase():'?';}
}

// ═══════════════════════════════════════════════════════════
// FEED
// ═══════════════════════════════════════════════════════════
const grid=document.getElementById('recipe-grid');
const emptyState=document.getElementById('empty-state');
let activeFilter='all',activeFeedMode='global',profilesCache={};

async function getProfile(pid){
  if(!pid)return null;
  if(profilesCache[pid])return profilesCache[pid];
  const p=await Profile.getById(pid);
  if(p)profilesCache[pid]=p;return p;
}

async function renderFeed(filter){
  activeFilter=filter??activeFilter;
  showSkeleton();grid.innerHTML='';emptyState.classList.add('hidden');
  try{
    let followingIds=null;
    if(activeFeedMode==='following'){
      followingIds=await FollowStore.myFollowingIds();
      if(followingIds.length===0){
        hideSkeleton();
        document.getElementById('empty-title').textContent='Sin recetas de seguidos';
        document.getElementById('empty-sub').textContent='Sigue a otros usuarios para ver sus recetas aquí.';
        emptyState.classList.remove('hidden');grid.style.display='none';return;
      }
    }
    const recipes=await RecipeStore.all(activeFilter,activeFeedMode,followingIds);
    // Batch load profiles
    const pids=[...new Set(recipes.map(r=>r.perfil_id).filter(Boolean))];
    await Promise.all(pids.map(pid=>getProfile(pid)));
    // Batch load like counts
    const likeCounts=await Promise.all(recipes.map(r=>LikeStore.count(r.id)));
    const myLikes=Profile.id()?await Promise.all(recipes.map(r=>LikeStore.isLiked(r.id))):recipes.map(()=>false);
    hideSkeleton();
    if(recipes.length===0){
      document.getElementById('empty-title').textContent='Sin recetas aún';
      document.getElementById('empty-sub').textContent='Sé el primero en compartir una receta.';
      emptyState.classList.remove('hidden');grid.style.display='none';
    }else{
      emptyState.classList.add('hidden');grid.style.display='';
      recipes.forEach((r,i)=>grid.appendChild(buildCard(r,profilesCache[r.perfil_id],likeCounts[i],myLikes[i])));
    }
  }catch(err){console.error(err);hideSkeleton();showToast('Error cargando feed','error');}
}

function buildCard(r,author,likeCount,isLiked){
  const card=document.createElement('article');card.className='recipe-card';card.dataset.id=r.id;
  const cg=parseFloat(r.coffee_grams),wg=parseFloat(r.water_grams);
  const ratio=(cg>0&&wg>0)?`1:${(wg/cg).toFixed(1)}`:'—';
  const authorHTML=author?`<div class="card-author"><div class="card-author-avatar">${author.foto_perfil?`<img src="${author.foto_perfil}" alt="">`:`<span>${author.display_name[0].toUpperCase()}</span>`}</div><span class="card-author-name">${esc(author.display_name)}</span></div>`:'';

  card.innerHTML=`
    ${r.foto_url?`<img class="card-photo" src="${r.foto_url}" alt="" loading="lazy"/>`:`<div class="card-photo-placeholder">☕</div>`}
    <div class="card-body">
      ${authorHTML}
      <div class="card-header"><div><div class="card-title">${esc(r.nombre)}</div>${(r.nombre_cafe||r.origen)?`<div class="card-origin">${esc([r.nombre_cafe,r.origen].filter(Boolean).join(' · '))}</div>`:''}</div><span class="card-method-badge">${esc(r.metodo||'')}</span></div>
      <div class="card-params"><div class="card-param"><div class="card-param-label">Café</div><div class="card-param-value">${cg?cg+'g':'—'}</div></div><div class="card-param"><div class="card-param-label">Agua</div><div class="card-param-value">${wg?wg+'g':'—'}</div></div><div class="card-param"><div class="card-param-label">Ratio</div><div class="card-param-value">${ratio}</div></div><div class="card-param"><div class="card-param-label">Temp.</div><div class="card-param-value">${r.temperatura?r.temperatura+'°C':'—'}</div></div><div class="card-param"><div class="card-param-label">Tueste</div><div class="card-param-value">${esc(r.tueste||'—')}</div></div><div class="card-param"><div class="card-param-label">Molienda</div><div class="card-param-value">${r.clicks_molienda?GRIND_LABELS[r.clicks_molienda]||r.clicks_molienda:'—'}</div></div></div>
      <div class="card-footer"><span class="card-date">${timeAgo(r.created_at)}</span><div class="card-footer-right"><button class="card-like-btn${isLiked?' liked':''}" data-id="${r.id}"><svg viewBox="0 0 20 20" fill="${isLiked?'currentColor':'none'}"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg><span>${likeCount}</span></button><span class="card-stages-count">${r.etapas?.length?r.etapas.length+' etapa'+(r.etapas.length>1?'s':''):''}</span></div></div>
    </div>`;

  card.querySelector('.card-like-btn').addEventListener('click',async e=>{
    e.stopPropagation();if(!Profile.id()){showToast('Crea un perfil primero','error');return;}
    try{const res=await LikeStore.toggle(r.id);const btn=e.currentTarget;const svg=btn.querySelector('svg path');
      btn.querySelector('span').textContent=res.count;
      btn.classList.toggle('liked',res.liked);svg.setAttribute('fill',res.liked?'currentColor':'none');
      btn.classList.add('pulse');setTimeout(()=>btn.classList.remove('pulse'),400);
    }catch(err){showToast('Error','error');}
  });
  if(author){const authorEl=card.querySelector('.card-author');if(authorEl)authorEl.addEventListener('click',e=>{e.stopPropagation();openProfileView(author.id);});}
  card.addEventListener('click',()=>openModal(r.id));
  return card;
}

// Feed tabs
document.querySelectorAll('.feed-tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.feed-tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');activeFeedMode=t.dataset.feed;renderFeed();
}));
// Filters
document.querySelectorAll('.filter-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');renderFeed(b.dataset.method);
}));

// ═══════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════
let searchTab='recipes',searchDebounce;
document.querySelectorAll('.search-tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.search-tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');searchTab=t.dataset.target;runSearch();
}));
document.getElementById('search-input').addEventListener('input',()=>{
  clearTimeout(searchDebounce);searchDebounce=setTimeout(runSearch,300);
});

async function runSearch(){
  const q=document.getElementById('search-input').value.trim();
  const results=document.getElementById('search-results');
  const empty=document.getElementById('search-empty');
  if(!q){results.innerHTML='';empty.classList.remove('hidden');return;}
  empty.classList.add('hidden');
  if(searchTab==='recipes'){
    const recipes=await RecipeStore.search(q);
    results.innerHTML=recipes.length?recipes.map(r=>`
      <div class="search-result-card" data-id="${r.id}">
        <div class="sr-left">${r.foto_url?`<img src="${r.foto_url}" class="sr-thumb" alt="">`:`<div class="sr-thumb-ph">☕</div>`}</div>
        <div class="sr-body"><div class="sr-title">${esc(r.nombre)}</div><div class="sr-meta">${esc(r.metodo||'')} · ${r.coffee_grams?r.coffee_grams+'g':''}</div></div>
        <span class="card-method-badge">${esc(r.metodo||'')}</span>
      </div>`).join(''):'<div class="search-no-results">No se encontraron recetas.</div>';
    results.querySelectorAll('.search-result-card').forEach(c=>c.addEventListener('click',()=>openModal(c.dataset.id)));
  }else{
    const users=await UserStore.search(q);
    results.innerHTML=users.length?users.map(u=>`
      <div class="search-result-user" data-uid="${u.id}">
        <div class="sr-avatar">${u.foto_perfil?`<img src="${u.foto_perfil}" alt="">`:`<span>${u.display_name[0].toUpperCase()}</span>`}</div>
        <div class="sr-body"><div class="sr-title">${esc(u.display_name)}</div><div class="sr-meta">@${esc(u.username)}</div></div>
      </div>`).join(''):'<div class="search-no-results">No se encontraron usuarios.</div>';
    results.querySelectorAll('.search-result-user').forEach(c=>c.addEventListener('click',()=>openProfileView(c.dataset.uid)));
  }
}

// ═══════════════════════════════════════════════════════════
// PROFILE VIEW
// ═══════════════════════════════════════════════════════════
const pvModal=document.getElementById('profile-view-modal');
let pvUserId=null;

async function openProfileView(uid){
  const u=await Profile.getById(uid);if(!u)return;pvUserId=uid;
  const av=document.getElementById('pv-avatar'),fb=document.getElementById('pv-avatar-fb');
  if(u.foto_perfil){av.src=u.foto_perfil;av.style.display='block';fb.style.display='none';}
  else{av.style.display='none';fb.style.display='flex';fb.textContent=u.display_name[0].toUpperCase();}
  document.getElementById('pv-displayname').textContent=u.display_name;
  document.getElementById('pv-username').textContent='@'+u.username;
  document.getElementById('pv-bio').textContent=u.bio||'';
  const eqParts=[];if(u.equipo_molino)eqParts.push('⚙️ '+u.equipo_molino);if(u.equipo_cafetera)eqParts.push('☕ '+u.equipo_cafetera);
  document.getElementById('pv-equipment').innerHTML=eqParts.map(e=>`<span class="pv-eq-tag">${esc(e)}</span>`).join('');
  // Stats
  const[recipes,followers,following]=await Promise.all([RecipeStore.byUser(uid),FollowStore.followersCount(uid),FollowStore.followingCount(uid)]);
  document.getElementById('pv-recipes').textContent=recipes.length;
  document.getElementById('pv-followers').textContent=followers;
  document.getElementById('pv-following-count').textContent=following;
  // Follow btn
  const btn=document.getElementById('btn-follow');
  const isMe=Profile.id()===uid;
  if(isMe){btn.textContent='Tu perfil';btn.disabled=true;btn.className='btn-follow is-me';}
  else{
    const isF=await FollowStore.isFollowing(uid);
    btn.textContent=isF?'Siguiendo':'Seguir';btn.className=`btn-follow${isF?' following':''}`;btn.disabled=false;
    btn.onclick=async()=>{
      if(!Profile.id()){showToast('Crea un perfil primero','error');return;}
      const cur=btn.classList.contains('following');
      if(cur){await FollowStore.unfollow(uid);btn.textContent='Seguir';btn.classList.remove('following');document.getElementById('pv-followers').textContent=Math.max(0,parseInt(document.getElementById('pv-followers').textContent)-1);}
      else{await FollowStore.follow(uid);btn.textContent='Siguiendo';btn.classList.add('following');document.getElementById('pv-followers').textContent=parseInt(document.getElementById('pv-followers').textContent)+1;}
    };
  }
  // User recipes mini-grid
  const rg=document.getElementById('pv-recipes-grid');
  rg.innerHTML=recipes.slice(0,6).map(r=>`<div class="pv-recipe-mini" data-id="${r.id}">${r.foto_url?`<img src="${r.foto_url}" alt="">`:`<div class="pv-mini-ph">☕</div>`}<div class="pv-mini-name">${esc(r.nombre)}</div></div>`).join('');
  rg.querySelectorAll('.pv-recipe-mini').forEach(c=>c.addEventListener('click',()=>{closePV();openModal(c.dataset.id);}));
  pvModal.classList.remove('hidden');document.body.style.overflow='hidden';
}
function closePV(){pvModal.classList.add('hidden');document.body.style.overflow='';}
document.getElementById('btn-pv-close').addEventListener('click',closePV);
pvModal.addEventListener('click',e=>{if(e.target===pvModal)closePV();});

// ═══════════════════════════════════════════════════════════
// FORM
// ═══════════════════════════════════════════════════════════
const form=document.getElementById('recipe-form'),formTitle=document.getElementById('form-title');
let photoData=null,editingId=null;

function resetForm(){form.reset();document.getElementById('field-id').value='';document.getElementById('ratio-value').textContent='—';document.getElementById('grind-label-text').textContent='Medio';document.getElementById('grind-number').textContent='5/10';document.getElementById('field-grind-level').value=5;updateGrindSliderTrack(5);photoData=null;editingId=null;document.getElementById('photo-preview').classList.add('hidden');document.getElementById('photo-prompt').style.display='';document.getElementById('stages-container').innerHTML='';document.getElementById('stages-hint').classList.remove('hidden');stageCount=0;tempUnit='C';document.querySelectorAll('.temp-btn').forEach(b=>b.classList.toggle('active',b.dataset.unit==='C'));document.getElementById('field-date').value=new Date().toISOString().split('T')[0];}
function openNewForm(){if(!Profile.id()){showToast('Crea un perfil primero','error');showProfileSetup();return;}resetForm();editingId=null;formTitle.textContent='Nueva Receta';showView('form');}

async function openEditForm(id){
  const r=await RecipeStore.get(id);if(!r)return;resetForm();editingId=id;formTitle.textContent='Editar Receta';
  document.getElementById('field-id').value=r.id;document.getElementById('field-name').value=r.nombre||'';document.getElementById('field-method').value=r.metodo||'';document.getElementById('field-date').value=r.fecha||'';document.getElementById('field-notes').value=r.notas||'';document.getElementById('field-coffee-name').value=r.nombre_cafe||'';document.getElementById('field-origin').value=r.origen||'';document.getElementById('field-roaster').value=r.tostador||'';document.getElementById('field-process').value=r.proceso||'';document.getElementById('field-grinder').value=r.tipo_molino||'';document.getElementById('field-grinder-model').value=r.modelo_molino||'';
  const gl=r.clicks_molienda||5;document.getElementById('field-grind-level').value=gl;document.getElementById('grind-label-text').textContent=GRIND_LABELS[gl]||'Medio';document.getElementById('grind-number').textContent=`${gl}/10`;updateGrindSliderTrack(gl);
  document.getElementById('field-grind-setting').value=r.grind_setting||'';document.getElementById('field-temp').value=r.temperatura||'';tempUnit=r.temp_unit||'C';document.querySelectorAll('.temp-btn').forEach(b=>b.classList.toggle('active',b.dataset.unit===tempUnit));document.getElementById('field-water-quality').value=r.calidad_agua||'';document.getElementById('field-coffee-grams').value=r.coffee_grams||'';document.getElementById('field-water-grams').value=r.water_grams||'';document.getElementById('field-yield-grams').value=r.yield_grams||'';document.getElementById('field-total-time').value=r.tiempo_total||'';
  if(r.tueste){const rad=form.querySelector(`input[name="roast"][value="${r.tueste}"]`);if(rad)rad.checked=true;}
  if(r.foto_url){photoData=r.foto_url;document.getElementById('photo-preview').src=r.foto_url;document.getElementById('photo-preview').classList.remove('hidden');document.getElementById('photo-prompt').style.display='none';}
  updateRatio();(r.etapas||[]).forEach(s=>addStage(s));showView('form');
}

// Photo
const photoDrop=document.getElementById('photo-drop'),photoInput=document.getElementById('field-photo');
photoDrop.addEventListener('click',()=>photoInput.click());
photoDrop.addEventListener('dragover',e=>{e.preventDefault();photoDrop.classList.add('drag-over');});
photoDrop.addEventListener('dragleave',()=>photoDrop.classList.remove('drag-over'));
photoDrop.addEventListener('drop',e=>{e.preventDefault();photoDrop.classList.remove('drag-over');if(e.dataTransfer.files[0])loadPhoto(e.dataTransfer.files[0]);});
photoInput.addEventListener('change',()=>{if(photoInput.files[0])loadPhoto(photoInput.files[0]);});
function loadPhoto(file){const reader=new FileReader();reader.onload=e=>{const img=new Image();img.onload=()=>{const M=800;let w=img.width,h=img.height;if(w>M||h>M){if(w>h){h=Math.round(h*M/w);w=M;}else{w=Math.round(w*M/h);h=M;}}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);photoData=c.toDataURL('image/webp',0.75);document.getElementById('photo-preview').src=photoData;document.getElementById('photo-preview').classList.remove('hidden');document.getElementById('photo-prompt').style.display='none';};img.src=e.target.result;};reader.readAsDataURL(file);}

// Ratio
function updateRatio(){const c=parseFloat(document.getElementById('field-coffee-grams').value),w=parseFloat(document.getElementById('field-water-grams').value);document.getElementById('ratio-value').textContent=(c>0&&w>0)?(w/c).toFixed(1):'—';}
document.getElementById('field-coffee-grams').addEventListener('input',updateRatio);
document.getElementById('field-water-grams').addEventListener('input',updateRatio);

// Grind
const grindSlider=document.getElementById('field-grind-level');
function updateGrindSliderTrack(v){const p=((v-1)/9)*100;grindSlider.style.background=`linear-gradient(to right,var(--accent) 0%,var(--accent) ${p}%,var(--bg-3) ${p}%,var(--bg-3) 100%)`;}
grindSlider.addEventListener('input',()=>{const v=+grindSlider.value;document.getElementById('grind-label-text').textContent=GRIND_LABELS[v];document.getElementById('grind-number').textContent=`${v}/10`;updateGrindSliderTrack(v);});
updateGrindSliderTrack(5);

// Temp toggle
document.querySelectorAll('.temp-btn').forEach(b=>b.addEventListener('click',()=>{const nu=b.dataset.unit;if(nu===tempUnit)return;const v=parseFloat(document.getElementById('field-temp').value);if(!isNaN(v)){document.getElementById('field-temp').value=nu==='F'?Math.round(v*9/5+32):Math.round((v-32)*5/9);}tempUnit=nu;document.querySelectorAll('.temp-btn').forEach(x=>x.classList.toggle('active',x.dataset.unit===tempUnit));}));

// Stages
function addStage(data={}){stageCount++;const n=stageCount;document.getElementById('stages-hint').classList.add('hidden');const card=document.createElement('div');card.className='stage-card';card.dataset.stage=n;card.innerHTML=`<div class="stage-header"><div class="stage-number">${n}</div><div class="stage-header-title">Etapa ${n}</div><button type="button" class="btn-remove-stage">✕</button></div><div class="stage-fields"><div class="stage-field"><label>Duración</label><input type="text" name="stage-duration-${n}" placeholder="0:30" value="${esc(data.duration||'')}" /></div><div class="stage-field"><label>Vertido (g)</label><input type="number" name="stage-pour-${n}" placeholder="60" min="0" value="${esc(data.pour||'')}" /></div><div class="stage-field"><label>Temp</label><input type="text" name="stage-temp-${n}" placeholder="93°C" value="${esc(data.temp||'')}" /></div><div class="stage-field stage-notes"><label>Notas</label><input type="text" name="stage-notes-${n}" placeholder="Pre-infusión…" value="${esc(data.notes||'')}" /></div></div>`;
  card.querySelector('.btn-remove-stage').addEventListener('click',()=>{card.remove();const rem=document.querySelectorAll('.stage-card');if(!rem.length)document.getElementById('stages-hint').classList.remove('hidden');rem.forEach((c,i)=>{c.querySelector('.stage-number').textContent=i+1;c.querySelector('.stage-header-title').textContent=`Etapa ${i+1}`;});stageCount=rem.length;});
  document.getElementById('stages-container').appendChild(card);
}
document.getElementById('btn-add-stage').addEventListener('click',()=>addStage());

// Submit
form.addEventListener('submit',async e=>{
  e.preventDefault();const nombre=document.getElementById('field-name').value.trim(),metodo=document.getElementById('field-method').value;
  if(!nombre){showToast('Nombre obligatorio','error');return;}if(!metodo){showToast('Selecciona método','error');return;}
  const stageCards=document.querySelectorAll('.stage-card');
  const etapas=Array.from(stageCards).map((c,i)=>{const n=c.dataset.stage;return{name:`Etapa ${i+1}`,duration:c.querySelector(`[name="stage-duration-${n}"]`)?.value.trim()||'',pour:c.querySelector(`[name="stage-pour-${n}"]`)?.value||'',temp:c.querySelector(`[name="stage-temp-${n}"]`)?.value.trim()||'',notes:c.querySelector(`[name="stage-notes-${n}"]`)?.value.trim()||''};});
  const rc=form.querySelector('input[name="roast"]:checked');const cg=document.getElementById('field-coffee-grams').value,wg=document.getElementById('field-water-grams').value;
  const ratioVal=(parseFloat(cg)>0&&parseFloat(wg)>0)?`1:${(parseFloat(wg)/parseFloat(cg)).toFixed(1)}`:null;
  const row={nombre,metodo,perfil_id:Profile.id(),fecha:document.getElementById('field-date').value||null,notas:document.getElementById('field-notes').value.trim()||null,nombre_cafe:document.getElementById('field-coffee-name').value.trim()||null,origen:document.getElementById('field-origin').value.trim()||null,tostador:document.getElementById('field-roaster').value.trim()||null,proceso:document.getElementById('field-process').value||null,tueste:rc?.value||null,foto_url:photoData||null,tipo_molino:document.getElementById('field-grinder').value||null,modelo_molino:document.getElementById('field-grinder-model').value.trim()||null,clicks_molienda:parseInt(document.getElementById('field-grind-level').value)||null,grind_setting:document.getElementById('field-grind-setting').value.trim()||null,temperatura:document.getElementById('field-temp').value||null,temp_unit:tempUnit,calidad_agua:document.getElementById('field-water-quality').value||null,coffee_grams:cg||null,water_grams:wg||null,ratio:ratioVal,yield_grams:document.getElementById('field-yield-grams').value||null,tiempo_total:document.getElementById('field-total-time').value.trim()||null,etapas};
  const btn=document.getElementById('btn-save');btn.disabled=true;btn.textContent='Guardando…';
  try{if(editingId)await RecipeStore.update(editingId,row);else await RecipeStore.insert(row);showToast(editingId?'✓ Actualizada':'✓ Publicada','success');await renderFeed();showView('feed');}
  catch(err){console.error(err);showToast(`Error: ${err.message}`,'error');}
  btn.disabled=false;btn.innerHTML='<svg viewBox="0 0 20 20" fill="none"><path d="M5 10l4.5 4.5L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Publicar';
});

// ═══════════════════════════════════════════════════════════
// DETAIL MODAL
// ═══════════════════════════════════════════════════════════
const modal=document.getElementById('detail-modal');let modalRecipeId=null;

async function openModal(id){
  const r=await RecipeStore.get(id);if(!r)return;modalRecipeId=id;
  // Photo
  const wrap=document.getElementById('modal-photo-wrap'),img=document.getElementById('modal-photo');
  if(r.foto_url){img.src=r.foto_url;wrap.classList.remove('hidden');}else wrap.classList.add('hidden');
  // Author
  const author=r.perfil_id?await getProfile(r.perfil_id):null;
  document.getElementById('modal-author').innerHTML=author?`<div class="modal-author-inner" data-uid="${author.id}"><div class="modal-author-av">${author.foto_perfil?`<img src="${author.foto_perfil}" alt="">`:`<span>${author.display_name[0].toUpperCase()}</span>`}</div><span>${esc(author.display_name)}</span></div>`:'';
  const authorEl=document.querySelector('.modal-author-inner');if(authorEl)authorEl.addEventListener('click',()=>{closeModal();openProfileView(authorEl.dataset.uid);});
  document.getElementById('modal-method-badge').textContent=r.metodo||'';
  document.getElementById('modal-title').textContent=r.nombre;
  // Likes
  const[likeCount,isLiked]=await Promise.all([LikeStore.count(id),LikeStore.isLiked(id)]);
  document.getElementById('modal-like-count').textContent=likeCount;
  const likeBtn=document.getElementById('btn-modal-like');likeBtn.classList.toggle('liked',isLiked);likeBtn.querySelector('svg path').setAttribute('fill',isLiked?'currentColor':'none');
  // Meta
  const mp=[];if(r.created_at)mp.push(fmtDate(r.created_at));if(r.tostador)mp.push(r.tostador);
  document.getElementById('modal-meta').textContent=mp.join(' · ');
  // Params
  const cg=parseFloat(r.coffee_grams),wg=parseFloat(r.water_grams);const ratio=(cg>0&&wg>0)?`1:${(wg/cg).toFixed(1)}`:null;
  const params=[{icon:'🫘',label:'Café',value:r.nombre_cafe||'—'},{icon:'🌍',label:'Origen',value:r.origen||'—'},{icon:'🔥',label:'Tueste',value:r.tueste||'—'},{icon:'🧪',label:'Proceso',value:r.proceso||'—'},{icon:'⚙️',label:'Molino',value:r.modelo_molino||r.tipo_molino||'—'},{icon:'📏',label:'Molienda',value:r.clicks_molienda?`${GRIND_LABELS[r.clicks_molienda]||''} (${r.clicks_molienda}/10)`:'—'},{icon:'⚖️',label:'Café',value:cg?`${cg}g`:'—'},{icon:'💧',label:'Agua',value:wg?`${wg}g`:'—'},{icon:'📊',label:'Ratio',value:ratio||'—',hl:true},{icon:'🌡️',label:'Temp.',value:r.temperatura?`${r.temperatura}°${r.temp_unit||'C'}`:'—'},{icon:'🥛',label:'Agua',value:r.calidad_agua||'—'},{icon:'⏱️',label:'Tiempo',value:r.tiempo_total||'—'}];
  document.getElementById('modal-params').innerHTML=params.filter(p=>p.value!=='—').map(p=>`<div class="param-chip"><div class="param-chip-icon">${p.icon}</div><div class="param-chip-label">${esc(p.label)}</div><div class="param-chip-value${p.hl?' highlight':''}">${esc(p.value)}</div></div>`).join('');
  // Stages
  const sw=document.getElementById('modal-stages-wrap'),se=document.getElementById('modal-stages');
  if(r.etapas?.length){se.innerHTML=r.etapas.map((s,i)=>`<div class="timeline-step"><div class="timeline-dot"><div class="timeline-dot-circle">${i+1}</div><div class="timeline-dot-line"></div></div><div class="timeline-body"><div class="timeline-step-name">${esc(s.name)}</div>${s.pour?`<div class="timeline-notes">Vertido: ${esc(s.pour)}g${s.temp?' · '+esc(s.temp):''}</div>`:''}${s.notes?`<div class="timeline-notes">${esc(s.notes)}</div>`:''}</div><div class="timeline-time">${esc(s.duration||'')}</div></div>`).join('');sw.classList.remove('hidden');}else sw.classList.add('hidden');
  // Notes
  const nw=document.getElementById('modal-notes-wrap');if(r.notas){document.getElementById('modal-notes-text').textContent=r.notas;nw.classList.remove('hidden');}else nw.classList.add('hidden');
  // Comments
  await loadComments(id);
  modal.classList.remove('hidden');document.body.style.overflow='hidden';
}

async function loadComments(recetaId){
  const comments=await CommentStore.list(recetaId);
  const list=document.getElementById('comments-list');
  document.getElementById('comment-count-badge').textContent=comments.length;
  list.innerHTML=comments.map(c=>{const u=c.perfiles;return`<div class="comment-item"><div class="comment-avatar">${u?.foto_perfil?`<img src="${u.foto_perfil}" alt="">`:`<span>${(u?.display_name||'?')[0].toUpperCase()}</span>`}</div><div class="comment-body"><div class="comment-header"><span class="comment-author">${esc(u?.display_name||'Anónimo')}</span><span class="comment-time">${timeAgo(c.created_at)}</span></div><p class="comment-text">${esc(c.contenido)}</p></div></div>`;}).join('')||'<p class="no-comments">Sin comentarios aún. ¡Sé el primero!</p>';
}

document.getElementById('btn-send-comment').addEventListener('click',async()=>{
  if(!Profile.id()){showToast('Crea un perfil primero','error');return;}
  const input=document.getElementById('comment-input');const text=input.value.trim();if(!text)return;
  try{await CommentStore.add(modalRecipeId,text);input.value='';await loadComments(modalRecipeId);}
  catch(err){showToast('Error enviando comentario','error');}
});
document.getElementById('comment-input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('btn-send-comment').click();}});

function closeModal(){modal.classList.add('hidden');document.body.style.overflow='';modalRecipeId=null;}
document.getElementById('btn-modal-close').addEventListener('click',closeModal);
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
document.getElementById('btn-modal-edit').addEventListener('click',()=>{const id=modalRecipeId;closeModal();openEditForm(id);});

// Like in modal
document.getElementById('btn-modal-like').addEventListener('click',async()=>{
  if(!Profile.id()){showToast('Crea un perfil primero','error');return;}
  try{const res=await LikeStore.toggle(modalRecipeId);document.getElementById('modal-like-count').textContent=res.count;
    const btn=document.getElementById('btn-modal-like');btn.classList.toggle('liked',res.liked);btn.querySelector('svg path').setAttribute('fill',res.liked?'currentColor':'none');
    btn.classList.add('pulse');setTimeout(()=>btn.classList.remove('pulse'),400);
  }catch(err){showToast('Error','error');}
});

// ── Delete ────────────────────────────────────────────────
const confirmOverlay=document.getElementById('confirm-overlay');let pendingDeleteId=null;
function openConfirm(id){pendingDeleteId=id;confirmOverlay.classList.remove('hidden');}
function closeConfirm(){confirmOverlay.classList.add('hidden');pendingDeleteId=null;}
document.getElementById('btn-modal-delete').addEventListener('click',()=>openConfirm(modalRecipeId));
document.getElementById('btn-confirm-cancel').addEventListener('click',closeConfirm);
document.getElementById('btn-confirm-ok').addEventListener('click',async()=>{if(pendingDeleteId){try{await RecipeStore.delete(pendingDeleteId);closeConfirm();closeModal();await renderFeed();showToast('Eliminada','error');}catch(err){showToast('Error','error');}}});
confirmOverlay.addEventListener('click',e=>{if(e.target===confirmOverlay)closeConfirm();});

// ── Nav ───────────────────────────────────────────────────
document.getElementById('btn-new-recipe').addEventListener('click',openNewForm);
document.getElementById('btn-empty-new').addEventListener('click',openNewForm);
document.getElementById('btn-brand').addEventListener('click',()=>{closeModal();closePV();showView('feed');renderFeed();});
document.getElementById('btn-back').addEventListener('click',()=>showView('feed'));
document.getElementById('btn-cancel').addEventListener('click',()=>showView('feed'));
document.getElementById('btn-profile').addEventListener('click',()=>{
  const myId=Profile.id();if(myId)openProfileView(myId);else showProfileSetup();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!confirmOverlay.classList.contains('hidden')){closeConfirm();return;}if(!modal.classList.contains('hidden')){closeModal();return;}if(!pvModal.classList.contains('hidden')){closePV();return;}}});

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
(async()=>{
  showLoading();
  document.getElementById('field-date').value=new Date().toISOString().split('T')[0];
  const me=await Profile.me();
  hideLoading();
  if(!me)showProfileSetup();
  else{updateNavAvatar();await renderFeed();}
})();
