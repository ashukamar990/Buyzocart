# UX/Accessibility Journal (Palette)

## Optimization: Professionalized Empty State (No Products/Search Found)
- **Problem:** The previous "No products found" state was a simple text message, which looked unprofessional and provided no guidance for the user.
- **Solution:**
    - Introduced a specialized `.empty-state-professional` CSS class to create centered, visually appealing empty states.
    - Added high-quality SVG icons (search and box icons) to the empty states.
    - Included "Reset Filters" and "Go to Homepage" buttons in the empty states to provide clear next steps for the user.
    - Updated messaging from simple "No products found" to "No matching products found" with more descriptive subtext.
- **Impact:** Significant improvement in the visual quality of the application and better UX for users who find no results.
- **Accessibility:** Used semantic HTML and ensured descriptive text accompanies the icons.
- **Measurement Verification:** Playwright screenshots (e.g., `2_no_products_found.png`) confirmed the improved layout and icon presence.

## 2025-01-24 - Semantic Accessibility for Interactive Elements
**Learning:** Interactive elements like rating stars or icon-only buttons (Wishlist, Share) must be implemented using semantic `<button>` tags rather than `<span>` or `<div>` to ensure keyboard focusability and screen reader compatibility. Standard CSS resets are required to maintain layout when switching to `<button>`. Global `:focus-visible` styles provide critical feedback for keyboard users without affecting mouse-driven UX.
**Action:** Always prefer `<button type="button">` for non-link interactive controls. Include `aria-label` for icons and `aria-pressed` for toggles. Apply a consistent focus ring via `:focus-visible` to all interactive elements.
