# Security Journal (Sentinel)

## Optimization: Robust Storage Parsing and Error Handling
- **Problem:** Brittle `localStorage` parsing could lead to application-wide crashes if the user's data became corrupted or malformed.
- **Solution:**
    - Implemented a robust `try-catch` wrapper for `localStorage.getItem` and `JSON.parse` in `cacheManager.get`.
    - Added structural validation to ensure that cached objects contain a 'data' property and that critical keys (products, categories, banners) are arrays before use.
    - Implemented `try-catch` in product rendering loops (`renderProducts`, `renderSearchResults`) to ensure that a single malformed product does not crash the entire grid.
- **Impact:** Hardens the application against local data corruption and ensures that malformed data from the backend or the user's local environment does not break the user experience.
- **Security Improvement:** Prevents unexpected application behavior or crashes that could potentially be exploited through local data manipulation.
- **Measurement Verification:** Playwright tests confirmed that injecting corrupted JSON into `localStorage` (e.g., `invalid json {[` ) no longer crashes the site and still allows the application to load data from the network.

## 2024-12-31 - [XSS Protection in Dynamic HTML and Attributes]
**Vulnerability:** Cross-Site Scripting (XSS) via `innerHTML` and inline `onclick` handlers.
**Learning:** Standard HTML escaping (`&lt;`, etc.) is effective for content within tags but insufficient for JavaScript event attributes because browsers decode HTML entities *before* execution.
**Prevention:** Use `escapeHTML()` for tag content. For event handlers, replace inline `onclick` with `addEventListener` and use `data-` attributes for passing IDs or other dynamic data. Use `e.target.closest()` in event delegation to handle clicks on nested elements (like SVG icons).

## 2025-02-21 - [Context-Aware Escaping for dynamic HTML]
**Vulnerability:** XSS via product names, badges, and user reviews rendered using `innerHTML`.
**Learning:** While `escapeHTML` is effective for text nodes, it is only a partial fix for attribute contexts (like CSS `url()`). For static-site SPAs, centralized sanitization is crucial as multiple components might render the same dangerous data.
**Prevention:** Always use a robust `escapeHTML` helper for any string injected into `innerHTML`. For CSS contexts, consider additional URL encoding or avoiding dynamic style attributes where possible.
