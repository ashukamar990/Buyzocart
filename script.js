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
let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
let selectedColor = 'black';
let selectedColorName = 'Black';

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

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAeB7VzIxJaNYagUPoKd-kN5HXmLbS2-Vw",
  authDomain: "videomanager-23d98.firebaseapp.com",
  databaseURL: "https://videomanager-23d98-default-rtdb.firebaseio.com",
  projectId: "videomanager-23d98",
  storageBucket: "videomanager-23d98.firebasestorage.app",
  messagingSenderId: "847321523576",
  appId: "1:847321523576:web:bda3f5026e3e163603548d",
  measurementId: "G-YBSJ1KMPV4"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase?.auth?.();
const realtimeDb = firebase?.database?.();

// Initialize EmailJS if available
if (typeof emailjs !== 'undefined') {
  emailjs.init("YOUR_PUBLIC_KEY");
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
  console.log("Script loaded");
  
  // Check for product in URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  console.log("URL Product ID:", productId);
  
  initApp();
  setupEventListeners();
  
  // Load cached data first
  loadCachedData();
  
  // Then fetch live data
  fetchLiveData();
  
  // Setup realtime listeners
  setupRealtimeListeners();
  
  // Initialize recent searches
  updateRecentSearches();
  
  // Auth state listener
  if (auth) {
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        updateUIForUser(user);
        loadUserData(user);
        loadRecentlyViewed(user);
        loadSavedAddresses();
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.classList.remove('active');
        
        // Send login notification email
        sendLoginNotification(user);
      } else {
        currentUser = null;
        updateUIForGuest();
      }
    });
  }
  
  // Load product from URL if available
  if (productId) {
    loadProductFromId(productId);
  }
});

function initApp() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  
  // Update URL without index.html
  if (window.location.pathname.includes('index.html')) {
    const newPath = window.location.pathname.replace('index.html', '');
    const newUrl = window.location.origin + newPath + window.location.hash;
    window.history.replaceState({}, '', newUrl);
  }
  
  // Show home page or page from hash
  const pageFromHash = window.location.hash.replace('#', '');
  if (pageFromHash && document.getElementById(pageFromHash)) {
    showPage(pageFromHash);
  } else {
    showPage('homePage');
  }
  
  updateProfileName();
  setupHeroMessages();
  updateStepPills();
  updateBottomNav();
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
function fetchLiveData() {
  if (!realtimeDb) return;
  
  // Fetch products
  realtimeDb.ref('products').once('value').then(snapshot => {
    const productsObj = snapshot.val();
    if (productsObj) {
      const newProducts = Object.keys(productsObj).map(key => ({
        id: key,
        ...productsObj[key]
      }));
      
      console.log('Fetched products from Firebase:', newProducts.length);
      
      products = newProducts;
      cacheManager.set('products', products);
      
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
      }
    }
  }).catch(error => {
    console.error('Error fetching products:', error);
  });
  
  // Fetch categories
  realtimeDb.ref('categories').once('value').then(snapshot => {
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
  }).catch(error => {
    console.error('Error fetching categories:', error);
  });
  
  // Fetch banners
  realtimeDb.ref('banners').once('value').then(snapshot => {
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
  }).catch(error => {
    console.error('Error fetching banners:', error);
  });
  
  // Fetch admin settings
  realtimeDb.ref('adminSettings').once('value').then(snapshot => {
    const settingsObj = snapshot.val();
    if (settingsObj) {
      adminSettings = { ...adminSettings, ...settingsObj };
      cacheManager.set('adminSettings', adminSettings);
      updateAdminSettingsUI();
    }
  }).catch(error => {
    console.error('Error fetching admin settings:', error);
  });
}

// Setup realtime listeners
function setupRealtimeListeners() {
  if (!realtimeDb) return;
  
  // Products listener
  realtimeDb.ref('products').on('value', snapshot => {
    const productsObj = snapshot.val();
    if (productsObj) {
      const newProducts = Object.keys(productsObj).map(key => ({
        id: key,
        ...productsObj[key]
      }));
      
      products = newProducts;
      cacheManager.set('products', products);
      
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
      }
    }
  });
  
  // Categories listener
  realtimeDb.ref('categories').on('value', snapshot => {
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
  realtimeDb.ref('banners').on('value', snapshot => {
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
  realtimeDb.ref('adminSettings').on('value', snapshot => {
    const settingsObj = snapshot.val();
    if (settingsObj) {
      adminSettings = { ...adminSettings, ...settingsObj };
      cacheManager.set('adminSettings', adminSettings);
      updateAdminSettingsUI();
    }
  });
}

// Load Product from ID (URL parameter)
async function loadProductFromId(productId) {
  console.log("Loading product from ID:", productId);
  
  if (!realtimeDb) {
    console.error('Firebase not initialized');
    return;
  }
  
  try {
    const snapshot = await realtimeDb.ref('products/' + productId).once('value');
    const product = snapshot.val();
    
    if (product) {
      console.log("Product found:", product.title || product.name);
      product.id = productId;
      showProductDetail(product);
    } else {
      console.error("Product not found for ID:", productId);
      showToast('Product not found', 'error');
    }
  } catch (error) {
    console.error('Error loading product:', error);
    showToast('Error loading product details', 'error');
  }
}

// Fixed Functions

function handleSearch() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  
  const query = searchInput.value.toLowerCase().trim();
  if (query) {
    addToRecentSearches(query);
    filterProducts(query, 'productGrid');
  } else {
    filterProducts('', 'productGrid');
  }
}

function handleHomeSearch() {
  const homeSearchInput = document.getElementById('homeSearchInput');
  if (!homeSearchInput) return;
  
  const query = homeSearchInput.value.toLowerCase().trim();
  const resultsContainer = document.getElementById('homeSearchResults');
  const homeProductGrid = document.getElementById('homeProductGrid');
  
  if (!resultsContainer || !homeProductGrid) return;
  
  if (query.length === 0) {
    resultsContainer.style.display = 'none';
    homeProductGrid.style.display = 'grid';
    return;
  }
  
  addToRecentSearches(query);
  
  const filteredProducts = products.filter(product => {
    const nameMatch = product.name && product.name.toLowerCase().includes(query);
    const titleMatch = product.title && product.title.toLowerCase().includes(query);
    const descMatch = product.description && product.description.toLowerCase().includes(query);
    const categoryMatch = product.category && product.category.toLowerCase().includes(query);
    return nameMatch || titleMatch || descMatch || categoryMatch;
  });
  
  if (filteredProducts.length === 0) {
    resultsContainer.innerHTML = '<div class="card-panel center">No products found for "' + query + '"</div>';
  } else {
    renderProducts(filteredProducts, 'homeSearchResults');
  }
  
  resultsContainer.style.display = 'grid';
  homeProductGrid.style.display = 'none';
}

function filterProducts(query, containerId) {
  let filteredProducts = products;
  
  // Apply search filter
  if (query) {
    filteredProducts = filteredProducts.filter(product => {
      const nameMatch = product.name && product.name.toLowerCase().includes(query);
      const titleMatch = product.title && product.title.toLowerCase().includes(query);
      const descMatch = product.description && product.description.toLowerCase().includes(query);
      const categoryMatch = product.category && product.category.toLowerCase().includes(query);
      return nameMatch || titleMatch || descMatch || categoryMatch;
    });
  }
  
  // Apply category filter
  if (currentCategoryFilter) {
    filteredProducts = filteredProducts.filter(product => 
      product.category === currentCategoryFilter
    );
  }
  
  // Apply price filter
  const minPrice = parseFloat(document.getElementById('minPrice')?.value) || 0;
  const maxPrice = parseFloat(document.getElementById('maxPrice')?.value) || 100000;
  
  filteredProducts = filteredProducts.filter(product => {
    const price = parsePrice(product.price);
    return price >= minPrice && price <= maxPrice;
  });
  
  renderProducts(filteredProducts, containerId);
}

function filterByCategory(categoryId) {
  currentCategoryFilter = categoryId;
  
  // Update UI
  document.querySelectorAll('.category-pill').forEach(pill => {
    pill.classList.remove('active');
  });
  
  document.querySelectorAll('.category-pill').forEach(pill => {
    if (pill.getAttribute('data-category-id') === categoryId) {
      pill.classList.add('active');
    }
  });
  
  document.querySelectorAll('.category-circle').forEach(circle => {
    circle.classList.remove('active');
  });
  
  document.querySelectorAll('.category-circle').forEach(circle => {
    if (circle.getAttribute('data-category-id') === categoryId) {
      circle.classList.add('active');
    }
  });
  
  const searchInput = document.getElementById('searchInput');
  filterProducts(searchInput?.value || '', 'productGrid');
}

function applyPriceFilter() {
  const minPrice = parseFloat(document.getElementById('minPrice')?.value) || 0;
  const maxPrice = parseFloat(document.getElementById('maxPrice')?.value) || 100000;
  
  const minPriceSlider = document.getElementById('minPriceSlider');
  const maxPriceSlider = document.getElementById('maxPriceSlider');
  const minPriceValue = document.getElementById('minPriceValue');
  const maxPriceValue = document.getElementById('maxPriceValue');
  
  if (minPriceSlider) minPriceSlider.value = minPrice;
  if (maxPriceSlider) maxPriceSlider.value = maxPrice;
  if (minPriceValue) minPriceValue.textContent = '₹' + minPrice;
  if (maxPriceValue) maxPriceValue.textContent = '₹' + maxPrice;
  
  const searchInput = document.getElementById('searchInput');
  filterProducts(searchInput?.value || '', 'productGrid');
}

function resetPriceFilter() {
  const minPrice = document.getElementById('minPrice');
  const maxPrice = document.getElementById('maxPrice');
  const minPriceSlider = document.getElementById('minPriceSlider');
  const maxPriceSlider = document.getElementById('maxPriceSlider');
  const minPriceValue = document.getElementById('minPriceValue');
  const maxPriceValue = document.getElementById('maxPriceValue');
  
  if (minPrice) minPrice.value = '';
  if (maxPrice) maxPrice.value = '';
  if (minPriceSlider) minPriceSlider.value = 0;
  if (maxPriceSlider) maxPriceSlider.value = 5000;
  if (minPriceValue) minPriceValue.textContent = '₹0';
  if (maxPriceValue) maxPriceValue.textContent = '₹5000';
  
  const searchInput = document.getElementById('searchInput');
  filterProducts(searchInput?.value || '', 'productGrid');
}

// Get Product Image - Handle Firebase structure
function getProductImage(product, idx = 0) {
  if (!product) {
    return "https://via.placeholder.com/300x300/f3f4f6/64748b?text=Loading...";
  }
  
  // 1. First check for "Images" (capital I) - Firebase structure
  if (product.Images && typeof product.Images === 'object') {
    const imageUrls = Object.values(product.Images);
    if (imageUrls.length > 0) {
      const imageUrl = imageUrls[idx] || imageUrls[0];
      return imageUrl;
    }
  }
  
  // 2. Check for "images" (small i) array
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    if (idx < product.images.length) {
      return product.images[idx];
    }
    return product.images[0];
  }
  
  // 3. Check for single image properties
  const imageProperties = ['image', 'img', 'imageUrl', 'photo', 'thumbnail'];
  for (const prop of imageProperties) {
    if (product[prop]) {
      return product[prop];
    }
  }
  
  // 4. Last resort: placeholder
  return "https://via.placeholder.com/300x300/f3f4f6/64748b?text=No+Image";
}

// Get Product Images Array - Handle Firebase structure
function getProductImages() {
  if (!currentProduct) return ["https://via.placeholder.com/600x600/f3f4f6/64748b?text=No+Image"];
  
  // 1. First priority: Use currentProductImages from color selection
  if (currentProductImages && currentProductImages.length > 0) {
    return currentProductImages;
  }
  
  // 2. Check for "Images" (capital I) object from Firebase
  if (currentProduct.Images && typeof currentProduct.Images === 'object') {
    const imagesFromObject = Object.values(currentProduct.Images);
    if (imagesFromObject.length > 0) {
      return imagesFromObject;
    }
  }
  
  // 3. Check for "images" (small i) array
  if (Array.isArray(currentProduct.images) && currentProduct.images.length > 0) {
    return currentProduct.images;
  }
  
  // 4. Check for single image properties
  const imageProperties = ['image', 'img', 'imageUrl', 'photo', 'thumbnail'];
  for (const prop of imageProperties) {
    if (currentProduct[prop]) {
      return [currentProduct[prop]];
    }
  }
  
  // 5. Last resort: Default placeholder
  return ["https://via.placeholder.com/600x600/f3f4f6/64748b?text=No+Image"];
}

// Color Switcher Function
function initColorSwitcher(product) {
  const colorOptionsGrid = document.getElementById('colorOptionsGrid');
  if (!colorOptionsGrid) return;
  
  colorOptionsGrid.innerHTML = '';
  
  // Get colors from product data or use defaults
  const colors = product.colors || [
    { 
      id: 'black', 
      name: 'Black', 
      images: [
        'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&auto=format&fit=crop&q=80'
      ],
      thumbnail: 'https://via.placeholder.com/300x300/000000/FFFFFF?text=Black',
      available: true
    },
    { 
      id: 'blue', 
      name: 'Blue', 
      images: [
        'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1586790170083-2f9ceadc732d?w=600&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&auto=format&fit=crop&q=80'
      ],
      thumbnail: 'https://via.placeholder.com/300x300/2563eb/FFFFFF?text=Blue',
      available: true
    }
  ];
  
  // Find first available color
  const firstAvailableColor = colors.find(color => color.available) || colors[0];
  
  colors.forEach((color, index) => {
    const colorBox = document.createElement('div');
    colorBox.className = `color-box ${color.id === firstAvailableColor.id ? 'selected' : ''} ${!color.available ? 'out-of-stock' : ''}`;
    colorBox.setAttribute('data-color', color.id);
    colorBox.setAttribute('data-color-name', color.name);
    colorBox.setAttribute('data-images', JSON.stringify(color.images));
    colorBox.style.backgroundImage = `url('${color.thumbnail}')`;
    
    // Tooltip for out of stock
    if (!color.available) {
      colorBox.title = 'Out of Stock';
    }
    
    colorBox.addEventListener('click', function() {
      if (this.classList.contains('out-of-stock')) return;
      
      // Update selected color
      document.querySelectorAll('.color-box').forEach(box => {
        box.classList.remove('selected');
      });
      this.classList.add('selected');
      
      // Update color data
      selectedColor = this.getAttribute('data-color');
      selectedColorName = this.getAttribute('data-color-name');
      const colorImages = JSON.parse(this.getAttribute('data-images'));
      
      // Update color name display
      const colorNameDisplay = document.getElementById('selectedColorNameDisplay');
      if (colorNameDisplay) {
        colorNameDisplay.textContent = selectedColorName;
      }
      
      // Update product images array
      currentProductImages = colorImages || [getProductImage(currentProduct)];
      
      // Update main product image immediately
      if (currentProductImages.length > 0) {
        const mainImage = document.getElementById('productDetailMainImage');
        if (mainImage) {
          mainImage.style.backgroundImage = `url('${currentProductImages[0]}')`;
          mainImage.style.backgroundSize = 'cover';
          mainImage.style.backgroundPosition = 'center';
        }
        
        // Update current image index
        currentImageIndex = 0;
        
        // Update image dots
        updateDetailCarouselDots(currentProductImages.length);
        
        // Update product detail image
        updateProductDetailImage();
      }
      
      // Update order page gallery if active
      if (document.getElementById('orderPage')?.classList.contains('active')) {
        initOrderPageGallery();
      }
    });
    
    colorOptionsGrid.appendChild(colorBox);
  });
  
  // Set initial color
  if (firstAvailableColor) {
    selectedColor = firstAvailableColor.id;
    selectedColorName = firstAvailableColor.name;
    
    const colorNameDisplay = document.getElementById('selectedColorNameDisplay');
    if (colorNameDisplay) {
      colorNameDisplay.textContent = selectedColorName;
    }
    
    // Set initial images
    currentProductImages = firstAvailableColor.images || [firstAvailableColor.thumbnail];
  }
}

// Update Detail Carousel Dots Function
function updateDetailCarouselDots(totalImages) {
  const dots = document.getElementById('detailCarouselDots');
  if (!dots) return;
  
  dots.innerHTML = '';
  
  for (let i = 0; i < totalImages; i++) {
    const dot = document.createElement('div');
    dot.className = `carousel-dot ${i === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => {
      currentImageIndex = i;
      updateProductDetailImage();
      updateDots();
    });
    dots.appendChild(dot);
  }
}

function updateDots() {
  document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index === currentImageIndex);
  });
}

// Enhanced Show Product Detail Function
function showProductDetail(product) {
  console.log("Showing product detail for:", product?.title || product?.name);
  
  if (!product) {
    console.error("No product provided to showProductDetail");
    showToast('Product data not available', 'error');
    return;
  }
  
  currentProduct = product;
  
  // Update text content with fallbacks
  const detailTitle = document.getElementById('detailTitle');
  const detailPrice = document.getElementById('detailPrice');
  const detailDesc = document.getElementById('detailDesc');
  const detailFullDesc = document.getElementById('detailFullDesc');
  const detailSku = document.getElementById('detailSku');
  const breadcrumbProductName = document.getElementById('breadcrumbProductName');
  
  if (detailTitle) detailTitle.textContent = product.title || product.name || 'Product Name';
  if (detailPrice) detailPrice.textContent = product.price || '₹0';
  if (detailDesc) detailDesc.textContent = product.desc || product.description || 'No description available';
  if (detailFullDesc) detailFullDesc.textContent = product.fulLDesc || product.fullDescription || product.desc || product.description || 'No detailed description available';
  if (detailSku) detailSku.textContent = `SKU: ${product.sku || 'N/A'}`;
  if (breadcrumbProductName) breadcrumbProductName.textContent = product.title || product.name || 'Product';
  
  // Update stock status
  const stockStatus = document.getElementById('detailStockStatus');
  if (stockStatus) {
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
  }
  
  // Initialize gallery with Firebase Images
  initProductDetailGallery(product);
  
  // Initialize color switcher
  initColorSwitcher(product);
  
  // Update share link
  const productShareLink = document.getElementById('productShareLink');
  if (productShareLink) {
    const shareUrl = window.location.origin + window.location.pathname.replace('index.html', '') + '?product=' + product.id;
    productShareLink.value = shareUrl;
  }
  
  // Update wishlist button
  const wishlistBtn = document.getElementById('detailWishlistBtn');
  if (wishlistBtn) {
    if (isInWishlist(product.id)) {
      wishlistBtn.textContent = 'Remove from Wishlist';
      wishlistBtn.classList.add('active');
    } else {
      wishlistBtn.textContent = 'Add to Wishlist';
      wishlistBtn.classList.remove('active');
    }
  }
  
  // Load related content
  loadSimilarProducts(product);
  loadProductReviews(product.id);
  
  // Add to recently viewed
  if (currentUser) {
    addToRecentlyViewed(product.id);
  }
  
  // Show the page with updated URL
  showPageWithProduct('productDetailPage', product.id);
}

// Show Page with Product URL Update
function showPageWithProduct(pageId, productId = null) {
  // Update URL with product parameter
  let newUrl = window.location.origin + window.location.pathname.replace('index.html', '');
  
  if (pageId === 'productDetailPage' && productId) {
    newUrl += '?product=' + productId + '#productDetailPage';
  } else {
    newUrl += '#' + pageId;
  }
  
  window.history.pushState({ page: pageId, productId: productId }, '', newUrl);
  
  // Show the page
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  } else {
    console.error('Page not found:', pageId);
  }
  
  updateStepPills();
  updateBottomNav();
  window.scrollTo(0, 0);
}

// Page navigation
function showPage(pageId) {
  // Update URL without index.html
  const newUrl = window.location.origin + window.location.pathname.replace('index.html', '') + '#' + pageId;
  window.history.pushState({ page: pageId }, '', newUrl);
  
  // Handle special pages
  if (pageId === 'accountPage' || pageId === 'settingsPage' || pageId === 'addressPage') {
    window.location.href = 'account.html';
    return;
  }
  
  // Show the page
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  } else {
    console.error('Page not found:', pageId);
    return;
  }
  
  updateStepPills();
  updateBottomNav();
  window.scrollTo(0, 0);
  
  // Page-specific actions
  if (pageId === 'myOrdersPage' && currentUser) {
    showMyOrders();
  }
  
  if (pageId === 'wishlistPage') {
    renderWishlist();
  }
  
  if (pageId === 'productDetailPage' && currentProduct) {
    loadProductReviews(currentProduct.id);
    initColorSwitcher(currentProduct);
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
}

function checkAuthAndShowPage(pageId) {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  showPage(pageId);
}

// Enhanced Product Detail Gallery
function initProductDetailGallery(product) {
  const mainImage = document.getElementById('productDetailMainImage');
  const dots = document.getElementById('detailCarouselDots');
  
  if (!mainImage) {
    console.error('Main image element not found');
    return;
  }
  
  // Get images from Firebase structure
  let images = [];
  
  // 1. First try: Use "Images" (capital I) object from Firebase
  if (product.Images && typeof product.Images === 'object') {
    images = Object.values(product.Images);
  }
  // 2. Second try: Use "images" (small i) array
  else if (Array.isArray(product.images) && product.images.length > 0) {
    images = product.images;
  }
  // 3. Third try: Check for single image properties
  else if (product.image) {
    images = [product.image];
  }
  else if (product.img) {
    images = [product.img];
  }
  else if (product.imageUrl) {
    images = [product.imageUrl];
  }
  else if (product.photo) {
    images = [product.photo];
  }
  // Fallback to placeholder
  else {
    images = ["https://via.placeholder.com/600x600/f3f4f6/64748b?text=Product+Image"];
  }
  
  // Set current images
  currentProductImages = images;
  
  // Update main image immediately
  if (images.length > 0 && mainImage) {
    mainImage.style.backgroundImage = `url('${images[0]}')`;
    mainImage.style.display = 'block';
    mainImage.style.backgroundSize = 'cover';
    mainImage.style.backgroundPosition = 'center';
    
    // Add click event for zoom
    mainImage.addEventListener('click', openZoomModal);
  }
  
  // Reset index
  currentImageIndex = 0;
  
  // Update dots
  if (dots) {
    updateDetailCarouselDots(images.length);
  }
  
  // Also update any other image displays
  updateProductDetailImage();
}

function updateProductDetailImage() {
  const mainImage = document.getElementById('productDetailMainImage');
  
  if (mainImage && currentProductImages[currentImageIndex]) {
    mainImage.style.backgroundImage = `url('${currentProductImages[currentImageIndex]}')`;
    mainImage.style.backgroundSize = 'cover';
    mainImage.style.backgroundPosition = 'center';
    
    document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === currentImageIndex);
    });
  }
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

// Zoom Modal Functions
function openZoomModal() {
  if (!currentProduct) return;
  
  const productImages = getProductImages();
  const modalImage = document.getElementById('modalZoomImage');
  const modal = document.getElementById('zoomModal');
  
  if (productImages[currentImageIndex] && modalImage && modal) {
    modalImage.src = productImages[currentImageIndex];
    modal.classList.add('active');
    
    // Update modal dots
    updateModalDots();
  }
}

function prevZoomImage() {
  if (currentProductImages.length <= 1) return;
  
  currentImageIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
  updateZoomModalImage();
}

function nextZoomImage() {
  if (currentProductImages.length <= 1) return;
  
  currentImageIndex = (currentImageIndex + 1) % currentProductImages.length;
  updateZoomModalImage();
}

function updateZoomModalImage() {
  const modalImage = document.getElementById('modalZoomImage');
  if (modalImage && currentProductImages[currentImageIndex]) {
    modalImage.src = currentProductImages[currentImageIndex];
    updateModalDots();
  }
}

function updateModalDots() {
  const modalDots = document.getElementById('modalDots');
  if (!modalDots) return;
  
  modalDots.innerHTML = '';
  
  currentProductImages.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = `modal-dot ${index === currentImageIndex ? 'active' : ''}`;
    dot.addEventListener('click', () => {
      currentImageIndex = index;
      updateZoomModalImage();
    });
    modalDots.appendChild(dot);
  });
}

// UPDATED Product Card Creation with Proper Click Events
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
      <div class="product-card-title">${product.title || product.name || 'Product Name'}</div>
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
  
  // Add proper click event to product card
  card.addEventListener('click', function(e) {
    // Don't trigger if clicking on buttons inside
    if (e.target.closest('.action-btn')) {
      return;
    }
    showProductDetail(product);
  });
  
  // Wishlist button event
  const wishlistBtn = card.querySelector('.wishlist-btn');
  if (wishlistBtn) {
    wishlistBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleWishlist(product.id);
    });
  }
  
  // Share button event
  const shareBtn = card.querySelector('.share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      shareProduct('default', product);
    });
  }
  
  return card;
}

// Fixed: Product Image Full Screen View
function openProductImageModal() {
  if (!currentProduct) return;
  
  currentProductModalIndex = 0;
  updateProductModalImage();
  const productImageModal = document.getElementById('productImageModal');
  if (productImageModal) productImageModal.classList.add('active');
}

function updateProductModalImage() {
  if (currentProductImages.length === 0) return;
  
  const productImageModalImage = document.getElementById('productImageModalImage');
  const productImageModalDots = document.getElementById('productImageModalDots');
  
  if (productImageModalImage) {
    productImageModalImage.src = currentProductImages[currentProductModalIndex];
  }
  
  if (productImageModalDots) {
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

// Remaining Functions

function updateOutOfStockStatus() {
  document.querySelectorAll('.color-box').forEach(box => {
    const color = box.getAttribute('data-color');
    const isOutOfStock = Math.random() > 0.7;
    if (isOutOfStock) {
      box.classList.add('out-of-stock');
    } else {
      box.classList.remove('out-of-stock');
    }
  });
}

async function deleteReview(reviewId) {
  if (!currentUser || !realtimeDb) return;
  
  const isAdmin = currentUser.email === 'admin@buyzocart.com';
  
  if (!confirm('Are you sure you want to delete this review?')) return;
  
  try {
    const snapshot = await realtimeDb.ref('reviews/' + reviewId).once('value');
    const review = snapshot.val();
    if (review && (review.userId === currentUser.uid || isAdmin)) {
      await realtimeDb.ref('reviews/' + reviewId).remove();
      showToast('Review deleted successfully', 'success');
      loadProductReviews(currentProduct.id);
    } else {
      showToast('You can only delete your own reviews', 'error');
    }
  } catch (error) {
    console.error('Error deleting review:', error);
    showToast('Failed to delete review', 'error');
  }
}

// Email Notification System
async function sendLoginNotification(user) {
  try {
    if (typeof emailjs === 'undefined') return;
    
    const templateParams = {
      to_email: user.email,
      user_name: user.displayName || 'User',
      login_time: new Date().toLocaleString(),
      user_email: user.email
    };
    
    await emailjs.send('service_id', 'template_id', templateParams);
    console.log('Login notification sent successfully');
  } catch (error) {
    console.error('Error sending login notification:', error);
  }
}

async function sendOrderNotification(orderData) {
  try {
    if (typeof emailjs === 'undefined') return;
    
    const templateParams = {
      to_email: orderData.userEmail,
      user_name: orderData.username,
      order_id: orderData.orderId,
      product_name: orderData.productName,
      total_amount: orderData.totalAmount,
      order_date: new Date(orderData.orderDate).toLocaleString()
    };
    
    await emailjs.send('service_id', 'template_id', templateParams);
    console.log('Order notification sent successfully');
  } catch (error) {
    console.error('Error sending order notification:', error);
  }
}

// Advanced Search Features
function addToRecentSearches(query) {
  if (!query.trim()) return;
  
  recentSearches = recentSearches.filter(item => item !== query);
  recentSearches.unshift(query);
  
  if (recentSearches.length > 10) {
    recentSearches = recentSearches.slice(0, 10);
  }
  
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  updateRecentSearches();
}

function updateRecentSearches() {
  const recentSearchesContainer = document.getElementById('recentSearches');
  if (!recentSearchesContainer) return;
  
  recentSearchesContainer.innerHTML = '';
  
  recentSearches.forEach(search => {
    const searchTag = document.createElement('div');
    searchTag.className = 'search-tag';
    searchTag.textContent = search;
    searchTag.addEventListener('click', () => {
      const homeSearchInput = document.getElementById('homeSearchInput');
      const advancedSearchPanel = document.getElementById('advancedSearchPanel');
      
      if (homeSearchInput) homeSearchInput.value = search;
      if (homeSearchInput) homeSearchInput.focus();
      handleHomeSearch();
      if (advancedSearchPanel) advancedSearchPanel.classList.remove('active');
    });
    recentSearchesContainer.appendChild(searchTag);
  });
}

function clearRecentSearches() {
  recentSearches = [];
  localStorage.setItem('recentSearches', JSON.stringify([]));
  updateRecentSearches();
}

// Bottom Navigation
function updateBottomNav() {
  const currentPage = document.querySelector('.page.active');
  if (!currentPage) return;
  
  const currentPageId = currentPage.id;
  document.querySelectorAll('.bottom-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  
  if (currentPageId === 'homePage') {
    const firstNavItem = document.querySelector('.bottom-nav-item:nth-child(1)');
    if (firstNavItem) firstNavItem.classList.add('active');
  } else if (currentPageId === 'productsPage') {
    const secondNavItem = document.querySelector('.bottom-nav-item:nth-child(2)');
    if (secondNavItem) secondNavItem.classList.add('active');
  }
}

function checkAuthAndShowAccount() {
  if (!currentUser) {
    showLoginModal();
  } else {
    window.location.href = 'account.html';
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

// Improved Wishlist Functions
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
  
  if (document.getElementById('wishlistPage')?.classList.contains('active')) {
    renderWishlist();
  }
}

async function updateWishlistInFirebase(productId, add) {
  if (!currentUser || !realtimeDb) return;
  
  try {
    if (add) {
      await realtimeDb.ref('userWishlists/' + currentUser.uid + '/' + productId).set({
        productId: productId,
        addedAt: Date.now()
      });
    } else {
      await realtimeDb.ref('userWishlists/' + currentUser.uid + '/' + productId).remove();
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
  const deliveryCharge = document.getElementById('deliveryCharge');
  const sumDel = document.getElementById('sumDel');
  const gatewayChargePercent = document.getElementById('gatewayChargePercent');
  
  if (deliveryCharge) deliveryCharge.textContent = adminSettings.deliveryCharge;
  if (sumDel) sumDel.textContent = `₹${adminSettings.deliveryCharge}`;
  if (gatewayChargePercent) gatewayChargePercent.textContent = `${adminSettings.gatewayChargePercent}%`;
}

// Setup Event Listeners
function setupEventListeners() {
  // Menu
  const menuIcon = document.getElementById('menuIcon');
  const menuClose = document.getElementById('menuClose');
  const menuOverlay = document.getElementById('menuOverlay');
  
  if (menuIcon) menuIcon.addEventListener('click', openMenu);
  if (menuClose) menuClose.addEventListener('click', closeMenu);
  if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);
  
  // Theme
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  
  // Auth Modal
  const authModal = document.getElementById('authModal');
  const authClose = document.getElementById('authClose');
  if (authClose) authClose.addEventListener('click', () => {
    if (authModal) authModal.classList.remove('active');
  });
  
  const openLoginTop = document.getElementById('openLoginTop');
  if (openLoginTop) openLoginTop.addEventListener('click', showLoginModal);
  
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  if (mobileLoginBtn) mobileLoginBtn.addEventListener('click', showLoginModal);
  
  // Auth Tabs
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const switchToLogin = document.getElementById('switchToLogin');
  
  if (loginTab) loginTab.addEventListener('click', () => switchAuthTab('login'));
  if (signupTab) signupTab.addEventListener('click', () => switchAuthTab('signup'));
  if (switchToLogin) switchToLogin.addEventListener('click', () => switchAuthTab('login'));
  
  // Auth Buttons
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const googleSignupBtn = document.getElementById('googleSignupBtn');
  
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleSignup);
  if (googleLoginBtn) googleLoginBtn.addEventListener('click', handleGoogleLogin);
  if (googleSignupBtn) googleSignupBtn.addEventListener('click', handleGoogleLogin);
  
  // Forgot Password
  const forgotPasswordLink = document.getElementById('forgotPasswordLink');
  const backToLogin = document.getElementById('backToLogin');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', () => {
      const loginForm = document.getElementById('loginForm');
      const forgotPasswordForm = document.getElementById('forgotPasswordForm');
      if (loginForm) loginForm.classList.remove('active');
      if (forgotPasswordForm) forgotPasswordForm.classList.add('active');
    });
  }
  
  if (backToLogin) {
    backToLogin.addEventListener('click', () => {
      const forgotPasswordForm = document.getElementById('forgotPasswordForm');
      const loginForm = document.getElementById('loginForm');
      if (forgotPasswordForm) forgotPasswordForm.classList.remove('active');
      if (loginForm) loginForm.classList.add('active');
    });
  }
  
  if (resetPasswordBtn) resetPasswordBtn.addEventListener('click', handleResetPassword);
  
  // User Profile
  const userProfile = document.getElementById('userProfile');
  if (userProfile) userProfile.addEventListener('click', () => window.location.href = 'account.html');
  
  // Mobile Logout
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', showLogoutConfirmation);
  
  // Alert Modal
  const alertCancelBtn = document.getElementById('alertCancelBtn');
  const alertConfirmBtn = document.getElementById('alertConfirmBtn');
  
  if (alertCancelBtn) alertCancelBtn.addEventListener('click', () => {
    const alertModal = document.getElementById('alertModal');
    if (alertModal) alertModal.classList.remove('active');
  });
  
  if (alertConfirmBtn) alertConfirmBtn.addEventListener('click', confirmLogout);
  
  // My Orders
  const openMyOrdersTop = document.getElementById('openMyOrdersTop');
  if (openMyOrdersTop) openMyOrdersTop.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
  
  // Zoom Modal (old)
  const zoomClose = document.getElementById('zoomClose');
  const zoomIn = document.getElementById('zoomIn');
  const zoomOut = document.getElementById('zoomOut');
  const zoomReset = document.getElementById('zoomReset');
  
  if (zoomClose) zoomClose.addEventListener('click', () => {
    const zoomModal = document.getElementById('zoomModal');
    if (zoomModal) zoomModal.classList.remove('active');
  });
  
  if (zoomIn) zoomIn.addEventListener('click', () => adjustZoom(0.2));
  if (zoomOut) zoomOut.addEventListener('click', () => adjustZoom(-0.2));
  if (zoomReset) zoomReset.addEventListener('click', resetZoom);
  
  // Product Image Modal (old)
  const productImageModalClose = document.getElementById('productImageModalClose');
  const productImageModalPrev = document.getElementById('productImageModalPrev');
  const productImageModalNext = document.getElementById('productImageModalNext');
  
  if (productImageModalClose) productImageModalClose.addEventListener('click', () => {
    const productImageModal = document.getElementById('productImageModal');
    if (productImageModal) productImageModal.classList.remove('active');
  });
  
  if (productImageModalPrev) productImageModalPrev.addEventListener('click', prevProductModalImage);
  if (productImageModalNext) productImageModalNext.addEventListener('click', nextProductModalImage);
  
  // Search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
  }
  
  const homeSearchInput = document.getElementById('homeSearchInput');
  if (homeSearchInput) {
    homeSearchInput.addEventListener('input', debounce(handleHomeSearch, 300));
    homeSearchInput.addEventListener('focus', () => {
      const advancedSearchPanel = document.getElementById('advancedSearchPanel');
      if (advancedSearchPanel) advancedSearchPanel.classList.add('active');
    });
  }
  
  const searchIcon = document.getElementById('searchIcon');
  if (searchIcon) {
    searchIcon.addEventListener('click', () => {
      handleHomeSearch();
    });
  }
  
  const clearRecentSearchesBtn = document.getElementById('clearRecentSearches');
  if (clearRecentSearchesBtn) {
    clearRecentSearchesBtn.addEventListener('click', clearRecentSearches);
  }
  
  // Close advanced search panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap') && !e.target.closest('.advanced-search-panel')) {
      const advancedSearchPanel = document.getElementById('advancedSearchPanel');
      if (advancedSearchPanel) advancedSearchPanel.classList.remove('active');
    }
  });
  
  // Navigation buttons
  const backToProducts = document.getElementById('backToProducts');
  if (backToProducts) backToProducts.addEventListener('click', () => showPage('productsPage'));
  
  const toUserInfo = document.getElementById('toUserInfo');
  if (toUserInfo) toUserInfo.addEventListener('click', toUserInfo);
  
  const editOrder = document.getElementById('editOrder');
  if (editOrder) editOrder.addEventListener('click', () => showPage('orderPage'));
  
  const toPayment = document.getElementById('toPayment');
  if (toPayment) toPayment.addEventListener('click', toPayment);
  
  const payBack = document.getElementById('payBack');
  if (payBack) payBack.addEventListener('click', () => showPage('userPage'));
  
  const confirmOrder = document.getElementById('confirmOrder');
  if (confirmOrder) confirmOrder.addEventListener('click', confirmOrder);
  
  const goHome = document.getElementById('goHome');
  if (goHome) goHome.addEventListener('click', () => showPage('homePage'));
  
  const viewOrders = document.getElementById('viewOrders');
  if (viewOrders) viewOrders.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
  
  // Quantity buttons
  const qtyMinus = document.querySelector('.qty-minus');
  const qtyPlus = document.querySelector('.qty-plus');
  
  if (qtyMinus) qtyMinus.addEventListener('click', decreaseQuantity);
  if (qtyPlus) qtyPlus.addEventListener('click', increaseQuantity);
  
  // Size options
  document.querySelectorAll('.size-option').forEach(option => {
    option.addEventListener('click', function() {
      document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');
      const sizeValidationError = document.getElementById('sizeValidationError');
      if (sizeValidationError) sizeValidationError.classList.remove('show');
    });
  });
  
  // Color options
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
      document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');
    });
  });
  
  // Price filter
  const applyPriceFilterBtn = document.getElementById('applyPriceFilter');
  const resetPriceFilterBtn = document.getElementById('resetPriceFilter');
  
  if (applyPriceFilterBtn) applyPriceFilterBtn.addEventListener('click', applyPriceFilter);
  if (resetPriceFilterBtn) resetPriceFilterBtn.addEventListener('click', resetPriceFilter);
  
  // Newsletter
  const subscribeBtn = document.getElementById('subscribeBtn');
  if (subscribeBtn) subscribeBtn.addEventListener('click', handleNewsletterSubscription);
  
  // Share buttons
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const platform = this.getAttribute('data-platform');
      shareProduct(platform);
    });
  });
  
  const copyShareLinkBtn = document.getElementById('copyShareLink');
  if (copyShareLinkBtn) copyShareLinkBtn.addEventListener('click', copyShareLink);
  
  // Product detail buttons
  const detailOrderBtn = document.getElementById('detailOrderBtn');
  if (detailOrderBtn) detailOrderBtn.addEventListener('click', orderProductFromDetail);
  
  const detailWishlistBtn = document.getElementById('detailWishlistBtn');
  if (detailWishlistBtn) detailWishlistBtn.addEventListener('click', toggleWishlistFromDetail);
  
  // Image Gallery Navigation
  const prevDetailBtn = document.querySelector('.detail-carousel-control.prev');
  const nextDetailBtn = document.querySelector('.detail-carousel-control.next');
  
  if (prevDetailBtn) prevDetailBtn.addEventListener('click', prevDetailImage);
  if (nextDetailBtn) nextDetailBtn.addEventListener('click', nextDetailImage);
  
  // Zoom Modal Events (new)
  const closeZoomModalBtn = document.getElementById('closeZoomModalBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  if (closeZoomModalBtn) {
    closeZoomModalBtn.addEventListener('click', () => {
      const zoomModal = document.getElementById('zoomModal');
      if (zoomModal) zoomModal.classList.remove('active');
    });
  }
  
  if (prevBtn) {
    prevBtn.addEventListener('click', prevZoomImage);
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', nextZoomImage);
  }
  
  const zoomModal = document.getElementById('zoomModal');
  if (zoomModal) {
    zoomModal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('active');
      }
    });
  }
  
  // Main image click for zoom
  const mainImage = document.getElementById('productDetailMainImage');
  if (mainImage) {
    mainImage.addEventListener('click', openZoomModal);
  }
  
  // Rating and Review
  const ratingInput = document.getElementById('ratingInput');
  if (ratingInput) {
    ratingInput.querySelectorAll('.rating-star').forEach(star => {
      star.addEventListener('click', function() {
        const rating = parseInt(this.getAttribute('data-rating'));
        setRating(rating);
      });
    });
  }
  
  const submitReview = document.getElementById('submitReview');
  if (submitReview) {
    submitReview.addEventListener('click', submitProductReview);
  }
  
  // Banner touch handlers
  const bannerCarousel = document.getElementById('bannerCarousel');
  if (bannerCarousel) {
    bannerCarousel.addEventListener('touchstart', handleBannerTouchStart);
    bannerCarousel.addEventListener('touchmove', handleBannerTouchMove);
    bannerCarousel.addEventListener('touchend', handleBannerTouchEnd);
  }
  
  // Popstate Event Listener for Back/Forward Navigation
  window.addEventListener('popstate', function(event) {
    console.log("Popstate event, location:", window.location.href);
    
    // Check for product in URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    
    if (productId && productId !== currentProduct?.id) {
      loadProductFromId(productId);
    } else {
      const page = window.location.hash.replace('#', '') || 'homePage';
      if (document.getElementById(page)) {
        showPage(page);
      }
    }
  });
  
  // Payment summary updates
  if (qtyMinus) {
    qtyMinus.addEventListener('click', function() {
      decreaseQuantity();
      if (document.getElementById('paymentPage')?.classList.contains('active')) {
        updatePaymentSummary();
      }
    });
  }
  
  if (qtyPlus) {
    qtyPlus.addEventListener('click', function() {
      increaseQuantity();
      if (document.getElementById('paymentPage')?.classList.contains('active')) {
        updatePaymentSummary();
      }
    });
  }
  
  document.querySelectorAll('input[name="pay"]').forEach(radio => {
    radio.addEventListener('change', function() {
      if (document.getElementById('paymentPage')?.classList.contains('active')) {
        updatePaymentSummary();
      }
    });
  });
  
  // Save user info
  const saveUserInfoBtn = document.getElementById('saveUserInfo');
  if (saveUserInfoBtn) saveUserInfoBtn.addEventListener('click', saveUserInfoAndAddress);
  
  // Popular search tags
  document.querySelectorAll('.popular-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const searchText = this.textContent;
      const homeSearchInput = document.getElementById('homeSearchInput');
      const advancedSearchPanel = document.getElementById('advancedSearchPanel');
      
      if (homeSearchInput) homeSearchInput.value = searchText;
      handleHomeSearch();
      if (advancedSearchPanel) advancedSearchPanel.classList.remove('active');
    });
  });
  
  // Search tags in advanced panel
  document.querySelectorAll('.search-tag').forEach(tag => {
    tag.addEventListener('click', function() {
      const searchText = this.textContent;
      const homeSearchInput = document.getElementById('homeSearchInput');
      const advancedSearchPanel = document.getElementById('advancedSearchPanel');
      
      if (homeSearchInput) homeSearchInput.value = searchText;
      handleHomeSearch();
      if (advancedSearchPanel) advancedSearchPanel.classList.remove('active');
    });
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
  const activeIndex = banners.findIndex((_, index) => {
    const dot = document.querySelector(`.banner-dot:nth-child(${index + 1})`);
    return dot && dot.classList.contains('active');
  });
  
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

// Rating and Review Functions
function setRating(rating) {
  const ratingInput = document.getElementById('ratingInput');
  if (!ratingInput) return;
  
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
  
  if (!currentProduct || !realtimeDb) {
    showToast('No product selected', 'error');
    return;
  }
  
  const ratingInput = document.getElementById('ratingInput');
  const reviewText = document.getElementById('reviewText');
  
  if (!ratingInput || !reviewText) return;
  
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
    
    await realtimeDb.ref('reviews/' + reviewId).set(reviewData);
    
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
  if (!realtimeDb) return;
  
  try {
    const snapshot = await realtimeDb.ref('reviews').orderByChild('productId').equalTo(productId).once('value');
    const reviewsObj = snapshot.val();
    const reviewsList = document.getElementById('reviewsList');
    
    if (!reviewsList) return;
    
    if (!reviewsObj) {
      reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">No reviews yet. Be the first to review!</p>';
      return;
    }
    
    const reviews = Object.keys(reviewsObj).map(key => reviewsObj[key]);
    
    reviews.sort((a, b) => b.date - a.date);
    
    renderReviews(reviews);
  } catch (error) {
    console.error('Error loading reviews:', error);
    const reviewsList = document.getElementById('reviewsList');
    if (reviewsList) {
      reviewsList.innerHTML = '<p style="color:var(--muted);text-align:center">Error loading reviews</p>';
    }
  }
}

function renderReviews(reviews) {
  const reviewsList = document.getElementById('reviewsList');
  if (!reviewsList) return;
  
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
        `<button class="review-delete-btn" data-review-id="${review.id}">Delete</button>` : ''}
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

// Authentication Functions
async function handleLogin() {
  const loginEmail = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  
  if (!loginEmail || !loginPassword || !loginError || !loginBtn || !auth) return;
  
  const email = loginEmail.value;
  const password = loginPassword.value;
  
  loginError.textContent = '';
  
  if (!email || !password) {
    loginError.textContent = 'Please fill in all fields';
    return;
  }
  
  try {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<div class="loading-spinner"></div> Logging in...';
    
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    
    if (realtimeDb) {
      await realtimeDb.ref('users/' + userCredential.user.uid).update({
        lastLoginAt: Date.now()
      });
    }
    
    showToast('Login successful!', 'success');
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.remove('active');
    
    loginEmail.value = '';
    loginPassword.value = '';
  } catch (err) {
    console.error('Login error:', err);
    loginError.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

async function handleSignup() {
  const signupName = document.getElementById('signupName');
  const signupEmail = document.getElementById('signupEmail');
  const signupPassword = document.getElementById('signupPassword');
  const signupError = document.getElementById('signupError');
  const signupBtn = document.getElementById('signupBtn');
  
  if (!signupName || !signupEmail || !signupPassword || !signupError || !signupBtn || !auth) return;
  
  const name = signupName.value;
  const email = signupEmail.value;
  const password = signupPassword.value;
  
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
    
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    if (realtimeDb) {
      await realtimeDb.ref('users/' + user.uid).set({
        name: name,
        email: email,
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      });
    }
    
    localStorage.setItem('userName', name);
    updateUserNameUI(name);
    
    showToast('Account created successfully!', 'success');
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.remove('active');
    
    signupName.value = '';
    signupEmail.value = '';
    signupPassword.value = '';
  } catch (err) {
    console.error('Signup error:', err);
    signupError.textContent = err.message;
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
}

async function handleGoogleLogin() {
  if (!auth) return;
  
  const provider = new firebase.auth.GoogleAuthProvider();
  
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    if (realtimeDb) {
      const userSnapshot = await realtimeDb.ref('users/' + user.uid).once('value');
      
      if (!userSnapshot.exists()) {
        await realtimeDb.ref('users/' + user.uid).set({
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: Date.now(),
          lastLoginAt: Date.now()
        });
      } else {
        await realtimeDb.ref('users/' + user.uid).update({
          lastLoginAt: Date.now()
        });
      }
    }
    
    localStorage.setItem('userName', user.displayName || 'User');
    updateUserNameUI(user.displayName || 'User');
    
    showToast('Login successful!', 'success');
    const authModal = document.getElementById('authModal');
    if (authModal) authModal.classList.remove('active');
  } catch (err) {
    console.error('Google login error:', err);
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginError = document.getElementById('loginError');
    const signupError = document.getElementById('signupError');
    
    if (loginForm?.classList.contains('active') && loginError) {
      loginError.textContent = err.message;
    } else if (signupForm?.classList.contains('active') && signupError) {
      signupError.textContent = err.message;
    }
  }
}

// Place Order Function with proper calculations
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
  
  const paymentMethodRadio = document.querySelector('input[name="pay"]:checked');
  if (!paymentMethodRadio) {
    showToast('Please select a payment method', 'error');
    return;
  }
  
  const paymentMethod = paymentMethodRadio.value;
  const qtySelect = document.getElementById('qtySelect');
  const quantity = qtySelect ? parseInt(qtySelect.value) || 1 : 1;
  
  const selectedSize = document.querySelector('.size-option.selected');
  const size = selectedSize?.getAttribute('data-value') || 'Not specified';
  
  const selectedColor = document.querySelector('.color-option.selected');
  const color = selectedColor?.getAttribute('data-value') || 'Not specified';
  
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
    productName: currentProduct.title || currentProduct.name,
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
    if (realtimeDb) {
      await realtimeDb.ref('orders/' + orderId).set(orderData);
    }
    
    // Send order notification email
    sendOrderNotification(orderData);
    
    const orderIdDisplay = document.getElementById('orderIdDisplay');
    if (orderIdDisplay) orderIdDisplay.textContent = orderId;
    
    showPage('successPage');
    showToast('Order placed successfully!', 'success');
    
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

// Payment Calculation Function
function updatePaymentSummary() {
  if (!currentProduct) {
    const sumProduct = document.getElementById('sumProduct');
    const sumQty = document.getElementById('sumQty');
    const sumPrice = document.getElementById('sumPrice');
    const sumDel = document.getElementById('sumDel');
    const sumGateway = document.getElementById('sumGateway');
    const sumTotal = document.getElementById('sumTotal');
    
    if (sumProduct) sumProduct.textContent = '-';
    if (sumQty) sumQty.textContent = '-';
    if (sumPrice) sumPrice.textContent = '-';
    if (sumDel) sumDel.textContent = `₹${adminSettings.deliveryCharge || 50}`;
    if (sumGateway) sumGateway.textContent = '₹0';
    if (sumTotal) sumTotal.textContent = '-';
    return;
  }
  
  const qtySelect = document.getElementById('qtySelect');
  const quantity = qtySelect ? parseInt(qtySelect.value) || 1 : 1;
  
  const paymentMethodRadio = document.querySelector('input[name="pay"]:checked');
  const paymentMethod = paymentMethodRadio ? paymentMethodRadio.value : 'cod';
  
  const productPrice = parsePrice(currentProduct.price);
  const subtotal = productPrice * quantity;
  const deliveryCharge = adminSettings.deliveryCharge || 50;
  const gatewayChargePercent = adminSettings.gatewayChargePercent || 2;
  const gatewayCharge = paymentMethod === 'prepaid' ? subtotal * (gatewayChargePercent / 100) : 0;
  const total = subtotal + deliveryCharge + gatewayCharge;
  
  const sumProduct = document.getElementById('sumProduct');
  const sumQty = document.getElementById('sumQty');
  const sumPrice = document.getElementById('sumPrice');
  const sumDel = document.getElementById('sumDel');
  const sumGateway = document.getElementById('sumGateway');
  const sumTotal = document.getElementById('sumTotal');
  
  if (sumProduct) sumProduct.textContent = currentProduct.title || currentProduct.name;
  if (sumQty) sumQty.textContent = quantity;
  if (sumPrice) sumPrice.textContent = `₹${subtotal.toLocaleString()}`;
  if (sumDel) sumDel.textContent = `₹${deliveryCharge}`;
  if (sumGateway) sumGateway.textContent = `₹${gatewayCharge.toFixed(2)}`;
  if (sumTotal) sumTotal.textContent = `₹${total.toLocaleString()}`;
}

function showLoginModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) authModal.classList.add('active');
  switchAuthTab('login');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const loginError = document.getElementById('loginError');
  const signupError = document.getElementById('signupError');
  
  if (loginForm) loginForm.classList.remove('active');
  if (signupForm) signupForm.classList.remove('active');
  if (forgotPasswordForm) forgotPasswordForm.classList.remove('active');
  
  if (loginTab) loginTab.classList.remove('active');
  if (signupTab) signupTab.classList.remove('active');
  
  if (loginError) loginError.textContent = '';
  if (signupError) signupError.textContent = '';
  
  if (tab === 'login') {
    if (loginTab) loginTab.classList.add('active');
    if (loginForm) loginForm.classList.add('active');
  } else {
    if (signupTab) signupTab.classList.add('active');
    if (signupForm) signupForm.classList.add('active');
  }
}

function logout() {
  if (!auth) return;
  
  auth.signOut().then(() => {
    showToast('Logged out successfully', 'success');
    showPage('homePage');
  }).catch(error => {
    console.error('Logout error:', error);
    showToast('Error logging out', 'error');
  });
}

// Mobile menu functions
function openMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  
  if (mobileMenu) mobileMenu.classList.add('active');
  if (menuOverlay) menuOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  const menuOverlay = document.getElementById('menuOverlay');
  
  if (mobileMenu) mobileMenu.classList.remove('active');
  if (menuOverlay) menuOverlay.classList.remove('active');
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
  const userProfile = document.getElementById('userProfile');
  const openLoginTop = document.getElementById('openLoginTop');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileUserProfile = document.getElementById('mobileUserProfile');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  
  if (userProfile) userProfile.style.display = 'flex';
  if (openLoginTop) openLoginTop.style.display = 'none';
  if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
  if (mobileUserProfile) mobileUserProfile.style.display = 'flex';
  if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'flex';
  
  updateUserProfile(user);
  
  if (realtimeDb) {
    realtimeDb.ref('users/' + user.uid).once('value').then(snapshot => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const name = userData.name || user.displayName || 'User';
        localStorage.setItem('userName', name);
        updateUserNameUI(name);
        const mobileUserName = document.getElementById('mobileUserName');
        if (mobileUserName) mobileUserName.textContent = name;
      }
    });
  }
}

function updateUserProfile(user) {
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userAvatarInitial = document.getElementById('userAvatarInitial');
  const userName = document.getElementById('userName');
  const mobileUserName = document.getElementById('mobileUserName');
  
  if (user.photoURL && userAvatarImg) {
    userAvatarImg.src = user.photoURL;
    userAvatarImg.style.display = 'block';
    if (userAvatarInitial) userAvatarInitial.style.display = 'none';
  } else if (userAvatarImg && userAvatarInitial) {
    userAvatarImg.style.display = 'none';
    userAvatarInitial.style.display = 'block';
    userAvatarInitial.textContent = (user.displayName || 'U').charAt(0).toUpperCase();
  }
  
  const name = user.displayName || 'User';
  if (userName) userName.textContent = name;
  if (mobileUserName) mobileUserName.textContent = name;
}

function updateUIForGuest() {
  const userProfile = document.getElementById('userProfile');
  const openLoginTop = document.getElementById('openLoginTop');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileUserProfile = document.getElementById('mobileUserProfile');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
  
  if (userProfile) userProfile.style.display = 'none';
  if (openLoginTop) openLoginTop.style.display = 'block';
  if (mobileLoginBtn) mobileLoginBtn.style.display = 'flex';
  if (mobileUserProfile) mobileUserProfile.style.display = 'none';
  if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
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
        <div class="slider-item-title">${product.title || product.name || 'Product Name'}</div>
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
    categoryPill.setAttribute('data-category-id', category.id);
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
    circle.setAttribute('data-category-id', category.id);
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
      const activeIndex = banners.findIndex((_, index) => {
        const dot = document.querySelector(`.banner-dot:nth-child(${index + 1})`);
        return dot && dot.classList.contains('active');
      });
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

function loadSimilarProducts(product) {
  const similarProducts = products
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 10);
  
  renderProductSlider(similarProducts.length > 0 ? similarProducts : products.slice(0, 10), 'similarProductsSlider');
}

// Order Page Gallery Initialization
function initOrderPageGallery() {
  if (!currentProduct) return;
  
  const galleryMain = document.getElementById('galleryMain');
  const dotsContainer = document.getElementById('orderCarouselDots');
  
  if (!galleryMain || !dotsContainer) return;
  
  // Use currentProductImages or get from Firebase
  let productImages = [];
  
  if (currentProductImages && currentProductImages.length > 0) {
    productImages = currentProductImages;
  } else if (currentProduct.Images && typeof currentProduct.Images === 'object') {
    productImages = Object.values(currentProduct.Images);
  } else if (Array.isArray(currentProduct.images) && currentProduct.images.length > 0) {
    productImages = currentProduct.images;
  } else if (currentProduct.image) {
    productImages = [currentProduct.image];
  } else if (currentProduct.img) {
    productImages = [currentProduct.img];
  } else {
    productImages = ["https://via.placeholder.com/600x600/f3f4f6/64748b?text=Product+Image"];
  }
  
  // Apply the image
  if (productImages.length > 0) {
    galleryMain.style.backgroundImage = `url('${productImages[0]}')`;
    galleryMain.style.backgroundSize = 'cover';
    galleryMain.style.backgroundPosition = 'center';
    galleryMain.style.display = 'block';
  }
  
  // Set up dots
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
  
  // Reset current index
  currentImageIndex = 0;
}

function setOrderPageImage(index) {
  const galleryMain = document.getElementById('galleryMain');
  const dots = document.querySelectorAll('#orderCarouselDots .carousel-dot');
  const productImages = getProductImages();
  
  if (galleryMain && productImages[index]) {
    galleryMain.style.backgroundImage = `url('${productImages[index]}')`;
    galleryMain.style.backgroundSize = 'cover';
    galleryMain.style.backgroundPosition = 'center';
  }
  
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

// Order flow functions
function toUserInfo() {
  const selectedSize = document.querySelector('.size-option.selected');
  if (!selectedSize) {
    const sizeValidationError = document.getElementById('sizeValidationError');
    if (sizeValidationError) sizeValidationError.classList.add('show');
    return;
  }
  
  const qtySelect = document.getElementById('qtySelect');
  const quantity = qtySelect ? parseInt(qtySelect.value) || 1 : 1;
  const size = selectedSize.getAttribute('data-value');
  
  const selectedColor = document.querySelector('.color-option.selected');
  const color = selectedColor?.getAttribute('data-value') || 'Not specified';
  
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
  const fullname = document.getElementById('fullname');
  const mobile = document.getElementById('mobile');
  const pincode = document.getElementById('pincode');
  const city = document.getElementById('city');
  const state = document.getElementById('state');
  const house = document.getElementById('house');

  if (!fullname || !mobile || !pincode || !city || !state || !house) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  if (!fullname.value || !mobile.value || !pincode.value || !city.value || !state.value || !house.value) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  userInfo = { 
    fullName: fullname.value, 
    mobile: mobile.value, 
    pincode: pincode.value, 
    city: city.value, 
    state: state.value, 
    house: house.value 
  };

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
  const alertTitle = document.getElementById('alertTitle');
  const alertMessage = document.getElementById('alertMessage');
  const alertModal = document.getElementById('alertModal');
  
  if (alertTitle) alertTitle.textContent = 'Logout Confirmation';
  if (alertMessage) alertMessage.textContent = 'Are you sure you want to logout?';
  if (alertModal) alertModal.classList.add('active');
}

function confirmLogout() {
  logout();
  const alertModal = document.getElementById('alertModal');
  if (alertModal) alertModal.classList.remove('active');
}

// Reset Password
async function handleResetPassword() {
  const forgotPasswordEmail = document.getElementById('forgotPasswordEmail');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  
  if (!forgotPasswordEmail || !resetPasswordBtn || !auth) return;
  
  const email = forgotPasswordEmail.value;
  
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  
  try {
    resetPasswordBtn.disabled = true;
    resetPasswordBtn.innerHTML = '<div class="loading-spinner"></div> Sending...';
    
    await auth.sendPasswordResetEmail(email);
    showToast('Password reset email sent! Check your inbox.', 'success');
    
    forgotPasswordEmail.value = '';
    
    setTimeout(() => {
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.classList.remove('active');
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
  if (!currentUser || !realtimeDb) return null;
  
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
    await realtimeDb.ref('addresses/' + addressId).set(addressToSave);
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
  if (!currentUser || !realtimeDb) return;
  
  try {
    await realtimeDb.ref('addresses/' + addressId).remove();
    
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
  if (!currentUser || !realtimeDb) return;
  
  try {
    await realtimeDb.ref('addresses/' + addressId).update(addressData);
    
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

// Save user info and address
async function saveUserInfoAndAddress() {
  const fullname = document.getElementById('fullname');
  const mobile = document.getElementById('mobile');
  const pincode = document.getElementById('pincode');
  const city = document.getElementById('city');
  const state = document.getElementById('state');
  const house = document.getElementById('house');
  const addressType = document.getElementById('addressType');

  if (!fullname || !mobile || !pincode || !city || !state || !house || !addressType) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  if (!fullname.value || !mobile.value || !pincode.value || !city.value || !state.value || !house.value) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  userInfo = { 
    fullName: fullname.value, 
    mobile: mobile.value, 
    pincode: pincode.value, 
    city: city.value, 
    state: state.value, 
    house: house.value 
  };
  
  const addressData = {
    name: fullname.value,
    mobile: mobile.value,
    pincode: pincode.value,
    city: city.value,
    state: state.value,
    street: house.value,
    type: addressType.value
  };
  
  await saveAddress(addressData, true);
  loadSavedAddresses();
}

// Load saved addresses with edit/delete
async function loadSavedAddresses() {
  if (!currentUser) return;
  
  try {
    const cachedAddresses = cacheManager.get('addresses_' + currentUser.uid);
    if (cachedAddresses && cachedAddresses.length > 0) {
      savedAddresses = cachedAddresses;
      renderSavedAddresses();
    }
    
    if (realtimeDb) {
      const snapshot = await realtimeDb.ref('addresses').orderByChild('userId').equalTo(currentUser.uid).once('value');
      const addressesList = document.getElementById('savedAddressesList');
      const savedAddressesSection = document.getElementById('savedAddressesSection');
      
      if (!snapshot.exists()) {
        if (savedAddressesSection) savedAddressesSection.style.display = 'none';
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
        if (savedAddressesSection) savedAddressesSection.style.display = 'block';
        renderSavedAddresses();
      } else {
        if (savedAddressesSection) savedAddressesSection.style.display = 'none';
      }
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
  const fullname = document.getElementById('fullname');
  const mobile = document.getElementById('mobile');
  const pincode = document.getElementById('pincode');
  const city = document.getElementById('city');
  const state = document.getElementById('state');
  const house = document.getElementById('house');
  const addressType = document.getElementById('addressType');
  
  if (fullname) fullname.value = address.name;
  if (mobile) mobile.value = address.mobile;
  if (pincode) pincode.value = address.pincode;
  if (city) city.value = address.city;
  if (state) state.value = address.state;
  if (house) house.value = address.street;
  if (addressType) addressType.value = address.type || 'home';
}

function editAddress(address) {
  fillAddressForm(address);
  const savedAddressesSection = document.getElementById('savedAddressesSection');
  const newAddressForm = document.getElementById('newAddressForm');
  
  if (savedAddressesSection) savedAddressesSection.style.display = 'none';
  if (newAddressForm) newAddressForm.style.display = 'block';
  
  const saveBtn = document.getElementById('saveUserInfo');
  if (saveBtn) {
    saveBtn.textContent = 'Update Address';
    saveBtn.onclick = function() {
      updateAddress(address.id, {
        name: document.getElementById('fullname')?.value || '',
        mobile: document.getElementById('mobile')?.value || '',
        pincode: document.getElementById('pincode')?.value || '',
        city: document.getElementById('city')?.value || '',
        state: document.getElementById('state')?.value || '',
        street: document.getElementById('house')?.value || '',
        type: document.getElementById('addressType')?.value || 'home'
      });
    };
  }
}

function deleteAddressConfirmation(address) {
  const alertTitle = document.getElementById('alertTitle');
  const alertMessage = document.getElementById('alertMessage');
  const alertModal = document.getElementById('alertModal');
  const alertConfirmBtn = document.getElementById('alertConfirmBtn');
  
  if (alertTitle) alertTitle.textContent = 'Delete Address';
  if (alertMessage) alertMessage.textContent = `Are you sure you want to delete address for ${address.name}?`;
  if (alertModal) alertModal.classList.add('active');
  
  if (alertConfirmBtn) {
    alertConfirmBtn.onclick = function() {
      deleteAddress(address.id);
      if (alertModal) alertModal.classList.remove('active');
    };
  }
}

function showNewAddressForm() {
  const savedAddressesSection = document.getElementById('savedAddressesSection');
  const newAddressForm = document.getElementById('newAddressForm');
  
  if (savedAddressesSection) savedAddressesSection.style.display = 'none';
  if (newAddressForm) newAddressForm.style.display = 'block';
  
  const fullname = document.getElementById('fullname');
  const mobile = document.getElementById('mobile');
  const pincode = document.getElementById('pincode');
  const city = document.getElementById('city');
  const state = document.getElementById('state');
  const house = document.getElementById('house');
  const addressType = document.getElementById('addressType');
  
  if (fullname) fullname.value = '';
  if (mobile) mobile.value = '';
  if (pincode) pincode.value = '';
  if (city) city.value = '';
  if (state) state.value = '';
  if (house) house.value = '';
  if (addressType) addressType.value = 'home';
  
  const saveBtn = document.getElementById('saveUserInfo');
  if (saveBtn) {
    saveBtn.textContent = 'Save This Address';
    saveBtn.onclick = saveUserInfoAndAddress;
  }
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
  if (!currentUser || !realtimeDb) return;
  
  try {
    await realtimeDb.ref('recentlyViewed/' + currentUser.uid + '/' + productId).set(Date.now());
    loadRecentlyViewed(currentUser);
  } catch (error) {
    console.error('Error adding to recently viewed:', error);
  }
}

async function loadRecentlyViewed(user) {
  if (!realtimeDb) return;
  
  try {
    const snapshot = await realtimeDb.ref('recentlyViewed/' + user.uid).once('value');
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

// Sharing functions
function shareProduct(platform, product = null) {
  const shareProduct = product || currentProduct;
  if (!shareProduct) return;
  
  const shareUrl = window.location.origin + window.location.pathname.replace('index.html', '') + '?product=' + shareProduct.id;
  const shareText = `Check out ${shareProduct.title || shareProduct.name} on Buyzo Cart - ${shareProduct.price}`;
  
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
          title: shareProduct.title || shareProduct.name,
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
  if (!shareLink) return;
  
  shareLink.select();
  document.execCommand('copy');
  showToast('Link copied to clipboard', 'success');
}

// Image zoom functions (old)
function openImageZoom() {
  if (!currentProduct) return;
  
  const productImages = getProductImages();
  const imageUrl = productImages[currentImageIndex];
  const zoomImage = document.getElementById('zoomImage');
  const zoomModal = document.getElementById('zoomModal');
  
  if (zoomImage && zoomModal && imageUrl) {
    zoomImage.src = imageUrl;
    zoomModal.classList.add('active');
    resetZoom();
  }
}

function adjustZoom(delta) {
  currentZoomLevel += delta;
  currentZoomLevel = Math.max(0.5, Math.min(3, currentZoomLevel));
  const zoomImage = document.getElementById('zoomImage');
  if (zoomImage) zoomImage.style.transform = `scale(${currentZoomLevel})`;
}

function resetZoom() {
  currentZoomLevel = 1;
  const zoomImage = document.getElementById('zoomImage');
  if (zoomImage) zoomImage.style.transform = 'scale(1)';
}

// Newsletter subscription
function handleNewsletterSubscription() {
  const newsletterEmail = document.getElementById('newsletterEmail');
  if (!newsletterEmail) return;
  
  const email = newsletterEmail.value;
  
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  
  showToast('Thank you for subscribing!', 'success');
  newsletterEmail.value = '';
}

// Step pills update
function updateStepPills() {
  const currentPage = document.querySelector('.page.active');
  if (!currentPage) return;
  
  const currentPageId = currentPage.id;
  
  document.querySelectorAll('.step-pill').forEach(pill => {
    pill.classList.remove('disabled');
  });
  
  const pillOrder = document.getElementById('pill-order');
  const pillUser = document.getElementById('pill-user');
  const pillPay = document.getElementById('pill-pay');
  
  switch (currentPageId) {
    case 'homePage':
    case 'productsPage':
      if (pillOrder) pillOrder.classList.add('disabled');
      if (pillUser) pillUser.classList.add('disabled');
      if (pillPay) pillPay.classList.add('disabled');
      break;
    case 'orderPage':
      if (pillUser) pillUser.classList.add('disabled');
      if (pillPay) pillPay.classList.add('disabled');
      break;
    case 'userPage':
      if (pillPay) pillPay.classList.add('disabled');
      break;
  }
}

// Hero messages rotation
function setupHeroMessages() {
  const messages = document.querySelectorAll('#heroMessages span');
  if (messages.length === 0) return;
  
  let currentIndex = 0;
  
  setInterval(() => {
    messages.forEach(msg => msg.classList.remove('active'));
    currentIndex = (currentIndex + 1) % messages.length;
    messages[currentIndex].classList.add('active');
  }, 3000);
}

// Load user data
function loadUserData(user) {
  if (!realtimeDb) return;
  
  realtimeDb.ref('users/' + user.uid).once('value').then(snapshot => {
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
    
    const product = products.find(p => p.id === order.productId);
    const productImage = product ? getProductImage(product) : 'https://via.placeholder.com/100x100/f3f4f6/64748b?text=Product';
    
    orderCard.innerHTML = `
      <div class="order-header">
        <div>
          <div class="order-id">${order.orderId}</div>
          <div class="order-date">${new Date(order.orderDate).toLocaleDateString()}</div>
        </div>
        <div class="order-status status-${order.status}">${order.status}</div>
      </div>
      <div class="order-details">
        <div class="order-product-image" style="background-image: url('${productImage}')"></div>
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
  if (!currentUser || !realtimeDb) return;
  
  realtimeDb.ref('orders').orderByChild('userId').equalTo(currentUser.uid)
    .once('value')
    .then(snapshot => {
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
    })
    .catch(error => {
      console.error('Error loading orders:', error);
    });
}

// Quantity functions
function decreaseQuantity() {
  const qtyInput = document.getElementById('qtySelect');
  if (!qtyInput) return;
  
  let value = parseInt(qtyInput.value);
  if (value > 1) {
    qtyInput.value = value - 1;
  }
}

function increaseQuantity() {
  const qtyInput = document.getElementById('qtySelect');
  if (!qtyInput) return;
  
  let value = parseInt(qtyInput.value);
  if (value < 10) {
    qtyInput.value = value + 1;
  }
}

// Order from product detail
function orderProductFromDetail() {
  if (!currentProduct) return;
  
  currentProduct = currentProduct;
  
  const spTitle = document.getElementById('spTitle');
  const spPrice = document.getElementById('spPrice');
  const spDesc = document.getElementById('spDesc');
  const spFullDesc = document.getElementById('spFullDesc');
  
  if (spTitle) spTitle.textContent = currentProduct.title || currentProduct.name;
  if (spPrice) spPrice.textContent = currentProduct.price;
  if (spDesc) spDesc.textContent = currentProduct.desc || currentProduct.description || '';
  if (spFullDesc) spFullDesc.textContent = currentProduct.fulLDesc || currentProduct.fullDescription || currentProduct.desc || currentProduct.description || '';
  
  initOrderPageGallery();
  showPage('orderPage');
}