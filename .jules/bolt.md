# Performance Journal (Bolt)

## Optimization: Resilient Caching and Loading State Coordination
- **Problem:** Brittle caching logic and unsynchronized loading states led to blank screens or "No products found" messages appearing prematurely while data was still being fetched.
- **Solution:**
    - Introduced `window.isProductsLoading` to track the state of the initial data fetch.
    - Enhanced `cacheManager.get` with structural validation and `try-catch` to handle corrupted `localStorage` safely.
    - Added a 5-second safety timeout to `setupRealtimeListeners` to force-clear the loading state if the network connection or Firebase hangs.
- **Impact:** Eliminates UI flicker, prevents app crashes from invalid cache data, and ensures a consistent user experience even under poor network conditions.
- **Measurement Verification:** Playwright tests confirmed that data is rendered correctly and the site remains functional even with corrupted cache entries.

## Optimization: High-Performance Rendering and Image Delivery
- **Problem:** Inefficient $O(P \times R)$ rating calculations, blocking scroll/input events, and heavy images using non-lazy `background-image` properties.
- **Solution:**
    - Implemented `getRatingMap` utility to pre-calculate product ratings, reducing rendering complexity to $O(P+R)$.
    - Replaced `background-image` with semantic `<img>` tags across the site, enabling `loading="lazy"` and `decoding="async"`.
    - Integrated automatic Unsplash optimization parameters (`&w=600&q=80`) via `getProductImage` utility.
    - Refactored all sliders and auto-scroll logic to use `requestAnimationFrame` for 60fps-ready DOM updates.
    - Applied throttling to the `scroll` event and debouncing (300ms) to the search input.
- **Impact:** Significantly reduced main-thread blocking, smoother scrolling and animations, and faster perceived load times due to optimized image delivery.
- **Measurement Verification:** Playwright scripts and visual inspection confirmed smooth transitions, correct lazy-loading behavior, and UI stability.

## 2025-04-21 - Batch Rating Calculation and Search Debouncing
**Learning:** Nested review filtering in search sorting and product rendering created (N \log N \times R)$ and (P \times R)$ bottlenecks. Pre-calculating average ratings in a single (R)$ pass and using a lookup map reduces this to (N \log N)$ and (P + R)$ respectively. Additionally, search suggestions without debouncing caused redundant fuzzy search calls.
**Action:** Always pre-calculate derived data maps for batch rendering and apply debouncing to intensive UI events like search input.
