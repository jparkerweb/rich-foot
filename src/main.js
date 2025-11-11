import { Plugin, MarkdownView } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { releaseNotes } from 'virtual:release-notes';
import { RichFootSettingTab, DEFAULT_SETTINGS } from './settings';
import { RichFootDataManager } from './data-manager';
import { RichFootRenderer } from './renderer';
import { RichFootViewManager } from './view-manager';

/**
 * Main Rich Foot Plugin
 * Adds intelligent footers to notes with backlinks, outlinks, and dates
 */
class RichFootPlugin extends Plugin {
    async onload() {
        // Load settings first
        await this.loadSettings();

        // Initialize manager instances
        this.dataManager = new RichFootDataManager(this.app);
        this.renderer = new RichFootRenderer(this);
        this.viewManager = new RichFootViewManager(this);

        // Apply CSS custom properties
        this.updateCSSProperties();

        // Check version and show release notes if needed
        await this.checkVersion();

        // Add settings tab
        this.addSettingTab(new RichFootSettingTab(this.app, this));

        // Initialize update tracking
        this.debounceTimer = null;
        this.updateRafId = null;

        // Wait for layout ready before registering events
        this.app.workspace.onLayoutReady(() => {
            this.registerWorkspaceEvents();

            // Initial update
            this.updateActiveView(true);
        });
    }

    /**
     * Register all workspace events using proper Obsidian registration
     */
    registerWorkspaceEvents() {
        // Layout changes (immediate update)
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.updateActiveView(true);
            })
        );

        // Active leaf changes (immediate in reading mode, debounced in edit mode)
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', () => {
                const isEditMode = this.isEditMode();
                this.updateActiveView(!isEditMode);
            })
        );

        // File open (always immediate)
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.updateActiveView(true);
            })
        );

        // Mode change (immediate)
        this.registerEvent(
            this.app.workspace.on('editor-change', () => {
                // Debounce in edit mode for performance
                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                }

                this.debounceTimer = setTimeout(() => {
                    this.updateActiveView();
                }, this.settings.updateDelay);
            })
        );

        // Metadata changes (frontmatter updates)
        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                if (this.shouldUpdateForMetadataChange(file)) {
                    const isEditMode = this.isEditMode();
                    this.updateActiveView(!isEditMode);
                }
            })
        );
    }

    /**
     * Update the active view's footer
     * @param {boolean} immediate - If true, update immediately; otherwise use RAF
     */
    updateActiveView(immediate = false) {
        // Cancel any pending RAF update
        if (this.updateRafId) {
            cancelAnimationFrame(this.updateRafId);
            this.updateRafId = null;
        }

        const performUpdate = async () => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!view) return;

            try {
                await this.viewManager.attachToView(view);
            } catch (error) {
                console.error('Rich Foot update error:', error);
            }
        };

        if (immediate) {
            performUpdate();
        } else {
            this.updateRafId = requestAnimationFrame(performUpdate);
        }
    }

    /**
     * Check if should update for metadata change
     * @private
     */
    shouldUpdateForMetadataChange(file) {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || activeView.file !== file) return false;

        const cache = this.app.metadataCache.getFileCache(file);
        if (!cache?.frontmatter) return false;

        // Check if custom date properties are present
        const hasCustomCreated = this.settings.customCreatedDateProp &&
            this.settings.customCreatedDateProp in cache.frontmatter;
        const hasCustomModified = this.settings.customModifiedDateProp &&
            this.settings.customModifiedDateProp in cache.frontmatter;

        return hasCustomCreated || hasCustomModified;
    }

    /**
     * Check if current view is in edit mode
     * @private
     */
    isEditMode() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return false;
        const mode = activeView.getMode?.() ?? activeView.mode;
        return mode === 'source';
    }

    /**
     * Update all CSS custom properties
     */
    updateCSSProperties() {
        const properties = {
            '--rich-foot-border-width': `${this.settings.borderWidth}px`,
            '--rich-foot-border-style': this.settings.borderStyle,
            '--rich-foot-border-opacity': this.settings.borderOpacity,
            '--rich-foot-border-radius': `${this.settings.borderRadius}px`,
            '--rich-foot-dates-opacity': this.settings.datesOpacity,
            '--rich-foot-links-opacity': this.settings.linksOpacity,
            '--rich-foot-date-color': this.settings.dateColor,
            '--rich-foot-border-color': this.settings.borderColor,
            '--rich-foot-link-color': this.settings.linkColor,
            '--rich-foot-link-background': this.settings.linkBackgroundColor,
            '--rich-foot-link-border-color': this.settings.linkBorderColor
        };

        Object.entries(properties).forEach(([property, value]) => {
            document.documentElement.style.setProperty(property, value);
        });
    }

    /**
     * Update rich foot (called from settings)
     */
    async updateRichFoot() {
        this.updateCSSProperties();
        this.updateActiveView(true);
    }

    /**
     * Load plugin settings
     */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

        // Ensure excludedFolders is always an array
        if (!Array.isArray(this.settings.excludedFolders)) {
            this.settings.excludedFolders = [];
        }

        // Ensure excludedParentSelectors is always an array
        if (!Array.isArray(this.settings.excludedParentSelectors)) {
            this.settings.excludedParentSelectors = [];
        }
    }

    /**
     * Save plugin settings
     */
    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Check version and show release notes
     */
    async checkVersion() {
        const currentVersion = this.manifest.version;
        const lastVersion = this.settings.lastVersion;
        const shouldShow = this.settings.showReleaseNotes &&
            (!lastVersion || lastVersion !== currentVersion);

        if (shouldShow) {
            const notes = await this.getReleaseNotes(currentVersion);

            // Show the modal
            new ReleaseNotesModal(this.app, this, currentVersion, notes).open();

            // Update the last shown version
            this.settings.lastVersion = currentVersion;
            await this.saveSettings();
        }
    }

    /**
     * Get release notes
     */
    async getReleaseNotes(version) {
        return releaseNotes;
    }

    /**
     * Plugin cleanup
     */
    onunload() {
        // Disconnect all observers
        if (this.viewManager) {
            this.viewManager.disconnectAllObservers();
        }

        // Clear any pending timeouts
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Clear any pending RAF updates
        if (this.updateRafId) {
            cancelAnimationFrame(this.updateRafId);
            this.updateRafId = null;
        }

        // Remove all rich foot elements
        document.querySelectorAll('[data-rich-foot]').forEach(el => el.remove());

        // Events are automatically cleaned up via registerEvent
    }
}

export default RichFootPlugin;
