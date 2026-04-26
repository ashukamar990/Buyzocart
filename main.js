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

    function escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
      const scored = [];
      products.forEach(p => {
        const name = p.name || p.title || '';
        const desc = p.description || '';
        const cat = p.category || '';
        const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
        const combined = [name, desc, cat, tags].join(' ');
        let score = 0;
        score = Math.max(score, fuzzyScore(name, q));
        score = Math.max(score, fuzzyScore(cat, q) * 0.7);
        score = Math.max(score, fuzzyScore(combined, q) * 0.5);
        if (score > 25) scored.push({ product: p, score });
      });
      scored.sort((a, b) => {
        if (Math.abs(a.score - b.score) > 5) return b.score - a.score;
        const rA = calculateProductRating(a.product.id);
        const rB = calculateProductRating(b.product.id);
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
      const topThree = results.slice(0, 3);
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
        const ratingVal = calculateProductRating(product.id);
        card.innerHTML = `
          <div style="height:72px; background-image:url('${getProductImage(product)}'); background-size:contain; background-position:center; background-repeat:no-repeat; background-color:#f8fafc;"></div>
          <div style="padding:4px 5px; font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(product.name || product.title || '')}</div>
          <div style="padding:0 5px 4px; font-size:11px; color:var(--accent); font-weight:700;">${escapeHTML(formatPrice(product.price))}</div>
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
            <div class="search-suggestion-name">${escapeHTML(product.name || product.title || 'Product')}</div>
            <div class="search-suggestion-category">${escapeHTML(productCategory)}</div>
            <div class="search-suggestion-price">${escapeHTML(formatPrice(product.price))}</div>
          </div>
        `;
        suggestion.addEventListener('click', () => { showProductDetail(product); closeSearchPanel(); });
        suggestionsContainer.appendChild(suggestion);
      });
      if (results.length > 3) {
        const viewAll = document.createElement('div');
        viewAll.className = 'search-suggestion';
        viewAll.innerHTML = `<div class="search-suggestion-info" style="padding-left:0;"><div class="search-suggestion-name" style="color:var(--accent);">View all ${results.length} results for "${escapeHTML(query)}"</div></div>`;
        viewAll.addEventListener('click', () => performSearch(query));
        suggestionsContainer.appendChild(viewAll);
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
        element.addEventListener('click', () => {
          closeSearchPanel();
          filterProductsByTag(tag);
        });
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
      window.location.href = 'account.html';
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

    function createProductCard(product) {
      if (!product) {
        console.error('Attempted to create product card with null product');
        return document.createElement('div');
      }
      const card = document.createElement('div');
      card.className = 'product-card';
      const productId = product.id || product.productId || product._id || product.key || `product-${Date.now()}-${Math.random()}`;
      card.setAttribute('data-product-id', productId);
      const isWishlisted = isInWishlist(productId);
      const rating = calculateProductRating(productId);
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
      const ratingMap = {};
      similarProducts.forEach(p => {
        const productReviews = reviews.filter(r => r.productId === p.id);
        if (productReviews.length) {
          const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
          ratingMap[p.id] = sum / productReviews.length;
        } else {
          ratingMap[p.id] = 0;
        }
      });
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
          status: 'confirmed',
          orderDate: Date.now(),
          userInfo: userInfo,
          deliveredDate: null,
          cancelledDate: null,
          tracking: {
            confirmed: Date.now(),
            shipped: null,
            delivered: null
          }
        };
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'orders/' + orderId), orderData);
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'userOrders/' + currentUser.uid + '/' + orderId), true);
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
            ${review.userPhoto ? `<img src="${review.userPhoto}" width="28" height="28" style="border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:28px;height:28px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#64748b;flex-shrink:0;">${(review.userName||'?')[0].toUpperCase()}</div>`}
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

    function renderOrders(orders) {
      const container = document.getElementById('ordersList');
      if (!container) return;
      container.innerHTML = '';
      orders.forEach(order => {
        if (!order) return;
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        const rawStatus = order.status || 'confirmed';
        const statusClass = `status-${rawStatus}`;
        const statusText = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
        const orderDate = new Date(order.orderDate || Date.now());
        const deliveredDate = order.deliveredDate ? new Date(order.deliveredDate) : null;
        let showReturnReplace = false;
        if (rawStatus === 'delivered' && deliveredDate) {
          const daysSinceDelivery = Math.floor((Date.now() - deliveredDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceDelivery <= 3) showReturnReplace = true;
        }
        const liveProduct = products.find(p => p.id === order.productId);
        const imgUrl = (liveProduct ? getProductImage(liveProduct) : null) || order.productImage || 'https://via.placeholder.com/80x80/f3f4f6/64748b?text=No+Image';

        const steps = [
          { key: 'confirmed', label: 'Confirmed', icon: '✅' },
          { key: 'shipped',   label: 'Shipped',   icon: '🚚' },
          { key: 'delivered', label: 'Delivered',  icon: '📦' }
        ];
        const statusOrder = ['confirmed','shipped','delivered'];
        const currentIdx = statusOrder.indexOf(rawStatus);
        const isCancelled = rawStatus === 'cancelled' || rawStatus === 'return-requested' || rawStatus === 'replace-requested';

        const trackingHtml = isCancelled ? `
          <div style="margin:10px 0 4px;padding:8px 12px;background:#fef2f2;border-radius:8px;color:#ef4444;font-size:13px;font-weight:600;">
            ❌ ${statusText}
          </div>` : `
          <div class="order-tracking-steps">
            ${steps.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return `<div class="track-step ${done ? 'done' : active ? 'active' : 'pending'}">
                <div class="track-dot">${done ? '✓' : active ? step.icon : ''}</div>
                <div class="track-label">${step.label}</div>
              </div>`;
            }).join('<div class="track-line"></div>')}
          </div>`;

        orderCard.innerHTML = `
          <div class="order-header">
            <div>
              <div class="order-id">${order.orderId || order.id || ''}</div>
              <div class="order-date">${orderDate.toLocaleDateString('en-IN')}</div>
            </div>
            <div class="order-status ${statusClass}">${statusText}</div>
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
            ${rawStatus === 'confirmed' || rawStatus === 'shipped' ? 
              `<button class="order-action-btn cancel" onclick="event.stopPropagation();cancelOrder('${order.id}')">Cancel Order</button>` : ''}
            ${showReturnReplace ? 
              `<button class="order-action-btn return" onclick="event.stopPropagation();showReturnReplaceModal('${order.id}')">Return / Refund</button>` : ''}
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

    function cancelOrder(orderId) {
      document.getElementById('cancellationModal').classList.add('active');
      document.getElementById('confirmCancel').onclick = async function() {
        const reason = document.querySelector('input[name="cancelReason"]:checked').value;
        try {
          await window.firebase.update(window.firebase.ref(window.firebase.database, 'orders/' + orderId), {
            status: 'cancelled',
            cancelledDate: Date.now(),
            cancellationReason: reason
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
      const statusClass = `status-${order.status}`;
      const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
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
      const ratingMap = {};
      filteredProducts.forEach(p => {
        const productReviews = reviews.filter(r => r.productId === p.id);
        if (productReviews.length) {
          const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
          ratingMap[p.id] = sum / productReviews.length;
        } else ratingMap[p.id] = 0;
      });
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
      const ratingMap = {};
      filteredProducts.forEach(p => {
        const productReviews = reviews.filter(r => r.productId === p.id);
        if (productReviews.length) {
          const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
          ratingMap[p.id] = sum / productReviews.length;
        } else ratingMap[p.id] = 0;
      });
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

    function renderProducts(productsToRender, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const ratingMap = {};
      productsToRender.forEach(p => {
        const productReviews = reviews.filter(r => r.productId === p.id);
        if (productReviews.length) {
          const sum = productReviews.reduce((acc, r) => acc + r.rating, 0);
          ratingMap[p.id] = sum / productReviews.length;
        } else ratingMap[p.id] = 0;
      });
      const sorted = [...productsToRender].sort((a, b) => (ratingMap[b.id] || 0) - (ratingMap[a.id] || 0));
      container.innerHTML = '';
      if (!sorted || sorted.length === 0) {
        container.innerHTML = '<div class="card-panel center" style="padding:32px 16px;"><div style="display:flex;flex-direction:column;align-items:center;gap:10px;"><span style="font-size:40px;opacity:0.3;">🛍️</span><p style="color:var(--muted);margin:0;font-size:0.9rem;">Abhi koi products available nahi hain</p></div></div>';
        return;
      }
      const fragment = document.createDocumentFragment();
      sorted.forEach(product => { if (product) fragment.appendChild(createProductCard(product)); });
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
        try {
          await window.firebase.remove(window.firebase.ref(window.firebase.database, 'addresses/' + address.id));
          showToast('Address deleted successfully', 'success');
          document.getElementById('alertModal').classList.remove('active');
          await loadSavedAddresses();
          document.getElementById('savedAddressesSection').style.display = savedAddresses.length ? 'block' : 'none';
          document.getElementById('newAddressForm').style.display = 'block';
        } catch (error) {
          console.error('Error deleting address:', error);
          showToast('Failed to delete address', 'error');
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
      el.innerHTML = '<span style="font-size:22px;flex-shrink:0;">'+(icons[n.type]||'🔔')+'</span><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;color:var(--text,#0f172a);">'+escapeHTML(n.title)+'</div><div style="font-size:12px;color:var(--muted,#64748b);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escapeHTML(n.message)+'</div></div>';
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
            const trendingProducts = products.filter(p => p.isTrending || p.trending);
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

      let _lastAdminNotifTs = Date.now();
      onValue(ref(database, 'adminNotifications'), snapshot => {
        if (!snapshot.exists()) return;
        snapshot.forEach(child => {
          const n = child.val();
          if (n.timestamp && n.timestamp > _lastAdminNotifTs) {
            _lastAdminNotifTs = n.timestamp;
            addNotif({ type: n.type || 'system', title: n.title, message: n.message, badge: n.badge || 'Info' });
          }
        });
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

    function initApp() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      recentSearches = cacheManager.get(CACHE_KEYS.RECENT_SEARCHES) || [];
      updateNotifBadge();
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

            if (window._pendingAccountNav) {
              window._pendingAccountNav = false;
              setTimeout(() => { window.location.href = 'account.html'; }, 300);
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
              <span class="notif-title">${escapeHTML(n.title)}</span>
              <span class="notif-time">${timeAgoNotif(n.timestamp)}</span>
            </div>
            <div class="notif-message">${escapeHTML(n.message)}</div>
            <span class="notif-badge ${n.type}">${escapeHTML(n.badge)}</span>
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
      window.location.href = 'account.html';
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
    });