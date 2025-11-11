# Rich Foot Plugin - Refactoring Specification

## Executive Summary

This specification outlines a comprehensive refactoring of the Rich Foot Obsidian plugin to implement modern best practices, improve performance, eliminate jitter, ensure proper cleanup, and maximize compatibility with other plugins.

## Current Plugin Analysis

### Core Functionality
- **Purpose**: Adds intelligent footer to notes showing backlinks, outlinks, and dates
- **Features**:
  - Backlinks display (notes linking TO current note)
  - Outlinks display (notes current note links TO)
  - Combined links view
  - Creation and modification dates (from filesystem or frontmatter)
  - Extensive customization (colors, opacity, border styles, date formats)
  - Exclusion rules (folders, frontmatter fields, CSS selectors)
  - Footnote link detection
  - Embedded notes support
  - Hover preview integration

### Current Issues Identified

1. **Performance & Jitter**
   - Direct DOM manipulation without requestAnimationFrame
   - Multiple synchronous updates on events
   - Inefficient MutationObserver (watches entire subtree)
   - Repeated selector queries without caching
   - adjustFooterPadding uses setTimeout instead of RAF

2. **DOM Cleanup**
   - MutationObserver not always properly disconnected
   - Manual event off() calls in onunload (should use registerEvent exclusively)
   - Potential for orphaned observers on view changes
   - No data attributes to track managed elements

3. **Code Quality**
   - Date parsing logic duplicated (created/modified)
   - Link creation code duplicated (backlinks/outlinks/combined)
   - Long createRichFoot method (230+ lines)
   - Mixed concerns (rendering + data fetching + event handling)
   - No clear separation of edit vs reading mode logic

4. **Compatibility**
   - Hover preview handling in edit mode only
   - Potential conflicts with plugins that modify view structure
   - Manual timeout-based hover cleanup (unreliable)

## Refactoring Goals

### 1. Performance Optimization

**Use requestAnimationFrame for Visual Updates**
- All DOM modifications that affect layout should use RAF
- Prevents layout thrashing and visual jitter
- Ensures updates happen during browser paint cycle

**Optimize MutationObserver**
- Use specific observation targets (not entire subtree)
- Debounce observer callbacks with RAF
- Disconnect observers immediately when no longer needed
- Use .some() instead of iterating all mutations

**Minimize Reflows**
- Batch DOM reads and writes
- Cache frequently accessed elements
- Use CSS transforms for animations
- Read layout properties before writing

**Smart Update Detection**
- Track last rendered state with data attributes
- Skip updates if content hasn't changed
- Debounce only when necessary (edit mode)

### 2. Proper Resource Cleanup

**Use Obsidian Registration Methods**
- registerEvent() for all workspace/metadata events
- registerDomEvent() for DOM events on persistent elements
- Never manually call .off() in onunload (automatic cleanup)

**Observer Management**
- Store observers in Set for easy tracking
- Disconnect all observers in onunload
- Create new observers per view, not shared

**Data Attribute Tracking**
- Use data-rich-foot-id to track managed elements
- Use data-rich-foot-version to detect stale elements
- Clean up by data attribute, not className alone

### 3. Code Architecture

**Modular Structure**
```javascript
class RichFootPlugin {
  // Core lifecycle
  onload()
  onunload()

  // Rendering (separate class: RichFootRenderer)
  - createFooterElement(file)
  - createLinksSection(links, type)
  - createDatesSection(file)
  - createLinkElement(linkPath, type)

  // Data fetching (separate class: RichFootDataManager)
  - getBacklinks(file)
  - getOutlinks(file)
  - getDates(file)
  - parseDate(value)

  // View management (separate class: RichFootViewManager)
  - attachToView(view)
  - detachFromView(view)
  - getTargetContainer(view)
  - shouldExclude(view)

  // Event handling
  - handleLayoutChange()
  - handleFileOpen()
  - handleMetadataChange()

  // Settings
  - loadSettings()
  - saveSettings()
  - updateCSSProperties()
}
```

**Separation of Concerns**
- RichFootRenderer: Pure rendering logic, no data fetching
- RichFootDataManager: Data collection and parsing
- RichFootViewManager: View lifecycle and DOM attachment
- Settings remain in separate file

**DRY Principles**
- Single date parsing function with format detection
- Single link creation function with type parameter
- Shared validation logic
- Reusable CSS property updater

### 4. Compatibility & Robustness

**Hover Preview Integration**
- Use Obsidian's built-in hover mechanisms
- Support both edit and reading modes
- Work with community hover plugins
- Proper event delegation

**View Lifecycle Awareness**
- Detect view mode changes properly
- Handle Canvas embeds correctly
- Work with split panes and popout windows
- Respect embedded note boundaries

**Error Handling**
- Try-catch around all async operations
- Graceful degradation on errors
- Console logging for debugging
- Validation of all user inputs

## Detailed Implementation Plan

### Phase 1: Core Architecture Refactoring

#### File: src/data-manager.js (NEW)
```javascript
export class RichFootDataManager {
  constructor(app) {
    this.app = app;
  }

  async getBacklinks(file) {
    // Return Map of backlink paths
  }

  async getOutlinks(file) {
    // Return Set of outlink paths
    // Include: links, embeds, frontmatter, footnotes
  }

  getDates(file, settings) {
    // Return { created, modified } with proper parsing
  }

  parseDate(value, format) {
    // Universal date parser with format detection
  }

  processFootnotes(content, file) {
    // Extract footnote links
  }
}
```

#### File: src/renderer.js (NEW)
```javascript
export class RichFootRenderer {
  constructor(plugin) {
    this.plugin = plugin;
  }

  createFooter(file, data) {
    // Main factory method
    // Returns DocumentFragment for optimal performance
  }

  createLinksSection(links, type) {
    // Type: 'backlinks' | 'outlinks' | 'combined'
  }

  createLinkElement(linkPath, metadata) {
    // Single link element with proper classes and handlers
  }

  createDatesSection(dates) {
    // Date display with formatted output
  }

  attachToContainer(container, footer) {
    // RAF-based attachment with fade-in
  }
}
```

#### File: src/view-manager.js (NEW)
```javascript
export class RichFootViewManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.observers = new Map(); // viewId -> observer
    this.attachedViews = new Set(); // viewIds
  }

  async attachToView(view) {
    // Check exclusions, get container, render, observe
  }

  detachFromView(view) {
    // Remove footer, disconnect observer
  }

  getTargetContainer(view) {
    // Returns container based on mode (.cm-sizer or .markdown-preview-section)
  }

  shouldExclude(view) {
    // Check all exclusion rules
  }

  createObserver(container, view) {
    // Optimized MutationObserver with RAF debouncing
  }

  disconnectObserver(viewId) {
    // Clean disconnect
  }

  disconnectAllObservers() {
    // Cleanup all
  }
}
```

### Phase 2: Main Plugin Refactoring

#### File: src/main.js (REFACTORED)

**Key Changes:**
1. Import and instantiate manager classes
2. Use registerEvent() exclusively
3. RAF-based updates
4. Proper state tracking
5. Simplified event handlers

```javascript
class RichFootPlugin extends Plugin {
  async onload() {
    // Initialize managers
    this.dataManager = new RichFootDataManager(this.app);
    this.renderer = new RichFootRenderer(this);
    this.viewManager = new RichFootViewManager(this);

    // Load settings
    await this.loadSettings();
    this.updateCSSProperties();

    // Show release notes
    await this.checkVersion();

    // Setup settings tab
    this.addSettingTab(new RichFootSettingTab(this.app, this));

    // Create update function
    this.updateActiveView = this.createUpdateFunction();

    // Wait for layout ready
    this.app.workspace.onLayoutReady(() => {
      this.registerWorkspaceEvents();
      this.updateActiveView();
    });
  }

  createUpdateFunction() {
    let rafId = null;
    return (immediate = false) => {
      if (rafId) cancelAnimationFrame(rafId);

      const update = async () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        try {
          await this.viewManager.attachToView(view);
        } catch (error) {
          console.error('Rich Foot update error:', error);
        }
      };

      if (immediate) {
        update();
      } else {
        rafId = requestAnimationFrame(update);
      }
    };
  }

  registerWorkspaceEvents() {
    // Use registerEvent for automatic cleanup
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.updateActiveView(true);
      })
    );

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        const isEditMode = this.isEditMode();
        this.updateActiveView(!isEditMode);
      })
    );

    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        this.updateActiveView(true);
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', () => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.updateActiveView();
        }, this.settings.updateDelay);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (this.shouldUpdateForMetadataChange(file)) {
          this.updateActiveView();
        }
      })
    );
  }

  onunload() {
    // Clean up managers
    this.viewManager.disconnectAllObservers();

    // Remove all footers
    document.querySelectorAll('[data-rich-foot]').forEach(el => el.remove());

    // Clear any pending updates
    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    // Events are auto-cleaned by registerEvent
  }
}
```

### Phase 3: CSS Optimization

**Key Improvements:**
1. Use `will-change` for animated properties
2. Use `contain` for layout containment
3. Avoid expensive selectors
4. Use CSS custom properties efficiently
5. Minimize repaints

```css
.rich-foot {
  /* Layout containment for performance */
  contain: layout style;

  /* Optimize animations */
  will-change: opacity;

  /* Prevent layout shift */
  min-height: 0;
}

/* Use transform for animations (GPU accelerated) */
.rich-foot--hidden {
  opacity: 0;
  transform: translateY(-2px);
}

.rich-foot:not(.rich-foot--hidden) {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 600ms ease-in-out, transform 600ms ease-in-out;
}
```

### Phase 4: Settings Improvements

**Enhancements:**
1. Input validation
2. Debounced color picker updates
3. Better folder selection UX
4. Setting change batching

### Phase 5: Testing & Validation

**Test Cases:**
1. Multiple rapid view changes (no jitter)
2. Large vault with many backlinks (performance)
3. Hover preview interaction (no interference)
4. Canvas embeds (proper exclusion)
5. Split panes and popout windows (correct rendering)
6. Theme changes (CSS updates properly)
7. Plugin reload (clean state)
8. Settings changes (immediate updates)
9. Frontmatter date parsing (all formats)
10. Footnote link detection (inline and reference)

## Performance Benchmarks

### Target Metrics
- Initial render: < 16ms (60fps)
- Update on edit: < 100ms (with debounce)
- Update on view change: < 16ms
- Memory: No leaks over 1000 view changes
- Observer callbacks: < 5ms

### Optimization Techniques
1. **RAF Scheduling**: All visual updates in RAF
2. **Batch DOM Operations**: Read then write
3. **Event Delegation**: One handler per view max
4. **Selector Caching**: Store frequently queried elements
5. **Lazy Rendering**: Only render visible elements
6. **Smart Diffing**: Don't update if content unchanged

## Compatibility Matrix

| Feature | Current | Refactored |
|---------|---------|------------|
| Hover Editor Plugin | Partial | Full |
| Page Preview | Edit only | All modes |
| Canvas | Works | Optimized |
| Split Panes | Works | Optimized |
| Popout Windows | Works | Optimized |
| Minimal Theme | Works | Works |
| Mobile | Works | Works |

## Migration & Backwards Compatibility

**Settings Migration:**
- All existing settings remain compatible
- No breaking changes to user configuration
- New features are opt-in

**Version Bump:**
- Minor version bump (1.10.9 → 1.11.0)
- Update release notes with improvements

## Code Style Guidelines

**Vanilla JavaScript:**
- ES6+ features (arrow functions, destructuring, async/await)
- No TypeScript
- No external dependencies (except build tools)
- Consistent formatting (2-space indentation)

**Naming Conventions:**
- camelCase for variables and functions
- PascalCase for classes
- UPPER_SNAKE_CASE for constants
- Descriptive names (no abbreviations)

**Comments:**
- JSDoc for all public methods
- Inline comments for complex logic
- Section headers for code organization

**Error Handling:**
- Try-catch for all async operations
- Graceful degradation
- User-friendly error messages (via Notice)

## Success Criteria

✅ No visual jitter during view changes
✅ Zero memory leaks after 1000 operations
✅ All observers properly cleaned up
✅ Compatible with major hover plugins
✅ Performance within target metrics
✅ Code maintainability improved (lower complexity)
✅ Test coverage for core functionality
✅ User settings preserved on update

## Implementation Timeline

1. **Phase 1**: Core Architecture (Manager Classes) - 2 hours
2. **Phase 2**: Main Plugin Refactor - 2 hours
3. **Phase 3**: CSS Optimization - 1 hour
4. **Phase 4**: Settings Improvements - 1 hour
5. **Phase 5**: Testing & Validation - 2 hours

**Total Estimated Time**: 8 hours of focused development

## Risk Assessment

**Low Risk:**
- CSS changes (isolated, easily reverted)
- Code structure refactoring (no API changes)

**Medium Risk:**
- Observer pattern changes (need thorough testing)
- RAF timing (may need adjustment per environment)

**Mitigation:**
- Comprehensive testing before release
- Feature flags for new observer logic
- Fallback to current behavior on error

## Conclusion

This refactoring will transform Rich Foot into a best-in-class Obsidian plugin with modern architecture, optimal performance, and maximum compatibility. The changes maintain full backwards compatibility while providing a foundation for future enhancements.
