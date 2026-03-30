## 2024-03-30 - [Search Performance Optimization]
**Learning:** In vanilla JS applications with large product lists, normalization of strings (`.toLowerCase()`) inside filter loops can cause significant UI lag. Caching the normalized query outside the loop and debouncing the input event reduces the main-thread workload and prevents excessive re-renders/DOM updates.

**Action:** Cache loop-invariant normalization results and apply debouncing to frequently triggered input event listeners to ensure smooth UI interaction during search.
