## 2024-11-20 - [Accessibility] Interactive div elements without semantic roles
**Learning:** Many interactive elements in this app (like the mobile menu toggle and close button) are implemented using `div` tags with `onclick` handlers. This prevents them from being part of the default tab order and being properly announced by screen readers.
**Action:** Always prefer semantic `<button>` or `<a>` elements for interactive components. When using custom elements, ensure proper ARIA roles and keyboard event listeners are implemented.
