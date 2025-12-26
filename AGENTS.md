# AGENTS.md

This file provides guidance to AI coding agents like Claude Code (claude.ai/code), Cursor AI, Codex, Gemini CLI, GitHub Copilot, and other AI coding assistants when working with code in this repository.

## Project Overview

Rich Foot is an Obsidian plugin (target version 1.7.2+) that adds backlinks, outlinks, and created/modified dates to note footers. Written in vanilla JavaScript (ES6+), no TypeScript.

## Commands

```bash
npm run test-build   # Build and copy to example vault for testing
npm run build        # Production build (bundles + creates example vault zip)
npm run clean        # Reinstall dependencies
```

**Testing workflow:** Run `npm run test-build`, then open `.vault/rich-foot-example/` in Obsidian.

## Architecture

Four modules with single responsibilities:

| Module | File | Purpose |
|--------|------|---------|
| **RichFootPlugin** | `src/main.js` | Entry point, lifecycle, event registration |
| **RichFootDataManager** | `src/data-manager.js` | Data fetching (backlinks, outlinks, dates) |
| **RichFootRenderer** | `src/renderer.js` | DOM creation and attachment |
| **RichFootViewManager** | `src/view-manager.js` | View lifecycle, observers, exclusion logic |
| **RichFootSettingTab** | `src/settings.js` | Settings UI and defaults |

### Data Flow
1. Plugin registers workspace events via `registerEvent()`
2. ViewManager determines if view should display footer (`shouldExclude()`)
3. DataManager fetches backlinks/outlinks/dates from Obsidian metadata cache
4. Renderer creates DOM elements and attaches with `requestAnimationFrame()`

## Critical Constraints

### Protected Regex - NEVER Modify
```javascript
// src/data-manager.js - These handle nested bracket patterns in footnotes
const inlineFootnoteRegex = /\^\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]/g;
const refFootnoteRegex = /\[\^[^\]]+\]:\s*((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])/g;
```

### Required Patterns

**Event registration:** Always use `this.registerEvent()` - never manual cleanup in `onunload()`.

**DOM updates:** All visual updates must use `requestAnimationFrame()` to prevent jitter.

**View mode detection:**
```javascript
const mode = view.getMode?.() ?? view.mode;
// 'source' = edit mode (container: .cm-sizer)
// 'preview' = reading mode (container: .markdown-preview-section)
```

### Obsidian Compatibility
- Use Obsidian API only (no direct Electron access)
- Support edit mode, reading mode, Canvas, split panes, popout windows
- Settings use `--rich-foot-*` CSS custom properties

## Naming Conventions

- Variables/Functions: `camelCase`
- Classes: `PascalCase`
- Files: `lowercase-hyphenated.js`

## Common Modifications

**New exclusion type:** Modify `shouldExclude()` in `src/view-manager.js`

**New visual setting:**
1. Add default in `DEFAULT_SETTINGS` (`src/settings.js`)
2. Add CSS property in `updateCSSProperties()` (`src/main.js`)
3. Add UI control in settings tab

**Debug statements:** Use `console.log` only (not `console.debug` or `console.error`)
