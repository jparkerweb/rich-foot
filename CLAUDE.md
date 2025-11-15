# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rich Foot is an Obsidian plugin that enhances note footers with backlinks, outlinks, and created/modified dates. The plugin follows a modular architecture with separation of concerns between data management, rendering, and view lifecycle.

## Build and Development Commands

### Build Commands
```bash
# Production build (bundles and creates example vault zip)
npm run build

# Test build (bundles code and copies to example vault for testing)
npm run test-build

# Create example vault zip only
npm run zip

# Clean dependencies and reinstall
npm run clean
```

### Development Workflow
The plugin uses esbuild for bundling. The build process:
1. Bundles `src/main.js` and dependencies to `main.js`
2. Converts `UPDATE.md` to HTML and injects as virtual module for release notes
3. Copies built files to `.vault/rich-foot-example/.obsidian/plugins/rich-foot/` for testing

To test changes:
1. Run `npm run test-build`
2. Open the example vault in Obsidian (`.vault/rich-foot-example/`)
3. Reload the plugin or restart Obsidian

## Code Architecture

### Modular Class Structure
The codebase is organized into four main modules plus settings:

1. **RichFootPlugin** (`src/main.js`) - Main plugin entry point
   - Manages plugin lifecycle (onload/onunload)
   - Registers workspace events using Obsidian's registration methods
   - Coordinates between data, rendering, and view management
   - Uses requestAnimationFrame for smooth updates

2. **RichFootDataManager** (`src/data-manager.js`) - Data fetching and parsing
   - `getBacklinks(file)` - Fetches backlinks from metadata cache
   - `getOutlinks(file)` - Extracts all outlinks (links, embeds, frontmatter, footnotes)
   - `getDates(file, settings)` - Parses creation/modification dates
   - Handles footnote link detection with special regex patterns

3. **RichFootRenderer** (`src/renderer.js`) - DOM rendering
   - `createFooter(file, data)` - Creates complete footer element
   - `createLinksSection()` / `createCombinedLinksSection()` - Link rendering
   - `createLinkElement()` - Individual link elements with hover support
   - `attachToContainer()` - RAF-based DOM attachment with fade-in

4. **RichFootViewManager** (`src/view-manager.js`) - View lifecycle
   - `attachToView(view)` - Attaches footer to markdown views
   - `shouldExclude(view, file)` - Checks exclusion rules (folders, frontmatter, selectors)
   - `setupObserver()` - Creates MutationObservers for DOM changes
   - `disconnectAllObservers()` - Cleanup on unload
   - Manages edit vs reading mode differences

5. **RichFootSettingTab** (`src/settings.js`) - Settings UI and management

### Critical Patterns

**Event Registration:**
All workspace events use `this.registerEvent()` for automatic cleanup. Never manually call `.off()` in `onunload()`.

**Performance Optimization:**
- All DOM updates use `requestAnimationFrame()` to prevent jitter
- MutationObservers are debounced with RAF
- Updates are skipped if content hasn't changed (tracked via data attributes)

**Resource Cleanup:**
- Observers stored in Map and disconnected in `onunload()`
- RAF IDs canceled on component cleanup
- All footers removed by `[data-rich-foot]` selector

## Important Constraints

### Protected Regex Patterns
**NEVER modify these lines in `src/main.js`:**
```javascript
const inlineFootnoteRegex = /\^\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]/g;
const refFootnoteRegex = /\[\^[^\]]+\]:\s*((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])/g;
```
These handle complex nested bracket patterns in footnotes.

### Obsidian Compatibility
- Target Obsidian version 1.7.2+
- No global variables when possible
- Use Obsidian API exclusively (don't access Electron directly)
- Support both edit mode and reading mode
- Work with Canvas, split panes, and popout windows

## Code Style

- **Language:** Vanilla JavaScript (ES6+), no TypeScript
- **Variables/Functions:** camelCase (e.g., `isFetchingData`, `handleUserInput`)
- **Classes:** PascalCase (e.g., `RichFootPlugin`, `RichFootRenderer`)
- **Directories:** lowercase-hyphenated (e.g., `src/data-manager.js`)
- **Components:** Functional components preferred over class components
- **Organization:** Feature-based file organization with single responsibility

## Settings Structure

Settings are stored in `this.plugin.settings` with properties like:
- `showBacklinks`, `showOutlinks`, `showDates` - Visibility toggles
- `combineLinks` - Show backlinks and outlinks in single section
- `excludedFolders` - Array of folder paths to exclude
- `excludedParentSelectors` - CSS selectors for exclusion
- `customCreatedDateProp`, `customModifiedDateProp` - Frontmatter properties
- Visual customization: `borderWidth`, `borderStyle`, `borderOpacity`, colors, etc.

CSS properties are applied via `document.documentElement.style.setProperty()` with `--rich-foot-*` custom properties.

## Key Implementation Details

**View Mode Detection:**
```javascript
const mode = view.getMode?.() ?? view.mode;
// 'source' = edit mode, 'preview' = reading mode
```

**Container Selection:**
- Edit mode: `.cm-sizer` (CodeMirror editor)
- Reading mode: `.markdown-preview-section`

**Exclusion Rules:**
1. Folder path matching (includes subfolders)
2. Frontmatter property check (`hiddenRichFoot: true`)
3. CSS parent selector matching (`.markdown-source-view.mod-cm6 .cm-sizer`)

**Hover Preview Integration:**
Uses Obsidian's built-in hover mechanism by setting `data-href` and `data-type="file"` attributes on link elements.

## Common Tasks

**Adding a new exclusion type:**
Modify `shouldExclude()` in `src/view-manager.js`

**Adding a new visual setting:**
1. Add to `DEFAULT_SETTINGS` in `src/settings.js`
2. Add CSS property in `updateCSSProperties()` in `src/main.js`
3. Add UI control in settings tab

**Debugging rendering issues:**
- Check if `shouldExclude()` is filtering the view
- Verify `getTargetContainer()` finds correct DOM element
- Ensure observers are not being prematurely disconnected

## Release Notes

Release notes are automatically shown on version updates. The system:
1. Reads `UPDATE.md` at build time
2. Converts markdown to HTML using `marked`
3. Injects as virtual module `virtual:release-notes`
4. Displays in modal if `settings.lastVersion !== manifest.version`
