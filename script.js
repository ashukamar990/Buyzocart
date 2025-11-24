// Firebase Configuration and Initialization
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Global variables
let currentUser = null;
let currentProduct = null;
let userInfo = {};
let currentOrderId = null;
let products = [];
let categories = [];
let banners = [];
let wishlist = [];
let recentlyViewed = [];
let currentImageIndex = 0;
let currentZoomLevel = 1;
let currentCategoryFilter = null;
let pageHistory = ['homePage'];
let currentOrderDetails = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
  initApp();
  setupEventListeners();
  loadInitialData();
  setupHeroMessages();
  updateStepPills();
  setupBackButtonHandler();
  
  // Check authentication state
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      updateUIForUser(user);
      loadUserData(user);
      loadWishlist(user);
      loadRecentlyViewed(user);
      setupRealtimeListeners();
    } else {
      currentUser = null;
      updateUIForGuest();
    }
  });
});

function initApp() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedTheme === 'dark') {
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) darkModeToggle.checked = true;
  }
  
  showPage('homePage');
}

function setupBackButtonHandler() {
  window.addEventListener('popstate', function(event) {
    if (pageHistory.length > 1) {
      pageHistory.pop();
      const previousPage = pageHistory[pageHistory.length - 1];
      showPage(previousPage);
    } else {
      pageHistory.push('homePage');
      showPage('homePage');
    }
  });
}

function showPage(pageId) {
  if (pageHistory[pageHistory.length - 1] !== pageId) {
    pageHistory.push(pageId);
  }
  
  window.history.pushState({ pageId: pageId }, '', `#${pageId}`);
  
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  document.getElementById(pageId).classList.add('active');
  
  updateStepPills();
  window.scrollTo(0, 0);
  
  if (pageId === 'myOrdersPage' && currentUser) {
    showMyOrders();
  } else if (pageId === 'wishlistPage' && currentUser) {
    renderWishlist();
  } else if (pageId === 'accountPage' && currentUser) {
    loadAccountData();
  } else if (pageId === 'addressPage' && currentUser) {
    loadAddresses();
  } else if (pageId === 'productDetailPage' && currentProduct) {
    makeProductDetailButtonsSticky();
  }
}

function checkAuthAndShowPage(pageId) {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  showPage(pageId);
}

function setupEventListeners() {
  // Mobile menu
  document.getElementById('menuIcon')?.addEventListener('click', openMenu);
  document.getElementById('menuClose')?.addEventListener('click', closeMenu);
  document.getElementById('menuOverlay')?.addEventListener('click', closeMenu);
  
  // Theme toggle
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
  
  // Auth modal
  document.getElementById('authClose')?.addEventListener('click', () => document.getElementById('authModal').classList.remove('active'));
  document.getElementById('openLoginTop')?.addEventListener('click', showLoginModal);
  document.getElementById('mobileLoginBtn')?.addEventListener('click', showLoginModal);
  
  // Auth tabs
  document.getElementById('loginTab')?.addEventListener('click', () => switchAuthTab('login'));
  document.getElementById('signupTab')?.addEventListener('click', () => switchAuthTab('signup'));
  document.getElementById('switchToLogin')?.addEventListener('click', () => switchAuthTab('login'));
  
  // Auth forms
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('signupBtn')?.addEventListener('click', handleSignup);
  document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogleLogin);
  document.getElementById('googleSignupBtn')?.addEventListener('click', handleGoogleLogin);
  
  // Forgot password
  document.getElementById('forgotPasswordLink')?.addEventListener('click', () => {
    document.getElementById('loginForm').classList.remove('active');
    document.getElementById('forgotPasswordForm').classList.add('active');
  });
  document.getElementById('backToLogin')?.addEventListener('click', () => {
    document.getElementById('forgotPasswordForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
  });
  document.getElementById('resetPasswordBtn')?.addEventListener('click', handleResetPassword);
  
  // User profile
  document.getElementById('userProfile')?.addEventListener('click', () => showPage('accountPage'));
  
  // Logout buttons
  document.getElementById('accountLogoutBtn')?.addEventListener('click', logout);
  document.getElementById('mobileLogoutBtn')?.addEventListener('click', logout);
  
  // Navigation
  document.getElementById('openMyOrdersTop')?.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
  document.getElementById('openContactTop')?.addEventListener('click', () => showPage('contactPage'));
  
  // Image zoom
  document.getElementById('zoomClose')?.addEventListener('click', () => document.getElementById('zoomModal').classList.remove('active'));
  document.getElementById('zoomIn')?.addEventListener('click', () => adjustZoom(0.2));
  document.getElementById('zoomOut')?.addEventListener('click', () => adjustZoom(-0.2));
  document.getElementById('zoomReset')?.addEventListener('click', resetZoom);
  
  // Search functionality
  const searchInput = document.getElementById('searchInput');
  const homeSearchInput = document.getElementById('homeSearchInput');
  
  if (searchInput) searchInput.addEventListener('input', handleSearch);
  if (homeSearchInput) homeSearchInput.addEventListener('input', handleHomeSearch);
  
  // Order flow buttons
  document.getElementById('backToProducts')?.addEventListener('click', () => showPage('productsPage'));
  document.getElementById('toUserInfo')?.addEventListener('click', toUserInfo);
  document.getElementById('editOrder')?.addEventListener('click', () => showPage('orderPage'));
  document.getElementById('toPayment')?.addEventListener('click', toPayment);
  document.getElementById('payBack')?.addEventListener('click', () => showPage('userPage'));
  document.getElementById('confirmOrder')?.addEventListener('click', confirmOrder);
  document.getElementById('goHome')?.addEventListener('click', () => showPage('homePage'));
  document.getElementById('viewOrders')?.addEventListener('click', () => checkAuthAndShowPage('myOrdersPage'));
  document.getElementById('saveUserInfo')?.addEventListener('click', saveUserInfo);
  
  // Quantity controls
  document.querySelector('.qty-minus')?.addEventListener('click', decreaseQuantity);
  document.querySelector('.qty-plus')?.addEventListener('click', increaseQuantity);
  
  // Size selection
  document.querySelectorAll('.size-option').forEach(option => {
    option.addEventListener('click', function() {
      document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');
      const errorElement = document.getElementById('sizeValidationError');
      if (errorElement) errorElement.classList.remove('show');
    });
  });
  
  // Price filter
  document.getElementById('applyPriceFilter')?.addEventListener('click', applyPriceFilter);
  document.getElementById('resetPriceFilter')?.addEventListener('click', resetPriceFilter);
  
  // Newsletter
  document.getElementById('subscribeBtn')?.addEventListener('click', handleNewsletterSubscription);
  
  // Share buttons
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const platform = this.getAttribute('data-platform');
      shareProduct(platform);
    });
  });
  
  // Copy share link
  document.getElementById('copyShareLink')?.addEventListener('click', copyShareLink);
  
  // Product detail buttons
  document.getElementById('detailOrderBtn')?.addEventListener('click', orderProductFromDetail);
  document.getElementById('detailWishlistBtn')?.addEventListener('click', toggleWishlistFromDetail);
  
  // Account page
  document.getElementById('saveProfile')?.addEventListener('click', saveProfile);
  document.getElementById('changePasswordBtn')?.addEventListener('click', changePassword);
  document.getElementById('deleteAccountBtn')?.addEventListener('click', deleteAccount);
  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
  
  // Address page
  document.getElementById('addNewAddress')?.addEventListener('click', showNewAddressForm);
  document.getElementById('cancelAddAddress')?.addEventListener('click', hideNewAddressForm);
  document.getElementById('saveAddress')?.addEventListener('click', saveAddress);
  
  // Dark mode toggle in settings
  document.getElementById('darkModeToggle')?.addEventListener('change', function() {
    toggleTheme();
  });

  // Product detail image click to open zoom
  document.getElementById('productDetailMainImage')?.addEventListener('click', openImageZoom);
  
  // Product detail carousel controls
  document.querySelector('.detail-carousel-control.prev')?.addEventListener('click', prevDetailImage);
  document.querySelector('.detail-carousel-control.next')?.addEventListener('click', nextDetailImage);

  // Write review button
  document.getElementById('writeReviewBtn')?.addEventListener('click', showReviewModal);
}

// Enhanced Authentication Functions
async function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const loginError = document.getElementById('loginError');
  
  loginError.textContent = '';
  
  if (!email || !password) {
    loginError.textContent = 'Please fill in all fields';
    return;
  }
  
  try {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<div class="loading-spinner"></div> Logging in...';
    
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    
    await db.ref('users/' + userCredential.user.uid).update({
      lastLoginAt: Date.now()
    });
    
    showToast('Login successful!', 'success');
    document.getElementById('authModal').classList.remove('active');
    
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
  } catch (err) {
    console.error('Login error:', err);
    document.getElementById('loginError').textContent = err.message;
  } finally {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

async function handleSignup() {
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const signupError = document.getElementById('signupError');
  
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
    const signupBtn = document.getElementById('signupBtn');
    signupBtn.disabled = true;
    signupBtn.innerHTML = '<div class="loading-spinner"></div> Creating account...';
    
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    await db.ref('users/' + user.uid).set({
      name: name,
      email: email,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    });
    
    showToast('Account created successfully!', 'success');
    document.getElementById('authModal').classList.remove('active');
    
    document.getElementById('signupName').value = '';
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
  } catch (err) {
    console.error('Signup error:', err);
    document.getElementById('signupError').textContent = err.message;
  } finally {
    const signupBtn = document.getElementById('signupBtn');
    signupBtn.disabled = false;
    signupBtn.textContent = 'Sign Up';
  }
}

async function handleGoogleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    const userSnapshot = await db.ref('users/' + user.uid).once('value');
    
    if (!userSnapshot.exists()) {
      await db.ref('users/' + user.uid).set({
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      });
    } else {
      await db.ref('users/' + user.uid).update({
        lastLoginAt: Date.now()
      });
    }
    
    showToast('Login successful!', 'success');
    document.getElementById('authModal').classList.remove('active');
  } catch (err) {
    console.error('Google login error:', err);
    if (document.getElementById('loginForm').classList.contains('active')) {
      document.getElementById('loginError').textContent = err.message;
    } else {
      document.getElementById('signupError').textContent = err.message;
    }
  }
}

async function handleResetPassword() {
  const email = document.getElementById('forgotPasswordEmail').value;
  
  if (!email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  
  try {
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    resetPasswordBtn.disabled = true;
    resetPasswordBtn.innerHTML = '<div class="loading-spinner"></div> Sending...';
    
    await auth.sendPasswordResetEmail(email);
    showToast('Password reset email sent!', 'success');
    document.getElementById('forgotPasswordForm').classList.remove('active');
    document.getElementById('loginForm').classList.add('active');
    
    document.getElementById('forgotPasswordEmail').value = '';
  } catch (err) {
    console.error('Password reset error:', err);
    showToast(err.message, 'error');
  } finally {
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    resetPasswordBtn.disabled = false;
    resetPasswordBtn.textContent = 'Reset Password';
  }
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

function logout() {
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
  
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.checked = newTheme === 'dark';
  }
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
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
  
  updateUserProfile(user);
  
  db.ref('users/' + user.uid).once('value').then(snapshot => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      document.getElementById('userName').textContent = userData.name || user.displayName || 'User';
      document.getElementById('mobileUserName').textContent = userData.name || user.displayName || 'User';
      
      if (document.getElementById('accountPageName')) {
        document.getElementById('accountPageName').textContent = userData.name || user.displayName || 'User';
        document.getElementById('accountPageEmail').textContent = user.email;
        document.getElementById('profileName').value = userData.name || user.displayName || '';
        document.getElementById('profileEmail').value = user.email;
        document.getElementById('profilePhone').value = userData.phone || '';
        
        if (userData.lastLoginAt) {
          const lastLoginTime = new Date(userData.lastLoginAt).toLocaleString();
          document.getElementById('lastLoginTime').textContent = lastLoginTime;
        }
      }
    }
  });
}

function updateUserProfile(user) {
  const userAvatarImg = document.getElementById('userAvatarImg');
  const userAvatarInitial = document.getElementById('userAvatarInitial');
  
  if (user.photoURL) {
    userAvatarImg.src = user.photoURL;
    userAvatarImg.style.display = 'block';
    userAvatarInitial.style.display = 'none';
  } else {
    userAvatarImg.style.display = 'none';
    userAvatarInitial.style.display = 'block';
    userAvatarInitial.textContent = (user.displayName || 'U').charAt(0).toUpperCase();
  }
  
  document.getElementById('userName').textContent = user.displayName || 'User';
  document.getElementById('mobileUserName').textContent = user.displayName || 'User';
  
  if (document.getElementById('accountPageAvatarImg')) {
    const accountPageAvatarImg = document.getElementById('accountPageAvatarImg');
    const accountPageAvatarInitial = document.getElementById('accountPageAvatarInitial');
    
    if (user.photoURL) {
      accountPageAvatarImg.src = user.photoURL;
      accountPageAvatarImg.style.display = 'block';
      accountPageAvatarInitial.style.display = 'none';
    } else {
      accountPageAvatarImg.style.display = 'none';
      accountPageAvatarInitial.style.display = 'block';
      accountPageAvatarInitial.textContent = (user.displayName || 'U').charAt(0).toUpperCase();
    }
    
    document.getElementById('accountPageName').textContent = user.displayName || 'User';
    document.getElementById('accountPageEmail').textContent = user.email;
  }
}

function updateUIForGuest() {
  document.getElementById('userProfile').style.display = 'none';
  document.getElementById('openLoginTop').style.display = 'block';
  document.getElementById('mobileLoginBtn').style.display = 'flex';
  document.getElementById('mobileUserProfile').style.display = 'none';
  document.getElementById('mobileLogoutBtn').style.display = 'none';
}

// Data loading functions
function loadInitialData() {
  const cachedProducts = loadFromLocalStorage('products');
  const cachedCategories = loadFromLocalStorage('categories');
  const cachedBanners = loadFromLocalStorage('banners');
  
  if (cachedProducts) {
    products = cachedProducts;
    renderProducts(products, 'homeProductGrid');
    renderProducts(products, 'productGrid');
    renderProductSlider(products.slice(0, 10), 'productSlider');
  }
  
  if (cachedCategories) {
    categories = cachedCategories;
    renderCategories();
    renderCategoryCircles();
  }
  
  if (cachedBanners) {
    banners = cachedBanners;
    renderBannerCarousel();
  }
  
  loadProducts();
  loadCategories();
  loadBanners();
}

async function loadProducts() {
  try {
    const snapshot = await db.ref('products').once('value');
    const productsObj = snapshot.val();
    if (productsObj) {
      const newProducts = Object.keys(productsObj).map(key => ({
        id: key,
        ...productsObj[key]
      }));
      
      products = newProducts;
      saveToLocalStorage('products', products);
      
      renderProducts(products, 'homeProductGrid');
      renderProducts(products, 'productGrid');
      renderProductSlider(products.slice(0, 10), 'productSlider');
    }
  } catch (error) {
    console.error('Error loading products:', error);
    loadSampleProducts();
  }
}

async function loadCategories() {
  try {
    const snapshot = await db.ref('categories').once('value');
    const categoriesObj = snapshot.val();
    if (categoriesObj) {
      const newCategories = Object.keys(categoriesObj).map(key => ({
        id: key,
        ...categoriesObj[key]
      }));
      
      categories = newCategories;
      saveToLocalStorage('categories', categories);
      
      renderCategories();
      renderCategoryCircles();
    }
  } catch (error) {
    console.error('Error loading categories:', error);
    loadSampleCategories();
  }
}

async function loadBanners() {
  try {
    const snapshot = await db.ref('banners').once('value');
    const bannersObj = snapshot.val();
    if (bannersObj) {
      const newBanners = Object.keys(bannersObj).map(key => ({
        id: key,
        ...bannersObj[key]
      }));
      
      banners = newBanners;
      saveToLocalStorage('banners', banners);
      
      renderBannerCarousel();
    }
  } catch (error) {
    console.error('Error loading banners:', error);
    loadSampleBanners();
  }
}

function loadUserData(user) {
  db.ref('users/' + user.uid).once('value').then(snapshot => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      userInfo = { ...userInfo, ...userData };
      
      if (userData.lastLoginAt && document.getElementById('lastLoginTime')) {
        const lastLoginTime = new Date(userData.lastLoginAt).toLocaleString();
        document.getElementById('lastLoginTime').textContent = lastLoginTime;
      }
    }
  }).catch(error => {
    console.error('Error loading user data:', error);
  });
}

async function loadWishlist(user) {
  try {
    const snapshot = await db.ref('wishlist/' + user.uid).once('value');
    const wishlistObj = snapshot.val();
    if (wishlistObj) {
      wishlist = Object.keys(wishlistObj);
    } else {
      wishlist = [];
    }
    
    updateWishlistButtons();
    
    if (document.getElementById('wishlistPage').classList.contains('active')) {
      renderWishlist();
    }
  } catch (error) {
    console.error('Error loading wishlist:', error);
  }
}

async function loadRecentlyViewed(user) {
  try {
    const snapshot = await db.ref('recentlyViewed/' + user.uid).once('value');
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

// Product rendering functions
function renderProducts(productsToRender, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  productsToRender.forEach(product => {
    const productCard = createProductCard(product);
    container.appendChild(productCard);
  });
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <div class="product-card-image" style="background-image: url('${getProductImage(product)}')">
      ${product.badge ? `<div class="product-card-badge">${product.badge}</div>` : ''}
      ${product.professional ? `<div class="professional-badge">PRO</div>` : ''}
    </div>
    <div class="product-card-body">
      <div class="product-card-title">${product.name}</div>
      <div class="product-card-rating">
        <div class="product-card-stars">★★★★★</div>
        <div class="product-card-review-count">(${product.reviews || '0'})</div>
      </div>
      <div class="product-card-price">
        <div class="product-card-current-price">${formatPrice(product.price)}</div>
        ${product.originalPrice ? `<div class="product-card-original-price">${formatPrice(product.originalPrice)}</div>` : ''}
      </div>
      <div class="product-card-actions">
        <button class="action-btn wishlist-btn ${isInWishlist(product.id) ? 'active' : ''}" data-product-id="${product.id}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isInWishlist(product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

function isInWishlist(productId) {
  if (currentUser) {
    return wishlist.includes(productId);
  } else {
    const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
    return guestWishlist.includes(productId);
  }
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
        <div class="slider-item-title">${product.name}</div>
        <div class="slider-item-price">${formatPrice(product.price)}</div>
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
    categoryPill.textContent = category.name;
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
      <div class="category-circle-name">${category.name}</div>
    `;
    
    circle.addEventListener('click', () => filterByCategory(category.id));
    container.appendChild(circle);
  });
}

// Enhanced Banner Carousel with Touch Support
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
    track.appendChild(slide);
    
    const dot = document.createElement('div');
    dot.className = `banner-dot ${index === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => setBannerSlide(index));
    controls.appendChild(dot);
  });
  
  // Add touch events for mobile swiping
  let touchStartX = 0;
  let touchEndX = 0;
  
  track.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  track.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleBannerSwipe();
  });
  
  function handleBannerSwipe() {
    const activeIndex = banners.findIndex((_, index) => 
      document.querySelector(`.banner-dot:nth-child(${index + 1})`).classList.contains('active')
    );
    
    if (touchEndX < touchStartX - 50) {
      const nextIndex = (activeIndex + 1) % banners.length;
      setBannerSlide(nextIndex);
    } else if (touchEndX > touchStartX + 50) {
      const prevIndex = (activeIndex - 1 + banners.length) % banners.length;
      setBannerSlide(prevIndex);
    }
  }
  
  // Auto-rotate banners
  setInterval(() => {
    const activeIndex = banners.findIndex((_, index) => 
      document.querySelector(`.banner-dot:nth-child(${index + 1})`).classList.contains('active')
    );
    const nextIndex = (activeIndex + 1) % banners.length;
    setBannerSlide(nextIndex);
  }, 5000);
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

// Enhanced Product Detail with Image Slider
function showProductDetail(product) {
  currentProduct = product;
  
  document.getElementById('detailTitle').textContent = product.name;
  document.getElementById('detailPrice').textContent = formatPrice(product.price);
  document.getElementById('detailDesc').textContent = product.description || '';
  document.getElementById('detailFullDesc').textContent = product.fullDescription || product.description || 'No description available.';
  document.getElementById('detailSku').textContent = `SKU: ${product.sku || 'N/A'}`;
  document.getElementById('breadcrumbProductName').textContent = product.name;
  
  const stockStatus = document.getElementById('detailStockStatus');
  if (product.stock === 'in') {
    stockStatus.textContent = 'In Stock';
    stockStatus.className = 'stock-status in-stock';
  } else if (product.stock === 'low') {
    stockStatus.textContent = 'Low Stock';
    stockStatus.className = 'stock-status low-stock';
  } else {
    stockStatus.textContent = 'Out of Stock';
    stockStatus.className = 'stock-status out-of-stock';
  }
  
  initEnhancedProductGallery(product);
  
  document.getElementById('productShareLink').value = window.location.origin + window.location.pathname + '?product=' + product.id;
  
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

function initEnhancedProductGallery(product) {
  const mainImage = document.getElementById('productDetailMainImage');
  const thumbnails = document.getElementById('productDetailThumbnails');
  const dots = document.getElementById('detailCarouselDots');
  
  if (!mainImage || !thumbnails || !dots) return;
  
  thumbnails.innerHTML = '';
  dots.innerHTML = '';
  
  const productImages = getProductImagesArray(product);
  
  currentImageIndex = 0;
  updateMainImage();
  
  productImages.forEach((image, index) => {
    const thumb = document.createElement('div');
    thumb.className = `product-detail-thumbnail ${index === 0 ? 'active' : ''}`;
    thumb.style.backgroundImage = `url('${image}')`;
    thumb.addEventListener('click', () => {
      currentImageIndex = index;
      updateMainImage();
      updateThumbnails();
      updateDots();
    });
    thumbnails.appendChild(thumb);
    
    const dot = document.createElement('div');
    dot.className = `detail-carousel-dot ${index === 0 ? 'active' : ''}`;
    dot.addEventListener('click', () => {
      currentImageIndex = index;
      updateMainImage();
      updateThumbnails();
      updateDots();
    });
    dots.appendChild(dot);
  });
  
  // Add touch events for mobile swiping
  let touchStartX = 0;
  let touchEndX = 0;
  
  mainImage.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  mainImage.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  function handleSwipe() {
    if (touchEndX < touchStartX - 50) {
      nextDetailImage();
    } else if (touchEndX > touchStartX + 50) {
      prevDetailImage();
    }
  }
  
  function updateMainImage() {
    mainImage.style.backgroundImage = `url('${productImages[currentImageIndex]}')`;
  }
  
  function updateThumbnails() {
    document.querySelectorAll('.product-detail-thumbnail').forEach((thumb, index) => {
      thumb.classList.toggle('active', index === currentImageIndex);
    });
  }
  
  function updateDots() {
    document.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === currentImageIndex);
    });
  }
  
  mainImage.addEventListener('click', openImageZoom);
}

function prevDetailImage() {
  const productImages = getProductImagesArray(currentProduct);
  if (productImages.length <= 1) return;
  
  currentImageIndex = (currentImageIndex - 1 + productImages.length) % productImages.length;
  updateProductDetailImage();
}

function nextDetailImage() {
  const productImages = getProductImagesArray(currentProduct);
  if (productImages.length <= 1) return;
  
  currentImageIndex = (currentImageIndex + 1) % productImages.length;
  updateProductDetailImage();
}

function updateProductDetailImage() {
  const productImages = getProductImagesArray(currentProduct);
  const mainImage = document.getElementById('productDetailMainImage');
  
  if (mainImage && productImages[currentImageIndex]) {
    mainImage.style.backgroundImage = `url('${productImages[currentImageIndex]}')`;
    
    document.querySelectorAll('.product-detail-thumbnail').forEach((thumb, index) => {
      thumb.classList.toggle('active', index === currentImageIndex);
    });
    
    document.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === currentImageIndex);
    });
  }
}

function loadSimilarProducts(product) {
  const similarProducts = products
    .filter(p => p.id !== product.id)
    .slice(0, 10);
  
  renderProductSlider(similarProducts, 'similarProductsSlider');
}

// Enhanced Order Flow with Address Saving
function toUserInfo() {
  const selectedSize = document.querySelector('.size-option.selected');
  if (!selectedSize) {
    document.getElementById('sizeValidationError').classList.add('show');
    return;
  }
  
  showPage('userPage');
}

function saveUserInfo() {
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
  
  userInfo = {
    fullName: fullname,
    mobile: mobile,
    pincode: pincode,
    city: city,
    state: state,
    house: house
  };
  
  if (currentUser) {
    const addressId = 'address_' + Date.now();
    db.ref('addresses/' + currentUser.uid + '/' + addressId).set({
      name: fullname,
      mobile: mobile,
      pincode: pincode,
      city: city,
      state: state,
      street: house,
      type: 'home',
      isDefault: false,
      createdAt: Date.now()
    }).then(() => {
      showToast('Address saved to your address book', 'success');
    }).catch(error => {
      console.error('Error saving address:', error);
    });
  }
  
  showToast('Information saved successfully', 'success');
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
  
  if (!/^\d{10}$/.test(mobile)) {
    showToast('Please enter a valid 10-digit mobile number', 'error');
    return;
  }
  
  if (!/^\d{6}$/.test(pincode)) {
    showToast('Please enter a valid 6-digit pincode', 'error');
    return;
  }
  
  userInfo = {
    fullName: fullname,
    mobile: mobile,
    pincode: pincode,
    city: city,
    state: state,
    house: house
  };
  
  const quantity = parseInt(document.getElementById('qtySelect').value);
  const productPrice = parseFloat(currentProduct.price.replace('₹', '').replace(',', ''));
  const subtotal = productPrice * quantity;
  const deliveryCharge = 50;
  let paymentCharge = 0;
  
  const paymentMethod = document.querySelector('input[name="pay"]:checked').value;
  if (paymentMethod === 'prepaid') {
    paymentCharge = Math.round(subtotal * 0.02);
  }
  
  const total = subtotal + deliveryCharge + paymentCharge;
  
  document.getElementById('sumProduct').textContent = currentProduct.name;
  document.getElementById('sumQty').textContent = quantity;
  document.getElementById('sumPrice').textContent = `₹${subtotal}`;
  document.getElementById('sumDel').textContent = `₹${deliveryCharge}`;
  
  if (paymentCharge > 0) {
    document.getElementById('sumTotal').innerHTML = `
      <div>Subtotal: ₹${subtotal}</div>
      <div>Delivery: ₹${deliveryCharge}</div>
      <div>Payment Gateway Charges: ₹${paymentCharge}</div>
      <div style="font-weight:700; margin-top:8px">Total: ₹${total}</div>
    `;
  } else {
    document.getElementById('sumTotal').textContent = `₹${total}`;
  }
  
  showPage('paymentPage');
}

// Enhanced Order Placement with Tracking
async function confirmOrder() {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  
  const orderId = generateOrderId();
  currentOrderId = orderId;
  
  const paymentMethod = document.querySelector('input[name="pay"]:checked').value;
  const quantity = parseInt(document.getElementById('qtySelect').value);
  const size = document.querySelector('.size-option.selected')?.getAttribute('data-value') || 'Not specified';
  
  const productPrice = parseFloat(currentProduct.price.replace('₹', '').replace(',', ''));
  const subtotal = productPrice * quantity;
  const deliveryCharge = 50;
  let paymentCharge = 0;
  
  if (paymentMethod === 'prepaid') {
    paymentCharge = Math.round(subtotal * 0.02);
  }
  
  const total = subtotal + deliveryCharge + paymentCharge;
  
  const orderData = {
    orderId: orderId,
    userId: currentUser.uid,
    username: userInfo.fullName || 'Customer',
    productId: currentProduct.id,
    productName: currentProduct.name,
    productImage: getProductImage(currentProduct),
    price: total,
    quantity: quantity,
    size: size,
    paymentMethod: paymentMethod,
    status: 'confirmed',
    orderDate: Date.now(),
    userInfo: userInfo,
    tracking: {
      confirmed: Date.now(),
      shipped: null,
      outForDelivery: null,
      delivered: null
    },
    refundEligible: true,
    refundRequested: false
  };
  
  try {
    await db.ref('orders/' + orderId).set(orderData);
    
    document.getElementById('orderIdDisplay').textContent = orderId;
    showPage('successPage');
    sendOrderConfirmationEmail(orderData);
    
    userInfo = {};
    
  } catch (error) {
    console.error('Error placing order:', error);
    showToast('Failed to place order. Please try again.', 'error');
  }
}

// Enhanced Order Tracking and Management
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
    const deliveryDate = new Date(order.orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 5 + Math.floor(Math.random() * 3));
    
    let statusText = order.status;
    let statusClass = `status-${order.status}`;
    
    if (order.status === 'confirmed') {
      statusText = 'Confirmed';
    } else if (order.status === 'shipped') {
      statusText = 'Shipped';
    } else if (order.status === 'delivered') {
      statusText = 'Delivered';
    } else if (order.status === 'cancelled') {
      statusText = 'Cancelled';
    }
    
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';
    orderCard.innerHTML = `
      <div class="order-header">
        <div>
          <div class="order-id">${order.orderId}</div>
          <div class="order-date">Ordered on ${new Date(order.orderDate).toLocaleDateString()}</div>
          <div class="order-estimated">Estimated delivery: ${deliveryDate.toLocaleDateString()}</div>
        </div>
        <div class="order-status ${statusClass}">${statusText}</div>
      </div>
      <div class="order-details">
        <div class="order-product-image" style="background-image: url('${order.productImage}')"></div>
        <div class="order-product-info">
          <div class="order-product-title">${order.productName}</div>
          <div class="order-product-price">₹${order.price}</div>
          <div class="order-product-meta">Qty: ${order.quantity} | Size: ${order.size}</div>
        </div>
      </div>
      <div class="order-actions">
        ${order.status === 'delivered' && order.refundEligible ? 
          `<button class="btn secondary request-refund-btn" data-order-id="${order.orderId}">Request Refund</button>` : ''}
        <button class="btn secondary view-order-detail" data-order-id="${order.orderId}">View Details</button>
        ${order.status === 'confirmed' ? 
          `<button class="btn error cancel-order-btn" data-order-id="${order.orderId}">Cancel Order</button>` : ''}
      </div>
    `;
    
    container.appendChild(orderCard);
  });
  
  document.querySelectorAll('.view-order-detail').forEach(btn => {
    btn.addEventListener('click', function() {
      const orderId = this.getAttribute('data-order-id');
      showOrderDetail(orderId);
    });
  });
  
  document.querySelectorAll('.cancel-order-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const orderId = this.getAttribute('data-order-id');
      showCancelOrderModal(orderId);
    });
  });
  
  document.querySelectorAll('.request-refund-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const orderId = this.getAttribute('data-order-id');
      showRefundRequestModal(orderId);
    });
  });
}

function showOrderDetail(orderId) {
  db.ref('orders/' + orderId).once('value').then(snapshot => {
    const order = snapshot.val();
    if (!order) return;
    
    currentOrderDetails = order;
    const container = document.getElementById('orderDetailContent');
    
    const deliveryDate = new Date(order.orderDate);
    deliveryDate.setDate(deliveryDate.getDate() + 5 + Math.floor(Math.random() * 3));
    
    let trackingSteps = '';
    const steps = [
      { key: 'confirmed', label: 'Order Confirmed', time: order.tracking.confirmed },
      { key: 'shipped', label: 'Shipped', time: order.tracking.shipped },
      { key: 'outForDelivery', label: 'Out for Delivery', time: order.tracking.outForDelivery },
      { key: 'delivered', label: 'Delivered', time: order.tracking.delivered }
    ];
    
    steps.forEach((step, index) => {
      const isActive = order.tracking[step.key] !== null;
      const isCompleted = index < steps.findIndex(s => order.tracking[s.key] === null) || 
                         (index === steps.length - 1 && order.tracking.delivered);
      
      trackingSteps += `
        <div class="tracking-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
          <div class="tracking-dot"></div>
          <div class="tracking-label">${step.label}</div>
          <div class="tracking-time">${step.time ? new Date(step.time).toLocaleDateString() : 'Pending'}</div>
        </div>
      `;
    });
    
    container.innerHTML = `
      <div class="order-detail-section">
        <div class="order-detail-label">Order ID</div>
        <div class="order-detail-value">${order.orderId}</div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Order Status</div>
        <div class="order-detail-value">
          <span class="order-status status-${order.status}">${order.status}</span>
        </div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Order Date</div>
        <div class="order-detail-value">${new Date(order.orderDate).toLocaleDateString()}</div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Estimated Delivery</div>
        <div class="order-detail-value">${deliveryDate.toLocaleDateString()}</div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Tracking</div>
        <div class="tracking-container">
          ${trackingSteps}
        </div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Product Details</div>
        <div class="order-detail-product">
          <div class="order-detail-image" style="background-image: url('${order.productImage}')"></div>
          <div class="order-detail-product-info">
            <div class="order-detail-value" style="font-weight:600">${order.productName}</div>
            <div class="order-detail-value">Quantity: ${order.quantity}</div>
            <div class="order-detail-value">Size: ${order.size}</div>
            <div class="order-detail-value" style="color:var(--accent);font-weight:700">₹${order.price}</div>
          </div>
        </div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Delivery Address</div>
        <div class="order-detail-value">
          <div>${order.userInfo.fullName}</div>
          <div>${order.userInfo.house}</div>
          <div>${order.userInfo.city}, ${order.userInfo.state} - ${order.userInfo.pincode}</div>
          <div>Mobile: ${order.userInfo.mobile}</div>
        </div>
      </div>
      
      <div class="order-detail-section">
        <div class="order-detail-label">Payment Method</div>
        <div class="order-detail-value">${order.paymentMethod === 'prepaid' ? 'Prepaid (UPI/Card)' : 'Cash on Delivery'}</div>
      </div>
      
      ${order.status === 'delivered' && order.refundEligible ? `
        <div class="refund-section">
          <div class="refund-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            Refund Available
          </div>
          <div class="refund-note">You can request a refund within 5 days of delivery</div>
          <div class="refund-time-left">Time left: ${Math.ceil((order.tracking.delivered + (5 * 24 * 60 * 60 * 1000) - Date.now()) / (24 * 60 * 60 * 1000))} days</div>
          <button class="btn error" id="requestRefundBtn">Request Refund</button>
        </div>
      ` : ''}
    `;
    
    if (order.status === 'delivered' && order.refundEligible) {
      document.getElementById('requestRefundBtn').addEventListener('click', () => {
        showRefundRequestModal(order.orderId);
      });
    }
    
    showPage('orderDetailPage');
  });
}

function showRefundRequestModal(orderId) {
  db.ref('orders/' + orderId).once('value').then(snapshot => {
    const order = snapshot.val();
    
    if (!order) {
      showToast('Order not found', 'error');
      return;
    }
    
    const deliveryTime = order.tracking.delivered;
    const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
    const currentTime = Date.now();
    
    if (currentTime - deliveryTime > fiveDaysInMs) {
      showToast('Refund period has expired (5 days from delivery)', 'error');
      return;
    }
    
    const modal = document.getElementById('alertModal');
    const title = document.getElementById('alertTitle');
    const message = document.getElementById('alertMessage');
    
    title.textContent = 'Request Refund';
    message.innerHTML = `
      <p>Are you sure you want to request a refund for order <strong>${orderId}</strong>?</p>
      <p><strong>Refund Amount: ₹${order.price}</strong></p>
      <p>Refund will be processed within 5-7 business days.</p>
    `;
    
    modal.classList.add('active');
    
    document.getElementById('alertConfirmBtn').onclick = function() {
      processRefundRequest(orderId);
      modal.classList.remove('active');
    };
    
    document.getElementById('alertCancelBtn').onclick = function() {
      modal.classList.remove('active');
    };
  });
}

function processRefundRequest(orderId) {
  db.ref('orders/' + orderId).update({
    refundRequested: true,
    refundRequestedAt: Date.now()
  }).then(() => {
    showToast('Refund request submitted successfully', 'success');
    
    setTimeout(() => {
      db.ref('orders/' + orderId).update({
        refundEligible: false
      });
    }, 5 * 24 * 60 * 60 * 1000);
    
  }).catch(error => {
    console.error('Error processing refund:', error);
    showToast('Failed to process refund request', 'error');
  });
}

// Enhanced Review System
function loadProductReviews(productId) {
  db.ref('reviews/' + productId).once('value').then(snapshot => {
    const reviews = snapshot.val();
    const reviewsContainer = document.getElementById('reviewsList');
    
    if (!reviewsContainer) return;
    
    reviewsContainer.innerHTML = '';
    
    if (!reviews) {
      reviewsContainer.innerHTML = '<p>No reviews yet. Be the first to review this product!</p>';
      return;
    }
    
    const reviewsArray = Object.keys(reviews).map(key => ({
      id: key,
      ...reviews[key]
    }));
    
    reviewsArray.sort((a, b) => b.date - a.date);
    
    let totalRating = 0;
    
    reviewsArray.forEach(review => {
      totalRating += review.rating;
      
      const reviewElement = document.createElement('div');
      reviewElement.className = 'review-item';
      reviewElement.innerHTML = `
        <div class="review-header">
          <div class="review-user">${review.userName}</div>
          <div class="review-rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
        </div>
        <div class="review-date">${new Date(review.date).toLocaleDateString()}</div>
        <div class="review-text">${review.comment}</div>
      `;
      reviewsContainer.appendChild(reviewElement);
    });
    
    const averageRating = totalRating / reviewsArray.length;
    document.querySelector('.rating-value').textContent = averageRating.toFixed(1);
    document.querySelector('.review-count').textContent = `(${reviewsArray.length} reviews)`;
  });
}

function showReviewModal() {
  if (!currentUser) {
    showLoginModal();
    return;
  }
  
  if (!currentProduct) return;
  
  const modal = document.getElementById('alertModal');
  const title = document.getElementById('alertTitle');
  const message = document.getElementById('alertMessage');
  
  title.textContent = 'Write a Review';
  message.innerHTML = `
    <div class="review-form">
      <div class="rating-input">
        <label>Rating:</label>
        <div class="stars">
          ${[1,2,3,4,5].map(i => `
            <span class="star" data-rating="${i}">☆</span>
          `).join('')}
        </div>
        <div class="rating-text">Select your rating</div>
      </div>
      <div class="review-comment">
        <label>Your Review:</label>
        <textarea id="reviewComment" placeholder="Share your experience with this product..." rows="4"></textarea>
      </div>
    </div>
  `;
  
  modal.classList.add('active');
  
  let selectedRating = 0;
  
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', function() {
      selectedRating = parseInt(this.getAttribute('data-rating'));
      document.querySelectorAll('.star').forEach((s, index) => {
        s.textContent = index < selectedRating ? '★' : '☆';
      });
      document.querySelector('.rating-text').textContent = 
        ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][selectedRating];
    });
  });
  
  document.getElementById('alertConfirmBtn').onclick = function() {
    if (selectedRating === 0) {
      showToast('Please select a rating', 'error');
      return;
    }
    
    const comment = document.getElementById('reviewComment').value.trim();
    if (!comment) {
      showToast('Please write a review', 'error');
      return;
    }
    
    submitReview(selectedRating, comment);
    modal.classList.remove('active');
  };
  
  document.getElementById('alertCancelBtn').onclick = function() {
    modal.classList.remove('active');
  };
}

function submitReview(rating, comment) {
  const reviewId = 'review_' + Date.now();
  
  db.ref('reviews/' + currentProduct.id + '/' + reviewId).set({
    userId: currentUser.uid,
    userName: currentUser.displayName || userInfo.fullName || 'Anonymous',
    rating: rating,
    comment: comment,
    date: Date.now()
  }).then(() => {
    showToast('Review submitted successfully!', 'success');
    loadProductReviews(currentProduct.id);
  }).catch(error => {
    console.error('Error submitting review:', error);
    showToast('Failed to submit review', 'error');
  });
}

// Enhanced Account Management
function loadAccountData() {
  if (!currentUser) return;
  
  db.ref('users/' + currentUser.uid).once('value').then(snapshot => {
    if (snapshot.exists()) {
      const userData = snapshot.val();
      
      document.getElementById('accountPageName').textContent = userData.name || currentUser.displayName || 'User';
      document.getElementById('accountPageEmail').textContent = currentUser.email;
      document.getElementById('profileName').value = userData.name || currentUser.displayName || '';
      document.getElementById('profileEmail').value = currentUser.email;
      document.getElementById('profilePhone').value = userData.phone || '';
      
      const avatarImg = document.getElementById('accountPageAvatarImg');
      const avatarInitial = document.getElementById('accountPageAvatarInitial');
      
      if (currentUser.photoURL) {
        avatarImg.src = currentUser.photoURL;
        avatarImg.style.display = 'block';
        avatarInitial.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarInitial.style.display = 'block';
        avatarInitial.textContent = (userData.name || currentUser.displayName || 'U').charAt(0).toUpperCase();
      }
      
      if (userData.lastLoginAt) {
        const lastLoginTime = new Date(userData.lastLoginAt).toLocaleString();
        document.getElementById('lastLoginTime').textContent = lastLoginTime;
      }
    }
  });
}

function saveProfile() {
  const name = document.getElementById('profileName').value;
  const phone = document.getElementById('profilePhone').value;
  
  if (!currentUser) return;
  
  db.ref('users/' + currentUser.uid).update({
    name: name,
    phone: phone,
    updatedAt: Date.now()
  }).then(() => {
    showToast('Profile updated successfully', 'success');
    document.getElementById('userName').textContent = name;
    document.getElementById('mobileUserName').textContent = name;
    document.getElementById('userAvatarInitial').textContent = name.charAt(0).toUpperCase();
  }).catch(error => {
    console.error('Error updating profile:', error);
    showToast('Failed to update profile', 'error');
  });
}

function changePassword() {
  if (!currentUser) {
    showToast('Please login first', 'error');
    return;
  }
  
  const email = currentUser.email;
  
  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('Password reset email sent! Check your inbox.', 'success');
    })
    .catch(error => {
      console.error('Error sending password reset email:', error);
      showToast('Failed to send password reset email', 'error');
    });
}

function deleteAccount() {
  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    showToast('Account deletion feature coming soon', 'info');
  }
}

function saveSettings() {
  const emailNotifications = document.getElementById('emailNotifications').checked;
  const smsNotifications = document.getElementById('smsNotifications').checked;
  const pushNotifications = document.getElementById('pushNotifications').checked;
  const personalizedRecs = document.getElementById('personalizedRecs').checked;
  const dataSharing = document.getElementById('dataSharing').checked;
  const language = document.getElementById('languageSelect').value;
  const currency = document.getElementById('currencySelect').value;
  
  if (!currentUser) return;
  
  db.ref('users/' + currentUser.uid + '/settings').set({
    emailNotifications,
    smsNotifications,
    pushNotifications,
    personalizedRecs,
    dataSharing,
    language,
    currency
  }).then(() => {
    showToast('Settings saved successfully', 'success');
  }).catch(error => {
    console.error('Error saving settings:', error);
    showToast('Failed to save settings', 'error');
  });
}

// Enhanced Address Management
function loadAddresses() {
  if (!currentUser) return;
  
  db.ref('addresses/' + currentUser.uid).once('value').then(snapshot => {
    const container = document.getElementById('savedAddresses');
    container.innerHTML = '';
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p style="color:var(--muted);text-align:center">No addresses saved yet</p>';
      return;
    }
    
    const addressesObj = snapshot.val();
    const addresses = Object.keys(addressesObj).map(key => ({
      id: key,
      ...addressesObj[key]
    }));
    
    addresses.sort((a, b) => b.createdAt - a.createdAt);
    
    addresses.forEach(address => {
      const addressCard = document.createElement('div');
      addressCard.className = 'address-card';
      addressCard.innerHTML = `
        <div style="font-weight:600">${address.name}</div>
        <div>${address.street}</div>
        <div>${address.city}, ${address.state} - ${address.pincode}</div>
        <div>Mobile: ${address.mobile}</div>
        <div class="address-actions">
          <button class="btn secondary edit-address" data-id="${address.id}">Edit</button>
          <button class="btn secondary delete-address" data-id="${address.id}">Delete</button>
          ${address.isDefault ? '<span style="color:var(--success);font-weight:600">Default</span>' : 
            '<button class="btn secondary set-default-address" data-id="${address.id}">Set as Default</button>'}
        </div>
      `;
      container.appendChild(addressCard);
    });
    
    document.querySelectorAll('.set-default-address').forEach(btn => {
      btn.addEventListener('click', function() {
        const addressId = this.getAttribute('data-id');
        setDefaultAddress(addressId);
      });
    });
    
    document.querySelectorAll('.delete-address').forEach(btn => {
      btn.addEventListener('click', function() {
        const addressId = this.getAttribute('data-id');
        deleteAddress(addressId);
      });
    });
  });
}

function setDefaultAddress(addressId) {
  if (!currentUser) return;
  
  db.ref('addresses/' + currentUser.uid).once('value').then(snapshot => {
    const updates = {};
    snapshot.forEach(childSnapshot => {
      updates[childSnapshot.key + '/isDefault'] = false;
    });
    
    updates[addressId + '/isDefault'] = true;
    
    db.ref('addresses/' + currentUser.uid).update(updates)
      .then(() => {
        showToast('Default address updated', 'success');
        loadAddresses();
      })
      .catch(error => {
        console.error('Error setting default address:', error);
        showToast('Failed to update default address', 'error');
      });
  });
}

function deleteAddress(addressId) {
  if (!currentUser) return;
  
  if (confirm('Are you sure you want to delete this address?')) {
    db.ref('addresses/' + currentUser.uid + '/' + addressId).remove()
      .then(() => {
        showToast('Address deleted', 'success');
        loadAddresses();
      })
      .catch(error => {
        console.error('Error deleting address:', error);
        showToast('Failed to delete address', 'error');
      });
  }
}

function showNewAddressForm() {
  document.getElementById('newAddressForm').style.display = 'block';
}

function hideNewAddressForm() {
  document.getElementById('newAddressForm').style.display = 'none';
}

function saveAddress() {
  const name = document.getElementById('addressName').value;
  const mobile = document.getElementById('addressMobile').value;
  const pincode = document.getElementById('addressPincode').value;
  const city = document.getElementById('addressCity').value;
  const state = document.getElementById('addressState').value;
  const type = document.getElementById('addressType').value;
  const street = document.getElementById('addressStreet').value;
  
  if (!name || !mobile || !pincode || !city || !state || !street) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  if (!currentUser) return;
  
  const addressId = 'address_' + Date.now();
  
  db.ref('addresses/' + currentUser.uid + '/' + addressId).set({
    name: name,
    mobile: mobile,
    pincode: pincode,
    city: city,
    state: state,
    type: type,
    street: street,
    isDefault: false,
    createdAt: Date.now()
  }).then(() => {
    showToast('Address saved successfully', 'success');
    hideNewAddressForm();
    loadAddresses();
  }).catch(error => {
    console.error('Error saving address:', error);
    showToast('Failed to save address', 'error');
  });
}

// Wishlist functions
async function toggleWishlist(productId) {
  if (!currentUser) {
    let guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
    
    if (!guestWishlist.includes(productId)) {
      guestWishlist.push(productId);
      localStorage.setItem('guestWishlist', JSON.stringify(guestWishlist));
      showToast('Added to wishlist', 'success');
    } else {
      guestWishlist = guestWishlist.filter(id => id !== productId);
      localStorage.setItem('guestWishlist', JSON.stringify(guestWishlist));
      showToast('Removed from wishlist', 'success');
    }
    
    updateWishlistButtons();
    
    if (document.getElementById('productDetailPage').classList.contains('active') && 
        currentProduct && currentProduct.id === productId) {
      const wishlistBtn = document.getElementById('detailWishlistBtn');
      if (isInWishlist(productId)) {
        wishlistBtn.textContent = 'Remove from Wishlist';
        wishlistBtn.classList.add('active');
      } else {
        wishlistBtn.textContent = 'Add to Wishlist';
        wishlistBtn.classList.remove('active');
      }
    }
    
    if (document.getElementById('wishlistPage').classList.contains('active')) {
      renderWishlist();
    }
    
    return;
  }
  
  try {
    const wishlistRef = db.ref('wishlist/' + currentUser.uid + '/' + productId);
    const snapshot = await wishlistRef.once('value');
    
    if (!snapshot.exists()) {
      await wishlistRef.set(true);
      wishlist.push(productId);
      showToast('Added to wishlist', 'success');
    } else {
      await wishlistRef.remove();
      wishlist = wishlist.filter(id => id !== productId);
      showToast('Removed from wishlist', 'success');
    }
    
    updateWishlistButtons();
    
    if (document.getElementById('productDetailPage').classList.contains('active') && 
        currentProduct && currentProduct.id === productId) {
      const wishlistBtn = document.getElementById('detailWishlistBtn');
      if (isInWishlist(productId)) {
        wishlistBtn.textContent = 'Remove from Wishlist';
        wishlistBtn.classList.add('active');
      } else {
        wishlistBtn.textContent = 'Add to Wishlist';
        wishlistBtn.classList.remove('active');
      }
    }
    
    if (document.getElementById('wishlistPage').classList.contains('active')) {
      renderWishlist();
    }
  } catch (error) {
    console.error('Error updating wishlist:', error);
    showToast('Failed to update wishlist', 'error');
  }
}

function toggleWishlistFromDetail() {
  if (!currentProduct) return;
  toggleWishlist(currentProduct.id);
}

function updateWishlistButtons() {
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    const productId = btn.getAttribute('data-product-id');
    if (isInWishlist(productId)) {
      btn.classList.add('active');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
    } else {
      btn.classList.remove('active');
      btn.querySelector('svg').setAttribute('fill', 'none');
    }
  });
}

function renderWishlist() {
  const container = document.getElementById('wishlistItems');
  const empty = document.getElementById('emptyWishlist');
  
  if (!container || !empty) return;
  
  let wishlistProductIds = [];
  if (currentUser) {
    wishlistProductIds = wishlist;
  } else {
    wishlistProductIds = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
  }
  
  const wishlistProducts = products.filter(product => wishlistProductIds.includes(product.id));
  
  if (wishlistProducts.length === 0) {
    container.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  container.style.display = 'block';
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
    await db.ref('recentlyViewed/' + currentUser.uid + '/' + productId).set(Date.now());
    loadRecentlyViewed(currentUser);
  } catch (error) {
    console.error('Error adding to recently viewed:', error);
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
function handleSearch() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  filterProducts(query, 'productGrid');
}

function handleHomeSearch() {
  const query = document.getElementById('homeSearchInput').value.toLowerCase();
  const resultsContainer = document.getElementById('homeSearchResults');
  
  if (query.length === 0) {
    resultsContainer.style.display = 'none';
    document.getElementById('homeProductGrid').style.display = 'grid';
    return;
  }
  
  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(query) ||
    (product.description && product.description.toLowerCase().includes(query))
  );
  
  if (filteredProducts.length === 0) {
    resultsContainer.innerHTML = '<div class="card-panel center">No products found</div>';
  } else {
    renderProducts(filteredProducts, 'homeSearchResults');
  }
  
  resultsContainer.style.display = 'grid';
  document.getElementById('homeProductGrid').style.display = 'none';
}

function filterProducts(query, containerId) {
  const filteredProducts = query ? 
    products.filter(product => 
      product.name.toLowerCase().includes(query) ||
      (product.description && product.description.toLowerCase().includes(query))
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
    const price = parseFloat(product.price.replace('₹', '').replace(',', ''));
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
  document.getElementById('spPrice').textContent = formatPrice(currentProduct.price);
  document.getElementById('spDesc').textContent = currentProduct.description || '';
  document.getElementById('spFullDesc').textContent = currentProduct.fullDescription || currentProduct.description || '';
  
  const galleryMain = document.getElementById('galleryMain');
  galleryMain.style.backgroundImage = `url('${getProductImage(currentProduct)}')`;
  
  showPage('orderPage');
}

// Sharing functions
function shareProduct(platform, product = null) {
  const shareProduct = product || currentProduct;
  if (!shareProduct) return;
  
  const shareUrl = window.location.origin + window.location.pathname + '?product=' + shareProduct.id;
  const shareText = `Check out ${shareProduct.name} on Buyzo Cart - ${formatPrice(shareProduct.price)}`;
  
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
  
  const productImages = getProductImagesArray(currentProduct);
  const imageUrl = productImages[currentImageIndex];
  
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

// Sticky product detail buttons
function makeProductDetailButtonsSticky() {
  const productInfo = document.querySelector('.product-detail-info');
  const actions = document.querySelector('.product-detail-actions');
  
  if (productInfo && actions) {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio < 1) {
          actions.classList.add('sticky-visible');
        } else {
          actions.classList.remove('sticky-visible');
        }
      },
      { threshold: [1] }
    );
    
    observer.observe(productInfo);
  }
}

// Utility functions
function formatPrice(price) {
  if (typeof price === 'string') {
    return price.includes('₹') ? price : `₹${price}`;
  }
  return `₹${price}`;
}

function getProductImagesArray(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images;
  } else {
    return [getProductImage(product)];
  }
}

function getProductImage(product, idx = 0) {
  if (!product) return "https://via.placeholder.com/300x300?text=No+Image";
  if (Array.isArray(product.images) && product.images.length > 0) {
    if (idx < product.images.length) return product.images[idx];
    return product.images[0];
  }
  if (product.image) return product.image;
  if (product.img) return product.img;
  if (product.imageUrl) return product.imageUrl;
  if (product.photo) return product.photo;
  return "https://via.placeholder.com/300x300?text=No+Image";
}

function generateOrderId() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const randomNum = Math.floor(100000 + Math.random() * 900000); 
  return `ORDER-${yyyy}${mm}${dd}-${randomNum}`;
}

function saveToLocalStorage(key, data) {
  const item = {
    data: data,
    timestamp: new Date().getTime()
  };
  localStorage.setItem(key, JSON.stringify(item));
}

function loadFromLocalStorage(key, maxAge = 5 * 60 * 1000) {
  const item = localStorage.getItem(key);
  if (!item) return null;

  const parsed = JSON.parse(item);
  const now = new Date().getTime();
  if (now - parsed.timestamp > maxAge) {
    localStorage.removeItem(key);
    return null;
  }

  return parsed.data;
}

// Firebase Realtime Listeners
function setupRealtimeListeners() {
  db.ref('products').on('value', snapshot => {
    const productsObj = snapshot.val();
    if (productsObj) {
      const newProducts = Object.keys(productsObj).map(key => ({
        id: key,
        ...productsObj[key]
      }));
      
      products = newProducts;
      saveToLocalStorage('products', products);
      
      if (document.getElementById('homePage').classList.contains('active') || 
          document.getElementById('productsPage').classList.contains('active') ||
          document.getElementById('productDetailPage').classList.contains('active')) {
        renderProducts(products, 'homeProductGrid');
        renderProducts(products, 'productGrid');
        renderProductSlider(products.slice(0, 10), 'productSlider');
      }
    }
  }, error => {
    console.error('Products listener error:', error);
  });

  db.ref('categories').on('value', snapshot => {
    const categoriesObj = snapshot.val();
    if (categoriesObj) {
      const newCategories = Object.keys(categoriesObj).map(key => ({
        id: key,
        ...categoriesObj[key]
      }));
      
      categories = newCategories;
      saveToLocalStorage('categories', categories);
      
      if (document.getElementById('homePage').classList.contains('active') || 
          document.getElementById('productsPage').classList.contains('active')) {
        renderCategories();
        renderCategoryCircles();
      }
    }
  }, error => {
    console.error('Categories listener error:', error);
  });

  db.ref('banners').on('value', snapshot => {
    const bannersObj = snapshot.val();
    if (bannersObj) {
      const newBanners = Object.keys(bannersObj).map(key => ({
        id: key,
        ...bannersObj[key]
      }));
      
      banners = newBanners;
      saveToLocalStorage('banners', banners);
      
      if (document.getElementById('homePage').classList.contains('active')) {
        renderBannerCarousel();
      }
    }
  }, error => {
    console.error('Banners listener error:', error);
  });

  if (currentUser) {
    db.ref('orders').orderByChild('userId').equalTo(currentUser.uid)
      .on('value', snapshot => {
        const ordersObj = snapshot.val();
        if (ordersObj) {
          const orders = Object.keys(ordersObj).map(key => ({
            id: key,
            ...ordersObj[key]
          }));
          
          orders.sort((a, b) => b.orderDate - a.orderDate);
          
          if (document.getElementById('myOrdersPage').classList.contains('active')) {
            renderOrders(orders);
          }
        } else {
          if (document.getElementById('myOrdersPage').classList.contains('active')) {
            renderOrders([]);
          }
        }
      }, error => {
        console.error('Orders listener error:', error);
      });
  }
}

function showMyOrders() {
  if (!currentUser) return;
  
  db.ref('orders').orderByChild('userId').equalTo(currentUser.uid)
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

function sendOrderConfirmationEmail(orderData) {
  console.log('Order confirmation email would be sent for:', orderData);
}

function showCancelOrderModal(orderId) {
  const modal = document.getElementById('cancelConfirmModal');
  const orderTotal = document.getElementById('refundOrderTotal');
  const refundCharges = document.getElementById('refundCharges');
  const refundNetAmount = document.getElementById('refundNetAmount');
  
  db.ref('orders/' + orderId).once('value').then(snapshot => {
    const order = snapshot.val();
    
    if (order.paymentMethod === 'prepaid') {
      const charges = Math.round(order.price * 0.02);
      const netAmount = order.price - charges;
      
      orderTotal.textContent = `₹${order.price}`;
      refundCharges.textContent = `₹${charges}`;
      refundNetAmount.textContent = `₹${netAmount}`;
    } else {
      orderTotal.textContent = `₹${order.price}`;
      refundCharges.textContent = `₹0`;
      refundNetAmount.textContent = `₹${order.price}`;
    }
    
    modal.classList.add('active');
    
    document.getElementById('finalConfirmCancel').onclick = function() {
      cancelOrder(orderId);
      modal.classList.remove('active');
    };
    
    document.getElementById('cancelCancelConfirm').onclick = function() {
      modal.classList.remove('active');
    };
  });
}

function cancelOrder(orderId) {
  db.ref('orders/' + orderId).update({
    status: 'cancelled',
    cancelledAt: Date.now()
  }).then(() => {
    showToast('Order cancelled successfully', 'success');
    showMyOrders();
  }).catch(error => {
    console.error('Error cancelling order:', error);
    showToast('Failed to cancel order', 'error');
  });
}

// Sample data fallbacks
function loadSampleProducts() {
  products = [
    {
      id: '1',
      name: 'Wireless Bluetooth Earbuds',
      price: '₹1,299',
      originalPrice: '₹2,499',
      image: 'https://images.unsplash.com/photo-1590658165737-15a047b8b5e3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8ZWFyYnVkc3xlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      description: 'High-quality wireless earbuds with noise cancellation',
      badge: '50% OFF',
      reviews: '124',
      stock: 'in'
    },
    {
      id: '2',
      name: 'Smart Fitness Band',
      price: '₹1,999',
      image: 'https://images.unsplash.com/photo-1575311373937-040b8e1f4ed5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8Zml0bmVzcyUyMGJhbmR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=500&q=60',
      description: 'Track your fitness with this smart band',
      badge: 'NEW',
      reviews: '89',
      stock: 'in'
    }
  ];
  
  renderProducts(products, 'homeProductGrid');
  renderProducts(products, 'productGrid');
  renderProductSlider(products.slice(0, 10), 'productSlider');
}

function loadSampleCategories() {
  categories = [
    {
      id: '1',
      name: 'Electronics',
      image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGVsZWN0cm9uaWNzfGVufDB8fDB8fHww&auto=format&fit=crop&w=500&q=60'
    },
    {
      id: '2',
      name: 'Fashion',
      image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8ZmFzaGlvbnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60'
    }
  ];
  
  renderCategories();
  renderCategoryCircles();
}

function loadSampleBanners() {
  banners = [
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1607082350899-7e105aa886ae?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGVjb21tZXJjZSUyMGJhbm5lcnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      title: 'Summer Sale'
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGVjb21tZXJjZSUyMGJhbm5lcnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=500&q=60',
      title: 'New Arrivals'
    }
  ];
  
  renderBannerCarousel();
}

// Mobile back button handling
function handleMobileBack() {
  if (pageHistory.length > 1) {
    const currentPage = pageHistory.pop();
    const previousPage = pageHistory[pageHistory.length - 1];
    showPage(previousPage);
    return true;
  }
  return false;
}

// Initialize mobile back button
document.addEventListener('backbutton', handleMobileBack, false);
window.addEventListener('popstate', handleMobileBack);

// Add CSS for sticky buttons
const stickyButtonsCSS = `
.product-detail-actions.sticky-visible {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  padding: 16px;
  border-top: 1px solid var(--border);
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  z-index: 100;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.tracking-container {
  display: flex;
  justify-content: space-between;
  position: relative;
  margin: 20px 0;
}

.tracking-container::before {
  content: '';
  position: absolute;
  top: 15px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--border);
  z-index: 1;
}

.tracking-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 2;
  flex: 1;
}

.tracking-dot {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  position: relative;
}

.tracking-step.active .tracking-dot {
  background: var(--accent);
}

.tracking-step.completed .tracking-dot {
  background: var(--success);
}

.tracking-step.completed .tracking-dot::after {
  content: '✓';
  color: white;
  font-weight: bold;
}

.tracking-label {
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 4px;
}

.tracking-time {
  font-size: 10px;
  color: var(--muted);
  text-align: center;
}

.review-form {
  text-align: left;
}

.rating-input {
  margin-bottom: 16px;
}

.stars {
  display: flex;
  gap: 4px;
  margin: 8px 0;
}

.star {
  font-size: 24px;
  cursor: pointer;
  color: #ffc107;
}

.rating-text {
  font-size: 14px;
  color: var(--muted);
}

.review-comment textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
  color: var(--ink);
  font-family: inherit;
  resize: vertical;
}
`;

const style = document.createElement('style');
style.textContent = stickyButtonsCSS;
document.head.appendChild(style);

// Initialize when product detail page loads
const productDetailObserver = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      if (mutation.target.id === 'productDetailPage' && mutation.target.classList.contains('active')) {
        if (currentProduct) {
          makeProductDetailButtonsSticky();
        }
      }
    }
  });
});

if (document.getElementById('productDetailPage')) {
  productDetailObserver.observe(document.getElementById('productDetailPage'), {
    attributes: true,
    attributeFilter: ['class']
  });
}