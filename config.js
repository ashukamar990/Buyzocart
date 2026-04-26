// ============================================================
//  Buyzo Cart — API Keys & Config (config.js)
//  Keep this file on the server, do not share publicly
//  This file contains all the API keys
// ============================================================

window.BZ_CONFIG = {

  // ---- Firebase Config ----
  // Firebase Console → Project Settings → Your apps
  firebase: {
    apiKey:            "AIzaSyCHFUx3Y1L3mvyLyDMHVKQE6eXi50_fewE",
    authDomain:        "buyzocart.firebaseapp.com",
    databaseURL:       "https://buyzocart-default-rtdb.firebaseio.com",
    projectId:         "buyzocart",
    storageBucket:     "buyzocart.firebasestorage.app",
    messagingSenderId: "640560737762",
    appId:             "1:640560737762:web:7fe368df6486d6da759dbb"
  },

  // ---- ImgBB Image Upload ----
  // Get from: https://api.imgbb.com/
  imgbb: {
    apiKey: "YOUR_IMGBB_API_KEY_HERE"
    // Example: "abc123def456..."
  },

  // ---- EmailJS ----
  // Get from: https://dashboard.emailjs.com/
  emailjs: {
    publicKey:       "YOUR_EMAILJS_PUBLIC_KEY",
    serviceId:       "YOUR_SERVICE_ID",        // e.g. "service_abc123"
    // Template IDs:
    loginTemplateId: "YOUR_LOGIN_TEMPLATE_ID", // e.g. "template_login"
    orderTemplateId: "YOUR_ORDER_TEMPLATE_ID"  // e.g. "template_order"
  },

  // ---- Payment Gateway ----
  // Razorpay: https://dashboard.razorpay.com/
  payment: {
    razorpayKeyId:     "YOUR_RAZORPAY_KEY_ID",   // e.g. "rzp_live_..."
    razorpayKeySecret: "NEVER_PUT_SECRET_IN_FRONTEND" // Server-side only!
    // Note: Never put the secret key in the frontend
  },

  // ---- Store Settings ----
  store: {
    name:    "Buyzo Cart",
    website: "https://buyzocart.shop",
    email:   "buyzocartshop@gmail.com",
    phone:   "+91 9557987574"
  }

};

// ---- Helper: Expose ImgBB key to main.js ----
window._reviewImgbbKey = window.BZ_CONFIG.imgbb.apiKey;
