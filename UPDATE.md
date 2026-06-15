## 🚀 New Feature

### v1.13.0
#### ✨ Adjustable Footer Width
- Added a **Footer Width** setting to control how wide the footer is
- Choose **Readable line length** to lock the footer to Obsidian's readable line width, or **Custom width** to set a maximum width in pixels
- The footer now always caps at the width of the note, so it no longer causes horizontal scrolling on narrow screens (notably on mobile)
- Configure via Settings → Style Settings → **Footer Width**

### v1.12.0
#### ✨ Limit Links Shown
- Added an option to limit the number of backlinks/outlinks shown in the footer
- Surplus links are hidden behind a **Show More (X)** button that expands them on click (and collapses again with **Show Less**)
- Helpful for notes with a large number of links that previously caused flickering and scroll-reset issues
- Configure via Settings → **Limit Links Shown** (toggle) and **Links Limit** (default 10)

## 🚀 Code Refactoring

### v1.11.1
#### 📦 Update
- Optimized CSS for rending `rich foot` element at the bottom of notes

### v1.11.0
This release represents a complete architectural overhaul of the Rich Foot plugin, implementing modern best practices and significant performance improvements.

#### ✨ Performance Enhancements
- Implemented `requestAnimationFrame` for all visual updates to eliminate page jitter
- Optimized MutationObserver usage with RAF-debounced callbacks
- Added CSS `contain` and `will-change` properties for better rendering performance
- Reduced layout thrashing through batched DOM operations
- Smart update detection to skip unnecessary re-renders

#### 🏗️ Architecture Improvements
- Complete code reorganization with separation of concerns
- New modular structure:
  - **RichFootDataManager**: Handles all data fetching and parsing
  - **RichFootRenderer**: Pure rendering logic with optimal DOM operations
  - **RichFootViewManager**: View lifecycle and observer management
- Eliminated code duplication across date parsing and link creation
- Cleaner, more maintainable codebase with JSDoc documentation

#### 🧹 Cleanup & Stability
- Proper resource cleanup using Obsidian's `registerEvent` exclusively
- Improved observer management with automatic disconnection
- Data attributes for better element tracking
- No more manual event cleanup in `onunload` (automatic via registration)
- Fixed potential memory leaks from orphaned observers

#### 🔧 Compatibility
- Enhanced native hover preview integration (works in all modes)
- Respects view lifecycle changes more accurately

#### 📊 Code Quality
- Comprehensive error handling with try-catch blocks
- Modern ES6+ patterns throughout
- Clear naming conventions and documentation

#### 🎨 CSS Optimizations
- Added GPU-accelerated transforms for animations
- Optimized transitions with `will-change` hints
- Layout containment for better performance
- Smoother fade-in animations

This update maintains 100% backwards compatibility with all existing settings and configurations while providing a more robust, performant foundation for future enhancements.
