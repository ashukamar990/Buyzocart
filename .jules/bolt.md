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
## 2026-04-30 - Address System Optimization
**Learning:** Centralizing address logic into a set of utility functions and using Map-like lookups for duplicate detection ensures (1)$ to (N)$ efficiency in local data management.
**Action:** Use centralized utility functions for CRUD operations on localStorage to maintain state consistency across multiple SPA pages.

## 2026-05-10 - O(P+R) Rating Optimization
**Learning:** Calculating product ratings by filtering the entire reviews array for each product results in $O(P \times R)$ complexity, which degrades significantly as data grows. Pre-calculating a Map of ratings in a single $O(R)$ pass reduces rendering and sorting complexity to $O(P + R)$.
**Action:** Use the `getRatingMap` utility to pre-calculate ratings before entering loops or sort comparators. Ensure the Map is initialized once outside the comparator to avoid $O(R \times P \log P)$ complexity.
