# Security Journal (Sentinel)

## 2024-12-31 - [Comprehensive XSS Protection in Dynamic Rendering]
**Vulnerability:** Cross-Site Scripting (XSS) via `innerHTML` template literals and attributes.
**Learning:** The application heavily relies on `innerHTML` for core rendering logic (`createProductCard`, `renderReviews`) to handle complex UI structures. This creates significant XSS vectors in both tag content and attributes (e.g., `src`, `onclick`, `data-*`).
**Prevention:**
1. Always implement a robust `escapeHTML()` utility in `main.js`.
2. Apply `escapeHTML()` to ALL user-controllable data injected into `innerHTML`, including content within tags AND attribute values.
3. For event handlers like `onclick`, ensure arguments are also passed through `escapeHTML()` to prevent breakout from the attribute's quotes.
4. Prefer `textContent` or `addEventListener` when feasible, but ensure strict escaping when using template literals for large HTML blocks.
