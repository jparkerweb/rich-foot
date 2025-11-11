## 🛑 Exclude Me Please

## [1.11.0] - 2025-01-11
### 🚀 Major Refactoring
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
- Enhanced hover preview integration (works in all modes)
- Better compatibility with other plugins
- Improved Canvas and embedded note detection
- Respects view lifecycle changes more accurately

#### 📊 Code Quality
- Reduced main plugin file from 800+ lines to ~270 lines
- Comprehensive error handling with try-catch blocks
- Modern ES6+ patterns throughout
- Vanilla JavaScript (no TypeScript dependencies)
- Clear naming conventions and documentation

#### 🎨 CSS Optimizations
- Added GPU-accelerated transforms for animations
- Optimized transitions with `will-change` hints
- Layout containment for better performance
- Smoother fade-in animations

This update maintains 100% backwards compatibility with all existing settings and configurations while providing a more robust, performant foundation for future enhancements.

## [1.10.9] - 2025-01-25
### 🐛 Fixed
- Addressed issue with Rich Foot being duplicated when a note was opened in a "new window"

## [1.10.8] - 2025-01-25
### ✨ Added
- Outlink collections now include embedded notes

### 🐛 Fixed
- Fixed issue with Rich Foot not being applied in Reading Mode if the note has an embedded note

### [1.10.7] - 2025-01-13
#### 📦 Updated
- Updated `css` variables to support the `Minimal` theme

### [1.10.6] - 2025-01-10
#### 📦 Updated
- Adjusted `css` padding values to be compatible with `Typewriter Scroll` plugin

### [1.10.5] - 2024-12-26
#### 📦 Updated
- Support for more date formats in `frontmatter` created/modified fields (ISO, space-separated, and just date)

### [1.10.4] - 2024-12-23
#### 🐛 Fixed
- Fixed issue with Rich Foot not loading all user defined colors when Obsidian is restarted

### [1.10.3] - 2024-12-14
#### 🐛 Fixed
- Improved parent selector matching to properly detect and exclude Rich Foot when specified selectors are present in the view or its parent elements

### [1.10.2] - 2024-12-11
#### 🐛 Fixed
- Missing `Excluded Folders` section in the settings

### [1.10.1] - 2024-12-10
#### 🐛 Fixed
- Extra padding on the bottom of the editor in Canvas / Kanban Cards

### [1.10.0] - 2024-12-08
#### ✨ Added
- Exclusion rule via `frontmatter` field
- Custom exclusions using specified DOM parent selectors for advanced control


[![screenshot](https://raw.githubusercontent.com/jparkerweb/ref/refs/heads/main/equill-labs/rich-foot/rich-foot-v1.10.0.jpg)](https://raw.githubusercontent.com/jparkerweb/ref/refs/heads/main/equill-labs/rich-foot/rich-foot-v1.10.0.jpg)