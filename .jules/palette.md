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
## 2026-04-30 - Amazon-Style Address Management
**Learning:** Providing a grid of 'small box' cards for address selection improves mobile usability compared to long lists or dropdowns.
**Action:** Implement grid-based card layouts for management interfaces to maximize screen real estate and improve touch targets.

## 2026-05-30 - Add Copy Order ID button to success page
**Learning:** Adding a copy button for critical information (like Order IDs) on success pages significantly improves UX by reducing the friction of manually selecting and copying text, especially on mobile where text selection can be finicky. Providing immediate "Copied!" feedback on the button itself (instead of just a toast) gives the user direct confirmation in their center of focus.
**Action:** Always consider adding a "Copy" helper next to important identifiers or codes that users might need to save for later reference. Use inline visual feedback (e.g., text change on the button) to confirm the action immediately.
