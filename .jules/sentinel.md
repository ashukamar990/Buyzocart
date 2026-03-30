## 2025-03-30 - Stored XSS in User-Generated Content
**Vulnerability:** User-provided data such as reviews, names, and addresses were being rendered using `innerHTML` without proper escaping, leading to Stored Cross-Site Scripting (XSS).
**Learning:** In a vanilla JavaScript application, directly using `innerHTML` with user-controllable data is a common source of XSS vulnerabilities. Even seemingly "safe" fields like user names or order IDs can be exploited if not escaped.
**Prevention:** Always escape user-controllable strings before inserting them into the DOM via `innerHTML`. Alternatively, use `textContent` or `innerText` for plain text, or use `document.createElement` and set properties individually.
