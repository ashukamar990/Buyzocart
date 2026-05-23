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

## 2024-05-18 - [Hardcoded Secrets Removal and Security Hardening]
**Vulnerability:** Exposure of Firebase API keys and configuration in client-side HTML files.
**Learning:** While Firebase API keys are often intended for client-side use, hardcoding them directly in multiple HTML files makes rotations difficult and increases the risk of accidental exposure or misuse if not managed centrally. Using a centralized, encrypted configuration system like `BZ_CONFIG` provides a cleaner and more secure way to manage these credentials.
**Prevention:** Always use the project's established secure configuration management system (`BZ_CONFIG`) to retrieve API keys and sensitive settings instead of hardcoding them in HTML or JavaScript files. Ensure consistent application of security headers (CSP, Referrer-Policy) across all entry points.
