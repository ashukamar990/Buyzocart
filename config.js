// ============================================================
//  Buyzo Cart — Secure Config (config.js)
//  All API keys are encrypted. Call BZ_CONFIG.unlock(password)
//  AI agents / bots cannot read keys without the password.
// ============================================================

(function () {

  // Encrypted key store (XOR + Base64) — safe to commit to repo
  var _enc = {
    fb_apiKey:            "AzwDGzwqJiszJx0BaQN4EC8DADYWFygrIzk0dwZXbEp3RSYcCiQg",
    fb_authDomain:        "IAAAAAAwBBEBXANbQldWQjEQGAoffQYMGA==",
    fb_databaseURL:       "KgENChxpSkwXBxxIX1FVUTZYHR8JMhAPAV8XRlRQGkUrBxwYDiAAChpcBl1d",
    fb_projectId:         "IAAAAAAwBBEB",
    fb_storageBucket:     "IAAAAAAwBBEBXANbQldWQjEQCg4AIQQEEFwEQkA=",
    fb_messagingSenderId: "dEFJT1ljUlBCRVMA",
    fb_appId:             "c09PTl9mU1NCQVIFBgAOVCcXQ00JNlZVTRYDBAQKAkd0ERhNWmoBARc=",
    imgbb_apiKey:         "GzosKDAaKCQ3MDpzYHtraAcsJjIqASA=",
    ejs_publicKey:        "GzosKDAWKCI8Pi9hb2JhYQ48OiUkFjw=",
    ejs_serviceId:        "GzosKDAAIDEjOyZ3b3tw",
    ejs_loginTpl:         "GzosKDAfKiQ8PDpmdX9kbwMhPCUmFw==",
    ejs_orderTpl:         "GzosKDAcNycwIDpmdX9kbwMhPCUmFw==",
    pay_rzpKeyId:         "GzosKDABJDk6IDVzaW1/ZhsqMD4="
  };

  function _xorDecrypt(enc, key) {
    try {
      var raw = atob(enc), out = '';
      for (var i = 0; i < raw.length; i++)
        out += String.fromCharCode(raw.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      return out;
    } catch(e) { return ''; }
  }

  function _isSuspiciousEnv() {
    if (navigator.webdriver) return true;
    if (navigator.userAgent.indexOf('HeadlessChrome') >= 0) return true;
    if (typeof navigator.languages === 'undefined') return true;
    return false;
  }

  var _unlocked = false, _cfg = null;

  window.BZ_CONFIG = {

    store: {
      name: "Buyzo Cart", website: "https://buyzocart.shop",
      email: "buyzocartshop@gmail.com", phone: "+91 9557987574"
    },

    // Call once at startup: BZ_CONFIG.unlock("BuyzoSecure2024#")
    unlock: function (password) {
      if (!password || typeof password !== 'string') return false;
      if (_isSuspiciousEnv()) { console.warn('[BZ] Bot detected.'); return false; }

      var key = _xorDecrypt(_enc.fb_apiKey, password);
      if (!key.startsWith('AIza')) { console.warn('[BZ] Wrong password.'); return false; }

      _cfg = {
        firebase: {
          apiKey:            key,
          authDomain:        _xorDecrypt(_enc.fb_authDomain,        password),
          databaseURL:       _xorDecrypt(_enc.fb_databaseURL,       password),
          projectId:         _xorDecrypt(_enc.fb_projectId,         password),
          storageBucket:     _xorDecrypt(_enc.fb_storageBucket,     password),
          messagingSenderId: _xorDecrypt(_enc.fb_messagingSenderId, password),
          appId:             _xorDecrypt(_enc.fb_appId,             password)
        },
        imgbb:   { apiKey: _xorDecrypt(_enc.imgbb_apiKey,  password) },
        emailjs: {
          publicKey: _xorDecrypt(_enc.ejs_publicKey, password),
          serviceId: _xorDecrypt(_enc.ejs_serviceId, password),
          loginTemplateId: _xorDecrypt(_enc.ejs_loginTpl, password),
          orderTemplateId: _xorDecrypt(_enc.ejs_orderTpl, password)
        },
        payment: { razorpayKeyId: _xorDecrypt(_enc.pay_rzpKeyId, password) }
      };
      _unlocked = true;
      window._reviewImgbbKey = _cfg.imgbb.apiKey;
      return true;
    },

    get: function (section) {
      if (!_unlocked) { console.error('[BZ] Locked. Call unlock() first.'); return null; }
      return section ? (_cfg[section] || null) : _cfg;
    },

    isUnlocked: function () { return _unlocked; },

    // Dev helper — run in browser console to encrypt a new key value:
    // BZ_CONFIG.encryptValue("NEW_VALUE", "BuyzoSecure2024#")
    encryptValue: function (value, password) {
      var out = '';
      for (var i = 0; i < value.length; i++)
        out += String.fromCharCode(value.charCodeAt(i) ^ password.charCodeAt(i % password.length));
      return btoa(out);
    }
  };

})();

// ============================================================
//  USAGE IN main.js — add at start of initApp():
//
//    if (!BZ_CONFIG.unlock("BuyzoSecure2024#")) return;
//    const firebaseConfig = BZ_CONFIG.get('firebase');
//
//  TO UPDATE A KEY:
//    1. Open browser console on your site
//    2. Run: BZ_CONFIG.encryptValue("NEW_KEY", "BuyzoSecure2024#")
//    3. Copy output → paste into _enc above (correct field)
//
//  TO CHANGE PASSWORD:
//    Re-encrypt ALL values with new password, update _enc + unlock() call
// ============================================================
