/**
 * RichFootRenderer
 * Handles all DOM rendering operations for the Rich Foot plugin.
 * Creates and manages the footer elements with optimal performance.
 */

export class RichFootRenderer {
    constructor(plugin) {
        this.plugin = plugin;
    }

    /**
     * Create the complete footer element for a file
     * @param {TFile} file - The file to create footer for
     * @param {Object} data - Pre-fetched data { backlinks, outlinks, dates }
     * @returns {HTMLElement} The footer element
     */
    createFooter(file, data) {
        const { backlinks, outlinks, dates } = data;
        const { settings } = this.plugin;

        // Create main footer container
        const richFoot = createDiv({ cls: 'rich-foot rich-foot--hidden' });
        richFoot.setAttribute('data-rich-foot', 'true');
        richFoot.setAttribute('data-file-path', file.path);

        // Add dashed line separator
        richFoot.createDiv({ cls: 'rich-foot--dashed-line' });

        // Render links section
        if (settings.combineLinks) {
            this.createCombinedLinksSection(richFoot, file, backlinks, outlinks);
        } else {
            if (settings.showBacklinks) {
                this.createLinksSection(richFoot, file, backlinks, 'backlinks');
            }
            if (settings.showOutlinks) {
                this.createLinksSection(richFoot, file, outlinks, 'outlinks');
            }
        }

        // Render dates section
        if (settings.showDates && dates) {
            this.createDatesSection(richFoot, dates);
        }

        return richFoot;
    }

    /**
     * Create combined links section (backlinks + outlinks)
     * @private
     */
    createCombinedLinksSection(container, file, backlinks, outlinks) {
        if (backlinks.size === 0 && outlinks.size === 0) return;

        const linksDiv = container.createDiv({ cls: 'rich-foot--links' });
        const linksUl = linksDiv.createEl('ul');

        const processedLinks = new Set();

        // Process backlinks first
        for (const [linkPath] of backlinks) {
            if (!linkPath.endsWith('.md')) continue;
            processedLinks.add(linkPath);

            const metadata = {
                isBacklink: true,
                isOutlink: outlinks.has(linkPath)
            };

            const li = linksUl.createEl('li');
            this.createLinkElement(li, file, linkPath, metadata);
        }

        // Process remaining outlinks
        for (const linkPath of outlinks) {
            if (processedLinks.has(linkPath)) continue;

            const metadata = {
                isBacklink: false,
                isOutlink: true
            };

            const li = linksUl.createEl('li');
            this.createLinkElement(li, file, linkPath, metadata);
        }

        // Remove if empty
        if (linksUl.childElementCount === 0) {
            linksDiv.remove();
        }
    }

    /**
     * Create links section (backlinks or outlinks)
     * @private
     */
    createLinksSection(container, file, links, type) {
        const linksArray = type === 'backlinks'
            ? Array.from(links.keys()).filter(path => path.endsWith('.md'))
            : Array.from(links);

        if (linksArray.length === 0) return;

        const className = `rich-foot--${type}`;
        const linksDiv = container.createDiv({ cls: className });
        const linksUl = linksDiv.createEl('ul');

        for (const linkPath of linksArray) {
            const li = linksUl.createEl('li');
            const metadata = {
                isBacklink: type === 'backlinks',
                isOutlink: type === 'outlinks'
            };
            this.createLinkElement(li, file, linkPath, metadata);
        }

        if (linksUl.childElementCount === 0) {
            linksDiv.remove();
        }
    }

    /**
     * Create a single link element
     * @private
     */
    createLinkElement(container, file, linkPath, metadata) {
        const displayName = linkPath.split('/').pop().slice(0, -3);
        const isEditMode = this.isEditMode();

        const link = container.createEl('a', {
            href: linkPath,
            text: displayName,
            cls: isEditMode ? 'cm-hmd-internal-link cm-underline' : 'internal-link'
        });

        // Set data attributes
        link.dataset.href = linkPath;
        link.dataset.sourcePath = file.path;
        if (metadata.isBacklink) link.dataset.isBacklink = 'true';
        if (metadata.isOutlink) link.dataset.isOutlink = 'true';

        // Setup event handlers
        this.setupLinkHandlers(link, linkPath, file);

        return link;
    }

    /**
     * Setup event handlers for a link element
     * @private
     */
    setupLinkHandlers(link, linkPath, file) {
        // Click handler - navigate to link
        link.addEventListener('click', (event) => {
            event.preventDefault();
            this.plugin.app.workspace.openLinkText(linkPath, file.path);
        });

        // Hover preview handlers (only in edit mode)
        if (this.isEditMode()) {
            this.setupHoverPreview(link, linkPath, file);
        }
    }

    /**
     * Setup hover preview for a link
     * @private
     */
    setupHoverPreview(link, linkPath, file) {
        const pagePreviewPlugin = this.plugin.app.internalPlugins.plugins['page-preview'];
        if (!pagePreviewPlugin?.enabled) return;

        link.addEventListener('mouseover', (mouseEvent) => {
            const previewPlugin = pagePreviewPlugin.instance;
            if (previewPlugin?.onLinkHover) {
                previewPlugin.onLinkHover(mouseEvent, link, linkPath, file.path);
            }
        });

        // Hover leave is handled by Obsidian's preview system
    }

    /**
     * Create dates section
     * @private
     */
    createDatesSection(container, dates) {
        const datesWrapper = container.createDiv({ cls: 'rich-foot--dates-wrapper' });

        // Modified date
        datesWrapper.createDiv({
            cls: 'rich-foot--modified-date',
            text: dates.modified
        });

        // Created date
        datesWrapper.createDiv({
            cls: 'rich-foot--created-date',
            text: dates.created
        });
    }

    /**
     * Attach footer to container with fade-in animation using RAF
     * @param {HTMLElement} container - Target container
     * @param {HTMLElement} footer - Footer element
     */
    attachToContainer(container, footer) {
        // Append to DOM
        container.appendChild(footer);

        // Use RAF for smooth fade-in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                footer.removeClass('rich-foot--hidden');
            });
        });
    }

    /**
     * Adjust footer padding in reading mode for optimal positioning
     * @param {HTMLElement} view - The markdown view
     */
    adjustFooterPadding(view) {
        requestAnimationFrame(() => {
            const readingView = view.contentEl.querySelector('.markdown-reading-view');
            if (!readingView) return;

            const preview = readingView.querySelector('.markdown-preview-view');
            const previewSizer = readingView.querySelector('.markdown-preview-sizer');
            const footer = previewSizer?.querySelector('.rich-foot[data-rich-foot]');

            if (!preview || !previewSizer || !footer) return;

            // Calculate available space
            const contentHeight = previewSizer.offsetHeight - footer.offsetHeight;
            const availableSpace = preview.offsetHeight - contentHeight - footer.offsetHeight - 85;

            // Apply padding based on available space
            if (availableSpace > 20) {
                readingView.style.setProperty('--rich-foot-top-padding', `${availableSpace}px`);
                readingView.style.setProperty('--rich-foot-margin-bottom', '0');
            } else {
                readingView.style.setProperty('--rich-foot-top-padding', '10px');
                readingView.style.setProperty('--rich-foot-margin-bottom', '20px');
            }
        });
    }

    /**
     * Check if current view is in edit mode
     * @private
     */
    isEditMode() {
        const { MarkdownView } = require('obsidian');
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return false;
        const mode = activeView.getMode?.() ?? activeView.mode;
        return mode === 'source';
    }
}
