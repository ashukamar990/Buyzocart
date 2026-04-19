// Buyzo Cart - Security & Protection
    (function() {
      if (window.self !== window.top) {
        document.documentElement.innerHTML = '';
        throw new Error('embedding blocked');
      }
      document.addEventListener('contextmenu', e => e.preventDefault());
      const headlessProps = [
        'webdriver', '__nightmare', 'callPhantom', '_phantom',
        'domAutomation', 'domAutomationController', 'phantom'
      ];
      for (let prop of headlessProps) {
        if (prop in window && window[prop]) {
          window.location.href = 'about:blank';
          return;
        }
      }
      if (navigator.webdriver === true) {
        window.location.href = 'about:blank';
        return;
      }
      document.querySelectorAll('img').forEach(img => {
        img.setAttribute('draggable', 'false');
      });
      const element = new Image();
      Object.defineProperty(element, 'id', {
        get: function() {
        }
      });
      console.log('%c', element);
      document.addEventListener('keydown', function(e) {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') || 
            (e.ctrlKey && e.shiftKey && e.key === 'J') ||
            (e.ctrlKey && e.key === 'U') ||
            (e.metaKey && e.altKey && e.key === 'I')) {
          e.preventDefault();
          return false;
        }
      });
      const mailLinks = document.querySelectorAll('a[href^="mailto:"]');
      mailLinks.forEach(link => {
        const original = link.getAttribute('href');
        link.addEventListener('mouseenter', function() {
          this.setAttribute('href', original);
        });
        link.setAttribute('href', '#');
      });
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      document.querySelectorAll('input, textarea').forEach(el => {
        el.style.userSelect = 'text';
      });
    })();
