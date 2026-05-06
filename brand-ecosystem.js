/**
 * ════════════════════════════════════════════════════════════
 *  BUYZO CART — BRAND ECOSYSTEM  v2.0
 *  Features: Brand DB, Follow System, Product Codes, Brand Profile,
 *  Verification, Reviews, Coupons, Notifications, Collections,
 *  Smart Recommendations, Search, Filters, Analytics
 * ════════════════════════════════════════════════════════════
 */
'use strict';

(function(global) {

/* ── Utilities ── */
const $ = id => document.getElementById(id);
const toast = (msg, type='success') => {
  if (typeof global.showToast === 'function') global.showToast(msg, type);
  else console.log('[Brand]', msg);
};
function waitFor(check, cb, ms=100, tries=60) {
  if (check()) return cb();
  if (tries <= 0) return;
  setTimeout(() => waitFor(check, cb, ms, tries-1), ms);
}

/* ── Firebase helpers (waits for window.firebase) ── */
let DB = null;
function getDB() {
  if (DB) return DB;
  const fb = global.firebase;
  if (fb && fb.database) { DB = fb.database(); return DB; }
  return null;
}
function dbRef(path) { const d = getDB(); return d ? d.ref(path) : null; }
function dbGet(path) {
  return new Promise((resolve, reject) => {
    const r = dbRef(path);
    if (!r) return resolve(null);
    r.once('value').then(resolve).catch(reject);
  });
}
function dbSet(path, val) {
  const r = dbRef(path);
  return r ? r.set(val) : Promise.resolve();
}
function dbPush(path, val) {
  const r = dbRef(path);
  return r ? r.push(val) : Promise.resolve();
}
function dbRemove(path) {
  const r = dbRef(path);
  return r ? r.remove() : Promise.resolve();
}
function dbUpdate(path, val) {
  const r = dbRef(path);
  return r ? r.update(val) : Promise.resolve();
}

/* ─────────────────────────────────────────────
   1. BRAND DATABASE STRUCTURE
   ───────────────────────────────────────────── */
const BRAND_SCHEMA = {
  brandId: '',          // auto-generated
  name: '',
  logo: '',             // image URL
  banner: '',           // banner URL
  description: '',
  ownerId: '',          // Firebase user UID
  followersCount: 0,
  followingCount: 0,
  rating: 0,
  totalProducts: 0,
  totalReviews: 0,
  isVerified: false,
  verificationLevel: 'normal', // normal | verified | premium
  themeColor: '#2563eb',
  createdAt: 0,
  pendingApproval: true,
  score: 0,             // popularity score
};

/* ─────────────────────────────────────────────
   2. PRODUCT CODE GENERATOR (3 nums + 3 CAPS)
   ───────────────────────────────────────────── */
function generateProductCode() {
  const nums = () => Math.floor(Math.random() * 9) + 1;
  const caps = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${nums()}${nums()}${nums()}${caps()}${caps()}${caps()}`;
}
async function generateUniqueProductCode() {
  let code, exists = true, attempts = 0;
  while (exists && attempts < 20) {
    code = generateProductCode();
    const snap = await dbGet('productCodes/' + code).catch(() => null);
    exists = snap && snap.exists ? snap.exists() : false;
    attempts++;
  }
  return code;
}

/* ─────────────────────────────────────────────
   3. POPULARITY SCORE FORMULA
   Score = Followers + (Rating × 100) + (TotalProducts × 10)
   ───────────────────────────────────────────── */
function calcBrandScore(brand) {
  return (brand.followersCount || 0) +
    ((brand.rating || 0) * 100) +
    ((brand.totalProducts || 0) * 10);
}

/* ─────────────────────────────────────────────
   4. BRAND COLOR PALETTE
   ───────────────────────────────────────────── */
const BRAND_COLORS = [
  '#f97316','#2563eb','#7c3aed','#16a34a',
  '#dc2626','#0369a1','#d97706','#059669',
  '#db2777','#0891b2','#65a30d','#9333ea'
];
function getBrandColor(name, stored) {
  if (stored && stored !== '#2563eb') return stored;
  return BRAND_COLORS[(name || 'B').charCodeAt(0) % BRAND_COLORS.length];
}

/* ─────────────────────────────────────────────
   5. BRAND INITIALS / LOGO RENDER
   ───────────────────────────────────────────── */
function renderBrandAvatar(brand, size=48, borderRadius='12px') {
  const color = getBrandColor(brand.name, brand.themeColor);
  if (brand.logo) {
    return `<img src="${brand.logo}" alt="${brand.name}" style="width:${size}px;height:${size}px;border-radius:${borderRadius};object-fit:cover;background:${color};" onerror="this.parentNode.innerHTML=this.parentNode.innerHTML">`;
  }
  const initials = (brand.name || 'B').slice(0,2).toUpperCase();
  return `<div style="width:${size}px;height:${size}px;border-radius:${borderRadius};background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:${Math.round(size*0.38)}px;flex-shrink:0;">${initials}</div>`;
}

/* ─────────────────────────────────────────────
   6. VERIFICATION BADGE
   ───────────────────────────────────────────── */
function getVerificationBadge(brand) {
  if (!brand.isVerified) return '';
  if (brand.verificationLevel === 'premium') {
    return `<span class="bz-badge-premium" title="Premium Brand">⚡ Premium</span>`;
  }
  return `<span class="bz-badge-verified" title="Verified Brand">✓</span>`;
}

/* ─────────────────────────────────────────────
   7. MAIN BRAND DATA STORE
   ───────────────────────────────────────────── */
let _allBrands = [];        // [{...brandData, products:[...]}]
let _currentTab = 'all';
let _currentBrandForReview = null;
let _reviewRating = 0;
let _loadedOnce = false;

/* ─────────────────────────────────────────────
   8. LOAD BRANDS FROM FIREBASE
   ───────────────────────────────────────────── */
async function loadAllBrands(force=false) {
  if (_loadedOnce && !force) return _allBrands;

  const [prodSnap, brandSnap] = await Promise.all([
    dbGet('products'),
    dbGet('brands')
  ]).catch(() => [null, null]);

  const brandMap = {};

  // Load from brand collection first
  if (brandSnap && brandSnap.exists && brandSnap.exists()) {
    brandSnap.forEach(child => {
      const b = child.val();
      if (!b || !b.name) return;
      if (b.pendingApproval) return; // skip unapproved
      const id = child.key;
      brandMap[id] = {
        ...BRAND_SCHEMA,
        ...b,
        brandId: id,
        products: [],
        score: calcBrandScore(b)
      };
    });
  }

  // Build product count per brand
  if (prodSnap && prodSnap.exists && prodSnap.exists()) {
    prodSnap.forEach(child => {
      const p = child.val();
      if (!p || !p.brand) return;
      const bid = p.brandId || (p.brand.toLowerCase().replace(/[^a-z0-9]/g, '_'));
      if (!brandMap[bid]) {
        brandMap[bid] = {
          ...BRAND_SCHEMA,
          brandId: bid,
          name: p.brand,
          themeColor: p.brandColor || '#2563eb',
          logo: p.brandLogo || '',
          products: [],
          score: 0
        };
      }
      brandMap[bid].products.push({ id: child.key, ...p });
      brandMap[bid].totalProducts = (brandMap[bid].products || []).length;
    });
  }

  // Recompute scores
  _allBrands = Object.values(brandMap)
    .filter(b => b.products.length > 0)
    .map(b => ({ ...b, score: calcBrandScore(b) }))
    .sort((a, b) => b.score - a.score);

  _loadedOnce = true;
  return _allBrands;
}

/* ─────────────────────────────────────────────
   9. GET USER'S FOLLOWED BRANDS
   ───────────────────────────────────────────── */
async function getFollowedBrandIds() {
  const user = global.currentUser;
  if (!user) return [];
  const snap = await dbGet('userFollowing/' + user.uid).catch(() => null);
  if (!snap || !snap.exists || !snap.exists()) return [];
  return Object.keys(snap.val() || {});
}

/* ─────────────────────────────────────────────
   10. RENDER BRANDS PAGE
   ───────────────────────────────────────────── */
async function renderBrandsPage() {
  await loadAllBrands();

  const followedIds = await getFollowedBrandIds();
  const searchQ = ($('brandSearchSite') || {}).value?.toLowerCase().trim() || '';

  let filtered = _allBrands.filter(b =>
    !searchQ || b.name.toLowerCase().includes(searchQ)
  );

  // Tab filter
  if (_currentTab === 'verified') {
    filtered = filtered.filter(b => b.isVerified);
  } else if (_currentTab === 'premium') {
    filtered = filtered.filter(b => b.verificationLevel === 'premium');
  } else if (_currentTab === 'following') {
    filtered = filtered.filter(b => followedIds.includes(b.brandId));
  }

  const popSection = $('popularBrandsSection');
  const othSection = $('otherBrandsSection');
  const sugSection = $('suggestedBrandsSection');
  const emptyEl = $('brandsEmptyState');

  if (!filtered.length) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (popSection) popSection.style.display = 'none';
    if (othSection) othSection.style.display = 'none';
    if (sugSection) sugSection.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  // Popular: top 5 by score
  const popular = filtered.slice(0, 5);
  const others  = filtered.slice(5);

  // Popular scroll
  if (popSection) {
    popSection.style.display = 'block';
    const cnt = $('popularBrandsCount');
    if (cnt) cnt.textContent = `${popular.length} brands`;
    const scroll = $('popularBrandsScroll');
    if (scroll) scroll.innerHTML = popular.map(b => buildPopularCard(b, followedIds)).join('');
  }

  // Suggested (AI: pick brands from categories user viewed)
  const suggested = getSuggestedBrands(filtered, followedIds);
  if (sugSection) {
    if (suggested.length) {
      sugSection.style.display = 'block';
      const grid = $('suggestedBrandsGrid');
      if (grid) grid.innerHTML = suggested.map(b => buildBrandGridCard(b, followedIds)).join('');
    } else {
      sugSection.style.display = 'none';
    }
  }

  // All Brands grid
  if (othSection) {
    othSection.style.display = 'block';
    const cnt = $('allBrandsCount');
    if (cnt) cnt.textContent = `${filtered.length} brands`;
    const grid = $('otherBrandsGrid');
    if (grid) grid.innerHTML = filtered.map(b => buildBrandGridCard(b, followedIds)).join('');
  }
}

/* ─────────────────────────────────────────────
   11. POPULAR BRAND CARD (horizontal scroll)
   ───────────────────────────────────────────── */
function buildPopularCard(brand, followedIds) {
  const isFollowing = followedIds.includes(brand.brandId);
  const badge = getVerificationBadge(brand);
  const color  = getBrandColor(brand.name, brand.themeColor);
  const avatar = renderBrandAvatar(brand, 56, '14px');
  return `
  <div class="bz-popular-card" onclick="bzBrand.openProfile('${brand.brandId}','${escq(brand.name)}')">
    ${avatar}
    <div style="margin-top:6px;font-size:11px;font-weight:700;color:var(--ink);text-align:center;max-width:68px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
      ${brand.name} ${badge}
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:2px;">${brand.products.length} items</div>
    <button class="bz-follow-chip ${isFollowing?'following':''}" onclick="event.stopPropagation();bzBrand.toggleFollow('${brand.brandId}','${escq(brand.name)}',this)">
      ${isFollowing ? '✓' : '+'}
    </button>
  </div>`;
}

/* ─────────────────────────────────────────────
   12. ALL BRANDS GRID CARD
   ───────────────────────────────────────────── */
function buildBrandGridCard(brand, followedIds) {
  const isFollowing = followedIds.includes(brand.brandId);
  const badge = getVerificationBadge(brand);
  const avatar = renderBrandAvatar(brand, 44, '11px');
  const stars = brand.rating ? renderStars(brand.rating) : '';
  return `
  <div class="bz-brand-grid-card" onclick="bzBrand.openProfile('${brand.brandId}','${escq(brand.name)}')">
    <div style="display:flex;align-items:center;gap:10px;">
      ${avatar}
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${brand.name} ${badge}
        </div>
        <div style="font-size:11px;color:var(--muted);">${brand.products.length} products${stars ? ' • ' + stars : ''}</div>
      </div>
      <button class="bz-follow-btn ${isFollowing?'following':''}" onclick="event.stopPropagation();bzBrand.toggleFollow('${brand.brandId}','${escq(brand.name)}',this)">
        ${isFollowing ? '✓ Following' : '+ Follow'}
      </button>
    </div>
  </div>`;
}

function renderStars(rating) {
  const full = Math.round(rating);
  return '⭐'.repeat(Math.min(full,5)) + ` ${rating.toFixed(1)}`;
}

function escq(s) { return (s||'').replace(/'/g,"\\'"); }

/* ─────────────────────────────────────────────
   13. SMART SUGGESTION ENGINE
   Based on: wishlist brands, recently viewed, search history
   ───────────────────────────────────────────── */
function getSuggestedBrands(allBrands, followedIds) {
  const user = global.currentUser;
  if (!user) return [];

  // Gather hints from localStorage
  const viewed   = JSON.parse(localStorage.getItem('bz_recently_viewed') || '[]');
  const wishlist = JSON.parse(localStorage.getItem('bz_wishlist_ids') || '[]');
  const searches = JSON.parse(localStorage.getItem('bz_recent_searches') || '[]');

  const hintBrands = new Set();

  // From recently viewed products — get their brands
  viewed.forEach(p => { if (p.brand) hintBrands.add(p.brand.toLowerCase()); });
  // From wishlist (product objects stored in products array)
  const prods = global.products || [];
  wishlist.forEach(pid => {
    const p = prods.find(x => x.id === pid);
    if (p && p.brand) hintBrands.add(p.brand.toLowerCase());
  });
  // From search history — brand names
  searches.forEach(s => { hintBrands.add((s||'').toLowerCase()); });

  if (!hintBrands.size) return [];

  // Find brands that match hints but user doesn't follow yet
  return allBrands.filter(b =>
    !followedIds.includes(b.brandId) &&
    [...hintBrands].some(h => b.name.toLowerCase().includes(h) || h.includes(b.name.toLowerCase()))
  ).slice(0, 4);
}

/* ─────────────────────────────────────────────
   14. FOLLOW / UNFOLLOW
   ───────────────────────────────────────────── */
async function toggleFollow(brandId, brandName, btnEl) {
  const user = global.currentUser;
  if (!user) {
    toast('Please login to follow brands', 'error');
    if (typeof global.showLoginModal === 'function') global.showLoginModal();
    return;
  }

  const uid = user.uid;
  const followerPath = `brandFollowers/${brandId}/${uid}`;
  const followingPath = `userFollowing/${uid}/${brandId}`;

  const snap = await dbGet(followerPath).catch(() => null);
  const isFollowing = snap && snap.exists && snap.exists();

  if (isFollowing) {
    // Unfollow
    await Promise.all([dbRemove(followerPath), dbRemove(followingPath)]).catch(()=>{});
    // Update count
    const brand = _allBrands.find(b => b.brandId === brandId);
    if (brand) { brand.followersCount = Math.max(0, (brand.followersCount||0)-1); brand.score = calcBrandScore(brand); }
    dbUpdate(`brands/${brandId}`, { followersCount: (brand||{}).followersCount||0 });
    updateFollowBtn(btnEl, false);
    updateProfileFollowBtn(false);
    updateFollowerCountDisplay(-1);
    toast(`Unfollowed ${brandName}`,'info');
  } else {
    // Follow
    const now = Date.now();
    await Promise.all([
      dbSet(followerPath, { userId: uid, brandId, brandName, followedAt: now }),
      dbSet(followingPath, { brandId, brandName, followedAt: now })
    ]).catch(()=>{});
    // Update count
    const brand = _allBrands.find(b => b.brandId === brandId);
    if (brand) { brand.followersCount = (brand.followersCount||0)+1; brand.score = calcBrandScore(brand); }
    dbUpdate(`brands/${brandId}`, { followersCount: (brand||{}).followersCount||0 });
    updateFollowBtn(btnEl, true);
    updateProfileFollowBtn(true);
    updateFollowerCountDisplay(+1);
    toast(`Following ${brandName}! 🎉`,'success');
    // Notification for brand
    dbPush(`notifications/${brandId}`, { type:'new_follower', userId: uid, ts: now });
  }

  // Reload following section on home
  loadFollowingSection();
}

function updateFollowBtn(btn, following) {
  if (!btn) return;
  if (btn.classList.contains('bz-follow-chip')) {
    btn.textContent = following ? '✓' : '+';
    btn.classList.toggle('following', following);
  } else if (btn.classList.contains('bz-follow-btn')) {
    btn.textContent = following ? '✓ Following' : '+ Follow';
    btn.classList.toggle('following', following);
  }
}
function updateProfileFollowBtn(following) {
  const btn = $('brandProfileFollowBtn');
  if (!btn) return;
  btn.textContent = following ? '✓ Following' : '+ Follow';
  btn.className = `bz-profile-follow-btn${following?' following':''}`;
}
function updateFollowerCountDisplay(delta) {
  const el = $('brandProfileFollowers');
  if (el) el.textContent = Math.max(0, parseInt(el.textContent||'0') + delta);
}

/* ─────────────────────────────────────────────
   15. BRAND PROFILE PAGE
   ───────────────────────────────────────────── */
async function openProfile(brandId, brandName) {
  const content = $('brandProfileContent');
  if (content) content.innerHTML = buildProfileSkeleton();
  showPage('brandProfilePage');

  // Load data
  const [brandSnap, followerSnap, reviewSnap, couponSnap, collectionSnap] = await Promise.all([
    dbGet(`brands/${brandId}`),
    dbGet(`brandFollowers/${brandId}`),
    dbGet(`brandReviews/${brandId}`),
    dbGet(`brandCoupons/${brandId}`),
    dbGet(`brandCollections/${brandId}`)
  ]).catch(() => [null,null,null,null,null]);

  const raw = (brandSnap && brandSnap.exists && brandSnap.exists()) ? brandSnap.val() : {};
  const brand = { ...BRAND_SCHEMA, brandId, name: brandName, ...raw };
  brand.themeColor = getBrandColor(brand.name, brand.themeColor);

  const followers = followerSnap && followerSnap.exists && followerSnap.exists()
    ? Object.keys(followerSnap.val()||{}).length : (brand.followersCount||0);

  const user = global.currentUser;
  const isFollowing = user && followerSnap && followerSnap.exists && followerSnap.exists()
    ? !!followerSnap.val()[user.uid] : false;

  // Brand products
  const prods = global.products || [];
  const brandProds = prods.filter(p => {
    const bid = p.brandId || (p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
    return bid === brandId || (p.brand||'').toLowerCase() === brandName.toLowerCase();
  });

  // Reviews
  const reviews = [];
  if (reviewSnap && reviewSnap.exists && reviewSnap.exists()) {
    reviewSnap.forEach(c => reviews.push({ id: c.key, ...c.val() }));
  }
  const avgRating = reviews.length
    ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '—';

  // Coupons
  const coupons = [];
  if (couponSnap && couponSnap.exists && couponSnap.exists()) {
    couponSnap.forEach(c => coupons.push({ id: c.key, ...c.val() }));
  }

  // Collections
  const collections = [];
  if (collectionSnap && collectionSnap.exists && collectionSnap.exists()) {
    collectionSnap.forEach(c => collections.push({ id: c.key, ...c.val() }));
  }

  // Render
  if (!content) return;
  content.innerHTML = buildProfileHTML({
    brand, followers, isFollowing, brandProds, reviews, avgRating, coupons, collections
  });

  // Render product grid inside profile
  if (brandProds.length && typeof global.renderProducts === 'function') {
    global.renderProducts(brandProds.slice(0,8), 'brandProfileProductGrid');
  }

  // Store for review modal
  _currentBrandForReview = { brandId, brandName };
}

function buildProfileSkeleton() {
  return `<div style="padding:16px;">
    <div style="background:var(--border);height:180px;border-radius:16px;margin-bottom:16px;animation:shimmer 1.5s infinite;"></div>
    <div style="height:60px;background:var(--border);border-radius:12px;margin-bottom:12px;animation:shimmer 1.5s infinite;"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      ${[1,2,3,4].map(()=>`<div style="height:160px;background:var(--border);border-radius:12px;animation:shimmer 1.5s infinite;"></div>`).join('')}
    </div>
  </div>`;
}

function buildProfileHTML({ brand, followers, isFollowing, brandProds, reviews, avgRating, coupons, collections }) {
  const color = brand.themeColor;
  const badge = getVerificationBadge(brand);
  const avatar = brand.logo
    ? `<img src="${brand.logo}" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid rgba(255,255,255,0.5);" onerror="this.style.display='none'">`
    : `<div style="width:80px;height:80px;border-radius:20px;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:28px;">${(brand.name||'B').slice(0,2).toUpperCase()}</div>`;

  const bannerStyle = brand.banner
    ? `background:url('${brand.banner}') center/cover;`
    : `background:linear-gradient(135deg,${color},${shadeColor(color,-30)});`;

  const user = global.currentUser;
  const followBtn = user
    ? `<button id="brandProfileFollowBtn" class="bz-profile-follow-btn${isFollowing?' following':''}" onclick="bzBrand.toggleFollow('${brand.brandId}','${escq(brand.name)}',this)">
        ${isFollowing ? '✓ Following' : '+ Follow'}
       </button>`
    : `<button class="bz-profile-follow-btn" onclick="if(typeof showLoginModal==='function')showLoginModal()">Login to Follow</button>`;

  const couponsHtml = coupons.length ? `
    <button class="bz-coupon-trigger" onclick="bzBrand.showCoupons('${brand.brandId}')">
      🏷️ ${coupons.length} Coupon${coupons.length>1?'s':''} Available
    </button>` : '';

  const collectionsHtml = collections.length ? `
    <div style="margin:16px 0 8px;font-size:14px;font-weight:800;">📦 Collections</div>
    <div class="bz-collections-scroll">
      ${collections.map(col=>`
        <div class="bz-collection-card" onclick="bzBrand.showCollection('${brand.brandId}','${col.id}','${escq(col.name)}')">
          <div style="font-size:1.5rem;margin-bottom:6px;">${col.icon||'📦'}</div>
          <div style="font-size:12px;font-weight:700;">${col.name}</div>
          <div style="font-size:10px;color:var(--muted);">${(col.productIds||[]).length} items</div>
        </div>`).join('')}
    </div>` : '';

  const reviewsHtml = reviews.length ? `
    <div style="margin:16px 0 8px;font-size:14px;font-weight:800;">Customer Reviews (${reviews.length})</div>
    ${reviews.slice(0,3).map(r=>`
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          <span style="color:#f59e0b;font-size:12px;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
          <span style="font-size:11px;color:var(--muted);">${r.userName||'User'}</span>
        </div>
        <div style="font-size:13px;color:var(--ink);">${r.text||''}</div>
      </div>`).join('')}` : '';

  return `
  <!-- Sticky Back Bar -->
  <div style="position:sticky;top:0;z-index:10;background:var(--card);border-bottom:1px solid var(--border);padding:12px 16px;display:flex;align-items:center;gap:12px;">
    <button onclick="history.back();showPage('brandsPage');" class="bz-back-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
    </button>
    <span style="font-weight:800;font-size:15px;">Brand Profile</span>
  </div>

  <!-- Banner + Avatar -->
  <div style="${bannerStyle}padding:36px 20px 20px;text-align:center;position:relative;min-height:160px;">
    <div style="display:inline-block;">${avatar}</div>
    <h2 style="color:#fff;font-size:1.2rem;font-weight:800;margin:10px 0 4px;display:flex;align-items:center;justify-content:center;gap:6px;">
      ${brand.name} ${badge}
    </h2>
    ${brand.description ? `<p style="color:rgba(255,255,255,.85);font-size:12px;margin:0;max-width:300px;margin:auto;">${brand.description}</p>` : ''}
    ${brand.verificationLevel==='premium'?`<div style="margin-top:8px;"><span style="background:rgba(255,255,255,0.2);color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">⚡ Premium Brand</span></div>`:''}
  </div>

  <!-- Stats Row -->
  <div class="bz-profile-stats">
    <div class="bz-stat-item">
      <span id="brandProfileFollowers" style="font-size:1.3rem;font-weight:800;">${followers}</span>
      <span>Followers</span>
    </div>
    <div class="bz-stat-divider"></div>
    <div class="bz-stat-item">
      <span style="font-size:1.3rem;font-weight:800;">${brandProds.length}</span>
      <span>Products</span>
    </div>
    <div class="bz-stat-divider"></div>
    <div class="bz-stat-item">
      <span style="font-size:1.3rem;font-weight:800;">${avgRating}</span>
      <span>Avg Rating</span>
    </div>
    <div class="bz-stat-divider"></div>
    <div class="bz-stat-item">
      <span style="font-size:1.3rem;font-weight:800;">${reviews.length}</span>
      <span>Reviews</span>
    </div>
  </div>

  <!-- Actions -->
  <div style="padding:14px 16px;background:var(--card);border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center;">
    ${followBtn}
    <button class="bz-profile-action-btn" onclick="bzBrand.openReviewModal('${brand.brandId}','${escq(brand.name)}')">⭐ Rate</button>
    <button class="bz-profile-action-btn" onclick="bzBrand.messageWhatsApp('${brand.brandId}')">💬 Message</button>
  </div>

  <!-- Coupons -->
  ${couponsHtml ? `<div style="padding:12px 16px;">${couponsHtml}</div>` : ''}

  <!-- Products -->
  <div style="padding:16px;">
    ${collectionsHtml}
    <div style="font-size:14px;font-weight:800;margin:12px 0 10px;">${brandProds.length} Products</div>
    <div class="product-grid" id="brandProfileProductGrid">
      ${!brandProds.length ? '<p style="color:var(--muted);text-align:center;padding:30px;grid-column:1/-1;">No products yet</p>' : ''}
    </div>
  </div>

  <!-- Reviews -->
  <div style="padding:0 16px 24px;">
    ${reviewsHtml}
    <button class="btn secondary" style="width:100%;margin-top:8px;" onclick="bzBrand.openReviewModal('${brand.brandId}','${escq(brand.name)}')">
      ⭐ Write a Review
    </button>
  </div>`;
}

function shadeColor(hex, pct) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num>>16) + pct));
  const g = Math.min(255, Math.max(0, ((num>>8)&0xff) + pct));
  const b = Math.min(255, Math.max(0, (num&0xff) + pct));
  return `#${((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}`;
}

/* ─────────────────────────────────────────────
   16. BRAND REVIEW SYSTEM
   ───────────────────────────────────────────── */
function openReviewModal(brandId, brandName) {
  const user = global.currentUser;
  if (!user) {
    toast('Login to leave a review', 'error');
    if (typeof global.showLoginModal === 'function') global.showLoginModal();
    return;
  }
  _currentBrandForReview = { brandId, brandName };
  _reviewRating = 0;
  setReviewRating(0);
  const ta = $('brandReviewText');
  if (ta) ta.value = '';
  const modal = $('brandReviewModal');
  if (modal) modal.style.display = 'flex';
}

function setReviewRating(r) {
  _reviewRating = r;
  const stars = document.querySelectorAll('#brandReviewStars .bz-rev-star');
  const labels = ['Tap a star to rate','Poor','Fair','Good','Very Good','Excellent'];
  stars.forEach(s => {
    s.textContent = parseInt(s.dataset.r) <= r ? '★' : '☆';
    s.style.color = parseInt(s.dataset.r) <= r ? '#f59e0b' : '#94a3b8';
  });
  const lbl = $('brandReviewRatingLabel');
  if (lbl) lbl.textContent = labels[r] || 'Tap a star to rate';
}

async function submitBrandReview() {
  const user = global.currentUser;
  if (!user || !_currentBrandForReview) return;
  if (!_reviewRating) { toast('Please select a rating', 'error'); return; }
  const text = ($('brandReviewText')||{}).value?.trim() || '';

  const review = {
    userId: user.uid,
    userName: user.displayName || 'User',
    rating: _reviewRating,
    text,
    createdAt: Date.now()
  };

  await dbPush(`brandReviews/${_currentBrandForReview.brandId}`, review).catch(()=>{});

  // Recompute average and update brand
  const snap = await dbGet(`brandReviews/${_currentBrandForReview.brandId}`).catch(()=>null);
  if (snap && snap.exists && snap.exists()) {
    const all = [];
    snap.forEach(c => all.push(c.val()));
    const avg = all.reduce((s,r)=>s+r.rating,0)/all.length;
    await dbUpdate(`brands/${_currentBrandForReview.brandId}`, {
      rating: parseFloat(avg.toFixed(2)),
      totalReviews: all.length
    }).catch(()=>{});
    // Update local
    const brand = _allBrands.find(b => b.brandId === _currentBrandForReview.brandId);
    if (brand) { brand.rating = avg; brand.totalReviews = all.length; brand.score = calcBrandScore(brand); }
  }

  const modal = $('brandReviewModal');
  if (modal) modal.style.display = 'none';
  toast('Review submitted! 🎉', 'success');
}

/* ─────────────────────────────────────────────
   17. BRAND COUPONS
   ───────────────────────────────────────────── */
async function showCoupons(brandId) {
  const snap = await dbGet(`brandCoupons/${brandId}`).catch(()=>null);
  const list = $('brandCouponList');
  if (!list) return;
  if (!snap || !snap.exists || !snap.exists()) {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;">No coupons available</p>';
  } else {
    const coupons = [];
    snap.forEach(c => coupons.push({ id: c.key, ...c.val() }));
    list.innerHTML = coupons.map(c => `
      <div class="bz-coupon-card">
        <div class="bz-coupon-code" onclick="bzBrand.copyCoupon('${c.code}')">${c.code}</div>
        <div style="font-size:13px;font-weight:700;color:var(--success);">${c.discount}% OFF</div>
        <div style="font-size:11px;color:var(--muted);">${c.description||''}</div>
        ${c.expiresAt ? `<div style="font-size:10px;color:var(--error);">Expires: ${new Date(c.expiresAt).toLocaleDateString()}</div>` : ''}
        <button class="btn" style="margin-top:8px;padding:6px 16px;font-size:12px;" onclick="bzBrand.copyCoupon('${c.code}')">Copy Code</button>
      </div>`).join('');
  }
  const modal = $('brandCouponModal');
  if (modal) modal.style.display = 'flex';
}

function copyCoupon(code) {
  navigator.clipboard?.writeText(code).catch(()=>{});
  toast(`Coupon code "${code}" copied!`, 'success');
}

/* ─────────────────────────────────────────────
   18. BRAND COLLECTIONS
   ───────────────────────────────────────────── */
async function showCollection(brandId, collectionId, collectionName) {
  const snap = await dbGet(`brandCollections/${brandId}/${collectionId}`).catch(()=>null);
  if (!snap || !snap.exists || !snap.exists()) return;
  const col = snap.val();
  const productIds = col.productIds || [];
  const prods = (global.products||[]).filter(p => productIds.includes(p.id));
  if (typeof global.showPage === 'function') global.showPage('productsPage');
  const grid = $('productGrid');
  if (grid && typeof global.renderProducts === 'function') global.renderProducts(prods, 'productGrid');
  const title = document.querySelector('#productsPage h2');
  if (title) title.textContent = `📦 ${collectionName}`;
}

/* ─────────────────────────────────────────────
   19. MESSAGE BRAND (WhatsApp link)
   ───────────────────────────────────────────── */
async function messageWhatsApp(brandId) {
  const snap = await dbGet(`brands/${brandId}/whatsapp`).catch(()=>null);
  const num = (snap && snap.exists && snap.exists()) ? snap.val() : null;
  if (num) {
    window.open(`https://wa.me/${num}`, '_blank');
  } else {
    toast('Contact info not available for this brand', 'info');
  }
}

/* ─────────────────────────────────────────────
   20. ADD BRAND FORM
   ───────────────────────────────────────────── */
function openAddBrand() {
  const user = global.currentUser;
  if (!user) {
    toast('Please login to add a brand', 'error');
    if (typeof global.showLoginModal === 'function') global.showLoginModal();
    return;
  }
  const modal = $('addBrandModal');
  if (modal) modal.style.display = 'flex';
}
function closeAddBrand() {
  const modal = $('addBrandModal');
  if (modal) modal.style.display = 'none';
}

async function submitAddBrand() {
  const user = global.currentUser;
  if (!user) return;

  const name    = ($('newBrandName')||{}).value?.trim();
  const desc    = ($('newBrandDesc')||{}).value?.trim() || '';
  const logo    = ($('newBrandLogo')||{}).value?.trim() || '';
  const banner  = ($('newBrandBanner')||{}).value?.trim() || '';
  const color   = ($('newBrandColor')||{}).value || '#2563eb';

  if (!name) { toast('Brand name is required', 'error'); return; }
  if (name.length < 2) { toast('Brand name too short', 'error'); return; }

  // Duplicate check
  const nameLower = name.toLowerCase();
  const duplicate = _allBrands.some(b => b.name.toLowerCase() === nameLower);
  if (duplicate) { toast('This brand name already exists!', 'error'); return; }

  // Check in DB
  const snap = await dbGet('brands').catch(()=>null);
  if (snap && snap.exists && snap.exists()) {
    let found = false;
    snap.forEach(c => {
      if ((c.val().name||'').toLowerCase() === nameLower) found = true;
    });
    if (found) { toast('This brand already exists!', 'error'); return; }
  }

  const brandId = name.toLowerCase().replace(/[^a-z0-9]/g,'_') + '_' + Date.now().toString(36);
  const brandData = {
    ...BRAND_SCHEMA,
    brandId,
    name,
    description: desc,
    logo,
    banner,
    themeColor: color,
    ownerId: user.uid,
    createdAt: Date.now(),
    pendingApproval: true,
    followersCount: 0,
    rating: 0,
    totalProducts: 0,
    totalReviews: 0,
    isVerified: false,
    verificationLevel: 'normal',
    score: 0
  };
  delete brandData.brandId;

  await dbSet(`brands/${brandId}`, brandData).catch(()=>{});
  closeAddBrand();
  toast('Brand submitted for approval! ✅', 'success');
  // Clear form
  ['newBrandName','newBrandDesc','newBrandLogo','newBrandBanner'].forEach(id=>{
    const el = $(id); if(el) el.value='';
  });
}

/* ─────────────────────────────────────────────
   21. BRAND FILTER ON PRODUCTS PAGE
   ───────────────────────────────────────────── */
let _activeBrandFilter = null;

function initBrandFilter() {
  const section = $('brandFilterSection');
  const chips   = $('brandFilterChips');
  if (!section || !chips) return;

  // Only show if brands are loaded
  const brands = (_allBrands.length ? _allBrands : []).slice(0,8);
  if (!brands.length) return;

  section.style.display = 'block';
  chips.innerHTML = brands.map(b => `
    <button class="bz-filter-chip" data-id="${b.brandId}" onclick="bzBrand.applyBrandFilter('${b.brandId}','${escq(b.name)}',this)">
      ${b.name}
    </button>`).join('');
}

function applyBrandFilter(brandId, brandName, chipEl) {
  if (_activeBrandFilter === brandId) {
    // Deselect
    _activeBrandFilter = null;
    document.querySelectorAll('.bz-filter-chip').forEach(c => c.classList.remove('active'));
    if (typeof global.renderProducts === 'function') global.renderProducts(global.products||[], 'productGrid');
    return;
  }
  _activeBrandFilter = brandId;
  document.querySelectorAll('.bz-filter-chip').forEach(c => c.classList.remove('active'));
  if (chipEl) chipEl.classList.add('active');

  const filtered = (global.products||[]).filter(p => {
    const bid = p.brandId || (p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
    return bid === brandId || (p.brand||'').toLowerCase() === brandName.toLowerCase();
  });
  if (typeof global.renderProducts === 'function') global.renderProducts(filtered, 'productGrid');
}

function clearBrandFilter() {
  _activeBrandFilter = null;
  document.querySelectorAll('.bz-filter-chip').forEach(c => c.classList.remove('active'));
  if (typeof global.renderProducts === 'function') global.renderProducts(global.products||[], 'productGrid');
}

/* ─────────────────────────────────────────────
   22. SEARCH: INCLUDE BRANDS IN RESULTS
   ───────────────────────────────────────────── */
function searchBrandsInResults(query) {
  if (!query) {
    const sec = $('searchBrandResults');
    if (sec) sec.style.display = 'none';
    return;
  }
  const matched = _allBrands.filter(b => b.name.toLowerCase().includes(query.toLowerCase())).slice(0,5);
  const sec = $('searchBrandResults');
  const grid = $('searchBrandResultsGrid');
  if (!sec || !grid) return;
  if (!matched.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  grid.innerHTML = matched.map(b => {
    const avatar = renderBrandAvatar(b, 40, '10px');
    const badge = getVerificationBadge(b);
    return `<div class="bz-search-brand-chip" onclick="bzBrand.openProfile('${b.brandId}','${escq(b.name)}')">
      ${avatar}
      <div style="font-size:12px;font-weight:700;">${b.name}${badge}</div>
      <div style="font-size:10px;color:var(--muted);">${b.products.length} products</div>
    </div>`;
  }).join('');
}

/* ─────────────────────────────────────────────
   23. FOLLOWING SECTION (HOME PAGE)
   ───────────────────────────────────────────── */
async function loadFollowingSection() {
  const user = global.currentUser;
  const section = $('followingProductsSection');
  if (!section) return;

  if (!user) { section.style.display = 'none'; return; }

  const followedIds = await getFollowedBrandIds();
  if (!followedIds.length) { section.style.display = 'none'; return; }

  // Brand logos
  const logosEl = $('followingBrandLogos');
  if (logosEl) {
    const followedBrands = _allBrands.filter(b => followedIds.includes(b.brandId)).slice(0,8);
    logosEl.innerHTML = followedBrands.map(b => `
      <div class="bz-following-logo-item" onclick="bzBrand.openProfile('${b.brandId}','${escq(b.name)}')">
        ${renderBrandAvatar(b, 42, '50%')}
        <span style="font-size:9px;text-align:center;color:var(--muted);max-width:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.name}</span>
      </div>`).join('');
  }

  // Products from followed brands
  const prods = (global.products||[]).filter(p => {
    const bid = p.brandId || (p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
    return followedIds.includes(bid);
  }).slice(0, 8);

  if (!prods.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  if (typeof global.renderProducts === 'function') {
    global.renderProducts(prods, 'followingProductsGrid');
  }

  // Suggested brands on home
  loadSuggestedBrandsHome(followedIds);
}

async function loadSuggestedBrandsHome(followedIds) {
  if (!_allBrands.length) return;
  const suggested = getSuggestedBrands(_allBrands, followedIds||[]);
  const homeSection = $('suggestedBrandsHomeSection');
  const homeGrid = $('suggestedBrandsHomeGrid');
  if (!homeSection || !homeGrid) return;
  if (!suggested.length) { homeSection.style.display = 'none'; return; }
  homeSection.style.display = 'block';
  homeGrid.innerHTML = suggested.map(b => buildPopularCard(b, followedIds||[])).join('');
}

/* ─────────────────────────────────────────────
   24. NOTIFICATIONS
   ───────────────────────────────────────────── */
function listenBrandNotifications() {
  const user = global.currentUser;
  if (!user) return;
  const followedKey = 'bz_followed_brands_' + user.uid;
  const followed = JSON.parse(localStorage.getItem(followedKey) || '[]');
  if (!followed.length) return;

  followed.forEach(brandId => {
    const r = dbRef(`brandNotifications/${brandId}`);
    if (!r) return;
    r.limitToLast(1).on('child_added', snap => {
      const n = snap.val();
      if (!n || snap.key === localStorage.getItem('bz_last_notif_' + brandId)) return;
      localStorage.setItem('bz_last_notif_' + brandId, snap.key);
      if (n.type === 'new_product') {
        toast(`🛍️ ${n.brandName} added a new product!`, 'info');
        addNotification({ message: `🛍️ ${n.brandName} added: ${n.productName}`, ts: n.ts });
      } else if (n.type === 'new_offer') {
        toast(`🏷️ ${n.brandName} has a new offer!`, 'success');
        addNotification({ message: `🏷️ ${n.brandName}: ${n.offerText}`, ts: n.ts });
      }
    });
  });
}

function addNotification(notif) {
  if (typeof global.addNotification === 'function') global.addNotification(notif);
  else {
    const saved = JSON.parse(localStorage.getItem('bz_notifications') || '[]');
    saved.unshift(notif);
    localStorage.setItem('bz_notifications', JSON.stringify(saved.slice(0, 50)));
  }
}

/* ─────────────────────────────────────────────
   25. PRODUCT CARD BRAND BADGE
   Patch renderProducts to inject brand info
   ───────────────────────────────────────────── */
function patchProductCards() {
  const origRender = global.renderProducts;
  if (typeof origRender !== 'function') return;

  global.renderProducts = function(prods, gridId, options) {
    origRender.call(this, prods, gridId, options);
    // After rendering, inject brand badges
    const grid = $(gridId);
    if (!grid) return;
    setTimeout(() => {
      grid.querySelectorAll('.product-card').forEach(card => {
        const pid = card.dataset.productId || card.dataset.id;
        const prod = (prods||[]).find(p => p.id === pid);
        if (!prod || !prod.brand) return;

        // Remove product ID display
        card.querySelectorAll('.product-id, .product-sku-small, [class*="sku"]').forEach(el => {
          if (el.textContent && /^[A-Z0-9#\-]+$/.test(el.textContent.trim())) el.style.display='none';
        });

        // Add brand badge if not already present
        if (!card.querySelector('.bz-card-brand')) {
          const brand = _allBrands.find(b =>
            b.name.toLowerCase() === (prod.brand||'').toLowerCase() ||
            b.brandId === prod.brandId
          );
          const badge = brand ? getVerificationBadge(brand) : '';
          const logo = (brand && brand.logo) ?
            `<img src="${brand.logo}" style="width:16px;height:16px;border-radius:4px;object-fit:cover;" onerror="this.style.display='none'">` :
            `<div style="width:16px;height:16px;border-radius:4px;background:${getBrandColor(prod.brand,'')};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:8px;font-weight:800;">${(prod.brand||'?').slice(0,1).toUpperCase()}</div>`;

          const brandEl = document.createElement('div');
          brandEl.className = 'bz-card-brand';
          brandEl.innerHTML = `${logo}<span>${prod.brand}${badge}</span>`;
          brandEl.onclick = (e) => {
            e.stopPropagation();
            if (brand) openProfile(brand.brandId, brand.name);
          };

          const body = card.querySelector('.card-body, .product-info, .product-card-body');
          if (body) body.insertBefore(brandEl, body.firstChild);
        }
      });
    }, 100);
  };
}

/* ─────────────────────────────────────────────
   26. CATEGORY TAG CLICK FIX
   ───────────────────────────────────────────── */
function fixCategoryTagClicks() {
  document.addEventListener('click', e => {
    const tag = e.target.closest('.category-tag, .search-tag, .tag-chip, [data-category]');
    if (!tag) return;
    const cat = tag.dataset.category || tag.textContent?.trim();
    if (!cat) return;
    // Trigger search
    if (typeof global.showPage === 'function') global.showPage('searchResultsPage');
    const inp = $('searchResultsInput') || $('searchPanelInput');
    if (inp) { inp.value = cat; inp.dispatchEvent(new Event('input')); }
    if (typeof global.performSearch === 'function') global.performSearch(cat);
  });
}

/* ─────────────────────────────────────────────
   27. BRAND ANALYTICS (Owner View)
   ───────────────────────────────────────────── */
async function loadBrandAnalytics(brandId) {
  const [followerSnap, reviewSnap, prodSnap] = await Promise.all([
    dbGet(`brandFollowers/${brandId}`),
    dbGet(`brandReviews/${brandId}`),
    dbGet('products')
  ]).catch(()=>[null,null,null]);

  const followers = followerSnap && followerSnap.exists && followerSnap.exists() ? Object.keys(followerSnap.val()||{}).length : 0;
  const reviews = [];
  if (reviewSnap && reviewSnap.exists && reviewSnap.exists()) reviewSnap.forEach(c=>reviews.push(c.val()));
  const avgRating = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '0';

  let prodCount = 0;
  if (prodSnap && prodSnap.exists && prodSnap.exists()) {
    prodSnap.forEach(c => {
      const p = c.val();
      if (p && p.brandId === brandId) prodCount++;
    });
  }
  return { followers, avgRating, prodCount, totalReviews: reviews.length };
}

/* ─────────────────────────────────────────────
   28. BRAND TAB FILTER
   ───────────────────────────────────────────── */
function setTab(tab, btnEl) {
  _currentTab = tab;
  document.querySelectorAll('.bz-brand-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderBrandsPage();
}

/* ─────────────────────────────────────────────
   29. SEARCH FILTER
   ───────────────────────────────────────────── */
function filterBrands() {
  renderBrandsPage();
}

/* ─────────────────────────────────────────────
   30. SHOW PAGE HOOK — load brands on demand
   ───────────────────────────────────────────── */
function hookShowPage() {
  const orig = global.showPage;
  if (typeof orig !== 'function') return;
  global.showPage = function(pageId, ...args) {
    orig.call(this, pageId, ...args);
    if (pageId === 'brandsPage') {
      loadAllBrands().then(() => renderBrandsPage());
    }
    if (pageId === 'productsPage') {
      loadAllBrands().then(() => initBrandFilter());
    }
    if (pageId === 'homePage') {
      loadAllBrands().then(() => loadFollowingSection());
    }
  };
}

/* ─────────────────────────────────────────────
   31. PATCH SEARCH TO INCLUDE BRANDS
   ───────────────────────────────────────────── */
function hookSearch() {
  const inp = $('searchResultsInput');
  if (inp && !inp.dataset.brandHooked) {
    inp.dataset.brandHooked = '1';
    inp.addEventListener('input', () => searchBrandsInResults(inp.value));
  }
  const panelInp = $('searchPanelInput');
  if (panelInp && !panelInp.dataset.brandHooked) {
    panelInp.dataset.brandHooked = '1';
    panelInp.addEventListener('input', () => searchBrandsInResults(panelInp.value));
  }
}

/* ─────────────────────────────────────────────
   32. PUBLIC API
   ───────────────────────────────────────────── */
global.bzBrand = {
  openProfile,
  toggleFollow,
  openAddBrand,
  closeAddBrand,
  submitAddBrand,
  openReviewModal,
  setReviewRating,
  submitBrandReview,
  showCoupons,
  copyCoupon,
  showCollection,
  messageWhatsApp,
  applyBrandFilter,
  clearBrandFilter,
  filterBrands,
  setTab,
  loadAnalytics: loadBrandAnalytics,
  searchBrands: searchBrandsInResults,
  generateProductCode,
  generateUniqueProductCode,
  loadAll: loadAllBrands,
  getFollowed: getFollowedBrandIds,
};

/* ─────────────────────────────────────────────
   33. INITIALISE
   ───────────────────────────────────────────── */
function init() {
  hookShowPage();
  hookSearch();
  patchProductCards();
  fixCategoryTagClicks();

  // Wait for Firebase then load brands quietly
  waitFor(() => !!(global.firebase && global.firebase.database), () => {
    loadAllBrands().then(() => {
      // If brands page is currently active
      if (document.querySelector('#brandsPage.active')) renderBrandsPage();
      // Load following on home
      if (document.querySelector('#homePage.active')) loadFollowingSection();
      // Init brand filter if on products page
      if (document.querySelector('#productsPage.active')) initBrandFilter();
    });
    // Notifications
    waitFor(() => !!global.currentUser, () => {
      listenBrandNotifications();
      loadFollowingSection();
    }, 500, 30);
  }, 200, 40);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 300);
}

})(window);
