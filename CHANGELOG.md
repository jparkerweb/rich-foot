# Changelog

All notable changes to Rich Foot will be documented in this file.

## [1.11.0] - 2025-11-15
### 🚀 Code Refactoring
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

## [1.10.9] - 2025-01-25
### 🐛 Fixed
- Addressed issue with Rich Foot being duplicated when a note was opened in a "new window"

## [1.10.8] - 2025-01-25
### ✨ Added
- Outlink collections now include embedded notes

### 🐛 Fixed
- Fixed issue with Rich Foot not being applied in Reading Mode if the note has an embedded note

## [1.10.7] - 2025-01-13
### 📦 Updated
- Updated `css` variables to support the `Minimal` theme

## [1.10.6] - 2025-01-10
### 📦 Updated
- Ajusted `css` padding values to be compatible with `Typewriter Scroll` plugin

## [1.10.5] - 2024-12-26
### 📦 Updated
- Support for more date formats in `frontmatter` created/modified fields (ISO, space-separated, and just date)

## [1.10.4] - 2024-12-23
### 🐛 Fixed
- Fixed issue with Rich Foot not loading all user defined colors when Obsidian is restarted

## [1.10.3] - 2024-12-14
### 🐛 Fixed
- Improved parent selector matching to properly detect and exclude Rich Foot when specified selectors are present in the view or its parent elements

## [1.10.2] - 2024-12-11
### 🐛 Fixed
- Missing `Excluded Folders` section in the settings

## [1.10.1] - 2024-12-10
### 🐛 Fixed
- Extra padding on the bottom of the editor in Canvas / Kanban Cards

## [1.10.0] - 2024-12-08
### ✨ Added
- Exclusion rule via `frontmatter` field
- Custom exclusions using specified DOM parent selectors for advanced control

## [1.9.2] - 2024-12-01
### 🐛 Fixed
- dynamic `css` in `reading` mode disrupting document flow of floated elements (e.g. ITS callouts)
- debounced `updateRichFoot` in `editing` mode (new settings option that allows delay in milliseconds)

## [1.9.1] - 2024-12-01
### 🐛 Fixed
- `Links` defined in frontmatter were not being displayed

## [1.9.0] - 2024-11-30
### ✨ Added
- Option to combine `Outlinks` / `Backlinks` in one view called `Links`
- Directional arrows for `Links`
- Outlinks for `footnote` internal links

### 🐛 Fixed
- `Page Preview` not displaying properly in `editing mode`

## [1.8.0] - 2024-11-29
### ✨ Added
- Support for `Page Preview` core plugin for `Outlinks` & `Backlinks`

## [1.7.2] - 2024-11-29
### ✨ Added
- `Date Display Format` option to allow users to specify their own date format

### 🐛 Fixed
- Date not formatted correctly if timestamp was included in the Custom Created/Modified Date Property

## [1.7.1] - 2024-11-27
### 🐛 Fixed
- Note embeds in canvas now have the correct height
- Duplicate "show dates" option in settings

### ✨ Added
- If using custom created/modified date properties, the date now displays in the format of "Month Day, Year" if in proper date format, otherwise it displays the raw frontmatter filed string value.

## [1.7.0] - 2024-11-26
### ✨ Added
- `Custom Created/Modified Date Property` fields to allow users to specify their own frontmatter properties for dates, useful when file system dates are affected by sync processes and you track them separately.

## [1.6.2] - 2024-11-23
### 📦 Updated
- Outlinks section to inclued transclusion links (example `[[note#section]]` or `[text](note#section)`)

## [1.6.1] - 2024-11-14
### 🐛 Fixed
- Fixed console error when switching between reading/editing modes

## [1.6.0] - 2024-11-09
### ✨ Added
- New Border, Links, and Date color customization options in settings
  - Color picker to select custom colors
  - Reset button to restore default colors (theme accent color)
  - Real-time color updates

## [1.5.1] - 2024-10-31
### 🐛 Fixed
- Fixed bug where excluded folders were not being saved correctly

## [1.5.0] - 2024-10-31
### ✨ Added
- New Style Settings section in plugin settings
- Border customization options:
  - Border width slider (1-10px)
  - Border style dropdown with 8 styles
  - Border opacity slider (0-1)
- Link appearance controls:
  - Border radius slider (0-15px)
  - Links opacity slider (0-1)
- Date display controls:
  - Dates opacity slider (0-1)
- Reset buttons for all customization options
- Improved settings UI organization

### 📦 Updated
- Reorganized settings panel for better usability
- Updated documentation to reflect new customization options
- Improved CSS variable management for better theme compatibility

## [1.4.0] - 2023-10-28
### ✨ Added
- Display `Outlinks` (under the `Backlinks` section)
- Updated Settings page:
  - Toggle controls for Backlinks, Outlinks, and Created/Modified dates
  - Improved Exclude Folders controls for easier management

## [1.3.3] - 2023-10-21
### 🐛 Fixed
- Only create backlinks to notes, not files like images
- Fixed issue with backlinks being removed/re-added when scrolling long notes
- Fixed issue with rich-foot being displayed to the right of notes in editing mode

## [1.3.0] - 2023-10-17
### 🐛 Fixed
- Compatibility issues with Obsidian v1.7.2+ that introduces `DeferredView`

## [1.2.0] - 2023-10-12
### 🐛 Fixed
- Don't create backlinks that reference themselves

## [1.1.0] - 2023-10-09
### ✨ Added
- Support for `rich-foot` rendering in both `editing` and `live preview` modes

## [1.0.0] - 2023-09-23
### ✨ Added
- Initial release
- Backlinks displayed as tags in note footers
- Created/Modified dates display
- Stylish appearance with tag-like links
- Folder exclusion feature
- Basic settings configuration
