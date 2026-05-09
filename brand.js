/**
 * ================================================================
 * BUYZO CART — brand.js
 * Brand System (optional module)
 *
 * HOW TO USE:
 *   Host this file and add to index.html:
 *     <script src="brand.js" defer></script>
 *
 *   Remove/don't host this file to disable the entire brand system:
 *   - No following brands strip
 *   - No brand option in menu
 *   - No blue tick anywhere
 *   - No brand info in product cards
 *   - No brand profile page
 * ================================================================
 */

(function BuyzoCartBrandSystem() {
  'use strict';

  // ── Blue Tick SVG Badge ──
  var BT = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 100 100" '
    + 'style="display:inline-block;vertical-align:middle;margin-left:2px;" aria-label="Verified">'
    + '<path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/>'
    + '<polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>';
  // Signal to main.js that brand system is active
  window.__BZ_BRAND_SYSTEM = true;
  window.__BZ_BLUE_TICK = BT;

  var BZ_COLORS = ['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];
  function _bzCol(name) { return BZ_COLORS[(name||'A').charCodeAt(0) % BZ_COLORS.length]; }
  function _fb() { return window.firebase; }

  // ════════════════════════════════════════════════
  // 1. INJECT BRANDS PAGE & MENU ITEM INTO DOM
  // ════════════════════════════════════════════════
  function injectBrandsPageHTML() {
    if (document.getElementById('brandsPage')) return; // already exists
    var brandsPageHTML = `
  <section class="page" id="brandsPage" style="background:#f8fafc;min-height:100vh;">
    <div style="background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:30;box-shadow:0 1px 6px rgba(0,0,0,.06);">
      <div style="max-width:720px;margin:0 auto;padding:11px 16px;display:flex;align-items:center;gap:10px;">
        <button onclick="showPage('homePage')" style="width:36px;height:36px;border-radius:50%;border:1.5px solid #e2e8f0;background:#f8fafc;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div style="flex:1;">
          <div style="font-size:1.05rem;font-weight:800;">🏷️ Brands</div>
          <div style="font-size:.72rem;color:#94a3b8;">Discover &amp; follow your favourite brands</div>
        </div>
        <button onclick="window.__bzBrandsCache=[];window.__bzFollowedSet={};bzLoadBrandsPage();"
          style="width:34px;height:34px;border-radius:50%;border:1.5px solid #e2e8f0;background:#f8fafc;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>
    </div>
    <div style="max-width:720px;margin:0 auto;padding:.75rem 1rem 5rem;">
      <div id="brandsLoadingSpinner" style="display:none;text-align:center;padding:3rem 1rem;">
        <div style="width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 10px;"></div>
        <p style="color:#94a3b8;font-size:13px;font-weight:600;">Loading brands...</p>
      </div>
      <div id="followingBrandsSection" style="display:none;margin-bottom:1.1rem;background:#fff;border-radius:16px;padding:14px 16px;border:1px solid #f1f5f9;box-shadow:0 1px 4px rgba(0,0,0,.04);">
        <div style="font-size:.82rem;font-weight:800;margin-bottom:12px;">❤️ Following</div>
        <div id="followingBrandsRow" style="display:flex;gap:16px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>
      </div>
      <div id="popularBrandsSection" style="display:none;margin-bottom:1.1rem;">
        <div style="font-size:.82rem;font-weight:800;margin-bottom:10px;padding:0 2px;">🔥 Popular Brands</div>
        <div id="popularBrandsGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>
      </div>
      <div id="suggestedBrandsSection" style="display:none;margin-bottom:1.1rem;">
        <div style="font-size:.82rem;font-weight:800;margin-bottom:10px;padding:0 2px;">⭐ Suggested for You</div>
        <div id="suggestedBrandsGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>
      </div>
      <div id="otherBrandsSection" style="display:none;margin-bottom:1.1rem;">
        <div style="font-size:.82rem;font-weight:800;margin-bottom:10px;padding:0 2px;">📦 All Brands</div>
        <div id="otherBrandsGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>
      </div>
      <div id="brandsEmptyState" style="display:none;text-align:center;padding:4rem 1rem;">
        <div style="font-size:3rem;margin-bottom:1rem;opacity:.35;">🏷️</div>
        <div style="font-weight:800;font-size:1rem;margin-bottom:.5rem;">No brands yet</div>
        <div style="color:#94a3b8;font-size:.85rem;">Brands will appear once sellers list products</div>
      </div>
    </div>
  </section>`;

    var mainEl = document.querySelector('main') || document.body;
    mainEl.insertAdjacentHTML('beforeend', brandsPageHTML);
  }

  function injectBrandsMenuItem() {
    // Find menu list and add Brands option if not already there
    var menuList = document.querySelector('.mobile-menu ul, #mobileMenu ul, nav ul');
    if (!menuList || document.getElementById('bzBrandsMenuItem')) return;
    var li = document.createElement('li');
    li.id = 'bzBrandsMenuItem';
    li.innerHTML = '<a onclick="window.bzOpenBrandsPage()">🏷️ Brands</a>';
    menuList.appendChild(li);
  }

  function injectFollowingStripSlot() {
    // Add brand circles slot inside followingProductsSection
    var sec = document.getElementById('followingProductsSection');
    if (!sec || document.getElementById('bzFollowingBrandsIcons')) return;
    var hdr = sec.querySelector('div');
    if (hdr) {
      var strip = document.createElement('div');
      strip.id = 'bzFollowingBrandsIcons';
      strip.style.cssText = 'display:flex;gap:14px;overflow-x:auto;padding:4px 4px 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;';
      hdr.insertAdjacentElement('afterend', strip);
    }
    // Hide product grid
    var pg = document.getElementById('followingProductsGrid');
    if (pg) pg.style.display = 'none';
  }

  // ════════════════════════════════════════════════
  // 2. BRAND CACHE LOADER
  // ════════════════════════════════════════════════
  function bzLoadBrandsPage() {
    var fb = _fb();
    if (!fb || !fb.database || !fb.get || !fb.ref) { setTimeout(bzLoadBrandsPage, 500); return; }
    // Also wait for Firebase auth to settle
    if (typeof window.firebase === 'undefined') { setTimeout(bzLoadBrandsPage, 500); return; }
    // Shimmer style
    if (!document.getElementById('bzShimmerStyle')) {
      var st = document.createElement('style');
      st.id = 'bzShimmerStyle';
      st.textContent = '@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(st);
    }
    // Show skeleton
    var sp = document.getElementById('brandsLoadingSpinner');
    if (sp) sp.style.display = 'none';
    var popSec = document.getElementById('popularBrandsSection');
    var popGrid = document.getElementById('popularBrandsGrid');
    if (popSec && popGrid && !popGrid.querySelector('[data-brand]')) {
      popSec.style.display = 'block';
      var f = document.createDocumentFragment();
      for (var si = 0; si < 4; si++) {
        var sk = document.createElement('div');
        sk.style.cssText = 'border-radius:16px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;height:116px;';
        f.appendChild(sk);
      }
      popGrid.appendChild(f);
    }
    if (window.__bzBrandsCache && window.__bzBrandsCache.length) {
      bzRenderBrands(window.__bzBrandsCache, window.__bzFollowedSet || {}); return;
    }
    var uid = window.currentUser ? window.currentUser.uid : null;
    Promise.all([
      fb.get(fb.ref(fb.database, 'brands')),
      fb.get(fb.ref(fb.database, 'products')),
      uid ? fb.get(fb.ref(fb.database, 'brandFollowers')) : Promise.resolve(null)
    ]).then(function(res) {
      var brandSnap=res[0], prodSnap=res[1], followSnap=res[2];
      var brandMap = {};
      if (brandSnap && brandSnap.exists()) {
        brandSnap.forEach(function(c) {
          var b = c.val();
          if (b && b.name) brandMap[c.key] = {
            id:c.key, name:b.name, logo:b.logo||'',
            banner:b.banner||b.bannerUrl||b.bannerImage||b.coverImage||b.cover||b.brandBanner||'',
            description:b.description||'', blueTickAdmin:!!b.blueTickAdmin,
            verificationLevel:b.verificationLevel||'normal',
            followers:b.followersCount||b.followers||0, rating:b.rating||0,
            totalReviews:b.totalReviews||0, products:[]
          };
        });
      }
      if (prodSnap && prodSnap.exists()) {
        prodSnap.forEach(function(c) {
          var p=c.val(); if(!p||!p.brand) return;
          var bid=p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
          if(!brandMap[bid]) brandMap[bid]={id:bid,name:p.brandName||p.brand,logo:p.brandLogo||'',banner:'',description:'',blueTickAdmin:false,verificationLevel:'normal',followers:0,rating:0,totalReviews:0,products:[]};
          brandMap[bid].products.push(c.key);
        });
      }
      var followedSet={};
      if (followSnap && followSnap.exists && followSnap.exists() && uid) {
        followSnap.forEach(function(c){ if(c.val()&&c.val()[uid]) followedSet[c.key]=true; });
      }
      var arr=Object.values(brandMap).filter(function(b){ return b.products.length>0||b.blueTickAdmin; });
      arr.sort(function(a,b2){
        return ((b2.followers||0)+(b2.rating||0)*100+b2.products.length*10+(b2.blueTickAdmin?5000:0))
             - ((a.followers||0)+(a.rating||0)*100+a.products.length*10+(a.blueTickAdmin?5000:0));
      });
      window.__bzBrandsCache=arr;
      window.__bzFollowedSet=followedSet;
      bzRenderBrands(arr,followedSet);
      bzRenderFollowingStrip();
    }).catch(function(err) {
      var g=document.getElementById('popularBrandsGrid');
      if(g) g.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:24px;color:#ef4444;font-size:13px;">Failed to load.<br><button onclick="window.__bzBrandsCache=[];bzLoadBrandsPage()" style="margin-top:8px;padding:8px 20px;border-radius:20px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-weight:700;font-family:inherit;">Retry</button></div>';
    });
  }
  window.bzLoadBrandsPage = bzLoadBrandsPage;
  window.bzLoadBrandsPageFixed = bzLoadBrandsPage;

  // ════════════════════════════════════════════════
  // 3. BRAND CARD
  // ════════════════════════════════════════════════
  function bzMakeBrandCard(b, isFollowing) {
    var col=_bzCol(b.name), ini=(b.name||'B').slice(0,2).toUpperCase();
    var logoInner=b.logo
      ? '<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display=\'none\'">'
      : '<span style="font-size:18px;font-weight:800;color:#fff;">'+ini+'</span>';
    var safeName=(b.name||'').replace(/'/g,'').replace(/"/g,'');
    var followBtn=window.currentUser
      ? '<button onclick="event.stopPropagation();window.toggleBrandFollow(\"'+b.id+'\",\"'+safeName+'\",this)" style="margin-top:9px;width:100%;padding:7px 0;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;'
        +(isFollowing?'background:#f1f5f9;color:#64748b;':'background:#2563eb;color:#fff;')+'">'
        +(isFollowing?'✓ Following':'+ Follow')+'</button>':'' ;
    var bannerTop=b.banner
      ? '<div style="height:44px;margin:-14px -14px 10px;background:url('+JSON.stringify(b.banner)+') center/cover no-repeat;border-radius:14px 14px 0 0;"></div>':'' ;
    var el=document.createElement('div');
    el.setAttribute('data-brand',b.id);
    el.style.cssText='background:var(--surface,#fff);border:1.5px solid #e2e8f0;border-radius:16px;padding:14px;cursor:pointer;transition:all .2s;';
    el.innerHTML=bannerTop
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
        +'<div style="width:46px;height:46px;border-radius:12px;background:'+col+';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid #f1f5f9;">'+logoInner+'</div>'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:3px;">'+(b.name||'')+(b.blueTickAdmin?'&nbsp;'+BT:'')+'</div>'
          +(b.description?'<div style="font-size:10px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+b.description+'</div>':'')
        +'</div>'
      +'</div>'
      +'<div style="font-size:11px;color:#64748b;display:flex;gap:10px;">'
        +'<span>📦 '+b.products.length+'</span>'
        +(b.followers?'<span>❤️ '+b.followers+'</span>':'')
        +(b.rating?'<span>⭐ '+b.rating+'</span>':'')
      +'</div>'+followBtn;
    el.addEventListener('mouseenter',function(){this.style.borderColor='#2563eb';this.style.boxShadow='0 6px 20px rgba(37,99,235,.14)';this.style.transform='translateY(-1px)';});
    el.addEventListener('mouseleave',function(){this.style.borderColor='#e2e8f0';this.style.boxShadow='none';this.style.transform='';});
    el.addEventListener('click',function(e){ if(e.target.tagName==='BUTTON'||e.target.closest('button')) return; window.showBrandProfile(b.id,b.name); });
    return el;
  }

  // ════════════════════════════════════════════════
  // 4. RENDER ALL BRAND SECTIONS
  // ════════════════════════════════════════════════
  function bzRenderBrands(brands, followedSet) {
    followedSet=followedSet||{};
    var popSec=document.getElementById('popularBrandsSection'),  popGrid=document.getElementById('popularBrandsGrid');
    var sugSec=document.getElementById('suggestedBrandsSection'), sugGrid=document.getElementById('suggestedBrandsGrid');
    var othSec=document.getElementById('otherBrandsSection'),    othGrid=document.getElementById('otherBrandsGrid');
    var folSec=document.getElementById('followingBrandsSection'), folRow=document.getElementById('followingBrandsRow');
    var emptyEl=document.getElementById('brandsEmptyState');

    if(!brands.length){ if(emptyEl) emptyEl.style.display='block'; [popSec,sugSec,othSec,folSec].forEach(function(s){if(s)s.style.display='none';}); return; }
    if(emptyEl) emptyEl.style.display='none';

    // Following circles
    var followed=brands.filter(function(b){return !!followedSet[b.id];});
    if(followed.length && folSec && folRow){
      folSec.style.display='block'; folRow.innerHTML='';
      followed.forEach(function(b){
        var col=_bzCol(b.name), ini=(b.name||'B').slice(0,2).toUpperCase();
        var lInner=b.logo?'<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\'">':'<span style="font-size:15px;font-weight:800;color:#fff;">'+ini+'</span>';
        var tick=b.blueTickAdmin?'<div style="position:absolute;bottom:-2px;right:-2px;background:#fff;border-radius:50%;padding:1px;">'+BT.replace(/width="15"/g,'width="12"').replace(/height="15"/g,'height="12"')+'</div>':'';
        var item=document.createElement('div');
        item.style.cssText='flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;min-width:60px;';
        item.innerHTML='<div style="position:relative;width:56px;height:56px;"><div style="width:56px;height:56px;border-radius:50%;border:2.5px solid #2563eb;background:'+col+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+lInner+'</div>'+tick+'</div><span style="font-size:10px;font-weight:700;max-width:62px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b.name||'')+'</span>';
        item.addEventListener('click',function(){window.showBrandProfile(b.id,b.name);});
        folRow.appendChild(item);
      });
    } else if(folSec) folSec.style.display='none';

    var popular=brands.filter(function(b){return b.blueTickAdmin||b.verificationLevel==='premium'||((b.followers||0)+(b.rating||0)*100+b.products.length*10)>50;});
    var nonPop=brands.filter(function(b){return popular.indexOf(b)===-1;});
    var suggested=nonPop.filter(function(b){return !followedSet[b.id];}).slice(0,6);
    var rest=nonPop.filter(function(b){return suggested.indexOf(b)===-1;});

    function fill(sec,grid,arr){
      if(!sec||!grid) return;
      if(!arr.length){sec.style.display='none';return;}
      sec.style.display='block'; grid.innerHTML='';
      var frag=document.createDocumentFragment();
      arr.forEach(function(b){frag.appendChild(bzMakeBrandCard(b,!!followedSet[b.id]));});
      grid.appendChild(frag);
    }
    fill(popSec,popGrid,popular); fill(sugSec,sugGrid,suggested); fill(othSec,othGrid,rest);
  }
  window.bzRenderBrandsFixed = bzRenderBrands;

  // ════════════════════════════════════════════════
  // 5. FOLLOWING BRANDS STRIP (Home Page)
  // ════════════════════════════════════════════════
  function bzRenderFollowingStrip() {
    if (!window.currentUser) return;
    var uid=window.currentUser.uid, fb=_fb();
    if (!fb) return;

    var allBrands=window.__bzBrandsCache||[];
    fb.get(fb.ref(fb.database,'brandFollowers')).then(function(snap){
      var followedIds=[];
      if(snap.exists()) snap.forEach(function(c){if(c.val()&&c.val()[uid]) followedIds.push(c.key);});
      if(!followedIds.length) return;

      var sec=document.getElementById('followingProductsSection');
      if(!sec) return;
      sec.style.display='block';

      // Hide products grid
      var pg=document.getElementById('followingProductsGrid');
      if(pg) pg.style.display='none';

      // Update heading
      var hdr=sec.querySelector('h2');
      if(hdr) hdr.textContent='❤️ Following Brands';

      var iconsRow=document.getElementById('bzFollowingBrandsIcons');
      if(!iconsRow){
        iconsRow=document.createElement('div');
        iconsRow.id='bzFollowingBrandsIcons';
        iconsRow.style.cssText='display:flex;gap:14px;overflow-x:auto;padding:4px 4px 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;';
        var hdDiv=sec.querySelector('div');
        if(hdDiv) hdDiv.insertAdjacentElement('afterend',iconsRow);
        else sec.insertAdjacentElement('afterbegin',iconsRow);
      }
      iconsRow.innerHTML='';

      var followed=allBrands.filter(function(b){return followedIds.indexOf(b.id)!==-1;});
      if(!followed.length) followed=followedIds.map(function(id){return {id:id,name:id,logo:'',blueTickAdmin:false};});

      followed.forEach(function(b){
        var col=_bzCol(b.name), ini=(b.name||'B').slice(0,2).toUpperCase();
        var lInner=b.logo?'<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\'">':'<span style="font-size:14px;font-weight:800;color:#fff;">'+ini+'</span>';
        var tick=b.blueTickAdmin?'<div style="position:absolute;bottom:-2px;right:-2px;background:#fff;border-radius:50%;padding:1px;">'+BT.replace(/width="15"/g,'width="11"').replace(/height="15"/g,'height="11"')+'</div>':'';
        var item=document.createElement('div');
        item.style.cssText='flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;min-width:58px;';
        item.innerHTML='<div style="position:relative;width:54px;height:54px;"><div style="width:54px;height:54px;border-radius:50%;border:2.5px solid #2563eb;background:'+col+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+lInner+'</div>'+tick+'</div><span style="font-size:10px;font-weight:700;max-width:64px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b.name||'')+'</span>';
        item.addEventListener('click',function(){window.showBrandProfile(b.id,b.name);});
        iconsRow.appendChild(item);
      });
    }).catch(function(){});
  }
  window.renderFollowingBrandsHomeStrip = bzRenderFollowingStrip;
  // Also replaces loadFollowingProducts
  window.loadFollowingProducts = bzRenderFollowingStrip;

  // ════════════════════════════════════════════════
  // 6. SHOW BRAND PROFILE
  // ════════════════════════════════════════════════
  window.showBrandProfile = function(brandId, brandName) {
    var main=document.querySelector('main')||document.body;
    var page=document.getElementById('brandProfilePage');
    if(!page){
      page=document.createElement('section');
      page.id='brandProfilePage'; page.className='page';
      page.style.cssText='min-height:100vh;background:#f8fafc;padding-bottom:80px;';
      main.appendChild(page);
    }
    page.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:14px;">'
      +'<div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite;"></div>'
      +'<p style="color:#94a3b8;font-size:13px;font-weight:600;">Loading brand...</p></div>';
    if(typeof showPage==='function') showPage('brandProfilePage');
    window.scrollTo(0,0);

    var fb=_fb();
    Promise.all([
      fb.get(fb.ref(fb.database,'brands/'+brandId)),
      fb.get(fb.ref(fb.database,'brandFollowers/'+brandId))
    ]).then(function(res){
      var bd=res[0].exists()?res[0].val():{};
      var followSnap=res[1];
      var name=bd.name||brandName;
      var col=_bzCol(name), ini=name.slice(0,2).toUpperCase();
      var logo=bd.logo||'', desc=bd.description||'';
      var isVerified=!!bd.blueTickAdmin;
      var followers=0;
      if(followSnap.exists()) followSnap.forEach(function(){followers++;});
      var bannerUrl=bd.banner||bd.bannerUrl||bd.bannerImage||bd.coverImage||bd.cover||bd.brandBanner||'';
      var bannerStyle,bannerOverlay='';
      if(bannerUrl){ bannerStyle='background:url('+JSON.stringify(bannerUrl)+') center/cover no-repeat;'; }
      else if(logo){ bannerStyle='background:url('+JSON.stringify(logo)+') center/cover no-repeat;'; bannerOverlay='<div style="position:absolute;inset:0;backdrop-filter:blur(18px) brightness(.7);-webkit-backdrop-filter:blur(18px) brightness(.7);"></div>'; }
      else { bannerStyle='background:linear-gradient(135deg,'+col+'ee,'+col+'88);'; }
      var logoHtml=logo?'<img src="'+logo+'" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">':'<span style="font-size:26px;font-weight:800;color:#fff;">'+ini+'</span>';
      var verBadge=isVerified?BT:'';
      var safeName=name.replace(/'/g,'').replace(/"/g,'');
      var uid=window.currentUser?window.currentUser.uid:null;
      var isFollowing=uid&&followSnap.exists()&&followSnap.val()&&followSnap.val()[uid];
      var followBtn=uid
        ?'<button id="brandFollowBtn" onclick="window.toggleBrandFollow(\"'+brandId+'\",\"'+safeName+'\",this)" style="padding:10px 28px;border-radius:50px;border:none;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;'+(isFollowing?'background:#f1f5f9;color:#475569;':'background:#2563eb;color:#fff;')+'">'+(isFollowing?'\u2713 Following':'+ Follow')+'</button>'
          +'<button onclick="window.showBrandProducts(\"'+brandId+'\",\"'+safeName+'\")" style="padding:10px 20px;border-radius:50px;border:1.5px solid #e2e8f0;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;background:#fff;color:#0f172a;margin-left:8px;">Shop Now</button>'
        :'';

      // Get brand products
      var allProds=window.products||[];
      var brandProds=allProds.filter(function(p){
        var bid=p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');
        return bid===brandId||(p.brand||'').toLowerCase()===(name||'').toLowerCase();
      });

      page.innerHTML='<div style="max-width:640px;margin:0 auto;">'
        +'<div style="padding:12px 16px;display:flex;align-items:center;gap:10px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:20;box-shadow:0 1px 4px rgba(0,0,0,.06);">'
          +'<button onclick="history.length>1?history.back():showPage(\'brandsPage\');" style="width:36px;height:36px;border-radius:50%;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>'
          +'<span style="font-weight:800;font-size:15px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+name+'</span>'
        +'</div>'
        // Banner + logo wrapper
        +'<div style="position:relative;padding-bottom:36px;">'
          +'<div style="height:130px;'+bannerStyle+'position:relative;overflow:hidden;">'+bannerOverlay+'</div>'
          +'<div id="bpLogoHolder" style="position:absolute;bottom:0;left:18px;width:68px;height:68px;border-radius:18px;border:3.5px solid #fff;background:'+col+';display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.18);cursor:pointer;z-index:5;">'+logoHtml+'</div>'
        +'</div>'
        // Info
        +'<div style="background:#fff;padding:10px 18px 16px;border-bottom:1px solid #e2e8f0;">'
          +'<div style="font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">'+name+(verBadge?'&ensp;'+verBadge:'')+'</div>'
          +(desc?'<p style="font-size:13px;color:#64748b;margin:6px 0 10px;line-height:1.5;">'+desc+'</p>':'')
          +'<div style="display:flex;gap:24px;margin:12px 0 16px;">'
            +'<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;" id="brandFollowerCount">'+followers+'</div><div style="font-size:11px;color:#64748b;font-weight:600;">Followers</div></div>'
            +'<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;">'+brandProds.length+'</div><div style="font-size:11px;color:#64748b;font-weight:600;">Products</div></div>'
            +(bd.rating?'<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;">⭐ '+bd.rating+'</div><div style="font-size:11px;color:#64748b;font-weight:600;">'+(bd.totalReviews||0)+' Reviews</div></div>':'')
          +'</div>'
          +'<div style="display:flex;flex-wrap:wrap;gap:8px;">'+followBtn+'</div>'
        +'</div>'
        // Also Following
        +'<div id="bpFollowingSection" style="display:none;padding:14px 16px;background:#fafafa;border-bottom:1px solid #f1f5f9;">'
          +'<div style="font-weight:800;font-size:12px;margin-bottom:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Also Following</div>'
          +'<div id="bpFollowingRow" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>'
        +'</div>'
        // Products
        +'<div style="padding:16px;">'
          +'<div style="font-weight:800;font-size:14px;margin-bottom:12px;">🛍️ '+brandProds.length+' Products</div>'
          +(brandProds.length?'<div class="product-grid" id="brandProductsGrid"></div>':'<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">No products listed yet</div>')
        +'</div>'
        +'</div>';

      if(brandProds.length && typeof renderProducts==='function'){
        setTimeout(function(){ renderProducts(brandProds,'brandProductsGrid'); },30);
      }

      // Trending / Popular / Latest mini sections
      if(brandProds.length>=2){
        setTimeout(function(){
          var pg2=document.getElementById('brandProductsGrid');
          if(!pg2||!pg2.parentElement) return;
          var old=document.getElementById('bzBrandExtras'); if(old) old.remove();
          var extra=document.createElement('div'); extra.id='bzBrandExtras';
          function addSec(em,title,prods){
            if(!prods.length) return;
            var gid='bzBM_'+title.replace(/\W/g,'');
            var d=document.createElement('div'); d.style.cssText='padding:0 16px 20px;';
            d.innerHTML='<div style="font-weight:800;font-size:14px;margin-bottom:10px;">'+em+' '+title+'</div><div class="product-grid" id="'+gid+'"></div>';
            extra.appendChild(d);
            setTimeout(function(){ if(typeof renderProducts==='function') renderProducts(prods,gid); },60);
          }
          addSec('🔥','Trending',brandProds.slice().sort(function(a,b2){return((b2.views||0)+(b2.orders||0)*2)-((a.views||0)+(a.orders||0)*2);}).slice(0,4));
          addSec('⭐','Most Popular',brandProds.slice().sort(function(a,b2){return(b2.rating||0)-(a.rating||0);}).slice(0,4));
          addSec('🆕','Latest',brandProds.slice().sort(function(a,b2){return((b2.addedAt||0)-(a.addedAt||0));}).slice(0,4));
          pg2.parentElement.appendChild(extra);
        },200);
      }

      // Logo hold → full preview
      setTimeout(function(){
        var holder=document.getElementById('bpLogoHolder'); if(!holder) return;
        var ht;
        function openPrev(){
          var ov=document.createElement('div');
          ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;';
          ov.innerHTML=logo?'<img src="'+logo+'" style="max-width:88vw;max-height:88vh;border-radius:20px;object-fit:contain;">':'<div style="width:200px;height:200px;border-radius:32px;background:'+col+';display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:800;color:#fff;">'+ini+'</div>';
          ov.addEventListener('click',function(){document.body.removeChild(ov);});
          document.body.appendChild(ov);
        }
        holder.addEventListener('mousedown',function(){ht=setTimeout(openPrev,500);}); holder.addEventListener('mouseup',function(){clearTimeout(ht);}); holder.addEventListener('mouseleave',function(){clearTimeout(ht);});
        holder.addEventListener('touchstart',function(){ht=setTimeout(openPrev,500);},{passive:true}); holder.addEventListener('touchend',function(){clearTimeout(ht);}); holder.addEventListener('touchmove',function(){clearTimeout(ht);},{passive:true});
        holder.addEventListener('contextmenu',function(e){e.preventDefault();openPrev();});
      },200);

      // Also Following brands
      setTimeout(function(){
        var fb2=_fb(); if(!fb2) return;
        fb2.get(fb2.ref(fb2.database,'brandFollowers')).then(function(allSnap){
          var ids=[];
          if(allSnap.exists()) allSnap.forEach(function(c){var v=c.val();if(v&&v[brandId]&&c.key!==brandId)ids.push(c.key);});
          if(!ids.length) return;
          var all=window.__bzBrandsCache||[];
          var list=all.filter(function(b){return ids.indexOf(b.id)!==-1;}).sort(function(a,b2){return((b2.followers||0)+(b2.blueTickAdmin?10000:0))-((a.followers||0)+(a.blueTickAdmin?10000:0));}).slice(0,20);
          if(!list.length) return;
          var sec2=document.getElementById('bpFollowingSection'),row=document.getElementById('bpFollowingRow');
          if(!sec2||!row) return; sec2.style.display='block';
          list.forEach(function(b2){
            var bc=_bzCol(b2.name),bi=(b2.name||'B').slice(0,2).toUpperCase();
            var li2=b2.logo?'<img src="'+b2.logo+'" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">':'<span style="font-size:13px;font-weight:800;color:#fff;">'+bi+'</span>';
            var it=document.createElement('div'); it.style.cssText='flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
            it.innerHTML='<div style="width:46px;height:46px;border-radius:12px;border:2px solid #e2e8f0;background:'+bc+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+li2+'</div>'
              +'<span style="font-size:9px;font-weight:700;max-width:54px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b2.name||'').slice(0,10)+(b2.blueTickAdmin?BT.replace('width="15"','width="10"').replace('height="15"','height="10"'):'')+'</span>';
            it.addEventListener('click',function(){window.showBrandProfile(b2.id,b2.name);});
            row.appendChild(it);
          });
        }).catch(function(){});
      },500);

      window.scrollTo(0,0);
    }).catch(function(err){ console.error('Brand profile error:',err); });
  };

  // ════════════════════════════════════════════════
  // 7. TOGGLE FOLLOW
  // ════════════════════════════════════════════════
  window.toggleBrandFollow = function(brandId, brandName, btnEl) {
    if(!window.currentUser){if(typeof showToast==='function') showToast('Please login to follow brands','warning'); return;}
    var uid=window.currentUser.uid, fb2=_fb();
    var followRef=fb2.ref(fb2.database,'brandFollowers/'+brandId+'/'+uid);
    var btn=btnEl||document.getElementById('brandFollowBtn');
    fb2.get(followRef).then(function(snap){
      if(snap.exists()){
        return fb2.remove(followRef).then(function(){
          if(btn){btn.textContent='+ Follow';btn.style.background='#2563eb';btn.style.color='#fff';}
          var cnt=document.getElementById('brandFollowerCount'); if(cnt) cnt.textContent=Math.max(0,parseInt(cnt.textContent||'0')-1);
          window.__bzFollowedSet=window.__bzFollowedSet||{}; delete window.__bzFollowedSet[brandId];
          if(typeof showToast==='function') showToast('Unfollowed '+brandName,'info');
          bzRenderFollowingStrip();
        });
      } else {
        return fb2.set(followRef,{userId:uid,brandId:brandId,brandName:brandName,followedAt:Date.now()}).then(function(){
          if(btn){btn.textContent='✓ Following';btn.style.background='#f1f5f9';btn.style.color='#64748b';}
          var cnt=document.getElementById('brandFollowerCount'); if(cnt) cnt.textContent=parseInt(cnt.textContent||'0')+1;
          window.__bzFollowedSet=window.__bzFollowedSet||{}; window.__bzFollowedSet[brandId]=true;
          if(typeof showToast==='function') showToast('Following '+brandName+'! 🎉','success');
          bzRenderFollowingStrip();
        });
      }
    }).catch(function(err){if(typeof showToast==='function') showToast('Error: '+err.message,'error');});
  };

  // ════════════════════════════════════════════════
  // 8. SHOW BRAND PRODUCTS (filter page)
  // ════════════════════════════════════════════════
  window.showBrandProducts = function(brandId, brandName) {
    if(typeof filterByBrand==='function'){ filterByBrand(brandId,brandName); return; }
    if(typeof showPage==='function') showPage('productsPage');
    setTimeout(function(){
      var all=window.products||[];
      var prods=all.filter(function(p){ var bid=p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_'); return bid===brandId; });
      if(typeof renderProducts==='function') renderProducts(prods.length?prods:all,'productGrid');
    },200);
  };

  // ════════════════════════════════════════════════
  // 9. PATCH SEARCH SUGGESTIONS — add brand results
  // ════════════════════════════════════════════════
  function patchSearchSuggestions() {
    var orig = window.showSearchSuggestions;
    if (!orig || orig._bzBrandPatched) return;
    window.showSearchSuggestions = function(query) {
      orig.call(this, query);
      var container = document.getElementById('searchSuggestions');
      if (!container || !query || query.length < 1) return;
      var allBrands = window.__bzBrandsCache || [];
      if (!allBrands.length) return;
      var q = query.toLowerCase().trim();
      var matched = allBrands.filter(function(b){ return (b.name||'').toLowerCase().indexOf(q)!==-1||(b.description||'').toLowerCase().indexOf(q)!==-1; }).slice(0,3);
      if (!matched.length) return;
      var hdr=document.createElement('div');
      hdr.style.cssText='padding:5px 12px 3px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #f1f5f9;';
      hdr.textContent='🏷️  Brands';
      container.appendChild(hdr);
      matched.forEach(function(b){
        var col=_bzCol(b.name), ini=(b.name||'B').slice(0,2).toUpperCase();
        var logo=b.logo?'<img src="'+b.logo+'" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">':'<div style="width:38px;height:38px;border-radius:8px;background:'+col+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">'+ini+'</div>';
        var row=document.createElement('div');
        row.style.cssText='display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .15s;';
        row.innerHTML=logo+'<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:3px;">'+(b.name||'')+(b.blueTickAdmin?'&nbsp;'+BT:'')+'</div><div style="font-size:11px;color:#64748b;">📦 '+(b.products?b.products.length:0)+' products'+(b.followers?' &nbsp;❤️ '+b.followers:'')+'</div></div><span style="font-size:10px;background:#eff6ff;color:#2563eb;padding:2px 7px;border-radius:10px;font-weight:700;">Brand</span>';
        row.addEventListener('mouseenter',function(){this.style.background='#f8fafc';}); row.addEventListener('mouseleave',function(){this.style.background='';});
        row.addEventListener('click',function(){ if(typeof closeSearchPanel==='function') closeSearchPanel(); window.showBrandProfile(b.id,b.name); });
        container.appendChild(row);
      });
    };
    window.showSearchSuggestions._bzBrandPatched = true;
  }

  // ════════════════════════════════════════════════
  // 10. PATCH PRODUCT CARD — add brand name + blue tick
  // ════════════════════════════════════════════════
  function patchProductCardBrand() {
    // Override createProductCard to inject brand badge
    var origCreate = window.createProductCard;
    if (!origCreate || origCreate._bzBrandPatched) return;
    window.createProductCard = function(product) {
      var card = origCreate(product);
      if (!product.brand || !card) return card;
      // Find price element and insert brand badge before it
      var priceEl = card.querySelector('.product-price, [class*="price"]');
      if (!priceEl) return card;
      var cacheB = (window.__bzBrandsCache||[]).find(function(x){
        return x.id===(product.brandId||(product.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_'))||x.name===product.brand;
      });
      var tickHtml = cacheB && cacheB.blueTickAdmin ? '&nbsp;'+BT.replace('width="15"','width="13"').replace('height="15"','height="13"') : '';
      var brandDiv=document.createElement('div');
      brandDiv.style.cssText='font-size:11px;color:#2563eb;margin:-2px 0 5px;display:inline-flex;align-items:center;gap:3px;font-weight:700;cursor:pointer;';
      brandDiv.innerHTML='<span>'+product.brand+'</span>'+tickHtml;
      brandDiv.addEventListener('click',function(e){e.stopPropagation();window.showBrandProfile(product.brandId||(product.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_'),product.brand);});
      priceEl.parentNode.insertBefore(brandDiv,priceEl);
      return card;
    };
    window.createProductCard._bzBrandPatched = true;
  }

  // ════════════════════════════════════════════════
  // 11. OPEN BRANDS PAGE
  // ════════════════════════════════════════════════
  window.bzOpenBrandsPage = function() {
    injectBrandsPageHTML();
    if(typeof showPage==='function') showPage('brandsPage');
    setTimeout(function(){
      if(window.__bzBrandsCache && window.__bzBrandsCache.length){
        bzRenderBrands(window.__bzBrandsCache, window.__bzFollowedSet||{});
      } else {
        bzLoadBrandsPage();
      }
    },40);
  };
  window._openBrandsPage = window.bzOpenBrandsPage;

  // ════════════════════════════════════════════════
  // 12. SELLER → MY SHOP
  // ════════════════════════════════════════════════
  function checkSellerApproval(){
    var user=window.currentUser; if(!user) return;
    var fb2=_fb(); if(!fb2||!fb2.database) return;
    var uid=user.uid;
    if(localStorage.getItem('bz_seller_approved_'+uid)==='1'){applyMyShop();return;}
    function applyMyShop(){
      var t=document.getElementById('menuSellProductText');
      if(t){t.textContent='My Shop';t.style.color='#7c3aed';}
      var it=document.getElementById('menuSellProductItem');
      if(it){var sv=it.querySelector('svg');if(sv)sv.style.color='#7c3aed';}
      localStorage.setItem('bz_seller_approved_'+uid,'1');
    }
    fb2.get(fb2.ref(fb2.database,'sellers/'+uid)).then(function(s){
      if(s.exists()){var d=s.val();if(d.approved===true||d.status==='approved'){applyMyShop();return;}}
      return fb2.get(fb2.ref(fb2.database,'sellerRequests/'+uid));
    }).then(function(s2){
      if(!s2||!s2.exists||!s2.exists()) return;
      var d2=s2.val();if(d2&&(d2.approved===true||d2.status==='approved'))applyMyShop();
    }).catch(function(){});
  }
  window.checkSellerApproval = checkSellerApproval;

  // ════════════════════════════════════════════════
  // 13. PREFETCH BRAND CACHE (silent background load)
  // ════════════════════════════════════════════════
  function prefetchBrandsCache(){
    var fb2=_fb(); if(!fb2||!fb2.database){setTimeout(prefetchBrandsCache,1200);return;}
    if(window.__bzBrandsCache&&window.__bzBrandsCache.length) return;
    Promise.all([fb2.get(fb2.ref(fb2.database,'brands')),fb2.get(fb2.ref(fb2.database,'products'))]).then(function(res){
      var brandMap={};
      if(res[0]&&res[0].exists()) res[0].forEach(function(c){var b=c.val();if(b&&b.name)brandMap[c.key]={id:c.key,name:b.name,logo:b.logo||'',banner:b.banner||b.bannerUrl||b.bannerImage||b.coverImage||b.cover||'',description:b.description||'',blueTickAdmin:!!b.blueTickAdmin,verificationLevel:b.verificationLevel||'normal',followers:b.followersCount||b.followers||0,rating:b.rating||0,products:[]};});
      if(res[1]&&res[1].exists()) res[1].forEach(function(c){var p=c.val();if(!p||!p.brand)return;var bid=p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_');if(!brandMap[bid])brandMap[bid]={id:bid,name:p.brandName||p.brand,logo:'',banner:'',description:'',blueTickAdmin:false,verificationLevel:'normal',followers:0,rating:0,products:[]};brandMap[bid].products.push(c.key);});
      window.__bzBrandsCache=Object.values(brandMap).filter(function(b){return b.products.length>0||b.blueTickAdmin;});
    }).catch(function(){});
  }

  // ════════════════════════════════════════════════
  // INIT — runs after DOM + Firebase ready
  // ════════════════════════════════════════════════
  function bzBrandInit(){
    // Set system flag immediately
    window.__BZ_BRAND_SYSTEM = true;

    injectBrandsPageHTML();
    injectBrandsMenuItem();
    injectFollowingStripSlot();

    // Hook showPage immediately
    bzHookShowPage();

    // Prefetch brand cache — then re-render visible cards
    prefetchBrandsCache();

    // After cache loads, refresh visible product cards (brand names + blue ticks)
    var cacheWatcher = setInterval(function() {
      if (window.__bzBrandsCache && window.__bzBrandsCache.length) {
        clearInterval(cacheWatcher);
        // Re-render home page products with brand info
        if (typeof renderProducts === 'function' && window.products && window.products.length) {
          var homeGrid = document.getElementById('homeProductGrid');
          if (homeGrid && homeGrid.children.length > 0) {
            renderProducts(window.products.slice(0, 20), 'homeProductGrid');
          }
        }
      }
    }, 500);
    setTimeout(function(){ clearInterval(cacheWatcher); }, 10000);

    // Patch search
    setTimeout(patchSearchSuggestions, 600);
    setTimeout(patchProductCardBrand, 600);

    // Auth watcher
    var iv = setInterval(function(){
      if (window.currentUser) {
        clearInterval(iv);
        setTimeout(bzRenderFollowingStrip, 1500);
        setTimeout(checkSellerApproval, 2000);
      }
    }, 600);

    // Refresh following strip when products load
    var prodsWatcher = setInterval(function(){
      if (window.products && window.products.length && window.currentUser) {
        clearInterval(prodsWatcher);
        setTimeout(bzRenderFollowingStrip, 500);
      }
    }, 800);
    setTimeout(function(){ clearInterval(prodsWatcher); }, 15000);
  }

  if(document.readyState!=='loading') bzBrandInit();
  else document.addEventListener('DOMContentLoaded', bzBrandInit);

  // showPage hook — intercept to load brands page
  function bzHookShowPage() {
    if (typeof window.showPage !== 'function' || window.showPage._bzBrandHooked) return;
    var _origSP = window.showPage;
    window.showPage = function(pageId) {
      _origSP(pageId);
      if (pageId === 'brandsPage') {
        setTimeout(function() {
          if (window.__bzBrandsCache && window.__bzBrandsCache.length) {
            bzRenderBrands(window.__bzBrandsCache, window.__bzFollowedSet || {});
          } else {
            bzLoadBrandsPage();
          }
        }, 50);
      }
    };
    window.showPage._bzBrandHooked = true;
  }

  // Try hooking immediately, and also after delays
  bzHookShowPage();
  setTimeout(bzHookShowPage, 500);
  setTimeout(bzHookShowPage, 1500);

  // Also override _openBrandsPage directly
  window._openBrandsPage = window.bzOpenBrandsPage;

})();
