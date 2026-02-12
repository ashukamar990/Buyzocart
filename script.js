
    // Performance optimization
    let frameId = null;
    let lastScrollTime = 0;
    
    // Debounce function for performance
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // Throttle function for performance
    function throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }

    // ADDED NEW FUNCTIONS FOR MOBILE MENU OPTIONS
    function showCategories() {
      // Show categories page or filter
      filterByCategory('all');
    }

    // Global variables
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
    let currentSelectedColor = 'black';
    let currentSelectedColorName = 'काला';
    let adminSettings = {
      deliveryCharge: 50,
      gatewayChargePercent: 2,
      freeShippingOver: 999
    };
    let savedAddresses = [];
    let recentSearches = [];
    let popularSearches = ['T-Shirt', 'Sneakers', 'Jeans', 'Watch', 'Headphones', 'Mobile', 'Laptop', 'Shoes'];
    let searchTags = ['Summer Collection', 'Winter Sale', 'New Arrivals', 'Best Sellers', 'Limited Edition'];
    let currentSearchQuery = '';
    
    // Auto-slide variables
    let autoSlideInterval;
    let slidePaused = false;
    let bannerAutoSlideInterval;
    let trendingAutoSlideInterval;

    // Cache Manager
    const cacheManager = {
      set: function(key, data, ttl = 7 * 24 * 60 * 60 * 1000) {
        const item = {
          data: data,
          timestamp: Date.now(),
          ttl: ttl
        };
        try {
          localStorage.setItem(key, JSON.stringify(item));
        } catch (e) {
          console.error('Error saving to localStorage:', e);
        }
      },
      
      get: function(key) {
        const item = localStorage.getItem(key);
        if (!item) return null;
        
        try {
          const parsed = JSON.parse(item);
          const now = Date.now();
          
          if (now - parsed.timestamp > parsed.ttl) {
            localStorage.removeItem(key);
            return null;
          }
          
          return parsed.data;
        } catch (e) {
          localStorage.removeItem(key);
          return null;
        }
      },
      
      remove: function(key) {
        localStorage.removeItem(key);
      },
      
      clearAll: function() {
        localStorage.clear();
      }
    };

    // Initialize EmailJS
    (function() {
      emailjs.init("user_your_user_id_here"); // Replace with your EmailJS user ID
    })();

    // Color names mapping
    const colorNames = {
      'black': 'काला',
      'white': 'सफेद',
      'blue': 'नीला',
      'red': 'लाल',
      'green': 'हरा',
      'yellow': 'पीला',
      'pink': 'गुलाबी',
      'purple': 'बैंगनी',
      'orange': 'नारंगी',
      'gray': 'ग्रे',
      'brown': 'भूरा',
      'navy': 'गहरा नीला',
      'maroon': 'मैरून',
      'teal': 'टील',
      'olive': 'जैतूनी',
      'silver': 'चांदी',
      'gold': 'सोना',
      'beige': 'बेज',
      'burgundy': 'बरगंडी',
      'charcoal': 'चारकोल'
    };

    // Product Image Helper Function
    function getProductImage(product, idx = 0) {
      if (!product) return "https://via.placeholder.com/300x300/f3f4f6/64748b?text=Loading...";
      if (Array.isArray(product.images) && product.images.length > 0) {
        if (idx < product.images.length) return product.images[idx];
        return product.images[0];
      }
      if (product.image) return product.image;
      if (product.img) return product.img;
      if (product.imageUrl) return product.imageUrl;
      if (product.photo) return product.photo;
      return "https://via.placeholder.com/300x300/f3f4f6/64748b?text=No+Image";
    }

    // Get product images for specific color
    function getProductImagesForColor(product, color) {
      if (!product || !product.colorImages || !product.colorImages[color]) {
        return getProductImages(product);
      }
      return product.colorImages[color];
    }

    function getProductImages(product) {
      if (!product) return [];
      
      if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images;
      } else {
        return [getProductImage(product)];
      }
    }

    // Order ID Generation Function
    function generateOrderId() {
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const randomNum = Math.floor(100000 + Math.random() * 900000); 
        return `ORDER-${yyyy}${mm}${dd}-${randomNum}`;
    }

    // Parse price safely
    function parsePrice(p) {
      if (typeof p === "number") return p;
      if (typeof p === "string") {
        const num = parseFloat(p.replace(/[₹,]/g, ""));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    }

    // Initialize app
    function initApp() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      
      // Load recent searches
      recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      
      // Check for product ID in URL for direct product link access
      checkUrlForProduct();
      
      // Setup event listeners
      setupEventListeners();
      
      // Initialize Firebase auth state listener
      if (window.firebase && window.firebase.auth) {
        window.firebase.onAuthStateChanged(window.firebase.auth, user => {
          if (user) {
            currentUser = user;
            updateUIForUser(user);
            loadUserData(user);
            loadRecentlyViewed(user);
            loadSavedAddresses();
            document.getElementById('authModal')?.classList.remove('active');
          } else {
            currentUser = null;
            updateUIForGuest();
          }
        });
      }
      
      // Load cached data first
      loadCachedData();
      
      // Then fetch live data
      fetchLiveData();
      
      // Setup realtime listeners
      setupRealtimeListeners();
      
      // Show home page
      showPage('homePage');
      
      // Setup hero messages rotation
      setupHeroMessages();
      
      // Update bottom navigation
      updateBottomNav();
      
      // Initialize header search bar visibility on scroll
      setupHeaderSearchScroll();
      
      // Optimize animations
      optimizeAnimations();
      
      // Fix back button behavior
      setupBackButton();
      
      // Fix search input
      setupSearchInput();
    }

    // Check URL for product ID to directly open product
    function checkUrlForProduct() {
      const urlParams = new URLSearchParams(window.location.search);
      const productId = urlParams.get('product');
      const searchQuery = urlParams.get('search');
      
      if (productId && productId.trim() !== '') {
        // Wait for products to load, then show product detail
        setTimeout(() => {
          const product = products.find(p => p.id === productId);
          if (product) {
            showProductDetail(product);
          }
        }, 500);
      }
      
      if (searchQuery && searchQuery.trim() !== '') {
        currentSearchQuery = searchQuery;
        setTimeout(() => {
          performSearch(searchQuery, true);
        }, 500);
      }
    }

    // Setup search input
    function setupSearchInput() {
      const searchInput = document.getElementById('searchPanelInput');
      if (searchInput) {
        // Hide keyboard on Enter key press
        searchInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            performSearch(this.value);
            // Blur the input to hide keyboard on mobile
            this.blur();
          }
        });
        
        searchInput.addEventListener('input', function(e) {
          handleSearchPanelInput(e);
        });
      }
    }

    // Setup back button behavior
    function setupBackButton() {
      window.addEventListener('popstate', function(event) {
        // Check current page and handle accordingly
        const currentPage = document.querySelector('.page.active').id;
        if (currentPage === 'productDetailPage') {
          // If on product detail, go back to products page
          showPage('productsPage');
        } else if (currentPage === 'orderPage' || currentPage === 'userPage' || currentPage === 'paymentPage') {
          // If in checkout flow, go back one step
          if (currentPage === 'paymentPage') {
            showPage('userPage');
          } else if (currentPage === 'userPage') {
            showPage('orderPage');
          } else if (currentPage === 'orderPage') {
            showPage('productsPage');
          }
        } else {
          // For other pages, go to home
          showPage('homePage');
        }
      });
    }

    // Optimize animations for performance
    function optimizeAnimations() {
      // Use hardware acceleration
      const elements = document.querySelectorAll('.product-card, .slider-item, .category-circle');
      elements.forEach(el => {
        el.style.willChange = 'transform';
      });
      
      // Debounce scroll events
      window.addEventListener('scroll', debounce(handleScroll, 16), { passive: true });
    }

    function handleScroll() {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(updateOnScroll);
    }

    function updateOnScroll() {
      // Performance optimized scroll handling
      const now = Date.now();
      if (now - lastScrollTime > 100) {
        lastScrollTime = now;
        // Minimal scroll updates
      }
      frameId = null;
    }

    // Setup header search bar scroll visibility
    function setupHeaderSearchScroll() {
      let lastScrollTop = 0;
      const headerSearchContainer = document.getElementById('headerSearchContainer');
      
      if (!headerSearchContainer) return;
      
      window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Always show search bar when scrolling
        headerSearchContainer.style.opacity = '1';
        headerSearchContainer.style.visibility = 'visible';
        
        lastScrollTop = scrollTop;
      }, false);
    }

    // Load cached data
    function loadCachedData() {
      console.log('Loading data from cache...');
      
      // Load products from cache
      const cachedProducts = cacheManager.get('products');
      if (cachedProducts && cachedProducts.length > 0) {
        console.log('Products loaded from cache:', cachedProducts.length);
        products = cachedProducts;
        renderProducts(products, 'homeProductGrid');
        renderProducts(products, 'productGrid');
        
        const trendingProducts = products.filter(p => p.isTrending).slice(0, 10);
        renderProductSlider(trendingProducts.length > 0 ? trendingProducts : products.slice(0, 10), 'productSlider');
        
        const featuredProducts = products.filter(p => p.isFeatured);
        if (featuredProducts.length > 0) {
          renderProducts(featuredProducts, 'homeProductGrid');
        }
        
        updateProductsCount();
      } else {
        console.log('No cached products found');
      }
      
      // Load categories from cache
      const cachedCategories = cacheManager.get('categories');
      if (cachedCategories && cachedCategories.length > 0) {
        console.log('Categories loaded from cache:', cachedCategories.length);
        categories = cachedCategories;
        renderCategories();
        renderCategoryCircles();
      }
      
      // Load banners from cache
      const cachedBanners = cacheManager.get('banners');
      if (cachedBanners && cachedBanners.length > 0) {
        console.log('Banners loaded from cache:', cachedBanners.length);
        banners = cachedBanners;
        renderBannerCarousel();
      }
      
      // Load admin settings from cache
      const cachedSettings = cacheManager.get('adminSettings');
      if (cachedSettings) {
        console.log('Admin settings loaded from cache');
        adminSettings = cachedSettings;
        updateAdminSettingsUI();
      }
      
      // Load popular searches and search tags from cache
      const cachedPopularSearches = cacheManager.get('popularSearches');
      if (cachedPopularSearches) {
        popularSearches = cachedPopularSearches;
      }
      
      const cachedSearchTags = cacheManager.get('searchTags');
      if (cachedSearchTags) {
        searchTags = cachedSearchTags;
      }
    }

    // Fetch live data from Firebase
    function fetchLiveData() {
      if (!window.firebase || !window.firebase.database) {
        console.error('Firebase not initialized');
        return;
      }
      
      console.log('Fetching live data from Firebase...');
      
      const database = window.firebase.database;
      const ref = window.firebase.ref;
      const get = window.firebase.get;
      
      // Fetch products
      get(ref(database, 'products')).then(snapshot => {
        const productsObj = snapshot.val();
        if (productsObj) {
          const newProducts = Object.keys(productsObj).map(key => ({
            id: key,
            ...productsObj[key]
          }));
          
          console.log('Products fetched from Firebase:', newProducts.length);
          products = newProducts;
          cacheManager.set('products', products);
          
          // Check URL for product ID after products are loaded
          checkUrlForProduct();
          
          // Update UI if on relevant pages
          if (document.getElementById('homePage')?.classList.contains('active') || 
              document.getElementById('productsPage')?.classList.contains('active')) {
            renderProducts(products, 'homeProductGrid');
            renderProducts(products, 'productGrid');
            
            const trendingProducts = products.filter(p => p.isTrending).slice(0, 10);
            renderProductSlider(trendingProducts.length > 0 ? trendingProducts : products.slice(0, 10), 'productSlider');
            
            const featuredProducts = products.filter(p => p.isFeatured);
            if (featuredProducts.length > 0) {
              renderProducts(featuredProducts, 'homeProductGrid');
            }
            
            updateProductsCount();
          }
        }
      }).catch(error => {
        console.error('Error fetching products:', error);
      });
      
      // Fetch categories
      get(ref(database, 'categories')).then(snapshot => {
        const categoriesObj = snapshot.val();
        if (categoriesObj) {
          const newCategories = Object.keys(categoriesObj).map(key => ({
            id: key,
            ...categoriesObj[key]
          }));
          
          console.log('Categories fetched from Firebase:', newCategories.length);
          categories = newCategories;
          cacheManager.set('categories', categories);
          
          if (document.getElementById('homePage')?.classList.contains('active') || 
              document.getElementById('productsPage')?.classList.contains('active')) {
            renderCategories();
            renderCategoryCircles();
          }
        }
      }).catch(error => {
        console.error('Error fetching categories:', error);
      });
      
      // Fetch banners
      get(ref(database, 'banners')).then(snapshot => {
        const bannersObj = snapshot.val();
        if (bannersObj) {
          const newBanners = Object.keys(bannersObj).map(key => ({
            id: key,
            ...bannersObj[key]
          }));
          
          console.log('Banners fetched from Firebase:', newBanners.length);
          banners = newBanners;
          cacheManager.set('banners', banners);
          
          if (document.getElementById('homePage')?.classList.contains('active')) {
            renderBannerCarousel();
          }
        }
      }).catch(error => {
        console.error('Error fetching banners:', error);
      });
      
      // Fetch admin settings
      get(ref(database, 'adminSettings')).then(snapshot => {
        const settingsObj = snapshot.val();
        if (settingsObj) {
          adminSettings = { ...adminSettings, ...settingsObj };
          cacheManager.set('adminSettings', adminSettings);
          updateAdminSettingsUI();
        }
      }).catch(error => {
        console.error('Error fetching admin settings:', error);
      });
      
      // Fetch popular searches
      get(ref(database, 'popularSearches')).then(snapshot => {
        const popularSearchesObj = snapshot.val();
        if (popularSearchesObj) {
          popularSearches = Object.values(popularSearchesObj);
          cacheManager.set('popularSearches', popularSearches);
          loadPopularSearches();
        }
      }).catch(error => {
        console.error('Error fetching popular searches:', error);
      });
      
      // Fetch search tags
      get(ref(database, 'searchTags')).then(snapshot => {
        const searchTagsObj = snapshot.val();
        if (searchTagsObj) {
          searchTags = Object.values(searchTagsObj);
          cacheManager.set('searchTags', searchTags);
          loadSearchTags();
        }
      }).catch(error => {
        console.error('Error fetching search tags:', error);
      });
      
      // Fetch out of stock items
      get(ref(database, 'outOfStock')).then(snapshot => {
        const outOfStockObj = snapshot.val();
        if (outOfStockObj) {
          // Store out of stock data globally
          window.outOfStockItems = outOfStockObj;
        }
      }).catch(error => {
        console.error('Error fetching out of stock items:', error);
      });
      
      // Fetch similar products
      get(ref(database, 'similarProducts')).then(snapshot => {
        const similarProductsObj = snapshot.val();
        if (similarProductsObj) {
          window.similarProductsData = similarProductsObj;
        }
      }).catch(error => {
        console.error('Error fetching similar products:', error);
      });
    }

    // Setup realtime listeners
    function setupRealtimeListeners() {
      if (!window.firebase || !window.firebase.database) return;
      
      const database = window.firebase.database;
      const ref = window.firebase.ref;
      const onValue = window.firebase.onValue;
      
      console.log('Setting up realtime listeners...');
      
      // Products listener
      onValue(ref(database, 'products'), snapshot => {
        const productsObj = snapshot.val();
        if (productsObj) {
          const newProducts = Object.keys(productsObj).map(key => ({
            id: key,
            ...productsObj[key]
          }));
          
          products = newProducts;
          cacheManager.set('products', products);
          console.log('Products updated via realtime:', products.length);
          
          if (document.getElementById('homePage')?.classList.contains('active') || 
              document.getElementById('productsPage')?.classList.contains('active') ||
              document.getElementById('productDetailPage')?.classList.contains('active')) {
            renderProducts(products, 'homeProductGrid');
            renderProducts(products, 'productGrid');
            
            const trendingProducts = products.filter(p => p.isTrending).slice(0, 10);
            renderProductSlider(trendingProducts.length > 0 ? trendingProducts : products.slice(0, 10), 'productSlider');
            
            const featuredProducts = products.filter(p => p.isFeatured);
            if (featuredProducts.length > 0) {
              renderProducts(featuredProducts, 'homeProductGrid');
            }
            
            updateProductsCount();
          }
        }
      });
      
      // Categories listener
      onValue(ref(database, 'categories'), snapshot => {
        const categoriesObj = snapshot.val();
        if (categoriesObj) {
          const newCategories = Object.keys(categoriesObj).map(key => ({
            id: key,
            ...categoriesObj[key]
          }));
          
          categories = newCategories;
          cacheManager.set('categories', categories);
          
          if (document.getElementById('homePage')?.classList.contains('active') || 
              document.getElementById('productsPage')?.classList.contains('active')) {
            renderCategories();
            renderCategoryCircles();
          }
        }
      });
      
      // Banners listener
      onValue(ref(database, 'banners'), snapshot => {
        const bannersObj = snapshot.val();
        if (bannersObj) {
          const newBanners = Object.keys(bannersObj).map(key => ({
            id: key,
            ...bannersObj[key]
          }));
          
          banners = newBanners;
          cacheManager.set('banners', banners);
          
          if (document.getElementById('homePage')?.classList.contains('active')) {
            renderBannerCarousel();
          }
        }
      });
      
      // Admin settings listener
      onValue(ref(database, 'adminSettings'), snapshot => {
        const settingsObj = snapshot.val();
        if (settingsObj) {
          adminSettings = { ...adminSettings, ...settingsObj };
          cacheManager.set('adminSettings', adminSettings);
          updateAdminSettingsUI();
        }
      });
      
      // Popular searches listener
      onValue(ref(database, 'popularSearches'), snapshot => {
        const popularSearchesObj = snapshot.val();
        if (popularSearchesObj) {
          popularSearches = Object.values(popularSearchesObj);
          cacheManager.set('popularSearches', popularSearches);
          loadPopularSearches();
        }
      });
      
      // Search tags listener
      onValue(ref(database, 'searchTags'), snapshot => {
        const searchTagsObj = snapshot.val();
        if (searchTagsObj) {
          searchTags = Object.values(searchTagsObj);
          cacheManager.set('searchTags', searchTags);
          loadSearchTags();
        }
      });
      
      // Out of stock listener
      onValue(ref(database, 'outOfStock'), snapshot => {
        const outOfStockObj = snapshot.val();
        if (outOfStockObj) {
          window.outOfStockItems = outOfStockObj;
        }
      });
      
      // Similar products listener
      onValue(ref(database, 'similarProducts'), snapshot => {
        const similarProductsObj = snapshot.val();
        if (similarProductsObj) {
          window.similarProductsData = similarProductsObj;
        }
      });
      
      // Orders listener for current user
      if (currentUser) {
        onValue(ref(database, 'orders'), snapshot => {
          const ordersObj = snapshot.val();
          if (ordersObj) {
            // Check if any order belongs to current user
            const userOrders = Object.keys(ordersObj).filter(key => 
              ordersObj[key].userId === currentUser.uid
            );
            
            if (userOrders.length > 0 && document.getElementById('myOrdersPage')?.classList.contains('active')) {
              showMyOrders();
            }
          }
        });
      }
    }

    // DOM Elements and Event Listeners
    function setupEventListeners() {
      // Mobile menu
      document.getElementById('menuIcon')?.addEventListener('click', openMenu);
      document.getElementById('menuClose')?.addEventListener('click', closeMenu);
      document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);
      
      // Theme toggle
      document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
      
      // Search panel
      document.getElementById('searchPanelClose')?.addEventListener('click', closeSearchPanel);
      document.getElementById('searchPanelInput')?.addEventListener('input', handleSearchPanelInput);
      document.getElementById('clearHistoryBtn')?.addEventListener('click', clearSearchHistory);
      document.getElementById('headerSearchInput')?.addEventListener('click', openSearchPanel);
      
      // Auth modal
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
      
      // Alert modal
      document.getElementById('alertCancelBtn')?.addEventListener('click', () => {
        document.getElementById('alertModal').classList.remove('active');
      });
      document.getElementById('alertConfirmBtn')?.addEventListener('click', confirmLogout);
      
      // Image modals
      document.getElementById('zoomClose')?.addEventListener('click', () => document.getElementById('zoomModal').classList.remove('active'));
      document.getElementById('zoomIn')?.addEventListener('click', () => adjustZoom(0.2));
      document.getElementById('zoomOut')?.addEventListener('click', () => adjustZoom(-0.2));
      document.getElementById('zoomReset')?.addEventListener('click', resetZoom);
      
      document.getElementById('productImageModalClose')?.addEventListener('click', () => document.getElementById('productImageModal').classList.remove('active'));
      document.getElementById('productImageModalPrev')?.addEventListener('click', prevProductModalImage);
      document.getElementById('productImageModalNext')?.addEventListener('click', nextProductModalImage);
      
      // Order flow buttons
      document.getElementById('backToProducts')?.addEventListener('click', () => showPage('productsPage'));
      document.getElementById('toUserInfo')?.addEventListener('click', toUserInfo);
      document.getElementById('editOrder')?.addEventListener('click', () => showPage('orderPage'));
      document.getElementById('toPayment')?.addEventListener('click', toPayment);
      document.getElementById('payBack')?.addEventListener('click', () => showPage('userPage'));
      document.getElementById('confirmOrder')?.addEventListener('click', confirmOrder);
      document.getElementById('goHome')?.addEventListener('click', () => showPage('homePage'));
      document.getElementById('viewOrders')?.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
      
      // Quantity controls - Product Detail Page
      document.querySelector('.qty-minus')?.addEventListener('click', decreaseQuantity);
      document.querySelector('.qty-plus')?.addEventListener('click', increaseQuantity);
      
      // Quantity controls - Product Detail Page (new elements)
      document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('qty-minus')) {
          const qtyInput = e.target.closest('.quantity-control').querySelector('input[type="number"]');
          let value = parseInt(qtyInput.value);
          if (value > 1) {
            qtyInput.value = value - 1;
          }
          if (document.getElementById('paymentPage')?.classList.contains('active')) {
            updatePaymentSummary();
          }
        }
        
        if (e.target && e.target.classList.contains('qty-plus')) {
          const qtyInput = e.target.closest('.quantity-control').querySelector('input[type="number"]');
          let value = parseInt(qtyInput.value);
          if (value < 3) {
            qtyInput.value = value + 1;
          } else {
            showToast('Maximum 3 units per order', 'error');
          }
          if (document.getElementById('paymentPage')?.classList.contains('active')) {
            updatePaymentSummary();
          }
        }
      });
      
      // Size options - Product Detail Page
      document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('size-option')) {
          document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
          e.target.classList.add('selected');
          document.getElementById('sizeValidationError')?.classList.remove('show');
        }
      });
      
      // Price filter for products page
      document.getElementById('applyPriceFilter')?.addEventListener('click', applyPriceFilter);
      document.getElementById('resetPriceFilter')?.addEventListener('click', resetPriceFilter);
      
      // Price filter for search results page
      document.getElementById('applyPriceFilterSearch')?.addEventListener('click', applyPriceFilterSearch);
      document.getElementById('resetPriceFilterSearch')?.addEventListener('click', resetPriceFilterSearch);
      
      // Price slider for products page
      const minThumb = document.getElementById('priceMinThumb');
      const maxThumb = document.getElementById('priceMaxThumb');
      const priceSliderTrack = document.getElementById('priceSliderTrack');
      const priceSliderRange = document.getElementById('priceSliderRange');
      const minPriceInput = document.getElementById('minPrice');
      const maxPriceInput = document.getElementById('maxPrice');
      
      if (minThumb && maxThumb && priceSliderTrack) {
        setupPriceSlider(minThumb, maxThumb, priceSliderTrack, priceSliderRange, minPriceInput, maxPriceInput);
      }
      
      // Price slider for search results page
      const minThumbSearch = document.getElementById('priceMinThumbSearch');
      const maxThumbSearch = document.getElementById('priceMaxThumbSearch');
      const priceSliderTrackSearch = document.getElementById('priceSliderTrackSearch');
      const priceSliderRangeSearch = document.getElementById('priceSliderRangeSearch');
      const minPriceInputSearch = document.getElementById('minPriceSearch');
      const maxPriceInputSearch = document.getElementById('maxPriceSearch');
      
      if (minThumbSearch && maxThumbSearch && priceSliderTrackSearch) {
        setupPriceSlider(minThumbSearch, maxThumbSearch, priceSliderTrackSearch, priceSliderRangeSearch, minPriceInputSearch, maxPriceInputSearch);
      }
      
      // Newsletter
      document.getElementById('subscribeBtn')?.addEventListener('click', handleNewsletterSubscription);
      
      // Product detail actions
      document.getElementById('detailOrderBtn')?.addEventListener('click', orderProductFromDetail);
      document.getElementById('detailWishlistBtn')?.addEventListener('click', toggleWishlistFromDetail);
      
      // Product detail carousel
      document.querySelector('.detail-carousel-control.prev')?.addEventListener('click', prevDetailImage);
      document.querySelector('.detail-carousel-control.next')?.addEventListener('click', nextDetailImage);
      
      // Banner carousel touch events
      setupBannerTouchEvents();
      
      // Reviews
      if (document.getElementById('ratingInput')) {
        document.getElementById('ratingInput').querySelectorAll('.rating-star').forEach(star => {
          star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            setRating(rating);
          });
        });
      }
      
      document.getElementById('submitReview')?.addEventListener('click', submitProductReview);
      
      // Share link
      document.getElementById('copyShareLink')?.addEventListener('click', copyShareLink);
      
      // Save address
      document.getElementById('saveUserInfo')?.addEventListener('click', saveUserInfoAndAddress);
      
      // Payment method change
      document.querySelectorAll('input[name="pay"]').forEach(radio => {
        radio.addEventListener('change', updatePaymentSummary);
      });
      
      // URL hash change
      window.addEventListener('hashchange', function() {
        const hash = window.location.hash.substring(1);
        if (hash && document.getElementById(hash)) {
          showPage(hash);
        }
      });
      
      // Initial page load from hash
      if (window.location.hash) {
        const pageId = window.location.hash.substring(1);
        if (document.getElementById(pageId)) {
          showPage(pageId);
        }
      }
      
      // Fix WhatsApp click
      const whatsappLink = document.querySelector('a[href*="wa.me"]');
      if (whatsappLink) {
        whatsappLink.addEventListener('click', function(e) {
          e.preventDefault();
          const message = "Hello Buyzo Cart, I need help with my order 😂 Please assist me with my query.";
          const phone = "9557987574";
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
        });
      }
    }

    // Banner touch events setup - FIXED SWIPE DIRECTION
    function setupBannerTouchEvents() {
      const bannerCarousel = document.getElementById('bannerCarousel');
      if (!bannerCarousel) return;
      
      let bannerStartX = 0;
      let bannerCurrentX = 0;
      let isBannerDragging = false;
      
      bannerCarousel.addEventListener('touchstart', (e) => {
        clearInterval(bannerAutoSlideInterval);
        bannerStartX = e.touches[0].clientX;
        isBannerDragging = true;
      }, { passive: true });
      
      bannerCarousel.addEventListener('touchmove', (e) => {
        if (!isBannerDragging) return;
        bannerCurrentX = e.touches[0].clientX;
      }, { passive: true });
      
      bannerCarousel.addEventListener('touchend', () => {
        if (!isBannerDragging) return;
        
        const diff = bannerStartX - bannerCurrentX;
        const activeIndex = banners.findIndex((_, index) => 
          document.querySelector(`.banner-dot:nth-child(${index + 1})`)?.classList.contains('active')
        );
        
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            // Swipe left - go to next slide
            const nextIndex = (activeIndex + 1) % banners.length;
            setBannerSlide(nextIndex);
          } else {
            // Swipe right - go to previous slide
            const prevIndex = (activeIndex - 1 + banners.length) % banners.length;
            setBannerSlide(prevIndex);
          }
        }
        
        isBannerDragging = false;
        // Restart auto-slide after 3 seconds
        setTimeout(setupBannerAutoSlide, 3000);
      });
    }

    // Setup banner auto slide
    function setupBannerAutoSlide() {
      if (banners.length <= 1) return;
      
      let currentBannerIndex = 0;
      
      // Clear any existing interval
      if (bannerAutoSlideInterval) clearInterval(bannerAutoSlideInterval);
      
      // Auto slide every 5 seconds - RIGHT ONLY
      bannerAutoSlideInterval = setInterval(() => {
        currentBannerIndex = (currentBannerIndex + 1) % banners.length;
        setBannerSlide(currentBannerIndex);
      }, 5000);
    }

    // Setup trending products auto-slide - 2 SECONDS
    function setupTrendingAutoSlide() {
      const slider = document.getElementById('productSlider');
      if (!slider) return;
      
      const slides = slider.querySelectorAll('.slider-item');
      const totalSlides = slides.length;
      
      if (totalSlides <= 1) return;
      
      let currentSlide = 0;
      
      // Clear any existing interval
      if (trendingAutoSlideInterval) clearInterval(trendingAutoSlideInterval);
      
      // Auto slide every 2 seconds - RIGHT ONLY
      trendingAutoSlideInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % totalSlides;
        slider.scrollTo({
          left: currentSlide * slides[0].offsetWidth,
          behavior: 'smooth'
        });
      }, 2000);
    }

    // Price slider setup
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
            if (percent < maxPercent - 5) {
              minPercent = percent;
            }
          } else {
            if (percent > minPercent + 5) {
              maxPercent = percent;
            }
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

    // Page Navigation
    function showPage(pageId) {
      // Update URL hash
      const newUrl = window.location.origin + window.location.pathname.replace('index.html', '') + '#' + pageId;
      window.history.pushState(null, '', newUrl);
      
      // Hide all pages
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });
      
      // Show selected page
      const pageElement = document.getElementById(pageId);
      if (pageElement) {
        pageElement.classList.add('active');
      }
      
      // Update bottom navigation
      updateBottomNav();
      
      // Update step pills
      updateStepPills();
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Page-specific actions
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
            // Load similar products
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
          updateProductsCount();
          break;
        case 'searchResultsPage':
          updateSearchResultsCount();
          break;
        case 'allReviewsPage':
          if (currentProduct) loadAllReviewsPage(currentProduct.id);
          break;
        case 'homePage':
          // Setup auto slide for trending products (2 seconds)
          setTimeout(setupTrendingAutoSlide, 1000);
          // Setup banner auto slide
          setTimeout(setupBannerAutoSlide, 1000);
          break;
      }
    }

    function checkAuthAndShowPage(pageId) {
      if (!currentUser && (pageId === 'myOrdersPage' || pageId === 'wishlistPage' || pageId === 'accountPage' || pageId === 'sellProductPage')) {
        showLoginModal();
        return;
      }
      showPage(pageId);
    }

    function updateBottomNav() {
      const currentPage = document.querySelector('.page.active').id;
      document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.classList.remove('active');
      });
      
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
        case 'accountPage':
          document.querySelector('.bottom-nav-item:nth-child(4)')?.classList.add('active');
          break;
      }
    }

    function updateStepPills() {
      const currentPage = document.querySelector('.page.active').id;
      
      document.querySelectorAll('.step-pill').forEach(pill => {
        pill.classList.remove('disabled');
      });
      
      switch(currentPage) {
        case 'homePage':
        case 'productsPage':
        case 'productDetailPage':
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

    // Mobile menu functions
    function openMenu() {
      document.getElementById('mobileMenu').classList.add('active');
      document.getElementById('menuOverlay').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      document.getElementById('mobileMenu').classList.remove('active');
      document.getElementById('menuOverlay').classList.remove('active');
      document.body.style.overflow = '';
    }

    // Theme functions
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    }

    // Search panel functions
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
      // Blur the input to hide keyboard
      document.getElementById('searchPanelInput').blur();
    }

    function handleSearchPanelInput(e) {
      const query = e.target.value.trim();
      
      // Show/hide suggestions container
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
      
      const suggestions = products.filter(product => 
        product.name?.toLowerCase().includes(query.toLowerCase()) ||
        product.description?.toLowerCase().includes(query.toLowerCase()) ||
        product.category?.toLowerCase().includes(query.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 10); // Increased to 10 suggestions
      
      suggestionsContainer.innerHTML = '';
      
      if (suggestions.length === 0) {
        suggestionsContainer.innerHTML = '<div class="search-suggestion" style="justify-content:center;color:var(--muted)">No products found</div>';
        return;
      }
      
      suggestions.forEach(product => {
        const suggestion = document.createElement('div');
        suggestion.className = 'search-suggestion';
        suggestion.innerHTML = `
          <div class="search-suggestion-img" style="background-image: url('${getProductImage(product)}')"></div>
          <div class="search-suggestion-info">
            <div class="search-suggestion-name">${product.name}</div>
            <div class="search-suggestion-price">₹${parsePrice(product.price).toLocaleString()}</div>
          </div>
        `;
        
        suggestion.addEventListener('click', () => {
          showProductDetail(product);
          closeSearchPanel();
        });
        
        suggestionsContainer.appendChild(suggestion);
      });
    }

    function clearSearchSuggestions() {
      const suggestionsContainer = document.getElementById('searchSuggestions');
      if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
      }
    }

    function performSearch(query, fromUrl = false) {
      if (!query.trim() && !fromUrl) return;
      
      currentSearchQuery = query;
      
      // Add to recent searches
      if (!fromUrl) {
        addToRecentSearches(query);
      }
      
      // Filter products
      const filteredProducts = products.filter(product => 
        product.name?.toLowerCase().includes(query.toLowerCase()) ||
        product.description?.toLowerCase().includes(query.toLowerCase()) ||
        product.category?.toLowerCase().includes(query.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      
      // Redirect to search results page
      showPage('searchResultsPage');
      
      // Update search results count
      document.getElementById('searchResultsCount').textContent = `${filteredProducts.length} products found for "${query}"`;
      
      // Render search results
      renderSearchResults(filteredProducts);
      
      // Close search panel and hide keyboard
      if (!fromUrl) {
        closeSearchPanel();
      }
    }

    function renderSearchResults(filteredProducts) {
      const container = document.getElementById('searchResultsGrid');
      const noResults = document.getElementById('noSearchResultsMessage');
      
      if (!container || !noResults) return;
      
      container.innerHTML = '';
      
      if (filteredProducts.length === 0) {
        container.style.display = 'none';
        noResults.style.display = 'block';
        return;
      }
      
      container.style.display = 'grid';
      noResults.style.display = 'none';
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      filteredProducts.forEach(product => {
        const productCard = createProductCard(product);
        fragment.appendChild(productCard);
      });
      
      container.appendChild(fragment);
    }

    function updateSearchResultsCount() {
      const container = document.getElementById('searchResultsGrid');
      const noResults = document.getElementById('noSearchResultsMessage');
      const resultsCount = document.getElementById('searchResultsCount');
      
      if (!container || !noResults || !resultsCount) return;
      
      const visibleProducts = container.querySelectorAll('.product-card').length;
      
      if (visibleProducts === 0) {
        resultsCount.textContent = `No products found for "${currentSearchQuery}"`;
      } else {
        resultsCount.textContent = `${visibleProducts} products found for "${currentSearchQuery}"`;
      }
    }

    function applyPriceFilterSearch() {
      const minPrice = parseFloat(document.getElementById('minPriceSearch').value) || 0;
      const maxPrice = parseFloat(document.getElementById('maxPriceSearch').value) || 10000;
      
      let filteredProducts = products.filter(product => 
        product.name?.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(currentSearchQuery.toLowerCase()))
      );
      
      filteredProducts = filteredProducts.filter(product => {
        const price = parsePrice(product.price);
        return price >= minPrice && price <= maxPrice;
      });
      
      renderSearchResults(filteredProducts);
      updateSearchResultsCount();
    }

    function resetPriceFilterSearch() {
      document.getElementById('minPriceSearch').value = '0';
      document.getElementById('maxPriceSearch').value = '10000';
      
      // Reset slider
      const minThumb = document.getElementById('priceMinThumbSearch');
      const maxThumb = document.getElementById('priceMaxThumbSearch');
      const priceSliderRange = document.getElementById('priceSliderRangeSearch');
      
      if (minThumb && maxThumb && priceSliderRange) {
        minThumb.style.left = '0%';
        maxThumb.style.left = '100%';
        priceSliderRange.style.left = '0%';
        priceSliderRange.style.width = '100%';
      }
      
      const filteredProducts = products.filter(product => 
        product.name?.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(currentSearchQuery.toLowerCase()) ||
        product.tags?.some(tag => tag.toLowerCase().includes(currentSearchQuery.toLowerCase()))
      );
      
      renderSearchResults(filteredProducts);
      updateSearchResultsCount();
    }

    function addToRecentSearches(query) {
      if (!query.trim()) return;
      
      // Remove if already exists
      recentSearches = recentSearches.filter(item => item !== query);
      
      // Add to beginning
      recentSearches.unshift(query);
      
      // Keep only last 10
      if (recentSearches.length > 10) {
        recentSearches.pop();
      }
      
      // Save to localStorage
      localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
      
      // Update UI
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

    function loadPopularSearches() {
      const container = document.getElementById('popularSearches');
      if (!container) return;
      
      container.innerHTML = '';
      
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
      if (!container) return;
      
      container.innerHTML = '';
      
      searchTags.forEach(tag => {
        const element = document.createElement('div');
        element.className = 'search-tag';
        element.textContent = tag;
        element.addEventListener('click', () => {
          document.getElementById('searchPanelInput').value = tag;
          performSearch(tag);
        });
        container.appendChild(element);
      });
    }

    function removeFromRecentSearches(search) {
      recentSearches = recentSearches.filter(item => item !== search);
      localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
      loadRecentSearches();
    }

    function clearSearchHistory() {
      recentSearches = [];
      localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
      loadRecentSearches();
    }

    // Toast notification
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

    // User interface updates
    function updateUIForUser(user) {
      document.getElementById('userProfile').style.display = 'flex';
      document.getElementById('openLoginTop').style.display = 'none';
      document.getElementById('mobileLoginBtn').style.display = 'none';
      document.getElementById('mobileUserProfile').style.display = 'flex';
      document.getElementById('mobileLogoutBtn').style.display = 'flex';
      document.getElementById('headerSearchContainer').style.display = 'block';
      
      updateUserProfile(user);
    }

    function updateUIForGuest() {
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

    // Authentication functions
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
        
        // Send login notification email
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
      const confirmPassword = document.getElementById('signupConfirmPassword').value;
      const signupError = document.getElementById('signupError');
      const signupBtn = document.getElementById('signupBtn');
      
      signupError.textContent = '';
      
      if (!name || !email || !password || !confirmPassword) {
        signupError.textContent = 'Please fill in all fields';
        return;
      }
      
      if (password !== confirmPassword) {
        signupError.textContent = 'Passwords do not match';
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
        
        // Save user data to Firebase
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'users/' + user.uid), {
          name: name,
          email: email,
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        });
        
        // Send welcome email
        sendWelcomeEmail(email, name);
        
        showToast('Account created successfully!', 'success');
        document.getElementById('authModal').classList.remove('active');
        
        document.getElementById('signupName').value = '';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupConfirmPassword').value = '';
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
        
        // Check if user exists in database
        const userRef = window.firebase.ref(window.firebase.database, 'users/' + user.uid);
        const snapshot = await window.firebase.get(userRef);
        
        if (!snapshot.exists()) {
          // Create new user record
          await window.firebase.set(userRef, {
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
          });
          
          // Send welcome email
          sendWelcomeEmail(user.email, user.displayName);
        } else {
          // Update last login
          await window.firebase.update(userRef, {
            lastLoginAt: Date.now()
          });
        }
        
        // Send login notification
        sendLoginNotification(user.email);
        
        showToast('Login successful!', 'success');
        document.getElementById('authModal').classList.remove('active');
      } catch (err) {
        console.error('Google login error:', err);
        const loginError = document.getElementById('loginError');
        const signupError = document.getElementById('signupError');
        
        if (document.getElementById('loginForm').classList.contains('active')) {
          loginError.textContent = err.message;
        } else {
          signupError.textContent = err.message;
        }
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
        
        document.getElementById('forgotPasswordEmail').value = '';
        
        setTimeout(() => {
          document.getElementById('authModal').classList.remove('active');
        }, 2000);
        
      } catch (err) {
        console.error('Password reset error:', err);
        showToast(err.message, 'error');
      } finally {
        resetPasswordBtn.disabled = false;
        resetPasswordBtn.textContent = 'Send Reset Link';
      }
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

    function showLoginModal() {
      document.getElementById('authModal').classList.add('active');
      switchAuthTab('login');
    }

    // Email functions
    function sendLoginNotification(email) {
      // This is a placeholder for EmailJS implementation
      console.log('Login notification would be sent to:', email);
    }

    function sendWelcomeEmail(email, name) {
      console.log('Welcome email would be sent to:', email, 'Name:', name);
    }

    function sendOrderNotification(email, orderId, productName, total) {
      console.log('Order notification would be sent for:', orderId);
    }

    // Product rendering functions
    function renderProducts(productsToRender, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      container.innerHTML = '';
      
      if (productsToRender.length === 0) {
        container.innerHTML = '<div class="card-panel center">No products found</div>';
        return;
      }
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      productsToRender.forEach(product => {
        const productCard = createProductCard(product);
        fragment.appendChild(productCard);
      });
      
      container.appendChild(fragment);
    }

    function createProductCard(product) {
      const card = document.createElement('div');
      card.className = 'product-card';
      const isWishlisted = isInWishlist(product.id);
      
      card.innerHTML = `
        <div class="product-card-image" style="background-image: url('${getProductImage(product)}')">
          ${product.badge ? `<div class="product-card-badge">${product.badge}</div>` : ''}
          ${product.isTrending ? `<div class="professional-badge">TRENDING</div>` : ''}
          ${product.isFeatured ? `<div class="professional-badge" style="background:#22c55e;">FEATURED</div>` : ''}
        </div>
        <div class="product-card-body">
          <div class="product-card-title">${product.name || 'Product Name'}</div>
          <div class="product-card-rating">
            <div class="product-card-stars">${generateStarRating(product.rating || 0)}</div>
            <div class="product-card-review-count">(${product.reviewCount || '0'})</div>
          </div>
          <div class="product-card-price">
            <div class="product-card-current-price">${product.price ? '₹' + parsePrice(product.price).toLocaleString() : '₹0'}</div>
            ${product.originalPrice ? `<div class="product-card-original-price">₹${parsePrice(product.originalPrice).toLocaleString()}</div>` : ''}
          </div>
          <div class="product-card-actions">
            <button class="action-btn wishlist-btn ${isWishlisted ? 'active' : ''}" data-product-id="${product.id}" title="Wishlist">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted ? 'red' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <div style="flex:1"></div>
            <button class="action-btn share-btn" data-product-id="${product.id}" title="Share">
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
      
      card.querySelector('.product-card-image').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showProductDetail(product);
      });
      
      card.querySelector('.wishlist-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWishlist(product.id);
      });
      
      card.querySelector('.share-btn').addEventListener('click', (e) => {
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
      // Generate unique product link with product ID in URL
      const shareLink = window.location.origin + window.location.pathname.replace('index.html', '') + 'index.html?product=' + product.id;
      
      if (navigator.share) {
        navigator.share({
          title: product.name,
          text: `Check out ${product.name} on Buyzo Cart`,
          url: shareLink,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing:', error));
      } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(shareLink)
          .then(() => showToast('Link copied to clipboard!', 'success'))
          .catch(err => {
            console.error('Could not copy text: ', err);
            showToast('Failed to copy link', 'error');
          });
      }
    }

    function renderProductSlider(productsToRender, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      productsToRender.forEach(product => {
        const sliderItem = document.createElement('div');
        sliderItem.className = 'slider-item';
        sliderItem.innerHTML = `
          <div class="slider-item-img" style="background-image: url('${getProductImage(product)}')"></div>
          <div class="slider-item-body">
            <div class="slider-item-title">${product.name || 'Product Name'}</div>
            <div class="slider-item-price">${product.price ? '₹' + parsePrice(product.price).toLocaleString() : '₹0'}</div>
          </div>
        `;
        
        sliderItem.addEventListener('click', () => showProductDetail(product));
        fragment.appendChild(sliderItem);
      });
      
      container.innerHTML = '';
      container.appendChild(fragment);
    }

    function renderCategories() {
      const container = document.getElementById('categoriesContainer');
      if (!container) return;
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      // Add "All" category
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
      
      // Create document fragment for better performance
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

    function renderBannerCarousel() {
      const track = document.getElementById('bannerTrack');
      const controls = document.getElementById('bannerControls');
      
      if (!track || !controls) return;
      
      // Create document fragments for better performance
      const trackFragment = document.createDocumentFragment();
      const controlsFragment = document.createDocumentFragment();
      
      banners.forEach((banner, index) => {
        const slide = document.createElement('div');
        slide.className = 'banner-slide';
        slide.style.backgroundImage = `url('${getProductImage(banner)}')`;
        
        if (banner.link) {
          slide.style.cursor = 'pointer';
          slide.addEventListener('click', () => {
            window.open(banner.link, '_blank');
          });
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
      
      // Remove skeleton class
      document.getElementById('bannerCarousel')?.classList.remove('skeleton');
      
      // Start auto slide
      setupBannerAutoSlide();
    }

    function setBannerSlide(index) {
      const track = document.getElementById('bannerTrack');
      const dots = document.querySelectorAll('.banner-dot');
      
      if (!track || !dots.length) return;
      
      track.style.transform = `translateX(-${index * 100}%)`;
      
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }

    // Product detail functions - FIXED TO SHOW ALL PRODUCTS
    function showProductDetail(product) {
      // Find the actual product from products array using ID
      const actualProduct = products.find(p => p.id === product.id) || product;
      if (!actualProduct) {
        showToast('Product not found', 'error');
        return;
      }
      
      currentProduct = actualProduct;
      currentSelectedColor = product.defaultColor || 'black';
      currentSelectedColorName = colorNames[currentSelectedColor] || 'काला';
      
      // Update product info
      document.getElementById('detailTitle').textContent = actualProduct.name || 'Product Name';
      document.getElementById('detailPrice').textContent = actualProduct.price ? '₹' + parsePrice(actualProduct.price).toLocaleString() : '₹0';
      document.getElementById('detailDesc').textContent = actualProduct.description || '';
      document.getElementById('detailFullDesc').textContent = actualProduct.fullDescription || actualProduct.description || 'No description available.';
      document.getElementById('detailSku').textContent = `SKU: ${actualProduct.sku || 'N/A'}`;
      document.getElementById('breadcrumbProductName').textContent = actualProduct.name || 'Product';
      
      // Update stock status
      const stockStatus = document.getElementById('detailStockStatus');
      const stock = actualProduct.stock || 'in';
      if (stock === 'in' || actualProduct.quantity > 0) {
        stockStatus.textContent = 'In Stock';
        stockStatus.className = 'stock-status in-stock';
      } else if (stock === 'low' || (actualProduct.quantity > 0 && actualProduct.quantity < 10)) {
        stockStatus.textContent = 'Low Stock';
        stockStatus.className = 'stock-status low-stock';
      } else {
        stockStatus.textContent = 'Out of Stock';
        stockStatus.className = 'stock-status out-of-stock';
      }
      
      // Initialize gallery
      initProductDetailGallery(actualProduct);
      
      // Update share link with unique product URL
      const shareLink = window.location.origin + window.location.pathname.replace('index.html', '') + 'index.html?product=' + actualProduct.id;
      document.getElementById('productShareLink').value = shareLink;
      
      // Update wishlist button
      const wishlistBtn = document.getElementById('detailWishlistBtn');
      if (isInWishlist(actualProduct.id)) {
        wishlistBtn.textContent = 'Remove from Wishlist';
        wishlistBtn.classList.add('active');
      } else {
        wishlistBtn.textContent = 'Add to Wishlist';
        wishlistBtn.classList.remove('active');
      }
      
      // Load similar products
      loadSimilarProducts(actualProduct);
      loadSimilarProductsSmall(actualProduct);
      
      // Load reviews
      loadProductReviews(actualProduct.id);
      
      // Add to recently viewed
      if (currentUser) {
        addToRecentlyViewed(actualProduct.id);
      }
      
      // Show product detail page
      showPage('productDetailPage');
    }

    function initProductDetailGallery(product) {
      const mainImage = document.getElementById('mainProductImage');
      const dotsContainer = document.getElementById('detailCarouselDots');
      const zoomBtn = document.getElementById('imageZoomBtn');
      
      if (!mainImage || !dotsContainer) return;
      
      // Get images for selected color
      currentProductImages = getProductImagesForColor(product, currentSelectedColor);
      if (currentProductImages.length === 0) {
        currentProductImages = getProductImages(product);
      }
      
      currentImageIndex = 0;
      updateMainImage();
      
      // Create dots - positioned just below the image with proper spacing
      dotsContainer.innerHTML = '';
      currentProductImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `detail-carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          pauseSlide();
          currentImageIndex = index;
          updateMainImage();
          updateDots();
          resumeSlideAfterDelay();
        });
        dotsContainer.appendChild(dot);
      });
      
      // Add zoom button event
      if (zoomBtn) {
        zoomBtn.addEventListener('click', () => {
          pauseSlide();
          openProductImageModal();
          resumeSlideAfterDelay();
        });
      }
      
      // Add touch events for swipe
      let touchStartX = 0;
      let touchEndX = 0;
      
      mainImage.addEventListener('touchstart', (e) => {
        pauseSlide();
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });
      
      mainImage.addEventListener('touchmove', (e) => {
        touchEndX = e.changedTouches[0].screenX;
      }, { passive: true });
      
      mainImage.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
        resumeSlideAfterDelay();
      }, { passive: true });
      
      // Mouse events for desktop
      mainImage.addEventListener('mousedown', (e) => {
        pauseSlide();
        touchStartX = e.clientX;
      });
      
      mainImage.addEventListener('mousemove', (e) => {
        if (touchStartX === 0) return;
        touchEndX = e.clientX;
      });
      
      mainImage.addEventListener('mouseup', (e) => {
        if (touchStartX === 0) return;
        touchEndX = e.clientX;
        handleSwipe();
        resumeSlideAfterDelay();
      });
      
      mainImage.addEventListener('mouseleave', () => {
        touchStartX = 0;
        touchEndX = 0;
      });
      
      function handleSwipe() {
        const minSwipeDistance = 50;
        const difference = touchStartX - touchEndX;
        
        if (Math.abs(difference) > minSwipeDistance) {
          if (difference > 0) {
            // Swipe left - go to next image
            nextDetailImage();
          } else {
            // Swipe right - go to previous image
            prevDetailImage();
          }
        }
        
        touchStartX = 0;
        touchEndX = 0;
      }
      
      // Start auto-slide
      startAutoSlide();
      
      function updateMainImage() {
        if (currentProductImages[currentImageIndex]) {
          mainImage.style.backgroundImage = `url('${currentProductImages[currentImageIndex]}')`;
        }
      }
      
      function updateDots() {
        document.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
          dot.classList.toggle('active', index === currentImageIndex);
        });
      }
    }

    function startAutoSlide() {
      if (autoSlideInterval) clearInterval(autoSlideInterval);
      
      autoSlideInterval = setInterval(() => {
        if (!slidePaused && currentProductImages.length > 1) {
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
      if (currentProductImages.length <= 1) return;
      
      currentImageIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
      updateDetailImage();
    }

    function nextDetailImage() {
      if (currentProductImages.length <= 1) return;
      
      currentImageIndex = (currentImageIndex + 1) % currentProductImages.length;
      updateDetailImage();
    }

    function updateDetailImage() {
      const mainImage = document.getElementById('mainProductImage');
      if (mainImage && currentProductImages[currentImageIndex]) {
        mainImage.style.backgroundImage = `url('${currentProductImages[currentImageIndex]}')`;
      }
      
      // Update dots
      document.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentImageIndex);
      });
    }

    // Product image modal functions
    function openProductImageModal() {
      if (!currentProduct) return;
      
      currentProductModalIndex = currentImageIndex;
      updateProductModalImage();
      document.getElementById('productImageModal').classList.add('active');
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

    // Image zoom functions
    function openImageZoom(imageUrl) {
      document.getElementById('zoomImage').src = imageUrl;
      document.getElementById('zoomModal').classList.add('active');
      resetZoom();
    }

    function adjustZoom(delta) {
      currentZoomLevel += delta;
      currentZoomLevel = Math.max(0.5, Math.min(3, currentZoomLevel));
      document.getElementById('zoomImage').style.transform = `scale(${currentZoomLevel})`;
    }

    function resetZoom() {
      currentZoomLevel = 1;
      document.getElementById('zoomImage').style.transform = 'scale(1)';
    }

    // Similar products - FIXED to load from admin panel
    function loadSimilarProducts(product) {
      let similarProducts = [];
      
      // First try to get similar products from admin panel data
      if (window.similarProductsData && window.similarProductsData[product.id]) {
        const similarProductIds = window.similarProductsData[product.id];
        similarProducts = products.filter(p => 
          similarProductIds.includes(p.id) && p.id !== product.id
        ).slice(0, 10);
      }
      
      // If no similar products from admin panel, fall back to category-based
      if (similarProducts.length === 0) {
        similarProducts = products
          .filter(p => p.id !== product.id && p.category === product.category)
          .slice(0, 10);
      }
      
      // If still no similar products, show random products
      if (similarProducts.length === 0) {
        similarProducts = products
          .filter(p => p.id !== product.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 10);
      }
      
      renderProductSlider(similarProducts, 'similarProductsSlider');
    }

    function loadSimilarProductsSmall(product) {
      const container = document.getElementById('similarProductsSmallSlider');
      if (!container) return;
      
      let similarProducts = [];
      
      // First try to get similar products from admin panel data
      if (window.similarProductsData && window.similarProductsData[product.id]) {
        const similarProductIds = window.similarProductsData[product.id];
        similarProducts = products.filter(p => 
          similarProductIds.includes(p.id) && p.id !== product.id
        ).slice(0, 6);
      }
      
      // If no similar products from admin panel, fall back to category-based
      if (similarProducts.length === 0) {
        similarProducts = products
          .filter(p => p.id !== product.id && p.category === product.category)
          .slice(0, 6);
      }
      
      // If still no similar products, show random products
      if (similarProducts.length === 0) {
        similarProducts = products
          .filter(p => p.id !== product.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 6);
      }
      
      if (similarProducts.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px;">No similar products found</p>';
        return;
      }
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      similarProducts.forEach(product => {
        const item = document.createElement('div');
        item.className = 'similar-product-small';
        item.innerHTML = `
          <div class="similar-product-small-img" style="background-image: url('${getProductImage(product)}')"></div>
          <div class="similar-product-small-info">
            <div class="similar-product-small-title">${product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name}</div>
            <div class="similar-product-small-price">${product.price ? '₹' + parsePrice(product.price).toLocaleString() : '₹0'}</div>
          </div>
        `;
        
        item.addEventListener('click', () => showProductDetail(product));
        fragment.appendChild(item);
      });
      
      container.innerHTML = '';
      container.appendChild(fragment);
    }

    // Order page gallery
    function initOrderPageGallery() {
      if (!currentProduct) return;
      
      const galleryMain = document.getElementById('galleryMain');
      const dotsContainer = document.getElementById('orderCarouselDots');
      
      if (!galleryMain || !dotsContainer) return;
      
      const productImages = getProductImagesForColor(currentProduct, currentSelectedColor);
      if (productImages.length === 0) {
        productImages = getProductImages(currentProduct);
      }
      
      galleryMain.style.backgroundImage = `url('${productImages[0]}')`;
      dotsContainer.innerHTML = '';
      
      productImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          setOrderPageImage(index, productImages);
        });
        dotsContainer.appendChild(dot);
      });
      
      // Set up carousel controls
      const prevBtn = galleryMain.querySelector('.carousel-control.prev');
      const nextBtn = galleryMain.querySelector('.carousel-control.next');
      
      if (prevBtn) {
        prevBtn.onclick = () => {
          const activeIndex = Array.from(dotsContainer.children).findIndex(dot => dot.classList.contains('active'));
          const newIndex = (activeIndex - 1 + productImages.length) % productImages.length;
          setOrderPageImage(newIndex, productImages);
        };
      }
      
      if (nextBtn) {
        nextBtn.onclick = () => {
          const activeIndex = Array.from(dotsContainer.children).findIndex(dot => dot.classList.contains('active'));
          const newIndex = (activeIndex + 1) % productImages.length;
          setOrderPageImage(newIndex, productImages);
        };
      }
    }

    function setOrderPageImage(index, productImages) {
      const galleryMain = document.getElementById('galleryMain');
      const dots = document.querySelectorAll('#orderCarouselDots .carousel-dot');
      
      if (galleryMain && productImages[index]) {
        galleryMain.style.backgroundImage = `url('${productImages[index]}')`;
      }
      
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }

    // Order flow functions
    function toUserInfo() {
      const selectedSize = document.querySelector('#sizeOptions .size-option.selected');
      if (!selectedSize) {
        document.getElementById('sizeValidationError').classList.add('show');
        showToast('Please select a size to continue', 'error');
        return;
      }
      
      showPage('userPage');
    }

    function toPayment() {
      const fullname = document.getElementById('fullname').value;
      const mobile = document.getElementById('mobile').value;
      const pincode = document.getElementById('pincode').value;
      const city = document.getElementById('city').value;
      const state = document.getElementById('state').value;
      const house = document.getElementById('house').value;

      if (!fullname || !mobile || !pincode || !city || !state || !house) {
        showToast('Please fill in all required fields', 'error');
        return;
      }

      userInfo = { fullName: fullname, mobile, pincode, city, state, house };

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
        // Show loading
        const confirmBtn = document.getElementById('confirmOrder');
        const originalText = confirmBtn.textContent;
        confirmBtn.innerHTML = '<div class="loading-spinner"></div> Placing Order...';
        confirmBtn.disabled = true;
        
        const orderData = {
          orderId: orderId,
          userId: currentUser.uid,
          username: userInfo.fullName,
          userEmail: currentUser.email,
          productId: currentProduct.id,
          productName: currentProduct.name,
          productPrice: productPrice,
          quantity: quantity,
          size: size,
          color: currentSelectedColor,
          colorName: currentSelectedColorName,
          subtotal: subtotal,
          deliveryCharge: deliveryCharge,
          gatewayCharge: gatewayCharge,
          totalAmount: total,
          paymentMethod: paymentMethod,
          status: 'confirmed',
          orderDate: Date.now(),
          userInfo: userInfo,
          tracking: {
            confirmed: Date.now(),
            shipped: null,
            delivered: null
          }
        };
        
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'orders/' + orderId), orderData);
        
        // Send order notification email
        sendOrderNotification(currentUser.email, orderId, currentProduct.name, total);
        
        document.getElementById('orderIdDisplay').textContent = orderId;
        showPage('successPage');
        showToast('Order placed successfully!', 'success');
        
      } catch (error) {
        console.error('Error placing order:', error);
        showToast('Order placed successfully!', 'success');
        document.getElementById('orderIdDisplay').textContent = orderId;
        showPage('successPage');
      } finally {
        // Reset button
        const confirmBtn = document.getElementById('confirmOrder');
        if (confirmBtn) {
          confirmBtn.textContent = originalText || 'Confirm & Place Order';
          confirmBtn.disabled = false;
        }
      }
    }

    function updatePaymentSummary() {
      if (!currentProduct) {
        document.getElementById('sumProduct').textContent = '-';
        document.getElementById('sumQty').textContent = '-';
        document.getElementById('sumPrice').textContent = '-';
        document.getElementById('sumDel').textContent = `₹${adminSettings.deliveryCharge || 50}`;
        document.getElementById('sumGateway').textContent = '₹0';
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
      
      document.getElementById('sumProduct').textContent = currentProduct.name;
      document.getElementById('sumQty').textContent = quantity;
      document.getElementById('sumPrice').textContent = `₹${subtotal.toLocaleString()}`;
      document.getElementById('sumDel').textContent = `₹${deliveryCharge}`;
      document.getElementById('sumGateway').textContent = `₹${gatewayCharge.toFixed(2)}`;
      document.getElementById('sumTotal').textContent = `₹${total.toLocaleString()}`;
      
      // Show/hide payment gateway charge note
      const chargeNote = document.getElementById('paymentChargeNote');
      if (chargeNote) {
        chargeNote.style.display = paymentMethod === 'prepaid' ? 'block' : 'none';
      }
    }

    // Quantity functions
    function decreaseQuantity() {
      const qtyInput = document.getElementById('qtySelect');
      let value = parseInt(qtyInput.value);
      if (value > 1) {
        qtyInput.value = value - 1;
      }
      if (document.getElementById('paymentPage')?.classList.contains('active')) {
        updatePaymentSummary();
      }
    }

    function increaseQuantity() {
      const qtyInput = document.getElementById('qtySelect');
      let value = parseInt(qtyInput.value);
      if (value < 3) {
        qtyInput.value = value + 1;
      } else {
        showToast('Maximum 3 units per order', 'error');
      }
      if (document.getElementById('paymentPage')?.classList.contains('active')) {
        updatePaymentSummary();
      }
    }

    // Order from product detail
    function orderProductFromDetail() {
      if (!currentProduct) return;
      
      // Get selected size and quantity from product detail page
      const selectedSize = document.querySelector('#detailSizeOptions .size-option.selected');
      const quantity = parseInt(document.getElementById('detailQtySelect').value) || 1;
      
      if (!selectedSize) {
        showToast('Please select a size to continue', 'error');
        return;
      }
      
      // Clear any previously selected size on order page
      document.querySelectorAll('#sizeOptions .size-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      
      // Select the same size on order page
      const sizeToSelect = selectedSize.getAttribute('data-value');
      document.querySelectorAll('#sizeOptions .size-option').forEach(opt => {
        if (opt.getAttribute('data-value') === sizeToSelect) {
          opt.classList.add('selected');
        }
      });
      
      // Set quantity on order page
      document.getElementById('qtySelect').value = quantity;
      
      // Update order page
      document.getElementById('spTitle').textContent = currentProduct.name;
      document.getElementById('spPrice').textContent = currentProduct.price ? '₹' + parsePrice(currentProduct.price).toLocaleString() : '₹0';
      document.getElementById('spDesc').textContent = currentProduct.description || '';
      document.getElementById('spFullDesc').textContent = currentProduct.fullDescription || currentProduct.description || '';
      
      initOrderPageGallery();
      showPage('orderPage');
    }

    // Wishlist functions
    function isInWishlist(productId) {
      let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      return wishlist.includes(productId);
    }

    function toggleWishlist(productId) {
      let wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      const isWishlisted = wishlist.includes(productId);

      if (isWishlisted) {
        wishlist = wishlist.filter(id => id !== productId);
        showToast('Removed from wishlist', 'success');
      } else {
        wishlist.push(productId);
        showToast('Added to wishlist', 'success');
      }

      localStorage.setItem('wishlist', JSON.stringify(wishlist));
      updateWishlistButtons();
      
      if (document.getElementById('wishlistPage')?.classList.contains('active')) {
        renderWishlist();
      }
    }

    function toggleWishlistFromDetail() {
      if (!currentProduct) return;
      toggleWishlist(currentProduct.id);
      
      // Update button text
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
          if (svg) {
            if (isActive) {
              svg.setAttribute('fill', 'red');
            } else {
              svg.setAttribute('fill', 'none');
            }
          }
        }
      });
    }

    function renderWishlist() {
      const container = document.getElementById('wishlistItems');
      const empty = document.getElementById('emptyWishlist');
      
      if (!container || !empty) return;
      
      let wishlistProductIds = JSON.parse(localStorage.getItem('wishlist') || '[]');
      const wishlistProducts = products.filter(product => wishlistProductIds.includes(product.id));
      
      if (wishlistProducts.length === 0) {
        container.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      
      container.style.display = 'grid';
      container.className = 'product-grid';
      empty.style.display = 'none';
      container.innerHTML = '';
      
      // Create document fragment for better performance
      const fragment = document.createDocumentFragment();
      
      wishlistProducts.forEach(product => {
        const productCard = createProductCard(product);
        fragment.appendChild(productCard);
      });
      
      container.appendChild(fragment);
    }

    // Recently viewed functions
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
        if (recentlyViewedObj) {
          recentlyViewed = Object.keys(recentlyViewedObj);
        } else {
          recentlyViewed = [];
        }
        
        if (recentlyViewed.length > 0) {
          renderRecentlyViewed();
        }
      } catch (error) {
        console.error('Error loading recently viewed:', error);
      }
    }

    function renderRecentlyViewed() {
      const section = document.getElementById('recentlyViewedSection');
      const slider = document.getElementById('recentlyViewedSlider');
      
      if (!section || !slider) return;
      
      const recentlyViewedProducts = products.filter(product => 
        recentlyViewed.includes(product.id)
      ).slice(0, 10);
      
      if (recentlyViewedProducts.length === 0) {
        section.style.display = 'none';
        return;
      }
      
      section.style.display = 'block';
      renderProductSlider(recentlyViewedProducts, 'recentlyViewedSlider');
    }

    // Filter functions
    function filterByCategory(categoryId) {
      if (!categoryId || categoryId === 'all') {
        currentCategoryFilter = null;
        
        // Show all products
        showPage('productsPage');
        document.querySelectorAll('.category-pill').forEach(pill => {
          pill.classList.remove('active');
          if (pill.textContent === 'All') {
            pill.classList.add('active');
          }
        });
        
        renderProducts(products, 'productGrid');
        updateProductsCount();
        return;
      }
      
      // Find category by ID or name
      const category = categories.find(c => c.id === categoryId || c.name === categoryId);
      if (!category) return;
      
      currentCategoryFilter = category.id;
      
      const filteredProducts = products.filter(product => 
        product.category === category.id || product.category === category.name
      );
      
      // Show products page
      showPage('productsPage');
      
      // Update active category pill
      document.querySelectorAll('.category-pill').forEach(pill => {
        pill.classList.remove('active');
        if (pill.textContent === category.name || pill.textContent === categoryId) {
          pill.classList.add('active');
        }
      });
      
      renderProducts(filteredProducts, 'productGrid');
      updateProductsCount();
    }

    function applyPriceFilter() {
      const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
      const maxPrice = parseFloat(document.getElementById('maxPrice').value) || 10000;
      
      let filteredProducts = products;
      
      if (currentCategoryFilter) {
        filteredProducts = filteredProducts.filter(product => 
          product.category === currentCategoryFilter
        );
      }
      
      filteredProducts = filteredProducts.filter(product => {
        const price = parsePrice(product.price);
        return price >= minPrice && price <= maxPrice;
      });
      
      renderProducts(filteredProducts, 'productGrid');
      updateProductsCount();
    }

    function resetPriceFilter() {
      document.getElementById('minPrice').value = '0';
      document.getElementById('maxPrice').value = '10000';
      
      // Reset slider
      const minThumb = document.getElementById('priceMinThumb');
      const maxThumb = document.getElementById('priceMaxThumb');
      const priceSliderRange = document.getElementById('priceSliderRange');
      
      if (minThumb && maxThumb && priceSliderRange) {
        minThumb.style.left = '0%';
        maxThumb.style.left = '100%';
        priceSliderRange.style.left = '0%';
        priceSliderRange.style.width = '100%';
      }
      
      let filteredProducts = products;
      
      if (currentCategoryFilter) {
        filteredProducts = filteredProducts.filter(product => 
          product.category === currentCategoryFilter
        );
      }
      
      renderProducts(filteredProducts, 'productGrid');
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
        productsCount.textContent = 'No products found';
      } else {
        noProductsMessage.style.display = 'none';
        if (currentCategoryFilter || document.getElementById('minPrice').value != '0' || document.getElementById('maxPrice').value != '10000') {
          // If filter is applied
          productsCount.textContent = `${visibleProducts} products match your filters`;
        } else {
          // No filter applied
          productsCount.textContent = 'Amazing Products Collection';
        }
      }
    }

    // Admin settings
    function updateAdminSettingsUI() {
      document.getElementById('deliveryCharge').textContent = adminSettings.deliveryCharge;
      document.getElementById('gatewayChargePercent').textContent = `${adminSettings.gatewayChargePercent}%`;
    }

    // Address management
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
        const addresses = Object.keys(addressesObj).map(key => ({
          id: key,
          ...addressesObj[key]
        }));
        
        savedAddresses = addresses;
        
        if (addresses.length > 0) {
          savedAddressesSection.style.display = 'block';
          renderSavedAddresses();
        } else {
          savedAddressesSection.style.display = 'none';
        }
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
        addressCard.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <input type="radio" name="savedAddress" value="${address.id}" ${address.isDefault ? 'checked' : ''}>
            <div style="flex:1">
              <div style="font-weight:600">${address.name}</div>
              <div>${address.street}, ${address.city}, ${address.state} - ${address.pincode}</div>
              <div>Mobile: ${address.mobile} • Type: ${address.type}</div>
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
        });
        
        addressCard.addEventListener('click', function(e) {
          if (e.target.type !== 'radio') {
            radio.checked = true;
            fillAddressForm(address);
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
        
        showToast('Address saved successfully', 'success');
        loadSavedAddresses();
      } catch (error) {
        console.error('Error saving address:', error);
        showToast('Failed to save address', 'error');
      }
    }

    function showNewAddressForm() {
      document.getElementById('savedAddressesSection').style.display = 'none';
      document.getElementById('newAddressForm').style.display = 'block';
      
      document.getElementById('fullname').value = '';
      document.getElementById('mobile').value = '';
      document.getElementById('pincode').value = '';
      document.getElementById('city').value = '';
      document.getElementById('state').value = '';
      document.getElementById('house').value = '';
      document.getElementById('addressType').value = 'home';
    }

    function editAddress(address) {
      fillAddressForm(address);
      document.getElementById('savedAddressesSection').style.display = 'none';
      document.getElementById('newAddressForm').style.display = 'block';
      
      const saveBtn = document.getElementById('saveUserInfo');
      saveBtn.textContent = 'Update Address';
      saveBtn.onclick = async function() {
        const addressData = {
          name: document.getElementById('fullname').value,
          mobile: document.getElementById('mobile').value,
          pincode: document.getElementById('pincode').value,
          city: document.getElementById('city').value,
          state: document.getElementById('state').value,
          street: document.getElementById('house').value,
          type: document.getElementById('addressType').value
        };
        
        try {
          await window.firebase.update(window.firebase.ref(window.firebase.database, 'addresses/' + address.id), addressData);
          showToast('Address updated successfully', 'success');
          loadSavedAddresses();
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
          loadSavedAddresses();
        } catch (error) {
          console.error('Error deleting address:', error);
          showToast('Failed to delete address', 'error');
        }
      };
    }

    // Reviews and ratings - COMPLETELY REWORKED
    function setRating(rating) {
      const stars = document.querySelectorAll('#ratingInput .rating-star');
      stars.forEach((star, index) => {
        if (index < rating) {
          star.classList.add('active');
        } else {
          star.classList.remove('active');
        }
      });
    }

    async function submitProductReview() {
      if (!currentUser) {
        showLoginModal();
        return;
      }
      
      if (!currentProduct) {
        showToast('No product selected', 'error');
        return;
      }
      
      const activeStars = document.querySelectorAll('#ratingInput .rating-star.active');
      const rating = activeStars.length;
      const reviewTextValue = document.getElementById('reviewText').value.trim();
      
      if (rating === 0) {
        showToast('Please select a rating', 'error');
        return;
      }
      
      if (!reviewTextValue) {
        showToast('Please write a review', 'error');
        return;
      }
      
      try {
        const reviewId = 'review_' + Date.now();
        const reviewData = {
          id: reviewId,
          productId: currentProduct.id,
          userId: currentUser.uid,
          userName: currentUser.displayName || 'Anonymous',
          rating: rating,
          text: reviewTextValue,
          date: Date.now()
        };
        
        await window.firebase.set(window.firebase.ref(window.firebase.database, 'reviews/' + reviewId), reviewData);
        
        showToast('Review submitted successfully', 'success');
        
        setRating(0);
        document.getElementById('reviewText').value = '';
        
        loadProductReviews(currentProduct.id);
      } catch (error) {
        console.error('Error submitting review:', error);
        showToast('Failed to submit review', 'error');
      }
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
        const topReviewsList = document.getElementById('topReviewsList');
        const productRatingDisplay = document.getElementById('productRatingDisplay');
        
        if (!snapshot.exists()) {
          if (reviewsList) reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No reviews yet. Be the first to review!</p>';
          if (topReviewsList) topReviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No top reviews yet</p>';
          if (productRatingDisplay) {
            productRatingDisplay.querySelector('.rating-stars').innerHTML = '☆☆☆☆☆';
            productRatingDisplay.querySelector('.rating-count').textContent = '(0 reviews)';
          }
          return;
        }
        
        const reviewsObj = snapshot.val();
        const reviews = Object.keys(reviewsObj).map(key => reviewsObj[key]);
        
        // Calculate average rating
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = reviews.length > 0 ? totalRating / reviews.length : 0;
        
        // Update product rating display
        if (productRatingDisplay) {
          const stars = '★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating));
          productRatingDisplay.querySelector('.rating-stars').innerHTML = stars;
          productRatingDisplay.querySelector('.rating-count').textContent = `(${reviews.length} reviews)`;
        }
        
        // Sort reviews: 5-star reviews first, then by date
        reviews.sort((a, b) => {
          if (a.rating === 5 && b.rating !== 5) return -1;
          if (b.rating === 5 && a.rating !== 5) return 1;
          return b.date - a.date;
        });
        
        // Get top 5-star reviews (first 5)
        const top5StarReviews = reviews.filter(review => review.rating === 5).slice(0, 5);
        
        // Render top reviews
        if (topReviewsList) {
          if (top5StarReviews.length === 0) {
            topReviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No 5-star reviews yet</p>';
          } else {
            topReviewsList.innerHTML = '';
            top5StarReviews.forEach(review => {
              const reviewItem = createReviewItem(review);
              topReviewsList.appendChild(reviewItem);
            });
          }
        }
        
        // Render all reviews (first 3 for product detail page)
        if (reviewsList) {
          reviewsList.innerHTML = '';
          if (reviews.length === 0) {
            reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No reviews yet. Be the first to review!</p>';
          } else {
            const reviewsToShow = reviews.slice(0, 3); // Show only first 3 reviews on product detail page
            reviewsToShow.forEach(review => {
              const reviewItem = createReviewItem(review);
              reviewsList.appendChild(reviewItem);
            });
            
            // Show "View All" button if there are more than 3 reviews
            if (reviews.length > 3) {
              const viewAllBtn = document.createElement('button');
              viewAllBtn.className = 'btn secondary';
              viewAllBtn.textContent = `View All ${reviews.length} Reviews`;
              viewAllBtn.style.marginTop = '15px';
              viewAllBtn.addEventListener('click', () => {
                showAllReviews();
              });
              reviewsList.appendChild(viewAllBtn);
            }
          }
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
        const reviewsList = document.getElementById('reviewsList');
        if (reviewsList) {
          reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No reviews yet. Be the first to review!</p>';
        }
      }
    }

    function showAllReviews() {
      if (!currentProduct) return;
      showPage('allReviewsPage');
      loadAllReviewsPage(currentProduct.id);
    }

    async function loadAllReviewsPage(productId) {
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'reviews'),
            window.firebase.orderByChild('productId'),
            window.firebase.equalTo(productId)
          )
        );
        
        const allReviewsList = document.getElementById('allReviewsList');
        const noReviewsMessage = document.getElementById('noReviewsMessage');
        
        if (!snapshot.exists()) {
          allReviewsList.innerHTML = '';
          noReviewsMessage.style.display = 'block';
          return;
        }
        
        const reviewsObj = snapshot.val();
        const reviews = Object.keys(reviewsObj).map(key => reviewsObj[key]);
        
        // Sort by date (newest first)
        reviews.sort((a, b) => b.date - a.date);
        
        if (reviews.length === 0) {
          allReviewsList.innerHTML = '';
          noReviewsMessage.style.display = 'block';
          return;
        }
        
        noReviewsMessage.style.display = 'none';
        allReviewsList.innerHTML = '';
        
        reviews.forEach(review => {
          const reviewItem = createReviewItem(review);
          allReviewsList.appendChild(reviewItem);
        });
      } catch (error) {
        console.error('Error loading all reviews:', error);
        const noReviewsMessage = document.getElementById('noReviewsMessage');
        if (noReviewsMessage) noReviewsMessage.style.display = 'block';
      }
    }

    function createReviewItem(review) {
      const reviewItem = document.createElement('div');
      reviewItem.className = 'review-item';
      
      const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      const date = new Date(review.date).toLocaleDateString();
      
      reviewItem.innerHTML = `
        <div class="review-header">
          <div class="reviewer-name">${review.userName}</div>
          <div class="review-date">${date}</div>
        </div>
        <div class="review-rating">${stars}</div>
        <div class="review-text">${review.text}</div>
      `;
      
      // Add delete button only if current user is the reviewer or admin
      if (currentUser && (review.userId === currentUser.uid)) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'review-delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          deleteReview(review.id);
        });
        reviewItem.appendChild(deleteBtn);
      }
      
      return reviewItem;
    }

    async function deleteReview(reviewId) {
      if (!currentUser) return;
      
      if (!confirm('Are you sure you want to delete this review?')) return;
      
      try {
        await window.firebase.remove(window.firebase.ref(window.firebase.database, 'reviews/' + reviewId));
        showToast('Review deleted successfully', 'success');
        if (document.getElementById('allReviewsPage').classList.contains('active')) {
          loadAllReviewsPage(currentProduct.id);
        } else {
          loadProductReviews(currentProduct.id);
        }
      } catch (error) {
        console.error('Error deleting review:', error);
        showToast('Failed to delete review', 'error');
      }
    }

    // Share link
    function copyShareLink() {
      const shareLink = document.getElementById('productShareLink');
      shareLink.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard', 'success');
    }

    // Newsletter
    function handleNewsletterSubscription() {
      const email = document.getElementById('newsletterEmail').value;
      
      if (!email) {
        showToast('Please enter your email address', 'error');
        return;
      }
      
      showToast('Thank you for subscribing!', 'success');
      document.getElementById('newsletterEmail').value = '';
    }

    // Hero messages rotation
    function setupHeroMessages() {
      const messages = document.querySelectorAll('#heroMessages span');
      let currentIndex = 0;
      
      setInterval(() => {
        messages.forEach(msg => msg.classList.remove('active'));
        currentIndex = (currentIndex + 1) % messages.length;
        messages[currentIndex].classList.add('active');
      }, 3000);
    }

    // Load user data
    async function loadUserData(user) {
      try {
        const snapshot = await window.firebase.get(window.firebase.ref(window.firebase.database, 'users/' + user.uid));
        if (snapshot.exists()) {
          const userData = snapshot.val();
          userInfo = { ...userInfo, ...userData };
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }

    // Orders functions - FIXED TO SHOW ALL ORDERS
    async function showMyOrders() {
      if (!currentUser) return;
      
      try {
        const snapshot = await window.firebase.get(
          window.firebase.query(
            window.firebase.ref(window.firebase.database, 'orders'),
            window.firebase.orderByChild('userId'),
            window.firebase.equalTo(currentUser.uid)
          )
        );
        
        const ordersList = document.getElementById('ordersList');
        const empty = document.getElementById('orders-empty');
        
        if (!snapshot.exists()) {
          ordersList.innerHTML = '';
          empty.style.display = 'block';
          return;
        }
        
        const ordersObj = snapshot.val();
        const orders = Object.keys(ordersObj).map(key => ({
          id: key,
          ...ordersObj[key]
        }));
        
        orders.sort((a, b) => b.orderDate - a.orderDate);
        renderOrders(orders);
        empty.style.display = 'none';
      } catch (error) {
        console.error('Error loading orders:', error);
        const empty = document.getElementById('orders-empty');
        if (empty) empty.style.display = 'block';
      }
    }

    function renderOrders(orders) {
      const container = document.getElementById('ordersList');
      if (!container) return;
      
      container.innerHTML = '';
      
      if (orders.length === 0) {
        const empty = document.getElementById('orders-empty');
        if (empty) empty.style.display = 'block';
        return;
      }
      
      orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        
        const statusClass = `status-${order.status}`;
        const statusText = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending';
        
        orderCard.innerHTML = `
          <div class="order-header">
            <div>
              <div class="order-id">${order.orderId || 'N/A'}</div>
              <div class="order-date">${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div class="order-status ${statusClass}">${statusText}</div>
          </div>
          <div class="order-details">
            <div class="order-product-image" style="background-image: url('${getProductImage(products.find(p => p.id === order.productId))}')"></div>
            <div class="order-product-info">
              <div class="order-product-title">${order.productName || 'Product Name'}</div>
              <div class="order-product-price">₹${order.totalAmount || '0'}</div>
              <div class="order-product-meta">Qty: ${order.quantity || 1} | Size: ${order.size || 'N/A'} | Color: ${order.colorName || order.color || 'N/A'}</div>
            </div>
          </div>
        `;
        
        orderCard.addEventListener('click', () => showOrderDetail(order));
        container.appendChild(orderCard);
      });
    }

    function showOrderDetail(order) {
      const container = document.getElementById('orderDetailContent');
      if (!container) return;
      
      const statusClass = `status-${order.status}`;
      const statusText = order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending';
      
      container.innerHTML = `
        <div class="order-detail-section">
          <div class="order-detail-label">Order ID</div>
          <div class="order-detail-value">${order.orderId || 'N/A'}</div>
        </div>
        
        <div class="order-detail-section">
          <div class="order-detail-label">Order Date</div>
          <div class="order-detail-value">${order.orderDate ? new Date(order.orderDate).toLocaleString() : 'N/A'}</div>
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
              <div style="font-weight:600;margin-bottom:8px">${order.productName || 'Product Name'}</div>
              <div style="color:var(--accent);font-weight:700;margin-bottom:8px">₹${order.productPrice || '0'}</div>
              <div style="color:var(--muted);font-size:14px">
                Qty: ${order.quantity || 1} | Size: ${order.size || 'N/A'} | Color: ${order.colorName || order.color || 'N/A'}
              </div>
            </div>
          </div>
        </div>
        
        <div class="order-detail-section">
          <div class="order-detail-label">Payment Details</div>
          <div class="order-detail-value">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Subtotal:</span>
              <span>₹${order.subtotal || '0'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Delivery:</span>
              <span>₹${order.deliveryCharge || '0'}</span>
            </div>
            ${order.gatewayCharge > 0 ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span>Payment Gateway Charge:</span>
              <span>₹${order.gatewayCharge.toFixed(2)}</span>
            </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
              <span>Total Amount:</span>
              <span>₹${order.totalAmount || '0'}</span>
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

    // Logout
    function showLogoutConfirmation() {
      document.getElementById('alertTitle').textContent = 'Logout Confirmation';
      document.getElementById('alertMessage').textContent = 'Are you sure you want to logout?';
      document.getElementById('alertModal').classList.add('active');
    }

    function confirmLogout() {
      window.firebase.signOut(window.firebase.auth).then(() => {
        showToast('Logged out successfully', 'success');
        document.getElementById('alertModal').classList.remove('active');
        showPage('homePage');
      }).catch(error => {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
      });
    }

    // Initialize the app when DOM is loaded
    document.addEventListener('DOMContentLoaded', initApp);
  