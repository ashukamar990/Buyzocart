/**
 * ================================================================
 * BUYZO CART — brand.js  (Optional Brand Module)
 *
 * HOST this file → Full brand system enabled
 * REMOVE this file → Zero brand features, site works normally
 * ================================================================
 */
(function BuyzoCartBrands() {
  'use strict';

  // ── Blue Tick SVG ──
  var BT = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;margin-left:2px;flex-shrink:0;"><path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/><polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ── Globals ──
  var COLORS = ['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];
  function col(name) { return COLORS[(name||'A').charCodeAt(0) % COLORS.length]; }
  function fb() { return window.firebase; }
  function uid() { return window.currentUser ? window.currentUser.uid : null; }

  // Tell main.js brand system is active
  window.__BZ_BRAND_SYSTEM = true;
  window.__BZ_BLUE_TICK = BT;

  // ── 1. Show Brands menu item (it's hidden by default in HTML) ──
  function showBrandsMenu() {
    var el = document.getElementById('bzBrandsMenuItem');
    if (el) el.style.display = '';
  }

  // ── 2. Brand cache loader ──
  function loadBrandCache(cb) {
    if (window.__bzBrandsCache && window.__bzBrandsCache.length) { if(cb) cb(); return; }
    var f = fb(); if (!f || !f.database) { setTimeout(function(){ loadBrandCache(cb); }, 800); return; }
    Promise.all([
      f.get(f.ref(f.database,'brands')),
      f.get(f.ref(f.database,'products'))
    ]).then(function(res) {
      var map = {};
      if (res[0] && res[0].exists()) {
        res[0].forEach(function(c) {
          var b = c.val(); if (!b||!b.name) return;
          map[c.key] = { id:c.key, name:b.name, logo:b.logo||'',
            banner:b.banner||b.bannerUrl||b.bannerImage||b.coverImage||b.cover||b.brandBanner||'',
            description:b.description||'', blueTickAdmin:!!b.blueTickAdmin,
            verificationLevel:b.verificationLevel||'normal',
            followers:b.followersCount||b.followers||0, rating:b.rating||0, products:[] };
        });
      }
      if (res[1] && res[1].exists()) {
        res[1].forEach(function(c) {
          var p = c.val(); if(!p||!p.brand) return;
          var bid = p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
          if (!map[bid]) map[bid]={ id:bid,name:p.brandName||p.brand,logo:'',banner:'',description:'',blueTickAdmin:false,verificationLevel:'normal',followers:0,rating:0,products:[] };
          map[bid].products.push(c.key);
        });
      }
      var arr = Object.values(map).filter(function(b){ return b.products.length>0||b.blueTickAdmin; });
      arr.sort(function(a,b2){ return ((b2.followers||0)+(b2.blueTickAdmin?5000:0)) - ((a.followers||0)+(a.blueTickAdmin?5000:0)); });
      window.__bzBrandsCache = arr;
      if (cb) cb();
    }).catch(function(){});
  }

  // ── 3. Following brands strip on Home page ──
  function renderFollowingStrip() {
    var u = uid(); if (!u) return;
    var f = fb(); if (!f||!f.database) return;
    f.get(f.ref(f.database,'brandFollowers')).then(function(snap) {
      var ids = [];
      if (snap.exists()) snap.forEach(function(c){ if(c.val()&&c.val()[u]) ids.push(c.key); });
      if (!ids.length) return;
      var sec = document.getElementById('followingProductsSection'); if (!sec) return;
      sec.style.display = 'block';
      var row = document.getElementById('bzFollowingBrandsIcons'); if (!row) return;
      row.innerHTML = '';
      var all = window.__bzBrandsCache||[];
      var list = ids.map(function(id){ return all.find(function(b){return b.id===id;})||{id:id,name:id,logo:'',blueTickAdmin:false}; });
      list.forEach(function(b) {
        var c2 = col(b.name), ini = (b.name||'B').slice(0,2).toUpperCase();
        var lInner = b.logo
          ? '<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\'">'
          : '<span style="font-size:15px;font-weight:800;color:#fff;">'+ini+'</span>';
        var tick = b.blueTickAdmin ? '<div style="position:absolute;bottom:-2px;right:-2px;background:#fff;border-radius:50%;padding:1px;">'+BT.replace('width="14"','width="11"').replace('height="14"','height="11"')+'</div>' : '';
        var item = document.createElement('div');
        item.style.cssText = 'flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;min-width:58px;';
        item.innerHTML = '<div style="position:relative;width:54px;height:54px;"><div style="width:54px;height:54px;border-radius:50%;border:2.5px solid #2563eb;background:'+c2+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+lInner+'</div>'+tick+'</div>'
          +'<span style="font-size:10px;font-weight:700;max-width:62px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b.name||'')+'</span>';
        item.addEventListener('click', function(){ window.showBrandProfile(b.id, b.name); });
        row.appendChild(item);
      });
    }).catch(function(){});
  }
  window.loadFollowingProducts = renderFollowingStrip;

  // ── 4. Open brands page ──
  window.bzOpenBrandsPage = function() {
    if (typeof showPage === 'function') showPage('brandsPage');
    setTimeout(function(){
      if (window.__bzBrandsCache&&window.__bzBrandsCache.length) bzRenderBrandsPage(window.__bzBrandsCache, window.__bzFollowedSet||{});
      else bzLoadBrandsPage();
    }, 50);
  };
  window._openBrandsPage = window.bzOpenBrandsPage;

  // ── 5. Load brands page ──
  function bzLoadBrandsPage() {
    // shimmer
    if (!document.getElementById('bzShimmer')) {
      var s = document.createElement('style'); s.id='bzShimmer';
      s.textContent = '@keyframes bzShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(s);
    }
    var sp=document.getElementById('brandsLoadingSpinner'); if(sp) sp.style.display='block';
    ['popularBrandsSection','suggestedBrandsSection','otherBrandsSection','followingBrandsSection','brandsEmptyState']
      .forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display='none'; });

    // skeleton
    var pg=document.getElementById('popularBrandsGrid');
    if(pg && !pg.querySelector('[data-brand]')) {
      var pop=document.getElementById('popularBrandsSection'); if(pop) pop.style.display='block';
      pg.innerHTML='';
      for(var i=0;i<4;i++){var sk=document.createElement('div');sk.style.cssText='border-radius:16px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:bzShimmer 1.4s infinite;height:116px;';pg.appendChild(sk);}
    }

    if(window.__bzBrandsCache&&window.__bzBrandsCache.length){
      if(sp) sp.style.display='none';
      bzRenderBrandsPage(window.__bzBrandsCache, window.__bzFollowedSet||{});
      return;
    }

    loadBrandCache(function(){
      var u=uid(); var f2=fb();
      var followPromise = u&&f2 ? f2.get(f2.ref(f2.database,'brandFollowers')) : Promise.resolve(null);
      followPromise.then(function(snap){
        var followedSet={};
        if(snap&&snap.exists&&snap.exists()) snap.forEach(function(c){ if(c.val()&&c.val()[u]) followedSet[c.key]=true; });
        window.__bzFollowedSet = followedSet;
        if(sp) sp.style.display='none';
        bzRenderBrandsPage(window.__bzBrandsCache||[], followedSet);
      }).catch(function(){
        if(sp) sp.style.display='none';
        bzRenderBrandsPage(window.__bzBrandsCache||[], {});
      });
    });
  }
  window.bzLoadBrandsPageFixed = bzLoadBrandsPage;

  // ── 6. Render brands page sections ──
  function bzRenderBrandsPage(brands, followedSet) {
    followedSet = followedSet||{};
    var popSec=document.getElementById('popularBrandsSection'), popGrid=document.getElementById('popularBrandsGrid');
    var sugSec=document.getElementById('suggestedBrandsSection'), sugGrid=document.getElementById('suggestedBrandsGrid');
    var othSec=document.getElementById('otherBrandsSection'), othGrid=document.getElementById('otherBrandsGrid');
    var folSec=document.getElementById('followingBrandsSection'), folRow=document.getElementById('followingBrandsRow');
    var emptyEl=document.getElementById('brandsEmptyState');
    var sp=document.getElementById('brandsLoadingSpinner'); if(sp) sp.style.display='none';

    if(!brands.length){ if(emptyEl) emptyEl.style.display='block'; [popSec,sugSec,othSec,folSec].forEach(function(s){if(s)s.style.display='none';}); return; }
    if(emptyEl) emptyEl.style.display='none';

    // Following circles
    var followed=brands.filter(function(b){return !!followedSet[b.id];});
    if(followed.length&&folSec&&folRow){
      folSec.style.display='block'; folRow.innerHTML='';
      followed.forEach(function(b){
        var c2=col(b.name),ini=(b.name||'B').slice(0,2).toUpperCase();
        var lInner=b.logo?'<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\'">':'<span style="font-size:15px;font-weight:800;color:#fff;">'+ini+'</span>';
        var tick=b.blueTickAdmin?'<div style="position:absolute;bottom:-2px;right:-2px;background:#fff;border-radius:50%;padding:1px;">'+BT.replace('width="14"','width="11"').replace('height="14"','height="11"')+'</div>':'';
        var item=document.createElement('div');
        item.style.cssText='flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;min-width:60px;';
        item.innerHTML='<div style="position:relative;width:56px;height:56px;"><div style="width:56px;height:56px;border-radius:50%;border:2.5px solid #2563eb;background:'+c2+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+lInner+'</div>'+tick+'</div><span style="font-size:10px;font-weight:700;max-width:62px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b.name||'')+'</span>';
        item.addEventListener('click',function(){window.showBrandProfile(b.id,b.name);});
        folRow.appendChild(item);
      });
    } else if(folSec) folSec.style.display='none';

    var popular=brands.filter(function(b){return b.blueTickAdmin||b.verificationLevel==='premium'||((b.followers||0)*10+b.products.length*5)>50;});
    var nonPop=brands.filter(function(b){return popular.indexOf(b)===-1;});
    var suggested=nonPop.filter(function(b){return !followedSet[b.id];}).slice(0,6);
    var rest=nonPop.filter(function(b){return suggested.indexOf(b)===-1;});

    function fill(sec,grid,arr){
      if(!sec||!grid) return;
      if(!arr.length){sec.style.display='none';return;}
      sec.style.display='block'; grid.innerHTML='';
      var frag=document.createDocumentFragment();
      arr.forEach(function(b){frag.appendChild(makeBrandCard(b,!!followedSet[b.id]));});
      grid.appendChild(frag);
    }
    fill(popSec,popGrid,popular); fill(sugSec,sugGrid,suggested); fill(othSec,othGrid,rest);
  }

  // ── 7. Brand card ──
  function makeBrandCard(b, isFollowing) {
    var c2=col(b.name), ini=(b.name||'B').slice(0,2).toUpperCase();
    var logoInner=b.logo?'<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display=\'none\'">':'<span style="font-size:18px;font-weight:800;color:#fff;">'+ini+'</span>';
    var safeName=(b.name||'').replace(/'/g,'').replace(/"/g,'');
    var followBtn=uid()?'<button onclick="event.stopPropagation();window.toggleBrandFollow(\''+b.id+'\',\''+safeName+'\',this)" style="margin-top:9px;width:100%;padding:7px 0;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;'+(isFollowing?'background:#f1f5f9;color:#64748b;':'background:#2563eb;color:#fff;')+'">'+(isFollowing?'✓ Following':'+ Follow')+'</button>':'';
    var bannerTop=b.banner?'<div style="height:44px;margin:-14px -14px 10px;background:url('+JSON.stringify(b.banner)+') center/cover no-repeat;border-radius:14px 14px 0 0;"></div>':'';
    var el=document.createElement('div');
    el.setAttribute('data-brand',b.id);
    el.style.cssText='background:var(--surface,#fff);border:1.5px solid #e2e8f0;border-radius:16px;padding:14px;cursor:pointer;transition:all .2s;';
    el.innerHTML=bannerTop+'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><div style="width:46px;height:46px;border-radius:12px;background:'+c2+';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid #f1f5f9;">'+logoInner+'</div><div style="flex:1;min-width:0;"><div style="font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:3px;">'+(b.name||'')+(b.blueTickAdmin?'&nbsp;'+BT:'')+'</div>'+(b.description?'<div style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+b.description+'</div>':'')+'</div></div><div style="font-size:11px;color:#64748b;display:flex;gap:10px;"><span>📦 '+b.products.length+'</span>'+(b.followers?'<span>❤️ '+b.followers+'</span>':'')+(b.rating?'<span>⭐ '+b.rating+'</span>':'')+'</div>'+followBtn;
    el.addEventListener('mouseenter',function(){this.style.borderColor='#2563eb';this.style.boxShadow='0 6px 20px rgba(37,99,235,.14)';this.style.transform='translateY(-1px)';});
    el.addEventListener('mouseleave',function(){this.style.borderColor='#e2e8f0';this.style.boxShadow='none';this.style.transform='';});
    el.addEventListener('click',function(e){if(e.target.tagName==='BUTTON'||e.target.closest('button'))return;window.showBrandProfile(b.id,b.name);});
    return el;
  }

  // ── 8. Brand profile ──
  window.showBrandProfile = function(brandId, brandName) {
    var pageEl = document.getElementById('brandProfilePage');
    if (!pageEl) {
      pageEl = document.createElement('section');
      pageEl.id = 'brandProfilePage'; pageEl.className = 'page';
      (document.querySelector('main')||document.body).appendChild(pageEl);
    }
    pageEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:60vh;"><div style="width:38px;height:38px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite;"></div></div>';
    if (typeof showPage === 'function') showPage('brandProfilePage');
    window.scrollTo(0,0);

    var f2=fb(); if(!f2) return;
    Promise.all([
      f2.get(f2.ref(f2.database,'brands/'+brandId)),
      f2.get(f2.ref(f2.database,'brandFollowers/'+brandId))
    ]).then(function(res){
      var bd=res[0].exists()?res[0].val():{};
      var followSnap=res[1];
      var name=bd.name||brandName||'Brand';
      var c2=col(name), ini=name.slice(0,2).toUpperCase();
      var logo=bd.logo||'', desc=bd.description||'';
      var isVerified=!!bd.blueTickAdmin;
      var followers=0; if(followSnap.exists()) followSnap.forEach(function(){followers++;});
      var bannerUrl=bd.banner||bd.bannerUrl||bd.bannerImage||bd.coverImage||bd.cover||bd.brandBanner||'';
      var bannerStyle,bannerOverlay='';
      if(bannerUrl){ bannerStyle='background:url('+JSON.stringify(bannerUrl)+') center/cover no-repeat;'; }
      else if(logo){ bannerStyle='background:url('+JSON.stringify(logo)+') center/cover no-repeat;'; bannerOverlay='<div style="position:absolute;inset:0;backdrop-filter:blur(18px) brightness(.65);-webkit-backdrop-filter:blur(18px) brightness(.65);"></div>'; }
      else { bannerStyle='background:linear-gradient(135deg,'+c2+'dd,'+c2+'88);'; }
      var logoHtml=logo?'<img src="'+logo+'" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">':'<span style="font-size:26px;font-weight:800;color:#fff;">'+ini+'</span>';
      var verBadge=isVerified?('&ensp;'+BT):'';
      var safeName=name.replace(/'/g,'').replace(/"/g,'');
      var u2=uid();
      var isFollowing=u2&&followSnap.exists()&&followSnap.val()&&followSnap.val()[u2];
      var followBtn=u2?'<button id="brandFollowBtn" onclick="window.toggleBrandFollow(\''+brandId+'\',\''+safeName+'\',this)" style="padding:10px 28px;border-radius:50px;border:none;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;'+(isFollowing?'background:#f1f5f9;color:#475569;':'background:#2563eb;color:#fff;')+'">'+(isFollowing?'✓ Following':'+ Follow')+'</button>&nbsp;<button onclick="window.bzOpenBrandsPage()" style="padding:10px 20px;border-radius:50px;border:1.5px solid #e2e8f0;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;background:#fff;color:#0f172a;">Shop Now</button>':'';
      var allProds=window.products||[];
      var brandProds=allProds.filter(function(p){var bid=p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');return bid===brandId||(p.brand||'').toLowerCase()===(name||'').toLowerCase();});

      pageEl.innerHTML='<div style="max-width:640px;margin:0 auto;">'
        +'<div style="padding:12px 16px;display:flex;align-items:center;gap:10px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:20;box-shadow:0 1px 4px rgba(0,0,0,.06);">'
          +'<button onclick="history.back()" style="width:36px;height:36px;border-radius:50%;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>'
          +'<span style="font-weight:800;font-size:15px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+name+'</span>'
        +'</div>'
        +'<div style="position:relative;padding-bottom:36px;">'
          +'<div style="height:130px;'+bannerStyle+'position:relative;overflow:hidden;">'+bannerOverlay+'</div>'
          +'<div id="bpLogoHolder" style="position:absolute;bottom:0;left:18px;width:68px;height:68px;border-radius:18px;border:3.5px solid #fff;background:'+c2+';display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer;z-index:5;">'+logoHtml+'</div>'
        +'</div>'
        +'<div style="background:#fff;padding:10px 18px 16px;border-bottom:1px solid #e2e8f0;">'
          +'<div style="font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:4px;">'+name+verBadge+'</div>'
          +(desc?'<p style="font-size:13px;color:#64748b;margin:6px 0 10px;line-height:1.5;">'+desc+'</p>':'')
          +'<div style="display:flex;gap:24px;margin:12px 0 16px;">'
            +'<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;" id="brandFollowerCount">'+followers+'</div><div style="font-size:11px;color:#64748b;font-weight:600;">Followers</div></div>'
            +'<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;">'+brandProds.length+'</div><div style="font-size:11px;color:#64748b;font-weight:600;">Products</div></div>'
            +(bd.rating?'<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;">⭐ '+bd.rating+'</div><div style="font-size:11px;color:#64748b;font-weight:600;">'+(bd.totalReviews||0)+' Reviews</div></div>':'')
          +'</div>'
          +'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+followBtn+'</div>'
        +'</div>'
        +'<div id="bpAlsoFollowing" style="display:none;padding:14px 16px;background:#fafafa;border-bottom:1px solid #f1f5f9;">'
          +'<div style="font-weight:800;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Also Following</div>'
          +'<div id="bpAlsoFollowingRow" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>'
        +'</div>'
        +'<div style="padding:16px;">'
          +'<div style="font-weight:800;font-size:14px;margin-bottom:12px;">🛍️ '+brandProds.length+' Products</div>'
          +(brandProds.length?'<div class="product-grid" id="brandProductsGrid"></div>':'<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">No products listed yet</div>')
        +'</div>'
      +'</div>';

      if(brandProds.length&&typeof renderProducts==='function') setTimeout(function(){ renderProducts(brandProds,'brandProductsGrid'); },30);

      // Logo hold → full preview
      setTimeout(function(){
        var h=document.getElementById('bpLogoHolder'); if(!h) return;
        var ht;
        function prev(){ var ov=document.createElement('div'); ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;'; ov.innerHTML=logo?'<img src="'+logo+'" style="max-width:88vw;max-height:88vh;border-radius:20px;object-fit:contain;">':'<div style="width:180px;height:180px;border-radius:28px;background:'+c2+';display:flex;align-items:center;justify-content:center;font-size:60px;font-weight:800;color:#fff;">'+ini+'</div>'; ov.addEventListener('click',function(){document.body.removeChild(ov);}); document.body.appendChild(ov); }
        h.addEventListener('mousedown',function(){ht=setTimeout(prev,500);}); h.addEventListener('mouseup',function(){clearTimeout(ht);}); h.addEventListener('mouseleave',function(){clearTimeout(ht);});
        h.addEventListener('touchstart',function(){ht=setTimeout(prev,500);},{passive:true}); h.addEventListener('touchend',function(){clearTimeout(ht);}); h.addEventListener('touchmove',function(){clearTimeout(ht);},{passive:true});
        h.addEventListener('contextmenu',function(e){e.preventDefault();prev();});
      },200);

      // Also following
      setTimeout(function(){
        var f3=fb(); if(!f3) return;
        f3.get(f3.ref(f3.database,'brandFollowers')).then(function(allSnap){
          var ids=[];
          if(allSnap.exists()) allSnap.forEach(function(c){var v=c.val();if(v&&v[brandId]&&c.key!==brandId)ids.push(c.key);});
          if(!ids.length) return;
          var list=(window.__bzBrandsCache||[]).filter(function(b){return ids.indexOf(b.id)!==-1;}).slice(0,20);
          if(!list.length) return;
          var sec=document.getElementById('bpAlsoFollowing'),row=document.getElementById('bpAlsoFollowingRow');
          if(!sec||!row) return; sec.style.display='block';
          list.forEach(function(b2){
            var bc=col(b2.name),bi=(b2.name||'B').slice(0,2).toUpperCase();
            var li2=b2.logo?'<img src="'+b2.logo+'" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">':'<span style="font-size:13px;font-weight:800;color:#fff;">'+bi+'</span>';
            var it=document.createElement('div'); it.style.cssText='flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
            it.innerHTML='<div style="width:46px;height:46px;border-radius:12px;border:2px solid #e2e8f0;background:'+bc+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+li2+'</div><span style="font-size:9px;font-weight:700;max-width:54px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b2.name||'').slice(0,10)+(b2.blueTickAdmin?BT.replace('width="14"','width="9"').replace('height="14"','height="9"'):'')+'</span>';
            it.addEventListener('click',function(){window.showBrandProfile(b2.id,b2.name);});
            row.appendChild(it);
          });
        }).catch(function(){});
      },500);

      window.scrollTo(0,0);
    }).catch(function(err){console.error('Brand profile error:',err);});
  };

  // ── 9. Toggle follow ──
  window.toggleBrandFollow = function(brandId, brandName, btnEl) {
    var u2=uid(); if(!u2){if(typeof showToast==='function')showToast('Please login to follow brands','warning');return;}
    var f2=fb(), followRef=f2.ref(f2.database,'brandFollowers/'+brandId+'/'+u2);
    var btn=btnEl||document.getElementById('brandFollowBtn');
    f2.get(followRef).then(function(snap){
      if(snap.exists()){
        return f2.remove(followRef).then(function(){
          if(btn){btn.textContent='+ Follow';btn.style.background='#2563eb';btn.style.color='#fff';}
          var cnt=document.getElementById('brandFollowerCount'); if(cnt) cnt.textContent=Math.max(0,parseInt(cnt.textContent||'0')-1);
          window.__bzFollowedSet=window.__bzFollowedSet||{}; delete window.__bzFollowedSet[brandId];
          if(typeof showToast==='function') showToast('Unfollowed '+brandName,'info');
          renderFollowingStrip();
        });
      } else {
        return f2.set(followRef,{userId:u2,brandId:brandId,brandName:brandName,followedAt:Date.now()}).then(function(){
          if(btn){btn.textContent='✓ Following';btn.style.background='#f1f5f9';btn.style.color='#64748b';}
          var cnt=document.getElementById('brandFollowerCount'); if(cnt) cnt.textContent=parseInt(cnt.textContent||'0')+1;
          window.__bzFollowedSet=window.__bzFollowedSet||{}; window.__bzFollowedSet[brandId]=true;
          if(typeof showToast==='function') showToast('Following '+brandName+' 🎉','success');
          renderFollowingStrip();
        });
      }
    }).catch(function(err){if(typeof showToast==='function') showToast('Error: '+err.message,'error');});
  };

  // ── 10. Patch search suggestions ──
  function patchSearch() {
    var orig=window.showSearchSuggestions;
    if(!orig||orig._bzPatched) return;
    window.showSearchSuggestions = function(query) {
      orig.call(this,query);
      var container=document.getElementById('searchSuggestions'); if(!container||!query||query.length<1) return;
      var q=query.toLowerCase().trim();
      var matched=(window.__bzBrandsCache||[]).filter(function(b){return (b.name||'').toLowerCase().indexOf(q)!==-1;}).slice(0,3);
      if(!matched.length) return;
      var hdr=document.createElement('div'); hdr.style.cssText='padding:5px 12px 3px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-top:1px solid #f1f5f9;'; hdr.textContent='🏷️  Brands';
      container.appendChild(hdr);
      matched.forEach(function(b){
        var c2=col(b.name),ini=(b.name||'B').slice(0,2).toUpperCase();
        var logo2=b.logo?'<img src="'+b.logo+'" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">':'<div style="width:38px;height:38px;border-radius:8px;background:'+c2+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">'+ini+'</div>';
        var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .15s;';
        row.innerHTML=logo2+'<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:3px;">'+(b.name||'')+(b.blueTickAdmin?'&nbsp;'+BT:'')+'</div><div style="font-size:11px;color:#64748b;">📦 '+b.products.length+' products'+(b.followers?' ❤️ '+b.followers:'')+'</div></div><span style="font-size:10px;background:#eff6ff;color:#2563eb;padding:2px 7px;border-radius:10px;font-weight:700;">Brand</span>';
        row.addEventListener('mouseenter',function(){this.style.background='#f8fafc';}); row.addEventListener('mouseleave',function(){this.style.background='';});
        row.addEventListener('click',function(){if(typeof closeSearchPanel==='function')closeSearchPanel();window.showBrandProfile(b.id,b.name);});
        container.appendChild(row);
      });
    };
    window.showSearchSuggestions._bzPatched=true;
  }

  // ── 11. Seller → My Shop ──
  function checkSeller() {
    var u2=uid(); if(!u2) return;
    var f2=fb(); if(!f2||!f2.database) return;
    if(localStorage.getItem('bz_seller_'+u2)==='1'){applyShop();return;}
    function applyShop(){
      var t=document.getElementById('menuSellProductText'); if(t){t.textContent='My Shop';t.style.color='#7c3aed';}
      var it=document.getElementById('menuSellProductItem'); if(it){var sv=it.querySelector('svg');if(sv)sv.style.color='#7c3aed';}
      localStorage.setItem('bz_seller_'+u2,'1');
    }
    f2.get(f2.ref(f2.database,'sellers/'+u2)).then(function(s){
      if(s.exists()){var d=s.val();if(d.approved||d.status==='approved'){applyShop();return;}}
      return f2.get(f2.ref(f2.database,'sellerRequests/'+u2));
    }).then(function(s2){if(s2&&s2.exists&&s2.exists()){var d2=s2.val();if(d2&&(d2.approved||d2.status==='approved'))applyShop();}}).catch(function(){});
  }

  // ── INIT ──
  function init() {
    showBrandsMenu();
    loadBrandCache(function() {
      renderFollowingStrip();
      // Patch search after slight delay
      setTimeout(patchSearch, 600);
    });
    // Auth watcher
    var iv=setInterval(function(){
      if(window.currentUser){
        clearInterval(iv);
        setTimeout(renderFollowingStrip,1500);
        setTimeout(checkSeller,2000);
      }
    },600);

    // Hook showPage for brandsPage
    var spIv=setInterval(function(){
      if(typeof window.showPage==='function'&&!window.showPage._bzHooked){
        clearInterval(spIv);
        var _sp=window.showPage;
        window.showPage=function(p){ _sp(p); if(p==='brandsPage') setTimeout(function(){if(window.__bzBrandsCache&&window.__bzBrandsCache.length)bzRenderBrandsPage(window.__bzBrandsCache,window.__bzFollowedSet||{});else bzLoadBrandsPage();},40); };
        window.showPage._bzHooked=true;
      }
    },200);
  }

  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded',init);

  // ── Show brand tags on all existing product cards ──
  // Cards rendered before brand.js loaded have display:none brand divs
  function bzShowBrandTags() {
    document.querySelectorAll('.bz-brand-tag').forEach(function(el) {
      el.style.display = 'inline-flex';
      // Add blue tick if brand is verified
      var card = el.closest('[data-product-id], .product-card, [class*="product"]');
      var brandName = el.querySelector('span') ? el.querySelector('span').textContent : '';
      if (!brandName || el.querySelector('svg')) return; // already has tick
      var cB = (window.__bzBrandsCache||[]).find(function(x){ return x.name === brandName; });
      if (cB && cB.blueTickAdmin) {
        el.insertAdjacentHTML('beforeend', window.__BZ_BLUE_TICK||'');
      }
    });
  }

  // Run after cache loads and also observe DOM for new cards
  function bzStartBrandTagObserver() {
    bzShowBrandTags();
    // MutationObserver for dynamically added cards
    var obs = new MutationObserver(function(mutations) {
      var hasNew = false;
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(n) {
          if (n.nodeType === 1 && n.querySelector && n.querySelector('.bz-brand-tag')) hasNew = true;
        });
      });
      if (hasNew) bzShowBrandTags();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // Trigger after brand cache is ready
  var _bzTagIv = setInterval(function() {
    if (window.__bzBrandsCache || document.querySelector('.bz-brand-tag')) {
      clearInterval(_bzTagIv);
      bzStartBrandTagObserver();
    }
  }, 300);

})();
