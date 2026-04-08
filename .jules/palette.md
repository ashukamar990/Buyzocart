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

## 2025-05-15 - [Accessible Dynamic Updates & Focus States]
**Learning:** In static SPAs where search results update dynamically without page reloads, screen reader users are often left unaware of the change. `aria-live="polite"` effectively bridges this gap by announcing result counts. Additionally, `:focus-visible` is essential for keyboard accessibility to provide high-contrast indicators without cluttering the UI for mouse users.
**Action:** Implement `aria-live` regions for all dynamic status updates (search counts, cart totals) and use `:focus-visible` to define clear, accessible focus states.
