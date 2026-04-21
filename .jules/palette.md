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

## 2026-04-21 - Semantic Interactive Elements & Skip Link
**Learning:** Using non-semantic elements like `div` or `span` for interactive components (logos, menu icons, rating stars) makes them invisible to keyboard users and screen readers. A "Skip to Content" link is essential for keyboard users to bypass repetitive navigation.
**Action:** Always use `<button>` for actions and `<a>` for navigation. Ensure every icon-only button has an `aria-label`. Include a skip link at the top of the body for complex layouts.
