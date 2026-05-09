// Buyzo Cart - Main Application Logic
    const CACHE_KEYS = {
      PRODUCTS: 'bz_products',
      CATEGORIES: 'bz_categories',
      BANNERS: 'bz_banners',
      SETTINGS: 'bz_settings',
      ADDRESSES: 'bz_addresses',
      ORDERS: 'bz_orders',
      CART: 'bz_cart',
      WISHLIST: 'bz_wishlist',
      RECENT_SEARCHES: 'bz_recent_searches'
    };

    const cacheManager = {
      set(key, data, ttl = 60 * 60 * 1000) {
        const item = { data, timestamp: Date.now(), ttl };
        try { localStorage.setItem(key, JSON.stringify(item)); } catch (e) {}
        try { sessionStorage.setItem(key + '_session', JSON.stringify(data)); } catch (e) {}
      },
      get(key) {
        try {
          const sess = sessionStorage.getItem(key + '_session');
          if (sess) return JSON.parse(sess);
        } catch (e) {}
        const item = localStorage.getItem(key);
        if (!item) return null;
        try {
          const parsed = JSON.parse(item);
          if (Date.now() - parsed.timestamp > parsed.ttl) {
            localStorage.removeItem(key);
            return null;
          }
          return parsed.data;
        } catch { return null; }
      },
      remove(key) {
        localStorage.removeItem(key);
        try { sessionStorage.removeItem(key + '_session'); } catch (e) {}
      }
    };

    let currentUser = null;
    let currentProduct = null;
    let userInfo = {};
    let currentOrderId = null;
    let products = [];
    let categories = [];
    let banners = [];
    let recentlyViewed = [];
    let currentImageIndex = 0;
    let currentZoomLevel = 1;
    let currentCategoryFilter = null;
    let currentProductImages = [];
    let currentProductModalIndex = 0;
    let currentSelectedColor = null;
    let adminSettings = {
      deliveryCharge: 50,
      gatewayChargePercent: 2,
      freeShippingOver: 999,
      heroHeading: 'Welcome to <span style="color:var(--accent)">Buyzo Cart</span>',
      heroSubheading: 'Clean, fast checkout. Hand‑picked products. Fully responsive UI.',
      heroMessages: ['🔥 Big Sale Today', '🚚 Free Shipping over ₹999', '✨ New Arrivals Just Dropped'],
      currencySymbol: '₹'
    };
    let savedAddresses = [];
    let recentSearches = cacheManager.get(CACHE_KEYS.RECENT_SEARCHES) || [];
    let popularSearches = [];
    let searchTags = [];
    let deliveredOrders = [];
    let globalCurrencySymbol = adminSettings.currencySymbol;
    let userCurrencyPreference = localStorage.getItem('userCurrency') || null;
    
    let autoSlideInterval;
    let slidePaused = false;
    let bannerAutoSlideInterval;
    let trendingAutoSlideInterval;
    let touchStartX = 0, touchEndX = 0;
    let isBannerDragging = false, bannerTouchStartX = 0, bannerTouchEndX = 0;

    class GlobalSliderController {
      constructor() {
        this.sliders = new Map();
        this.setupDelegation();
      }
      register(key, containerSelector, trackSelector, options = {}) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        const track = container.querySelector(trackSelector);
        if (!track) return;
        const slider = {
          container,
          track,
          autoInterval: null,
          pauseTimer: null,
          currentIndex: 0,
          itemCount: track.children.length,
          ...options
        };
        if (slider.itemCount > 1 && options.autoSlide) {
          slider.autoInterval = setInterval(() => this.next(key), options.interval || 3000);
        }
        this.sliders.set(key, slider);
      }
      pause(key) {
        const slider = this.sliders.get(key);
        if (slider && slider.autoInterval) {
          clearInterval(slider.autoInterval);
          slider.autoInterval = null;
        }
      }
      resume(key, interval = 3000) {
        const slider = this.sliders.get(key);
        if (!slider || slider.itemCount <= 1) return;
        if (slider.pauseTimer) clearTimeout(slider.pauseTimer);
        slider.pauseTimer = setTimeout(() => {
          if (!slider.autoInterval) {
            slider.autoInterval = setInterval(() => this.next(key), interval);
          }
        }, 1500);
      }
      next(key) {
        const slider = this.sliders.get(key);
        if (!slider || slider.itemCount <= 1) return;
        slider.currentIndex = (slider.currentIndex + 1) % slider.itemCount;
        this.updateTransform(key);
      }
      prev(key) {
        const slider = this.sliders.get(key);
        if (!slider || slider.itemCount <= 1) return;
        slider.currentIndex = (slider.currentIndex - 1 + slider.itemCount) % slider.itemCount;
        this.updateTransform(key);
      }
      goTo(key, index) {
        const slider = this.sliders.get(key);
        if (!slider) return;
        slider.currentIndex = Math.min(index, slider.itemCount - 1);
        this.updateTransform(key);
      }
      updateTransform(key) {
        const slider = this.sliders.get(key);
        if (!slider || !slider.track) return;
        const slideWidth = slider.track.children[0]?.offsetWidth || 0;
        slider.track.style.transform = `translateX(-${slider.currentIndex * slideWidth}px)`;
      }
      setupDelegation() {
        document.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        document.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        document.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
      }
      handleTouchStart(e) {
        const target = e.target.closest('[data-slider-key]');
        if (!target) return;
        const key = target.dataset.sliderKey;
        const slider = this.sliders.get(key);
        if (!slider) return;
        this.activeKey = key;
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.isDragging = true;
        this.pause(key);
      }
      handleTouchMove(e) {
        if (!this.isDragging || !this.activeKey) return;
        const dx = e.touches[0].clientX - this.startX;
        const dy = Math.abs(e.touches[0].clientY - this.startY);
        if (Math.abs(dx) > dy && Math.abs(dx) > 20) {
          e.preventDefault();
        }
      }
      handleTouchEnd(e) {
        if (!this.isDragging || !this.activeKey) return;
        const dx = e.changedTouches[0].clientX - this.startX;
        if (Math.abs(dx) > 50) {
          if (dx > 0) this.prev(this.activeKey);
          else this.next(this.activeKey);
        }
        this.isDragging = false;
        this.resume(this.activeKey);
        this.activeKey = null;
      }
      handleMouseDown(e) {
        const target = e.target.closest('[data-slider-key]');
        if (!target) return;
        const key = target.dataset.sliderKey;
        const slider = this.sliders.get(key);
        if (!slider) return;
        this.activeKey = key;
        this.startX = e.clientX;
        this.isDragging = true;
        this.pause(key);
      }
      handleMouseMove(e) {
        if (!this.isDragging || !this.activeKey) return;
        this.endX = e.clientX;
      }
      handleMouseUp(e) {
        if (!this.isDragging || !this.activeKey) return;
        const dx = this.endX - this.startX;
        if (Math.abs(dx) > 50) {
          if (dx > 0) this.prev(this.activeKey);
          else this.next(this.activeKey);
        }
        this.isDragging = false;
        this.resume(this.activeKey);
        this.activeKey = null;
        this.startX = this.endX = 0;
      }
    }
    const sliderController = new GlobalSliderController();

    function debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }

    function getRatingMap(reviewsList) {
      const counts = {};
      const sums = {};
      const rList = reviewsList || reviews || [];
      rList.forEach(r => {
        const pid = r.productId;
        if (!pid) return;
        counts[pid] = (counts[pid] || 0) + 1;
        sums[pid] = (sums[pid] || 0) + r.rating;
      });
      const map = {};
      for (const pid in counts) {
        map[pid] = sums[pid] / counts[pid];
      }
      return map;
    }

    function parsePrice(p) {
      if (typeof p === "number") return p;
      if (typeof p === "string") {
        const num = parseFloat(p.replace(/[₹$]/g, "").replace(/,/g, ""));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    }

    function getCurrencySymbol() {
      return userCurrencyPreference || globalCurrencySymbol || '₹';
    }

    function formatPrice(price) {
      const symbol = getCurrencySymbol();
      return symbol + parsePrice(price).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
    }

    function getProductImage(product, idx = 0) {
      if (!product) return "https://via.placeholder.com/300x300/f3f4f6/64748b?text=No+Image";
      if (Array.isArray(product.images) && product.images.length > 0) {
        if (idx < product.images.length) return product.images[idx];
        return product.images[0];
      }
      const possibleImageFields = ['image', 'img', 'imageUrl', 'photo', 'thumbnail', 'picture', 'url', 'mainImage', 'productImage'];
      for (const field of possibleImageFields) {
        if (product[field]) {
          if (typeof product[field] === 'string') {
            return product[field];
          }
          if (Array.isArray(product[field]) && product[field].length > 0) {
            return product[field][0];
          }
        }
      }
      if (typeof product === 'string' && (product.startsWith('http') || product.startsWith('/') || product.startsWith('data:'))) {
        return product;
      }
      if (product.value && typeof product.value === 'string' && product.value.startsWith('http')) {
        return product.value;
      }
      return "https://via.placeholder.com/300x300/f3f4f6/64748b?text=No+Image";
    }

    function getProductImages(product) {
      if (!product) return [];
      if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images;
      }
      if (product.similarFromAdmin && Array.isArray(product.similarFromAdmin)) {
        return product.similarFromAdmin;
      }
      const possibleImageArrays = ['images', 'photos', 'gallery', 'pictures'];
      for (const field of possibleImageArrays) {
        if (Array.isArray(product[field]) && product[field].length > 0) {
          return product[field];
        }
      }
      const possibleImageFields = ['image', 'img', 'imageUrl', 'photo', 'thumbnail', 'picture', 'url', 'mainImage', 'productImage'];
      for (const field of possibleImageFields) {
        if (product[field]) {
          if (typeof product[field] === 'string') {
            return [product[field]];
          }
          if (Array.isArray(product[field]) && product[field].length > 0) {
            return product[field];
          }
        }
      }
      return ["https://via.placeholder.com/300x300/f3f4f6/64748b?text=No+Image"];
    }

    function generateOrderId() {
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const randomNum = Math.floor(100000 + Math.random() * 900000); 
        return `ORDER-${yyyy}${mm}${dd}-${randomNum}`;
    }

    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.className = 'toast ' + type;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    (function() {
      try {
        const cfg = window.BZ_CONFIG?.emailjs;
        if (cfg?.publicKey && cfg.publicKey !== 'YOUR_EMAILJS_PUBLIC_KEY') {
          emailjs.init(cfg.publicKey);
        }
      } catch(e) {}
    })();

    function bzSendEmail(templateId, params) {
      try {
        const cfg = window.BZ_CONFIG?.emailjs;
        if (!cfg?.serviceId || !cfg?.publicKey || cfg.publicKey === 'YOUR_EMAILJS_PUBLIC_KEY') return;
        if (!templateId || templateId === 'YOUR_LOGIN_TEMPLATE_ID' || templateId === 'YOUR_ORDER_TEMPLATE_ID') return;
        emailjs.send(cfg.serviceId, templateId, params).catch(e => console.warn('EmailJS:', e));
      } catch(e) {}
    }

    function openMenu() {
      document.getElementById('mobileMenu').classList.add('active');
      document.getElementById('menuOverlay').classList.add('active');
      document.getElementById('menuIcon').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      document.getElementById('mobileMenu').classList.remove('active');
      document.getElementById('menuOverlay').classList.remove('active');
      document.getElementById('menuIcon').classList.remove('active');
      document.body.style.overflow = '';
    }

    function showCategories() {
      filterByCategory('all');
    }

    function openSearchPanel() {
      document.getElementById('searchPanel').classList.add('active');
      document.getElementById('searchPanelInput').focus();
      loadRecentSearches();
      loadPopularSearches();
      loadSearchTags();
    }

    function closeSearchPanel() {
      document.getElementById('searchPanel').classList.remove('active');
      document.getElementById('searchPanelInput').value = '';
      document.getElementById('searchSuggestions').style.display = 'none';
    }

    function fuzzyScore(text, query) {
      if (!text || !query) return 0;
      const t = text.toLowerCase();
      const q = query.toLowerCase();
      if (t === q) return 100;
      if (t.startsWith(q)) return 90;
      if (t.includes(q)) return 80;
      const lenT = t.length, lenQ = q.length;
      if (Math.abs(lenT - lenQ) > 5) return 0;
      const dp = Array.from({length: lenQ + 1}, (_, i) => i);
      for (let j = 1; j <= lenT; j++) {
        let prev = j;
        for (let i = 1; i <= lenQ; i++) {
          const cur = t[j-1] === q[i-1] ? dp[i-1] : Math.min(dp[i-1], dp[i], prev) + 1;
          dp[i-1] = prev;
          prev = cur;
        }
        dp[lenQ] = prev;
      }
      const dist = dp[lenQ];
      const maxLen = Math.max(lenT, lenQ);
      const similarity = (1 - dist / maxLen) * 70;
      return similarity > 30 ? similarity : 0;
    }

    function searchProducts(query) {
      if (!query.trim()) return [];
      const q = query.trim();
      const ratingMap = getRatingMap();
      const scored = [];
      products.forEach(p => {
        const name = p.name || p.title || '';
        const desc = p.description || '';
        const cat = p.category || '';
        const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
        const brand = p.brand || '';
        const pid = p.id || p.productId || '';
        // ✅ PRODUCT ID SEARCH: exact match = instant top result
        if (pid && (pid.toLowerCase() === q.toLowerCase() || pid.toLowerCase().includes(q.toLowerCase()))) {
          scored.push({ product: p, score: 1000 });
          return;
        }
        const combined = [name, desc, cat, tags, brand].join(' ');
        let score = 0;
        score = Math.max(score, fuzzyScore(name, q));
        score = Math.max(score, fuzzyScore(cat, q) * 0.7);
        score = Math.max(score, fuzzyScore(brand, q) * 0.8);
        score = Math.max(score, fuzzyScore(combined, q) * 0.5);
        if (score > 25) scored.push({ product: p, score });
      });
      scored.sort((a, b) => {
        if (Math.abs(a.score - b.score) > 5) return b.score - a.score;
        const rA = ratingMap[a.product.id] ?? 0;
        const rB = ratingMap[b.product.id] ?? 0;
        return rB - rA;
      });
      return scored.map(s => s.product);
    }

    function performSearch(query) {
      if (!query.trim()) return;
      document.getElementById('searchPanelInput').blur();
      addToRecentSearches(query);
      const results = searchProducts(query);
      window.currentSearchQuery = query;
      window.currentSearchResults = results;
      showPage('searchResultsPage');
      renderSearchResults(results, query);
      closeSearchPanel();
    }

    function handleSearchPanelInput(e) {
      const query = e.target.value.trim();
      const suggestionsContainer = document.getElementById('searchSuggestions');
      if (!suggestionsContainer) return;
      if (query.length >= 1) {
        showSearchSuggestions(query);
        suggestionsContainer.style.display = 'block';
      } else {
        clearSearchSuggestions();
        suggestionsContainer.style.display = 'none';
      }
    }

    function showSearchSuggestions(query) {
      const suggestionsContainer = document.getElementById('searchSuggestions');
      if (!suggestionsContainer) return;
      const results = searchProducts(query);
      const ratingMap = getRatingMap();
      const topThree = [...results].sort((a,b) => getProductScore(b, ratingMap[b.id] ?? 0) - getProductScore(a, ratingMap[a.id] ?? 0)).slice(0, 3);
      suggestionsContainer.innerHTML = '';
      if (topThree.length === 0) {
        suggestionsContainer.innerHTML = '<div class="search-suggestion" style="justify-content:center;color:var(--muted);padding:12px;">No matching products found</div>';
        return;
      }
      const imageRow = document.createElement('div');
      imageRow.style.cssText = 'display:flex; gap:8px; padding:10px 10px 4px; overflow-x:auto;';
      topThree.forEach(product => {
        const card = document.createElement('div');
        card.style.cssText = 'flex:0 0 80px; cursor:pointer; border-radius:8px; overflow:hidden; border:1px solid var(--border); background:var(--surface);';
        const ratingVal = ratingMap[product.id] ?? 0;
        card.innerHTML = `
          <div style="height:72px; background-image:url('${getProductImage(product)}'); background-size:contain; background-position:center; background-repeat:no-repeat; background-color:#f8fafc;"></div>
          <div style="padding:4px 5px; font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${product.name || product.title || ''}</div>
          <div style="padding:0 5px 4px; font-size:11px; color:var(--accent); font-weight:700;">${formatPrice(product.price)}</div>
          ${ratingVal > 0 ? `<div style="padding:0 5px 4px; font-size:10px; color:#f59e0b;">★ ${ratingVal.toFixed(1)}</div>` : ''}
        `;
        card.addEventListener('click', () => { showProductDetail(product); closeSearchPanel(); });
        imageRow.appendChild(card);
      });
      suggestionsContainer.appendChild(imageRow);
      topThree.forEach(product => {
        const suggestion = document.createElement('div');
        suggestion.className = 'search-suggestion';
        const productCategory = categories.find(c => c.id === product.category)?.name || product.category || '';
        suggestion.innerHTML = `
          <div class="search-suggestion-img" style="background-image: url('${getProductImage(product)}'); background-size: contain; background-repeat: no-repeat; background-position: center; background-color: #f8fafc;"></div>
          <div class="search-suggestion-info">
            <div class="search-suggestion-name">${product.name || product.title || 'Product'}</div>
            <div class="search-suggestion-category">${productCategory}</div>
            <div class="search-suggestion-price">${formatPrice(product.price)}</div>
          </div>
        `;
        suggestion.addEventListener('click', () => { showProductDetail(product); closeSearchPanel(); });
        suggestionsContainer.appendChild(suggestion);
      });
      if (results.length > 3) {
        const viewAll = document.createElement('div');
        viewAll.className = 'search-suggestion';
        viewAll.innerHTML = `<div class="search-suggestion-info" style="padding-left:0;"><div class="search-suggestion-name" style="color:var(--accent);">View all ${results.length} results for "${query}"</div></div>`;
        viewAll.addEventListener('click', () => performSearch(query));
        suggestionsContainer.appendChild(viewAll);
      }
      // ── Brand results ──
      const allBrandsForSearch = window.__bzBrandsCache || [];
      if (allBrandsForSearch.length) {
        const qLower = query.toLowerCase().trim();
        const matchedBrands = allBrandsForSearch.filter(b =>
          (b.name||'').toLowerCase().includes(qLower) || (b.description||'').toLowerCase().includes(qLower)
        ).slice(0, 3);
        if (matchedBrands.length) {
          const hdr = document.createElement('div');
          hdr.style.cssText = 'padding:5px 12px 3px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #f1f5f9;background:var(--surface,#fff);';
          hdr.textContent = '🏷️  Brands';
          suggestionsContainer.appendChild(hdr);
          const brandColors = ['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];
          const BT = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;margin-left:2px;"><path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/><polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          matchedBrands.forEach(b => {
            const col = brandColors[(b.name||'A').charCodeAt(0) % brandColors.length];
            const initials = (b.name||'B').slice(0,2).toUpperCase();
            const logoHtml = b.logo
              ? `<img src="${b.logo}" style="width:38px;height:38px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">`
              : `<div style="width:38px;height:38px;border-radius:8px;background:${col};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;">${initials}</div>`;
            const verBadge = b.blueTickAdmin ? BT : '';
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .15s;';
            row.innerHTML = logoHtml
              + `<div style="flex:1;min-width:0;"><div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:3px;">${b.name||''}${verBadge}</div>`
              + `<div style="font-size:11px;color:#64748b;">📦 ${b.products?b.products.length:0} products${b.followers?' &nbsp;❤️ '+b.followers:''}</div></div>`
              + '<span style="font-size:10px;background:#eff6ff;color:#2563eb;padding:2px 7px;border-radius:10px;font-weight:700;flex-shrink:0;">Brand</span>';
            row.addEventListener('mouseenter', function(){this.style.background='#f8fafc';});
            row.addEventListener('mouseleave', function(){this.style.background='';});
            row.addEventListener('click', () => {
              closeSearchPanel();
              if (typeof window.showBrandProfile === 'function') window.showBrandProfile(b.id, b.name);
            });
            suggestionsContainer.appendChild(row);
          });
        }
      }
    }

    function clearSearchSuggestions() {
      const suggestionsContainer = document.getElementById('searchSuggestions');
      if (suggestionsContainer) suggestionsContainer.innerHTML = '';
    }

    function addToRecentSearches(query) {
      if (!query.trim()) return;
      recentSearches = recentSearches.filter(item => item !== query);
      recentSearches.unshift(query);
      if (recentSearches.length > 10) recentSearches.pop();
      cacheManager.set(CACHE_KEYS.RECENT_SEARCHES, recentSearches);
      loadRecentSearches();
    }

    function loadRecentSearches() {
      const container = document.getElementById('recentSearches');
      if (!container) return;
      container.innerHTML = '';
      if (recentSearches.length === 0) {
        container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;">No recent searches</div>';
        return;
      }
      recentSearches.forEach(search => {
        const item = document.createElement('div');
        item.className = 'recent-search-item';
        item.innerHTML = `
          <span class="recent-search-text">${search}</span>
          <button class="recent-search-remove" data-search="${search}">×</button>
        `;
        item.querySelector('.recent-search-text').addEventListener('click', () => {
          document.getElementById('searchPanelInput').value = search;
          performSearch(search);
        });
        item.querySelector('.recent-search-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          removeFromRecentSearches(search);
        });
        container.appendChild(item);
      });
    }

    function removeFromRecentSearches(search) {
      recentSearches = recentSearches.filter(item => item !== search);
      cacheManager.set(CACHE_KEYS.RECENT_SEARCHES, recentSearches);
      loadRecentSearches();
    }

    function clearSearchHistory() {
      recentSearches = [];
      cacheManager.set(CACHE_KEYS.RECENT_SEARCHES, recentSearches);
      loadRecentSearches();
    }

    function loadPopularSearches() {
      const container = document.getElementById('popularSearches');
      const section = container?.closest('.search-section');
      if (!container) return;
      container.innerHTML = '';
      if (!popularSearches.length) {
        if (section) section.style.display = 'none';
        return;
      }
      if (section) section.style.display = '';
      popularSearches.forEach(search => {
        const tag = document.createElement('div');
        tag.className = 'popular-search-tag';
        tag.textContent = search;
        tag.addEventListener('click', () => {
          document.getElementById('searchPanelInput').value = search;
          performSearch(search);
        });
        container.appendChild(tag);
      });
    }

    function loadSearchTags() {
      const container = document.getElementById('searchTags');
      const section = container?.closest('.search-section');
      if (!container) return;
      container.innerHTML = '';
      if (!searchTags.length) {
        if (section) section.style.display = 'none';
        return;
      }
      if (section) section.style.display = '';
      searchTags.forEach(tag => {
        const element = document.createElement('div');
        element.className = 'search-tag';
        element.textContent = tag;
        element.style.cursor = 'pointer';
        element.addEventListener('click', function(e) {
          e.preventDefault(); e.stopPropagation();
          closeSearchPanel();
          filterProductsByTag(tag);
        });
        element.addEventListener('touchend', function(e) {
          e.preventDefault();
          closeSearchPanel();
          filterProductsByTag(tag);
        }, { passive: false });
        container.appendChild(element);
      });
    }

    function filterProductsByTag(tag) {
      if (!tag) return;
      const tagLower = tag.toLowerCase().trim();
      const filtered = products.filter(p => {
        const name = (p.name || p.title || '').toLowerCase();
        const cat  = (p.category || '').toLowerCase();
        const desc = (p.description || p.desc || '').toLowerCase();
        const tags = Array.isArray(p.tags) ? p.tags.map(t => t.toLowerCase()) : [];
        return (
          name.includes(tagLower) ||
          cat.includes(tagLower) ||
          desc.includes(tagLower) ||
          tags.some(t => t.includes(tagLower))
        );
      });
      window.currentSearchQuery   = tag;
      window.currentSearchResults = filtered;
      showPage('searchResultsPage');
      renderSearchResults(filtered, tag);
    }

    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      const sun  = document.querySelector('.theme-toggle-btn .sun-icon');
      const moon = document.querySelector('.theme-toggle-btn .moon-icon');
      if (sun)  { sun.removeAttribute('style');  sun.style.display  = newTheme === 'dark' ? 'none'  : ''; }
      if (moon) { moon.removeAttribute('style'); moon.style.display = newTheme === 'dark' ? ''      : 'none'; }
      const cb = document.getElementById('darkModeToggle');
      if (cb) cb.checked = (newTheme === 'dark');
    }

    function showPage(pageId) {
      const newUrl = window.location.origin + window.location.pathname.replace('index.html', '') + '#' + pageId;
      window.history.pushState(null, '', newUrl);
      document.querySelectorAll('main .page').forEach(page => page.classList.remove('active'));
      const pageElement = document.getElementById(pageId);
      if (pageElement) pageElement.classList.add('active');
      updateBottomNav();
      updateStepPills();
      window.scrollTo(0, 0);
      switch(pageId) {
        case 'myOrdersPage':
          if (currentUser) showMyOrders();
          break;
        case 'wishlistPage':
          renderWishlist();
          break;
        case 'productDetailPage':
          if (currentProduct) {
            loadProductReviews(currentProduct.id);
            loadSimilarProducts(currentProduct);
            loadSimilarProductsSmall(currentProduct);
          }
          break;
        case 'paymentPage':
          updatePaymentSummary();
          break;
        case 'userPage':
          if (currentUser) loadSavedAddresses();
          break;
        case 'orderPage':
          if (currentProduct) initOrderPageGallery();
          break;
        case 'productsPage':
          renderProducts(products, 'productGrid');
          updateProductsCount();
          break;
        case 'homePage':
          renderProducts(products, 'homeProductGrid');
          setTimeout(() => {
            setupTrendingAutoSlide();
            setupBannerAutoSlide();
          }, 500);
          break;
        case 'searchResultsPage':
          if (window.currentSearchQuery) {
            document.getElementById('searchResultsInput').value = window.currentSearchQuery;
            setupSearchPriceSlider();
          }
          break;
        case 'recentlyViewedPage':
          renderRecentlyViewedPage();
          break;
        case 'categoryPage':
          setTimeout(function() { bzRenderOrbit(); }, 100);
          break;
      }
    }

    function renderRecentlyViewedPage() {
      const container = document.getElementById('recentlyViewedGrid');
      const empty = document.getElementById('emptyRecentlyViewed');
      if (!container || !empty) return;
      if (!currentUser) {
        container.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      const recentlyViewedProducts = products.filter(product => recentlyViewed.includes(product.id));
      if (recentlyViewedProducts.length === 0) {
        container.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      container.style.display = 'grid';
      empty.style.display = 'none';
      renderProducts(recentlyViewedProducts, 'recentlyViewedGrid');
    }

    function checkAuthAndShowPage(pageId) {
      if (!currentUser && (pageId === 'myOrdersPage' || pageId === 'wishlistPage' || pageId === 'accountPage')) {
        showLoginModal();
        return;
      }
      if (pageId === 'accountPage') {
        openAccountPage();
        return;
      }
      showPage(pageId);
    }

    function checkAuthAndShowAccount() {
      if (!currentUser) {
        window._pendingAccountNav = true;
        showLoginModal();
        return;
      }
      window.location.href = '/account';
    }

    function checkAuthAndShowRecentlyViewed() {
      if (!currentUser) {
        showLoginModal();
        return;
      }
      showPage('recentlyViewedPage');
    }

    function updateBottomNav() {
      const currentPage = document.querySelector('.page.active').id;
      document.querySelectorAll('.bottom-nav-item').forEach(item => item.classList.remove('active'));
      switch(currentPage) {
        case 'homePage':
          document.querySelector('.bottom-nav-item:nth-child(1)')?.classList.add('active');
          break;
        case 'productsPage':
        case 'productDetailPage':
        case 'searchResultsPage':
          document.querySelector('.bottom-nav-item:nth-child(2)')?.classList.add('active');
          break;
        case 'myOrdersPage':
        case 'orderDetailPage':
          document.querySelector('.bottom-nav-item:nth-child(3)')?.classList.add('active');
          break;
      }
    }

    function updateStepPills() {
      const currentPage = document.querySelector('.page.active').id;
      document.querySelectorAll('.step-pill').forEach(pill => pill.classList.remove('disabled'));
      switch(currentPage) {
        case 'homePage':
        case 'productsPage':
        case 'productDetailPage':
        case 'searchResultsPage':
          document.getElementById('pill-order')?.classList.add('disabled');
          document.getElementById('pill-user')?.classList.add('disabled');
          document.getElementById('pill-pay')?.classList.add('disabled');
          break;
        case 'orderPage':
          document.getElementById('pill-user')?.classList.add('disabled');
          document.getElementById('pill-pay')?.classList.add('disabled');
          break;
        case 'userPage':
          document.getElementById('pill-pay')?.classList.add('disabled');
          break;
      }
    }

    function renderSearchResults(results, query) {
      const grid = document.getElementById('searchResultsGrid');
      const count = document.getElementById('searchResultsCount');
      const noResults = document.getElementById('noSearchResultsMessage');
      if (!grid) return;
      if (results.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        count.textContent = 'No products found';
        return;
      }
      noResults.style.display = 'none';
      count.textContent = `${results.length} products found for "${query}"`;
      renderProducts(results, 'searchResultsGrid');
    }

    function setupSearchPriceSlider() {
      const minThumb = document.getElementById('searchPriceMinThumb');
      const maxThumb = document.getElementById('searchPriceMaxThumb');
      const track = document.getElementById('searchPriceSliderTrack');
      const range = document.getElementById('searchPriceSliderRange');
      const minInput = document.getElementById('searchMinPrice');
      const maxInput = document.getElementById('searchMaxPrice');
      if (minThumb && maxThumb && track) {
        let minPercent = 0;
        let maxPercent = 100;
        const minPrice = 0;
        const maxPrice = 10000;
        function updateSlider() {
          minThumb.style.left = minPercent + '%';
          maxThumb.style.left = maxPercent + '%';
          range.style.left = minPercent + '%';
          range.style.width = (maxPercent - minPercent) + '%';
          const minValue = Math.round(minPrice + (minPercent / 100) * (maxPrice - minPrice));
          const maxValue = Math.round(minPrice + (maxPercent / 100) * (maxPrice - minPrice));
          minInput.value = minValue;
          maxInput.value = maxValue;
        }
        function onThumbMove(thumb, isMin) {
          return function(e) {
            e.preventDefault();
            const trackRect = track.getBoundingClientRect();
            let percent;
            if (e.type === 'touchmove') {
              percent = ((e.touches[0].clientX - trackRect.left) / trackRect.width) * 100;
            } else {
              percent = ((e.clientX - trackRect.left) / trackRect.width) * 100;
            }
            percent = Math.max(0, Math.min(100, percent));
            if (isMin) {
              if (percent < maxPercent - 5) minPercent = percent;
            } else {
              if (percent > minPercent + 5) maxPercent = percent;
            }
            updateSlider();
          };
        }
        function onThumbUp() {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onThumbUp);
          document.removeEventListener('touchmove', onTouchMove);
          document.removeEventListener('touchend', onThumbUp);
        }
        let onMouseMove, onTouchMove;
        function onThumbDown(isMin) {
          return function(e) {
            e.preventDefault();
            if (isMin) {
              onMouseMove = onThumbMove(minThumb, true);
              onTouchMove = onThumbMove(minThumb, true);
            } else {
              onMouseMove = onThumbMove(maxThumb, false);
              onTouchMove = onThumbMove(maxThumb, false);
            }
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onThumbUp);
            document.addEventListener('touchmove', onTouchMove);
            document.addEventListener('touchend', onThumbUp);
          };
        }
        minThumb.addEventListener('mousedown', onThumbDown(true));
        maxThumb.addEventListener('mousedown', onThumbDown(false));
        minThumb.addEventListener('touchstart', onThumbDown(true));
        maxThumb.addEventListener('touchstart', onThumbDown(false));
        minInput.addEventListener('input', function() {
          const value = parseInt(this.value) || 0;
          minPercent = ((value - minPrice) / (maxPrice - minPrice)) * 100;
          if (minPercent >= maxPercent - 5) minPercent = maxPercent - 5;
          updateSlider();
        });
        maxInput.addEventListener('input', function() {
          const value = parseInt(this.value) || maxPrice;
          maxPercent = ((value - minPrice) / (maxPrice - minPrice)) * 100;
          if (maxPercent <= minPercent + 5) maxPercent = minPercent + 5;
          updateSlider();
        });
        updateSlider();
      }
    }

    function applySearchPriceFilter() {
      const minPrice = parseFloat(document.getElementById('searchMinPrice').value) || 0;
      const maxPrice = parseFloat(document.getElementById('searchMaxPrice').value) || 10000;
      const filteredResults = window.currentSearchResults.filter(product => {
        const price = parsePrice(product.price);
        return price >= minPrice && price <= maxPrice;
      });
      renderSearchResults(filteredResults, window.currentSearchQuery);
    }

    function resetSearchPriceFilter() {
      document.getElementById('searchMinPrice').value = '0';
      document.getElementById('searchMaxPrice').value = '10000';
      const minThumb = document.getElementById('searchPriceMinThumb');
      const maxThumb = document.getElementById('searchPriceMaxThumb');
      const range = document.getElementById('searchPriceSliderRange');
      if (minThumb && maxThumb && range) {
        minThumb.style.left = '0%';
        maxThumb.style.left = '100%';
        range.style.left = '0%';
        range.style.width = '100%';
      }
      renderSearchResults(window.currentSearchResults, window.currentSearchQuery);
    }

    let reviews = [];

    function calculateProductRating(productId) {
      const productReviews = reviews.filter(r => r.productId === productId);
      if (productReviews.length === 0) return 0;
      const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
      return sum / productReviews.length;
    }

    function createProductCard(product, preCalculatedRating) {
      if (!product) {
        console.error('Attempted to create product card with null product');
        return document.createElement('div');
      }
      const card = document.createElement('div');
      card.className = 'product-card';
      const productId = product.id || product.productId || product._id || product.key || (function(){
        var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var id='';for(var i=0;i<6;i++)id+=chars[Math.floor(Math.random()*chars.length)];return id;
      })();
      card.setAttribute('data-product-id', productId);
      const isWishlisted = isInWishlist(productId);
      // Use pre-calculated rating to avoid expensive reviews.filter in loops
      const rating = preCalculatedRating !== undefined ? preCalculatedRating : calculateProductRating(productId);
      const productName = product.name || product.title || 'Product Name';
      const productPrice = formatPrice(product.price);
      const productImage = getProductImage(product);
      const productBadge = product.badge || product.tag || '';
      const isTrending = product.isTrending || product.trending || false;
      const isFeatured = product.isFeatured || product.featured || false;
      let badgeHtml = '';
      if (isFeatured) {
        badgeHtml = `<div class="professional-badge" style="background:#22c55e;">FEATURED</div>`;
      } else if (isTrending) {
        badgeHtml = `<div class="professional-badge">TRENDING</div>`;
      } else if (productBadge) {
        badgeHtml = `<div class="product-card-badge">${productBadge}</div>`;
      }
      card.innerHTML = `
        <div class="product-card-image" style="background-image: url('${productImage}')">
          ${badgeHtml}
        </div>
        <div class="product-card-body">
          <div class="product-card-title">${productName}</div>
          ${product.brand ? `<div onclick="event.stopPropagation();showBrandProfile('${product.brandId || (product.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_')}','${(product.brand||'').replace(/'/g,'')}');" style="font-size:11px;color:#2563eb;margin:-2px 0 5px;display:inline-flex;align-items:center;gap:3px;font-weight:700;cursor:pointer;" title="View Brand"><span>${product.brand}</span>${(function(){try{var cacheB=window.__bzBrandsCache&&window.__bzBrandsCache.find(function(x){return x.id===(product.brandId||(product.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_'))||x.name===(product.brand||'');});return cacheB&&cacheB.blueTickAdmin?'<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"13\" height=\"13\" viewBox=\"0 0 100 100\" style=\"display:inline-block;vertical-align:middle;margin-left:2px;\"><path d=\"M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z\" fill=\"#1DA1F2\"/><polyline points=\"31,50 44,63 69,36\" fill=\"none\" stroke=\"white\" stroke-width=\"8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>':'';}catch(e){return '';}})()}</div>` : ''}
          <div class="product-card-rating">
            <div class="product-card-stars">${generateStarRating(rating)}</div>
            <div class="product-card-review-count">(${product.reviewCount || '0'})</div>
          </div>
          <div class="product-card-price">
            <div class="product-card-current-price">${productPrice}</div>
            ${product.originalPrice ? `<div class="product-card-original-price">${formatPrice(product.originalPrice)}</div>` : ''}
          </div>
          <div class="product-card-actions">
            <button class="action-btn wishlist-btn ${isWishlisted ? 'active' : ''}" data-product-id="${productId}" title="Wishlist">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted ? 'red' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div style="flex:1"></div>
            <button class="action-btn share-btn" data-product-id="${productId}" title="Share">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
      if (!product.id) product.id = productId;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.wishlist-btn') || e.target.closest('.share-btn')) return;
        e.preventDefault();
        e.stopPropagation();
        showProductDetail(product);
      });
      const wishlistBtn = card.querySelector('.wishlist-btn');
      wishlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWishlist(productId);
      });
      const shareBtn = card.querySelector('.share-btn');
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        shareProduct(product);
      });
      return card;
    }

    function generateStarRating(rating) {
      const fullStars = Math.floor(rating);
      const halfStar = rating % 1 >= 0.5;
      const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
      let stars = '';
      for (let i = 0; i < fullStars; i++) stars += '★';
      if (halfStar) stars += '½';
      for (let i = 0; i < emptyStars; i++) stars += '☆';
      return stars;
    }

    function shareProduct(product) {
      const productId = product.id || product.productId || product._id;
      const shareLink = window.location.origin + window.location.pathname.replace('index.html', '') + '#productDetailPage?product=' + productId;
      if (navigator.share) {
        navigator.share({
          title: product.name || product.title,
          text: `Check out ${product.name || product.title} on Buyzo Cart`,
          url: shareLink,
        }).catch((error) => console.log('Error sharing:', error));
      } else {
        navigator.clipboard.writeText(shareLink)
          .then(() => showToast('Link copied to clipboard!', 'success'))
          .catch(err => showToast('Failed to copy link', 'error'));
      }
    }

    let slideStartX = 0;
    let slideEndX = 0;
    let isDragging = false;

    function initProductDetailSwipe() {
      const mainImage = document.getElementById('mainProductImage');
      if (!mainImage) return;
      
      mainImage.addEventListener('touchstart', handleTouchStart, { passive: true });
      mainImage.addEventListener('touchmove', handleTouchMove, { passive: false });
      mainImage.addEventListener('touchend', handleTouchEnd);
      mainImage.addEventListener('mousedown', handleMouseDown);
      mainImage.addEventListener('mousemove', handleMouseMove);
      mainImage.addEventListener('mouseup', handleMouseUp);
      mainImage.addEventListener('mouseleave', handleMouseLeave);
    }

    function handleTouchStart(e) {
      slideStartX = e.touches[0].clientX;
      isDragging = true;
      pauseSlide();
    }

    function handleTouchMove(e) {
      if (!isDragging) return;
      slideEndX = e.touches[0].clientX;
      const diff = slideStartX - slideEndX;
      const mainImage = document.getElementById('mainProductImage');
      if (Math.abs(diff) > 10) {
        e.preventDefault();
        mainImage.style.transform = `translateX(${-diff * 0.3}px)`;
        mainImage.style.transition = 'none';
      }
    }

    function handleTouchEnd(e) {
      if (!isDragging) return;
      const mainImage = document.getElementById('mainProductImage');
      mainImage.style.transform = '';
      mainImage.style.transition = '';
      slideEndX = e.changedTouches[0].clientX;
      const diff = slideStartX - slideEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextDetailImage();
        } else {
          prevDetailImage();
        }
      }
      isDragging = false;
      resumeSlideAfterDelay();
    }

    function handleMouseDown(e) {
      slideStartX = e.clientX;
      isDragging = true;
      pauseSlide();
    }

    function handleMouseMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      slideEndX = e.clientX;
      const diff = slideStartX - slideEndX;
      const mainImage = document.getElementById('mainProductImage');
      if (Math.abs(diff) > 10) {
        mainImage.style.transform = `translateX(${-diff * 0.3}px)`;
        mainImage.style.transition = 'none';
      }
    }

    function handleMouseUp(e) {
      if (!isDragging) return;
      const mainImage = document.getElementById('mainProductImage');
      mainImage.style.transform = '';
      mainImage.style.transition = '';
      slideEndX = e.clientX;
      const diff = slideStartX - slideEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextDetailImage();
        } else {
          prevDetailImage();
        }
      }
      isDragging = false;
      resumeSlideAfterDelay();
    }

    function handleMouseLeave() {
      if (isDragging) {
        const mainImage = document.getElementById('mainProductImage');
        mainImage.style.transform = '';
        mainImage.style.transition = '';
        resumeSlideAfterDelay();
        isDragging = false;
      }
      slideStartX = 0;
      slideEndX = 0;
    }

    function showProductDetail(product) {
      if (!product) {
        showToast('Product not found', 'error');
        return;
      }
      const productId = product.id || product.productId || product._id || product.key;
      if (!productId) product.id = 'temp-' + Date.now();
      let freshProduct = null;
      if (productId) {
        freshProduct = products.find(p => p.id === productId || p.productId === productId || p._id === productId || p.key === productId);
      }
      if (!freshProduct) freshProduct = product;
      if (!freshProduct.id && productId) freshProduct.id = productId;
      else if (!freshProduct.id) freshProduct.id = 'product-' + Date.now();
      currentProduct = freshProduct;
      currentProductImages = getProductImages(freshProduct);
      currentImageIndex = 0;
      const elements = {
        detailTitle: document.getElementById('detailTitle'),
        detailPrice: document.getElementById('detailPrice'),
        detailDesc: document.getElementById('detailDesc'),
        detailFullDesc: document.getElementById('detailFullDesc'),
        detailSku: document.getElementById('detailSku'),
        breadcrumbProductName: document.getElementById('breadcrumbProductName'),
        mainProductImage: document.getElementById('mainProductImage')
      };
      const productName = freshProduct.name || freshProduct.title || 'Product';
      const productPrice = formatPrice(freshProduct.price);
      const productDescription = freshProduct.description || freshProduct.desc || '';
      const productFullDesc = freshProduct.fullDescription || freshProduct.fullDesc || freshProduct.details || productDescription;
      const productSku = freshProduct.sku || freshProduct.SKU || 'N/A';
      if (elements.detailTitle) elements.detailTitle.textContent = productName;
      if (elements.detailPrice) elements.detailPrice.textContent = productPrice;
      if (elements.detailDesc) elements.detailDesc.textContent = productDescription;
      if (elements.detailFullDesc) elements.detailFullDesc.textContent = productFullDesc;
      if (elements.detailSku) elements.detailSku.textContent = 'SKU: ' + productSku;
      if (elements.breadcrumbProductName) elements.breadcrumbProductName.textContent = productName;

      // ── Brand name in detail ──
      var brandBadgeEl = document.getElementById('detailBrandBadge');
      if (!brandBadgeEl) {
        brandBadgeEl = document.createElement('div');
        brandBadgeEl.id = 'detailBrandBadge';
        var titleEl = elements.detailTitle;
        if (titleEl && titleEl.parentNode) titleEl.parentNode.insertBefore(brandBadgeEl, titleEl.nextSibling);
      }
      if (freshProduct.brand) {
        var bBrandId = freshProduct.brandId || freshProduct.brand.toLowerCase().replace(/[^a-z0-9]/g,'_');
        var bData = (window._brandsData||{})[bBrandId] || {};
        var blueTick = bData.blueTickAdmin ? '<span style="font-size:10px;margin-left:2px;">✓</span>' : '';
        brandBadgeEl.innerHTML = '<div onclick="showBrandProfile(\''+bBrandId+'\',\''+freshProduct.brand.replace(/'/g,'')+'\');" style="display:inline-flex;align-items:center;gap:5px;background:#eff6ff;color:#2563eb;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;margin:6px 0 10px;cursor:pointer;border:1px solid #bfdbfe;">🏷️ '+freshProduct.brand+blueTick+'</div>'
          + '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;display:flex;align-items:center;gap:6px;">'
          + '<span>Product ID: <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;font-size:11px;">'+(freshProduct.id||'').toUpperCase()+'</code></span>'
          + '<button onclick="navigator.clipboard&&navigator.clipboard.writeText(\''+freshProduct.id+'\').then(function(){showToast(\'Product ID copied!\',\'success\')})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:12px;padding:0;" title="Copy">📋</button>'
          + '</div>';
        brandBadgeEl.style.display = 'block';
      } else {
        brandBadgeEl.innerHTML = '<div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">Product ID: <code style="background:#f1f5f9;padding:1px 6px;border-radius:4px;">'+(freshProduct.id||'').toUpperCase()+'</code></div>';
        brandBadgeEl.style.display = 'block';
      }
      if (elements.mainProductImage && currentProductImages.length > 0) {
        elements.mainProductImage.style.backgroundImage = `url('${currentProductImages[0]}')`;
      }
      const stockStatus = document.getElementById('detailStockStatus');
      const orderBtn = document.getElementById('detailOrderBtn');
      if (stockStatus) {
        const quantity = freshProduct.quantity || freshProduct.stock || freshProduct.inventory || 0;
        if (quantity > 0) {
          stockStatus.textContent = 'In Stock';
          stockStatus.className = 'stock-status in-stock';
          if (orderBtn) orderBtn.disabled = false;
        } else {
          stockStatus.textContent = 'Out of Stock';
          stockStatus.className = 'stock-status out-of-stock';
          if (orderBtn) orderBtn.disabled = true;
        }
      }
      const shareLink = document.getElementById('productShareLink');
      if (shareLink) {
        const url = window.location.origin + window.location.pathname + '#productDetailPage?product=' + freshProduct.id;
        shareLink.value = url;
      }
      const wishlistBtn = document.getElementById('detailWishlistBtn');
      if (wishlistBtn) {
        if (isInWishlist(freshProduct.id)) {
          wishlistBtn.textContent = 'Remove from Wishlist';
          wishlistBtn.classList.add('active');
        } else {
          wishlistBtn.textContent = 'Add to Wishlist';
          wishlistBtn.classList.remove('active');
        }
      }
      initProductDetailGallery(freshProduct);
      initProductDetailSwipe();
      loadSimilarProducts(freshProduct);
      loadSimilarProductsSmall(freshProduct);
      loadProductReviews(freshProduct.id);
      if (currentUser) addToRecentlyViewed(freshProduct.id);
      showPage('productDetailPage');
      window.scrollTo(0, 0);
    }

    function initProductDetailGallery(product) {
      const mainImage = document.getElementById('mainProductImage');
      const dotsContainer = document.getElementById('detailCarouselDots');
      if (!mainImage || !dotsContainer) return;
      currentProductImages = getProductImages(product);
      if (currentProductImages.length === 0) currentProductImages = [getProductImage(product)];
      currentImageIndex = 0;
      _updateDetailMainImage();

      dotsContainer.innerHTML = '';
      currentProductImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `detail-carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          pauseSlide();
          currentImageIndex = index;
          _updateDetailMainImage();
          _updateDetailDots();
          resumeSlideAfterDelay();
        });
        dotsContainer.appendChild(dot);
      });

      const zoomBtn = document.getElementById('imageZoomBtn');
      if (zoomBtn && !zoomBtn._fvBound) {
        zoomBtn._fvBound = true;
        zoomBtn.style.display = 'none';
        zoomBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          pauseSlide();
          openFullscreenViewer(currentProductImages, currentImageIndex);
          resumeSlideAfterDelay();
        });
      } else if (zoomBtn) {
        zoomBtn.style.display = 'none';
      }

      if (mainImage && !mainImage._fvBound) {
        mainImage._fvBound = true;
        mainImage.style.cursor = 'zoom-in';
        mainImage.addEventListener('click', (e) => {
          if (e.target.closest('.detail-carousel-control')) return;
          openFullscreenViewer(currentProductImages, currentImageIndex);
        });
      }

      startAutoSlide();
    }

    function _updateDetailMainImage() {
      const mainImage = document.getElementById('mainProductImage');
      if (mainImage && currentProductImages[currentImageIndex]) {
        mainImage.style.backgroundImage = `url('${currentProductImages[currentImageIndex]}')`;
      }
    }
    function _updateDetailDots() {
      document.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentImageIndex);
      });
    }

    const _FV = {
      images: [],
      index: 0,
      zoom: 1,
      minZoom: 1,
      maxZoom: 5,
      panX: 0, panY: 0,
      lastPanX: 0, lastPanY: 0,
      dragging: false,
      dragStartX: 0, dragStartY: 0,
      pinching: false,
      pinchStartDist: 0,
      pinchStartZoom: 1,
      swipeStartX: 0,
      swipeStartY: 0,
      swipeMoved: false,
    };

    function openFullscreenViewer(images, startIndex) {
      _FV.images = images && images.length ? images : [images];
      _FV.index  = startIndex || 0;
      _FV.zoom   = 1;
      _FV.panX   = 0; _FV.panY = 0;

      const viewer = document.getElementById('fullscreenViewer');
      viewer.classList.add('active');
      document.body.style.overflow = 'hidden';

      fvBuildSlides();
      fvUpdateCounter();
      fvUpdateDots();
      fvApplyTransform();
      fvSyncSlider();
      fvBindEvents();
    }

    function openZoomModal(imageSrc) {
      openFullscreenViewer(currentProductImages, currentImageIndex);
    }

    function fvClose() {
      document.getElementById('fullscreenViewer').classList.remove('active');
      document.body.style.overflow = '';
      fvUnbindEvents();
      _FV.zoom = 1; _FV.panX = 0; _FV.panY = 0;
    }

    function fvBuildSlides() {
      const track = document.getElementById('viewerTrack');
      track.innerHTML = '';
      track.style.transform = `translateX(-${_FV.index * 100}%)`;
      _FV.images.forEach((src, i) => {
        const slide = document.createElement('div');
        slide.className = 'viewer-slide';
        slide.id = 'vslide_' + i;
        const img = document.createElement('img');
        img.src = src;
        img.draggable = false;
        img.alt = 'Product image ' + (i+1);
        slide.appendChild(img);
        track.appendChild(slide);
      });
    }

    function fvCurrentImg() {
      const slide = document.getElementById('vslide_' + _FV.index);
      return slide ? slide.querySelector('img') : null;
    }

    function fvApplyTransform() {
      const img = fvCurrentImg();
      if (!img) return;
      img.style.transform = `scale(${_FV.zoom}) translate(${_FV.panX/_FV.zoom}px, ${_FV.panY/_FV.zoom}px)`;
      img.style.transition = 'none';
    }

    function fvSetZoom(newZoom, animated) {
      _FV.zoom = Math.max(_FV.minZoom, Math.min(_FV.maxZoom, newZoom));
      if (_FV.zoom <= 1) { _FV.panX = 0; _FV.panY = 0; }
      fvClampPan();
      const img = fvCurrentImg();
      if (img) {
        img.style.transition = animated ? 'transform 0.2s ease' : 'none';
        img.style.transform = `scale(${_FV.zoom}) translate(${_FV.panX/_FV.zoom}px, ${_FV.panY/_FV.zoom}px)`;
      }
      fvSyncSlider();
    }

    function fvClampPan() {
      const img = fvCurrentImg();
      if (!img) return;
      const maxPanX = (img.naturalWidth  * _FV.zoom - img.clientWidth)  / 2;
      const maxPanY = (img.naturalHeight * _FV.zoom - img.clientHeight) / 2;
      _FV.panX = Math.max(-Math.abs(maxPanX), Math.min(Math.abs(maxPanX), _FV.panX));
      _FV.panY = Math.max(-Math.abs(maxPanY), Math.min(Math.abs(maxPanY), _FV.panY));
    }

    function fvSyncSlider() {
      const slider = document.getElementById('viewerZoomSlider');
      const label  = document.getElementById('viewerZoomLabel');
      if (slider) slider.value = Math.round(_FV.zoom * 100);
      if (label)  label.textContent = _FV.zoom.toFixed(1) + '×';
    }

    function fvUpdateCounter() {
      const el = document.getElementById('viewerCounter');
      if (el) el.textContent = (_FV.index+1) + ' / ' + _FV.images.length;
    }

    function fvUpdateDots() {
      const container = document.getElementById('viewerDots');
      if (!container) return;
      container.innerHTML = '';
      if (_FV.images.length <= 1) return;
      _FV.images.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'viewer-dot' + (i === _FV.index ? ' active' : '');
        dot.addEventListener('click', () => fvGoTo(i));
        container.appendChild(dot);
      });
    }

    function fvGoTo(idx) {
      if (idx < 0 || idx >= _FV.images.length) return;
      _FV.index = idx;
      _FV.zoom = 1; _FV.panX = 0; _FV.panY = 0;
      const track = document.getElementById('viewerTrack');
      if (track) {
        track.style.transition = 'transform 0.3s ease';
        track.style.transform = `translateX(-${_FV.index * 100}%)`;
        setTimeout(() => { if(track) track.style.transition = 'none'; }, 320);
      }
      fvUpdateCounter();
      fvUpdateDots();
      fvSyncSlider();
    }

    function fvOnTouchStart(e) {
      if (e.touches.length === 2) {
        _FV.pinching = true;
        _FV.pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        _FV.pinchStartZoom = _FV.zoom;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        _FV.dragging   = false;
        _FV.swipeMoved = false;
        _FV.swipeStartX = e.touches[0].clientX;
        _FV.swipeStartY = e.touches[0].clientY;
        if (_FV.zoom > 1) {
          _FV.dragging  = true;
          _FV.dragStartX = e.touches[0].clientX - _FV.panX;
          _FV.dragStartY = e.touches[0].clientY - _FV.panY;
        }
      }
    }

    function fvOnTouchMove(e) {
      if (_FV.pinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const newZoom = _FV.pinchStartZoom * (dist / _FV.pinchStartDist);
        fvSetZoom(newZoom, false);
        return;
      }
      if (_FV.dragging && e.touches.length === 1 && _FV.zoom > 1) {
        e.preventDefault();
        _FV.panX = e.touches[0].clientX - _FV.dragStartX;
        _FV.panY = e.touches[0].clientY - _FV.dragStartY;
        fvClampPan();
        fvApplyTransform();
        return;
      }
      if (e.touches.length === 1) {
        const dx = Math.abs(e.touches[0].clientX - _FV.swipeStartX);
        const dy = Math.abs(e.touches[0].clientY - _FV.swipeStartY);
        if (dx > 8 || dy > 8) _FV.swipeMoved = true;
      }
    }

    function fvOnTouchEnd(e) {
      if (_FV.pinching) {
        _FV.pinching = false;
        return;
      }
      if (_FV.dragging) {
        _FV.dragging = false;
        return;
      }
      if (_FV.zoom <= 1 && e.changedTouches.length === 1 && _FV.swipeMoved) {
        const dx = e.changedTouches[0].clientX - _FV.swipeStartX;
        if (Math.abs(dx) > 50) {
          dx < 0 ? fvGoTo(_FV.index + 1) : fvGoTo(_FV.index - 1);
        }
      }
      if (!_FV.swipeMoved && e.changedTouches.length === 1) {
        const now = Date.now();
        if (_FV._lastTap && now - _FV._lastTap < 300) {
          _FV._lastTap = 0;
          if (_FV.zoom > 1) fvSetZoom(1, true);
          else fvSetZoom(2.5, true);
        } else {
          _FV._lastTap = now;
        }
      }
    }

    function fvOnMouseDown(e) {
      if (_FV.zoom > 1) {
        _FV.dragging  = true;
        _FV.dragStartX = e.clientX - _FV.panX;
        _FV.dragStartY = e.clientY - _FV.panY;
        document.getElementById('fullscreenViewer').style.cursor = 'grabbing';
      }
    }
    function fvOnMouseMove(e) {
      if (!_FV.dragging) return;
      _FV.panX = e.clientX - _FV.dragStartX;
      _FV.panY = e.clientY - _FV.dragStartY;
      fvClampPan();
      fvApplyTransform();
    }
    function fvOnMouseUp() {
      _FV.dragging = false;
      document.getElementById('fullscreenViewer').style.cursor = '';
    }
    function fvOnWheel(e) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      fvSetZoom(_FV.zoom + delta, false);
    }

    function fvBindEvents() {
      const v = document.getElementById('fullscreenViewer');
      const c = document.getElementById('viewerContainer');
      document.getElementById('viewerClose')?.addEventListener('click', fvClose);
      document.getElementById('viewerPrev')?.addEventListener('click', () => fvGoTo(_FV.index - 1));
      document.getElementById('viewerNext')?.addEventListener('click', () => fvGoTo(_FV.index + 1));
      document.getElementById('viewerZoomIn')?.addEventListener('click', () => fvSetZoom(_FV.zoom + 0.5, true));
      document.getElementById('viewerZoomOut')?.addEventListener('click', () => fvSetZoom(_FV.zoom - 0.5, true));
      document.getElementById('viewerResetZoom')?.addEventListener('click', () => { fvSetZoom(1, true); _FV.panX=0; _FV.panY=0; fvApplyTransform(); });
      document.getElementById('viewerZoomSlider')?.addEventListener('input', function() {
        fvSetZoom(parseInt(this.value) / 100, false);
        fvApplyTransform();
      });
      c?.addEventListener('touchstart',  fvOnTouchStart, { passive: false });
      c?.addEventListener('touchmove',   fvOnTouchMove,  { passive: false });
      c?.addEventListener('touchend',    fvOnTouchEnd,   { passive: true  });
      c?.addEventListener('mousedown',   fvOnMouseDown);
      c?.addEventListener('mousemove',   fvOnMouseMove);
      c?.addEventListener('mouseup',     fvOnMouseUp);
      c?.addEventListener('mouseleave',  fvOnMouseUp);
      c?.addEventListener('wheel',       fvOnWheel, { passive: false });
      v?.addEventListener('click', (e) => {
        if (e.target === v) fvClose();
      });
      document.addEventListener('keydown', _fvKeyHandler);
    }

    function fvUnbindEvents() {
      const c = document.getElementById('viewerContainer');
      document.getElementById('viewerClose')?.removeEventListener('click', fvClose);
      document.getElementById('viewerPrev')?.removeEventListener('click', () => fvGoTo(_FV.index - 1));
      document.getElementById('viewerNext')?.removeEventListener('click', () => fvGoTo(_FV.index + 1));
      c?.removeEventListener('touchstart',  fvOnTouchStart);
      c?.removeEventListener('touchmove',   fvOnTouchMove);
      c?.removeEventListener('touchend',    fvOnTouchEnd);
      c?.removeEventListener('mousedown',   fvOnMouseDown);
      c?.removeEventListener('mousemove',   fvOnMouseMove);
      c?.removeEventListener('mouseup',     fvOnMouseUp);
      c?.removeEventListener('mouseleave',  fvOnMouseUp);
      c?.removeEventListener('wheel',       fvOnWheel);
      document.removeEventListener('keydown', _fvKeyHandler);
    }

    function _fvKeyHandler(e) {
      if (!document.getElementById('fullscreenViewer')?.classList.contains('active')) return;
      if (e.key === 'Escape')      fvClose();
      if (e.key === 'ArrowLeft')   fvGoTo(_FV.index - 1);
      if (e.key === 'ArrowRight')  fvGoTo(_FV.index + 1);
      if (e.key === '+' || e.key === '=') fvSetZoom(_FV.zoom + 0.5, true);
      if (e.key === '-')           fvSetZoom(_FV.zoom - 0.5, true);
    }

    function startAutoSlide() {
      if (autoSlideInterval) clearInterval(autoSlideInterval);
      autoSlideInterval = setInterval(() => {
        if (!slidePaused && currentProductImages && currentProductImages.length > 1) {
          nextDetailImage();
        }
      }, 3000);
    }

    function pauseSlide() {
      slidePaused = true;
    }

    function resumeSlideAfterDelay() {
      setTimeout(() => {
        slidePaused = false;
      }, 3000);
    }

    function prevDetailImage() {
      if (!currentProductImages || currentProductImages.length <= 1) return;
      currentImageIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
      _updateDetailMainImage();
      _updateDetailDots();
    }

    function nextDetailImage() {
      if (!currentProductImages || currentProductImages.length <= 1) return;
      currentImageIndex = (currentImageIndex + 1) % currentProductImages.length;
      _updateDetailMainImage();
      _updateDetailDots();
    }

    function updateDetailImage() {
      _updateDetailMainImage();
      _updateDetailDots();
    }

    function openProductImageModal() {
      if (!currentProduct) return;
      currentProductModalIndex = currentImageIndex;
      updateProductModalImage();
      document.getElementById('productImageModal').classList.add('active');
      const modalImage = document.getElementById('productImageModalImage');
      modalImage.addEventListener('touchstart', handleModalTouchStart, { passive: true });
      modalImage.addEventListener('touchmove', handleModalTouchMove, { passive: false });
      modalImage.addEventListener('touchend', handleModalTouchEnd);
    }
    
    let modalTouchStartX = 0;
    let modalTouchEndX = 0;
    
    function handleModalTouchStart(e) {
      modalTouchStartX = e.touches[0].screenX;
    }
    
    function handleModalTouchMove(e) {
      e.preventDefault();
      modalTouchEndX = e.touches[0].screenX;
    }
    
    function handleModalTouchEnd(e) {
      const diff = modalTouchStartX - modalTouchEndX;
      const minSwipeDistance = 50;
      if (Math.abs(diff) > minSwipeDistance) {
        if (diff > 0) nextProductModalImage();
        else prevProductModalImage();
      }
      modalTouchStartX = 0;
      modalTouchEndX = 0;
    }

    function updateProductModalImage() {
      const modalImage = document.getElementById('productImageModalImage');
      const dotsContainer = document.getElementById('productImageModalDots');
      if (!modalImage || !dotsContainer) return;
      modalImage.src = currentProductImages[currentProductModalIndex];
      dotsContainer.innerHTML = '';
      currentProductImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `product-image-modal-dot ${index === currentProductModalIndex ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          currentProductModalIndex = index;
          updateProductModalImage();
        });
        dotsContainer.appendChild(dot);
      });
    }

    function prevProductModalImage() {
      if (currentProductImages.length <= 1) return;
      currentProductModalIndex = (currentProductModalIndex - 1 + currentProductImages.length) % currentProductImages.length;
      updateProductModalImage();
    }

    function nextProductModalImage() {
      if (currentProductImages.length <= 1) return;
      currentProductModalIndex = (currentProductModalIndex + 1) % currentProductImages.length;
      updateProductModalImage();
    }

    function loadSimilarProducts(product) {
      const adminSimilarIds = (product.similarFromAdmin && Array.isArray(product.similarFromAdmin)) ? product.similarFromAdmin : [];
      let similarProducts = products
        .filter(p => p.id !== product.id && p.category === product.category && !adminSimilarIds.includes(p.id))
        .slice(0, 20);
      const ratingMap = getRatingMap();
      similarProducts.sort((a, b) => (ratingMap[b.id] || 0) - (ratingMap[a.id] || 0));
      const firstRow = similarProducts.slice(0, 10);
      const secondRow = similarProducts.slice(10, 20);
      const container = document.getElementById('similarProductsSlider');
      if (!container) return;
      container.innerHTML = '';
      const fragment = document.createDocumentFragment();
      const rowDiv = document.createElement('div');
      rowDiv.style.display = 'flex';
      rowDiv.style.flexDirection = 'column';
      rowDiv.style.gap = '20px';
      rowDiv.style.width = '100%';
      const row1Div = document.createElement('div');
      row1Div.style.display = 'flex';
      row1Div.style.overflowX = 'auto';
      row1Div.style.gap = '15px';
      row1Div.style.paddingBottom = '10px';
      row1Div.style.scrollbarWidth = 'none';
      row1Div.style.msOverflowStyle = 'none';
      row1Div.className = 'slider-track';
      const row2Div = document.createElement('div');
      row2Div.style.display = 'flex';
      row2Div.style.overflowX = 'auto';
      row2Div.style.gap = '15px';
      row2Div.style.paddingBottom = '10px';
      row2Div.style.scrollbarWidth = 'none';
      row2Div.style.msOverflowStyle = 'none';
      row2Div.className = 'slider-track';
      firstRow.forEach(p => {
        const sliderItem = document.createElement('div');
        sliderItem.className = 'slider-item';
        sliderItem.style.minWidth = '160px';
        sliderItem.style.maxWidth = '160px';
        sliderItem.innerHTML = `
          <div class="slider-item-img" style="background-image: url('${getProductImage(p)}'); height: 120px; background-size: contain; background-position: center; background-repeat: no-repeat; background-color: #f8fafc;"></div>
          <div class="slider-item-body">
            <div class="slider-item-title">${p.name || p.title || 'Product'}</div>
            <div class="slider-item-price">${formatPrice(p.price)}</div>
          </div>
        `;
        sliderItem.addEventListener('click', () => showProductDetail(p));
        row1Div.appendChild(sliderItem);
      });
      secondRow.forEach(p => {
        const sliderItem = document.createElement('div');
        sliderItem.className = 'slider-item';
        sliderItem.style.minWidth = '160px';
        sliderItem.style.maxWidth = '160px';
        sliderItem.innerHTML = `
          <div class="slider-item-img" style="background-image: url('${getProductImage(p)}'); height: 120px; background-size: contain; background-position: center; background-repeat: no-repeat; background-color: #f8fafc;"></div>
          <div class="slider-item-body">
            <div class="slider-item-title">${p.name || p.title || 'Product'}</div>
            <div class="slider-item-price">${formatPrice(p.price)}</div>
          </div>
        `;
        sliderItem.addEventListener('click', () => showProductDetail(p));
        row2Div.appendChild(sliderItem);
      });
      if (firstRow.length > 0) rowDiv.appendChild(row1Div);
      if (secondRow.length > 0) rowDiv.appendChild(row2Div);
      if (firstRow.length === 0 && secondRow.length === 0) {
        rowDiv.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">No similar products found</p>';
      }
      container.appendChild(rowDiv);
    }

    function loadSimilarProductsSmall(product) {
      const container = document.getElementById('similarProductsSmallSlider');
      if (!container) return;
      let similarProducts = [];
      if (product.similarFromAdmin && Array.isArray(product.similarFromAdmin) && product.similarFromAdmin.length > 0) {
        similarProducts = product.similarFromAdmin.map(id => products.find(p => p.id === id)).filter(p => p);
      }
      if (similarProducts.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">No similar products found</p>';
        return;
      }
      const fragment = document.createDocumentFragment();
      similarProducts.slice(0, 6).forEach(simProduct => {
        const item = document.createElement('div');
        item.className = 'similar-product-small';
        item.innerHTML = `
          <div class="similar-product-small-img" style="background-image: url('${getProductImage(simProduct)}')"></div>
          <div class="similar-product-small-info">
            <div class="similar-product-small-title">${(simProduct.name || simProduct.title || '').length > 20 ? (simProduct.name || simProduct.title || '').substring(0, 20) + '...' : (simProduct.name || simProduct.title || 'Product')}</div>
            <div class="similar-product-small-price">${formatPrice(simProduct.price)}</div>
          </div>
        `;
        item.addEventListener('click', () => showProductDetail(simProduct));
        fragment.appendChild(item);
      });
      container.innerHTML = '';
      container.appendChild(fragment);
    }

    function renderProductSlider(productsToRender, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      const fragment = document.createDocumentFragment();
      productsToRender.forEach(product => {
        const sliderItem = document.createElement('div');
        sliderItem.className = 'slider-item';
        sliderItem.innerHTML = `
          <div class="slider-item-img" style="background-image: url('${getProductImage(product)}'); background-size: contain; background-position: center; background-repeat: no-repeat; background-color: #f8fafc;"></div>
          <div class="slider-item-body">
            <div class="slider-item-title">${product.name || product.title || 'Product Name'}</div>
            <div class="slider-item-price">${formatPrice(product.price)}</div>
          </div>
        `;
        sliderItem.addEventListener('click', () => showProductDetail(product));
        fragment.appendChild(sliderItem);
      });
      container.appendChild(fragment);
    }

    function isInWishlist(productId) {
      let wishlist = JSON.parse(localStorage.getItem(CACHE_KEYS.WISHLIST) || '[]');
      return wishlist.includes(productId);
    }

    function toggleWishlist(productId) {
      let wishlist = JSON.parse(localStorage.getItem(CACHE_KEYS.WISHLIST) || '[]');
      const isWishlisted = wishlist.includes(productId);
      if (isWishlisted) {
        wishlist = wishlist.filter(id => id !== productId);
        showToast('Removed from wishlist', 'success');
      } else {
        wishlist.push(productId);
        showToast('Added to wishlist', 'success');
      }
      localStorage.setItem(CACHE_KEYS.WISHLIST, JSON.stringify(wishlist));
      
      if (currentUser && window.firebase) {
        const wishlistRef = window.firebase.ref(window.firebase.database, 'wishlist/' + currentUser.uid + '/' + productId);
        if (isWishlisted) {
          window.firebase.remove(wishlistRef).catch(function(e) { console.warn('Wishlist remove error:', e); });
        } else {
          const product = products.find(function(p) { return p.id === productId || p._id === productId; });
          if (product) {
            window.firebase.set(wishlistRef, {
              productId: productId,
              name: product.name || product.title || 'Product',
              price: product.price,
              image: getProductImage(product),
              addedAt: Date.now(),
              userId: currentUser.uid
            }).catch(function(e) { console.warn('Wishlist add error:', e); });
          }
        }
      }
      
      updateWishlistButtons();
      if (document.getElementById('wishlistPage') && document.getElementById('wishlistPage').classList.contains('active')) {
        renderWishlist();
      }
    }

    function toggleWishlistFromDetail() {
      if (!currentProduct) return;
      toggleWishlist(currentProduct.id);
      const wishlistBtn = document.getElementById('detailWishlistBtn');
      if (isInWishlist(currentProduct.id)) {
        wishlistBtn.textContent = 'Remove from Wishlist';
        wishlistBtn.classList.add('active');
      } else {
        wishlistBtn.textContent = 'Add to Wishlist';
        wishlistBtn.classList.remove('active');
      }
    }

    function updateWishlistButtons() {
      document.querySelectorAll('.wishlist-btn').forEach(btn => {
        const productId = btn.getAttribute('data-product-id');
        if (productId) {
          const isActive = isInWishlist(productId);
          btn.classList.toggle('active', isActive);
          const svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', isActive ? 'red' : 'none');
        }
      });
    }

    function renderWishlist() {
      const container = document.getElementById('wishlistItems');
      const empty = document.getElementById('emptyWishlist');
      if (!container || !empty) return;
      let wishlistProductIds = JSON.parse(localStorage.getItem(CACHE_KEYS.WISHLIST) || '[]');
      const wishlistProducts = products.filter(product => wishlistProductIds.includes(product.id));
      if (wishlistProducts.length === 0) {
        container.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      container.style.display = 'grid';
      container.className = 'product-grid';
      empty.style.display = 'none';
      renderProducts(wishlistProducts, 'wishlistItems');
    }

    function orderProductFromDetail() {
      if (!currentProduct) return;
      const hasQuantityField = currentProduct.quantity !== undefined || currentProduct.stock !== undefined || currentProduct.inventory !== undefined;
      const quantity = currentProduct.quantity ?? currentProduct.stock ?? currentProduct.inventory ?? 1;
      if (hasQuantityField && quantity <= 0) {
        showToast('Product is out of stock', 'error');
        return;
      }
      document.getElementById('spTitle').textContent = currentProduct.name || currentProduct.title || 'Product';
      document.getElementById('spPrice').textContent = formatPrice(currentProduct.price);
      document.getElementById('spDesc').textContent = currentProduct.description || currentProduct.desc || '';
      document.getElementById('spFullDesc').textContent = currentProduct.fullDescription || currentProduct.fullDesc || currentProduct.details || currentProduct.description || '';
      const sizeOptionsContainer = document.getElementById('sizeOptions');
      sizeOptionsContainer.innerHTML = '';
      const sizesFromProduct = currentProduct.sizes || ['S', 'M', 'L', 'XL', 'XXL'];
      sizesFromProduct.forEach(sizeVal => {
        const opt = document.createElement('div');
        opt.className = 'size-option';
        opt.setAttribute('data-value', sizeVal);
        opt.textContent = sizeVal;
        opt.addEventListener('click', function() {
          document.querySelectorAll('#sizeOptions .size-option').forEach(opt => opt.classList.remove('selected'));
          this.classList.add('selected');
          document.getElementById('sizeValidationError')?.classList.remove('show');
        });
        sizeOptionsContainer.appendChild(opt);
      });
      document.getElementById('qtySelect').value = 1;
      initOrderPageGallery();
      showPage('orderPage');
    }

    function initOrderPageGallery() {
      if (!currentProduct) return;
      const galleryMain = document.getElementById('galleryMain');
      const dotsContainer = document.getElementById('orderCarouselDots');
      if (!galleryMain || !dotsContainer) return;
      const productImages = getProductImages(currentProduct);
      if (productImages.length === 0) productImages.push(getProductImage(currentProduct));
      galleryMain.style.backgroundImage = `url('${productImages[0]}')`;
      dotsContainer.innerHTML = '';
      productImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => setOrderPageImage(index, productImages));
        dotsContainer.appendChild(dot);
      });
      const prevBtn = galleryMain.querySelector('.carousel-control.prev');
      const nextBtn = galleryMain.querySelector('.carousel-control.next');
      if (prevBtn) prevBtn.onclick = () => {
        const activeIndex = Array.from(dotsContainer.children).findIndex(dot => dot.classList.contains('active'));
        const newIndex = (activeIndex - 1 + productImages.length) % productImages.length;
        setOrderPageImage(newIndex, productImages);
      };
      if (nextBtn) nextBtn.onclick = () => {
        const activeIndex = Array.from(dotsContainer.children).findIndex(dot => dot.classList.contains('active'));
        const newIndex = (activeIndex + 1) % productImages.length;
        setOrderPageImage(newIndex, productImages);
      };
    }

    function setOrderPageImage(index, productImages) {
      const galleryMain = document.getElementById('galleryMain');
      const dots = document.querySelectorAll('#orderCarouselDots .carousel-dot');
      if (galleryMain && productImages[index]) galleryMain.style.backgroundImage = `url('${productImages[index]}')`;
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    function toUserInfo() {
      const selectedSize = document.querySelector('#sizeOptions .size-option.selected');
      if (!selectedSize) {
        document.getElementById('sizeValidationError').classList.add('show');
        showToast('Please select a size to continue', 'error');
        return;
      }
      showPage('userPage');
    }

    async function toPayment() {
      const fullname = document.getElementById('fullname').value;
      const mobile = document.getElementById('mobile').value;
      const pincode = document.getElementById('pincode').value;
      const city = document.getElementById('city').value;
      const state = document.getElementById('state').value;
      const house = document.getElementById('house').value;
      const addressType = document.getElementById('addressType')?.value || 'home';
      if (!fullname || !mobile || !pincode || !city || !state || !house) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      userInfo = { fullName: fullname, mobile, pincode, city, state, house };

      if (currentUser) {
        try {
          const alreadySaved = savedAddresses.some(a => a.mobile === mobile && a.pincode === pincode && a.street === house);
          if (!alreadySaved) {
            const addressId = 'address_' + Date.now();
            const addressData = {
              name: fullname, mobile, pincode, city, state,
              street: house, type: addressType,
              userId: currentUser.uid,
              isDefault: savedAddresses.length === 0,
              createdAt: Date.now()
            };
            await window.firebase.set(window.firebase.ref(window.firebase.database, 'addresses/' + addressId), addressData);
            savedAddresses.push({ id: addressId, ...addressData });
            cacheManager.set(CACHE_KEYS.ADDRESSES, savedAddresses);
          }
        } catch (e) {}
      }

      showPage('paymentPage');
    }

    async function confirmOrder() {
      if (!currentUser) {
        showLoginModal();
        return;
      }
      if (!userInfo.fullName || !userInfo.mobile) {
        showToast('Please complete your information first', 'error');
        showPage('userPage');
        return;
      }
      if (!currentProduct) {
        showToast('No product selected', 'error');
        showPage('productsPage');
        return;
      }
      const orderId = generateOrderId();
      currentOrderId = orderId;
      const paymentMethod = document.querySelector('input[name="pay"]:checked').value;
      const quantity = parseInt(document.getElementById('qtySelect').value) || 1;
      const size = document.querySelector('#sizeOptions .size-option.selected')?.getAttribute('data-value') || 'Not specified';
      const productPrice = parsePrice(currentProduct.price);
      const subtotal = productPrice * quantity;
      const deliveryCharge = adminSettings.deliveryCharge || 50;
      const gatewayChargePercent = adminSettings.gatewayChargePercent || 2;
      const gatewayCharge = paymentMethod === 'prepaid' ? subtotal * (gatewayChargePercent / 100) : 0;
      const total = subtotal + deliveryCharge + gatewayCharge;
      try {
        const confirmBtn = document.getElementById('confirmOrder');
        confirmBtn.innerHTML = '<div class="loading-spinner"></div> Placing Order...';
        confirmBtn.disabled = true;
        const orderData = {
          orderId: orderId,
          userId: currentUser.uid,
          username: userInfo.fullName,
          userEmail: currentUser.email,
          productId: currentProduct.id,
          productName: currentProduct.name || currentProduct.title,
          productImage: getProductImage(currentProduct),
          productPrice: productPrice,
          quantity: quantity,
          size: size,
          subtotal: subtotal,
          deliveryCharge: deliveryCharge,
          gatewayCharge: gatewayCharge,
          totalAmount: total,
          paymentMethod: paymentMethod,
          status: 'placed',
          orderDate: Date.now(),
          userInfo: userInfo,
          address: {
            name: userInfo.fullName || '',
            mobile: userInfo.mobile || '',
            street: userInfo.house || userInfo.address || '',
            city: userInfo.city || '',
            state: userInfo.state || '',
            pincode: userInfo.pincode || ''
          },
          items: [{
            name: (currentProduct.name || currentProduct.title || 'Product'),
            image: getProductImage(currentProduct),
            price: productPrice,
            quantity: quantity,
            size: size,
            productId: currentProduct.id
          }],
          assignedDeliveryBoyId: null,
          cancelledBy: null,
          cancelReason: null,
          deliveredDate: null,
          cancelledDate: null,
          tracking: {
            placed: Date.now(),
            confirmed: null,
            shipped: null,
            out_for_delivery: null,
            delivered: null
          }
        };
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'orders/' + orderId), orderData);
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'userOrders/' + currentUser.uid + '/' + orderId), true);
        // Track order count per product (for trending + scoring)
        try {
          const _psRef = window.firebase.ref(window.firebase.database, 'productStats/' + orderData.productId + '/orderCount');
          const _psSnap = await window.firebase.get(_psRef);
          const _newCount = (_psSnap.val() || 0) + 1;
          await window.firebase.set(_psRef, _newCount);
          if (_newCount >= 5) {
            const _pRef = window.firebase.ref(window.firebase.database, 'productStats/' + orderData.productId + '/autoTrending');
            const _manSnap = await window.firebase.get(window.firebase.ref(window.firebase.database, 'productStats/' + orderData.productId + '/manualOverride'));
            if (!_manSnap.val()) {
              await window.firebase.set(_pRef, true);
              await window.firebase.update(window.firebase.ref(window.firebase.database, 'products/' + orderData.productId), { isTrending: true });
            }
          }
        } catch(_e) { /* non-critical */ }
        let cachedOrders = cacheManager.get(CACHE_KEYS.ORDERS) || [];
        cachedOrders.push(orderData);
        cacheManager.set(CACHE_KEYS.ORDERS, cachedOrders);
        sendOrderNotification(currentUser.email, orderId, currentProduct.name, total);
        document.getElementById('orderIdDisplay').textContent = orderId;
        showPage('successPage');
        showToast('Order placed successfully!', 'success');
        if (document.getElementById('myOrdersPage')?.classList.contains('active')) showMyOrders();
      } catch (error) {
        console.error('Error placing order:', error);
        showToast('Order placed successfully!', 'success');
        document.getElementById('orderIdDisplay').textContent = orderId;
        showPage('successPage');
      } finally {
        const confirmBtn = document.getElementById('confirmOrder');
        if (confirmBtn) {
          confirmBtn.textContent = 'Confirm & Place Order';
          confirmBtn.disabled = false;
        }
      }
    }

    function updatePaymentSummary() {
      if (!currentProduct) {
        document.getElementById('sumProduct').textContent = '-';
        document.getElementById('sumQty').textContent = '-';
        document.getElementById('sumPrice').textContent = '-';
        document.getElementById('sumDel').textContent = `${getCurrencySymbol()}${adminSettings.deliveryCharge || 50}`;
        document.getElementById('sumGateway').textContent = `${getCurrencySymbol()}0`;
        document.getElementById('sumTotal').textContent = '-';
        return;
      }
      const quantity = parseInt(document.getElementById('qtySelect').value) || 1;
      const paymentMethod = document.querySelector('input[name="pay"]:checked').value;
      const productPrice = parsePrice(currentProduct.price);
      const subtotal = productPrice * quantity;
      const deliveryCharge = adminSettings.deliveryCharge || 50;
      const gatewayChargePercent = adminSettings.gatewayChargePercent || 2;
      const gatewayCharge = paymentMethod === 'prepaid' ? subtotal * (gatewayChargePercent / 100) : 0;
      const total = subtotal + deliveryCharge + gatewayCharge;
      document.getElementById('sumProduct').textContent = currentProduct.name || currentProduct.title || 'Product';
      document.getElementById('sumQty').textContent = quantity;
      document.getElementById('sumPrice').textContent = `${getCurrencySymbol()}${subtotal.toLocaleString()}`;
      document.getElementById('sumDel').textContent = `${getCurrencySymbol()}${deliveryCharge}`;
      document.getElementById('sumGateway').textContent = `${getCurrencySymbol()}${gatewayCharge.toFixed(2)}`;
      document.getElementById('sumTotal').textContent = `${getCurrencySymbol()}${total.toLocaleString()}`;
      const chargeNote = document.getElementById('paymentChargeNote');
      if (chargeNote) chargeNote.style.display = paymentMethod === 'prepaid' ? 'block' : 'none';
    }

    function decreaseQuantity() {
      const qtyInput = document.getElementById('qtySelect');
      let value = parseInt(qtyInput.value);
      if (value > 1) qtyInput.value = value - 1;
      if (document.getElementById('paymentPage')?.classList.contains('active')) updatePaymentSummary();
    }

    function increaseQuantity() {
      const qtyInput = document.getElementById('qtySelect');
      let value = parseInt(qtyInput.value);
      if (value < 3) qtyInput.value = value + 1;
      else showToast('Maximum 3 units per order', 'error');
      if (document.getElementById('paymentPage')?.classList.contains('active')) updatePaymentSummary();
    }

    function setRating(rating) {
      const stars = document.querySelectorAll('.rating-star');
      stars.forEach((star, index) => {
        if (index < rating) star.classList.add('active');
        else star.classList.remove('active');
      });
    }

    async function loadProductReviews(productId) {
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'reviews'),
            window.firebase.orderByChild('productId'),
            window.firebase.equalTo(productId)
          )
        );
        const reviewsList = document.getElementById('reviewsList');
        if (!reviewsList) return;
        if (!snapshot.exists()) {
          reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:16px;">No reviews yet. Be the first to review!</p>';
          reviews = [];
          return;
        }
        const reviewsObj = snapshot.val();
        const allReviews = Object.keys(reviewsObj).map(key => ({ id: key, ...reviewsObj[key] }));
        reviews = allReviews.filter(r =>
          r.status === 'approved' ||
          !r.status ||
          (currentUser && r.userId === currentUser.uid)
        );
        reviews.sort((a, b) => b.date - a.date);
        const sorted = [...reviews].sort((a,b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.date - a.date;
        });
        renderReviews(sorted.slice(0, 5), 'reviewsList');
      } catch (error) {
        console.error('Error loading reviews:', error);
      }
    }

    function renderReviews(reviewList, containerId) {
      const reviewsList = document.getElementById(containerId);
      if (!reviewsList) return;
      reviewsList.innerHTML = '';
      if (!reviewList.length) {
        reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:16px;">No approved reviews yet.</p>';
        return;
      }
      reviewList.forEach(review => {
        const reviewItem = document.createElement('div');
        reviewItem.className = 'review-item';
        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
        const date = new Date(review.date).toLocaleDateString('en-IN');
        const isVerified = review.isVerifiedPurchase ? '<span class="review-verified-badge">✓ Verified Purchase</span>' : '';
        const isPending = review.status === 'pending' ? '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">⏳ Pending Approval</span>' : '';

        let mediaHtml = '';
        if (review.fileUrl && review.fileType === 'image') {
          mediaHtml = `<div class="review-file-preview"><img src="${review.fileUrl}" alt="Review photo" loading="lazy" style="max-width:120px;max-height:120px;border-radius:8px;object-fit:cover;cursor:pointer;" onclick="window.open('${review.fileUrl}','_blank')"></div>`;
        } else if (review.fileUrl && review.fileType === 'video') {
          mediaHtml = `<div class="review-file-preview"><video controls src="${review.fileUrl}" style="max-width:100%;max-height:180px;border-radius:8px;"></video></div>`;
        }
        if (review.youtubeUrl) {
          const ytId = extractYouTubeId(review.youtubeUrl);
          if (ytId) mediaHtml += `<div style="margin-top:8px;"><a href="${review.youtubeUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#fee2e2;color:#dc2626;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;text-decoration:none;">▶ Watch Video Review</a></div>`;
        }

        reviewItem.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            ${review.userPhoto ? `<img src="${review.userPhoto}" width="28" height="28" style="border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">` : `<div style="width:28px;height:28px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#64748b;flex-shrink:0;">${(review.userName||'?')[0].toUpperCase()}</div>`}
            <div style="flex:1;min-width:0;">
              <span class="reviewer-name" style="font-weight:600;font-size:14px;">${review.userName || 'Customer'}</span>
              ${isVerified} ${isPending}
            </div>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${date}</div>
          <div class="review-rating" style="color:#f59e0b;font-size:16px;margin-bottom:6px;">${stars}</div>
          <div class="review-text" style="font-size:14px;line-height:1.5;margin-bottom:8px;">${review.text}</div>
          ${mediaHtml}
          ${currentUser && review.userId === currentUser.uid ?
            `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border,#e2e8f0);">
              <button class="review-delete-btn" data-review-id="${review.id}" style="background:none;border:1px solid #fca5a5;color:#ef4444;font-size:12px;cursor:pointer;padding:5px 14px;border-radius:6px;font-weight:500;display:inline-flex;align-items:center;gap:4px;">🗑 Delete my review</button>
            </div>` : ''}
        `;
        const deleteBtn = reviewItem.querySelector('.review-delete-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteReview(review.id));
        reviewsList.appendChild(reviewItem);
      });
    }

    function extractYouTubeId(url) {
      if (!url) return null;
      const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }

    async function deleteReview(reviewId) {
      if (!currentUser) return;
      if (!confirm('Are you sure you want to delete this review?')) return;
      try {
        await window.firebase.remove(window.firebase.ref(window.firebase.database, 'reviews/' + reviewId));
        showToast('Review deleted successfully', 'success');
        if (currentProduct) loadProductReviews(currentProduct.id);
      } catch (error) {
        console.error('Error deleting review:', error);
        showToast('Failed to delete review', 'error');
      }
    }

    async function checkUserCanReview(productId) {
      if (!currentUser) return false;
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'orders'),
            window.firebase.orderByChild('userId'),
            window.firebase.equalTo(currentUser.uid)
          )
        );
        if (!snapshot.exists()) return false;
        const ordersObj = snapshot.val();
        const userOrders = Object.keys(ordersObj).map(key => ordersObj[key]);
        return userOrders.some(order => {
          const pidMatch = order.productId === productId;
          if (!pidMatch) return false;
          const status = (order.status || '').toLowerCase().trim();
          return status === 'delivered' || status === 'deliver' || status.includes('deliver');
        });
      } catch (error) {
        console.error('Error checking user orders:', error);
        return false;
      }
    }

    async function submitProductReview() {
      if (!currentUser) { showLoginModal(); return; }
      if (!currentProduct) { showToast('No product selected', 'error'); return; }

      const canReview = await checkUserCanReview(currentProduct.id);
      if (!canReview) {
        document.getElementById('reviewError').textContent = 'Only customers who received this product can review it.';
        document.getElementById('reviewError').style.display = 'block';
        return;
      }

      try {
        const existingSnap = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'reviews'),
            window.firebase.orderByChild('userId_productId'),
            window.firebase.equalTo(currentUser.uid + '_' + currentProduct.id)
          )
        );
        if (existingSnap.exists()) {
          document.getElementById('reviewError').textContent = 'You have already reviewed this product.';
          document.getElementById('reviewError').style.display = 'block';
          return;
        }
      } catch (e) {}

      const activeStars = document.querySelectorAll('.rating-star.active');
      const rating = activeStars.length;
      const reviewTextValue = document.getElementById('reviewText').value.trim();
      if (rating === 0) { showToast('Please select a rating', 'error'); return; }
      if (!reviewTextValue) { showToast('Please write a review', 'error'); return; }

      let fileUrl = null;
      let fileType = null;
      const fileInput = document.getElementById('reviewFile');
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        if (file.size > 5 * 1024 * 1024) { showToast('File max 5MB', 'error'); return; }
        if (file.type.startsWith('image/')) {
          fileType = 'image';
          try {
            const formData = new FormData();
            const base64 = await new Promise(res => {
              const reader = new FileReader();
              reader.onload = e => res(e.target.result.split(',')[1]);
              reader.readAsDataURL(file);
            });
            const REVIEW_IMGBB_KEY = window._reviewImgbbKey || '';
            if (REVIEW_IMGBB_KEY) {
              formData.append('key', REVIEW_IMGBB_KEY);
              formData.append('image', base64);
              const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
              const data = await res.json();
              if (data.success) fileUrl = data.data.url;
              else fileUrl = 'data:image/jpeg;base64,' + base64;
            } else {
              fileUrl = 'data:image/jpeg;base64,' + base64;
            }
          } catch (e) { fileUrl = URL.createObjectURL(file); }
        } else if (file.type.startsWith('video/')) {
          fileType = 'video';
          fileUrl = URL.createObjectURL(file);
        }
      }

      const youtubeInput = document.getElementById('reviewYoutubeUrl');
      const youtubeUrl = youtubeInput?.value?.trim() || null;

      const submitBtn = document.getElementById('submitReview');
      if (submitBtn) { submitBtn.textContent = 'Submitting...'; submitBtn.disabled = true; }

      try {
        const reviewId = 'review_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
        const reviewData = {
          id: reviewId,
          productId: currentProduct.id,
          userId: currentUser.uid,
          userId_productId: currentUser.uid + '_' + currentProduct.id,
          userName: currentUser.displayName || 'Customer',
          userPhoto: currentUser.photoURL || null,
          rating: rating,
          text: reviewTextValue,
          date: Date.now(),
          isVerifiedPurchase: true,
          status: 'pending',
          fileUrl: fileUrl,
          fileType: fileType,
          youtubeUrl: youtubeUrl
        };
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'reviews/' + reviewId), reviewData);
        showToast('Review submitted! It will be visible after approval. ✅', 'success');
        setRating(0);
        document.getElementById('reviewText').value = '';
        document.getElementById('reviewFile').value = '';
        document.getElementById('filePreview').innerHTML = '';
        document.getElementById('reviewError').style.display = 'none';
        if (youtubeInput) youtubeInput.value = '';
        loadProductReviews(currentProduct.id);
      } catch (error) {
        console.error('Error submitting review:', error);
        showToast('Failed to submit review. Please try again.', 'error');
      } finally {
        if (submitBtn) { submitBtn.textContent = 'Submit Review'; submitBtn.disabled = false; }
      }
    }

    async function showAllRatings() {
      if (!currentProduct) return;
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'reviews'),
            window.firebase.orderByChild('productId'),
            window.firebase.equalTo(currentProduct.id)
          )
        );
        if (!snapshot.exists()) {
          document.getElementById('allRatingsList').innerHTML = '<p style="color:var(--muted);text-align:center">No reviews yet.</p>';
        } else {
          const reviewsObj = snapshot.val();
          const allReviews = Object.keys(reviewsObj).map(key => reviewsObj[key]);
          allReviews.sort((a, b) => b.date - a.date);
          renderReviews(allReviews, 'allRatingsList');
        }
        showPage('allRatingsPage');
      } catch (error) {
        console.error('Error loading all ratings:', error);
        showToast('Failed to load all ratings', 'error');
      }
    }

    function setupViewAllRatings() {
      const viewAllBtn = document.getElementById('viewAllRatingsBtn');
      if (viewAllBtn) viewAllBtn.addEventListener('click', showAllRatings);
    }

    function copyShareLink() {
      const shareLink = document.getElementById('productShareLink');
      shareLink.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard', 'success');
    }

    // ===== REAL-TIME ORDERS LISTENER =====
    let _ordersListenerUnsubscribe = null;
    function setupOrdersRealtimeListener(user) {
      if (!user || !window.firebase || !window.firebase.onValue) return;
      // Clean up previous listener if any
      if (_ordersListenerUnsubscribe) { try { _ordersListenerUnsubscribe(); } catch(e){} }
      try {
        const ordersRef = window.firebase.query(
          window.firebase.ref(window.firebase.database, 'orders'),
          window.firebase.orderByChild('userId'),
          window.firebase.equalTo(user.uid)
        );
        _ordersListenerUnsubscribe = window.firebase.onValue(ordersRef, (snap) => {
          if (!document.getElementById('myOrdersPage')?.classList.contains('active')) return;
          const container = document.getElementById('ordersList');
          const empty = document.getElementById('orders-empty');
          if (!container) return;
          const orders = [];
          if (snap.exists()) {
            snap.forEach(child => orders.push({ id: child.key, ...child.val() }));
          }
          if (!orders.length) {
            container.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
          }
          orders.sort((a, b) => (b.orderDate || 0) - (a.orderDate || 0));
          if (empty) empty.style.display = 'none';
          renderOrders(orders);
        });
      } catch(e) { console.warn('Real-time orders listener error:', e); }
    }

        async function showMyOrders() {
      if (!currentUser) return;
      const ordersList = document.getElementById('ordersList');
      const empty = document.getElementById('orders-empty');
      if (ordersList) ordersList.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);">Loading orders...</div>';
      try {
        const userOrdersSnap = await window.firebase.get(
          window.firebase.ref(window.firebase.database, 'userOrders/' + currentUser.uid)
        );
        let orders = [];
        if (userOrdersSnap.exists()) {
          const orderIds = Object.keys(userOrdersSnap.val());
          const orderPromises = orderIds.map(id =>
            window.firebase.get(window.firebase.ref(window.firebase.database, 'orders/' + id))
          );
          const snapshots = await Promise.all(orderPromises);
          orders = snapshots.filter(s => s.exists()).map(s => ({ id: s.key, ...s.val() }));
        } else {
          const snapshot = await window.firebase.get(
            window.firebase.query(
              window.firebase.ref(window.firebase.database, 'orders'),
              window.firebase.orderByChild('userId'),
              window.firebase.equalTo(currentUser.uid)
            )
          );
          if (snapshot.exists()) {
            const ordersObj = snapshot.val();
            orders = Object.keys(ordersObj).map(key => ({ id: key, ...ordersObj[key] }));
            orders.forEach(o => {
              window.firebase.set(window.firebase.ref(window.firebase.database, 'userOrders/' + currentUser.uid + '/' + o.id), true).catch(()=>{});
            });
          }
        }
        if (!orders.length) {
          if (ordersList) ordersList.innerHTML = '';
          if (empty) empty.style.display = 'block';
          return;
        }
        orders.sort((a, b) => (b.orderDate || 0) - (a.orderDate || 0));
        renderOrders(orders);
        if (empty) empty.style.display = 'none';
        cacheManager.set(CACHE_KEYS.ORDERS, orders);
      } catch (error) {
        console.error('Error loading orders:', error);
        if (ordersList) ordersList.innerHTML = '<div style="text-align:center;padding:32px;color:var(--muted);">Could not load orders. Please try again.</div>';
      }
    }

    // ===== ORDER STATUS CONFIG =====
    const ORDER_STATUS_FLOW = ['placed', 'confirmed', 'shipped', 'delivered'];
    const ORDER_STATUS_LABELS = {
      placed:           '📦 Placed',
      confirmed:        '✅ Confirmed',
      shipped:          '🚚 Shipped',
      delivered:        '✓ Delivered',
      cancelled:        '✗ Cancelled'
    };
    // User can cancel ONLY at these statuses
    const USER_CANCELLABLE = ['placed', 'confirmed'];

    function renderOrders(orders) {
      const container = document.getElementById('ordersList');
      if (!container) return;
      container.innerHTML = '';
      orders.forEach(order => {
        if (!order) return;
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        const rawStatus = (order.status || 'placed').toLowerCase();
        const statusClass = `status-${rawStatus}`;
        const statusLabel = ORDER_STATUS_LABELS[rawStatus] || (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
        const orderDate = new Date(order.orderDate || Date.now());
        const deliveredDate = order.deliveredDate ? new Date(order.deliveredDate) : null;
        let showReturnReplace = false;
        if (rawStatus === 'delivered' && deliveredDate) {
          const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceDelivery <= 3) showReturnReplace = true;
        }
        const liveProduct = products.find(p => p.id === order.productId);
        const imgUrl = (liveProduct ? getProductImage(liveProduct) : null) || order.productImage || 'https://via.placeholder.com/80x80/f3f4f6/64748b?text=No+Image';
        const canCancel = USER_CANCELLABLE.includes(rawStatus);
        const isCancelled = rawStatus === 'cancelled' || rawStatus === 'return-requested' || rawStatus === 'replace-requested';

        // Tracking steps — 5 step flow
        const steps = [
          { key: 'placed',           label: 'Placed',          icon: '📦' },
          { key: 'confirmed',        label: 'Confirmed',        icon: '✅' },
          { key: 'shipped',          label: 'Shipped',          icon: '🚚' },
          { key: 'delivered',        label: 'Delivered',        icon: '✓'  }
        ];
        const currentIdx = ORDER_STATUS_FLOW.indexOf(rawStatus);

        // Cancel info block
        let cancelInfoHtml = '';
        if (isCancelled && (order.cancelledBy || order.cancelReason)) {
          const byMap = { user: 'You', admin: 'Admin', delivery: 'Delivery Partner' };
          const by = byMap[order.cancelledBy] || order.cancelledBy || '';
          cancelInfoHtml = `<div style="margin:8px 0;padding:8px 12px;background:#fef2f2;border-radius:8px;color:#dc2626;font-size:13px;border-left:3px solid #ef4444;">
            ${by ? `<strong>Cancelled by ${by}</strong>` : ''}
            ${order.cancelReason ? ` &bull; ${order.cancelReason}` : order.cancellationReason ? ` &bull; ${order.cancellationReason}` : ''}
          </div>`;
        }

        const trackingHtml = isCancelled ? `
          <div style="margin:10px 0 4px;padding:8px 12px;background:#fef2f2;border-radius:8px;color:#ef4444;font-size:13px;font-weight:600;">
            ✗ Order Cancelled
          </div>
          ${cancelInfoHtml}` : `
          <div class="order-tracking-steps">
            ${steps.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return `<div class="track-step ${done ? 'done' : active ? 'active' : 'pending'}">
                <div class="track-dot">${done ? '✓' : active ? step.icon : ''}</div>
                <div class="track-label">${step.label}</div>
              </div>` + (i < steps.length - 1 ? '<div class="track-line"></div>' : '');
            }).join('')}
          </div>`;

        orderCard.innerHTML = `
          <div class="order-header">
            <div>
              <div class="order-id">${order.orderId || order.id || ''}</div>
              <div class="order-date">${orderDate.toLocaleDateString('en-IN')}</div>
            </div>
            <div class="order-status ${statusClass}">${statusLabel}</div>
          </div>
          <div class="order-details">
            <div class="order-product-image" style="background-image: url('${imgUrl}'); background-size: contain; background-repeat: no-repeat; background-position: center; background-color:#f8fafc;"></div>
            <div class="order-product-info">
              <div class="order-product-title">${order.productName || 'Product'}</div>
              <div class="order-product-price">${formatPrice(order.totalAmount || 0)}</div>
              <div class="order-product-meta">Qty: ${order.quantity || 1} | Size: ${order.size || 'N/A'}</div>
            </div>
          </div>
          ${trackingHtml}
          <div class="order-actions">
            <button class="order-action-btn view-product" onclick="event.stopPropagation();viewProductFromOrder('${order.productId}')">View Product</button>
            ${canCancel ? `<button class="order-action-btn cancel" onclick="event.stopPropagation();cancelOrder('${order.id}')">Cancel Order</button>` : ''}
            ${!canCancel && !isCancelled && rawStatus !== 'delivered' ? `<span style="font-size:12px;color:var(--muted);padding:6px 0;">Cannot cancel — order is ${statusLabel}</span>` : ''}
            ${showReturnReplace ? `<button class="order-action-btn return" onclick="event.stopPropagation();showReturnReplaceModal('${order.id}')">Return / Refund</button>` : ''}
          </div>
        `;
        orderCard.addEventListener('click', (e) => {
          if (e.target.tagName !== 'BUTTON') showOrderDetail(order);
        });
        container.appendChild(orderCard);
      });
    }

    function viewProductFromOrder(productId) {
      if (!productId) { showToast('Product not found', 'error'); return; }
      const product = products.find(p => p.id === productId);
      if (product) {
        showProductDetail(product);
      } else {
        window.firebase.get(window.firebase.ref(window.firebase.database, 'products/' + productId))
          .then(snap => {
            if (snap.exists()) {
              const p = { id: productId, ...snap.val() };
              showProductDetail(p);
            } else {
              showToast('Product no longer available', 'error');
            }
          }).catch(() => showToast('Could not load product', 'error'));
      }
    }

    async function cancelOrder(orderId) {
      // Re-check status from Firebase before allowing cancel
      try {
        const snap = await window.firebase.get(window.firebase.ref(window.firebase.database, 'orders/' + orderId));
        if (snap.exists()) {
          const currentStatus = (snap.val().status || '').toLowerCase();
          if (!USER_CANCELLABLE.includes(currentStatus)) {
            showToast('❌ Cannot cancel — order is already ' + (ORDER_STATUS_LABELS[currentStatus] || currentStatus), 'error');
            return;
          }
        }
      } catch(e) { /* proceed anyway */ }

      document.getElementById('cancellationModal').classList.add('active');
      document.getElementById('confirmCancel').onclick = async function() {
        const checkedReason = document.querySelector('input[name="cancelReason"]:checked');
        const reason = checkedReason ? checkedReason.value : 'Not specified';
        try {
          await window.firebase.update(window.firebase.ref(window.firebase.database, 'orders/' + orderId), {
            status: 'cancelled',
            cancelledBy: 'user',
            cancelReason: reason,
            cancellationReason: reason,
            cancelledDate: Date.now(),
            cancelledAt: Date.now()
          });
          showToast('Order cancelled successfully', 'success');
          document.getElementById('cancellationModal').classList.remove('active');
          showMyOrders();
        } catch (error) {
          console.error('Error cancelling order:', error);
          showToast('Failed to cancel order', 'error');
        }
      };
    }

    function showReturnReplaceModal(orderId) {
      document.getElementById('returnReplaceModal').classList.add('active');
      document.getElementById('confirmReturnReplace').onclick = async function() {
        const option = document.querySelector('input[name="returnReplaceReason"]:checked').value;
        try {
          await window.firebase.update(window.firebase.ref(window.firebase.database, 'orders/' + orderId), {
            status: option === 'return' ? 'return-requested' : 'replace-requested'
          });
          showToast(`${option === 'return' ? 'Return' : 'Replace'} request submitted`, 'success');
          document.getElementById('returnReplaceModal').classList.remove('active');
          showMyOrders();
        } catch (error) {
          console.error('Error submitting request:', error);
          showToast('Failed to submit request', 'error');
        }
      };
    }

    function showOrderDetail(order) {
      const container = document.getElementById('orderDetailContent');
      if (!container) return;
      const rawSt = (order.status || 'placed').toLowerCase();
      const statusClass = `status-${rawSt}`;
      const statusText = ORDER_STATUS_LABELS[rawSt] || (rawSt.charAt(0).toUpperCase() + rawSt.slice(1));
      container.innerHTML = `
        <div class="order-detail-section">
          <div class="order-detail-label">Order ID</div>
          <div class="order-detail-value">${order.orderId}</div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Order Date</div>
          <div class="order-detail-value">${new Date(order.orderDate).toLocaleString()}</div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Status</div>
          <div class="order-detail-value"><span class="order-status ${statusClass}">${statusText}</span></div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Product</div>
          <div class="order-detail-product">
            <div class="order-detail-image" style="background-image: url('${getProductImage(products.find(p => p.id === order.productId))}')"></div>
            <div class="order-detail-product-info">
              <div style="font-weight:600;margin-bottom:8px">${order.productName}</div>
              <div style="color:var(--accent);font-weight:700;margin-bottom:8px">${formatPrice(order.productPrice)}</div>
              <div style="color:var(--muted);font-size:14px">
                Qty: ${order.quantity} | Size: ${order.size}
              </div>
            </div>
          </div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Payment Details</div>
          <div class="order-detail-value">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Subtotal:</span>
              <span>${formatPrice(order.subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Delivery:</span>
              <span>${formatPrice(order.deliveryCharge)}</span>
            </div>
            ${order.gatewayCharge > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Payment Gateway Charge:</span>
              <span>${formatPrice(order.gatewayCharge)}</span>
            </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
              <span>Total Amount:</span>
              <span>${formatPrice(order.totalAmount)}</span>
            </div>
            <div style="margin-top:8px;color:var(--muted);font-size:14px">
              Payment Method: ${order.paymentMethod === 'prepaid' ? 'Prepaid (UPI/Card)' : 'Cash on Delivery'}
            </div>
          </div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Delivery Address</div>
          <div class="order-detail-value">
            <div>${order.userInfo?.fullName || ''}</div>
            <div>${order.userInfo?.house || ''}</div>
            <div>${order.userInfo?.city || ''}, ${order.userInfo?.state || ''} - ${order.userInfo?.pincode || ''}</div>
            <div>Mobile: ${order.userInfo?.mobile || ''}</div>
          </div>
        </div>
      `;
      showPage('orderDetailPage');
    }

    async function addToRecentlyViewed(productId) {
      if (!currentUser) return;
      try {
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'recentlyViewed/' + currentUser.uid + '/' + productId), Date.now());
        loadRecentlyViewed(currentUser);
      } catch (error) {
        console.error('Error adding to recently viewed:', error);
      }
    }

    async function loadRecentlyViewed(user) {
      try {
        const snapshot = await window.firebase.get(window.firebase.ref(window.firebase.database, 'recentlyViewed/' + user.uid));
        const recentlyViewedObj = snapshot.val();
        if (recentlyViewedObj) recentlyViewed = Object.keys(recentlyViewedObj);
        else recentlyViewed = [];
        if (recentlyViewed.length > 0) renderRecentlyViewed();
      } catch (error) {
        console.error('Error loading recently viewed:', error);
      }
    }

    function renderRecentlyViewed() {
      const section = document.getElementById('recentlyViewedSection');
      const slider = document.getElementById('recentlyViewedSlider');
      if (!section || !slider) return;
      const recentlyViewedProducts = products.filter(product => recentlyViewed.includes(product.id)).slice(0, 10);
      if (recentlyViewedProducts.length === 0) {
        section.style.display = 'none';
        return;
      }
      section.style.display = 'block';
      renderProductSlider(recentlyViewedProducts, 'recentlyViewedSlider');
    }

    function filterByCategory(categoryId) {
      if (!categoryId || categoryId === 'all') {
        currentCategoryFilter = null;
        showPage('productsPage');
        document.querySelectorAll('.category-pill').forEach(pill => {
          pill.classList.remove('active');
          if (pill.textContent === 'All') pill.classList.add('active');
        });
        renderProducts(products, 'productGrid');
        updateProductsCount();
        return;
      }
      const category = categories.find(c => c.id === categoryId || c.name === categoryId);
      if (!category) return;
      currentCategoryFilter = category.id;
      let filteredProducts = products.filter(product => product.category === category.id || product.category === category.name);
      const ratingMap = getRatingMap();
      filteredProducts.sort((a, b) => (ratingMap[b.id] || 0) - (ratingMap[a.id] || 0));
      showPage('productsPage');
      document.querySelectorAll('.category-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.textContent === category.name || pill.textContent === categoryId) pill.classList.add('active');
      });
      renderProducts(filteredProducts, 'productGrid');
      updateProductsCount();
    }

    function applyPriceFilter() {
      const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
      const maxPrice = parseFloat(document.getElementById('maxPrice').value) || 10000;
      let filteredProducts = products;
      if (currentCategoryFilter) filteredProducts = filteredProducts.filter(product => product.category === currentCategoryFilter);
      filteredProducts = filteredProducts.filter(product => {
        const price = parsePrice(product.price);
        return price >= minPrice && price <= maxPrice;
      });
      const ratingMap = getRatingMap();
      filteredProducts.sort((a, b) => (ratingMap[b.id] || 0) - (ratingMap[a.id] || 0));
      renderProducts(filteredProducts, 'productGrid');
      updateProductsCount();
    }

    function resetPriceFilter() {
      document.getElementById('minPrice').value = '0';
      document.getElementById('maxPrice').value = '10000';
      const minThumb = document.getElementById('priceMinThumb');
      const maxThumb = document.getElementById('priceMaxThumb');
      const priceSliderRange = document.getElementById('priceSliderRange');
      if (minThumb && maxThumb && priceSliderRange) {
        minThumb.style.left = '0%';
        maxThumb.style.left = '100%';
        priceSliderRange.style.left = '0%';
        priceSliderRange.style.width = '100%';
      }
      showPage('productsPage');
    }

    function resetAllFilters() {
      resetPriceFilter();
      document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
      const allPill = Array.from(document.querySelectorAll('.category-pill')).find(p => p.textContent === 'All');
      if (allPill) allPill.classList.add('active');
      currentCategoryFilter = null;
      renderProducts(products, 'productGrid');
      updateProductsCount();
    }

    function updateProductsCount() {
      const container = document.getElementById('productGrid');
      const noProductsMessage = document.getElementById('noProductsMessage');
      const productsCount = document.getElementById('productsCount');
      if (!container || !noProductsMessage || !productsCount) return;
      const visibleProducts = container.querySelectorAll('.product-card').length;
      if (visibleProducts === 0) {
        noProductsMessage.style.display = 'block';
        productsCount.innerHTML = '';
      } else {
        noProductsMessage.style.display = 'none';
        productsCount.innerHTML = '';
      }
    }

    function renderCategories() {
      const container = document.getElementById('categoriesContainer');
      if (!container) return;
      const fragment = document.createDocumentFragment();
      const allCategory = document.createElement('div');
      allCategory.className = 'category-pill active';
      allCategory.textContent = 'All';
      allCategory.addEventListener('click', () => {
        currentCategoryFilter = null;
        document.querySelectorAll('.category-pill').forEach(pill => pill.classList.remove('active'));
        allCategory.classList.add('active');
        renderProducts(products, 'productGrid');
        updateProductsCount();
      });
      fragment.appendChild(allCategory);
      categories.forEach(category => {
        const categoryPill = document.createElement('div');
        categoryPill.className = 'category-pill';
        categoryPill.textContent = category.name || 'Category';
        categoryPill.addEventListener('click', () => filterByCategory(category.id));
        fragment.appendChild(categoryPill);
      });
      container.innerHTML = '';
      container.appendChild(fragment);
    }

    function renderCategoryCircles() {
      const container = document.getElementById('categoryCirclesContainer');
      if (!container) return;
      const fragment = document.createDocumentFragment();
      categories.forEach(category => {
        const circle = document.createElement('div');
        circle.className = 'category-circle';
        circle.innerHTML = `
          <div class="category-circle-image" style="background-image: url('${getProductImage(category)}')"></div>
          <div class="category-circle-name">${category.name || 'Category'}</div>
        `;
        circle.addEventListener('click', () => filterByCategory(category.id));
        fragment.appendChild(circle);
      });
      container.innerHTML = '';
      container.appendChild(fragment);
    }

    // ── Product score for smart sorting (orders × weight + rating × weight) ──
    function getProductScore(product, preCalculatedRating) {
      // Use pre-calculated rating if provided to avoid O(R) filtering
      const rating = preCalculatedRating !== undefined ? preCalculatedRating : (function() {
        const rs = reviews.filter(r => r.productId === product.id);
        return rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0;
      })();
      const orderCount = (window._productStats && window._productStats[product.id]?.orderCount)
        || product.orderCount || 0;
      return (orderCount * 0.6) + (rating * 0.8);
    }

    function renderProducts(productsToRender, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const ratingMap = getRatingMap();
      const sorted = [...productsToRender].sort((a, b) => getProductScore(b, ratingMap[b.id] ?? 0) - getProductScore(a, ratingMap[a.id] ?? 0));
      container.innerHTML = '';
      if (!sorted || sorted.length === 0) {
        // productGrid and searchResultsGrid have their own HTML empty-state elements
        if (containerId !== 'productGrid' && containerId !== 'searchResultsGrid') {
          container.innerHTML = '<div class="card-panel center" style="padding:40px 16px;"><div style="display:flex;flex-direction:column;align-items:center;gap:12px;"><div style="font-size:52px;">🛍️</div><h3 style="margin:0;font-size:1rem;font-weight:800;">No products yet</h3><p style="color:var(--muted-light);margin:0;font-size:0.85rem;text-align:center;max-width:200px;">Products will appear here once added</p></div></div>';
        }
        return;
      }
      const fragment = document.createDocumentFragment();
      sorted.forEach(product => {
        if (product) fragment.appendChild(createProductCard(product, ratingMap[product.id] ?? 0));
      });
      container.appendChild(fragment);
    }

    function renderBannerCarousel() {
      const track = document.getElementById('bannerTrack');
      const controls = document.getElementById('bannerControls');
      if (!track || !controls) return;

      const preloadImages = banners.map(banner => {
        return new Promise(resolve => {
          const img = new Image();
          img.onload = img.onerror = resolve;
          img.src = getProductImage(banner);
        });
      });

      const trackFragment = document.createDocumentFragment();
      const controlsFragment = document.createDocumentFragment();
      banners.forEach((banner, index) => {
        const slide = document.createElement('div');
        slide.className = 'banner-slide';
        slide.style.backgroundImage = `url('${getProductImage(banner)}')`;
        slide.style.backgroundSize = 'cover';
        slide.style.backgroundPosition = 'center';
        if (banner.link) {
          slide.style.cursor = 'pointer';
          slide.addEventListener('click', () => window.open(banner.link, '_blank'));
        }
        trackFragment.appendChild(slide);
        const dot = document.createElement('div');
        dot.className = `banner-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => setBannerSlide(index));
        controlsFragment.appendChild(dot);
      });
      track.innerHTML = '';
      controls.innerHTML = '';
      track.appendChild(trackFragment);
      controls.appendChild(controlsFragment);
      document.getElementById('bannerCarousel')?.classList.remove('skeleton');
      setupBannerAutoSlide();
      setupBannerTouchEvents();

      Promise.all(preloadImages).catch(() => {});
    }

    function setBannerSlide(index) {
      const track = document.getElementById('bannerTrack');
      const dots = document.querySelectorAll('.banner-dot');
      if (!track || !dots.length) return;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    function setupBannerAutoSlide() {
      if (banners.length <= 1) return;
      let currentBannerIndex = 0;
      if (bannerAutoSlideInterval) clearInterval(bannerAutoSlideInterval);
      bannerAutoSlideInterval = setInterval(() => {
        if (!slidePaused) {
          currentBannerIndex = (currentBannerIndex + 1) % banners.length;
          setBannerSlide(currentBannerIndex);
        }
      }, 3000);
    }

    function setupBannerTouchEvents() {
      const bannerCarousel = document.getElementById('bannerCarousel');
      if (!bannerCarousel) return;
      let bannerTouchStartX = 0;
      let bannerTouchEndX = 0;
      let isBannerDragging = false;
      bannerCarousel.addEventListener('touchstart', (e) => {
        pauseSlide();
        bannerTouchStartX = e.touches[0].clientX;
        isBannerDragging = true;
      }, { passive: true });
      bannerCarousel.addEventListener('touchmove', (e) => {
        if (!isBannerDragging) return;
        bannerTouchEndX = e.touches[0].clientX;
      }, { passive: true });
      bannerCarousel.addEventListener('touchend', (e) => {
        if (!isBannerDragging) return;
        const diff = bannerTouchStartX - bannerTouchEndX;
        const activeIndex = Array.from(document.querySelectorAll('.banner-dot')).findIndex(dot => dot.classList.contains('active'));
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            const nextIndex = (activeIndex + 1) % banners.length;
            setBannerSlide(nextIndex);
          } else {
            const prevIndex = (activeIndex - 1 + banners.length) % banners.length;
            setBannerSlide(prevIndex);
          }
        }
        isBannerDragging = false;
        resumeSlideAfterDelay();
      }, { passive: true });
      bannerCarousel.addEventListener('mousedown', (e) => {
        pauseSlide();
        bannerTouchStartX = e.clientX;
        isBannerDragging = true;
      });
      bannerCarousel.addEventListener('mousemove', (e) => {
        if (!isBannerDragging) return;
        bannerTouchEndX = e.clientX;
      });
      bannerCarousel.addEventListener('mouseup', (e) => {
        if (!isBannerDragging) return;
        const diff = bannerTouchStartX - bannerTouchEndX;
        const activeIndex = Array.from(document.querySelectorAll('.banner-dot')).findIndex(dot => dot.classList.contains('active'));
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            const nextIndex = (activeIndex + 1) % banners.length;
            setBannerSlide(nextIndex);
          } else {
            const prevIndex = (activeIndex - 1 + banners.length) % banners.length;
            setBannerSlide(prevIndex);
          }
        }
        isBannerDragging = false;
        resumeSlideAfterDelay();
      });
      bannerCarousel.addEventListener('mouseleave', () => {
        if (isBannerDragging) {
          isBannerDragging = false;
          resumeSlideAfterDelay();
        }
      });
    }

    function setupPriceSlider(minThumb, maxThumb, track, range, minInput, maxInput) {
      let minPercent = 0;
      let maxPercent = 100;
      const minPrice = 0;
      const maxPrice = 10000;
      function updateSlider() {
        minThumb.style.left = minPercent + '%';
        maxThumb.style.left = maxPercent + '%';
        range.style.left = minPercent + '%';
        range.style.width = (maxPercent - minPercent) + '%';
        const minValue = Math.round(minPrice + (minPercent / 100) * (maxPrice - minPrice));
        const maxValue = Math.round(minPrice + (maxPercent / 100) * (maxPrice - minPrice));
        minInput.value = minValue;
        maxInput.value = maxValue;
      }
      function onThumbMove(thumb, isMin) {
        return function(e) {
          e.preventDefault();
          const trackRect = track.getBoundingClientRect();
          let percent;
          if (e.type === 'touchmove') {
            percent = ((e.touches[0].clientX - trackRect.left) / trackRect.width) * 100;
          } else {
            percent = ((e.clientX - trackRect.left) / trackRect.width) * 100;
          }
          percent = Math.max(0, Math.min(100, percent));
          if (isMin) {
            if (percent < maxPercent - 5) minPercent = percent;
          } else {
            if (percent > minPercent + 5) maxPercent = percent;
          }
          updateSlider();
        };
      }
      function onThumbUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onThumbUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onThumbUp);
      }
      let onMouseMove, onTouchMove;
      function onThumbDown(isMin) {
        return function(e) {
          e.preventDefault();
          if (isMin) {
            onMouseMove = onThumbMove(minThumb, true);
            onTouchMove = onThumbMove(minThumb, true);
          } else {
            onMouseMove = onThumbMove(maxThumb, false);
            onTouchMove = onThumbMove(maxThumb, false);
          }
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onThumbUp);
          document.addEventListener('touchmove', onTouchMove);
          document.addEventListener('touchend', onThumbUp);
        };
      }
      minThumb.addEventListener('mousedown', onThumbDown(true));
      maxThumb.addEventListener('mousedown', onThumbDown(false));
      minThumb.addEventListener('touchstart', onThumbDown(true));
      maxThumb.addEventListener('touchstart', onThumbDown(false));
      minInput.addEventListener('input', function() {
        const value = parseInt(this.value) || 0;
        minPercent = ((value - minPrice) / (maxPrice - minPrice)) * 100;
        if (minPercent >= maxPercent - 5) minPercent = maxPercent - 5;
        updateSlider();
      });
      maxInput.addEventListener('input', function() {
        const value = parseInt(this.value) || maxPrice;
        maxPercent = ((value - minPrice) / (maxPrice - minPrice)) * 100;
        if (maxPercent <= minPercent + 5) maxPercent = minPercent + 5;
        updateSlider();
      });
      updateSlider();
    }

    function setupTrendingAutoSlide() {
      const slider = document.getElementById('productSlider');
      if (!slider) return;
      const slides = slider.querySelectorAll('.slider-item');
      const totalSlides = slides.length;
      if (totalSlides <= 1) return;
      let currentSlide = 0;
      if (trendingAutoSlideInterval) clearInterval(trendingAutoSlideInterval);
      trendingAutoSlideInterval = setInterval(() => {
        if (!slidePaused) {
          currentSlide = (currentSlide + 1) % totalSlides;
          slider.scrollTo({ left: currentSlide * slides[0].offsetWidth, behavior: 'smooth' });
        }
      }, 4000);
    }

    function showLoginModal() {
      document.getElementById('authModal').classList.add('active');
      switchAuthTab('login');
    }

    function switchAuthTab(tab) {
      document.getElementById('loginForm').classList.remove('active');
      document.getElementById('signupForm').classList.remove('active');
      document.getElementById('forgotPasswordForm').classList.remove('active');
      document.getElementById('loginTab').classList.remove('active');
      document.getElementById('signupTab').classList.remove('active');
      document.getElementById('loginError').textContent = '';
      document.getElementById('signupError').textContent = '';
      if (tab === 'login') {
        document.getElementById('loginTab').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
      } else {
        document.getElementById('signupTab').classList.add('active');
        document.getElementById('signupForm').classList.add('active');
      }
    }

    async function handleLogin() {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const loginError = document.getElementById('loginError');
      const loginBtn = document.getElementById('loginBtn');
      loginError.textContent = '';
      if (!email || !password) {
        loginError.textContent = 'Please fill in all fields';
        return;
      }
      try {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<div class="loading-spinner"></div> Logging in...';
        const userCredential = await window.firebase.signInWithEmailAndPassword(window.firebase.auth, email, password);
        sendLoginNotification(email);
        showToast('Login successful!', 'success');
        document.getElementById('authModal').classList.remove('active');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
      } catch (err) {
        console.error('Login error:', err);
        loginError.textContent = err.message;
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
      }
    }

    async function handleSignup() {
      const name = document.getElementById('signupName').value;
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      const signupError = document.getElementById('signupError');
      const signupBtn = document.getElementById('signupBtn');
      signupError.textContent = '';
      if (!name || !email || !password) {
        signupError.textContent = 'Please fill in all fields';
        return;
      }
      if (password.length < 6) {
        signupError.textContent = 'Password should be at least 6 characters';
        return;
      }
      try {
        signupBtn.disabled = true;
        signupBtn.innerHTML = '<div class="loading-spinner"></div> Creating account...';
        const userCredential = await window.firebase.createUserWithEmailAndPassword(window.firebase.auth, email, password);
        const user = userCredential.user;
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'users/' + user.uid), {
          name: name,
          email: email,
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        });
        sendWelcomeEmail(email, name);
        showToast('Account created successfully!', 'success');
        document.getElementById('authModal').classList.remove('active');
        document.getElementById('signupName').value = '';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
      } catch (err) {
        console.error('Signup error:', err);
        signupError.textContent = err.message;
      } finally {
        signupBtn.disabled = false;
        signupBtn.textContent = 'Sign Up';
      }
    }

    async function handleGoogleLogin() {
      try {
        const provider = new window.firebase.GoogleAuthProvider();
        const result = await window.firebase.signInWithPopup(window.firebase.auth, provider);
        const user = result.user;
        const userRef = window.firebase.ref(window.firebase.database, 'users/' + user.uid);
        const snapshot = await window.firebase.get(userRef);
        if (!snapshot.exists()) {
          await window.firebase.set(userRef, {
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
          });
          sendWelcomeEmail(user.email, user.displayName);
        } else {
          await window.firebase.update(userRef, { lastLoginAt: Date.now() });
        }
        sendLoginNotification(user.email);
        showToast('Login successful!', 'success');
        document.getElementById('authModal').classList.remove('active');
      } catch (err) {
        console.error('Google login error:', err);
        const loginError = document.getElementById('loginError');
        const signupError = document.getElementById('signupError');
        if (document.getElementById('loginForm').classList.contains('active')) loginError.textContent = err.message;
        else signupError.textContent = err.message;
      }
    }

    async function handleResetPassword() {
      const email = document.getElementById('forgotPasswordEmail').value;
      const resetPasswordBtn = document.getElementById('resetPasswordBtn');
      if (!email) {
        showToast('Please enter your email address', 'error');
        return;
      }
      try {
        resetPasswordBtn.disabled = true;
        resetPasswordBtn.innerHTML = '<div class="loading-spinner"></div> Sending...';
        await window.firebase.sendPasswordResetEmail(window.firebase.auth, email);
        showToast('Password reset email sent! Check your inbox.', 'success');
        sendPasswordChangeNotif();
        document.getElementById('forgotPasswordEmail').value = '';
        setTimeout(() => document.getElementById('authModal').classList.remove('active'), 2000);
      } catch (err) {
        console.error('Password reset error:', err);
        showToast(err.message, 'error');
      } finally {
        resetPasswordBtn.disabled = false;
        resetPasswordBtn.textContent = 'Send Reset Link';
      }
    }

    function updateUIForUser(user) {
      // Cache for instant restore next load
      try {
        localStorage.setItem('_bz_cached_user', JSON.stringify({
          uid: user.uid,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          email: user.email || ''
        }));
      } catch(e) {}
      setNotifKeysForUser(user.uid);
      appNotifications = [];
      loadNotifs();
      updateNotifBadge();
      document.getElementById('userProfile').style.display = 'flex';
      document.getElementById('openLoginTop').style.display = 'none';
      document.getElementById('mobileLoginBtn').style.display = 'none';
      document.getElementById('mobileUserProfile').style.display = 'flex';
      document.getElementById('mobileLogoutBtn').style.display = 'flex';
      document.getElementById('headerSearchContainer').style.display = 'block';
      updateUserProfile(user);
    }

    function updateUIForGuest() {
      setNotifKeysForUser(null);
      appNotifications = [];
      updateNotifBadge();
      document.getElementById('userProfile').style.display = 'none';
      document.getElementById('openLoginTop').style.display = 'block';
      document.getElementById('mobileLoginBtn').style.display = 'flex';
      document.getElementById('mobileUserProfile').style.display = 'none';
      document.getElementById('mobileLogoutBtn').style.display = 'none';
      document.getElementById('headerSearchContainer').style.display = 'block';
      document.getElementById('openLoginTop').textContent = 'Login / Sign Up';
    }

    function updateUserProfile(user) {
      const userAvatarImg = document.getElementById('userAvatarImg');
      const userAvatarInitial = document.getElementById('userAvatarInitial');
      const headerUserNameShort = document.getElementById('headerUserNameShort');
      if (user.photoURL) {
        userAvatarImg.src = user.photoURL;
        userAvatarImg.style.display = 'block';
        userAvatarInitial.style.display = 'none';
      } else {
        userAvatarImg.style.display = 'none';
        userAvatarInitial.style.display = 'block';
        userAvatarInitial.textContent = (user.displayName || 'U').charAt(0).toUpperCase();
      }
      const name = user.displayName || 'User';
      if (headerUserNameShort) {
        const shortName = name.split(' ')[0];
        headerUserNameShort.textContent = shortName.length > 10 ? shortName.substring(0, 10) + '...' : shortName;
      }
    }

    function showLogoutConfirmation() {
      document.getElementById('alertTitle').textContent = 'Logout Confirmation';
      document.getElementById('alertMessage').textContent = 'Are you sure you want to logout?';
      document.getElementById('alertModal').classList.add('active');
    }

    function confirmLogout() {
      try { const _m=JSON.parse(localStorage.getItem(NOTIF_META_KEY)||'{}'); _m.loggedOut=true; localStorage.setItem(NOTIF_META_KEY,JSON.stringify(_m)); } catch(e){}
      try { localStorage.removeItem('_bz_cached_user'); } catch(e) {}
      window.firebase.signOut(window.firebase.auth).then(() => {
        showToast('Logged out successfully', 'success');
        document.getElementById('alertModal').classList.remove('active');
        showPage('homePage');
      }).catch(error => {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
      });
    }

    async function loadSavedAddresses() {
      if (!currentUser) return;
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'addresses'),
            window.firebase.orderByChild('userId'),
            window.firebase.equalTo(currentUser.uid)
          )
        );
        const addressesList = document.getElementById('savedAddressesList');
        const savedAddressesSection = document.getElementById('savedAddressesSection');
        if (!snapshot.exists()) {
          savedAddressesSection.style.display = 'none';
          savedAddresses = [];
          return;
        }
        const addressesObj = snapshot.val();
        const addresses = Object.keys(addressesObj).map(key => ({ id: key, ...addressesObj[key] }));
        savedAddresses = addresses.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || b.createdAt - a.createdAt);
        if (addresses.length > 0) {
          savedAddressesSection.style.display = 'block';
          renderSavedAddresses();
          const defaultAddr = savedAddresses[0];
          if (defaultAddr) {
            fillAddressForm(defaultAddr);
            userInfo = { fullName: defaultAddr.name, mobile: defaultAddr.mobile, pincode: defaultAddr.pincode, city: defaultAddr.city, state: defaultAddr.state, house: defaultAddr.street };
            const radios = document.querySelectorAll('input[name="savedAddress"]');
            radios.forEach(r => { if (r.value === defaultAddr.id) r.checked = true; });
          }
        } else savedAddressesSection.style.display = 'none';
        cacheManager.set(CACHE_KEYS.ADDRESSES, savedAddresses);
      } catch (error) {
        console.error('Error loading addresses:', error);
      }
    }

    function renderSavedAddresses() {
      const addressesList = document.getElementById('savedAddressesList');
      if (!addressesList) return;
      addressesList.innerHTML = '';
      savedAddresses.forEach(address => {
        const addressCard = document.createElement('div');
        addressCard.className = 'saved-address-card';
        const addressType = address.type || 'Other';
        const isDefault = address.isDefault ? '• Default' : '';
        addressCard.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="radio" name="savedAddress" value="${address.id}" ${address.isDefault ? 'checked' : ''}>
            <div style="flex:1">
              <div style="font-weight:600">${address.name}</div>
              <div>${address.street}</div>
              <div>${address.city}, ${address.state} - ${address.pincode}</div>
              <div>Mobile: ${address.mobile}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:4px;">${addressType} ${isDefault}</div>
            </div>
          </div>
          <div class="address-actions">
            <button class="btn secondary edit-address" data-id="${address.id}">Edit</button>
            <button class="btn error delete-address" data-id="${address.id}">Delete</button>
          </div>
        `;
        const radio = addressCard.querySelector('input[type="radio"]');
        radio.addEventListener('click', function(e) {
          e.stopPropagation();
          fillAddressForm(address);
          userInfo = { fullName: address.name, mobile: address.mobile, pincode: address.pincode, city: address.city, state: address.state, house: address.street };
        });
        addressCard.addEventListener('click', function(e) {
          if (e.target.type !== 'radio') {
            radio.checked = true;
            fillAddressForm(address);
            userInfo = { fullName: address.name, mobile: address.mobile, pincode: address.pincode, city: address.city, state: address.state, house: address.street };
          }
        });
        const editBtn = addressCard.querySelector('.edit-address');
        editBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          editAddress(address);
        });
        const deleteBtn = addressCard.querySelector('.delete-address');
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteAddressConfirmation(address);
        });
        addressesList.appendChild(addressCard);
      });
    }

    function fillAddressForm(address) {
      document.getElementById('fullname').value = address.name;
      document.getElementById('mobile').value = address.mobile;
      document.getElementById('pincode').value = address.pincode;
      document.getElementById('city').value = address.city;
      document.getElementById('state').value = address.state;
      document.getElementById('house').value = address.street;
      document.getElementById('addressType').value = address.type || 'home';
    }

    async function saveUserInfoAndAddress() {
      const fullname = document.getElementById('fullname').value;
      const mobile = document.getElementById('mobile').value;
      const pincode = document.getElementById('pincode').value;
      const city = document.getElementById('city').value;
      const state = document.getElementById('state').value;
      const house = document.getElementById('house').value;
      const addressType = document.getElementById('addressType').value;
      if (!fullname || !mobile || !pincode || !city || !state || !house) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      userInfo = { fullName: fullname, mobile, pincode, city, state, house };
      const addressData = {
        name: fullname,
        mobile: mobile,
        pincode: pincode,
        city: city,
        state: state,
        street: house,
        type: addressType,
        userId: currentUser.uid,
        isDefault: savedAddresses.length === 0,
        createdAt: Date.now()
      };
      try {
        const addressId = 'address_' + Date.now();
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'addresses/' + addressId), addressData);
        savedAddresses.push({ id: addressId, ...addressData });
        cacheManager.set(CACHE_KEYS.ADDRESSES, savedAddresses);
        showToast('Address saved successfully', 'success');
        await loadSavedAddresses();
        document.getElementById('savedAddressesSection').style.display = 'block';
        document.getElementById('newAddressForm').style.display = 'block';
      } catch (error) {
        console.error('Error saving address:', error);
        showToast('Failed to save address', 'error');
      }
    }

    function showNewAddressForm() {
      document.getElementById('savedAddressesSection').style.display = 'block';
      document.getElementById('newAddressForm').style.display = 'block';
      document.getElementById('fullname').value = '';
      document.getElementById('mobile').value = '';
      document.getElementById('pincode').value = '';
      document.getElementById('city').value = '';
      document.getElementById('state').value = '';
      document.getElementById('house').value = '';
      document.getElementById('addressType').value = 'home';
      const saveBtn = document.getElementById('saveUserInfo');
      saveBtn.textContent = 'Save This Address';
      saveBtn.onclick = saveUserInfoAndAddress;
    }

    function editAddress(address) {
      fillAddressForm(address);
      document.getElementById('savedAddressesSection').style.display = 'none';
      document.getElementById('newAddressForm').style.display = 'block';
      const saveBtn = document.getElementById('saveUserInfo');
      saveBtn.textContent = 'Update Address';
      saveBtn.onclick = async function() {
        const fullname = document.getElementById('fullname').value;
        const mobile = document.getElementById('mobile').value;
        const pincode = document.getElementById('pincode').value;
        const city = document.getElementById('city').value;
        const state = document.getElementById('state').value;
        const house = document.getElementById('house').value;
        const addressType = document.getElementById('addressType').value;
        const addressData = {
          name: fullname,
          mobile: mobile,
          pincode: pincode,
          city: city,
          state: state,
          street: house,
          type: addressType,
          userId: currentUser.uid,
          isDefault: address.isDefault
        };
        try {
          await window.firebase.update(window.firebase.ref(window.firebase.database, 'addresses/' + address.id), addressData);
          showToast('Address updated successfully', 'success');
          document.getElementById('savedAddressesSection').style.display = 'block';
          document.getElementById('newAddressForm').style.display = 'block';
          await loadSavedAddresses();
        } catch (error) {
          console.error('Error updating address:', error);
          showToast('Failed to update address', 'error');
        }
      };
    }

    function deleteAddressConfirmation(address) {
      document.getElementById('alertTitle').textContent = 'Delete Address';
      document.getElementById('alertMessage').textContent = `Are you sure you want to delete address for ${address.name}?`;
      document.getElementById('alertModal').classList.add('active');
      document.getElementById('alertConfirmBtn').onclick = async function() {
        document.getElementById('alertModal').classList.remove('active');
        if (!currentUser) { showToast('Please log in again', 'error'); return; }
        try {
          await window.firebase.remove(window.firebase.ref(window.firebase.database, 'addresses/' + address.id));
          showToast('Address deleted', 'success');
          await loadSavedAddresses();
          const _sas = document.getElementById('savedAddressesSection');
          const _naf = document.getElementById('newAddressForm');
          if (_sas) _sas.style.display = savedAddresses.length ? 'block' : 'none';
          if (_naf) _naf.style.display = 'block';
        } catch (error) {
          console.error('Error deleting address:', error);
          // Never sign out on address delete error
          showToast('Could not delete address. Please try again.', 'error');
        }
      };
      document.getElementById('alertCancelBtn').onclick = function() {
        document.getElementById('alertModal').classList.remove('active');
      };
    }

    (function setupLazyImages() {
      if (!('IntersectionObserver' in window)) return;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const src = el.dataset.lazySrc;
          if (src) {
            el.style.backgroundImage = `url('${src}')`;
            el.classList.add('loaded');
            el.removeAttribute('data-lazy-src');
          }
          observer.unobserve(el);
        });
      }, { rootMargin: '200px' });
      window._lazyObserver = observer;
    })();

    function lazySetBg(el, url) {
      if (!el || !url) return;
      if (window._lazyObserver) {
        el.dataset.lazySrc = url;
        window._lazyObserver.observe(el);
      } else {
        el.style.backgroundImage = `url('${url}')`;
      }
    }

    let NOTIF_KEY = 'bz_notifications_guest';
    let NOTIF_META_KEY = 'bz_notif_meta_guest';

    function setNotifKeysForUser(uid) {
      NOTIF_KEY = uid ? 'bz_notifications_' + uid : 'bz_notifications_guest';
      NOTIF_META_KEY = uid ? 'bz_notif_meta_' + uid : 'bz_notif_meta_guest';
    }

    function saveNotifs() {
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(appNotifications)); } catch(e) {}
    }

    function loadNotifs() {
      try {
        const s = localStorage.getItem(NOTIF_KEY);
        if (s) {
          const p = JSON.parse(s);
          const cleaned = p.filter(n =>
            n.id > 100 ||
            (n.id >= 1000) ||
            (typeof n.id === 'number' && n.id > 5)
          );
          if (Array.isArray(cleaned)) appNotifications = cleaned;
          localStorage.setItem(NOTIF_KEY, JSON.stringify(appNotifications));
        }
      } catch(e) {}
    }

    function addNotif(notif) {
      const n = { id: Date.now() + Math.floor(Math.random()*999), read: false,
        timestamp: Date.now(), badge: notif.badge||'Info',
        type: notif.type||'system', title: notif.title, message: notif.message };
      appNotifications.unshift(n);
      saveNotifs();
      updateNotifBadge();
      showNotifPopup(n);
    }

    function showNotifPopup(n) {
      const icons = {order:'🛍️', offer:'🎁', system:'🔔', warning:'⚠️'};
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%) translateY(-18px);background:var(--surface,#fff);border:1.5px solid var(--border,#e2e8f0);border-left:4px solid var(--accent,#2563eb);border-radius:12px;padding:12px 18px;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.15);max-width:340px;width:90%;display:flex;gap:12px;align-items:center;opacity:0;transition:all 0.35s ease;pointer-events:none;';
      el.innerHTML = '<span style="font-size:22px;flex-shrink:0;">'+(icons[n.type]||'🔔')+'</span><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;color:var(--text,#0f172a);">'+n.title+'</div><div style="font-size:12px;color:var(--muted,#64748b);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+n.message+'</div></div>';
      document.body.appendChild(el);
      requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)'; });
      setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(-50%) translateY(-12px)'; setTimeout(()=>el.remove(),400); }, 3500);
    }

    function sendLoginNotification(email) {
      const meta = JSON.parse(localStorage.getItem(NOTIF_META_KEY)||'{}');
      if (meta.loggedOut) {
        meta.loggedOut = false;
        localStorage.setItem(NOTIF_META_KEY, JSON.stringify(meta));
        addNotif({type:'system', title:'Welcome Back! 👋', message:'Great to see you again. New deals are waiting!', badge:'Welcome Back'});
      } else {
        addNotif({type:'system', title:'Login Successful ✅', message:'You are now logged in. Happy shopping!', badge:'Login'});
      }
      meta.hasLoggedIn = true;
      localStorage.setItem(NOTIF_META_KEY, JSON.stringify(meta));
      const cfg = window.BZ_CONFIG?.emailjs;
      bzSendEmail(cfg?.loginTemplateId, {
        to_email: email,
        store_name: window.BZ_CONFIG?.store?.name || 'Buyzo Cart',
        login_time: new Date().toLocaleString('en-IN'),
        device: navigator.userAgent.slice(0,60)
      });
    }

    function sendWelcomeEmail(email, name) {
      addNotif({type:'system', title:'Welcome to Buyzo Cart! 🎉', message:'Hi '+(name||'there')+'! Account created. Enjoy shopping!', badge:'Welcome'});
      const cfg = window.BZ_CONFIG?.emailjs;
      bzSendEmail(cfg?.loginTemplateId, {
        to_email: email,
        to_name: name || 'Customer',
        store_name: window.BZ_CONFIG?.store?.name || 'Buyzo Cart',
        message: 'Welcome to ' + (window.BZ_CONFIG?.store?.name||'Buyzo Cart') + '! Aapka account successfully create ho gaya hai.'
      });
    }

    function sendOrderNotification(email, orderId, productName, total) {
      addNotif({type:'order', title:'Order Placed! 🛍️', message:(productName||'')+(orderId?' — Order '+orderId:'')+(total?' | ₹'+total:''), badge:'Order Confirmed'});
      const cfg = window.BZ_CONFIG?.emailjs;
      bzSendEmail(cfg?.orderTemplateId, {
        to_email: email,
        order_id: orderId,
        product_name: productName || 'Product',
        total_amount: '₹' + total,
        store_name: window.BZ_CONFIG?.store?.name || 'Buyzo Cart',
        order_date: new Date().toLocaleDateString('en-IN'),
        store_email: window.BZ_CONFIG?.store?.email || ''
      });
    }

    function sendPasswordChangeNotif() {
      addNotif({type:'system', title:'Password Changed 🔐', message:'Your password was changed. Contact support if this was not you.', badge:'Security'});
    }

    function loadAdminOfferNotifs() {
      if (!window.firebase || !window.firebase.database) return;
      const sessionKey = 'bz_offer_notifs_loaded_' + (currentUser ? currentUser.uid : '');
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
      window.firebase.get(window.firebase.ref(window.firebase.database,'offers')).then(snap=>{
        if (!snap.exists()) return;
        const meta = JSON.parse(localStorage.getItem(NOTIF_META_KEY)||'{}');
        const seen = meta.seenOffers||[];
        Object.entries(snap.val()).forEach(([k,o])=>{
          if (seen.includes(k)) return;
          addNotif({type:'offer', title:(o.title||'Special Offer')+' 🎁', message:o.description||o.message||'Check this offer!', badge:'Offer'});
          seen.push(k);
        });
        meta.seenOffers=seen;
        localStorage.setItem(NOTIF_META_KEY, JSON.stringify(meta));
      }).catch(()=>{});
    }

    function setupHeroMessages() {
      const messages = document.querySelectorAll('#heroMessages span');
      let currentIndex = 0;
      setInterval(() => {
        messages.forEach(msg => msg.classList.remove('active'));
        currentIndex = (currentIndex + 1) % messages.length;
        messages[currentIndex].classList.add('active');
      }, 3000);
    }

    function updateHeroContent() {
      const heroHeading = document.getElementById('heroHeading');
      const heroSubheading = document.getElementById('heroSubheading');
      const heroMessagesContainer = document.getElementById('heroMessages');
      const highlightStrip = document.querySelector('.highlight-strip');

      if (heroHeading) heroHeading.innerHTML = adminSettings.heroHeading || 'Welcome to <span style="color:var(--accent)">Buyzo Cart</span>';
      if (heroSubheading) heroSubheading.textContent = adminSettings.heroSubheading || 'Clean, fast checkout. Hand‑picked products. Fully responsive UI.';

      if (heroMessagesContainer && adminSettings.heroMessages && adminSettings.heroMessages.length) {
        heroMessagesContainer.innerHTML = '';
        adminSettings.heroMessages.forEach((msg, index) => {
          const span = document.createElement('span');
          span.textContent = msg;
          if (index === 0) span.classList.add('active');
          heroMessagesContainer.appendChild(span);
        });
      }

      if (highlightStrip) {
        if (adminSettings.highlightText) {
          highlightStrip.innerHTML = adminSettings.highlightText + ' <u>Shop Now →</u>';
          highlightStrip.style.display = '';
        } else {
          highlightStrip.style.display = 'none';
        }
      }

      if (adminSettings.popularSearches && Array.isArray(adminSettings.popularSearches) && adminSettings.popularSearches.length) {
        popularSearches = adminSettings.popularSearches;
        loadPopularSearches();
      }
      if (adminSettings.searchTags && Array.isArray(adminSettings.searchTags) && adminSettings.searchTags.length) {
        searchTags = adminSettings.searchTags;
        loadSearchTags();
      }

      updateHeroStats();
    }

    function updateHeroStats() {
      if (adminSettings.heroStats) {
        const s = adminSettings.heroStats;
        setHeroStat('heroStatProducts', s.products || null);
        setHeroStat('heroStatCustomers', s.customers || null);
        setHeroStat('heroStatRating', s.rating ? s.rating + '★' : null);
        return;
      }
      const db = window.firebase?.database;
      const ref = window.firebase?.ref;
      const get = window.firebase?.get;
      if (!db || !ref || !get) return;

      get(ref(db, 'products')).then(snap => {
        const count = snap.exists() ? Object.keys(snap.val()).length : 0;
        setHeroStat('heroStatProducts', count > 0 ? (count >= 1000 ? Math.floor(count/1000) + 'K+' : count + '+') : null);
      }).catch(()=>{});

      get(ref(db, 'users')).then(snap => {
        const count = snap.exists() ? Object.keys(snap.val()).length : 0;
        setHeroStat('heroStatCustomers', count > 0 ? (count >= 1000 ? Math.floor(count/1000) + 'K+' : count + '+') : null);
      }).catch(()=>{});

      get(ref(db, 'reviews')).then(snap => {
        if (!snap.exists()) { setHeroStat('heroStatRating', null); return; }
        const vals = Object.values(snap.val());
        const avg = vals.reduce((s, r) => s + (r.rating || 0), 0) / vals.length;
        setHeroStat('heroStatRating', avg > 0 ? avg.toFixed(1) + '★' : null);
      }).catch(()=>{});
    }

    function setHeroStat(id, value) {
      const el = document.getElementById(id);
      const row = document.getElementById('heroStatsRow');
      if (!el) return;
      if (value) {
        el.textContent = value;
        if (row) row.style.display = '';
      } else {
        el.textContent = '—';
      }
    }

    function updateCurrencySymbols() {
      const symbol = getCurrencySymbol();
      document.querySelectorAll('[id^="currencySymbol"]').forEach(el => {
        if (el.id !== 'currencySymbolPriceFilter' && el.id !== 'currencySymbolPriceFilter2' && 
            el.id !== 'currencySymbolSearch1' && el.id !== 'currencySymbolSearch2') return;
        el.textContent = symbol;
      });
    }

    async function loadUserData(user) {
      try {
        const snapshot = await window.firebase.get(window.firebase.ref(window.firebase.database, 'users/' + user.uid));
        if (snapshot.exists()) {
          const userData = snapshot.val();
          userInfo = { ...userInfo, ...userData };
          if (userData.name) {
            const headerName = document.getElementById('headerUserNameShort');
            if (headerName) {
              const short = userData.name.split(' ')[0];
              headerName.textContent = short.length > 10 ? short.slice(0, 10) + '...' : short;
            }
            const avatarInit = document.getElementById('userAvatarInitial');
            if (avatarInit) avatarInit.textContent = userData.name.charAt(0).toUpperCase();
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }

    function updateAdminSettingsUI() {
      const delEl = document.getElementById('deliveryCharge');
      const gwEl = document.getElementById('gatewayChargePercent');
      if (delEl) delEl.textContent = adminSettings.deliveryCharge || 50;
      if (gwEl) gwEl.textContent = `${adminSettings.gatewayChargePercent || 2}%`;
      updateCurrencySymbols();
      updateHeroContent();

      const emailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`;
      const phoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;

      if (adminSettings.storeEmail) {
        const el = document.getElementById('footerEmailPrimary');
        if (el) el.innerHTML = `${emailSvg} <a href="mailto:${adminSettings.storeEmail}">${adminSettings.storeEmail}</a>`;
      }
      if (adminSettings.storeEmail2) {
        const el = document.getElementById('footerEmailSecondary');
        if (el) el.innerHTML = `${emailSvg} <a href="mailto:${adminSettings.storeEmail2}">${adminSettings.storeEmail2}</a>`;
      }
      if (adminSettings.storePhone) {
        const phone = adminSettings.storePhone.replace(/\D/g, '');
        const el = document.getElementById('footerPhoneLink');
        if (el) el.innerHTML = `${phoneSvg} <a href="https://wa.me/91${phone}?text=Hello%20Buyzo%20Cart%2C%20I%20need%20help!" target="_blank">${adminSettings.storePhone} (WhatsApp)</a>`;
      }
    }

    function fetchLiveData() {
      if (!window.firebase || !window.firebase.database) {
        console.error('Firebase not initialized');
        return;
      }
      const database = window.firebase.database;
      const ref = window.firebase.ref;
      const get = window.firebase.get;
      get(ref(database, 'products')).then(snapshot => {
        const productsObj = snapshot.val();
        if (productsObj) {
          const newProducts = Object.keys(productsObj).map(key => {
            const product = productsObj[key];
            return {
              id: key,
              ...product,
              images: product.images ? 
                (Array.isArray(product.images) ? product.images : [product.images]) : 
                (product.image ? [product.image] : 
                 (product.img ? [product.img] : 
                  (product.imageUrl ? [product.imageUrl] : [])))
            };
          });
          products = newProducts;
          window.products = products;
          cacheManager.set(CACHE_KEYS.PRODUCTS, products);
          const currentPage = document.querySelector('.page.active')?.id;
          if (currentPage === 'homePage') {
            renderProducts(products, 'homeProductGrid');
            let trendingProducts = products.filter(p => p.isTrending || p.trending);
            if (!trendingProducts.length) {
              trendingProducts = [...products].sort((a,b) => getProductScore(b) - getProductScore(a)).slice(0, 8);
            }
            if (trendingProducts.length > 0) renderProductSlider(trendingProducts, 'productSlider');
            else renderProductSlider(products.slice(0, 10), 'productSlider');
          } else if (currentPage === 'productsPage') {
            renderProducts(products, 'productGrid');
            updateProductsCount();
          } else if (currentPage === 'searchResultsPage' && window.currentSearchQuery) {
            const filteredResults = searchProducts(window.currentSearchQuery);
            window.currentSearchResults = filteredResults;
            renderSearchResults(filteredResults, window.currentSearchQuery);
          }
        } else {
          products = [];
          renderProducts([], 'homeProductGrid');
          renderProducts([], 'productGrid');
        }
      }).catch(error => {
        console.error('Error fetching products:', error);
        products = [];
        renderProducts([], 'homeProductGrid');
        renderProducts([], 'productGrid');
      });
      // Load product order stats for scoring/trending
      get(ref(database, 'productStats')).then(snap => {
        if (snap.exists()) window._productStats = snap.val();
      }).catch(() => {});

      get(ref(database, 'categories')).then(snapshot => {
        const categoriesObj = snapshot.val();
        if (categoriesObj) {
          const newCategories = Object.keys(categoriesObj).map(key => ({ id: key, ...categoriesObj[key] }));
          categories = newCategories;
          cacheManager.set(CACHE_KEYS.CATEGORIES, categories);
          if (document.getElementById('homePage')?.classList.contains('active') || document.getElementById('productsPage')?.classList.contains('active')) {
            renderCategories();
            renderCategoryCircles();
          }
        } else categories = [];
      }).catch(error => {
        console.error('Error fetching categories:', error);
        categories = [];
      });
      get(ref(database, 'banners')).then(snapshot => {
        const bannersObj = snapshot.val();
        if (bannersObj) {
          const newBanners = Object.keys(bannersObj).map(key => ({ id: key, ...bannersObj[key] }));
          banners = newBanners;
          cacheManager.set(CACHE_KEYS.BANNERS, banners);
          if (document.getElementById('homePage')?.classList.contains('active')) renderBannerCarousel();
        } else banners = [];
      }).catch(error => {
        console.error('Error fetching banners:', error);
        banners = [];
      });
      get(ref(database, 'adminSettings')).then(snapshot => {
        const settingsObj = snapshot.val();
        if (settingsObj) {
          adminSettings = { ...adminSettings, ...settingsObj };
          cacheManager.set(CACHE_KEYS.SETTINGS, adminSettings);
          updateAdminSettingsUI();
        }
      }).catch(error => {
        console.error('Error fetching admin settings:', error);
      });
      get(ref(database, 'outOfStock')).then(snapshot => {
        const outOfStockObj = snapshot.val();
        if (outOfStockObj) window.outOfStockItems = outOfStockObj;
      }).catch(error => {
        console.error('Error fetching out of stock items:', error);
      });
    }

    function loadCachedData() {
      const cachedProducts = cacheManager.get(CACHE_KEYS.PRODUCTS);
      if (cachedProducts && cachedProducts.length > 0) {
        products = cachedProducts;
        window.products = products;
        renderProducts(products, 'homeProductGrid');
        renderProducts(products, 'productGrid');
        const trending = products.filter(p => p.isTrending || p.trending).slice(0, 10);
        renderProductSlider(trending.length > 0 ? trending : products.slice(0, 10), 'productSlider');
        updateProductsCount();
      }
      const cachedCategories = cacheManager.get(CACHE_KEYS.CATEGORIES);
      if (cachedCategories && cachedCategories.length > 0) {
        categories = cachedCategories;
        renderCategories();
        renderCategoryCircles();
      }
      const cachedBanners = cacheManager.get(CACHE_KEYS.BANNERS);
      if (cachedBanners && cachedBanners.length > 0) {
        banners = cachedBanners;
        renderBannerCarousel();
      }
      const cachedSettings = cacheManager.get(CACHE_KEYS.SETTINGS);
      if (cachedSettings) {
        adminSettings = { ...adminSettings, ...cachedSettings };
        updateAdminSettingsUI();
      }
    }

    function setupRealtimeListeners() {
      if (!window.firebase || !window.firebase.database) return;
      const database = window.firebase.database;
      const ref = window.firebase.ref;
      const onValue = window.firebase.onValue;
      onValue(ref(database, 'products'), snapshot => {
        const productsObj = snapshot.val();
        if (productsObj) {
          const newProducts = Object.keys(productsObj).map(key => {
            const product = productsObj[key];
            return {
              id: key,
              ...product,
              images: product.images ? 
                (Array.isArray(product.images) ? product.images : [product.images]) : 
                (product.image ? [product.image] : 
                 (product.img ? [product.img] : 
                  (product.imageUrl ? [product.imageUrl] : [])))
            };
          });
          products = newProducts;
          window.products = products;
          cacheManager.set(CACHE_KEYS.PRODUCTS, products);
          const currentPage = document.querySelector('.page.active')?.id;
          if (currentPage === 'homePage' || currentPage === 'productsPage' || currentPage === 'productDetailPage' || currentPage === 'searchResultsPage') {
            if (currentPage === 'homePage') {
              renderProducts(products, 'homeProductGrid');
              const trendingProducts = products.filter(p => p.isTrending);
              if (trendingProducts.length > 0) renderProductSlider(trendingProducts, 'productSlider');
              else renderProductSlider(products.slice(0, 10), 'productSlider');
            } else if (currentPage === 'productsPage') {
              renderProducts(products, 'productGrid');
              updateProductsCount();
            }
            if (document.getElementById('searchResultsPage')?.classList.contains('active') && window.currentSearchQuery) {
              const filteredResults = searchProducts(window.currentSearchQuery);
              window.currentSearchResults = filteredResults;
              renderSearchResults(filteredResults, window.currentSearchQuery);
            }
          }
        } else products = [];
      });
      onValue(ref(database, 'categories'), snapshot => {
        const categoriesObj = snapshot.val();
        if (categoriesObj) {
          const newCategories = Object.keys(categoriesObj).map(key => ({ id: key, ...categoriesObj[key] }));
          categories = newCategories;
          cacheManager.set(CACHE_KEYS.CATEGORIES, categories);
          if (document.getElementById('homePage')?.classList.contains('active') || document.getElementById('productsPage')?.classList.contains('active')) {
            renderCategories();
            renderCategoryCircles();
          }
        } else categories = [];
      });
      onValue(ref(database, 'banners'), snapshot => {
        const bannersObj = snapshot.val();
        if (bannersObj) {
          const newBanners = Object.keys(bannersObj).map(key => ({ id: key, ...bannersObj[key] }));
          banners = newBanners;
          cacheManager.set(CACHE_KEYS.BANNERS, banners);
          if (document.getElementById('homePage')?.classList.contains('active')) renderBannerCarousel();
        } else banners = [];
      });
      // Load brands for blue tick display on cards
      onValue(ref(database, 'brands'), snapshot => {
        window._brandsData = {};
        if (snapshot.exists()) {
          snapshot.forEach(child => {
            window._brandsData[child.key] = child.val();
          });
        }
      });

      onValue(ref(database, 'adminSettings'), snapshot => {
        const settingsObj = snapshot.val();
        if (settingsObj) {
          adminSettings = { ...adminSettings, ...settingsObj };
          cacheManager.set(CACHE_KEYS.SETTINGS, adminSettings);
          updateAdminSettingsUI();
        }
      });
      onValue(ref(database, 'outOfStock'), snapshot => {
        const outOfStockObj = snapshot.val();
        if (outOfStockObj) window.outOfStockItems = outOfStockObj;
      });

      let _lastAdminNotifTs = 0;
      let _adminNotifLoaded = false;
      onValue(ref(database, 'adminNotifications'), snapshot => {
        if (!snapshot.exists()) return;
        const now = Date.now();
        const cutoff = now - (7 * 24 * 60 * 60 * 1000); // 7 days
        snapshot.forEach(child => {
          const n = child.val();
          if (!n || !n.timestamp) return;
          if (!_adminNotifLoaded) {
            // First load: show all from last 7 days
            if (n.timestamp > cutoff) {
              addNotif({ type: n.type || 'system', title: n.title, message: n.message, badge: n.badge || 'Info', timestamp: n.timestamp });
            }
          } else if (n.timestamp > _lastAdminNotifTs) {
            addNotif({ type: n.type || 'system', title: n.title, message: n.message, badge: n.badge || 'Info', timestamp: n.timestamp });
          }
          if (n.timestamp > _lastAdminNotifTs) _lastAdminNotifTs = n.timestamp;
        });
        _adminNotifLoaded = true;
      });
    }

    function adjustZoom(delta) { fvSetZoom((_FV.zoom||1) + delta, true); }
    function resetZoom() { fvSetZoom(1, true); _FV.panX=0; _FV.panY=0; fvApplyTransform(); }

    function handleNewsletterSubscription() {
      const email = document.getElementById('newsletterEmail').value;
      if (!email) {
        showToast('Please enter your email address', 'error');
        return;
      }
      showToast('Thank you for subscribing!', 'success');
      document.getElementById('newsletterEmail').value = '';
    }

    function setupHeaderSearchScroll() {
      const headerSearchContainer = document.getElementById('headerSearchContainer');
      if (!headerSearchContainer) return;
      window.addEventListener('scroll', function() {
        headerSearchContainer.style.opacity = '1';
        headerSearchContainer.style.visibility = 'visible';
      }, false);
    }

    function setupBackButton() {
      window.addEventListener('popstate', function(event) {
        const currentPage = document.querySelector('.page.active').id;
        if (currentPage === 'productDetailPage') showPage('productsPage');
        else if (currentPage === 'orderPage' || currentPage === 'userPage' || currentPage === 'paymentPage') {
          if (currentPage === 'paymentPage') showPage('userPage');
          else if (currentPage === 'userPage') showPage('orderPage');
          else if (currentPage === 'orderPage') showPage('productsPage');
        } else showPage('homePage');
      });
    }

    function setupSearchInput() {
      const searchInput = document.getElementById('searchPanelInput');
      if (searchInput) {
        searchInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            performSearch(this.value);
          }
        });
        searchInput.addEventListener('input', function(e) { handleSearchPanelInput(e); });
      }
      const searchResultsInput = document.getElementById('searchResultsInput');
      const searchResultsBtn = document.getElementById('searchResultsBtn');
      if (searchResultsInput) {
        searchResultsInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();
            if (query) {
              window.currentSearchQuery = query;
              const filteredResults = products.filter(product => 
                (product.name || '').toLowerCase().includes(query.toLowerCase()) ||
                (product.description || '').toLowerCase().includes(query.toLowerCase()) ||
                (product.category || '').toLowerCase().includes(query.toLowerCase()) ||
                (product.tags && product.tags.some(tag => (tag || '').toLowerCase().includes(query.toLowerCase())))
              );
              window.currentSearchResults = filteredResults;
              renderSearchResults(filteredResults, query);
              document.getElementById('searchResultsInput').blur();
            }
          }
        });
      }
      if (searchResultsBtn) {
        searchResultsBtn.addEventListener('click', function() {
          const query = document.getElementById('searchResultsInput').value.trim();
          if (query) {
            window.currentSearchQuery = query;
            const filteredResults = products.filter(product => 
              (product.name || '').toLowerCase().includes(query.toLowerCase()) ||
              (product.description || '').toLowerCase().includes(query.toLowerCase()) ||
              (product.category || '').toLowerCase().includes(query.toLowerCase()) ||
              (product.tags && product.tags.some(tag => (tag || '').toLowerCase().includes(query.toLowerCase())))
            );
            window.currentSearchResults = filteredResults;
            renderSearchResults(filteredResults, query);
            document.getElementById('searchResultsInput').blur();
          }
        });
      }
    }

    function setupFileUpload() {
      const fileInput = document.getElementById('reviewFile');
      const filePreview = document.getElementById('filePreview');
      if (fileInput) {
        fileInput.addEventListener('change', function(e) {
          const file = e.target.files[0];
          if (!file) return;
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) { filePreview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:5px;">`; };
            reader.readAsDataURL(file);
          } else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = function(e) { filePreview.innerHTML = `<video controls src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:5px;"></video>`; };
            reader.readAsDataURL(file);
          }
        });
      }
    }

    function setupEventListeners() {
      document.getElementById('menuIcon')?.addEventListener('click', openMenu);
      document.getElementById('menuClose')?.addEventListener('click', closeMenu);
      document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);
      ['themeToggle','themeToggleBtn','darkModeToggle','darkModeBtn','nightModeBtn'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', toggleTheme);
      });
      document.getElementById('userProfile')?.addEventListener('click', checkAuthAndShowAccount);
      document.getElementById('searchPanelClose')?.addEventListener('click', closeSearchPanel);
      document.getElementById('searchPanelInput')?.addEventListener('input', handleSearchPanelInput);
      document.getElementById('clearHistoryBtn')?.addEventListener('click', clearSearchHistory);
      document.getElementById('headerSearchInput')?.addEventListener('click', openSearchPanel);
      document.getElementById('authClose')?.addEventListener('click', () => document.getElementById('authModal').classList.remove('active'));
      document.getElementById('openLoginTop')?.addEventListener('click', showLoginModal);
      document.getElementById('mobileLoginBtn')?.addEventListener('click', showLoginModal);
      document.getElementById('loginTab')?.addEventListener('click', () => switchAuthTab('login'));
      document.getElementById('signupTab')?.addEventListener('click', () => switchAuthTab('signup'));
      document.getElementById('switchToLogin')?.addEventListener('click', () => switchAuthTab('login'));
      document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
      document.getElementById('signupBtn')?.addEventListener('click', handleSignup);
      document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleLogin);
      document.getElementById('googleSignupBtn')?.addEventListener('click', handleGoogleLogin);
      document.getElementById('forgotPasswordLink')?.addEventListener('click', () => {
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('forgotPasswordForm').classList.add('active');
      });
      document.getElementById('backToLogin')?.addEventListener('click', () => {
        document.getElementById('forgotPasswordForm').classList.remove('active');
        document.getElementById('loginForm').classList.add('active');
      });
      document.getElementById('resetPasswordBtn')?.addEventListener('click', handleResetPassword);
      document.getElementById('mobileLogoutBtn')?.addEventListener('click', showLogoutConfirmation);
      document.getElementById('alertCancelBtn')?.addEventListener('click', () => document.getElementById('alertModal').classList.remove('active'));
      document.getElementById('alertConfirmBtn')?.addEventListener('click', confirmLogout);
      document.getElementById('productImageModalClose')?.addEventListener('click', () => document.getElementById('productImageModal').classList.remove('active'));
      document.getElementById('productImageModalPrev')?.addEventListener('click', prevProductModalImage);
      document.getElementById('productImageModalNext')?.addEventListener('click', nextProductModalImage);
      document.getElementById('backToProducts')?.addEventListener('click', () => showPage('productsPage'));
      document.getElementById('toUserInfo')?.addEventListener('click', toUserInfo);
      document.getElementById('editOrder')?.addEventListener('click', () => showPage('orderPage'));
      document.getElementById('toPayment')?.addEventListener('click', toPayment);
      document.getElementById('payBack')?.addEventListener('click', () => showPage('userPage'));
      document.getElementById('confirmOrder')?.addEventListener('click', confirmOrder);
      document.getElementById('goHome')?.addEventListener('click', () => showPage('homePage'));
      document.getElementById('viewOrders')?.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
      document.querySelector('.qty-minus')?.addEventListener('click', decreaseQuantity);
      document.querySelector('.qty-plus')?.addEventListener('click', increaseQuantity);
      document.getElementById('applyPriceFilter')?.addEventListener('click', applyPriceFilter);
      document.getElementById('resetPriceFilter')?.addEventListener('click', resetPriceFilter);
      document.getElementById('applySearchPriceFilter')?.addEventListener('click', applySearchPriceFilter);
      document.getElementById('resetSearchPriceFilter')?.addEventListener('click', resetSearchPriceFilter);
      const minThumb = document.getElementById('priceMinThumb');
      const maxThumb = document.getElementById('priceMaxThumb');
      const priceSliderTrack = document.getElementById('priceSliderTrack');
      const priceSliderRange = document.getElementById('priceSliderRange');
      const minPriceInput = document.getElementById('minPrice');
      const maxPriceInput = document.getElementById('maxPrice');
      if (minThumb && maxThumb && priceSliderTrack) {
        setupPriceSlider(minThumb, maxThumb, priceSliderTrack, priceSliderRange, minPriceInput, maxPriceInput);
      }
      document.getElementById('subscribeBtn')?.addEventListener('click', handleNewsletterSubscription);
      document.getElementById('detailOrderBtn')?.addEventListener('click', orderProductFromDetail);
      document.getElementById('detailWishlistBtn')?.addEventListener('click', toggleWishlistFromDetail);
      document.querySelector('.detail-carousel-control.prev')?.addEventListener('click', prevDetailImage);
      document.querySelector('.detail-carousel-control.next')?.addEventListener('click', nextDetailImage);
      document.getElementById('ratingInput')?.querySelectorAll('.rating-star').forEach(star => {
        star.addEventListener('click', function() {
          setRating(parseInt(this.getAttribute('data-rating')));
        });
      });
      document.getElementById('submitReview')?.addEventListener('click', submitProductReview);
      document.getElementById('copyShareLink')?.addEventListener('click', copyShareLink);
      document.getElementById('saveUserInfo')?.addEventListener('click', saveUserInfoAndAddress);
      document.querySelectorAll('input[name="pay"]').forEach(radio => radio.addEventListener('change', updatePaymentSummary));
      setupFileUpload();
      window.addEventListener('hashchange', function() {
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(hash)) showPage(hash);
        if (hash.includes('productDetailPage?product=')) {
          const productId = hash.split('=')[1];
          const product = products.find(p => p.id === productId);
          if (product) showProductDetail(product);
        }
      });
      if (window.location.hash) {
        const pageId = window.location.hash.substring(1);
        if (document.getElementById(pageId)) showPage(pageId);
        if (window.location.hash.includes('productDetailPage?product=')) {
          const productId = window.location.hash.split('=')[1];
          const checkProducts = setInterval(() => {
            if (products.length > 0) {
              const product = products.find(p => p.id === productId);
              if (product) showProductDetail(product);
              clearInterval(checkProducts);
            }
          }, 100);
        }
      }
      const whatsappLink = document.querySelector('a[href*="wa.me"]');
      if (whatsappLink) {
        whatsappLink.addEventListener('click', function(e) {
          e.preventDefault();
          const message = "Hello Buyzo Cart, I need help with my order 💐 Please assist me with my query.";
          const phone = "9557987574";
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        });
      }
      document.getElementById('cancelCancel')?.addEventListener('click', () => document.getElementById('cancellationModal').classList.remove('active'));
      document.getElementById('cancelReturnReplace')?.addEventListener('click', () => document.getElementById('returnReplaceModal').classList.remove('active'));
    }


    // ══════════════════════════════════════════════════════════
    // CATEGORY SHAPE PAGE
    // ══════════════════════════════════════════════════════════
    function showCategories() { openCategoryShapePage(); }

    function openCategoryShapePage() {
      showPage('categoryPage');
      setTimeout(bzRenderOrbit, 150);
    }

    function bzCalcLayout(n, screenW) {
      var ITEM_ARC = 84, PAD = 52;
      var r = Math.max(Math.ceil(n * ITEM_ARC / (2 * Math.PI)), 90);
      return r <= (screenW / 2 - PAD)
        ? { mode: 'circle', radius: r, stageSize: r * 2 + PAD * 2 }
        : { mode: 'line' };
    }

    function bzRenderOrbit() {
      var ring  = document.getElementById('bzOrbitRing');
      var stage = document.getElementById('bzOrbitStage');
      if (!ring || !stage) return;
      ring.classList.remove('bz-spinning');
      Array.from(ring.querySelectorAll('.bz-cat-item')).forEach(function(el) { el.remove(); });
      if (!categories || !categories.length) { setTimeout(bzRenderOrbit, 600); return; }

      var cats = categories, n = cats.length;
      var screenW = Math.min(window.innerWidth, 480);
      var layout  = bzCalcLayout(n, screenW);

      if (layout.mode === 'circle') {
        var sz = Math.min(Math.max(layout.stageSize, 220), screenW - 16);
        stage.style.width  = sz + 'px';
        stage.style.height = sz + 'px';
        ring.style.transformOrigin = (sz / 2) + 'px ' + (sz / 2) + 'px';
        var svg = document.getElementById('bzGuideSvg');
        if (svg) {
          svg.setAttribute('viewBox', '0 0 ' + sz + ' ' + sz);
          svg.innerHTML = '<circle cx="' + (sz/2) + '" cy="' + (sz/2) + '" r="' + layout.radius + '" fill="none" stroke="rgba(37,99,235,0.10)" stroke-width="1.5" stroke-dasharray="6 4"/>';
        }
        var iw = 76, r = layout.radius, cx = sz / 2, cy = sz / 2;
        cats.forEach(function(cat, i) {
          var a  = (2 * Math.PI * i / n) - Math.PI / 2;
          var px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
          var img = typeof getProductImage === 'function' ? getProductImage(cat) : '';
          var nm  = (cat.name || '').slice(0, 14);
          var item = document.createElement('div');
          item.className = 'bz-cat-item';
          item.style.width = iw + 'px';
          item.style.left  = (px - iw / 2) + 'px';
          item.style.top   = (py - 45) + 'px';
          item.title = cat.name || '';
          item.innerHTML = '<div class="bz-cat-thumb"></div><span class="bz-cat-label">' + nm + '</span>';
          var thumb = item.querySelector('.bz-cat-thumb');
          if (img && thumb) thumb.style.backgroundImage = "url('" + img + "')";
          item.addEventListener('click', function() { filterByCategory(cat.id); });
          ring.appendChild(item);
        });
        var outer = stage.parentElement;
        if (outer) { outer.style.overflowX = ''; outer.style.minHeight = sz + 'px'; }
        setTimeout(function() {
          var r2 = document.getElementById('bzOrbitRing');
          if (r2) r2.classList.add('bz-spinning');
          // Swipe speed control
          var stg = document.getElementById('bzOrbitStage');
          if (stg && !stg._bzSpeedInited) {
            stg._bzSpeedInited = true;
            var curDur = 22;
            function applyOrbitSpeed(dur) {
              curDur = Math.max(3, Math.min(80, dur));
              var rng = document.getElementById('bzOrbitRing');
              if (!rng) return;
              rng.style.animationDuration = curDur + 's';
              rng.querySelectorAll('.bz-cat-item').forEach(function(it) {
                it.style.animationDuration = curDur + 's';
              });
            }
            var ts = {x:0, y:0, t:0};
            stg.addEventListener('touchstart', function(e) {
              ts.x = e.touches[0].clientX; ts.y = e.touches[0].clientY; ts.t = Date.now();
            }, { passive: true });
            stg.addEventListener('touchend', function(e) {
              var dx = e.changedTouches[0].clientX - ts.x;
              var dy = e.changedTouches[0].clientY - ts.y;
              var dt = Math.max(1, Date.now() - ts.t);
              if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
              if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
              var vel = Math.abs(dx) / dt;
              applyOrbitSpeed(curDur + (dx > 0 ? 5 : -5) * (1 + vel * 8));
            }, { passive: true });
            var ms2 = {x:0, t:0, dn:false};
            stg.addEventListener('mousedown', function(e) { ms2.x=e.clientX; ms2.t=Date.now(); ms2.dn=true; });
            stg.addEventListener('mouseup', function(e) {
              if (!ms2.dn) return; ms2.dn = false;
              var dx2 = e.clientX - ms2.x; var dt2 = Math.max(1, Date.now() - ms2.t);
              if (Math.abs(dx2) < 10) return;
              applyOrbitSpeed(curDur + (dx2 > 0 ? 5 : -5) * (1 + Math.abs(dx2)/dt2 * 8));
            });
          }
        }, 600);
      } else {
        // LINE MODE — too many categories for circle
        stage.style.width  = 'auto';
        stage.style.height = '110px';
        ring.style.transformOrigin = '0 0';
        var svg2 = document.getElementById('bzGuideSvg');
        if (svg2) svg2.innerHTML = '';
        cats.forEach(function(cat) {
          var img = typeof getProductImage === 'function' ? getProductImage(cat) : '';
          var nm  = (cat.name || '').slice(0, 14);
          var item = document.createElement('div');
          item.className = 'bz-cat-item';
          item.style.cssText = 'position:relative;left:0;top:0;width:80px;display:inline-flex;flex-direction:column;align-items:center;flex-shrink:0;';
          item.title = cat.name || '';
          item.innerHTML = '<div class="bz-cat-thumb"></div><span class="bz-cat-label">' + nm + '</span>';
          var thumb = item.querySelector('.bz-cat-thumb');
          if (img && thumb) thumb.style.backgroundImage = "url('" + img + "')";
          item.addEventListener('click', function() { filterByCategory(cat.id); });
          ring.appendChild(item);
        });
        ring.style.cssText = 'position:relative;display:flex;flex-direction:row;gap:8px;padding:8px;animation:none;transform:none;';
        var outer2 = stage.parentElement;
        if (outer2) { outer2.style.overflowX = 'auto'; outer2.style.minHeight = '120px'; outer2.style.justifyContent = 'flex-start'; }
      }
      bzRenderCatTags(cats);
    }

    function bzRenderCatTags(cats) {
      var container = document.getElementById('bzCatTags');
      if (!container) return;
      container.innerHTML = '';
      var tags = (typeof searchTags !== 'undefined' && searchTags && searchTags.length)
        ? searchTags : cats.map(function(c) { return c.name || ''; }).filter(Boolean);
      tags.forEach(function(tag) {
        var chip = document.createElement('button');
        chip.textContent = tag;
        chip.type = 'button';
        chip.style.cssText = 'padding:7px 15px;border-radius:999px;border:1.5px solid #e2e8f0;background:#f8fafc;'
          + 'color:#475569;font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;white-space:nowrap;'
          + '-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;';
        chip.addEventListener('mouseenter', function() { this.style.background='#2563eb';this.style.color='#fff';this.style.borderColor='#2563eb'; });
        chip.addEventListener('mouseleave', function() { this.style.background='#f8fafc';this.style.color='#475569';this.style.borderColor='#e2e8f0'; });
        function doTagFilter(e) {
          e.preventDefault(); e.stopPropagation();
          var cat = categories && categories.find(function(c) { return c.name === tag; });
          if (cat && typeof filterByCategory === 'function') { filterByCategory(cat.id); }
          else if (typeof filterProductsByTag === 'function') { filterProductsByTag(tag); }
          else if (typeof performSearch === 'function') { performSearch(tag); }
        }
        chip.addEventListener('click', doTagFilter);
        chip.addEventListener('touchend', function(e) { e.preventDefault(); doTagFilter(e); }, { passive: false });
        container.appendChild(chip);
      });
    }

    // ══════════════════════════════════════════════════════════
    // ORDER TRACK ANIMATION PAGE
    // ══════════════════════════════════════════════════════════
    var _otStep = 0, _otOrder = null;

    window.openOrderTrackPage = function() {
      showPage('orderTrackPage');
      if (currentUser) { otLoadUserOrders(); }
      else { otSetStep(0); var pk = document.getElementById('otOrderPicker'); if (pk) pk.style.display = 'none'; }
    };

    function otLoadUserOrders() {
      if (!currentUser || !window.firebase) return;
      var q = window.firebase.query(
        window.firebase.ref(window.firebase.database, 'orders'),
        window.firebase.orderByChild('userId'),
        window.firebase.equalTo(currentUser.uid)
      );
      window.firebase.get(q).then(function(snap) {
        var sel    = document.getElementById('otOrderSelect');
        var picker = document.getElementById('otOrderPicker');
        if (!sel || !snap.exists()) { otSetStep(0); return; }
        var ordersArr = Object.values(snap.val()).sort(function(a, b) { return (b.orderDate || 0) - (a.orderDate || 0); });
        sel.innerHTML = '<option value="">— Choose an order —</option>';
        ordersArr.forEach(function(order) {
          var opt = document.createElement('option');
          var oid = order.orderId || order.id || '';
          opt.value = oid;
          opt.textContent = (order.productName || 'Order').slice(0, 28) + '  ·  ' + new Date(order.orderDate || Date.now()).toLocaleDateString('en-IN');
          sel._orderMap = sel._orderMap || {};
          sel._orderMap[oid] = order;
          sel.appendChild(opt);
        });
        if (picker) picker.style.display = 'block';
        if (ordersArr.length === 1) { var oid = ordersArr[0].orderId || ordersArr[0].id; sel.value = oid; otLoadOrder(oid); }
        else { otSetStep(0); }
      }).catch(function() { otSetStep(0); });
    }

    window.otLoadOrder = function(orderId) {
      var sel = document.getElementById('otOrderSelect');
      var order = sel && sel._orderMap && sel._orderMap[orderId];
      if (!orderId || !order) { _otOrder = null; var pc = document.getElementById('otProductCard'); if (pc) pc.style.display = 'none'; otSetStep(0); return; }
      _otOrder = order;
      var pc   = document.getElementById('otProductCard');
      var img  = document.getElementById('otProductImg');
      var nameEl = document.getElementById('otProductName');
      var metaEl = document.getElementById('otProductMeta');
      var idEl   = document.getElementById('otOrderId');
      if (pc) pc.style.display = 'flex';
      var lp = products.find(function(p) { return p.id === order.productId; });
      var imgUrl = lp ? getProductImage(lp) : (order.productImage || '');
      if (img && imgUrl) img.style.backgroundImage = "url('" + imgUrl + "')";
      if (nameEl) nameEl.textContent = order.productName || 'Product';
      if (metaEl) metaEl.textContent = formatPrice(order.totalAmount || 0) + '  ·  Qty: ' + (order.quantity || 1) + '  ·  Size: ' + (order.size || 'N/A');
      if (idEl)   idEl.textContent   = 'Order ID: ' + (order.orderId || order.id || '');
      var SM = { placed: 0, confirmed: 1, shipped: 2, out_for_delivery: 2, delivered: 3, cancelled: 0 };
      otSetStep(SM[(order.status || 'placed').toLowerCase()] ?? 0);
    };

    window.otSetStep = function(step) {
      _otStep = step;
      var line = document.getElementById('otProgressLine');
      if (line) line.style.width = [0, 33, 66, 100][step] + '%';
      for (var i = 0; i < 4; i++) {
        var dot = document.getElementById('otDot' + i);
        var lbl = document.getElementById('otLbl' + i);
        if (!dot) continue;
        dot.className = 'ot-dot' + (i < step ? ' done' : i === step ? ' active' : '');
        if (lbl) lbl.className = 'ot-step-label' + (i < step ? ' done' : i === step ? ' active' : '');
      }
      var titles = ['Order Placed!', 'Order Confirmed!', 'Out for Delivery!', 'Delivered! 🎉'];
      var descs  = [
        'Your order has been received and is being processed.',
        'Buyzo Cart has confirmed your order and is packing it carefully.',
        'Your order is on the way! Our delivery partner is heading to your doorstep.',
        'Your order has been successfully delivered. Enjoy your purchase!'
      ];
      var t = document.getElementById('otStatusTitle'), d = document.getElementById('otStatusDesc');
      if (t) t.textContent = titles[step] || '';
      if (d) d.textContent = descs[step]  || '';
      otRenderAnim(step);
    };

    function otRenderAnim(step) {
      var stage = document.getElementById('otAnimStage');
      if (!stage) return;
      var W = Math.max(stage.offsetWidth || 340, 260), H = 220;
      var imgUrl = '';
      if (_otOrder) {
        var lp2 = products.find(function(p) { return p.id === _otOrder.productId; });
        imgUrl = lp2 ? getProductImage(lp2) : (_otOrder.productImage || '');
      }

      var scenes = [
        // PLACED — order paper flying into Buyzo Cart building
        (function() {
          var bx = W*0.58, by = H*0.20, bw = W*0.34, bh = H*0.54;
          return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:'+H+'px;">'
          +'<defs><linearGradient id="g0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dbeafe"/><stop offset="100%" stop-color="#ede9fe"/></linearGradient></defs>'
          +'<rect width="'+W+'" height="'+H+'" fill="url(#g0)"/>'
          +'<rect x="0" y="'+(H*0.74)+'" width="'+W+'" height="'+(H*0.26)+'" fill="#bbf7d0"/>'
          // Building
          +'<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" fill="#2563eb" rx="6"/>'
          +'<rect x="'+(bx+bw*0.08)+'" y="'+(by+bh*0.08)+'" width="'+(bw*0.25)+'" height="'+(bh*0.16)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(bx+bw*0.45)+'" y="'+(by+bh*0.08)+'" width="'+(bw*0.25)+'" height="'+(bh*0.16)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(bx+bw*0.08)+'" y="'+(by+bh*0.32)+'" width="'+(bw*0.25)+'" height="'+(bh*0.16)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(bx+bw*0.45)+'" y="'+(by+bh*0.32)+'" width="'+(bw*0.25)+'" height="'+(bh*0.16)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(bx+bw*0.3)+'" y="'+(by+bh*0.6)+'" width="'+(bw*0.25)+'" height="'+(bh*0.4)+'" fill="#1d4ed8" rx="3"/>'
          +'<rect x="'+(bx-2)+'" y="'+(by-bh*0.12)+'" width="'+(bw+4)+'" height="'+(bh*0.13)+'" fill="#1e40af" rx="4"/>'
          +'<text x="'+(bx+bw/2)+'" y="'+(by-bh*0.03)+'" font-family="Arial" font-weight="bold" font-size="9" fill="white" text-anchor="middle">BUYZO CART</text>'
          // Flying paper with product image
          +'<g style="animation:fly0 2.6s ease-in-out infinite;">'
          +'<rect x="'+(W*0.05)+'" y="'+(H*0.22)+'" width="44" height="56" fill="white" rx="4" stroke="#2563eb" stroke-width="2"/>'
          +(imgUrl ? '<image href="'+imgUrl+'" x="'+(W*0.05+4)+'" y="'+(H*0.22+4)+'" width="36" height="36" preserveAspectRatio="xMidYMid slice"/>' : '')
          +'<line x1="'+(W*0.05+6)+'" y1="'+(H*0.22+45)+'" x2="'+(W*0.05+38)+'" y2="'+(H*0.22+45)+'" stroke="#2563eb" stroke-width="1.5" opacity="0.5"/>'
          +'<text x="'+(W*0.05+22)+'" y="'+(H*0.22+54)+'" font-family="Arial" font-weight="bold" font-size="7.5" fill="#2563eb" text-anchor="middle">ORDER</text>'
          +'</g>'
          +'<style>@keyframes fly0{0%{transform:translate(0,0) rotate(-5deg);}60%{transform:translate('+(W*0.3)+'px,-16px) rotate(4deg);}100%{transform:translate('+(W*0.52)+'px,14px) rotate(0deg) scale(0.3);opacity:0;}}</style>'
          +'<text x="'+(W*0.35)+'" y="'+(H*0.13)+'" font-size="15" style="animation:tw0 1.4s infinite alternate;">⭐</text>'
          +'<style>@keyframes tw0{from{opacity:0.3;transform:scale(0.8)}to{opacity:1;transform:scale(1.2)}}</style>'
          +'</svg>';
        })(),

        // CONFIRMED — checkmark at building with confetti
        (function() {
          return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:'+H+'px;">'
          +'<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#dcfce7"/><stop offset="100%" stop-color="#d1fae5"/></linearGradient></defs>'
          +'<rect width="'+W+'" height="'+H+'" fill="url(#g1)"/>'
          +'<rect x="0" y="'+(H*0.74)+'" width="'+W+'" height="'+(H*0.26)+'" fill="#86efac"/>'
          +'<rect x="'+(W*0.28)+'" y="'+(H*0.18)+'" width="'+(W*0.44)+'" height="'+(H*0.56)+'" fill="#2563eb" rx="6"/>'
          +'<rect x="'+(W*0.32)+'" y="'+(H*0.23)+'" width="'+(W*0.1)+'" height="'+(H*0.11)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(W*0.56)+'" y="'+(H*0.23)+'" width="'+(W*0.1)+'" height="'+(H*0.11)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(W*0.32)+'" y="'+(H*0.38)+'" width="'+(W*0.1)+'" height="'+(H*0.11)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(W*0.56)+'" y="'+(H*0.38)+'" width="'+(W*0.1)+'" height="'+(H*0.11)+'" fill="#bfdbfe" rx="3"/>'
          +'<rect x="'+(W*0.43)+'" y="'+(H*0.56)+'" width="'+(W*0.14)+'" height="'+(H*0.18)+'" fill="#1d4ed8" rx="3"/>'
          +'<rect x="'+(W*0.26)+'" y="'+(H*0.11)+'" width="'+(W*0.48)+'" height="'+(H*0.08)+'" fill="#1e40af" rx="4"/>'
          +'<text x="'+(W*0.5)+'" y="'+(H*0.175)+'" font-family="Arial" font-weight="bold" font-size="10" fill="white" text-anchor="middle">BUYZO CART</text>'
          +'<g style="animation:pop1 0.5s ease-out both,flt1 2s ease-in-out 0.5s infinite;">'
          +'<circle cx="'+(W*0.5)+'" cy="'+(H*0.41)+'" r="24" fill="#22c55e" opacity="0.15"/>'
          +'<circle cx="'+(W*0.5)+'" cy="'+(H*0.41)+'" r="19" fill="#22c55e"/>'
          +'<polyline points="'+(W*0.5-10)+','+(H*0.41)+' '+(W*0.5-2)+','+(H*0.41+8)+' '+(W*0.5+11)+','+(H*0.41-10)+'" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
          +'</g>'
          +'<circle cx="'+(W*0.17)+'" cy="'+(H*0.3)+'" r="5" fill="#f59e0b" style="animation:cf1 1.5s ease-in-out infinite;"/>'
          +'<circle cx="'+(W*0.83)+'" cy="'+(H*0.25)+'" r="4" fill="#ef4444" style="animation:cf1 1.8s 0.3s ease-in-out infinite;"/>'
          +'<circle cx="'+(W*0.12)+'" cy="'+(H*0.55)+'" r="4" fill="#8b5cf6" style="animation:cf1 2s 0.6s ease-in-out infinite;"/>'
          +'<circle cx="'+(W*0.87)+'" cy="'+(H*0.5)+'" r="5" fill="#06b6d4" style="animation:cf1 1.4s 0.2s ease-in-out infinite;"/>'
          +'<text x="'+(W*0.1)+'" y="'+(H*0.38)+'" font-size="18" style="animation:bc1 1s ease-in-out infinite;">🎉</text>'
          +'<style>@keyframes pop1{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}'
          +'@keyframes flt1{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}'
          +'@keyframes cf1{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-18px) rotate(180deg)}}'
          +'@keyframes bc1{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}</style>'
          +'</svg>';
        })(),

        // SHIPPED — clean delivery truck with BUYZO CART, product box on road
        (function() {
          return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:'+H+'px;">'
          +'<defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fef9c3"/><stop offset="100%" stop-color="#fde68a"/></linearGradient></defs>'
          +'<rect width="'+W+'" height="'+H+'" fill="url(#g2)"/>'
          // Road
          +'<rect x="0" y="'+(H*0.7)+'" width="'+W+'" height="'+(H*0.3)+'" fill="#334155"/>'
          +'<rect x="0" y="'+(H*0.7)+'" width="'+W+'" height="5" fill="#475569"/>'
          // Road dashes
          +'<rect x="'+(W*0.04)+'" y="'+(H*0.72)+'" width="'+(W*0.12)+'" height="5" fill="#fbbf24" rx="2"/>'
          +'<rect x="'+(W*0.3)+'" y="'+(H*0.72)+'" width="'+(W*0.12)+'" height="5" fill="#fbbf24" rx="2"/>'
          +'<rect x="'+(W*0.56)+'" y="'+(H*0.72)+'" width="'+(W*0.12)+'" height="5" fill="#fbbf24" rx="2"/>'
          +'<rect x="'+(W*0.82)+'" y="'+(H*0.72)+'" width="'+(W*0.12)+'" height="5" fill="#fbbf24" rx="2"/>'
          // Trees
          +'<rect x="'+(W*0.82)+'" y="'+(H*0.48)+'" width="6" height="'+(H*0.22)+'" fill="#854d0e"/>'
          +'<ellipse cx="'+(W*0.82+3)+'" cy="'+(H*0.42)+'" rx="14" ry="18" fill="#16a34a"/>'
          +'<rect x="'+(W*0.91)+'" y="'+(H*0.52)+'" width="5" height="'+(H*0.18)+'" fill="#854d0e"/>'
          +'<ellipse cx="'+(W*0.91+2)+'" cy="'+(H*0.46)+'" rx="12" ry="15" fill="#15803d"/>'
          // Animated truck moving left to right
          +'<g style="animation:truck2 2.4s ease-in-out infinite;">'
          // Truck cargo box (left part)
          +'<rect x="'+(W*0.04)+'" y="'+(H*0.44)+'" width="'+(W*0.38)+'" height="'+(H*0.26)+'" fill="#1e40af" rx="5"/>'
          // Cargo product image
          +(imgUrl ? '<image href="'+imgUrl+'" x="'+(W*0.06)+'" y="'+(H*0.46)+'" width="'+(W*0.12)+'" height="'+(H*0.22)+'" preserveAspectRatio="xMidYMid slice" clip-path="url(#cc)"/>' : '')
          +'<defs><clipPath id="cc"><rect x="'+(W*0.06)+'" y="'+(H*0.46)+'" width="'+(W*0.12)+'" height="'+(H*0.22)+'"/></clipPath></defs>'
          // BUYZO CART on cargo side
          +'<text x="'+(W*0.25)+'" y="'+(H*0.59)+'" font-family="Arial" font-weight="bold" font-size="10" fill="#bfdbfe" text-anchor="middle">BUYZO CART</text>'
          // Cab (right part)
          +'<rect x="'+(W*0.39)+'" y="'+(H*0.4)+'" width="'+(W*0.18)+'" height="'+(H*0.3)+'" fill="#2563eb" rx="5 5 0 0"/>'
          // Windscreen
          +'<rect x="'+(W*0.41)+'" y="'+(H*0.42)+'" width="'+(W*0.13)+'" height="'+(H*0.12)+'" fill="#bfdbfe" rx="4"/>'
          // Headlight
          +'<rect x="'+(W*0.545)+'" y="'+(H*0.6)+'" width="'+(W*0.025)+'" height="6" fill="#fef08a" rx="2"/>'
          // Wheels
          +'<circle cx="'+(W*0.13)+'" cy="'+(H*0.71)+'" r="13" fill="#1e293b"/><circle cx="'+(W*0.13)+'" cy="'+(H*0.71)+'" r="6" fill="#94a3b8"/>'
          +'<circle cx="'+(W*0.33)+'" cy="'+(H*0.71)+'" r="13" fill="#1e293b"/><circle cx="'+(W*0.33)+'" cy="'+(H*0.71)+'" r="6" fill="#94a3b8"/>'
          +'<circle cx="'+(W*0.5)+'" cy="'+(H*0.71)+'" r="10" fill="#1e293b"/><circle cx="'+(W*0.5)+'" cy="'+(H*0.71)+'" r="5" fill="#94a3b8"/>'
          // Driver silhouette
          +'<circle cx="'+(W*0.465)+'" cy="'+(H*0.46)+'" r="7" fill="#fde68a"/>'
          +'</g>'
          // Speed lines
          +'<g style="animation:spd2 0.45s linear infinite;">'
          +'<line x1="'+(W*0.63)+'" y1="'+(H*0.51)+'" x2="'+(W*0.78)+'" y2="'+(H*0.51)+'" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>'
          +'<line x1="'+(W*0.65)+'" y1="'+(H*0.57)+'" x2="'+(W*0.83)+'" y2="'+(H*0.57)+'" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" opacity="0.5"/>'
          +'<line x1="'+(W*0.62)+'" y1="'+(H*0.63)+'" x2="'+(W*0.74)+'" y2="'+(H*0.63)+'" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>'
          +'</g>'
          +'<style>@keyframes truck2{0%,100%{transform:translateX(0)}50%{transform:translateX(9px)}}'
          +'@keyframes spd2{0%{opacity:0.8;transform:translateX(0)}100%{opacity:0;transform:translateX(-24px)}}</style>'
          +'</svg>';
        })(),

        // DELIVERED — truck parked at house, package at door, banner
        (function() {
          return '<svg viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:'+H+'px;">'
          +'<defs><linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f0fdf4"/><stop offset="100%" stop-color="#dcfce7"/></linearGradient></defs>'
          +'<rect width="'+W+'" height="'+H+'" fill="url(#g3)"/>'
          +'<rect x="0" y="'+(H*0.72)+'" width="'+W+'" height="'+(H*0.28)+'" fill="#334155"/>'
          // House
          +'<polygon points="'+(W*0.58)+','+(H*0.14)+' '+(W*0.37)+','+(H*0.34)+' '+(W*0.79)+','+(H*0.34)+'" fill="#ef4444"/>'
          +'<rect x="'+(W*0.39)+'" y="'+(H*0.34)+'" width="'+(W*0.38)+'" height="'+(H*0.38)+'" fill="#fef9c3" rx="0 0 4 4"/>'
          +'<rect x="'+(W*0.51)+'" y="'+(H*0.52)+'" width="'+(W*0.12)+'" height="'+(H*0.2)+'" fill="#92400e" rx="3 3 0 0"/>'
          +'<rect x="'+(W*0.41)+'" y="'+(H*0.37)+'" width="'+(W*0.1)+'" height="'+(H*0.11)+'" fill="#bae6fd" rx="3"/>'
          +'<rect x="'+(W*0.65)+'" y="'+(H*0.37)+'" width="'+(W*0.1)+'" height="'+(H*0.11)+'" fill="#bae6fd" rx="3"/>'
          // Parked truck
          +'<rect x="'+(W*0.02)+'" y="'+(H*0.5)+'" width="'+(W*0.3)+'" height="'+(H*0.22)+'" fill="#2563eb" rx="6"/>'
          +'<rect x="'+(W*0.22)+'" y="'+(H*0.45)+'" width="'+(W*0.12)+'" height="'+(H*0.27)+'" fill="#1d4ed8" rx="5 5 0 0"/>'
          +'<rect x="'+(W*0.24)+'" y="'+(H*0.47)+'" width="'+(W*0.08)+'" height="'+(H*0.1)+'" fill="#bfdbfe" rx="2"/>'
          +'<circle cx="'+(W*0.09)+'" cy="'+(H*0.73)+'" r="11" fill="#1e293b"/><circle cx="'+(W*0.09)+'" cy="'+(H*0.73)+'" r="5" fill="#94a3b8"/>'
          +'<circle cx="'+(W*0.26)+'" cy="'+(H*0.73)+'" r="11" fill="#1e293b"/><circle cx="'+(W*0.26)+'" cy="'+(H*0.73)+'" r="5" fill="#94a3b8"/>'
          +'<text x="'+(W*0.16)+'" y="'+(H*0.63)+'" font-family="Arial" font-weight="bold" font-size="8" fill="#bfdbfe" text-anchor="middle">BUYZO CART</text>'
          // Package with product image at door
          +'<rect x="'+(W*0.49)+'" y="'+(H*0.62)+'" width="30" height="26" fill="#fbbf24" rx="3"/>'
          +(imgUrl ? '<image href="'+imgUrl+'" x="'+(W*0.49+2)+'" y="'+(H*0.62+2)+'" width="26" height="22" preserveAspectRatio="xMidYMid slice"/>' : '')
          +'<line x1="'+(W*0.49+15)+'" y1="'+(H*0.62)+'" x2="'+(W*0.49+15)+'" y2="'+(H*0.62+26)+'" stroke="#f59e0b" stroke-width="1.5"/>'
          +'<line x1="'+(W*0.49)+'" y1="'+(H*0.62+13)+'" x2="'+(W*0.49+30)+'" y2="'+(H*0.62+13)+'" stroke="#f59e0b" stroke-width="1.5"/>'
          // Banner
          +'<rect x="'+(W*0.05)+'" y="'+(H*0.05)+'" width="'+(W*0.9)+'" height="'+(H*0.13)+'" fill="#22c55e" rx="10" style="animation:bp3 0.5s ease-out both;"/>'
          +'<text x="'+(W*0.5)+'" y="'+(H*0.14)+'" font-family="Arial" font-weight="bold" font-size="12" fill="white" text-anchor="middle">✓ Delivery Completed!</text>'
          +'<text x="'+(W*0.1)+'" y="'+(H*0.47)+'" font-size="18" style="animation:bb3 1.1s ease-in-out infinite;">🎉</text>'
          +'<text x="'+(W*0.84)+'" y="'+(H*0.47)+'" font-size="16" style="animation:bb3 1.1s 0.5s ease-in-out infinite;">⭐</text>'
          +'<style>@keyframes bp3{from{transform:scaleX(0);opacity:0}to{transform:scaleX(1);opacity:1}}'
          +'@keyframes bb3{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}</style>'
          +'</svg>';
        })()
      ];

      stage.innerHTML = scenes[step] || scenes[0];
    }

    // categoryPage + orderTrackPage in showPage switch
    function initApp() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      recentSearches = cacheManager.get(CACHE_KEYS.RECENT_SEARCHES) || [];
      updateNotifBadge();

      // ── INSTANT USER RESTORE (no login flash on load) ──────────
      try {
        const _cu = localStorage.getItem('_bz_cached_user');
        if (_cu) {
          const _ud = JSON.parse(_cu);
          const _prof = document.getElementById('userProfile');
          const _login = document.getElementById('openLoginTop');
          const _mLogin = document.getElementById('mobileLoginBtn');
          const _mProf = document.getElementById('mobileUserProfile');
          const _mLogout = document.getElementById('mobileLogoutBtn');
          const _hSearch = document.getElementById('headerSearchContainer');
          if (_prof) _prof.style.display = 'flex';
          if (_login) _login.style.display = 'none';
          if (_mLogin) _mLogin.style.display = 'none';
          if (_mProf) _mProf.style.display = 'flex';
          if (_mLogout) _mLogout.style.display = 'flex';
          if (_hSearch) _hSearch.style.display = 'block';
          const _aim = document.getElementById('userAvatarImg');
          const _aii = document.getElementById('userAvatarInitial');
          const _hn  = document.getElementById('headerUserNameShort');
          if (_ud.photoURL && _aim) {
            _aim.src = _ud.photoURL; _aim.style.display = 'block';
            if (_aii) _aii.style.display = 'none';
          } else if (_aii) {
            _aii.style.display = 'block';
            _aii.textContent = (_ud.displayName || 'U')[0].toUpperCase();
            if (_aim) _aim.style.display = 'none';
          }
          if (_hn) {
            const sn = (_ud.displayName || 'User').split(' ')[0];
            _hn.textContent = sn.length > 10 ? sn.substring(0, 10) + '...' : sn;
          }
        }
      } catch(e) {}
      // ───────────────────────────────────────────────────────────

      setupEventListeners();
      if (window.firebase && window.firebase.auth) {
        window.firebase.onAuthStateChanged(window.firebase.auth, user => {
          if (user) {
            currentUser = user;
            updateUIForUser(user);
            loadUserData(user);
            loadRecentlyViewed(user);
            loadSavedAddresses();
            document.getElementById('authModal')?.classList.remove('active');

            setupAccountRealtimeSync(user.uid);
            setupOrdersRealtimeListener(user);
            // Load following brands products
            setTimeout(() => { if (typeof loadFollowingProducts === 'function') loadFollowingProducts(); }, 1500);

            if (window._pendingAccountNav) {
              window._pendingAccountNav = false;
              setTimeout(() => { window.location.href = '/account'; }, 300);
            }

            try {
              const presenceRef = window.firebase.ref(window.firebase.database, 'presence/' + user.uid);
              window.firebase.set(presenceRef, { uid: user.uid, online: true, lastSeen: Date.now() });
              const connRef = window.firebase.ref(window.firebase.database, '.info/connected');
              window.firebase.onValue(connRef, snap => {
                if (snap.val() === true) {
                  window.firebase.set(presenceRef, { uid: user.uid, online: true, lastSeen: Date.now() });
                }
              });
              window.addEventListener('beforeunload', () => {
                window.firebase.remove(presenceRef).catch(()=>{});
              });
            } catch(e) {}

            const freshSessionKey = 'bz_fresh_session_' + user.uid;
            if (!sessionStorage.getItem(freshSessionKey)) {
              sessionStorage.setItem(freshSessionKey, '1');
              setTimeout(loadAdminOfferNotifs, 1500);
            }
          } else {
            if (currentUser) {
              try { window.firebase.remove(window.firebase.ref(window.firebase.database, 'presence/' + currentUser.uid)).catch(()=>{}); } catch(e) {}
            }
            currentUser = null;
            updateUIForGuest();
          }
        });
      }
      loadCachedData();
      fetchLiveData();
      setupRealtimeListeners();
      showPage('homePage');
      setupHeroMessages();
      updateBottomNav();
      setupHeaderSearchScroll();
      setupBackButton();
      setupSearchInput();
      setupViewAllRatings();
      updateAdminSettingsUI();
      if (window.location.hash && window.location.hash.includes('productDetailPage?product=')) {
        const productId = window.location.hash.split('=')[1];
        const checkProducts = setInterval(() => {
          if (products.length > 0) {
            const product = products.find(p => p.id === productId);
            if (product) showProductDetail(product);
            clearInterval(checkProducts);
          }
        }, 100);
      }
    }

    function copyOfferCode(code) {
      navigator.clipboard.writeText(code).then(() => {
        showToast('Offer code "' + code + '" copied!', 'success');
      }).catch(() => {
        showToast('Code: ' + code, 'success');
      });
    }

    function loadOffersFromDB() {
      if (!window.firebase || !window.firebase.database) return;
      const grid = document.getElementById('offersGrid');
      if (!grid) return;
      window.firebase.get(window.firebase.ref(window.firebase.database, 'offers')).then(snap => {
        if (!snap.exists()) {
          grid.innerHTML = '<div style="text-align:center;padding:60px 20px;width:100%;"><div style="font-size:48px;margin-bottom:16px;">🎁</div><h3 style="color:var(--muted);margin:0 0 8px 0;">No offers right now</h3><p style="color:var(--muted-light);margin:0;">Check back soon for exciting deals!</p></div>';
          return;
        }
        const offersArr = Object.entries(snap.val()).map(([k, v]) => ({ id: k, ...v }));
        const badgeColors = ['#2563eb', '#ef4444', '#22c55e', '#8b5cf6', '#f59e0b', '#06b6d4'];
        const emojis = ['🎁', '⚡', '👗', '🚚', '👟', '👑', '💥', '🔥', '🎉'];
        grid.innerHTML = '';
        offersArr.forEach((offer, idx) => {
          const badgeColor = offer.badgeColor || badgeColors[idx % badgeColors.length];
          const emoji = offer.emoji || emojis[idx % emojis.length];
          const code = offer.code || '';
          const card = document.createElement('div');
          card.className = 'offer-card' + (idx === 0 ? ' featured-offer' : '');
          card.innerHTML = `
            ${offer.badge ? `<div class="offer-badge-top" style="background:${badgeColor};">${offer.badge}</div>` : ''}
            <div class="offer-emoji">${emoji}</div>
            <h3 class="offer-title">${offer.title || 'Special Offer'}</h3>
            <p class="offer-desc">${offer.description || offer.message || ''}</p>
            ${code ? `<div class="offer-code-box">
              <span class="offer-code-label">Use Code:</span>
              <span class="offer-code" onclick="copyOfferCode('${code}')">${code}</span>
              <button class="offer-copy-btn" onclick="copyOfferCode('${code}')">📋 Copy</button>
            </div>` : ''}
            ${offer.savings ? `<div class="offer-savings">${offer.savings}</div>` : ''}
            <button class="offer-shop-btn" onclick="showPage('productsPage');">Shop Now →</button>
          `;
          grid.appendChild(card);
        });
      }).catch(() => {
        grid.innerHTML = '<div style="text-align:center;padding:60px 20px;width:100%;color:var(--muted);">Could not load offers. Please try again.</div>';
      });
    }

    function startOffersTimer() {
      const endTime = new Date();
      endTime.setHours(23, 59, 59, 999);
      function tick() {
        const now = new Date();
        let diff = endTime - now;
        if (diff < 0) { diff = 0; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const pad = n => String(n).padStart(2, '0');
        const hEl = document.getElementById('offerHours');
        const mEl = document.getElementById('offerMins');
        const sEl = document.getElementById('offerSecs');
        if (hEl) hEl.textContent = pad(h);
        if (mEl) mEl.textContent = pad(m);
        if (sEl) sEl.textContent = pad(s);
      }
      tick();
      setInterval(tick, 1000);
    }

    let appNotifications = [];
    let currentNotifFilter = 'all';

    function timeAgoNotif(timestamp) {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) return Math.floor(interval) + ' years ago';
      interval = seconds / 2592000;
      if (interval > 1) return Math.floor(interval) + ' months ago';
      interval = seconds / 86400;
      if (interval > 1) return Math.floor(interval) + ' days ago';
      interval = seconds / 3600;
      if (interval > 1) return Math.floor(interval) + ' hours ago';
      interval = seconds / 60;
      if (interval > 1) return Math.floor(interval) + ' minutes ago';
      return Math.floor(seconds) + ' seconds ago';
    }

    function renderNotifications() {
      const container = document.getElementById('notifListContainer');
      const emptyEl = document.getElementById('notifEmpty');
      if (!container) return;
      let list = [...appNotifications];
      if (currentNotifFilter === 'unread') list = list.filter(n => !n.read);
      else if (currentNotifFilter === 'orders') list = list.filter(n => n.type === 'order' || n.type === 'warning');
      else if (currentNotifFilter === 'offers') list = list.filter(n => n.type === 'offer');
      else if (currentNotifFilter === 'system') list = list.filter(n => n.type === 'system');
      list.sort((a, b) => b.timestamp - a.timestamp);
      if (list.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
      }
      container.style.display = 'block';
      if (emptyEl) emptyEl.style.display = 'none';
      const icons = {
        order: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
        offer: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15 8.5 22 9.3 17 14.1 18.5 21 12 17.5 5.5 21 7 14.1 2 9.3 9 8.5 12 2"/></svg>',
        system: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        warning: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      };
      container.innerHTML = list.map(n => `
        <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
          <div class="notif-icon ${n.type}">${icons[n.type] || icons.system}</div>
          <div class="notif-content">
            <div class="notif-header">
              <span class="notif-title">${n.title}</span>
              <span class="notif-time">${timeAgoNotif(n.timestamp)}</span>
            </div>
            <div class="notif-message">${n.message}</div>
            <span class="notif-badge ${n.type}">${n.badge}</span>
          </div>
        </div>
      `).join('');
    }

    function filterNotifs(filter, el) {
      currentNotifFilter = filter;
      document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
      if (el) el.classList.add('active');
      renderNotifications();
    }

    function markNotifRead(id) {
      const n = appNotifications.find(x => x.id === id);
      if (n && !n.read) { n.read = true; renderNotifications(); updateNotifBadge(); saveNotifs(); }
    }

    function markAllNotifsRead() {
      let changed = false;
      appNotifications.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
      if (changed) { renderNotifications(); showToast('All notifications marked as read', 'success'); updateNotifBadge(); saveNotifs(); }
      else showToast('No unread notifications', 'success');
    }

    function updateNotifBadge() {
      const unread = appNotifications.filter(n => !n.read).length;
      const badge = document.getElementById('menuNotifBadge');
      if (badge) badge.style.display = 'none';
      const notifMenuDot = document.getElementById('notifMenuItemDot');
      if (notifMenuDot) {
        notifMenuDot.style.display = unread > 0 ? 'inline-block' : 'none';
        notifMenuDot.textContent = unread > 9 ? '9+' : unread;
      }
      saveNotifs();
    }

    function saveNotifSettings() {
      const settings = {
        order: document.getElementById('nsOrder')?.checked,
        offer: document.getElementById('nsOffer')?.checked,
        system: document.getElementById('nsSystem')?.checked,
        email: document.getElementById('nsEmail')?.checked
      };
      localStorage.setItem('notifSettings', JSON.stringify(settings));
      showToast('Notification settings saved', 'success');
    }

    function loadNotifSettings() {
      const saved = localStorage.getItem('notifSettings');
      if (!saved) return;
      try {
        const s = JSON.parse(saved);
        if (document.getElementById('nsOrder')) document.getElementById('nsOrder').checked = s.order !== false;
        if (document.getElementById('nsOffer')) document.getElementById('nsOffer').checked = s.offer !== false;
        if (document.getElementById('nsSystem')) document.getElementById('nsSystem').checked = s.system !== false;
        if (document.getElementById('nsEmail')) document.getElementById('nsEmail').checked = s.email !== false;
      } catch(e) {}
    }

    async function loadOrderNotifications() {
      if (!currentUser) return;
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'orders'),
            window.firebase.orderByChild('userId'),
            window.firebase.equalTo(currentUser.uid)
          )
        );
        if (!snapshot.exists()) return;
        const ordersObj = snapshot.val();
        const userOrders = Object.values(ordersObj).sort((a, b) => b.orderDate - a.orderDate).slice(0, 5);
        const orderNotifs = userOrders.map((o, idx) => ({
          id: 1000 + idx,
          type: 'order',
          title: o.status === 'confirmed' ? 'Order Confirmed' : o.status === 'shipped' ? 'Order Shipped' : o.status === 'delivered' ? 'Order Delivered' : o.status === 'cancelled' ? 'Order Cancelled' : 'Order Update',
          message: 'Order ' + o.orderId + ' - ' + (o.productName || 'Product') + ' | ₹' + (o.totalAmount || ''),
          timestamp: o.orderDate || Date.now(),
          read: true,
          badge: 'Order Update'
        }));
        appNotifications = [...orderNotifs, ...appNotifications.filter(n => n.type !== 'order' || n.id < 1000)];
        renderNotifications();
        updateNotifBadge();
      } catch(e) { console.error(e); }
    }

    const _origShowPage = showPage;
    showPage = function(pageId) {
      _origShowPage(pageId);
      if (pageId === 'offersPage') { startOffersTimer(); loadOffersFromDB(); }
      if (pageId === 'notificationsPage') {
        loadNotifs();
        renderNotifications();
        updateNotifBadge();
        loadNotifSettings();
        if (currentUser) loadOrderNotifications();
        const _mb=document.getElementById('markAllReadBtn');
        if (_mb) _mb.onclick=markAllNotifsRead;
      }
    };

    const BzAgent = (() => {
      const MAX_RETRIES = 3;
      const retryMap = new Map();
      const PLACEHOLDER = 'https://via.placeholder.com/300x300/f3f4f6/64748b?text=No+Image';

      window.addEventListener('error', (e) => {
        if (e.target && e.target.tagName === 'IMG') {
          if (e.target.src !== PLACEHOLDER) e.target.src = PLACEHOLDER;
          return;
        }
        logError('JSError', e.message || 'Unknown', e.filename + ':' + e.lineno);
      }, true);

      window.addEventListener('unhandledrejection', (e) => {
        const msg = e.reason?.message || String(e.reason) || 'Promise rejected';
        logError('UnhandledPromise', msg, '');
        if (msg.includes('network') || msg.includes('Failed to fetch') || msg.includes('offline')) {
          scheduleFirebaseRetry();
        }
      });

      function fixBrokenBgImages() {
        document.querySelectorAll('[style*="background-image"]').forEach(el => {
          const style = el.style.backgroundImage;
          const match = style.match(/url\(['"]?(.+?)['"]?\)/);
          if (!match) return;
          const url = match[1];
          if (!url || url === 'none' || url.includes('placeholder')) return;
          const testImg = new Image();
          testImg.onerror = () => {
            el.style.backgroundImage = `url('${PLACEHOLDER}')`;
          };
          testImg.src = url;
        });
      }

      let fbRetryTimer = null;
      function scheduleFirebaseRetry() {
        if (fbRetryTimer) return;
        fbRetryTimer = setTimeout(() => {
          fbRetryTimer = null;
          try {
            if (window.firebase && window.firebase.database) {
              fetchLiveData();
            }
          } catch(e) {}
        }, 3000);
      }

      function logError(type, msg, loc) {
        try {
          if (!window.firebase?.database || !currentUser) return;
          const key = type + '_' + Date.now();
          window.firebase.set(
            window.firebase.ref(window.firebase.database, 'errorLogs/' + key),
            { type, msg, loc, uid: currentUser?.uid || 'guest', ts: Date.now() }
          ).catch(()=>{});
        } catch(e) {}
      }

      if ('PerformanceObserver' in window) {
        try {
          new PerformanceObserver((list) => {
            list.getEntries().forEach(entry => {
              if (entry.duration > 100) {
                console.warn('[BzAgent] Long task:', entry.duration.toFixed(0) + 'ms', entry.name);
              }
            });
          }).observe({ entryTypes: ['longtask'] });
        } catch(e) {}
      }

      setInterval(() => {
        fixBrokenBgImages();
        if (!products.length && window.firebase?.database) {
          fetchLiveData();
        }
      }, 60000);

      setTimeout(fixBrokenBgImages, 2000);

      return { logError, scheduleFirebaseRetry, fixBrokenBgImages };
    })();

    (function applyPerfOptimizations() {
      const origAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, fn, opts) {
        if (['scroll', 'touchstart', 'touchmove', 'wheel'].includes(type)) {
          if (opts === undefined || opts === false) opts = { passive: true };
          else if (opts === true) opts = { capture: true, passive: true };
          else if (typeof opts === 'object' && opts.passive === undefined) opts.passive = true;
        }
        origAddEventListener.call(this, type, fn, opts);
      };

      const style = document.createElement('style');
      style.textContent = `
        .banner-slide, .slider-item, .product-card, .bottom-nav-item {
          will-change: transform;
        }
        .banner-track {
          will-change: transform;
          transform: translateZ(0);
        }
        .mobile-menu, .search-panel, .modal-overlay {
          will-change: opacity, transform;
        }
        * { -webkit-font-smoothing: antialiased; text-rendering: optimizeSpeed; }
        img { image-rendering: -webkit-optimize-contrast; }
      `;
      document.head.appendChild(style);

      let scrollRAF = null;
      window.addEventListener('scroll', () => {
        if (scrollRAF) return;
        scrollRAF = requestAnimationFrame(() => {
          scrollRAF = null;
        });
      }, { passive: true });
    })();

    function openAccountPage() {
      window.location.href = '/account';
    }

    function closeAccountPage() {
      showPage('homePage');
    }

    function setupAccountRealtimeSync(uid) {
      if (!window.firebase || !window.firebase.onValue) return;
      const userRef = window.firebase.ref(window.firebase.database, 'users/' + uid);
      window.firebase.onValue(userRef, function(snapshot) {
        if (!snapshot.exists()) return;
        const data = snapshot.val();
        const headerName = document.getElementById('headerUserNameShort');
        if (headerName && data.name) {
          const short = data.name.split(' ')[0];
          headerName.textContent = short.length > 10 ? short.slice(0, 10) + '...' : short;
        }
        const avatarInitial = document.getElementById('userAvatarInitial');
        if (avatarInitial && data.name) {
          avatarInitial.textContent = data.name.charAt(0).toUpperCase();
        }
        if (data.name && typeof userInfo !== 'undefined') {
          userInfo.fullName = userInfo.fullName || data.name;
        }
      });

      const addrRef = window.firebase.ref(window.firebase.database, 'addresses');
      window.firebase.onValue(
        window.firebase.query(addrRef,
          window.firebase.orderByChild('userId'),
          window.firebase.equalTo(uid)
        ),
        function(snapshot) {
          if (!snapshot.exists()) { savedAddresses = []; return; }
          const obj = snapshot.val();
          const list = Object.keys(obj).map(k => ({ id: k, ...obj[k] }));
          savedAddresses = list.sort((a, b) =>
            (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0)
          );
          if (typeof renderSavedAddresses === 'function') {
            const section = document.getElementById('savedAddressesSection');
            if (section) {
              section.style.display = savedAddresses.length > 0 ? 'block' : 'none';
              renderSavedAddresses();
              const def = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
              if (def && typeof fillAddressForm === 'function') fillAddressForm(def);
            }
          }
        }
      );
    }

    window.addEventListener('storage', function(e) {
      if (!currentUser) return;
      if (e.key === 'bz_profile_updated' && e.newValue) {
        try {
          const d = JSON.parse(e.newValue);
          if (d.name) {
            const headerName = document.getElementById('headerUserNameShort');
            if (headerName) {
              const short = d.name.split(' ')[0];
              headerName.textContent = short.length > 10 ? short.slice(0, 10) + '...' : short;
            }
            const avatarInit = document.getElementById('userAvatarInitial');
            if (avatarInit) avatarInit.textContent = d.name.charAt(0).toUpperCase();
          }
        } catch(e2) {}
      }
      if (e.key === 'bz_address_updated') {
        loadSavedAddresses();
      }
    });

    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible' && currentUser) {
        loadSavedAddresses();
        loadUserData(currentUser);
      }
    });/**
 * ============================================================
 *  BUYZO CART — main-patch.js
 *  INTEGRATION: Append this file's contents to the end of main.js
 *  OR include it as a separate <script src="main-patch.js"></script>
 *  AFTER main.js in your HTML.
 * ============================================================
 *
 *  Includes:
 *  1. Admin Notification Banner — shows Firebase adminNotifications as
 *     a real-time dismissible banner on the user-facing website.
 *  2. Enhanced Search Results — shows product category badges in grid.
 *  3. Address Auto-fill in Checkout — fills saved address into order form.
 *  4. Sell Product Menu Entry — injects "Sell Product" nav link.
 *  5. Hero Section — reads adminSettings.heroHeading etc. from Firebase.
 * ============================================================
 */

/* ──────────────────────────────────────────────
   1. ADMIN NOTIFICATION BANNER SYSTEM
   Reads from Firebase `adminNotifications` and
   shows a dismissible top banner in real-time.
   ────────────────────────────────────────────── */
(function initAdminNotifBanner() {
  // Inject styles once
  const style = document.createElement('style');
  style.textContent = `
    #bzAdminNotifBanner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 99999;
      transform: translateY(-100%);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: none;
    }
    #bzAdminNotifBanner.visible {
      transform: translateY(0);
      pointer-events: all;
    }
    .bz-notif-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      gap: 12px;
      min-height: 48px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    }
    .bz-notif-bar.info    { background: #1d4ed8; color: #fff; }
    .bz-notif-bar.offer   { background: linear-gradient(90deg,#7c3aed,#db2777); color: #fff; }
    .bz-notif-bar.order   { background: #16a34a; color: #fff; }
    .bz-notif-bar.warning { background: #d97706; color: #fff; }
    .bz-notif-bar.system  { background: #0f172a; color: #f1f5f9; }
    .bz-notif-text {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
    }
    .bz-notif-badge {
      flex-shrink: 0;
      background: rgba(255,255,255,0.2);
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bz-notif-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bz-notif-msg   { opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
    .bz-notif-dismiss {
      flex-shrink: 0;
      background: rgba(255,255,255,0.2);
      border: none;
      color: inherit;
      width: 28px; height: 28px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    .bz-notif-dismiss:hover { background: rgba(255,255,255,0.35); }
  `;
  document.head.appendChild(style);

  // Create banner DOM
  const banner = document.createElement('div');
  banner.id = 'bzAdminNotifBanner';
  banner.innerHTML = `<div class="bz-notif-bar info" id="bzNotifBar">
    <div class="bz-notif-text">
      <span class="bz-notif-badge" id="bzNotifBadge">Info</span>
      <span class="bz-notif-title" id="bzNotifTitle"></span>
      <span class="bz-notif-msg" id="bzNotifMsg"></span>
    </div>
    <button class="bz-notif-dismiss" id="bzNotifDismiss" title="Dismiss">×</button>
  </div>`;
  document.body.prepend(banner);

  let dismissTimer = null;
  let lastShownId = localStorage.getItem('bz_last_notif_id') || null;

  document.getElementById('bzNotifDismiss').addEventListener('click', hideBanner);

  function showBanner(notif) {
    const bar   = document.getElementById('bzNotifBar');
    const badge = document.getElementById('bzNotifBadge');
    const title = document.getElementById('bzNotifTitle');
    const msg   = document.getElementById('bzNotifMsg');

    // Set type class
    bar.className = 'bz-notif-bar ' + (notif.type || 'info');
    badge.textContent = notif.badge || 'Notice';
    title.textContent = notif.title || '';
    msg.textContent   = notif.message || '';

    banner.classList.add('visible');

    // Auto-dismiss after 8 seconds
    clearTimeout(dismissTimer);
    dismissTimer = setTimeout(hideBanner, 8000);
  }

  function hideBanner() {
    banner.classList.remove('visible');
    clearTimeout(dismissTimer);
  }

  // Connect to Firebase once it's available
  function connectToFirebase() {
    const firebase = window.firebase;
    if (!firebase || !firebase.database) {
      setTimeout(connectToFirebase, 1000);
      return;
    }
    const db = firebase.database();

    // Listen for new notifications in real-time
    db.ref('adminNotifications').orderByChild('timestamp').limitToLast(5).on('value', snap => {
      if (!snap.exists()) return;

      let newest = null;
      snap.forEach(child => {
        const n = child.val();
        if (!newest || (n.timestamp || 0) > (newest.timestamp || 0)) {
          newest = { id: child.key, ...n };
        }
      });

      if (newest && newest.id !== lastShownId) {
        lastShownId = newest.id;
        localStorage.setItem('bz_last_notif_id', newest.id);
        showBanner(newest);

        // Also push to internal notification list if available
        if (typeof addNotif === 'function') {
          addNotif({
            type: newest.type || 'system',
            title: newest.title,
            message: newest.message,
            badge: newest.badge || 'Admin'
          });
        }
      }
    });
  }

  // Start connection attempt after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectToFirebase);
  } else {
    setTimeout(connectToFirebase, 500);
  }
})();


/* ──────────────────────────────────────────────
   2. ENHANCED SEARCH RESULTS WITH CATEGORY BADGE
   Replaces the renderSearchResults() function to
   show category labels under each product card.
   ────────────────────────────────────────────── */
(function patchSearchResults() {
  // Inject extra styles for search category badges
  const style = document.createElement('style');
  style.textContent = `
    .product-card .pc-category-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      color: var(--accent, #2563eb);
      background: rgba(37,99,235,0.08);
      padding: 2px 7px;
      border-radius: 20px;
      margin-bottom: 4px;
      text-transform: capitalize;
    }
    .search-result-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .search-category-tag {
      font-size: 11px;
      font-weight: 600;
      color: #2563eb;
      background: #eff6ff;
      padding: 2px 8px;
      border-radius: 12px;
      text-transform: capitalize;
    }
    .search-condition-tag {
      font-size: 11px;
      font-weight: 500;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 7px;
      border-radius: 12px;
    }
    /* Highlighted match text */
    .search-match { background: #fef08a; border-radius: 2px; }
  `;
  document.head.appendChild(style);

  /**
   * Override renderSearchResults to show category info.
   * This wraps the existing function safely.
   */
  const _originalRender = window.renderSearchResults;

  window.renderSearchResults = function(results, query) {
    const grid = document.getElementById('searchResultsGrid');
    const countEl = document.getElementById('searchResultsCount');
    const noResults = document.getElementById('noSearchResultsMessage');
    if (!grid) {
      if (typeof _originalRender === 'function') _originalRender(results, query);
      return;
    }

    grid.innerHTML = '';

    if (!results || results.length === 0) {
      if (noResults) noResults.style.display = 'block';
      if (countEl) countEl.textContent = 'No products found';
      return;
    }

    if (noResults) noResults.style.display = 'none';
    if (countEl) countEl.textContent = `${results.length} product${results.length !== 1 ? 's' : ''} found for "${query}"`;

    results.forEach(product => {
      // Use the existing createProductCard if available
      let card;
      if (typeof createProductCard === 'function') {
        card = createProductCard(product);
      } else {
        card = document.createElement('div');
        card.className = 'product-card';
        card.textContent = product.name || 'Product';
      }

      // Inject category badge into card body
      const cardBody = card.querySelector('.product-card-body') || card;
      const titleEl  = card.querySelector('.product-card-title');

      // Find category name
      let catName = '';
      if (typeof categories !== 'undefined' && Array.isArray(categories)) {
        const catObj = categories.find(c =>
          c.id === product.category || c.name === product.category
        );
        catName = catObj?.name || product.category || '';
      } else {
        catName = product.category || '';
      }

      if (catName) {
        const metaRow = document.createElement('div');
        metaRow.className = 'search-result-meta';
        metaRow.innerHTML = `<span class="search-category-tag">🏷️ ${catName}</span>`;
        if (product.condition && product.condition !== 'new') {
          metaRow.innerHTML += `<span class="search-condition-tag">${product.condition}</span>`;
        }
        // Insert before title
        if (titleEl) {
          cardBody.insertBefore(metaRow, titleEl);
        } else {
          cardBody.appendChild(metaRow);
        }
      }

      grid.appendChild(card);
    });
  };
})();


/* ──────────────────────────────────────────────
   3. ADDRESS AUTO-FILL IN CHECKOUT
   When opening checkout/order page, automatically
   fills the form with the user's default address
   from localStorage / Firebase.
   ────────────────────────────────────────────── */
(function initCheckoutAddressFill() {
  /**
   * Key: address fields in checkout form → address object keys
   * Adjust IDs to match your actual checkout form field IDs.
   */
  const FIELD_MAP = {
    // Checkout form ID : Address object key
    'fullName'      : 'name',
    'userName'      : 'name',
    'userFullName'  : 'name',
    'checkoutName'  : 'name',
    'mobileNumber'  : 'mobile',
    'userMobile'    : 'mobile',
    'checkoutMobile': 'mobile',
    'pincode'       : 'pincode',
    'userPincode'   : 'pincode',
    'cityName'      : 'city',
    'userCity'      : 'city',
    'checkoutCity'  : 'city',
    'stateName'     : 'state',
    'userState'     : 'state',
    'checkoutState' : 'state',
    'streetAddress' : 'street',
    'userAddress'   : 'street',
    'addressLine'   : 'street',
    'checkoutAddr'  : 'street',
    // Common patterns in forms
    'name'          : 'name',
    'mobile'        : 'mobile',
    'phone'         : 'mobile',
    'city'          : 'city',
    'state'         : 'state',
    'address'       : 'street',
    'street'        : 'street',
  };

  /**
   * Fill checkout form fields with address data.
   * @param {Object} address — saved address object
   */
  window.fillAddressForm = function(address) {
    if (!address) return;
    Object.entries(FIELD_MAP).forEach(([fieldId, key]) => {
      const el = document.getElementById(fieldId);
      if (el && address[key]) el.value = address[key];
    });
  };

  /**
   * Load the default (or first) saved address for current user
   * and fill the checkout form.
   */
  window.loadAndFillDefaultAddress = function() {
    // Try from global savedAddresses first (populated by main.js)
    if (typeof savedAddresses !== 'undefined' && savedAddresses.length > 0) {
      const def = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      fillAddressForm(def);
      renderSavedAddressesInCheckout(savedAddresses);
      return;
    }

    // Fallback: load directly from Firebase
    const firebase = window.firebase;
    const user = typeof currentUser !== 'undefined' ? currentUser : null;
    if (!firebase || !user) return;

    firebase.database()
      .ref('addresses')
      .orderByChild('userId')
      .equalTo(user.uid)
      .get()
      .then(snap => {
        if (!snap.exists()) return;
        const list = [];
        snap.forEach(child => list.push({ id: child.key, ...child.val() }));
        list.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
        if (list.length > 0) {
          const def = list.find(a => a.isDefault) || list[0];
          fillAddressForm(def);
          renderSavedAddressesInCheckout(list);
        }
      })
      .catch(() => {});
  };

  /**
   * Render saved address selector inside checkout page.
   * Injects a select-an-address panel above the form.
   */
  function renderSavedAddressesInCheckout(addresses) {
    // Find the checkout form container
    const containers = [
      document.getElementById('checkoutFormContainer'),
      document.getElementById('addressFormContainer'),
      document.getElementById('userInfoForm'),
      document.querySelector('.checkout-form'),
      document.querySelector('#userPage form'),
      document.querySelector('#orderPage .address-section'),
    ].filter(Boolean);

    if (containers.length === 0) return;
    const container = containers[0];

    // Remove existing panel if already injected
    const existing = document.getElementById('bzSavedAddressPanel');
    if (existing) existing.remove();

    if (addresses.length === 0) return;

    const panel = document.createElement('div');
    panel.id = 'bzSavedAddressPanel';
    panel.style.cssText = `
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 16px;
      font-family: inherit;
    `;

    panel.innerHTML = `
      <div style="font-size:13px;font-weight:600;color:#1d4ed8;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
        <span>📍</span> Saved Addresses
      </div>
      <div id="bzAddrList" style="display:flex;flex-direction:column;gap:8px;"></div>
    `;

    const listEl = panel.querySelector('#bzAddrList');
    addresses.forEach(addr => {
      const row = document.createElement('label');
      row.style.cssText = `
        display:flex;align-items:flex-start;gap:10px;
        padding:10px;border-radius:8px;cursor:pointer;
        border:2px solid ${addr.isDefault ? '#2563eb' : '#e2e8f0'};
        background:${addr.isDefault ? '#fff' : 'transparent'};
        transition:all 0.15s;font-size:13px;
      `;
      row.innerHTML = `
        <input type="radio" name="bzAddrSelect" value="${addr.id}"
          ${addr.isDefault ? 'checked' : ''}
          style="margin-top:2px;accent-color:#2563eb;">
        <div>
          <div style="font-weight:600;">${addr.name} &nbsp;<span style="font-size:11px;color:#64748b;font-weight:400;">${addr.type || 'home'}</span></div>
          <div style="color:#475569;margin-top:2px;">${addr.street}, ${addr.city}, ${addr.state} - ${addr.pincode}</div>
          <div style="color:#64748b;margin-top:1px;">📞 ${addr.mobile}</div>
        </div>
      `;
      row.querySelector('input').addEventListener('change', () => {
        fillAddressForm(addr);
        // Update border styles
        listEl.querySelectorAll('label').forEach(l => {
          l.style.borderColor = '#e2e8f0';
          l.style.background = 'transparent';
        });
        row.style.borderColor = '#2563eb';
        row.style.background = '#fff';
      });
      listEl.appendChild(row);
    });

    container.prepend(panel);
  }

  // Auto-trigger when checkout/order/userPage becomes visible
  const _origShowPage = window.showPage;
  if (typeof _origShowPage === 'function') {
    window.showPage = function(pageId) {
      _origShowPage.call(this, pageId);
      const checkoutPages = ['userPage', 'orderPage', 'checkoutPage', 'paymentPage'];
      if (checkoutPages.includes(pageId) && typeof currentUser !== 'undefined' && currentUser) {
        setTimeout(loadAndFillDefaultAddress, 200);
      }
    };
  }

  // Also fill when user logs in and is on a checkout page
  const origSetupAccount = window.setupAccountRealtimeSync;
  if (typeof origSetupAccount === 'function') {
    window.setupAccountRealtimeSync = function(uid) {
      origSetupAccount.call(this, uid);
      setTimeout(() => {
        const activePage = document.querySelector('.page.active')?.id || '';
        if (['userPage','orderPage','checkoutPage'].includes(activePage)) {
          loadAndFillDefaultAddress();
        }
      }, 800);
    };
  }
})();


/* ──────────────────────────────────────────────
   4. SELL PRODUCT — CLICK FIX + BOTTOM NAV REMOVE
   Fixes sidebar menu click not working.
   Also removes any injected bottom-nav Sell item.
   ────────────────────────────────────────────── */
(function fixSellProductNav() {
  function applyFix() {

    // ── 1. REMOVE bottom nav injected Sell item ──────────────────
    // Remove any previously injected sell items from bottom nav
    document.querySelectorAll('[data-sell-link]').forEach(el => el.remove());

    // Also find and remove any bottom-nav-item that says "Sell"
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      const txt = item.textContent || '';
      if (txt.toLowerCase().includes('sell')) item.remove();
    });

    // ── 2. FIX sidebar/hamburger menu Sell Product click ─────────
    // Find ALL elements in the page that mention "Sell Product"
    // and make sure clicking them navigates correctly
    const allLinks = document.querySelectorAll('a, li, div, button, span');
    allLinks.forEach(el => {
      const txt = (el.textContent || '').trim().toLowerCase();
      // Only target exact "sell product" text nodes in nav/menu areas
      if (txt === 'sell product' || txt === '🏪 sell product' || txt === 'sell') {
        // Check it's inside a nav/menu container
        const inMenu = el.closest('#mobileMenu, #sideMenu, .sidebar-menu, .mobile-menu, nav, .menu-list, [class*="menu"], [class*="sidebar"]');
        if (!inMenu) return;

        // Remove any existing broken handlers by cloning
        const fresh = el.cloneNode(true);
        el.parentNode.replaceChild(fresh, el);

        // If it's an <a> tag, fix the href
        if (fresh.tagName === 'A') {
          fresh.href = '/sell-product';
          fresh.removeAttribute('onclick');
          fresh.addEventListener('click', function(e) {
            e.stopPropagation();
            // Close sidebar first if open
            document.querySelector('.sidebar.active, #sideMenu.active, #mobileMenu.active, .mobile-menu.active, [class*="sidebar"].active')?.classList.remove('active');
            document.querySelector('.sidebar-overlay.active, .overlay.active')?.classList.remove('active');
            setTimeout(() => { window.location.href = '/sell-product'; }, 80);
          });
        } else {
          // For li/div/button — override onclick
          fresh.style.cursor = 'pointer';
          fresh.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            document.querySelector('.sidebar.active, #sideMenu.active, #mobileMenu.active, .mobile-menu.active, [class*="sidebar"].active')?.classList.remove('active');
            document.querySelector('.sidebar-overlay.active, .overlay.active')?.classList.remove('active');
            setTimeout(() => { window.location.href = '/sell-product'; }, 80);
          });
        }
      }
    });
  }

  // Run on DOM ready and after a small delay (for dynamically rendered menus)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyFix();
      setTimeout(applyFix, 800);
      setTimeout(applyFix, 2000);
    });
  } else {
    applyFix();
    setTimeout(applyFix, 800);
    setTimeout(applyFix, 2000);
  }
})();


/* ──────────────────────────────────────────────
   5. HERO SECTION — READ FROM FIREBASE
   Admin panel writes to adminSettings.hero*.
   This reads those values and updates the hero.
   ────────────────────────────────────────────── */
(function initHeroSync() {
  function applyHeroSettings(settings) {
    if (!settings) return;

    // Heading
    const headings = [
      document.getElementById('heroHeading'),
      document.querySelector('.hero-heading'),
      document.querySelector('.hero h1'),
      document.querySelector('.hero-title'),
    ].filter(Boolean);
    if (settings.heroHeading) {
      headings.forEach(el => { el.innerHTML = settings.heroHeading; });
    }

    // Subheading
    const subheadings = [
      document.getElementById('heroSubheading'),
      document.querySelector('.hero-subheading'),
      document.querySelector('.hero p'),
      document.querySelector('.hero-subtitle'),
    ].filter(Boolean);
    if (settings.heroSubheading) {
      subheadings.forEach(el => { el.textContent = settings.heroSubheading; });
    }

    // Hero background image
    const heroBg = document.getElementById('heroSection') || document.querySelector('.hero-section');
    if (heroBg && settings.heroBgImage) {
      heroBg.style.backgroundImage = `url('${settings.heroBgImage}')`;
    }

    // Rating display
    if (settings.heroRating) {
      const ratingEls = document.querySelectorAll('.hero-rating, #heroRating');
      ratingEls.forEach(el => { el.textContent = settings.heroRating; });
    }

    // CTA Button text
    if (settings.heroCtaText) {
      const ctaBtns = document.querySelectorAll('.hero-cta, #heroCta');
      ctaBtns.forEach(el => { el.textContent = settings.heroCtaText; });
    }

    // Scrolling messages ticker
    if (settings.heroMessages && Array.isArray(settings.heroMessages)) {
      const ticker = document.getElementById('heroTicker') || document.querySelector('.hero-ticker');
      if (ticker && settings.heroMessages.length > 0) {
        ticker.textContent = settings.heroMessages[0];
        let idx = 0;
        setInterval(() => {
          idx = (idx + 1) % settings.heroMessages.length;
          ticker.style.opacity = '0';
          setTimeout(() => {
            ticker.textContent = settings.heroMessages[idx];
            ticker.style.opacity = '1';
          }, 300);
        }, 3000);
      }
    }
  }

  function connectFirebaseForHero() {
    const firebase = window.firebase;
    if (!firebase || !firebase.database) { setTimeout(connectFirebaseForHero, 1000); return; }

    // Listen for admin settings changes
    firebase.database().ref('adminSettings').on('value', snap => {
      if (snap.exists()) applyHeroSettings(snap.val());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectFirebaseForHero);
  } else {
    setTimeout(connectFirebaseForHero, 500);
  }
})();


/* ──────────────────────────────────────────────
   6. ADDRESS SAVE-ON-ORDER COMPLETION
   After order is placed, automatically saves
   the entered address to localStorage / Firebase.
   Patch: wrap the existing placeOrder / submitOrder.
   ────────────────────────────────────────────── */
(function patchOrderAddressSave() {
  /**
   * Call this after successful order placement.
   * Reads from checkout form and saves address.
   */
  window.bzSaveAddressAfterOrder = function(uid) {
    // Read from form
    const fields = {
      name:    document.getElementById('fullName')?.value || document.getElementById('userName')?.value || document.getElementById('name')?.value || '',
      mobile:  document.getElementById('mobileNumber')?.value || document.getElementById('mobile')?.value || document.getElementById('phone')?.value || '',
      street:  document.getElementById('streetAddress')?.value || document.getElementById('address')?.value || document.getElementById('street')?.value || '',
      city:    document.getElementById('cityName')?.value || document.getElementById('city')?.value || '',
      state:   document.getElementById('stateName')?.value || document.getElementById('state')?.value || '',
      pincode: document.getElementById('pincode')?.value || document.getElementById('postalCode')?.value || '',
      type:    'home',
      isDefault: true,
      updatedAt: Date.now(),
    };

    // Validate — at least name + street
    if (!fields.name || !fields.street) return;

    // Save to Firebase if user is logged in
    const firebase = window.firebase;
    if (firebase && uid) {
      // Check for duplicates
      firebase.database()
        .ref('addresses')
        .orderByChild('userId')
        .equalTo(uid)
        .get()
        .then(snap => {
          let isDuplicate = false;
          snap.forEach(child => {
            const a = child.val();
            if (a.street === fields.street && a.pincode === fields.pincode) {
              isDuplicate = true;
              // Make this the default
              firebase.database().ref('addresses/' + child.key).update({ isDefault: true });
            } else {
              firebase.database().ref('addresses/' + child.key).update({ isDefault: false });
            }
          });
          if (!isDuplicate) {
            fields.userId = uid;
            firebase.database().ref('addresses').push(fields).then(() => {
              localStorage.setItem('bz_address_updated', Date.now().toString());
            });
          }
        })
        .catch(() => {
          // Fallback: save to localStorage
          const saved = JSON.parse(localStorage.getItem('bz_addresses') || '[]');
          const isDup = saved.some(a => a.street === fields.street && a.pincode === fields.pincode);
          if (!isDup) {
            saved.unshift(fields);
            localStorage.setItem('bz_addresses', JSON.stringify(saved.slice(0, 10)));
            localStorage.setItem('bz_address_updated', Date.now().toString());
          }
        });
    } else {
      // Guest: save to localStorage only
      const saved = JSON.parse(localStorage.getItem('bz_addresses') || '[]');
      const isDup = saved.some(a => a.street === fields.street && a.pincode === fields.pincode);
      if (!isDup) {
        saved.unshift(fields);
        localStorage.setItem('bz_addresses', JSON.stringify(saved.slice(0, 10)));
        localStorage.setItem('bz_address_updated', Date.now().toString());
      }
    }
  };

  // Observe placeOrder function to inject address save
  // Try to wrap common function names
  const fnNames = ['placeOrder', 'submitOrder', 'handleOrderSubmit', 'confirmOrder'];
  fnNames.forEach(fnName => {
    if (typeof window[fnName] === 'function') {
      const orig = window[fnName];
      window[fnName] = function(...args) {
        const result = orig.apply(this, args);
        // Save address after order
        const uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : null;
        if (result && typeof result.then === 'function') {
          result.then(() => bzSaveAddressAfterOrder(uid)).catch(() => {});
        } else {
          setTimeout(() => bzSaveAddressAfterOrder(uid), 500);
        }
        return result;
      };
    }


    // ══════════════════════════════════════
    //  BRANDS PAGE SYSTEM
    // ══════════════════════════════════════
    // ================================================================
    //  BRAND SYSTEM — Complete Fixed Version
    // ================================================================
    var _siteBrandsAll = [];

    function _brandColor(name) {
      var cs = ['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];
      return cs[(name || 'A').charCodeAt(0) % cs.length];
    }

    function _brandScore(b) {
      return (b.followers || b.followersCount || 0)
           + ((b.rating || 0) * 100)
           + ((b.products ? b.products.length : 0) * 10);
    }

    // ── Brands Page Loader ──
    function loadBrandsPage() {
      // Show spinner, hide sections
      var sp = document.getElementById('brandsLoadingSpinner');
      if (sp) sp.style.display = 'block';
      ['popularBrandsSection','suggestedBrandsSection','otherBrandsSection',
       'followingBrandsSection','brandsEmptyState'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });

      // Re-render from cache
      if (_siteBrandsAll.length) {
        if (sp) sp.style.display = 'none';
        _renderBrands(_siteBrandsAll);
        return;
      }

      var _fb3 = window.firebase;
      Promise.all([
        _fb3.get(_fb3.ref(_fb3.database, 'products')),
        _fb3.get(_fb3.ref(_fb3.database, 'brands')),
        currentUser ? _fb3.get(_fb3.ref(_fb3.database, 'brandFollowers')) : Promise.resolve(null)
      ]).then(function(res) {
        var prodSnap  = res[0];
        var brandSnap = res[1];
        var followSnap = res[2];
        var brandMap  = {};

        // Admin-approved brands first
        if (brandSnap && brandSnap.exists()) {
          brandSnap.forEach(function(c) {
            var b = c.val();
            if (b && b.name) {
              brandMap[c.key] = {
                id: c.key, name: b.name,
                logo: b.logo || '', description: b.description || '',
                blueTickAdmin: !!b.blueTickAdmin,
                verificationLevel: b.verificationLevel || 'normal',
                followers: b.followersCount || b.followers || 0,
                rating: b.rating || 0, products: []
              };
            }
          });
        }

        // Attach products
        if (prodSnap && prodSnap.exists()) {
          prodSnap.forEach(function(c) {
            var p = c.val();
            if (!p || !p.brand) return;
            var bid = p.brandId || (p.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
            if (!brandMap[bid]) {
              brandMap[bid] = {
                id: bid, name: p.brandName || p.brand,
                logo: p.brandLogo || '', description: '',
                blueTickAdmin: false, verificationLevel: 'normal',
                followers: 0, rating: 0, products: []
              };
            }
            brandMap[bid].products.push(c.key);
          });
        }

        // Build followed set
        var followedSet = {};
        if (followSnap && followSnap.exists() && currentUser) {
          followSnap.forEach(function(c) {
            if (c.val() && c.val()[currentUser.uid]) followedSet[c.key] = true;
          });
        }

        _siteBrandsAll = Object.values(brandMap)
          .filter(function(b) { return b.products.length > 0 || b.blueTickAdmin; });
        _siteBrandsAll.sort(function(a, b) { return _brandScore(b) - _brandScore(a); });
        _siteBrandsAll._followedSet = followedSet;

        if (sp) sp.style.display = 'none';
        _renderBrands(_siteBrandsAll, followedSet);
      }).catch(function(err) {
        console.error('Brand load error:', err);
        if (sp) {
          sp.innerHTML = '<p style="color:#ef4444;font-size:13px;padding:20px;">Failed to load brands.<br><button onclick="loadBrandsPage()" style="margin-top:8px;padding:6px 16px;border-radius:20px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-weight:700;">Retry</button></p>';
        }
      });
    }

    // ── Filter handler (called by oninput) ──
    function filterSiteBrands() {
      var inp = document.getElementById('brandSearchSite');
      var q = inp ? inp.value.toLowerCase().trim() : '';
      if (!q) { _renderBrands(_siteBrandsAll, _siteBrandsAll._followedSet); return; }
      var filtered = _siteBrandsAll.filter(function(b) {
        return b.name.toLowerCase().indexOf(q) !== -1 || (b.description||'').toLowerCase().indexOf(q) !== -1;
      });
      _renderBrands(filtered, _siteBrandsAll._followedSet);
    }

    // ── Build a brand card DOM element ──
    function _makeBrandCard(b, isFollowing) {
      var color = _brandColor(b.name);
      var initials = b.name.slice(0, 2).toUpperCase();

      var _bzBlueTick = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;margin-left:2px;" aria-label="Verified"><path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/><polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      var badge = b.verificationLevel === 'premium'
        ? '<span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:800;white-space:nowrap;">⭐ Premium</span>'
        : b.blueTickAdmin
          ? _bzBlueTick
          : '';

      var logoInner = b.logo
        ? '<img src="' + b.logo + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display=\'none\'">'
        : '<span style="font-size:17px;font-weight:800;color:#fff;">' + initials + '</span>';

      var followBtn = currentUser
        ? '<button onclick="event.stopPropagation();window.toggleBrandFollow(\'' + b.id + '\',\'' + b.name.replace(/'/g, '').replace(/"/g, '') + '\',this)" style="margin-top:8px;width:100%;padding:6px 0;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;'
          + (isFollowing ? 'background:#f1f5f9;color:#64748b;' : 'background:#2563eb;color:#fff;') + '">'
          + (isFollowing ? '✓ Following' : '+ Follow') + '</button>'
        : '';

      var el = document.createElement('div');
      el.style.cssText = 'background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:12px;cursor:pointer;transition:border-color .18s,box-shadow .18s;';
      el.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">'
          + '<div style="width:42px;height:42px;border-radius:10px;background:' + color + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">' + logoInner + '</div>'
          + '<div style="flex:1;min-width:0;">'
            + '<div style="font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + b.name + '</div>'
            + (badge ? '<div style="margin-top:2px;">' + badge + '</div>' : '')
          + '</div>'
        + '</div>'
        + '<div style="font-size:11px;color:#64748b;display:flex;gap:8px;flex-wrap:wrap;">'
          + '<span>📦 ' + (b.products ? b.products.length : 0) + '</span>'
          + (b.followers ? '<span>❤️ ' + b.followers + '</span>' : '')
          + (b.rating ? '<span>⭐ ' + b.rating + '</span>' : '')
        + '</div>'
        + followBtn;

      el.addEventListener('mouseenter', function() { this.style.borderColor = '#2563eb'; this.style.boxShadow = '0 4px 16px rgba(37,99,235,.12)'; });
      el.addEventListener('mouseleave', function() { this.style.borderColor = '#e2e8f0'; this.style.boxShadow = 'none'; });
      el.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        window.showBrandProfile(b.id, b.name);
      });
      return el;
    }

    // ── Render all brand sections ──
    function _renderBrands(brands, followedSet) {
      followedSet = followedSet || {};
      var popularGrid  = document.getElementById('popularBrandsGrid');
      var sugGrid      = document.getElementById('suggestedBrandsGrid');
      var otherGrid    = document.getElementById('otherBrandsGrid');
      var followingRow = document.getElementById('followingBrandsRow');
      var emptyEl      = document.getElementById('brandsEmptyState');
      var popSection   = document.getElementById('popularBrandsSection');
      var sugSection   = document.getElementById('suggestedBrandsSection');
      var othSection   = document.getElementById('otherBrandsSection');
      var followingSec = document.getElementById('followingBrandsSection');

      if (!brands.length) {
        if (emptyEl) emptyEl.style.display = 'block';
        [popSection, sugSection, othSection, followingSec].forEach(function(s){ if (s) s.style.display = 'none'; });
        return;
      }
      if (emptyEl) emptyEl.style.display = 'none';

      // ── Following strip ──
      var followed = brands.filter(function(b) { return !!followedSet[b.id]; });
      if (followed.length && followingSec && followingRow) {
        followingSec.style.display = 'block';
        followingRow.innerHTML = followed.map(function(b) {
          var color = _brandColor(b.name);
          var initials = b.name.slice(0, 2).toUpperCase();
          var logo = b.logo
            ? '<img src="' + b.logo + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display=\'none\'">'
            : '<div style="width:52px;height:52px;border-radius:10px;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;">' + initials + '</div>';
          return '<div onclick="window.showBrandProfile(\'' + b.id + '\',\'' + b.name.replace(/'/g, '') + '\')" style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;">'
            + '<div style="width:52px;height:52px;border-radius:10px;border:2px solid #2563eb;overflow:hidden;">' + logo + '</div>'
            + '<span style="font-size:10px;font-weight:700;max-width:60px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + b.name + '</span>'
            + '</div>';
        }).join('');
      } else if (followingSec) {
        followingSec.style.display = 'none';
      }

      // ── Popular (verified or high score) ──
      var popular  = brands.filter(function(b) { return b.blueTickAdmin || b.verificationLevel === 'premium' || _brandScore(b) > 50; });
      var nonPop   = brands.filter(function(b) { return !b.blueTickAdmin && b.verificationLevel !== 'premium' && _brandScore(b) <= 50; });

      // ── Suggested (top unverified not followed) ──
      var suggested = nonPop.filter(function(b) { return !followedSet[b.id]; }).slice(0, 4);
      var rest      = nonPop.filter(function(b) { return !suggested.includes(b); });

      if (popSection && popularGrid) {
        popSection.style.display = popular.length ? 'block' : 'none';
        popularGrid.innerHTML = '';
        popular.forEach(function(b) { popularGrid.appendChild(_makeBrandCard(b, !!followedSet[b.id])); });
      }

      if (sugSection && sugGrid) {
        sugSection.style.display = suggested.length ? 'block' : 'none';
        sugGrid.innerHTML = '';
        suggested.forEach(function(b) { sugGrid.appendChild(_makeBrandCard(b, !!followedSet[b.id])); });
      }

      if (othSection && otherGrid) {
        othSection.style.display = rest.length ? 'block' : 'none';
        otherGrid.innerHTML = '';
        rest.forEach(function(b) { otherGrid.appendChild(_makeBrandCard(b, !!followedSet[b.id])); });
      }
    }

    // ── Legacy alias ──
    function renderSiteBrands(brands) { _renderBrands(brands); }

    // ── Show products filtered by brand ──
    function showBrandProducts(brandId, brandName) {
      var branded = products.filter(function(p) {
        var bid = p.brandId || (p.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        return bid === brandId || (p.brand || '').toLowerCase() === (brandName || '').toLowerCase();
      });
      window.currentCategoryFilter = null;
      showPage('productsPage');
      renderProducts(branded.length ? branded : products, 'productGrid');
    }

    // ══════════════════════════════════════
    //  BRAND PROFILE PAGE
    // ══════════════════════════════════════
    window._currentBrandId = null;

    function showBrandProfile(brandId, brandName) {
      window._currentBrandId = brandId;
      var main = document.querySelector('main') || document.body;
      var page = document.getElementById('brandProfilePage');
      if (!page) {
        page = document.createElement('section');
        page.id = 'brandProfilePage';
        page.className = 'page';
        page.style.cssText = 'min-height:100vh;background:#f8fafc;padding-bottom:80px;';
        main.appendChild(page);
      }

      // Instant loading state — page visible immediately
      page.innerHTML =
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:14px;">'
          + '<div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite;"></div>'
          + '<p style="color:#94a3b8;font-size:13px;font-weight:600;">Loading brand...</p>'
        + '</div>';
      showPage('brandProfilePage');
      window.scrollTo(0, 0);

      var _fb = window.firebase;
      Promise.all([
        _fb.get(_fb.ref(_fb.database, 'brands/' + brandId)),
        _fb.get(_fb.ref(_fb.database, 'brandFollowers/' + brandId))
      ]).then(function(res) {
        var bd         = res[0].exists() ? res[0].val() : {};
        var followSnap = res[1];
        var name       = bd.name || brandName;
        var isVerified = !!bd.blueTickAdmin;
        var level      = bd.verificationLevel || 'normal';
        var desc       = bd.description || '';
        var logo       = bd.logo || '';
        var color      = _brandColor(name);
        var initials   = name.slice(0, 2).toUpperCase();

        var followers = 0;
        if (followSnap.exists() && followSnap.val()) {
          followers = Object.keys(followSnap.val()).filter(function(k) { return !!followSnap.val()[k]; }).length;
        }
        var isFollowing = !!(currentUser && followSnap.exists() && followSnap.val() && followSnap.val()[currentUser.uid]);

        var brandProds = products.filter(function(p) {
          var bid = p.brandId || (p.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
          return bid === brandId || (p.brand || '').toLowerCase() === name.toLowerCase();
        });

        var _bzBlueTick2 = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;margin-left:2px;" aria-label="Verified"><path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/><polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        var verBadgeInline = level === 'premium'
          ? '<span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:1px 8px;border-radius:12px;font-size:11px;font-weight:800;"> ⭐ Premium</span>'
          : isVerified
            ? _bzBlueTick2
            : '';

        var logoHtml = logo
          ? '<img src="' + logo + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">'
          : '<span style="font-size:26px;font-weight:800;color:#fff;">' + initials + '</span>';

        var safeName = name.replace(/'/g, '').replace(/"/g, '');
        var followBtnHtml = currentUser
          ? '<button id="brandFollowBtn" onclick="window.toggleBrandFollow(\'' + brandId + '\',\'' + safeName + '\',this)" style="padding:10px 28px;border-radius:50px;border:none;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;'
              + (isFollowing ? 'background:#f1f5f9;color:#64748b;' : 'background:#2563eb;color:#fff;') + '">'
              + (isFollowing ? '✓ Following' : '+ Follow')
            + '</button>'
            + '<button onclick="window.showBrandProducts(\'' + brandId + '\',\'' + safeName + '\')" style="padding:10px 20px;border-radius:50px;border:1.5px solid #e2e8f0;cursor:pointer;font-size:14px;font-weight:700;font-family:inherit;background:#fff;color:#0f172a;margin-left:8px;">Shop Now</button>'
          : '<button onclick="typeof showLoginModal===\'function\'&&showLoginModal()" style="padding:10px 28px;border-radius:50px;background:#2563eb;color:#fff;border:none;cursor:pointer;font-size:14px;font-weight:700;">Login to Follow</button>';

        // Banner: use bd.banner if available, else gradient
        var bannerStyle = bd.banner
          ? 'background:url(' + JSON.stringify(bd.banner) + ') center/cover no-repeat;'
          : 'background:linear-gradient(135deg,' + color + ',' + color + 'aa);';

        page.innerHTML =
          '<div style="max-width:640px;margin:0 auto;">'
            // Sticky top bar
            + '<div style="padding:12px 16px;display:flex;align-items:center;gap:10px;background:#fff;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:20;box-shadow:0 1px 4px rgba(0,0,0,.06);">'
              + '<button onclick="history.length>1?history.back():showPage(\'brandsPage\');" style="width:36px;height:36px;border-radius:50%;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'
                + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>'
              + '</button>'
              + '<span style="font-weight:800;font-size:15px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + name + '</span>'
            + '</div>'
            // Banner + logo
            + '<div style="height:130px;' + bannerStyle + 'position:relative;">'
              + '<div id="bpLogoHolder" style="position:absolute;bottom:-28px;left:18px;width:64px;height:64px;border-radius:16px;border:3px solid #fff;background:' + color + ';display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.18);cursor:pointer;">'
                + logoHtml
              + '</div>'
            + '</div>'
            // Profile info
            + '<div style="background:#fff;padding:40px 18px 16px;border-bottom:1px solid #e2e8f0;">'
              + '<div style="font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">'
                + name + (verBadgeInline ? ('&ensp;' + verBadgeInline) : '')
              + '</div>'
              + (desc ? '<p style="font-size:13px;color:#64748b;margin:6px 0 10px;max-width:380px;line-height:1.5;">' + desc + '</p>' : '')
              + '<div style="display:flex;gap:24px;margin:12px 0 16px;">'
                + '<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;" id="brandFollowerCount">' + followers + '</div><div style="font-size:11px;color:#64748b;font-weight:600;">Followers</div></div>'
                + '<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;">' + brandProds.length + '</div><div style="font-size:11px;color:#64748b;font-weight:600;">Products</div></div>'
                + (bd.rating ? '<div style="text-align:center;"><div style="font-size:1.15rem;font-weight:800;">\u2b50 ' + bd.rating + '</div><div style="font-size:11px;color:#64748b;font-weight:600;">' + (bd.totalReviews || 0) + ' Reviews</div></div>' : '')
              + '</div>'
              + '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + followBtnHtml + '</div>'
            + '</div>'
            // Also Following section
            + '<div id="bpFollowingSection" style="display:none;padding:14px 16px;background:#fafafa;border-bottom:1px solid #f1f5f9;">'
              + '<div style="font-weight:800;font-size:12px;margin-bottom:10px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Also Following</div>'
              + '<div id="bpFollowingRow" style="display:flex;gap:12px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>'
            + '</div>'
            // Products
            + '<div style="padding:16px;">'
              + '<div style="font-weight:800;font-size:14px;margin-bottom:12px;">\ud83d\udecd\ufe0f ' + brandProds.length + ' Products</div>'
              + (brandProds.length
                  ? '<div class="product-grid" id="brandProductsGrid"></div>'
                  : '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:13px;">No products listed yet</div>')
            + '</div>'
          + '</div>';

        // Logo hold/long-press → full-screen preview
        setTimeout(function() {
          var holder = document.getElementById('bpLogoHolder');
          if (!holder) return;
          var holdTimer;
          function openLogoPreview() {
            var ov = document.createElement('div');
            ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s;';
            ov.innerHTML = logo
              ? '<img src="' + logo + '" style="max-width:88vw;max-height:88vh;border-radius:20px;object-fit:contain;box-shadow:0 20px 60px rgba(0,0,0,.5);">'
              : '<div style="width:200px;height:200px;border-radius:32px;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:800;color:#fff;">' + initials + '</div>';
            ov.addEventListener('click', function(){ document.body.removeChild(ov); });
            document.body.appendChild(ov);
          }
          holder.addEventListener('mousedown', function(){ holdTimer = setTimeout(openLogoPreview, 500); });
          holder.addEventListener('mouseup', function(){ clearTimeout(holdTimer); });
          holder.addEventListener('mouseleave', function(){ clearTimeout(holdTimer); });
          holder.addEventListener('touchstart', function(){ holdTimer = setTimeout(openLogoPreview, 500); }, { passive: true });
          holder.addEventListener('touchend', function(){ clearTimeout(holdTimer); });
          holder.addEventListener('touchmove', function(){ clearTimeout(holdTimer); }, { passive: true });
          holder.addEventListener('contextmenu', function(e){ e.preventDefault(); openLogoPreview(); });
        }, 200);

        // Load "Also Following" brands for this brand
        setTimeout(function() {
          var _fb4 = window.firebase;
          if (!_fb4) return;
          _fb4.get(_fb4.ref(_fb4.database, 'brandFollowers')).then(function(allFollowSnap) {
            var followingIds = [];
            if (allFollowSnap.exists()) {
              allFollowSnap.forEach(function(c) {
                var val = c.val();
                if (val && val[brandId] && c.key !== brandId) followingIds.push(c.key);
              });
            }
            if (!followingIds.length) return;
            var allBrands = window.__bzBrandsCache || [];
            var followingBrands = allBrands.filter(function(b){ return followingIds.indexOf(b.id) !== -1; });
            followingBrands.sort(function(a,b){ return ((b.followers||0)+(b.blueTickAdmin?10000:0)) - ((a.followers||0)+(a.blueTickAdmin?10000:0)); });
            followingBrands = followingBrands.slice(0,20);
            if (!followingBrands.length) return;
            var sec = document.getElementById('bpFollowingSection');
            var row = document.getElementById('bpFollowingRow');
            if (!sec || !row) return;
            sec.style.display = 'block';
            var BZ_BT2 = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 100 100"><path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/><polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            var cs = ['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];
            followingBrands.forEach(function(b) {
              var bc = cs[(b.name||'A').charCodeAt(0) % cs.length];
              var ini = (b.name||'B').slice(0,2).toUpperCase();
              var lInner = b.logo
                ? '<img src="' + b.logo + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'" >'
                : '<span style="font-size:13px;font-weight:800;color:#fff;">' + ini + '</span>';
              var item = document.createElement('div');
              item.style.cssText = 'flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;';
              item.innerHTML = '<div style="width:46px;height:46px;border-radius:12px;border:2px solid #e2e8f0;background:' + bc + ';display:flex;align-items:center;justify-content:center;overflow:hidden;">' + lInner + '</div>'
                + '<span style="font-size:9px;font-weight:700;max-width:54px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (b.name||'').slice(0,10) + (b.blueTickAdmin ? BZ_BT2 : '') + '</span>';
              item.addEventListener('click', function(){ window.showBrandProfile(b.id, b.name); });
              row.appendChild(item);
            });
          }).catch(function(){});
        }, 500);

        if (brandProds.length) {
          setTimeout(function() { renderProducts(brandProds, 'brandProductsGrid'); }, 30);
          // Add Trending / Most Popular / Latest sections
          setTimeout(function() {
            var extraWrap = document.createElement('div');
            extraWrap.id = 'bzBrandExtras';
            function addBrandSection(emoji, title, prods) {
              if (!prods.length) return;
              var gridId = 'bzBrandMini_' + title.replace(/\W/g, '');
              var sec = document.createElement('div');
              sec.style.cssText = 'padding:0 16px 20px;';
              sec.innerHTML = '<div style="font-weight:800;font-size:14px;margin-bottom:10px;">' + emoji + ' ' + title + '</div>'
                + '<div id="' + gridId + '" class="product-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;"></div>';
              extraWrap.appendChild(sec);
              setTimeout(function() { renderProducts(prods, gridId); }, 60);
            }
            var trending = brandProds.slice().sort(function(a,b) {
              return ((b.views||0)+(b.orders||0)*2) - ((a.views||0)+(a.orders||0)*2);
            }).slice(0, 4);
            var popular = brandProds.slice().sort(function(a,b) {
              var ra = typeof calculateProductRating==='function'?calculateProductRating(a.id):(a.rating||0);
              var rb = typeof calculateProductRating==='function'?calculateProductRating(b.id):(b.rating||0);
              return rb - ra;
            }).slice(0, 4);
            var latest = brandProds.slice().sort(function(a,b) {
              return ((b.addedAt||b.createdAt||0) - (a.addedAt||a.createdAt||0));
            }).slice(0, 4);
            if (brandProds.length >= 2) {
              addBrandSection('🔥', 'Trending', trending);
              addBrandSection('⭐', 'Most Popular', popular);
              addBrandSection('🆕', 'Latest', latest);
            }
            var pgDiv = page.querySelector('#brandProductsGrid');
            if (pgDiv && pgDiv.parentElement) pgDiv.parentElement.appendChild(extraWrap);
          }, 200);
        }
        window.scrollTo(0, 0);
      }).catch(function(err) {
        console.error('Brand profile error:', err);
        page.innerHTML =
          '<div style="text-align:center;padding:60px 20px;">'
            + '<p style="color:#ef4444;font-weight:700;margin-bottom:12px;">Could not load brand profile</p>'
            + '<button onclick="showPage(\'brandsPage\')" style="padding:8px 20px;border-radius:20px;background:#2563eb;color:#fff;border:none;cursor:pointer;font-weight:700;">← Back to Brands</button>'
          + '</div>';
      });
    }

    // ══════ Follow / Unfollow Brand ══════
    function toggleBrandFollow(brandId, brandName, btnEl) {
      if (!currentUser) { showToast('Please login to follow brands', 'error'); return; }
      var uid = currentUser.uid;
      var _fb2 = window.firebase;
      var followRef = _fb2.ref(_fb2.database, 'brandFollowers/' + brandId + '/' + uid);
      var btn = btnEl || document.getElementById('brandFollowBtn');

      _fb2.get(followRef).then(function(snap) {
        if (snap.exists()) {
          return _fb2.remove(followRef).then(function() {
            if (btn) { btn.textContent = '+ Follow'; btn.style.background = '#2563eb'; btn.style.color = '#fff'; }
            var cnt = document.getElementById('brandFollowerCount');
            if (cnt) cnt.textContent = Math.max(0, parseInt(cnt.textContent || '0') - 1);
            showToast('Unfollowed ' + brandName);
          });
        } else {
          return _fb2.set(followRef, { userId: uid, brandId: brandId, brandName: brandName, followedAt: Date.now() }).then(function() {
            if (btn) { btn.textContent = '✓ Following'; btn.style.background = '#f1f5f9'; btn.style.color = '#64748b'; }
            var cnt = document.getElementById('brandFollowerCount');
            if (cnt) cnt.textContent = parseInt(cnt.textContent || '0') + 1;
            showToast('Following ' + brandName + '! 🎉', 'success');
          });
        }
      }).catch(function(err) { showToast('Error: ' + err.message, 'error'); });
    }

    // ══════ Following Products (Home Page) ══════
    function loadFollowingProducts() {
      if (!currentUser) return;
      var uid = currentUser.uid;
      window.firebase.get(window.firebase.ref(window.firebase.database, 'brandFollowers')).then(function(snap) {
        if (!snap.exists()) return;
        var followed = [];
        snap.forEach(function(c) { if (c.val() && c.val()[uid]) followed.push(c.key); });
        if (!followed.length) return;
        var prods = products.filter(function(p) {
          var bid = p.brandId || (p.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
          return followed.indexOf(bid) !== -1;
        });
        if (!prods.length) return;
        var sec = document.getElementById('followingProductsSection');
        if (sec) { sec.style.display = 'block'; renderProducts(prods.slice(0, 10), 'followingProductsGrid'); }
      }).catch(function() {});
    }

    // ══════════════════════════════════════
    //  EXPOSE TO WINDOW
    // ══════════════════════════════════════
    window.loadBrandsPage        = loadBrandsPage;
    window.filterSiteBrands      = filterSiteBrands;
    window.showBrandProfile      = showBrandProfile;
    window.showBrandProducts     = showBrandProducts;
    window.toggleBrandFollow     = toggleBrandFollow;
    window.loadFollowingProducts = loadFollowingProducts;

    // Menu onclick handler — safe wrapper
    window._openBrandsPage = function() {
      showPage('brandsPage');
      // Reset cache so fresh load happens
      window._siteBrandsAll = [];
      window.__bzBrandsCache = [];
      setTimeout(function() {
        if (typeof bzLoadBrandsPageFixed === 'function') bzLoadBrandsPageFixed();
        else loadBrandsPage();
      }, 80);
    };

    // oninput handler for search input
    window._filterSiteBrands = function() { filterSiteBrands(); };

    // ─── Cache brands for search suggestions ───
    (function bzCacheBrandsForSearch() {
      var _orig = window.loadBrandsPage;
      window.loadBrandsPage = function() {
        if (typeof _orig === 'function') _orig();
      };
    })();

  });
})();

/* ══════════════════════════════════════════════════════════
   BUYZO — BRAND FULL LOADER (Firebase-scoped fixed version)
   Loads brands with correct Firebase references.
   Also caches brands for search suggestions.
   ══════════════════════════════════════════════════════════ */
(function bzBrandLoader() {
  'use strict';

  var BT = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;margin-left:2px;" aria-label="Verified"><path d="M50,5C53,5 55,8 58,8C61,8 63,5 66,6C69,7 70,11 73,12C76,13 79,11 81,13C83,15 82,19 84,21C86,23 90,23 91,26C92,29 90,32 91,35C92,38 95,40 95,43C95,46 92,48 91,51C90,54 92,57 91,60C90,63 86,64 85,67C84,70 85,74 83,76C81,78 78,77 75,79C72,81 71,84 68,85C65,86 62,84 59,85C56,86 54,89 50,89C46,89 44,86 41,85C38,84 35,86 32,85C29,84 28,81 25,79C22,77 19,78 17,76C15,74 16,70 15,67C14,64 10,63 9,60C8,57 10,54 9,51C8,48 5,46 5,43C5,40 8,38 9,35C10,32 8,29 9,26C10,23 14,23 16,21C18,19 17,15 19,13C21,11 24,13 27,12C30,11 31,7 34,6C37,5 39,8 42,8C45,8 47,5 50,5Z" fill="#1DA1F2"/><polyline points="31,50 44,63 69,36" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  window.__BZ_BLUE_TICK = BT;

  function brandColor(name) {
    var cs = ['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];
    return cs[(name||'A').charCodeAt(0) % cs.length];
  }

  // ── Full brand loader (professional, instant skeleton) ──
  function bzLoadBrandsPageFixed() {
    var fb = window.firebase;
    if (!fb || !fb.database) { setTimeout(bzLoadBrandsPageFixed, 600); return; }
    var get = fb.get, ref = fb.ref, db = fb.database;

    // Add shimmer keyframe
    if (!document.getElementById('bzShimmerStyle')) {
      var st = document.createElement('style');
      st.id = 'bzShimmerStyle';
      st.textContent = '@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
      document.head.appendChild(st);
    }

    // Hide spinner, show skeleton grids immediately
    var sp = document.getElementById('brandsLoadingSpinner');
    if (sp) sp.style.display = 'none';
    ['suggestedBrandsSection','otherBrandsSection','followingBrandsSection','brandsEmptyState'].forEach(function(id){
      var el=document.getElementById(id); if(el) el.style.display='none';
    });
    var popSec = document.getElementById('popularBrandsSection');
    var popGrid = document.getElementById('popularBrandsGrid');
    if (popSec && popGrid) {
      popSec.style.display = 'block';
      popGrid.innerHTML = '';
      var skFrag = document.createDocumentFragment();
      for (var si=0; si<4; si++) {
        var sk = document.createElement('div');
        sk.style.cssText = 'border-radius:16px;background:linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;height:120px;';
        skFrag.appendChild(sk);
      }
      popGrid.appendChild(skFrag);
    }

    // Use cache if valid
    if (window.__bzBrandsCache && window.__bzBrandsCache.length) {
      bzRenderBrandsFixed(window.__bzBrandsCache, window.__bzFollowedSet || {});
      return;
    }

    var uid = window.currentUser ? window.currentUser.uid : null;
    Promise.all([
      get(ref(db, 'products')),
      get(ref(db, 'brands')),
      uid ? get(ref(db, 'brandFollowers')) : Promise.resolve(null)
    ]).then(function(res) {
      var prodSnap=res[0], brandSnap=res[1], followSnap=res[2];
      var brandMap={};
      if (brandSnap && brandSnap.exists()) {
        brandSnap.forEach(function(c) {
          var b=c.val();
          if (b && b.name) brandMap[c.key]={
            id:c.key, name:b.name, logo:b.logo||'', banner:b.banner||'',
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
      bzRenderBrandsFixed(arr, followedSet);
      if (typeof renderFollowingBrandsHomeStrip==='function') renderFollowingBrandsHomeStrip();
    }).catch(function(err) {
      console.error('Brand load error:',err);
      var g=document.getElementById('popularBrandsGrid');
      if(g) g.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:24px;color:#ef4444;font-size:13px;">Failed to load.<br><button onclick="window.__bzBrandsCache=[];bzLoadBrandsPageFixed()" style="margin-top:8px;padding:8px 20px;border-radius:20px;border:none;background:#2563eb;color:#fff;cursor:pointer;font-weight:700;">Retry</button></div>';
    });
  }
  window.bzLoadBrandsPageFixed = bzLoadBrandsPageFixed;

  // ── Make brand card (professional) ──
  function bzMakeBrandCard(b, isFollowing) {
    var col=brandColor(b.name);
    var initials=(b.name||'B').slice(0,2).toUpperCase();
    var BZ_BT=window.__BZ_BLUE_TICK||'';
    var logoInner=b.logo
      ? '<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display=\'none\'">'
      : '<span style="font-size:17px;font-weight:800;color:#fff;">'+initials+'</span>';
    var safeName=(b.name||'').replace(/'/g,'').replace(/"/g,'');
    var followBtn=window.currentUser
      ? '<button onclick="event.stopPropagation();window.toggleBrandFollow(\"'+b.id+'\",\"'+safeName+'\",this)" style="margin-top:9px;width:100%;padding:7px 0;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;transition:all .15s;'
        +(isFollowing?'background:#f1f5f9;color:#64748b;':'background:#2563eb;color:#fff;')+'">'
        +(isFollowing?'✓ Following':'+ Follow')+'</button>'
      :'';
    var bannerTop=b.banner
      ? '<div style="height:42px;margin:-14px -14px 10px;background:url('+JSON.stringify(b.banner)+') center/cover no-repeat;border-radius:14px 14px 0 0;"></div>'
      :'';
    var el=document.createElement('div');
    el.style.cssText='background:var(--surface,#fff);border:1.5px solid #e2e8f0;border-radius:16px;padding:14px;cursor:pointer;transition:all .2s;';
    el.innerHTML=bannerTop
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
        +'<div style="width:46px;height:46px;border-radius:12px;background:'+col+';display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;border:2px solid #f1f5f9;">'+logoInner+'</div>'
        +'<div style="flex:1;min-width:0;">'
          +'<div style="font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:3px;">'+(b.name||'')+( b.blueTickAdmin?'&nbsp;'+BZ_BT:'')+( b.verificationLevel==='premium'?'<span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:8px;padding:1px 5px;border-radius:8px;font-weight:800;margin-left:3px;">PRO</span>':'')+' </div>'
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
    el.addEventListener('click',function(e){
      if(e.target.tagName==='BUTTON'||e.target.closest('button')) return;
      if(typeof window.showBrandProfile==='function') window.showBrandProfile(b.id,b.name);
    });
    return el;
  }

  // ── Render brand sections (no flash, category-style following strip) ──
  function bzRenderBrandsFixed(brands, followedSet) {
    followedSet=followedSet||{};
    var popularGrid=document.getElementById('popularBrandsGrid');
    var sugGrid=document.getElementById('suggestedBrandsGrid');
    var otherGrid=document.getElementById('otherBrandsGrid');
    var followingRow=document.getElementById('followingBrandsRow');
    var emptyEl=document.getElementById('brandsEmptyState');
    var popSection=document.getElementById('popularBrandsSection');
    var sugSection=document.getElementById('suggestedBrandsSection');
    var othSection=document.getElementById('otherBrandsSection');
    var followingSec=document.getElementById('followingBrandsSection');
    var BZ_BT=window.__BZ_BLUE_TICK||'';
    var cs=['#f97316','#2563eb','#7c3aed','#16a34a','#dc2626','#0369a1','#d97706','#059669','#be185d','#0891b2'];

    if (!brands.length) {
      if(emptyEl) emptyEl.style.display='block';
      [popSection,sugSection,othSection,followingSec].forEach(function(s){if(s)s.style.display='none';});
      return;
    }
    if(emptyEl) emptyEl.style.display='none';

    // Following strip — category-style circles
    var followed=brands.filter(function(b){return !!followedSet[b.id];});
    if (followed.length && followingSec && followingRow) {
      followingSec.style.display='block';
      followingRow.innerHTML='';
      followed.forEach(function(b) {
        var col=cs[(b.name||'A').charCodeAt(0)%cs.length];
        var ini=(b.name||'B').slice(0,2).toUpperCase();
        var lInner=b.logo
          ? '<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display=\'none\'">'
          : '<span style="font-size:15px;font-weight:800;color:#fff;">'+ini+'</span>';
        var tick=b.blueTickAdmin
          ? '<div style="position:absolute;bottom:-2px;right:-2px;background:#fff;border-radius:50%;padding:1px;">'+BZ_BT.replace(/width="15"/g,'width="12"').replace(/height="15"/g,'height="12"')+'</div>'
          : '';
        var item=document.createElement('div');
        item.style.cssText='flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;min-width:60px;';
        item.innerHTML='<div style="position:relative;width:56px;height:56px;">'
          +'<div style="width:56px;height:56px;border-radius:50%;border:2.5px solid #2563eb;background:'+col+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+lInner+'</div>'+tick
          +'</div>'
          +'<span style="font-size:10px;font-weight:700;max-width:62px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(b.name||'')+'</span>';
        item.addEventListener('click',function(){window.showBrandProfile(b.id,b.name);});
        followingRow.appendChild(item);
      });
    } else if(followingSec) followingSec.style.display='none';

    var popular=brands.filter(function(b){return b.blueTickAdmin||b.verificationLevel==='premium'||((b.followers||0)+(b.rating||0)*100+b.products.length*10)>50;});
    var nonPop=brands.filter(function(b){return popular.indexOf(b)===-1;});
    var suggested=nonPop.filter(function(b){return !followedSet[b.id];}).slice(0,6);
    var rest=nonPop.filter(function(b){return suggested.indexOf(b)===-1;});

    function fillGrid(section,grid,arr){
      if(!section||!grid) return;
      if(!arr.length){section.style.display='none';return;}
      section.style.display='block';
      grid.innerHTML='';
      var frag=document.createDocumentFragment();
      arr.forEach(function(b){frag.appendChild(bzMakeBrandCard(b,!!followedSet[b.id]));});
      grid.appendChild(frag);
    }
    fillGrid(popSection,popularGrid,popular);
    fillGrid(sugSection,sugGrid,suggested);
    fillGrid(othSection,otherGrid,rest);
  }


  // Override global openers
  window._openBrandsPage = function() {
    if (typeof showPage==='function') showPage('brandsPage');
    window.__bzBrandsCache = []; window.__bzFollowedSet = {};
    setTimeout(bzLoadBrandsPageFixed, 100);
  };
  window.loadBrandsPage = bzLoadBrandsPageFixed;
  window._filterSiteBrands = function() {
    var inp = document.getElementById('brandSearchSite');
    var q = inp ? inp.value.toLowerCase().trim() : '';
    var all = window.__bzBrandsCache || [];
    if (!q) { bzRenderBrandsFixed(all, window.__bzFollowedSet||{}); return; }
    bzRenderBrandsFixed(all.filter(function(b){ return (b.name||'').toLowerCase().includes(q); }), window.__bzFollowedSet||{});
  };

  // ── Following Brands Strip on Home page ──
  function renderFollowingBrandsHomeStrip() {
    if (!window.currentUser) return;
    var uid = window.currentUser.uid;
    var allBrands = window.__bzBrandsCache || [];
    var fb = window.firebase;
    if (!fb || !fb.database || !allBrands.length) return;
    fb.get(fb.ref(fb.database, 'brandFollowers')).then(function(snap) {
      var followedIds = [];
      if (snap.exists()) snap.forEach(function(c){ if(c.val()&&c.val()[uid]) followedIds.push(c.key); });
      if (!followedIds.length) return;
      var followed = allBrands.filter(function(b){ return followedIds.includes(b.id); });
      if (!followed.length) return;
      var homePage = document.getElementById('homePage');
      if (!homePage) return;
      var sec = document.getElementById('bzFollowingBrandsStrip');
      if (!sec) {
        sec = document.createElement('div');
        sec.id = 'bzFollowingBrandsStrip';
        sec.style.cssText = 'padding:0 0 4px;';
        sec.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 4px 10px;">'
          +'<h2 style="margin:0;font-size:1.05rem;font-weight:800;">❤️ Following</h2>'
          +'<a onclick="window._openBrandsPage&&window._openBrandsPage()" style="font-size:12px;color:#2563eb;cursor:pointer;font-weight:600;">Manage →</a>'
          +'</div>'
          +'<div id="bzFollowingBrandsIcons" style="display:flex;gap:16px;overflow-x:auto;padding:0 4px 10px;-webkit-overflow-scrolling:touch;scrollbar-width:none;"></div>';
        var trending = homePage.querySelector('.trending-section');
        if (trending) trending.parentNode.insertBefore(sec, trending);
        else { var grid = document.getElementById('homeProductGrid'); if(grid) grid.parentNode.insertBefore(sec, grid); }
      }
      var row = document.getElementById('bzFollowingBrandsIcons');
      if (!row) return;
      row.innerHTML = '';
      followed.forEach(function(b) {
        var col = brandColor(b.name);
        var ini = (b.name||'B').slice(0,2).toUpperCase();
        var logoInner = b.logo
          ? '<img src="'+b.logo+'" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display=\'none\'">'
          : '<span style="font-size:16px;font-weight:800;color:#fff;">'+ini+'</span>';
        var tick = b.blueTickAdmin ? '<div style="position:absolute;bottom:-3px;right:-3px;background:#fff;border-radius:50%;padding:1px;">'+BT.replace('width="15" height="15"','width="13" height="13"')+'</div>' : '';
        var el = document.createElement('div');
        el.style.cssText = 'flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;';
        el.innerHTML = '<div style="position:relative;width:58px;height:58px;">'
          +'<div style="width:58px;height:58px;border-radius:14px;border:2.5px solid #2563eb;background:'+col+';display:flex;align-items:center;justify-content:center;overflow:hidden;">'+logoInner+'</div>'+tick
          +'</div>'
          +'<span style="font-size:10px;font-weight:700;max-width:66px;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text,#0f172a);">'+(b.name||'')+'</span>';
        el.addEventListener('click', function(){ if(typeof window.showBrandProfile==='function') window.showBrandProfile(b.id, b.name); });
        row.appendChild(el);
      });
      sec.style.display = 'block';
    }).catch(function(){});
  }
  window.renderFollowingBrandsHomeStrip = renderFollowingBrandsHomeStrip;

  // ── Sell Product → My Shop ──
  function checkSellerApproval() {
    var user = window.currentUser;
    if (!user) return;
    var fb = window.firebase;
    if (!fb || !fb.database) return;
    var uid = user.uid;
    if (localStorage.getItem('bz_seller_approved_'+uid)==='1') { applyMyShopMenu(); return; }
    function applyMyShopMenu() {
      var txt = document.getElementById('menuSellProductText');
      if (txt) { txt.textContent = 'My Shop'; txt.style.color = '#7c3aed'; }
      var item = document.getElementById('menuSellProductItem');
      if (item) { var svg = item.querySelector('svg'); if(svg) svg.style.color='#7c3aed'; }
      document.querySelectorAll('footer a').forEach(function(a){
        if((a.textContent||'').trim()==='Sell Product') a.textContent='My Shop 🏪';
      });
      localStorage.setItem('bz_seller_approved_'+uid,'1');
    }
    fb.get(fb.ref(fb.database,'sellers/'+uid)).then(function(snap) {
      if (snap.exists()) {
        var d=snap.val();
        if (d.approved===true||d.status==='approved'||d.verified===true) { applyMyShopMenu(); return; }
      }
      return fb.get(fb.ref(fb.database,'sellerRequests/'+uid));
    }).then(function(snap2) {
      if (!snap2||!snap2.exists||!snap2.exists()) return;
      var d2=snap2.val();
      if (d2&&(d2.approved===true||d2.status==='approved')) applyMyShopMenu();
    }).catch(function(){});
  }
  window.checkSellerApproval = checkSellerApproval;

  // ── Auth watchers ──
  var _bld_iv = setInterval(function() {
    if (window.currentUser) {
      clearInterval(_bld_iv);
      setTimeout(renderFollowingBrandsHomeStrip, 3000);
      setTimeout(checkSellerApproval, 2000);
    }
  }, 700);

  // Auto-load brands cache silently when Firebase is ready (for search)
  (function prefetchBrandsCache() {
    var fb = window.firebase;
    if (!fb || !fb.database) { setTimeout(prefetchBrandsCache, 1200); return; }
    if (window.__bzBrandsCache && window.__bzBrandsCache.length) return;
    var get=fb.get, ref=fb.ref, db=fb.database;
    Promise.all([get(ref(db,'products')), get(ref(db,'brands'))]).then(function(res) {
      var prodSnap=res[0], brandSnap=res[1];
      var brandMap={};
      if (brandSnap&&brandSnap.exists()) {
        brandSnap.forEach(function(c){ var b=c.val(); if(b&&b.name) brandMap[c.key]={ id:c.key,name:b.name,logo:b.logo||'',description:b.description||'',blueTickAdmin:!!b.blueTickAdmin,verificationLevel:b.verificationLevel||'normal',followers:b.followersCount||b.followers||0,rating:b.rating||0,products:[] }; });
      }
      if (prodSnap&&prodSnap.exists()) {
        prodSnap.forEach(function(c){ var p=c.val(); if(!p||!p.brand) return; var bid=p.brandId||(p.brand||'').toLowerCase().replace(/[^a-z0-9]/g,'_'); if(!brandMap[bid]) brandMap[bid]={id:bid,name:p.brandName||p.brand,logo:p.brandLogo||'',description:'',blueTickAdmin:false,verificationLevel:'normal',followers:0,rating:0,products:[]}; brandMap[bid].products.push(c.key); });
      }
      window.__bzBrandsCache = Object.values(brandMap).filter(function(b){ return b.products.length>0||b.blueTickAdmin; });
    }).catch(function(){});
  })();

})();



/* ──────────────────────────────────────────────
   7. IMPROVED SEARCH SUGGESTIONS WITH CATEGORY
   Patches showSearchSuggestions to include
   category info in auto-complete dropdown.
   ────────────────────────────────────────────── */
(function patchSearchSuggestions() {
  const _orig = window.showSearchSuggestions;
  if (typeof _orig !== 'function') return;

  window.showSearchSuggestions = function(query) {
    // Call original first to render the base UI
    _orig.call(this, query);

    // Find and enhance all suggestion items to show category
    const container = document.getElementById('searchSuggestions');
    if (!container) return;

    // Enhance existing suggestion items
    container.querySelectorAll('.search-suggestion-category').forEach(el => {
      if (el.textContent && !el.dataset.enhanced) {
        el.dataset.enhanced = '1';
        el.style.cssText = `
          font-size:11px;font-weight:600;
          color:#2563eb;background:#eff6ff;
          padding:1px 7px;border-radius:20px;
          display:inline-block;margin-bottom:2px;
        `;
        // Add icon if not present
        if (!el.textContent.startsWith('🏷')) {
          el.textContent = '🏷️ ' + el.textContent;
        }
      }
    });
  };
})();


/* ──────────────────────────────────────────────
   8. LANGUAGE STANDARDIZATION
   Remove any remaining Hindi/mixed text from DOM.
   ────────────────────────────────────────────── */
(function fixLanguage() {
  const replacements = [
    // [selector or regex, replacement]
    { sel: '#twoFactorStatusText', text: 'Adds an extra layer of security to your account' },
    { sel: '[title="Admin se enable hoga"]', attr: 'title', text: 'Will be enabled by admin' },
  ];

  function applyReplacements() {
    replacements.forEach(r => {
      try {
        const el = document.querySelector(r.sel);
        if (!el) return;
        if (r.attr) el.setAttribute(r.attr, r.text);
        else el.textContent = r.text;
      } catch(e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyReplacements);
  } else {
    applyReplacements();
  }
})();

// End of main-patch.js
