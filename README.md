# flashcards-app

## Features

- **Deck & Card CRUD:** Create, rename, edit, and delete decks and flashcards via accessible modal dialogs.
- **3D Study Mode:** Smooth 60fps CSS 3D flip animation with keyboard shortcuts (`Space` to flip, `ArrowLeft` / `ArrowRight` to navigate) and session shuffling.
- **Debounced Search:** 300ms debounced case-insensitive search filtering without mutating underlying deck data.
- **Persistence:** Versioned `LocalStorage` schema with safe JSON parsing and fallback defaults.
- **Accessibility & Dark Mode:** Automatic `prefers-color-scheme` theming, WCAG AA contrast, ARIA live announcements, and keyboard focus trapping inside modals.

## Lab Reflection

- **Where AI saved time:** AI rapidly scaffolded the boilerplate semantic HTML structure, responsive CSS Grid layout, and the boilerplate CSS 3D `perspective` / `backface-visibility` rules for the card flip animation.
- **At least one AI bug identified and fixed:** Early generated versions of the card navigation did not reset `isFlipped` to `false` when moving to the next card, causing the answer side of the next card to flash briefly. Fixed by explicitly resetting `state.ui.isFlipped = false` inside `navigateCard()`, `selectDeck()`, and search handlers.
- **A code snippet refactored for clarity:** Extracted card filtering and shuffle ordering out of the DOM rendering function into a pure `getVisibleCards()` selector function so search queries never mutate `state.cardsByDeckId`.
- **One accessibility improvement added:** Added `aria-live="polite"` regions on the card progress counter and search match status, paired with a full `Tab` / `Shift+Tab` focus trap and focus-restoration hook (`lastFocusedElement`) in the modal component.
- **What prompt changes improved AI output:** Specifying exact data structures (`decks`, `cardsByDeckId`, `activeDeckId`) and explicitly requesting event delegation instead of binding listeners inside render loops eliminated duplicate event handlers and inconsistent class names across files.
