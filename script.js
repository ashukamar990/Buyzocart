

    // Import the functions you need from the SDKs you need
    import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
    import { getDatabase, ref, set, get, update, remove, onValue, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

    // Your web app's Firebase configuration
    const firebaseConfig = {
      apiKey: "AIzaSyCHFUx3Y1L3mvyLyDMHVKQE6eXi50_fewE",
      authDomain: "buyzocart.firebaseapp.com",
      databaseURL: "https://buyzocart-default-rtdb.firebaseio.com",
      projectId: "buyzocart",
      storageBucket: "buyzocart.firebasestorage.app",
      messagingSenderId: "640560737762",
      appId: "1:640560737762:web:7fe368df6486d6da759dbb"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();

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
    let bannerStartX = 0;
    let bannerCurrentX = 0;
    let isBannerDragging = false;
    let adminSettings = {
      deliveryCharge: 50,
      gatewayChargePercent: 2,
      freeShippingOver: 999
    };
    let savedAddresses = [];
    let selectedColor = 'black';
    let selectedColorName = 'Black';
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');

    // Cache Manager with 7 days TTL
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
      }
    };

    // Skeleton Loader Manager
    const skeletonManager = {
      show: function(elementId, type = 'product') {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        if (type === 'product') {
          element.innerHTML = `
            <div class="product-card skeleton">
              <div class="product-card-image"></div>
              <div class="product-card-body">
                <div class="product-card-title"></div>
                <div class="product-card-rating"></div>
                <div class="product-card-price"></div>
                <div class="product-card-actions"></div>
              </div>
            </div>
          `.repeat(4);
        } else if (type === 'banner') {
          element.classList.add('skeleton');
        } else if (type === 'category') {
          element.innerHTML = `
            <div class="category-circle skeleton">
              <div class="category-circle-image"></div>
              <div class="category-circle-name"></div>
            </div>
          `.repeat(4);
        }
      },
      
      hide: function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
          element.classList.remove('skeleton');
        }
      }
    };

    // Initialize EmailJS
    emailjs.init("YOUR_PUBLIC_KEY"); // Add your EmailJS public key here

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

    // Order ID Generation Function
    function generateOrderId() {
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const randomNum = Math.floor(100000 + Math.random() * 900000); 
        return `ORDER-${yyyy}${mm}${dd}-${randomNum}`;
    }

    // FIXED: Improved Wishlist Functions with Instant Like/Dislike
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
      
      if (currentUser) {
        updateWishlistInFirebase(productId, !isWishlisted);
      }
      
      if (document.getElementById('wishlistPage').classList.contains('active')) {
        renderWishlist();
      }
    }

    async function updateWishlistInFirebase(productId, add) {
      if (!currentUser) return;
      
      try {
        if (add) {
          await set(ref(database, 'userWishlists/' + currentUser.uid + '/' + productId), {
            productId: productId,
            addedAt: Date.now()
          });
        } else {
          await remove(ref(database, 'userWishlists/' + currentUser.uid + '/' + productId));
        }
      } catch (error) {
        console.error('Error updating wishlist in Firebase:', error);
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
      
      const detailBtn = document.getElementById('detailWishlistBtn');
      if (detailBtn && currentProduct) {
        const isActive = isInWishlist(currentProduct.id);
        detailBtn.classList.toggle('active', isActive);
        detailBtn.textContent = isActive ? 'Remove from Wishlist' : 'Add to Wishlist';
      }
    }

    // Update admin settings in UI
    function updateAdminSettingsUI() {
      document.getElementById('deliveryCharge').textContent = adminSettings.deliveryCharge;
      document.getElementById('sumDel').textContent = `₹${adminSettings.deliveryCharge}`;
      document.getElementById('gatewayChargePercent').textContent = `${adminSettings.gatewayChargePercent}%`;
    }

    // DOM Elements
    const menuIcon = document.getElementById('menuIcon');
    const mobileMenu = document.getElementById('mobileMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const menuClose = document.getElementById('menuClose');
    const themeToggle = document.getElementById('themeToggle');
    const toast = document.getElementById('toast');
    const authModal = document.getElementById('authModal');
    const authClose = document.getElementById('authClose');
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const googleSignupBtn = document.getElementById('googleSignupBtn');
    const switchToLogin = document.getElementById('switchToLogin');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const backToLogin = document.getElementById('backToLogin');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const openLoginTop = document.getElementById('openLoginTop');
    const userProfile = document.getElementById('userProfile');
    const userAvatar = document.getElementById('userAvatar');
    const userAvatarImg = document.getElementById('userAvatarImg');
    const userAvatarInitial = document.getElementById('userAvatarInitial');
    const userName = document.getElementById('userName');
    const mobileLoginBtn = document.getElementById('mobileLoginBtn');
    const mobileUserProfile = document.getElementById('mobileUserProfile');
    const mobileUserName = document.getElementById('mobileUserName');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const openMyOrdersTop = document.getElementById('openMyOrdersTop');
    const zoomModal = document.getElementById('zoomModal');
    const zoomClose = document.getElementById('zoomClose');
    const zoomImage = document.getElementById('zoomImage');
    const zoomIn = document.getElementById('zoomIn');
    const zoomOut = document.getElementById('zoomOut');
    const zoomReset = document.getElementById('zoomReset');

    // Product Image Modal Elements
    const productImageModal = document.getElementById('productImageModal');
    const productImageModalClose = document.getElementById('productImageModalClose');
    const productImageModalImage = document.getElementById('productImageModalImage');
    const productImageModalPrev = document.getElementById('productImageModalPrev');
    const productImageModalNext = document.getElementById('productImageModalNext');
    const productImageModalDots = document.getElementById('productImageModalDots');

    // Error Display Elements
    const loginError = document.getElementById('loginError');
    const signupError = document.getElementById('signupError');

    // Rating Elements
    const ratingInput = document.getElementById('ratingInput');
    const reviewText = document.getElementById('reviewText');
    const submitReview = document.getElementById('submitReview');
    const reviewsList = document.getElementById('reviewsList');

    // Password Reset Modal Elements
    const passwordResetModal = document.getElementById('passwordResetModal');
    const passwordResetEmail = document.getElementById('passwordResetEmail');
    const cancelPasswordReset = document.getElementById('cancelPasswordReset');
    const confirmPasswordReset = document.getElementById('confirmPasswordReset');

    // Search Panel Elements
    const searchPanel = document.getElementById('searchPanel');
    const searchPanelInput = document.getElementById('searchPanelInput');
    const searchPanelClose = document.getElementById('searchPanelClose');
    const headerSearchInput = document.getElementById('headerSearchInput');
    const recentSearchesSection = document.getElementById('recentSearchesSection');
    const recentSearchesList = document.getElementById('recentSearchesList');
    const clearRecentSearches = document.getElementById('clearRecentSearches');
    const searchPanelResults = document.getElementById('searchPanelResults');

    // Bottom Navigation Elements
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');

    function initApp() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      
      // Remove index.html from URL if present
      if (window.location.pathname.includes('index.html')) {
        const newUrl = window.location.pathname.replace('index.html', '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }
      
      showPage('homePage');
      
      if (window.location.hash) {
        const pageId = window.location.hash.replace('#', '');
        if (document.getElementById(pageId)) {
          showPage(pageId);
        }
      }
      
      updateProfileName();
      setupHeroMessages();
      updateStepPills();
      updateBottomNav();
      loadRecentSearches();
    }

    // Load cached data first
    function loadCachedData() {
      // Load products from cache
      const cachedProducts = cacheManager.get('products');
      if (cachedProducts && cachedProducts.length > 0) {
        products = cachedProducts;
        renderProducts(products, 'homeProductGrid');
        renderProducts(products, 'productGrid');
        
        const trendingProducts = products.filter(p => p.isTrending).slice(0, 10);
        renderProductSlider(trendingProducts.length > 0 ? trendingProducts : products.slice(0, 10), 'productSlider');
        
        const featuredProducts = products.filter(p => p.isFeatured);
        if (featuredProducts.length > 0) {
          renderProducts(featuredProducts, 'homeProductGrid');
        }
      } else {
        skeletonManager.show('homeProductGrid', 'product');
        skeletonManager.show('productGrid', 'product');
      }
      
      // Load categories from cache
      const cachedCategories = cacheManager.get('categories');
      if (cachedCategories && cachedCategories.length > 0) {
        categories = cachedCategories;
        renderCategories();
        renderCategoryCircles();
      } else {
        skeletonManager.show('categoryCirclesContainer', 'category');
      }
      
      // Load banners from cache
      const cachedBanners = cacheManager.get('banners');
      if (cachedBanners && cachedBanners.length > 0) {
        banners = cachedBanners;
        renderBannerCarousel();
      } else {
        skeletonManager.show('bannerCarousel', 'banner');
      }
      
      // Load admin settings from cache
      const cachedSettings = cacheManager.get('adminSettings');
      if (cachedSettings) {
        adminSettings = cachedSettings;
        updateAdminSettingsUI();
      }
    }

    // Fetch live data from Firebase
    async function fetchLiveData() {
      try {
        // Fetch products
        const productsSnapshot = await get(ref(database, 'products'));
        if (productsSnapshot.exists()) {
          const productsObj = productsSnapshot.val();
          const newProducts = Object.keys(productsObj).map(key => ({
            id: key,
            ...productsObj[key]
          }));
          
          products = newProducts;
          cacheManager.set('products', products);
          
          // Update UI if on relevant pages
          if (document.getElementById('homePage').classList.contains('active') || 
              document.getElementById('productsPage').classList.contains('active')) {
            renderProducts(products, 'homeProductGrid');
            renderProducts(products, 'productGrid');
            
            const trendingProducts = products.filter(p => p.isTrending).slice(0, 10);
            renderProductSlider(trendingProducts.length > 0 ? trendingProducts : products.slice(0, 10), 'productSlider');
            
            const featuredProducts = products.filter(p => p.isFeatured);
            if (featuredProducts.length > 0) {
              renderProducts(featuredProducts, 'homeProductGrid');
            }
          }
        }
        
        // Fetch categories
        const categoriesSnapshot = await get(ref(database, 'categories'));
        if (categoriesSnapshot.exists()) {
          const categoriesObj = categoriesSnapshot.val();
          const newCategories = Object.keys(categoriesObj).map(key => ({
            id: key,
            ...categoriesObj[key]
          }));
          
          categories = newCategories;
          cacheManager.set('categories', categories);
          
          if (document.getElementById('homePage').classList.contains('active') || 
              document.getElementById('productsPage').classList.contains('active')) {
            renderCategories();
            renderCategoryCircles();
          }
        }
        
        // Fetch banners
        const bannersSnapshot = await get(ref(database, 'banners'));
        if (bannersSnapshot.exists()) {
          const bannersObj = bannersSnapshot.val();
          const newBanners = Object.keys(bannersObj).map(key => ({
            id: key,
            ...bannersObj[key]
          }));
          
          banners = newBanners;
          cacheManager.set('banners', banners);
          
          if (document.getElementById('homePage').classList.contains('active')) {
            renderBannerCarousel();
          }
        }
        
        // Fetch admin settings
        const settingsSnapshot = await get(ref(database, 'adminSettings'));
        if (settingsSnapshot.exists()) {
          const settingsObj = settingsSnapshot.val();
          adminSettings = { ...adminSettings, ...settingsObj };
          cacheManager.set('adminSettings', adminSettings);
          updateAdminSettingsUI();
        }
      } catch (error) {
        console.error('Error fetching live data:', error);
      }
    }

    // Setup realtime listeners
    function setupRealtimeListeners() {
      // Products listener
      onValue(ref(database, 'products'), (snapshot) => {
        if (snapshot.exists()) {
          const productsObj = snapshot.val();
          const newProducts = Object.keys(productsObj).map(key => ({
            id: key,
            ...productsObj[key]
          }));
          
          products = newProducts;
          cacheManager.set('products', products);
          
          if (document.getElementById('homePage').classList.contains('active') || 
              document.getElementById('productsPage').classList.contains('active') ||
              document.getElementById('productDetailPage').classList.contains('active')) {
            renderProducts(products, 'homeProductGrid');
            renderProducts(products, 'productGrid');
            
            const trendingProducts = products.filter(p => p.isTrending).slice(0, 10);
            renderProductSlider(trendingProducts.length > 0 ? trendingProducts : products.slice(0, 10), 'productSlider');
            
            const featuredProducts = products.filter(p => p.isFeatured);
            if (featuredProducts.length > 0) {
              renderProducts(featuredProducts, 'homeProductGrid');
            }
          }
        }
      });
      
      // Categories listener
      onValue(ref(database, 'categories'), (snapshot) => {
        if (snapshot.exists()) {
          const categoriesObj = snapshot.val();
          const newCategories = Object.keys(categoriesObj).map(key => ({
            id: key,
            ...categoriesObj[key]
          }));
          
          categories = newCategories;
          cacheManager.set('categories', categories);
          
          if (document.getElementById('homePage').classList.contains('active') || 
              document.getElementById('productsPage').classList.contains('active')) {
            renderCategories();
            renderCategoryCircles();
          }
        }
      });
      
      // Banners listener
      onValue(ref(database, 'banners'), (snapshot) => {
        if (snapshot.exists()) {
          const bannersObj = snapshot.val();
          const newBanners = Object.keys(bannersObj).map(key => ({
            id: key,
            ...bannersObj[key]
          }));
          
          banners = newBanners;
          cacheManager.set('banners', banners);
          
          if (document.getElementById('homePage').classList.contains('active')) {
            renderBannerCarousel();
          }
        }
      });
      
      // Admin settings listener
      onValue(ref(database, 'adminSettings'), (snapshot) => {
        if (snapshot.exists()) {
          const settingsObj = snapshot.val();
          adminSettings = { ...adminSettings, ...settingsObj };
          cacheManager.set('adminSettings', adminSettings);
          updateAdminSettingsUI();
        }
      });
    }

    // DOM Ready
    document.addEventListener('DOMContentLoaded', function() {
      // Initialize app
      initApp();
      setupEventListeners();
      
      // Load cached data first
      loadCachedData();
      
      // Then fetch live data
      fetchLiveData();
      
      // Setup realtime listeners
      setupRealtimeListeners();
      
      // Auth state listener
      onAuthStateChanged(auth, (user) => {
        if (user) {
          currentUser = user;
          updateUIForUser(user);
          loadUserData(user);
          loadRecentlyViewed(user);
          loadSavedAddresses();
          authModal.classList.remove('active');
        } else {
          currentUser = null;
          updateUIForGuest();
        }
      });
    });

    function setupEventListeners() {
      menuIcon.addEventListener('click', openMenu);
      menuClose.addEventListener('click', closeMenu);
      menuOverlay.addEventListener('click', closeMenu);
      
      themeToggle.addEventListener('click', toggleTheme);
      
      authClose.addEventListener('click', () => authModal.classList.remove('active'));
      openLoginTop.addEventListener('click', showLoginModal);
      mobileLoginBtn.addEventListener('click', showLoginModal);
      
      loginTab.addEventListener('click', () => switchAuthTab('login'));
      signupTab.addEventListener('click', () => switchAuthTab('signup'));
      switchToLogin.addEventListener('click', () => switchAuthTab('login'));
      
      loginBtn.addEventListener('click', handleLogin);
      signupBtn.addEventListener('click', handleSignup);
      googleLoginBtn.addEventListener('click', handleGoogleLogin);
      googleSignupBtn.addEventListener('click', handleGoogleLogin);
      
      forgotPasswordLink.addEventListener('click', () => {
        loginForm.classList.remove('active');
        forgotPasswordForm.classList.add('active');
      });
      backToLogin.addEventListener('click', () => {
        forgotPasswordForm.classList.remove('active');
        loginForm.classList.add('active');
      });
      resetPasswordBtn.addEventListener('click', handleResetPassword);
      
      userProfile.addEventListener('click', () => window.location.href = 'account.html');
      
      mobileLogoutBtn.addEventListener('click', showLogoutConfirmation);
      
      document.getElementById('alertCancelBtn').addEventListener('click', () => {
        document.getElementById('alertModal').classList.remove('active');
      });
      document.getElementById('alertConfirmBtn').addEventListener('click', confirmLogout);
      
      openMyOrdersTop.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
      
      zoomClose.addEventListener('click', () => zoomModal.classList.remove('active'));
      zoomIn.addEventListener('click', () => adjustZoom(0.2));
      zoomOut.addEventListener('click', () => adjustZoom(-0.2));
      zoomReset.addEventListener('click', resetZoom);
      
      productImageModalClose.addEventListener('click', () => productImageModal.classList.remove('active'));
      productImageModalPrev.addEventListener('click', prevProductModalImage);
      productImageModalNext.addEventListener('click', nextProductModalImage);
      
      // Search panel events
      headerSearchInput.addEventListener('click', openSearchPanel);
      searchPanelInput.addEventListener('input', debounce(handleSearchPanelInput, 300));
      searchPanelClose.addEventListener('click', closeSearchPanel);
      clearRecentSearches.addEventListener('click', clearRecentSearchesHandler);
      
      // Bottom navigation events
      bottomNavItems.forEach(item => {
        item.addEventListener('click', function() {
          bottomNavItems.forEach(nav => nav.classList.remove('active'));
          this.classList.add('active');
        });
      });
      
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
      
      document.querySelectorAll('.size-option').forEach(option => {
        option.addEventListener('click', function() {
          document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
          this.classList.add('selected');
          document.getElementById('sizeValidationError').classList.remove('show');
        });
      });
      
      document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
          document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
          this.classList.add('selected');
        });
      });
      
      // Price filter events
      const minPriceSlider = document.getElementById('minPriceSlider');
      const maxPriceSlider = document.getElementById('maxPriceSlider');
      const minPrice = document.getElementById('minPrice');
      const maxPrice = document.getElementById('maxPrice');
      
      if (minPriceSlider && maxPriceSlider) {
        minPriceSlider.addEventListener('input', updatePriceSlider);
        maxPriceSlider.addEventListener('input', updatePriceSlider);
      }
      
      if (minPrice && maxPrice) {
        minPrice.addEventListener('input', updatePriceInputs);
        maxPrice.addEventListener('input', updatePriceInputs);
      }
      
      document.getElementById('applyPriceFilter')?.addEventListener('click', applyPriceFilter);
      document.getElementById('resetPriceFilter')?.addEventListener('click', resetPriceFilter);
      
      document.getElementById('subscribeBtn')?.addEventListener('click', handleNewsletterSubscription);
      
      document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const platform = this.getAttribute('data-platform');
          shareProduct(platform);
        });
      });
      
      document.getElementById('copyShareLink')?.addEventListener('click', copyShareLink);
      
      document.getElementById('detailOrderBtn')?.addEventListener('click', orderProductFromDetail);
      document.getElementById('detailWishlistBtn')?.addEventListener('click', toggleWishlistFromDetail);
      
      document.getElementById('productDetailMainImage')?.addEventListener('click', openProductImageModal);
      
      document.querySelector('.detail-carousel-control.prev')?.addEventListener('click', prevDetailImage);
      document.querySelector('.detail-carousel-control.next')?.addEventListener('click', nextDetailImage);
      
      if (ratingInput) {
        ratingInput.querySelectorAll('.rating-star').forEach(star => {
          star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            setRating(rating);
          });
        });
      }
      
      if (submitReview) {
        submitReview.addEventListener('click', submitProductReview);
      }
      
      const bannerCarousel = document.getElementById('bannerCarousel');
      if (bannerCarousel) {
        bannerCarousel.addEventListener('touchstart', handleBannerTouchStart);
        bannerCarousel.addEventListener('touchmove', handleBannerTouchMove);
        bannerCarousel.addEventListener('touchend', handleBannerTouchEnd);
      }
      
      window.addEventListener('popstate', function(event) {
        const page = event.state ? event.state.page : 'homePage';
        showPage(page);
      });
      
      document.querySelector('.qty-minus')?.addEventListener('click', function() {
        decreaseQuantity();
        if (document.getElementById('paymentPage').classList.contains('active')) {
          updatePaymentSummary();
        }
      });
      
      document.querySelector('.qty-plus')?.addEventListener('click', function() {
        increaseQuantity();
        if (document.getElementById('paymentPage').classList.contains('active')) {
          updatePaymentSummary();
        }
      });
      
      document.querySelectorAll('input[name="pay"]').forEach(radio => {
        radio.addEventListener('change', function() {
          if (document.getElementById('paymentPage').classList.contains('active')) {
            updatePaymentSummary();
          }
        });
      });
      
      document.getElementById('saveUserInfo')?.addEventListener('click', saveUserInfoAndAddress);
      
      // NEW: Color selection event listeners
      document.getElementById('colorOptionsGrid')?.addEventListener('click', function(e) {
        const colorBox = e.target.closest('.color-box');
        if (colorBox && !colorBox.classList.contains('out-of-stock')) {
          document.querySelectorAll('.color-box').forEach(b => b.classList.remove('selected'));
          colorBox.classList.add('selected');
          
          selectedColor = colorBox.getAttribute('data-color');
          selectedColorName = colorBox.getAttribute('data-color-name');
          
          document.getElementById('selectedColorText').textContent = selectedColorName;
          
          // Change main product image based on color selection
          if (currentProduct && currentProduct.colorImages && currentProduct.colorImages[selectedColor]) {
            const colorImage = currentProduct.colorImages[selectedColor];
            document.getElementById('productDetailMainImage').style.backgroundImage = `url('${colorImage}')`;
          }
          
          showToast(`Selected color: ${selectedColorName}`, 'success');
        }
      });
      
      // NEW: Banner click event
      document.getElementById('bannerTrack')?.addEventListener('click', function(e) {
        const bannerIndex = Array.from(document.querySelectorAll('.banner-dot')).findIndex(dot => 
          dot.classList.contains('active')
        );
        if (bannerIndex !== -1 && banners[bannerIndex] && banners[bannerIndex].link) {
          window.open(banners[bannerIndex].link, '_blank');
        }
      });
    }

    // Price Slider Functions
    function updatePriceSlider() {
      const minSlider = document.getElementById('minPriceSlider');
      const maxSlider = document.getElementById('maxPriceSlider');
      const minPrice = document.getElementById('minPrice');
      const maxPrice = document.getElementById('maxPrice');
      const priceSliderRange = document.getElementById('priceSliderRange');
      const minPriceValue = document.getElementById('minPriceValue');
      const maxPriceValue = document.getElementById('maxPriceValue');
      
      let minVal = parseInt(minSlider.value);
      let maxVal = parseInt(maxSlider.value);
      
      if (minVal > maxVal) {
        minVal = maxVal;
        minSlider.value = minVal;
      }
      
      if (maxVal < minVal) {
        maxVal = minVal;
        maxSlider.value = maxVal;
      }
      
      const minPercent = (minVal / 5000) * 100;
      const maxPercent = (maxVal / 5000) * 100;
      
      priceSliderRange.style.left = minPercent + '%';
      priceSliderRange.style.right = (100 - maxPercent) + '%';
      
      minPrice.value = minVal;
      maxPrice.value = maxVal;
      minPriceValue.textContent = '₹' + minVal;
      maxPriceValue.textContent = '₹' + maxVal;
    }

    function updatePriceInputs() {
      const minPrice = document.getElementById('minPrice');
      const maxPrice = document.getElementById('maxPrice');
      const minSlider = document.getElementById('minPriceSlider');
      const maxSlider = document.getElementById('maxPriceSlider');
      
      let minVal = parseInt(minPrice.value) || 0;
      let maxVal = parseInt(maxPrice.value) || 5000;
      
      if (minVal < 0) minVal = 0;
      if (maxVal > 5000) maxVal = 5000;
      if (minVal > maxVal) minVal = maxVal;
      if (maxVal < minVal) maxVal = minVal;
      
      minSlider.value = minVal;
      maxSlider.value = maxVal;
      updatePriceSlider();
    }

    // Advanced Search Panel Functions
    function openSearchPanel() {
      searchPanel.classList.add('active');
      searchPanelInput.focus();
      document.body.style.overflow = 'hidden';
    }

    function closeSearchPanel() {
      searchPanel.classList.remove('active');
      document.body.style.overflow = '';
    }

    function handleSearchPanelInput() {
      const query = searchPanelInput.value.toLowerCase().trim();
      
      if (query.length === 0) {
        searchPanelResults.innerHTML = '';
        loadRecentSearches();
        return;
      }
      
      const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(query) ||
        (product.description && product.description.toLowerCase().includes(query)) ||
        (product.category && product.category.toLowerCase().includes(query))
      );
      
      if (filteredProducts.length === 0) {
        searchPanelResults.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">No products found</div>';
      } else {
        searchPanelResults.innerHTML = `
          <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--ink)">
            Search Results (${filteredProducts.length})
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:12px;">
            ${filteredProducts.map(product => `
              <div class="recent-search-item" onclick="searchAndClose('${product.name}')">
                <div class="recent-search-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <div style="flex:1">
                  <div style="font-weight:600">${product.name}</div>
                  <div style="font-size:12px;color:var(--muted)">${product.price}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
      
      // Hide recent searches when typing
      recentSearchesSection.style.display = 'none';
    }

    function searchAndClose(searchTerm) {
      addRecentSearch(searchTerm);
      closeSearchPanel();
      showPage('productsPage');
      filterProducts(searchTerm, 'productGrid');
    }

    function searchFromPanel(searchTerm) {
      searchPanelInput.value = searchTerm;
      searchAndClose(searchTerm);
    }

    function loadRecentSearches() {
      if (recentSearches.length === 0) {
        recentSearchesSection.style.display = 'none';
        return;
      }
      
      recentSearchesSection.style.display = 'block';
      recentSearchesList.innerHTML = recentSearches.map(term => `
        <div class="recent-search-item" onclick="searchFromPanel('${term}')">
          <div class="recent-search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <div style="flex:1">${term}</div>
        </div>
      `).join('');
    }

    function addRecentSearch(term) {
      if (!term.trim()) return;
      
      // Remove if already exists
      recentSearches = recentSearches.filter(t => t !== term);
      
      // Add to beginning
      recentSearches.unshift(term);
      
      // Keep only last 10 searches
      if (recentSearches.length > 10) {
        recentSearches = recentSearches.slice(0, 10);
      }
      
      localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    }

    function clearRecentSearchesHandler() {
      recentSearches = [];
      localStorage.removeItem('recentSearches');
      recentSearchesSection.style.display = 'none';
    }

    // Bottom Navigation Functions
    function updateBottomNav() {
      const currentPage = document.querySelector('.page.active').id;
      bottomNavItems.forEach(item => {
        item.classList.remove('active');
        if (currentPage === 'homePage' && item.textContent.includes('Home')) {
          item.classList.add('active');
        } else if (currentPage === 'productsPage' && item.textContent.includes('Products')) {
          item.classList.add('active');
        } else if (currentPage === 'myOrdersPage' && item.textContent.includes('Orders')) {
          item.classList.add('active');
        } else if (currentPage === 'wishlistPage' && item.textContent.includes('Wishlist')) {
          item.classList.add('active');
        }
      });
    }

    // Banner touch handlers for mobile swipe
    function handleBannerTouchStart(e) {
      bannerStartX = e.touches[0].clientX;
      isBannerDragging = true;
    }

    function handleBannerTouchMove(e) {
      if (!isBannerDragging) return;
      bannerCurrentX = e.touches[0].clientX;
    }

    function handleBannerTouchEnd() {
      if (!isBannerDragging) return;
      
      const diff = bannerStartX - bannerCurrentX;
      const bannerTrack = document.getElementById('bannerTrack');
      const activeIndex = banners.findIndex((_, index) => 
        document.querySelector(`.banner-dot:nth-child(${index + 1})`).classList.contains('active')
      );
      
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
    }

    // Product Image Modal Functions
    function openProductImageModal() {
      if (!currentProduct) return;
      
      currentProductImages = getProductImages();
      currentProductModalIndex = currentImageIndex;
      
      updateProductModalImage();
      productImageModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function updateProductModalImage() {
      if (currentProductImages.length === 0) return;
      
      productImageModalImage.src = currentProductImages[currentProductModalIndex];
      
      productImageModalDots.innerHTML = '';
      currentProductImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `product-image-modal-dot ${index === currentProductModalIndex ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          currentProductModalIndex = index;
          updateProductModalImage();
        });
        productImageModalDots.appendChild(dot);
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

    // Rating and Review Functions
    function setRating(rating) {
      const stars = ratingInput.querySelectorAll('.rating-star');
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
      
      const activeStars = ratingInput.querySelectorAll('.rating-star.active');
      const rating = activeStars.length;
      const reviewTextValue = reviewText.value.trim();
      
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
        
        await set(ref(database, 'reviews/' + reviewId), reviewData);
        
        showToast('Review submitted successfully', 'success');
        
        setRating(0);
        reviewText.value = '';
        
        loadProductReviews(currentProduct.id);
      } catch (error) {
        console.error('Error submitting review:', error);
        showToast('Failed to submit review', 'error');
      }
    }

    async function loadProductReviews(productId) {
      try {
        const reviewsRef = ref(database, 'reviews');
        const reviewsQuery = query(reviewsRef, orderByChild('productId'), equalTo(productId));
        const snapshot = await get(reviewsQuery);
        
        if (!snapshot.exists()) {
          reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No reviews yet. Be the first to review!</p>';
          return;
        }
        
        const reviewsObj = snapshot.val();
        const reviews = Object.keys(reviewsObj).map(key => reviewsObj[key]);
        
        reviews.sort((a, b) => b.date - a.date);
        
        renderReviews(reviews);
      } catch (error) {
        console.error('Error loading reviews:', error);
        reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">Error loading reviews</p>';
      }
    }

    function renderReviews(reviews) {
      reviewsList.innerHTML = '';
      
      reviews.forEach(review => {
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
          ${currentUser && (review.userId === currentUser.uid || currentUser.email === 'admin@buyzocart.com') ? 
            `<button class="review-delete-btn" data-review-id="${review.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
              Delete
            </button>` : ''}
        `;
        
        // Add delete event listener
        const deleteBtn = reviewItem.querySelector('.review-delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', function() {
            deleteReview(review.id);
          });
        }
        
        reviewsList.appendChild(reviewItem);
      });
    }

    async function deleteReview(reviewId) {
      if (!currentUser) return;
      
      if (!confirm('Are you sure you want to delete this review?')) return;
      
      try {
        await remove(ref(database, 'reviews/' + reviewId));
        showToast('Review deleted successfully', 'success');
        loadProductReviews(currentProduct.id);
      } catch (error) {
        console.error('Error deleting review:', error);
        showToast('Failed to delete review', 'error');
      }
    }

    // Authentication Functions
    async function handleLogin() {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      
      loginError.textContent = '';
      
      if (!email || !password) {
        loginError.textContent = 'Please fill in all fields';
        return;
      }
      
      try {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<div class="loading-spinner"></div> Logging in...';
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        await update(ref(database, 'users/' + userCredential.user.uid), {
          lastLoginAt: Date.now()
        });
        
        // Send login notification email
        sendLoginNotification(email);
        
        showToast('Login successful!', 'success');
        authModal.classList.remove('active');
        
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
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await set(ref(database, 'users/' + user.uid), {
          name: name,
          email: email,
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        });
        
        localStorage.setItem('userName', name);
        updateUserNameUI(name);
        
        // Send welcome email
        sendWelcomeEmail(email, name);
        
        showToast('Account created successfully!', 'success');
        authModal.classList.remove('active');
        
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
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userSnapshot = await get(ref(database, 'users/' + user.uid));
        
        if (!userSnapshot.exists()) {
          await set(ref(database, 'users/' + user.uid), {
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: Date.now(),
            lastLoginAt: Date.now()
          });
        } else {
          await update(ref(database, 'users/' + user.uid), {
            lastLoginAt: Date.now()
          });
        }
        
        localStorage.setItem('userName', user.displayName || 'User');
        updateUserNameUI(user.displayName || 'User');
        
        // Send login notification
        sendLoginNotification(user.email);
        
        showToast('Login successful!', 'success');
        authModal.classList.remove('active');
      } catch (err) {
        console.error('Google login error:', err);
        if (loginForm.classList.contains('active')) {
          loginError.textContent = err.message;
        } else {
          signupError.textContent = err.message;
        }
      }
    }

    // EmailJS Functions
    function sendLoginNotification(email) {
      const templateParams = {
        to_email: email,
        to_name: currentUser?.displayName || 'User',
        login_time: new Date().toLocaleString(),
        user_agent: navigator.userAgent
      };
      
      emailjs.send('service_your_service_id', 'template_login_notification', templateParams)
        .then(response => {
          console.log('Login notification sent:', response);
        })
        .catch(error => {
          console.error('Error sending login notification:', error);
        });
    }

    function sendWelcomeEmail(email, name) {
      const templateParams = {
        to_email: email,
        to_name: name,
        welcome_message: 'Welcome to Buyzo Cart! We are excited to have you on board.'
      };
      
      emailjs.send('service_your_service_id', 'template_welcome', templateParams)
        .then(response => {
          console.log('Welcome email sent:', response);
        })
        .catch(error => {
          console.error('Error sending welcome email:', error);
        });
    }

    function sendOrderNotification(orderData) {
      const templateParams = {
        to_email: orderData.userEmail,
        to_name: orderData.username,
        order_id: orderData.orderId,
        product_name: orderData.productName,
        total_amount: orderData.totalAmount,
        order_date: new Date(orderData.orderDate).toLocaleString(),
        delivery_address: `${orderData.userInfo.house}, ${orderData.userInfo.city}, ${orderData.userInfo.state} - ${orderData.userInfo.pincode}`
      };
      
      emailjs.send('service_your_service_id', 'template_order_confirmation', templateParams)
        .then(response => {
          console.log('Order notification sent:', response);
        })
        .catch(error => {
          console.error('Error sending order notification:', error);
        });
    }

    // FIXED: Place Order Function with proper calculations
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
      const size = document.querySelector('.size-option.selected')?.getAttribute('data-value') || 'Not specified';
      const color = selectedColor || document.querySelector('.color-option.selected')?.getAttribute('data-value') || 'Not specified';
      
      const productPrice = parsePrice(currentProduct.price);
      const subtotal = productPrice * quantity;
      const deliveryCharge = adminSettings.deliveryCharge || 50;
      const gatewayChargePercent = adminSettings.gatewayChargePercent || 2;
      const gatewayCharge = paymentMethod === 'prepaid' ? subtotal * (gatewayChargePercent / 100) : 0;
      const total = subtotal + deliveryCharge + gatewayCharge;
      
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
        color: color,
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
      
      try {
        await set(ref(database, 'orders/' + orderId), orderData);
        
        document.getElementById('orderIdDisplay').textContent = orderId;
        showPage('successPage');
        
        showToast('Order placed successfully!', 'success');
        
        // Send order notification email
        sendOrderNotification(orderData);
        
        localStorage.removeItem('cart');
        
      } catch (error) {
        console.error('Error placing order:', error);
        showToast('Failed to place order. Please try again.', 'error');
      }
    }

    // SAFE PRICE PARSING FUNCTION
    function parsePrice(p) {
      if (typeof p === "number") return p;
      if (typeof p === "string") {
        const num = parseFloat(p.replace(/[₹,]/g, ""));
        return isNaN(num) ? 0 : num;
      }
      return 0;
    }

    // Payment Calculation Function - FIXED
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
    }

    // Page navigation
    function showPage(pageId) {
      // Remove index.html from URL
      const cleanHash = pageId === 'homePage' ? '' : `#${pageId}`;
      const newUrl = window.location.pathname.replace('index.html', '') + cleanHash;
      window.history.pushState({ page: pageId }, '', newUrl);
      
      if (pageId === 'accountPage' || pageId === 'settingsPage' || pageId === 'addressPage') {
        window.location.href = 'account.html';
        return;
      }
      
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });
      document.getElementById(pageId).classList.add('active');
      
      updateStepPills();
      updateBottomNav();
      
      window.scrollTo(0, 0);
      
      if (pageId === 'myOrdersPage' && currentUser) {
        showMyOrders();
      }
      
      if (pageId === 'wishlistPage') {
        renderWishlist();
      }
      
      if (pageId === 'productDetailPage' && currentProduct) {
        loadProductReviews(currentProduct.id);
      }
      
      if (pageId === 'paymentPage') {
        updatePaymentSummary();
      }
      
      if (pageId === 'userPage' && currentUser) {
        loadSavedAddresses();
      }
      
      if (pageId === 'orderPage' && currentProduct) {
        initOrderPageGallery();
      }
      
      if (pageId === 'productsPage') {
        // Clear search on products page
        searchPanelInput.value = '';
        searchPanelResults.innerHTML = '';
        loadRecentSearches();
      }
    }

    function checkAuthAndShowPage(pageId) {
      if (!currentUser) {
        showLoginModal();
        return;
      }
      showPage(pageId);
    }

    function showLoginModal() {
      authModal.classList.add('active');
      switchAuthTab('login');
    }

    function switchAuthTab(tab) {
      loginForm.classList.remove('active');
      signupForm.classList.remove('active');
      forgotPasswordForm.classList.remove('active');
      
      loginTab.classList.remove('active');
      signupTab.classList.remove('active');
      
      loginError.textContent = '';
      signupError.textContent = '';
      
      if (tab === 'login') {
        loginTab.classList.add('active');
        loginForm.classList.add('active');
      } else {
        signupTab.classList.add('active');
        signupForm.classList.add('active');
      }
    }

    function logout() {
      signOut(auth).then(() => {
        showToast('Logged out successfully', 'success');
        showPage('homePage');
      }).catch(error => {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
      });
    }

    // Mobile menu functions
    function openMenu() {
      mobileMenu.classList.add('active');
      menuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      mobileMenu.classList.remove('active');
      menuOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    // Theme functions
    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    }

    // Toast notification
    function showToast(message, type = 'success') {
      toast.textContent = message;
      toast.className = 'toast ' + type;
      toast.classList.add('show');
      
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // User interface updates
    function updateUIForUser(user) {
      userProfile.style.display = 'flex';
      openLoginTop.style.display = 'none';
      mobileLoginBtn.style.display = 'none';
      mobileUserProfile.style.display = 'flex';
      mobileLogoutBtn.style.display = 'flex';
      
      updateUserProfile(user);
      
      get(ref(database, 'users/' + user.uid)).then(snapshot => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          const name = userData.name || user.displayName || 'User';
          localStorage.setItem('userName', name);
          updateUserNameUI(name);
          mobileUserName.textContent = name;
        }
      });
    }

    function updateUserProfile(user) {
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
      userName.textContent = name;
      mobileUserName.textContent = name;
    }

    function updateUIForGuest() {
      userProfile.style.display = 'none';
      openLoginTop.style.display = 'block';
      mobileLoginBtn.style.display = 'flex';
      mobileUserProfile.style.display = 'none';
      mobileLogoutBtn.style.display = 'none';
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
      
      productsToRender.forEach(product => {
        const productCard = createProductCard(product);
        container.appendChild(productCard);
      });
    }

    // UPDATED: Product card creation with instant wishlist
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
            <div class="product-card-stars">★★★★★</div>
            <div class="product-card-review-count">(${product.reviews || '0'})</div>
          </div>
          <div class="product-card-price">
            <div class="product-card-current-price">${product.price || '₹0'}</div>
            ${product.originalPrice ? `<div class="product-card-original-price">${product.originalPrice}</div>` : ''}
          </div>
          <div class="product-card-actions">
            <button class="action-btn wishlist-btn ${isWishlisted ? 'active' : ''}" data-product-id="${product.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isWishlisted ? 'red' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>
            <button class="action-btn share-btn" data-product-id="${product.id}">
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
      
      card.querySelector('.product-card-image').addEventListener('click', () => showProductDetail(product));
      card.querySelector('.wishlist-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWishlist(product.id);
      });
      card.querySelector('.share-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        shareProduct('default', product);
      });
      
      return card;
    }

    function renderProductSlider(productsToRender, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      container.innerHTML = '';
      
      productsToRender.forEach(product => {
        const sliderItem = document.createElement('div');
        sliderItem.className = 'slider-item';
        sliderItem.innerHTML = `
          <div class="slider-item-img" style="background-image: url('${getProductImage(product)}')"></div>
          <div class="slider-item-body">
            <div class="slider-item-title">${product.name || 'Product Name'}</div>
            <div class="slider-item-price">${product.price || '₹0'}</div>
          </div>
        `;
        
        sliderItem.addEventListener('click', () => showProductDetail(product));
        container.appendChild(sliderItem);
      });
    }

    function renderCategories() {
      const container = document.getElementById('categoriesContainer');
      if (!container) return;
      
      container.innerHTML = '';
      
      categories.forEach(category => {
        const categoryPill = document.createElement('div');
        categoryPill.className = 'category-pill';
        categoryPill.textContent = category.name || 'Category';
        categoryPill.addEventListener('click', () => filterByCategory(category.id));
        container.appendChild(categoryPill);
      });
    }

    function renderCategoryCircles() {
      const container = document.getElementById('categoryCirclesContainer');
      if (!container) return;
      
      container.innerHTML = '';
      
      categories.forEach(category => {
        const circle = document.createElement('div');
        circle.className = 'category-circle';
        circle.innerHTML = `
          <div class="category-circle-image" style="background-image: url('${getProductImage(category)}')"></div>
          <div class="category-circle-name">${category.name || 'Category'}</div>
        `;
        
        circle.addEventListener('click', () => filterByCategory(category.id));
        container.appendChild(circle);
      });
    }

    function renderBannerCarousel() {
      const track = document.getElementById('bannerTrack');
      const controls = document.getElementById('bannerControls');
      
      if (!track || !controls) return;
      
      track.innerHTML = '';
      controls.innerHTML = '';
      
      banners.forEach((banner, index) => {
        const slide = document.createElement('div');
        slide.className = 'banner-slide';
        slide.style.backgroundImage = `url('${getProductImage(banner)}')`;
        
        // Add click event to open banner link
        if (banner.link) {
          slide.style.cursor = 'pointer';
          slide.addEventListener('click', () => {
            window.open(banner.link, '_blank');
          });
        }
        
        track.appendChild(slide);
        
        const dot = document.createElement('div');
        dot.className = `banner-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => setBannerSlide(index));
        controls.appendChild(dot);
      });
      
      // Remove skeleton class
      const bannerCarousel = document.getElementById('bannerCarousel');
      if (bannerCarousel) {
        bannerCarousel.classList.remove('skeleton');
      }
      
      // Auto slide
      if (banners.length > 1) {
        setInterval(() => {
          const activeIndex = banners.findIndex((_, index) => 
            document.querySelector(`.banner-dot:nth-child(${index + 1})`).classList.contains('active')
          );
          const nextIndex = (activeIndex + 1) % banners.length;
          setBannerSlide(nextIndex);
        }, 5000);
      }
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

    // Product detail functions
    function showProductDetail(product) {
      currentProduct = product;
      
      document.getElementById('detailTitle').textContent = product.name || 'Product Name';
      document.getElementById('detailPrice').textContent = product.price || '₹0';
      document.getElementById('detailDesc').textContent = product.description || '';
      document.getElementById('detailFullDesc').textContent = product.fullDescription || product.description || 'No description available.';
      document.getElementById('detailSku').textContent = `SKU: ${product.sku || 'N/A'}`;
      document.getElementById('breadcrumbProductName').textContent = product.name || 'Product';
      
      const stockStatus = document.getElementById('detailStockStatus');
      const stock = product.stock || 'in';
      if (stock === 'in' || product.quantity > 0) {
        stockStatus.textContent = 'In Stock';
        stockStatus.className = 'stock-status in-stock';
      } else if (stock === 'low' || (product.quantity > 0 && product.quantity < 10)) {
        stockStatus.textContent = 'Low Stock';
        stockStatus.className = 'stock-status low-stock';
      } else {
        stockStatus.textContent = 'Out of Stock';
        stockStatus.className = 'stock-status out-of-stock';
      }
      
      // Initialize product gallery
      initProductDetailGallery(product);
      
      // Initialize color selection
      initColorSelection(product);
      
      document.getElementById('productShareLink').value = window.location.origin + window.location.pathname.replace('index.html', '') + `#productDetail?product=${product.id}`;
      
      const wishlistBtn = document.getElementById('detailWishlistBtn');
      if (isInWishlist(product.id)) {
        wishlistBtn.textContent = 'Remove from Wishlist';
        wishlistBtn.classList.add('active');
      } else {
        wishlistBtn.textContent = 'Add to Wishlist';
        wishlistBtn.classList.remove('active');
      }
      
      loadSimilarProducts(product);
      loadProductReviews(product.id);
      
      if (currentUser) {
        addToRecentlyViewed(product.id);
      }
      
      showPage('productDetailPage');
    }

    // Initialize color selection
    function initColorSelection(product) {
      const colorOptionsGrid = document.getElementById('colorOptionsGrid');
      if (!colorOptionsGrid) return;
      
      colorOptionsGrid.innerHTML = '';
      
      // Default colors if not specified
      const colors = product.colors || [
        { name: 'Black', value: 'black', image: getProductImage(product), inStock: true },
        { name: 'White', value: 'white', image: getProductImage(product), inStock: true },
        { name: 'Blue', value: 'blue', image: getProductImage(product), inStock: true },
        { name: 'Red', value: 'red', image: getProductImage(product), inStock: true }
      ];
      
      colors.forEach((color, index) => {
        const colorBox = document.createElement('div');
        colorBox.className = `color-box ${index === 0 ? 'selected' : ''} ${!color.inStock ? 'out-of-stock' : ''}`;
        colorBox.setAttribute('data-color', color.value);
        colorBox.setAttribute('data-color-name', color.name);
        colorBox.style.backgroundImage = `url('${color.image}')`;
        
        if (index === 0) {
          selectedColor = color.value;
          selectedColorName = color.name;
          document.getElementById('selectedColorText').textContent = color.name;
        }
        
        colorOptionsGrid.appendChild(colorBox);
      });
    }

    // Initialize product detail gallery
    function initProductDetailGallery(product) {
      const mainImage = document.getElementById('productDetailMainImage');
      const dots = document.getElementById('detailCarouselDots');
      
      if (!mainImage || !dots) return;
      
      dots.innerHTML = '';
      
      currentProductImages = getProductImages();
      
      currentImageIndex = 0;
      updateMainImage();
      
      currentProductImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `detail-carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          currentImageIndex = index;
          updateMainImage();
          updateDots();
        });
        dots.appendChild(dot);
      });
      
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

    // FIXED: Order page gallery initialization
    function initOrderPageGallery() {
      if (!currentProduct) return;
      
      const galleryMain = document.getElementById('galleryMain');
      const dotsContainer = document.getElementById('orderCarouselDots');
      
      if (!galleryMain || !dotsContainer) return;
      
      const productImages = getProductImages();
      
      galleryMain.style.backgroundImage = `url('${productImages[0]}')`;
      dotsContainer.innerHTML = '';
      
      productImages.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          setOrderPageImage(index);
        });
        dotsContainer.appendChild(dot);
      });
      
      const prevBtn = galleryMain.querySelector('.carousel-control.prev');
      const nextBtn = galleryMain.querySelector('.carousel-control.next');
      
      if (prevBtn) {
        prevBtn.onclick = () => {
          const activeIndex = Array.from(dotsContainer.children).findIndex(dot => dot.classList.contains('active'));
          const newIndex = (activeIndex - 1 + productImages.length) % productImages.length;
          setOrderPageImage(newIndex);
        };
      }
      
      if (nextBtn) {
        nextBtn.onclick = () => {
          const activeIndex = Array.from(dotsContainer.children).findIndex(dot => dot.classList.contains('active'));
          const newIndex = (activeIndex + 1) % productImages.length;
          setOrderPageImage(newIndex);
        };
      }
    }

    function setOrderPageImage(index) {
      const galleryMain = document.getElementById('galleryMain');
      const dots = document.querySelectorAll('#orderCarouselDots .carousel-dot');
      const productImages = getProductImages();
      
      if (galleryMain && productImages[index]) {
        galleryMain.style.backgroundImage = `url('${productImages[index]}')`;
      }
      
      dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }

    function prevDetailImage() {
      if (currentProductImages.length <= 1) return;
      
      currentImageIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
      updateProductDetailImage();
    }

    function nextDetailImage() {
      if (currentProductImages.length <= 1) return;
      
      currentImageIndex = (currentImageIndex + 1) % currentProductImages.length;
      updateProductDetailImage();
    }

    function getProductImages() {
      if (!currentProduct) return [];
      
      if (Array.isArray(currentProduct.images) && currentProduct.images.length > 0) {
        return currentProduct.images;
      } else {
        return [getProductImage(currentProduct)];
      }
    }

    function updateProductDetailImage() {
      const mainImage = document.getElementById('productDetailMainImage');
      
      if (mainImage && currentProductImages[currentImageIndex]) {
        mainImage.style.backgroundImage = `url('${currentProductImages[currentImageIndex]}')`;
        
        document.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
          dot.classList.toggle('active', index === currentImageIndex);
        });
      }
    }

    function loadSimilarProducts(product) {
      const similarProducts = products
        .filter(p => p.id !== product.id && p.category === product.category)
        .slice(0, 10);
      
      renderProductSlider(similarProducts.length > 0 ? similarProducts : products.slice(0, 10), 'similarProductsSlider');
    }

    // Order flow functions
    function toUserInfo() {
      const selectedSize = document.querySelector('.size-option.selected');
      if (!selectedSize) {
        document.getElementById('sizeValidationError').classList.add('show');
        return;
      }
      
      const quantity = parseInt(document.getElementById('qtySelect').value) || 1;
      const size = selectedSize.getAttribute('data-value');
      const color = selectedColor || document.querySelector('.color-option.selected')?.getAttribute('data-value') || 'Not specified';
      
      const cart = {
        productId: currentProduct.id,
        quantity: quantity,
        size: size,
        color: color
      };
      localStorage.setItem('cart', JSON.stringify(cart));
      
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

    // Debounce function for search optimization
    function debounce(func, wait) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
      };
    }

    // Logout with confirmation
    function showLogoutConfirmation() {
      document.getElementById('alertTitle').textContent = 'Logout Confirmation';
      document.getElementById('alertMessage').textContent = 'Are you sure you want to logout?';
      document.getElementById('alertModal').classList.add('active');
    }

    function confirmLogout() {
      signOut(auth).then(() => {
        showToast('Logged out successfully', 'success');
        document.getElementById('alertModal').classList.remove('active');
        showPage('homePage');
      });
    }

    // FIXED: Reset Password won't show login after sending
    async function handleResetPassword() {
      const email = document.getElementById('forgotPasswordEmail').value;
      
      if (!email) {
        showToast('Please enter your email address', 'error');
        return;
      }
      
      try {
        resetPasswordBtn.disabled = true;
        resetPasswordBtn.innerHTML = '<div class="loading-spinner"></div> Sending...';
        
        await sendPasswordResetEmail(auth, email);
        showToast('Password reset email sent! Check your inbox.', 'success');
        
        document.getElementById('forgotPasswordEmail').value = '';
        
        setTimeout(() => {
          authModal.classList.remove('active');
        }, 2000);
        
      } catch (err) {
        console.error('Password reset error:', err);
        showToast(err.message, 'error');
      } finally {
        resetPasswordBtn.disabled = false;
        resetPasswordBtn.textContent = 'Send Reset Link';
      }
    }

    // Address Management Functions
    async function saveAddress(addressData, isDefault = false) {
      if (!currentUser) return null;
      
      const isDuplicate = savedAddresses.some(addr => 
        addr.name === addressData.name &&
        addr.mobile === addressData.mobile &&
        addr.pincode === addressData.pincode &&
        addr.city === addressData.city &&
        addr.state === addressData.state &&
        addr.street === addressData.street
      );
      
      if (isDuplicate) {
        showToast('Address already exists', 'info');
        return null;
      }
      
      const addressId = 'address_' + Date.now();
      const addressToSave = {
        id: addressId,
        userId: currentUser.uid,
        name: addressData.name,
        mobile: addressData.mobile,
        pincode: addressData.pincode,
        city: addressData.city,
        state: addressData.state,
        street: addressData.street,
        type: addressData.type || 'home',
        isDefault: isDefault,
        createdAt: Date.now()
      };
      
      try {
        await set(ref(database, 'addresses/' + addressId), addressToSave);
        showToast('Address saved successfully', 'success');
        
        savedAddresses.push(addressToSave);
        cacheManager.set('addresses_' + currentUser.uid, savedAddresses);
        
        return addressId;
      } catch (error) {
        console.error('Error saving address:', error);
        showToast('Failed to save address', 'error');
        return null;
      }
    }

    async function deleteAddress(addressId) {
      if (!currentUser) return;
      
      try {
        await remove(ref(database, 'addresses/' + addressId));
        
        savedAddresses = savedAddresses.filter(addr => addr.id !== addressId);
        cacheManager.set('addresses_' + currentUser.uid, savedAddresses);
        
        showToast('Address deleted successfully', 'success');
        loadSavedAddresses();
      } catch (error) {
        console.error('Error deleting address:', error);
        showToast('Failed to delete address', 'error');
      }
    }

    async function updateAddress(addressId, addressData) {
      if (!currentUser) return;
      
      try {
        await update(ref(database, 'addresses/' + addressId), addressData);
        
        const index = savedAddresses.findIndex(addr => addr.id === addressId);
        if (index !== -1) {
          savedAddresses[index] = { ...savedAddresses[index], ...addressData };
          cacheManager.set('addresses_' + currentUser.uid, savedAddresses);
        }
        
        showToast('Address updated successfully', 'success');
        loadSavedAddresses();
      } catch (error) {
        console.error('Error updating address:', error);
        showToast('Failed to update address', 'error');
      }
    }

    // UPDATED: Save user info and address
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
        type: addressType
      };
      
      await saveAddress(addressData, true);
      loadSavedAddresses();
    }

    // UPDATED: Load saved addresses with edit/delete
    async function loadSavedAddresses() {
      if (!currentUser) return;
      
      try {
        const cachedAddresses = cacheManager.get('addresses_' + currentUser.uid);
        if (cachedAddresses && cachedAddresses.length > 0) {
          savedAddresses = cachedAddresses;
          renderSavedAddresses();
        }
        
        const addressesRef = ref(database, 'addresses');
        const addressesQuery = query(addressesRef, orderByChild('userId'), equalTo(currentUser.uid));
        const snapshot = await get(addressesQuery);
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
        cacheManager.set('addresses_' + currentUser.uid, addresses);
        
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

    function editAddress(address) {
      fillAddressForm(address);
      document.getElementById('savedAddressesSection').style.display = 'none';
      document.getElementById('newAddressForm').style.display = 'block';
      
      const saveBtn = document.getElementById('saveUserInfo');
      saveBtn.textContent = 'Update Address';
      saveBtn.onclick = function() {
        updateAddress(address.id, {
          name: document.getElementById('fullname').value,
          mobile: document.getElementById('mobile').value,
          pincode: document.getElementById('pincode').value,
          city: document.getElementById('city').value,
          state: document.getElementById('state').value,
          street: document.getElementById('house').value,
          type: document.getElementById('addressType').value
        });
      };
    }

    function deleteAddressConfirmation(address) {
      document.getElementById('alertTitle').textContent = 'Delete Address';
      document.getElementById('alertMessage').textContent = `Are you sure you want to delete address for ${address.name}?`;
      document.getElementById('alertModal').classList.add('active');
      
      document.getElementById('alertConfirmBtn').onclick = function() {
        deleteAddress(address.id);
        document.getElementById('alertModal').classList.remove('active');
      };
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
      
      const saveBtn = document.getElementById('saveUserInfo');
      saveBtn.textContent = 'Save This Address';
      saveBtn.onclick = saveUserInfoAndAddress;
    }

    // Wishlist functions
    function toggleWishlistFromDetail() {
      if (!currentProduct) return;
      toggleWishlist(currentProduct.id);
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
      
      wishlistProducts.forEach(product => {
        const productCard = createProductCard(product);
        container.appendChild(productCard);
      });
    }

    // Recently viewed functions
    async function addToRecentlyViewed(productId) {
      if (!currentUser) return;
      
      try {
        await set(ref(database, 'recentlyViewed/' + currentUser.uid + '/' + productId), Date.now());
        loadRecentlyViewed(currentUser);
      } catch (error) {
        console.error('Error adding to recently viewed:', error);
      }
    }

    async function loadRecentlyViewed(user) {
      try {
        const snapshot = await get(ref(database, 'recentlyViewed/' + user.uid));
        if (snapshot.exists()) {
          recentlyViewed = Object.keys(snapshot.val());
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

    // Search functions
    function filterProducts(query, containerId) {
      const filteredProducts = query ? 
        products.filter(product => 
          product.name.toLowerCase().includes(query) ||
          (product.description && product.description.toLowerCase().includes(query)) ||
          (product.category && product.category.toLowerCase().includes(query))
        ) : 
        products;
      
      renderProducts(filteredProducts, containerId);
    }

    function filterByCategory(categoryId) {
      currentCategoryFilter = categoryId;
      
      const filteredProducts = products.filter(product => 
        product.category === categoryId
      );
      
      renderProducts(filteredProducts, 'productGrid');
      
      document.querySelectorAll('.category-pill').forEach(pill => {
        pill.classList.remove('active');
      });
      
      document.querySelectorAll('.category-pill').forEach(pill => {
        if (pill.textContent === categories.find(c => c.id === categoryId)?.name) {
          pill.classList.add('active');
        }
      });
      
      showPage('productsPage');
      addRecentSearch(categories.find(c => c.id === categoryId)?.name || 'Category');
    }

    // Price filter functions
    function applyPriceFilter() {
      const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
      const maxPrice = parseFloat(document.getElementById('maxPrice').value) || 5000;
      
      let filteredProducts = products;
      
      if (currentCategoryFilter) {
        filteredProducts = filteredProducts.filter(product => 
          product.category === currentCategoryFilter
        );
      }
      
      filteredProducts = filteredProducts.filter(product => {
        const price = parseFloat(product.price.replace('₹', '')) || 0;
        return price >= minPrice && price <= maxPrice;
      });
      
      renderProducts(filteredProducts, 'productGrid');
    }

    function resetPriceFilter() {
      document.getElementById('minPrice').value = '';
      document.getElementById('maxPrice').value = '';
      document.getElementById('minPriceSlider').value = 0;
      document.getElementById('maxPriceSlider').value = 5000;
      document.getElementById('minPriceValue').textContent = '₹0';
      document.getElementById('maxPriceValue').textContent = '₹5000';
      
      let filteredProducts = products;
      
      if (currentCategoryFilter) {
        filteredProducts = filteredProducts.filter(product => 
          product.category === currentCategoryFilter
        );
      }
      
      renderProducts(filteredProducts, 'productGrid');
      updatePriceSlider();
    }

    // Quantity functions
    function decreaseQuantity() {
      const qtyInput = document.getElementById('qtySelect');
      let value = parseInt(qtyInput.value);
      if (value > 1) {
        qtyInput.value = value - 1;
      }
    }

    function increaseQuantity() {
      const qtyInput = document.getElementById('qtySelect');
      let value = parseInt(qtyInput.value);
      if (value < 10) {
        qtyInput.value = value + 1;
      }
    }

    // Order from product detail
    function orderProductFromDetail() {
      if (!currentProduct) return;
      
      currentProduct = currentProduct;
      
      document.getElementById('spTitle').textContent = currentProduct.name;
      document.getElementById('spPrice').textContent = currentProduct.price;
      document.getElementById('spDesc').textContent = currentProduct.description || '';
      document.getElementById('spFullDesc').textContent = currentProduct.fullDescription || currentProduct.description || '';
      
      initOrderPageGallery();
      showPage('orderPage');
    }

    // Sharing functions
    function shareProduct(platform, product = null) {
      const shareProduct = product || currentProduct;
      if (!shareProduct) return;
      
      const shareUrl = window.location.origin + window.location.pathname.replace('index.html', '') + `#productDetail?product=${shareProduct.id}`;
      const shareText = `Check out ${shareProduct.name} on Buyzo Cart - ${shareProduct.price}`;
      
      let shareLink = '';
      
      switch (platform) {
        case 'facebook':
          shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
          break;
        case 'twitter':
          shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
          break;
        case 'whatsapp':
          shareLink = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
          break;
        default:
          if (navigator.share) {
            navigator.share({
              title: shareProduct.name,
              text: shareText,
              url: shareUrl
            });
            return;
          }
          break;
      }
      
      if (shareLink) {
        window.open(shareLink, '_blank');
      }
    }

    function copyShareLink() {
      const shareLink = document.getElementById('productShareLink');
      shareLink.select();
      document.execCommand('copy');
      showToast('Link copied to clipboard', 'success');
    }

    // Image zoom functions
    function openImageZoom() {
      if (!currentProduct) return;
      
      const productImages = getProductImages();
      const imageUrl = productImages[currentImageIndex];
      
      zoomImage.src = imageUrl;
      zoomModal.classList.add('active');
      resetZoom();
    }

    function adjustZoom(delta) {
      currentZoomLevel += delta;
      currentZoomLevel = Math.max(0.5, Math.min(3, currentZoomLevel));
      zoomImage.style.transform = `scale(${currentZoomLevel})`;
    }

    function resetZoom() {
      currentZoomLevel = 1;
      zoomImage.style.transform = 'scale(1)';
    }

    // Newsletter subscription
    function handleNewsletterSubscription() {
      const email = document.getElementById('newsletterEmail').value;
      
      if (!email) {
        showToast('Please enter your email address', 'error');
        return;
      }
      
      showToast('Thank you for subscribing!', 'success');
      document.getElementById('newsletterEmail').value = '';
    }

    // Step pills update
    function updateStepPills() {
      const currentPage = document.querySelector('.page.active').id;
      
      document.querySelectorAll('.step-pill').forEach(pill => {
        pill.classList.remove('disabled');
      });
      
      switch (currentPage) {
        case 'homePage':
        case 'productsPage':
          document.getElementById('pill-order').classList.add('disabled');
          document.getElementById('pill-user').classList.add('disabled');
          document.getElementById('pill-pay').classList.add('disabled');
          break;
        case 'orderPage':
          document.getElementById('pill-user').classList.add('disabled');
          document.getElementById('pill-pay').classList.add('disabled');
          break;
        case 'userPage':
          document.getElementById('pill-pay').classList.add('disabled');
          break;
      }
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
    function loadUserData(user) {
      get(ref(database, 'users/' + user.uid)).then(snapshot => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          userInfo = { ...userInfo, ...userData };
        }
      }).catch(error => {
        console.error('Error loading user data:', error);
      });
    }

    // Update user name UI
    function updateUserNameUI(name) {
      document.querySelectorAll('.user-name').forEach(el => {
        el.textContent = name;
      });
    }

    function updateProfileName() {
      const name = localStorage.getItem('userName') || '';
      if (name) {
        updateUserNameUI(name);
      }
    }

    // Orders rendering function
    function renderOrders(orders) {
      const container = document.getElementById('ordersList');
      const empty = document.getElementById('orders-empty');
      
      if (!container || !empty) return;
      
      if (orders.length === 0) {
        container.style.display = 'none';
        empty.style.display = 'block';
        return;
      }
      
      container.style.display = 'block';
      empty.style.display = 'none';
      container.innerHTML = '';
      
      orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'order-card';
        orderCard.innerHTML = `
          <div class="order-header">
            <div>
              <div class="order-id">${order.orderId}</div>
              <div class="order-date">${new Date(order.orderDate).toLocaleDateString()}</div>
            </div>
            <div class="order-status status-${order.status}">${order.status}</div>
          </div>
          <div class="order-details">
            <div class="order-product-image" style="background-image: url('${getProductImage(products.find(p => p.id === order.productId))}')"></div>
            <div class="order-product-info">
              <div class="order-product-title">${order.productName}</div>
              <div class="order-product-price">₹${order.totalAmount}</div>
              <div class="order-product-meta">Qty: ${order.quantity} | Size: ${order.size} | Color: ${order.color || 'N/A'}</div>
            </div>
          </div>
        `;
        
        orderCard.addEventListener('click', () => showOrderDetail(order));
        container.appendChild(orderCard);
      });
    }

    function showOrderDetail(order) {
      showPage('orderDetailPage');
    }

    async function showMyOrders() {
      if (!currentUser) return;
      
      try {
        const ordersRef = ref(database, 'orders');
        const ordersQuery = query(ordersRef, orderByChild('userId'), equalTo(currentUser.uid));
        const snapshot = await get(ordersQuery);
        
        if (snapshot.exists()) {
          const ordersObj = snapshot.val();
          const orders = Object.keys(ordersObj).map(key => ({
            id: key,
            ...ordersObj[key]
          }));
          
          orders.sort((a, b) => b.orderDate - a.orderDate);
          renderOrders(orders);
        } else {
          renderOrders([]);
        }
      } catch (error) {
        console.error('Error loading orders:', error);
      }
    }
  