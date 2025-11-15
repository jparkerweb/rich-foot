/**
 * RichFootViewManager
 * Manages view lifecycle, DOM attachment, and observers.
 * Ensures proper cleanup and prevents jitter/duplication.
 */

export class RichFootViewManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.observers = new Map(); // container -> observer
        this.pendingUpdates = new Map(); // container -> rafId
    }

    /**
     * Attach footer to a view
     * @param {MarkdownView} view - The view to attach to
     */
    async attachToView(view) {
        if (!view || !view.file) return;

        const file = view.file;

        // Check exclusions first
        if (this.shouldExclude(view, file)) {
            this.detachFromView(view);
            return;
        }

        // Get target container
        const container = this.getTargetContainer(view);
        if (!container) {
            return;
        }

        // Check if we need to update
        if (!this.shouldUpdate(container, file)) {
            return;
        }

        // Cancel any pending updates for this container
        this.cancelPendingUpdate(container);

        // Fetch data
        const data = await this.fetchData(file);

        // Render footer
        await this.renderFooter(view, container, file, data);
    }

    /**
     * Fetch all data needed for rendering
     * @private
     */
    async fetchData(file) {
        const { dataManager, settings } = this.plugin;

        const [backlinks, outlinks, dates] = await Promise.all([
            Promise.resolve(dataManager.getBacklinks(file)),
            dataManager.getOutlinks(file),
            Promise.resolve(dataManager.getDates(file, settings))
        ]);

        return { backlinks, outlinks, dates };
    }

    /**
     * Render footer in container
     * @private
     */
    async renderFooter(view, container, file, data) {
        // Schedule render using RAF to avoid jitter
        const rafId = requestAnimationFrame(() => {
            try {
                // Remove existing footer
                this.removeFooterFromContainer(container);

                // Create new footer
                const footer = this.plugin.renderer.createFooter(file, data);

                // Attach to container
                this.plugin.renderer.attachToContainer(container, footer);

                // Setup observer to detect removal
                this.setupObserver(container, view);

                // Adjust padding if in reading mode
                const mode = view.getMode?.() ?? view.mode;
                if (mode === 'preview') {
                    this.plugin.renderer.adjustFooterPadding(view);
                }
            } catch (error) {
                console.error('Rich Foot render error:', error);
            }

            // Clear from pending
            this.pendingUpdates.delete(container);
        });

        this.pendingUpdates.set(container, rafId);
    }

    /**
     * Check if should update footer
     * @private
     */
    shouldUpdate(container, file) {
        const existingFooter = container.querySelector('.rich-foot[data-rich-foot]');
        if (!existingFooter) return true;

        // Check if it's for the same file
        const currentPath = existingFooter.getAttribute('data-file-path');
        return currentPath !== file.path;
    }

    /**
     * Cancel pending RAF update
     * @private
     */
    cancelPendingUpdate(container) {
        const rafId = this.pendingUpdates.get(container);
        if (rafId) {
            cancelAnimationFrame(rafId);
            this.pendingUpdates.delete(container);
        }
    }

    /**
     * Detach footer from a view
     * @param {MarkdownView} view - The view to detach from
     */
    detachFromView(view) {
        if (!view || !view.contentEl) return;

        // Remove all footers in this view
        const footers = view.contentEl.querySelectorAll('.rich-foot[data-rich-foot]');
        footers.forEach(footer => footer.remove());

        // Disconnect observers for containers in this view
        const containers = this.getContainersInView(view);
        containers.forEach(container => {
            this.disconnectObserver(container);
        });
    }

    /**
     * Get all containers in a view that might have footers
     * @private
     */
    getContainersInView(view) {
        const containers = [];

        // Check for reading mode container
        const previewSection = view.contentEl.querySelector('.markdown-preview-section');
        if (previewSection) containers.push(previewSection);

        // Check for edit mode container
        const cmSizer = view.contentEl.querySelector('.cm-sizer');
        if (cmSizer) containers.push(cmSizer);

        return containers;
    }

    /**
     * Get the target container for footer attachment
     * @param {MarkdownView} view - The view
     * @returns {HTMLElement|null} Container element or null
     */
    getTargetContainer(view) {
        const mode = view.getMode?.() ?? view.mode;

        if (mode === 'preview') {
            // Find main preview section (not inside embedded notes)
            const previewSections = view.contentEl.querySelectorAll('.markdown-preview-section');
            for (const section of previewSections) {
                if (!section.closest('.internal-embed')) {
                    return section;
                }
            }
        } else if (mode === 'source' || mode === 'live') {
            return view.contentEl.querySelector('.cm-sizer');
        }

        return null;
    }

    /**
     * Check if file/view should be excluded
     * @param {MarkdownView} view - The view
     * @param {TFile} file - The file
     * @returns {boolean} True if should exclude
     */
    shouldExclude(view, file) {
        const { settings } = this.plugin;

        // Check excluded folders
        if (settings.excludedFolders?.some(folder => file.path.startsWith(folder))) {
            return true;
        }

        // Check frontmatter exclusion field
        if (settings.frontmatterExclusionField) {
            const cache = this.plugin.app.metadataCache.getFileCache(file);
            const frontmatterValue = cache?.frontmatter?.[settings.frontmatterExclusionField];
            if (this.isTruthy(frontmatterValue)) {
                return true;
            }
        }

        // Check excluded parent selectors
        if (settings.excludedParentSelectors?.length > 0) {
            if (this.hasExcludedParent(view)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if view has an excluded parent element
     * @private
     */
    hasExcludedParent(view) {
        const { settings } = this.plugin;

        return settings.excludedParentSelectors.some(selector => {
            try {
                let element = view.containerEl;
                while (element) {
                    if (element.matches?.(selector)) {
                        return true;
                    }
                    if (element.querySelector?.(selector)) {
                        return true;
                    }
                    element = element.parentElement;
                }
                return false;
            } catch (e) {
                console.error(`Invalid selector in Rich Foot settings: ${selector}`);
                return false;
            }
        });
    }

    /**
     * Check if value is truthy
     * @private
     */
    isTruthy(value) {
        if (!value) return false;
        const truthyValues = ['true', 'yes', '1', 'on'];
        return truthyValues.includes(String(value).toLowerCase());
    }

    /**
     * Remove footer from a container
     * @private
     */
    removeFooterFromContainer(container) {
        const footer = container.querySelector('.rich-foot[data-rich-foot]');
        if (footer) {
            footer.remove();
        }
    }

    /**
     * Setup optimized MutationObserver for a container
     * @private
     */
    setupObserver(container, view) {
        // Disconnect existing observer if any
        this.disconnectObserver(container);

        // Track pending timeout for debounced re-attach
        let timeoutId = null;
        let rafId = null;

        const observerCallback = () => {
            // Clear any existing timeout
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            // Debounce with longer delay to avoid conflicts with other plugins
            timeoutId = setTimeout(() => {
                if (rafId) cancelAnimationFrame(rafId);

                rafId = requestAnimationFrame(async () => {
                    rafId = null;
                    timeoutId = null;

                    // Verify container is still in the document
                    if (!container.isConnected) {
                        return;
                    }

                    // Check if footer exists
                    const footer = container.querySelector('.rich-foot[data-rich-foot]');
                    if (!footer) {
                        // Double-check after a small delay to avoid race conditions
                        // with other plugins (like Hover Editor)
                        setTimeout(() => {
                            const footerRecheck = container.querySelector('.rich-foot[data-rich-foot]');
                            if (!footerRecheck && container.isConnected) {
                                // Footer is truly missing, re-attach
                                try {
                                    this.attachToView(view);
                                } catch (error) {
                                    console.error('Rich Foot observer re-attach error:', error);
                                }
                            }
                        }, 100);
                    }
                });
            }, 150); // Longer debounce delay to let other plugins settle
        };

        // Create observer with optimized configuration
        const observer = new MutationObserver((mutations) => {
            // Only react to mutations that actually removed our footer
            const footerRemoved = mutations.some(mutation => {
                if (mutation.type !== 'childList' || mutation.removedNodes.length === 0) {
                    return false;
                }

                // Check if any removed node is or contains our footer
                for (const node of mutation.removedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList?.contains('rich-foot') ||
                            node.querySelector?.('.rich-foot[data-rich-foot]')) {
                            return true;
                        }
                    }
                }
                return false;
            });

            if (footerRemoved) {
                observerCallback();
            }
        });

        // Observe only direct children changes
        observer.observe(container, {
            childList: true,
            subtree: false // Only watch direct children for better performance
        });

        // Store observer with cleanup function
        this.observers.set(container, {
            observer,
            cleanup: () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (rafId) cancelAnimationFrame(rafId);
            }
        });
    }

    /**
     * Disconnect observer for a container
     * @param {HTMLElement} container - The container
     */
    disconnectObserver(container) {
        const observerData = this.observers.get(container);
        if (observerData) {
            // Call cleanup function to clear timeouts/RAF
            if (observerData.cleanup) {
                observerData.cleanup();
            }
            // Disconnect the observer
            if (observerData.observer) {
                observerData.observer.disconnect();
            }
            this.observers.delete(container);
        }

        // Also cancel any pending RAF updates
        this.cancelPendingUpdate(container);
    }

    /**
     * Disconnect all observers
     */
    disconnectAllObservers() {
        // Disconnect all observers
        this.observers.forEach((observerData, container) => {
            // Call cleanup function to clear timeouts/RAF
            if (observerData.cleanup) {
                observerData.cleanup();
            }
            // Disconnect the observer
            if (observerData.observer) {
                observerData.observer.disconnect();
            }
            this.cancelPendingUpdate(container);
        });

        this.observers.clear();
        this.pendingUpdates.clear();
    }
}
