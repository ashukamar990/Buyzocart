// Firebase configuration and initialization
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

// Initialize Realtime Database and Authentication
const realtimeDB = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/***********************
 * Global Variables
 ***********************/
let PRODUCTS = [];
let productsLoaded = false;
let recentlyViewed = [];
let currentUser = null;
let users = [];
let selectedProduct = null;

// Load products from Realtime Database with offline support
function loadProductsFromRealtimeDB() {
  const cachedProducts = localStorage.getItem('cached_products');
  if (cachedProducts) {
    try {
      PRODUCTS = JSON.parse(cachedProducts);
      renderHomePreview();
      renderProductSlider();
      productsLoaded = true;
    } catch (e) {
      console.error("Error parsing cached products:", e);
    }
  }

  const productsRef = realtimeDB.ref('products');
  productsRef.on('value', (snapshot) => {
    const products = [];
    snapshot.forEach((childSnapshot) => {
      const productData = childSnapshot.val();
      products.push({
        id: childSnapshot.key,
        title: productData.name || 'No Name',
        price: productData.price || 0,
        desc: productData.description || '',
        fullDesc: productData.fullDesc || productData.description || '',
        images: productData.images ? productData.images : (productData.image ? [productData.image] : []),
        sizes: productData.sizes || ['S', 'M', 'L'],
        category: productData.category || 'Uncategorized',
        sku: productData.sku || 'SKU-' + childSnapshot.key,
        stock: productData.stock || Math.floor(Math.random() * 50) + 10,
        featured: productData.featured || false,
        trending: productData.trending || false,
        minQty: productData.minQty || 1
      });
    });
    
    PRODUCTS = products;
    localStorage.setItem('cached_products', JSON.stringify(PRODUCTS));
    
    if (!productsLoaded) {
      renderHomePreview();
      renderProductSlider();
      productsLoaded = true;
    } else {
      renderProductSlider();
    }
  }, (error) => {
    console.error("Error loading products:", error);
    if (PRODUCTS.length === 0) {
      loadDemoProducts();
    }
  });
}

// Load categories from Realtime Database
function loadCategories() {
  const categoriesRef = realtimeDB.ref('categories');
  categoriesRef.on('value', (snapshot) => {
    const categories = [];
    snapshot.forEach((childSnapshot) => {
      categories.push(childSnapshot.val());
    });
    renderCategories(categories);
  }, (error) => {
    console.error("Error loading categories:", error);
    renderCategories(["All", "Men", "Women", "Kids", "Electronics", "Home", "Accessories"]);
  });
}

// Render categories
function renderCategories(categories) {
  const container = document.getElementById('categoriesContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  categories.forEach(category => {
    const pill = document.createElement('div');
    pill.className = 'category-pill';
    pill.textContent = category;
    pill.onclick = () => filterProductsByCategory(category);
    container.appendChild(pill);
  });
}

// Filter products by category
function filterProductsByCategory(category) {
  document.querySelectorAll('.category-pill').forEach(pill => {
    pill.classList.remove('active');
  });
  event.target.classList.add('active');
  
  const filteredProducts = category === 'All' 
    ? PRODUCTS 
    : PRODUCTS.filter(product => product.category === category);
  
  renderProductGrid(filteredProducts);
}

// Load users from Realtime Database
function loadUsers() {
  const usersRef = realtimeDB.ref('users');
  usersRef.on('value', (snapshot) => {
    const loadedUsers = [];
    snapshot.forEach((childSnapshot) => {
      loadedUsers.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });
    users = loadedUsers;
  });
}

// Load orders from Realtime Database
function loadOrders() {
  if (!currentUser) return;
  
  const ordersRef = realtimeDB.ref('orders').orderByChild('userId').equalTo(currentUser.uid);
  ordersRef.on('value', (snapshot) => {
    const orders = [];
    snapshot.forEach((childSnapshot) => {
      const order = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };
      orders.push(order);
    });
    
    orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    updateOrdersNotification(orders);
  });
}

// Update orders notification badge
function updateOrdersNotification(orders) {
  const notification = document.getElementById('ordersNotification');
  if (!notification) return;
  
  const recentOrders = orders.filter(order => {
    const orderDate = new Date(order.orderDate);
    const now = new Date();
    const diffTime = Math.abs(now - orderDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  });
  
  if (recentOrders.length > 0) {
    notification.textContent = recentOrders.length;
    notification.style.display = 'flex';
  } else {
    notification.style.display = 'none';
  }
}

// Load wishlist from Realtime Database
function loadWishlist() {
  if (!currentUser) return;
  
  const wishlistRef = realtimeDB.ref('wishlists/' + currentUser.uid);
  wishlistRef.on('value', (snapshot) => {
    const wishlist = [];
    snapshot.forEach((childSnapshot) => {
      wishlist.push(childSnapshot.val());
    });
    renderWishlist(wishlist);
  });
}

// Render wishlist
function renderWishlist(wishlist) {
  const wishlistGrid = document.getElementById('wishlistGrid');
  const noWishlist = document.getElementById('noWishlist');
  
  if (!wishlistGrid || !noWishlist) return;
  
  if (wishlist.length === 0) {
    wishlistGrid.style.display = 'none';
    noWishlist.style.display = 'block';
    return;
  }
  
  wishlistGrid.style.display = 'grid';
  noWishlist.style.display = 'none';
  wishlistGrid.innerHTML = '';
  
  wishlist.forEach(item => {
    const product = PRODUCTS.find(p => p.id === item.productId);
    if (!product) return;
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="product-img-slider-container">
        <div class="product-img-slider" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
      </div>
      <div class="card-body">
        <div class="title">${product.title}</div>
        <div class="price">₹${product.price}</div>
        <div class="badge">${product.desc}</div>
        <div style="margin-top:auto">
          <div class="quick-actions">
            <button class="quick-action-btn order-now-btn" data-product-id="${product.id}">Order Now</button>
            <button class="quick-action-btn remove-wishlist-btn" data-product-id="${product.id}">Remove</button>
          </div>
        </div>
      </div>
    `;
    
    wishlistGrid.appendChild(card);
    
    card.querySelector('.order-now-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      orderProduct(productId);
    });
    
    card.querySelector('.remove-wishlist-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      removeFromWishlist(productId);
    });
  });
}

// Add to wishlist
function addToWishlist(productId) {
  if (!currentUser) {
    showAlert('Please login to add items to your wishlist');
    return;
  }
  
  const wishlistRef = realtimeDB.ref('wishlists/' + currentUser.uid + '/' + productId);
  wishlistRef.set({
    productId: productId,
    addedDate: new Date().toISOString()
  }).then(() => {
    showToast('Product added to wishlist');
    updateWishlistButtonState(productId, true);
  }).catch(error => {
    console.error('Error adding to wishlist:', error);
    showToast('Failed to add to wishlist', 'error');
  });
}

// Remove from wishlist
function removeFromWishlist(productId) {
  if (!currentUser) return;
  
  const wishlistRef = realtimeDB.ref('wishlists/' + currentUser.uid + '/' + productId);
  wishlistRef.remove().then(() => {
    showToast('Product removed from wishlist');
    updateWishlistButtonState(productId, false);
  }).catch(error => {
    console.error('Error removing from wishlist:', error);
    showToast('Failed to remove from wishlist', 'error');
  });
}

// Update wishlist button state
function updateWishlistButtonState(productId, isInWishlist) {
  // Update product card buttons
  document.querySelectorAll(`.wishlist-btn[data-product-id="${productId}"]`).forEach(btn => {
    if (isInWishlist) {
      btn.classList.add('active');
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Added`;
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Wishlist`;
    }
  });

  // Update product detail page button
  const detailBtn = document.getElementById('detailWishlistBtn');
  if (detailBtn && detailBtn.getAttribute('data-product-id') === productId) {
    if (isInWishlist) {
      detailBtn.classList.add('active');
      detailBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" style="margin-right:8px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Added to Wishlist`;
    } else {
      detailBtn.classList.remove('active');
      detailBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Add to Wishlist`;
    }
  }
}

// Check if product is in wishlist
function checkWishlistStatus(productId) {
  if (!currentUser) return false;
  
  // This would typically check the database
  // For demo, we'll check localStorage
  const wishlist = JSON.parse(localStorage.getItem('wishlist_' + currentUser.uid)) || [];
  return wishlist.includes(productId);
}

// Load recently viewed products from localStorage
function loadRecentlyViewed() {
  const stored = localStorage.getItem('recently_viewed');
  if (stored) {
    recentlyViewed = JSON.parse(stored);
    renderRecentlyViewed();
  }
}

// Add product to recently viewed
function addToRecentlyViewed(productId) {
  const index = recentlyViewed.indexOf(productId);
  if (index > -1) {
    recentlyViewed.splice(index, 1);
  }
  
  recentlyViewed.unshift(productId);
  
  if (recentlyViewed.length > 10) {
    recentlyViewed = recentlyViewed.slice(0, 10);
  }
  
  localStorage.setItem('recently_viewed', JSON.stringify(recentlyViewed));
  renderRecentlyViewed();
}

// Render recently viewed products
function renderRecentlyViewed() {
  const slider = document.getElementById('recentlyViewedSlider');
  const section = document.getElementById('recentlyViewedSection');
  
  if (!slider || !section) return;
  
  if (recentlyViewed.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  slider.innerHTML = '';
  
  const products = recentlyViewed
    .map(id => PRODUCTS.find(p => p.id === id))
    .filter(p => p);
  
  products.forEach(product => {
    if (!product) return;
    
    const item = document.createElement('div');
    item.className = 'slider-item';
    item.innerHTML = `
      <div class="slider-item-img" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
      <div class="slider-item-body">
        <div class="slider-item-title">${product.title}</div>
        <div class="slider-item-price">₹${product.price}</div>
      </div>
    `;
    item.onclick = () => showProductDetail(product.id);
    slider.appendChild(item);
  });
}

// Demo products fallback
function loadDemoProducts() {
  PRODUCTS = [
    {
      id: "1",
      title: "Men's Running Shoes",
      price: 2499,
      desc: "Lightweight & comfortable",
      fullDesc: "These running shoes feature a breathable mesh upper and cushioned sole for maximum comfort during your runs. Perfect for daily use and gym workouts.",
      images: [
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
      ],
      sizes: ["S", "M", "L", "XL"],
      category: "Men",
      sku: "RUN-SHOE-001",
      stock: 25,
      featured: true,
      trending: true,
      minQty: 1
    },
    {
      id: "2",
      title: "Women's Summer Dress",
      price: 1899,
      desc: "Floral print, cotton blend",
      fullDesc: "This beautiful summer dress features a vibrant floral pattern and is made from a comfortable cotton blend. Perfect for summer outings and casual events.",
      images: [
        "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1485231183945-fffde7cb34e5?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1496747611176-843222e1e57c?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
      ],
      sizes: ["XS", "S", "M", "L"],
      category: "Women",
      sku: "SUM-DRS-002",
      stock: 18,
      featured: true,
      trending: true,
      minQty: 1
    },
    {
      id: "3",
      title: "Wireless Earbuds",
      price: 3999,
      desc: "Noise cancellation, 20hr battery",
      fullDesc: "Experience crystal-clear audio with these wireless earbuds featuring active noise cancellation and up to 20 hours of battery life with the charging case.",
      images: [
        "https://images.unsplash.com/photo-1590658165737-15a047b8b5e0?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1578319439587-82c68395567e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
      ],
      sizes: ["One Size"],
      category: "Electronics",
      sku: "WLS-EBD-003",
      stock: 32,
      featured: true,
      trending: true,
      minQty: 1
    },
    {
      id: "4",
      title: "Kids' Backpack",
      price: 899,
      desc: "Colorful, water-resistant",
      fullDesc: "This colorful backpack is perfect for school or travel. Made from water-resistant material with multiple compartments for organized storage.",
      images: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1585916420730-d7f95e942d43?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60"
      ],
      sizes: ["One Size"],
      category: "Kids",
      sku: "KID-BPK-004",
      stock: 15,
      featured: false,
      trending: false,
      minQty: 1
    }
  ];
  
  localStorage.setItem('cached_products', JSON.stringify(PRODUCTS));
  renderHomePreview();
  renderProductSlider();
  productsLoaded = true;
}

// Initialize the application
function init() {
  loadProductsFromRealtimeDB();
  loadCategories();
  loadUsers();
  loadRecentlyViewed();
  
  auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUserUI();
    
    if (user) {
      loadOrders();
      loadWishlist();
    } else {
      // Clear user-specific UI
      document.getElementById('ordersNotification').style.display = 'none';
    }
  });
  
  setupEventListeners();
  renderHomePreview();
  
  // Rotating hero messages
  let messageIndex = 0;
  const heroMessages = document.querySelectorAll('#heroMessages span');
  
  if (heroMessages.length > 0) {
    setInterval(() => {
      heroMessages.forEach(msg => msg.classList.remove('active'));
      messageIndex = (messageIndex + 1) % heroMessages.length;
      heroMessages[messageIndex].classList.add('active');
    }, 4000);
  }

  // Check URL for product parameter on page load
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product');
  
  if (productId && PRODUCTS.length > 0) {
    const checkProduct = setInterval(() => {
      const product = PRODUCTS.find(p => p.id === productId);
      if (product) {
        clearInterval(checkProduct);
        showProductDetail(productId);
      }
    }, 100);
    
    setTimeout(() => clearInterval(checkProduct), 3000);
  }
}

// Update user UI based on authentication state
function updateUserUI() {
  const loginBtn = document.getElementById('openLoginTop');
  const userProfile = document.getElementById('userProfile');
  const mobileLoginBtn = document.getElementById('mobileLoginBtn');
  const mobileUserProfile = document.getElementById('mobileUserProfile');
  const mobileUserName = document.getElementById('mobileUserName');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  
  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfile) userProfile.style.display = 'flex';
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
    if (mobileUserProfile) mobileUserProfile.style.display = 'flex';
    
    const displayName = currentUser.displayName || currentUser.email.split('@')[0];
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    
    if (mobileUserName) mobileUserName.textContent = displayName;
    if (userName) userName.textContent = displayName;
    if (userAvatar) userAvatar.textContent = initials.substring(0, 2);
    
    // Update user avatar with photo if available
    if (currentUser.photoURL && userAvatar) {
      userAvatar.style.backgroundImage = `url('${currentUser.photoURL}')`;
      userAvatar.style.backgroundSize = 'cover';
      userAvatar.textContent = '';
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userProfile) userProfile.style.display = 'none';
    if (mobileLoginBtn) mobileLoginBtn.style.display = 'flex';
    if (mobileUserProfile) mobileUserProfile.style.display = 'none';
  }
}

// Show forgot password form
function showForgotPassword() {
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('signupForm').classList.remove('active');
  document.getElementById('forgotPasswordForm').classList.add('active');
}

// Switch between login and signup tabs
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.remove('active');
  });
  document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
  
  document.getElementById('loginForm').classList.remove('active');
  document.getElementById('signupForm').classList.remove('active');
  document.getElementById('forgotPasswordForm').classList.remove('active');
  
  if (tab === 'login') {
    document.getElementById('loginForm').classList.add('active');
  } else if (tab === 'signup') {
    document.getElementById('signupForm').classList.add('active');
  }
}

// Forgot password functionality
document.getElementById('forgotPasswordForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('forgotPasswordEmail').value;
  
  auth.sendPasswordResetEmail(email)
    .then(() => {
      showToast('Password reset email sent. Please check your inbox.');
      switchAuthTab('login');
    })
    .catch(error => {
      console.error('Error sending password reset email:', error);
      showToast('Failed to send reset email. Please check the email address.', 'error');
    });
});

// Sign up with email and password
document.getElementById('signupForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('signupConfirmPassword').value;
  
  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      return userCredential.user.updateProfile({
        displayName: name
      });
    })
    .then(() => {
      showToast('Account created successfully!');
      document.getElementById('authModal').classList.remove('active');
    })
    .catch(error => {
      console.error('Error creating account:', error);
      showToast('Failed to create account: ' + error.message, 'error');
    });
});

// Login with email and password
document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      showToast('Logged in successfully!');
      document.getElementById('authModal').classList.remove('active');
    })
    .catch(error => {
      console.error('Error signing in:', error);
      showToast('Failed to login: ' + error.message, 'error');
    });
});

// Google sign-in
document.getElementById('googleSignInBtn').addEventListener('click', function() {
  auth.signInWithPopup(provider)
    .then(() => {
      showToast('Logged in successfully with Google!');
      document.getElementById('authModal').classList.remove('active');
    })
    .catch(error => {
      console.error('Error signing in with Google:', error);
      showToast('Failed to login with Google: ' + error.message, 'error');
    });
});

// Logout function
function logout() {
  auth.signOut()
    .then(() => {
      showToast('Logged out successfully');
      updateUserUI();
    })
    .catch(error => {
      console.error('Error signing out:', error);
      showToast('Failed to logout', 'error');
    });
}

// Setup event listeners
function setupEventListeners() {
  // Mobile menu
  document.getElementById('menuIcon').addEventListener('click', openMenu);
  document.getElementById('menuClose').addEventListener('click', closeMenu);
  document.getElementById('menuOverlay').addEventListener('click', closeMenu);
  
  // Auth modal
  document.getElementById('openLoginTop').addEventListener('click', showLoginModal);
  document.getElementById('authModalClose').addEventListener('click', hideLoginModal);
  document.getElementById('authModal').addEventListener('click', function(e) {
    if (e.target === this) hideLoginModal();
  });
  
  // Navigation
  document.getElementById('openContactTop').addEventListener('click', () => showPage('contactPage'));
  document.getElementById('openMyOrdersTop').addEventListener('click', showMyOrders);
  
  // User profile dropdown (you'll need to add this element)
  document.getElementById('userProfile').addEventListener('click', toggleUserMenu);
  
  // Home page search
  document.getElementById('homeSearchInput').addEventListener('input', handleHomeSearch);
  
  // Products page search and filters
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.getElementById('applyPriceFilter').addEventListener('click', applyPriceFilter);
  document.getElementById('resetPriceFilter').addEventListener('click', resetPriceFilter);
  
  // Price range sliders
  document.getElementById('minPriceSlider').addEventListener('input', updatePriceRange);
  document.getElementById('maxPriceSlider').addEventListener('input', updatePriceRange);
  
  // Order flow
  document.getElementById('backToProducts').addEventListener('click', () => showPage('productsPage'));
  document.getElementById('toUserInfo').addEventListener('click', toUserInfo);
  document.getElementById('editOrder').addEventListener('click', () => showPage('orderPage'));
  document.getElementById('saveUserInfo').addEventListener('click', saveUserInfo);
  document.getElementById('toPayment').addEventListener('click', toPayment);
  document.getElementById('payBack').addEventListener('click', () => showPage('userPage'));
  document.getElementById('confirmOrder').addEventListener('click', confirmOrder);
  
  // Success page
  document.getElementById('goHome').addEventListener('click', () => showPage('homePage'));
  document.getElementById('viewOrders').addEventListener('click', showMyOrders);
  
  // Size selection
  document.querySelectorAll('.size-option').forEach(option => {
    option.addEventListener('click', function() {
      document.querySelectorAll('.size-option').forEach(opt => opt.classList.remove('selected'));
      this.classList.add('selected');
      document.getElementById('sizeValidationError').classList.remove('show');
    });
  });
  
  // Quantity controls
  document.querySelector('.qty-minus').addEventListener('click', decreaseQty);
  document.querySelector('.qty-plus').addEventListener('click', increaseQty);
  
  // Share link copy button
  document.getElementById('copyShareLink').addEventListener('click', copyShareLink);
  
  // Product detail wishlist button
  document.getElementById('detailWishlistBtn').addEventListener('click', toggleDetailWishlist);
  
  // Product detail share button
  document.getElementById('detailShareBtn').addEventListener('click', shareProduct);
  
  // Social sharing buttons
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const platform = this.getAttribute('data-platform');
      shareOnPlatform(platform);
    });
  });
  
  // Newsletter subscription
  document.getElementById('subscribeBtn').addEventListener('click', subscribeNewsletter);
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
  document.body.style.overflow = 'auto';
}

// Auth modal functions
function showLoginModal() {
  document.getElementById('authModal').classList.add('active');
  switchAuthTab('login');
}

function hideLoginModal() {
  document.getElementById('authModal').classList.remove('active');
}

// User menu toggle
function toggleUserMenu() {
  // Create or toggle user dropdown menu
  let userMenu = document.getElementById('userDropdownMenu');
  if (!userMenu) {
    userMenu = document.createElement('div');
    userMenu.id = 'userDropdownMenu';
    userMenu.className = 'user-dropdown-menu';
    userMenu.innerHTML = `
      <div class="user-info">
        <div class="user-avatar">${currentUser.displayName ? currentUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'U'}</div>
        <div class="user-details">
          <div class="user-name">${currentUser.displayName || 'User'}</div>
          <div class="user-email">${currentUser.email}</div>
        </div>
      </div>
      <div class="menu-item" onclick="showPage('myOrdersPage'); hideUserMenu();">My Orders</div>
      <div class="menu-item" onclick="showPage('wishlistPage'); hideUserMenu();">Wishlist</div>
      <div class="menu-divider"></div>
      <div class="menu-item logout-btn" onclick="logout(); hideUserMenu();">Logout</div>
    `;
    
    // Add styles for dropdown
    const style = document.createElement('style');
    style.textContent = `
      .user-dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--card);
        border-radius: var(--radius);
        box-shadow: var(--shadow-hover);
        border: 1px solid var(--border);
        width: 280px;
        z-index: 1000;
        margin-top: 8px;
        padding: 16px 0;
      }
      .user-info {
        display: flex;
        align-items: center;
        padding: 0 16px 16px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 8px;
      }
      .user-details {
        margin-left: 12px;
      }
      .user-name {
        font-weight: 600;
        color: var(--ink);
      }
      .user-email {
        font-size: 14px;
        color: var(--muted);
      }
      .menu-item {
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      .menu-item:hover {
        background: #f8fafc;
      }
      .logout-btn {
        color: var(--error);
      }
      .menu-divider {
        height: 1px;
        background: var(--border);
        margin: 8px 0;
      }
    `;
    document.head.appendChild(style);
    
    document.getElementById('userProfile').appendChild(userMenu);
  }
  
  userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
}

function hideUserMenu() {
  const userMenu = document.getElementById('userDropdownMenu');
  if (userMenu) {
    userMenu.style.display = 'none';
  }
}

// Page navigation
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  document.getElementById(pageId).classList.add('active');
  
  if (pageId === 'homePage') {
    renderHomePreview();
    renderProductSlider();
  } else if (pageId === 'productsPage') {
    renderProductGrid(PRODUCTS);
  } else if (pageId === 'wishlistPage') {
    loadWishlist();
  }
  
  closeMenu();
  hideUserMenu();
}

// Show my orders
function showMyOrders() {
  if (!currentUser) {
    showAlert('Please login to view your orders');
    return;
  }
  
  showPage('myOrdersPage');
  loadOrders();
}

// Show product detail
function showProductDetail(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  
  addToRecentlyViewed(productId);
  
  document.getElementById('detailTitle').textContent = product.title;
  document.getElementById('detailSku').textContent = `SKU: ${product.sku}`;
  document.getElementById('detailPrice').textContent = `₹${product.price}`;
  document.getElementById('detailDesc').textContent = product.desc;
  document.getElementById('detailFullDesc').textContent = product.fullDesc;
  
  const stockStatus = document.getElementById('detailStockStatus');
  stockStatus.textContent = product.stock > 10 ? 'In Stock' : (product.stock > 0 ? 'Low Stock' : 'Out of Stock');
  stockStatus.className = 'stock-status ' + (product.stock > 10 ? 'in-stock' : (product.stock > 0 ? 'low-stock' : 'out-of-stock'));
  
  const meta = document.getElementById('detailMeta');
  meta.innerHTML = `
    <p><strong>Category:</strong> ${product.category}</p>
    <p><strong>Available Sizes:</strong> ${product.sizes.join(', ')}</p>
    <p><strong>Material:</strong> Premium quality materials</p>
    <p><strong>Care Instructions:</strong> Machine wash cold, tumble dry low</p>
  `;
  
  document.getElementById('breadcrumbProductName').textContent = product.title;
  
  const mainImage = document.getElementById('detailMainImage');
  const thumbnails = document.getElementById('detailThumbnails');
  
  if (product.images && product.images.length > 0) {
    mainImage.style.backgroundImage = `url('${product.images[0]}')`;
    
    thumbnails.innerHTML = '';
    product.images.forEach((image, index) => {
      const thumb = document.createElement('div');
      thumb.className = `product-detail-thumbnail ${index === 0 ? 'active' : ''}`;
      thumb.style.backgroundImage = `url('${image}')`;
      thumb.onclick = () => {
        mainImage.style.backgroundImage = `url('${image}')`;
        document.querySelectorAll('.product-detail-thumbnail').forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      };
      thumbnails.appendChild(thumb);
    });
    
    if (product.images.length > 1) {
      setupDetailCarousel(product.images);
    }
  }
  
  const shareLink = document.getElementById('productShareLink');
  shareLink.value = generateShareUrl(productId);
  
  const wishlistBtn = document.getElementById('detailWishlistBtn');
  wishlistBtn.setAttribute('data-product-id', productId);
  
  // Check wishlist status and update button
  const isInWishlist = checkWishlistStatus(productId);
  updateWishlistButtonState(productId, isInWishlist);
  
  const orderBtn = document.getElementById('detailOrderBtn');
  orderBtn.onclick = () => orderProduct(productId);
  
  renderSimilarProducts(productId, product.category);
  showPage('productDetailPage');
}

// Setup detail carousel
function setupDetailCarousel(images) {
  const mainImage = document.getElementById('detailMainImage');
  const prevBtn = mainImage.querySelector('.prev');
  const nextBtn = mainImage.querySelector('.next');
  const dotsContainer = mainImage.querySelector('.detail-carousel-dots');
  
  let currentIndex = 0;
  
  dotsContainer.innerHTML = '';
  images.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = `detail-carousel-dot ${index === 0 ? 'active' : ''}`;
    dot.onclick = () => {
      currentIndex = index;
      updateDetailCarousel();
    };
    dotsContainer.appendChild(dot);
  });
  
  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateDetailCarousel();
  };
  
  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % images.length;
    updateDetailCarousel();
  };
  
  function updateDetailCarousel() {
    mainImage.style.backgroundImage = `url('${images[currentIndex]}')`;
    
    dotsContainer.querySelectorAll('.detail-carousel-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
    
    document.querySelectorAll('.product-detail-thumbnail').forEach((thumb, index) => {
      thumb.classList.toggle('active', index === currentIndex);
    });
  }
}

// Render similar products
function renderSimilarProducts(currentProductId, category) {
  const slider = document.getElementById('similarProductsSlider');
  if (!slider) return;
  
  const similarProducts = PRODUCTS.filter(p => 
    p.category === category && p.id !== currentProductId
  ).slice(0, 8);
  
  slider.innerHTML = '';
  
  if (similarProducts.length === 0) {
    slider.innerHTML = '<p style="text-align:center;color:var(--muted);padding:20px">No similar products found</p>';
    return;
  }
  
  similarProducts.forEach(product => {
    const item = document.createElement('div');
    item.className = 'slider-item';
    item.innerHTML = `
      <div class="slider-item-img" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
      <div class="slider-item-body">
        <div class="slider-item-title">${product.title}</div>
        <div class="slider-item-price">₹${product.price}</div>
      </div>
    `;
    item.onclick = () => showProductDetail(product.id);
    slider.appendChild(item);
  });
}

// Order product
function orderProduct(productId) {
  if (!currentUser) {
    showAlert('Please login to place an order');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  
  selectedProduct = product;
  
  document.getElementById('spTitle').textContent = product.title;
  document.getElementById('spPrice').textContent = `₹${product.price}`;
  document.getElementById('spDesc').textContent = product.desc;
  document.getElementById('spFullDesc').textContent = product.fullDesc;
  
  const galleryMain = document.getElementById('galleryMain');
  if (product.images && product.images.length > 0) {
    galleryMain.style.backgroundImage = `url('${product.images[0]}')`;
    
    if (product.images.length > 1) {
      setupOrderCarousel(product.images);
    }
  }
  
  document.getElementById('qtySelect').value = product.minQty || 1;
  showPage('orderPage');
}

// Setup order carousel
function setupOrderCarousel(images) {
  const galleryMain = document.getElementById('galleryMain');
  const prevBtn = galleryMain.querySelector('.prev');
  const nextBtn = galleryMain.querySelector('.next');
  const dotsContainer = galleryMain.querySelector('.carousel-dots');
  
  let currentIndex = 0;
  
  dotsContainer.innerHTML = '';
  images.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
    dot.onclick = () => {
      currentIndex = index;
      updateOrderCarousel();
    };
    dotsContainer.appendChild(dot);
  });
  
  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateOrderCarousel();
  };
  
  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % images.length;
    updateOrderCarousel();
  };
  
  function updateOrderCarousel() {
    galleryMain.style.backgroundImage = `url('${images[currentIndex]}')`;
    
    dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
  }
}

// Quantity controls
function decreaseQty() {
  const qtyInput = document.getElementById('qtySelect');
  const currentQty = parseInt(qtyInput.value);
  const minQty = selectedProduct ? selectedProduct.minQty || 1 : 1;
  
  if (currentQty > minQty) {
    qtyInput.value = currentQty - 1;
  }
}

function increaseQty() {
  const qtyInput = document.getElementById('qtySelect');
  const currentQty = parseInt(qtyInput.value);
  qtyInput.value = currentQty + 1;
}

// To user info page
function toUserInfo() {
  const selectedSize = document.querySelector('.size-option.selected');
  if (!selectedSize) {
    document.getElementById('sizeValidationError').classList.add('show');
    return;
  }
  
  showPage('userPage');
}

// Save user info
function saveUserInfo() {
  showToast('Information saved successfully!');
}

// To payment page
function toPayment() {
  const fullname = document.getElementById('fullname').value;
  const mobile = document.getElementById('mobile').value;
  const pincode = document.getElementById('pincode').value;
  
  if (!fullname || !mobile || !pincode) {
    showToast('Please fill in all required fields', 'error');
    return;
  }
  
  const qty = parseInt(document.getElementById('qtySelect').value);
  const price = selectedProduct.price * qty;
  const delivery = 50;
  const total = price + delivery;
  
  document.getElementById('sumProduct').textContent = selectedProduct.title;
  document.getElementById('sumQty').textContent = qty;
  document.getElementById('sumPrice').textContent = `₹${price}`;
  document.getElementById('sumDel').textContent = `₹${delivery}`;
  document.getElementById('sumTotal').textContent = `₹${total}`;
  
  showPage('paymentPage');
}

// Confirm order
function confirmOrder() {
  const fullname = document.getElementById('fullname').value;
  const mobile = document.getElementById('mobile').value;
  const pincode = document.getElementById('pincode').value;
  const city = document.getElementById('city').value;
  const state = document.getElementById('state').value;
  const house = document.getElementById('house').value;
  
  const qty = parseInt(document.getElementById('qtySelect').value);
  const selectedSize = document.querySelector('.size-option.selected').getAttribute('data-value');
  const paymentMethod = document.querySelector('input[name="pay"]:checked').value;
  
  const order = {
    productId: selectedProduct.id,
    productTitle: selectedProduct.title,
    productPrice: selectedProduct.price,
    quantity: qty,
    size: selectedSize,
    totalAmount: (selectedProduct.price * qty) + 50,
    paymentMethod: paymentMethod,
    customerName: fullname,
    customerMobile: mobile,
    customerAddress: `${house}, ${city}, ${state} - ${pincode}`,
    orderDate: new Date().toISOString(),
    status: 'confirmed',
    userId: currentUser.uid
  };
  
  const ordersRef = realtimeDB.ref('orders');
  const newOrderRef = ordersRef.push();
  newOrderRef.set(order)
    .then(() => {
      showPage('successPage');
      
      document.getElementById('fullname').value = '';
      document.getElementById('mobile').value = '';
      document.getElementById('pincode').value = '';
      document.getElementById('city').value = '';
      document.getElementById('state').value = '';
      document.getElementById('house').value = '';
    })
    .catch(error => {
      console.error('Error saving order:', error);
      showToast('Failed to place order. Please try again.', 'error');
    });
}

// Search functionality
function handleHomeSearch() {
  const query = document.getElementById('homeSearchInput').value.toLowerCase().trim();
  const resultsContainer = document.getElementById('homeSearchResults');
  
  if (query.length < 2) {
    resultsContainer.style.display = 'none';
    return;
  }
  
  const filteredProducts = PRODUCTS.filter(product => 
    product.title.toLowerCase().includes(query) || 
    product.desc.toLowerCase().includes(query) ||
    product.category.toLowerCase().includes(query)
  );
  
  if (filteredProducts.length > 0) {
    renderSearchResults(filteredProducts, resultsContainer);
    resultsContainer.style.display = 'grid';
  } else {
    resultsContainer.innerHTML = '<div class="card-panel center" style="grid-column:1/-1">No products found</div>';
    resultsContainer.style.display = 'grid';
  }
}

function handleSearch() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  
  if (query.length < 2) {
    renderProductGrid(PRODUCTS);
    return;
  }
  
  const filteredProducts = PRODUCTS.filter(product => 
    product.title.toLowerCase().includes(query) || 
    product.desc.toLowerCase().includes(query) ||
    product.category.toLowerCase().includes(query)
  );
  
  renderProductGrid(filteredProducts);
}

function renderSearchResults(products, container) {
  container.innerHTML = '';
  
  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="product-img-slider-container">
        <div class="product-img-slider" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
      </div>
      <div class="card-body">
        <div class="title">${product.title}</div>
        <div class="price">₹${product.price}</div>
        <div class="badge">${product.desc}</div>
      </div>
    `;
    card.onclick = () => showProductDetail(product.id);
    container.appendChild(card);
  });
}

// Price filter functionality
function updatePriceRange() {
  const minSlider = document.getElementById('minPriceSlider');
  const maxSlider = document.getElementById('maxPriceSlider');
  const minPrice = document.getElementById('minPrice');
  const maxPrice = document.getElementById('maxPrice');
  const minValue = document.getElementById('minPriceValue');
  const maxValue = document.getElementById('maxPriceValue');
  
  if (parseInt(minSlider.value) > parseInt(maxSlider.value)) {
    minSlider.value = maxSlider.value;
  }
  
  minValue.textContent = `₹${minSlider.value}`;
  maxValue.textContent = `₹${maxSlider.value}`;
  
  minPrice.value = minSlider.value;
  maxPrice.value = maxSlider.value;
}

function applyPriceFilter() {
  const minPrice = parseInt(document.getElementById('minPrice').value) || 0;
  const maxPrice = parseInt(document.getElementById('maxPrice').value) || 5000;
  
  const filteredProducts = PRODUCTS.filter(product => 
    product.price >= minPrice && product.price <= maxPrice
  );
  
  renderProductGrid(filteredProducts);
}

function resetPriceFilter() {
  document.getElementById('minPrice').value = '';
  document.getElementById('maxPrice').value = '';
  document.getElementById('minPriceSlider').value = 0;
  document.getElementById('maxPriceSlider').value = 5000;
  document.getElementById('minPriceValue').textContent = '₹0';
  document.getElementById('maxPriceValue').textContent = '₹5000';
  
  renderProductGrid(PRODUCTS);
}

// Render home page preview
function renderHomePreview() {
  const grid = document.getElementById('homeProductGrid');
  if (!grid) return;
  
  const featuredProducts = PRODUCTS.filter(p => p.featured).slice(0, 6);
  
  grid.innerHTML = '';
  
  featuredProducts.forEach(product => {
    const isInWishlist = checkWishlistStatus(product.id);
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="product-img-slider-container">
        <div class="product-img-slider" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
        <button class="product-card-control prev">&#10094;</button>
        <button class="product-card-control next">&#10095;</button>
        <div class="product-card-dots"></div>
      </div>
      <div class="card-body">
        <div class="title">${product.title}</div>
        <div class="price">₹${product.price}</div>
        <div class="badge">${product.desc}</div>
        <div style="margin-top:auto">
          <div class="quick-actions">
            <button class="quick-action-btn order-now-btn" data-product-id="${product.id}">Order Now</button>
            <button class="quick-action-btn wishlist-btn ${isInWishlist ? 'active' : ''}" data-product-id="${product.id}">
              ${isInWishlist ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Added' : 
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Wishlist'
              }
            </button>
            <button class="quick-action-btn share-btn" data-product-id="${product.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share
            </button>
          </div>
        </div>
      </div>
    `;
    
    card.querySelector('.order-now-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      orderProduct(productId);
    });
    
    card.querySelector('.wishlist-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      const isActive = this.classList.contains('active');
      
      if (isActive) {
        removeFromWishlist(productId);
      } else {
        addToWishlist(productId);
      }
    });
    
    card.querySelector('.share-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      shareProductCard(productId);
    });
    
    if (product.images && product.images.length > 1) {
      setupProductCardSlider(card, product.images);
    }
    
    grid.appendChild(card);
  });
}

// Setup product card slider
function setupProductCardSlider(card, images) {
  const slider = card.querySelector('.product-img-slider');
  const prevBtn = card.querySelector('.prev');
  const nextBtn = card.querySelector('.next');
  const dotsContainer = card.querySelector('.product-card-dots');
  
  let currentIndex = 0;
  
  dotsContainer.innerHTML = '';
  images.forEach((_, index) => {
    const dot = document.createElement('div');
    dot.className = `product-card-dot ${index === 0 ? 'active' : ''}`;
    dot.onclick = () => {
      currentIndex = index;
      updateCardSlider();
    };
    dotsContainer.appendChild(dot);
  });
  
  prevBtn.onclick = (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateCardSlider();
  };
  
  nextBtn.onclick = (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % images.length;
    updateCardSlider();
  };
  
  function updateCardSlider() {
    slider.style.backgroundImage = `url('${images[currentIndex]}')`;
    
    dotsContainer.querySelectorAll('.product-card-dot').forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
  }
}

// Render product grid
function renderProductGrid(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  products.forEach(product => {
    const isInWishlist = checkWishlistStatus(product.id);
    
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="product-img-slider-container">
        <div class="product-img-slider" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
        <button class="product-card-control prev">&#10094;</button>
        <button class="product-card-control next">&#10095;</button>
        <div class="product-card-dots"></div>
      </div>
      <div class="card-body">
        <div class="title">${product.title}</div>
        <div class="price">₹${product.price}</div>
        <div class="badge">${product.desc}</div>
        <div style="margin-top:auto">
          <div class="quick-actions">
            <button class="quick-action-btn order-now-btn" data-product-id="${product.id}">Order Now</button>
            <button class="quick-action-btn wishlist-btn ${isInWishlist ? 'active' : ''}" data-product-id="${product.id}">
              ${isInWishlist ? 
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Added' : 
                '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Wishlist'
              }
            </button>
            <button class="quick-action-btn share-btn" data-product-id="${product.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg> Share
            </button>
          </div>
        </div>
      </div>
    `;
    
    card.querySelector('.order-now-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      orderProduct(productId);
    });
    
    card.querySelector('.wishlist-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      const isActive = this.classList.contains('active');
      
      if (isActive) {
        removeFromWishlist(productId);
      } else {
        addToWishlist(productId);
      }
    });
    
    card.querySelector('.share-btn').addEventListener('click', function() {
      const productId = this.getAttribute('data-product-id');
      shareProductCard(productId);
    });
    
    if (product.images && product.images.length > 1) {
      setupProductCardSlider(card, product.images);
    }
    
    grid.appendChild(card);
  });
}

// Share product from card
function shareProductCard(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;
  
  const shareUrl = generateShareUrl(productId);
  const text = `Check out ${product.title} for just ₹${product.price} on Buyzo Cart!`;
  
  if (navigator.share) {
    navigator.share({
      title: product.title,
      text: text,
      url: shareUrl
    }).catch(err => {
      console.error('Error sharing:', err);
      copyToClipboard(shareUrl);
    });
  } else {
    copyToClipboard(shareUrl);
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Product link copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    showToast('Failed to copy link', 'error');
  });
}

// Render product slider
function renderProductSlider() {
  const slider = document.getElementById('productSlider');
  if (!slider) return;
  
  const trendingProducts = PRODUCTS.filter(p => p.trending).slice(0, 8);
  
  slider.innerHTML = '';
  
  trendingProducts.forEach(product => {
    const item = document.createElement('div');
    item.className = 'slider-item';
    item.innerHTML = `
      <div class="slider-item-img" style="background-image:url('${product.images[0] || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e'}')"></div>
      <div class="slider-item-body">
        <div class="slider-item-title">${product.title}</div>
        <div class="slider-item-price">₹${product.price}</div>
      </div>
    `;
    item.onclick = () => showProductDetail(product.id);
    slider.appendChild(item);
  });
}

// Toggle product detail wishlist
function toggleDetailWishlist() {
  const btn = document.getElementById('detailWishlistBtn');
  const productId = btn.getAttribute('data-product-id');
  
  if (btn.classList.contains('active')) {
    removeFromWishlist(productId);
  } else {
    addToWishlist(productId);
  }
}

// Share product
function shareProduct() {
  const productId = document.getElementById('detailWishlistBtn').getAttribute('data-product-id');
  const product = PRODUCTS.find(p => p.id === productId);
  
  if (!product) return;
  
  const shareUrl = generateShareUrl(productId);
  const text = `Check out ${product.title} for just ₹${product.price} on Buyzo Cart!`;
  
  if (navigator.share) {
    navigator.share({
      title: product.title,
      text: text,
      url: shareUrl
    }).catch(err => {
      console.error('Error sharing:', err);
      copyShareLink();
    });
  } else {
    copyShareLink();
  }
}

// Share on specific platform
function shareOnPlatform(platform) {
  const productId = document.getElementById('detailWishlistBtn').getAttribute('data-product-id');
  const product = PRODUCTS.find(p => p.id === productId);
  
  if (!product) return;
  
  const shareUrl = generateShareUrl(productId);
  const text = `Check out ${product.title} for just ₹${product.price} on Buyzo Cart!`;
  
  let url;
  
  switch(platform) {
    case 'facebook':
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      break;
    case 'twitter':
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
      break;
    case 'whatsapp':
      url = `https://wa.me/?text=${encodeURIComponent(text + ' ' + shareUrl)}`;
      break;
    default:
      return;
  }
  
  window.open(url, '_blank', 'width=600,height=400');
}

// Copy share link to clipboard
function copyShareLink() {
  const shareLink = document.getElementById('productShareLink');
  shareLink.select();
  shareLink.setSelectionRange(0, 99999);
  
  navigator.clipboard.writeText(shareLink.value).then(() => {
    showToast('Product link copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    showToast('Failed to copy link', 'error');
  });
}

// Generate shareable product URL
function generateShareUrl(productId) {
  return window.location.origin + window.location.pathname + '?product=' + productId;
}

// Subscribe to newsletter
function subscribeNewsletter() {
  const email = document.getElementById('newsletterEmail').value;
  
  if (!email || !email.includes('@')) {
    showToast('Please enter a valid email address', 'error');
    return;
  }
  
  const subscribers = JSON.parse(localStorage.getItem('newsletter_subscribers')) || [];
  if (!subscribers.includes(email)) {
    subscribers.push(email);
    localStorage.setItem('newsletter_subscribers', JSON.stringify(subscribers));
  }
  
  showToast('Thank you for subscribing to our newsletter!');
  document.getElementById('newsletterEmail').value = '';
}

// Alert modal
function showAlert(message) {
  document.getElementById('alertMessage').textContent = message;
  document.getElementById('alertModal').classList.add('active');
  
  document.getElementById('alertModalCancel').onclick = () => {
    document.getElementById('alertModal').classList.remove('active');
  };
  
  document.getElementById('alertModalConfirm').onclick = () => {
    document.getElementById('alertModal').classList.remove('active');
    showLoginModal();
  };
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');
  
  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);