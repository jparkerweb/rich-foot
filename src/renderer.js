/**
 * RichFootRenderer
 * Handles all DOM rendering operations for the Rich Foot plugin.
 * Creates and manages the footer elements with optimal performance.
 */

import { MarkdownView } from 'obsidian';

// Monotonic counter used to give each "Show More" toggle a unique target id
// for aria-controls (multiple footers can be on-screen across panes/notes).
let showMoreIdCounter = 0;

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
        const processedLinks = new Set();
        const backlinkItems = [];
        const outlinkOnlyItems = [];

        // Process backlinks first
        for (const [linkPath] of backlinks) {
            if (!linkPath.endsWith('.md')) continue;
            processedLinks.add(linkPath);
            backlinkItems.push({
                linkPath,
                isBacklink: true,
                isOutlink: outlinks.has(linkPath)
            });
        }

        // Process remaining outlinks
        for (const linkPath of outlinks) {
            if (processedLinks.has(linkPath)) continue;
            outlinkOnlyItems.push({
                linkPath,
                isBacklink: false,
                isOutlink: true
            });
        }

        if (backlinkItems.length === 0 && outlinkOnlyItems.length === 0) {
            linksDiv.remove();
            return;
        }

        if (this.plugin.settings.groupBacklinks) {
            // Group the backlink-sourced items; outlink-only items don't have
            // a "linking note" to group by, so they get their own trailing group.
            const groupEntries = this.plugin.dataManager.groupItemsByPath(
                backlinkItems,
                this.plugin.settings
            );
            if (outlinkOnlyItems.length > 0) {
                groupEntries.push(['Outlinks', outlinkOnlyItems]);
            }
            this.renderGroupedLinks(linksDiv, file, groupEntries);
        } else {
            this.renderFlatLinks(linksDiv, file, [...backlinkItems, ...outlinkOnlyItems]);
        }

        // Remove if nothing ended up rendering (e.g. all groups empty)
        if (linksDiv.childElementCount === 0) {
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

        const items = linksArray.map(linkPath => ({
            linkPath,
            isBacklink: type === 'backlinks',
            isOutlink: type === 'outlinks'
        }));

        if (type === 'backlinks' && this.plugin.settings.groupBacklinks) {
            const groupEntries = this.plugin.dataManager.groupItemsByPath(items, this.plugin.settings);
            this.renderGroupedLinks(linksDiv, file, groupEntries);
        } else {
            this.renderFlatLinks(linksDiv, file, items);
        }

        if (linksDiv.childElementCount === 0) {
            linksDiv.remove();
        }
    }

    /**
     * Render a flat (ungrouped) list of link items into a single <ul>
     * @private
     * @param {HTMLElement} container - Element to render the <ul> into
     * @param {TFile} file - The note the footer belongs to
     * @param {Array<Object>} items - Items with linkPath/isBacklink/isOutlink
     */
    renderFlatLinks(container, file, items) {
        if (items.length === 0) return;

        const linksUl = container.createEl('ul');
        for (const item of items) {
            const li = linksUl.createEl('li');
            this.createLinkElement(li, file, item.linkPath, item);
        }

        if (linksUl.childElementCount === 0) {
            linksUl.remove();
            return;
        }

        // Apply "Show More" limit if enabled
        this.applyLinkLimit(linksUl);
    }

    /**
     * Render grouped link items, each group as its own labeled sub-list
     * @private
     * @param {HTMLElement} container - Element to render groups into
     * @param {TFile} file - The note the footer belongs to
     * @param {Array<[string, Array<Object>]>} groupEntries - [groupName, items] pairs
     */
    renderGroupedLinks(container, file, groupEntries) {
        for (const [groupName, groupItems] of groupEntries) {
            if (!groupItems || groupItems.length === 0) continue;

            const groupDiv = container.createDiv({ cls: 'rich-foot--group' });
            groupDiv.createDiv({ cls: 'rich-foot--group-title', text: groupName });

            const linksUl = groupDiv.createEl('ul');
            for (const item of groupItems) {
                const li = linksUl.createEl('li');
                this.createLinkElement(li, file, item.linkPath, item);
            }

            if (linksUl.childElementCount === 0) {
                groupDiv.remove();
                continue;
            }

            // Apply "Show More" limit per-group if enabled
            this.applyLinkLimit(linksUl);
        }
    }

    /**
     * Limit the number of visible links, hiding the surplus behind a
     * toggleable "Show More (X)" button.
     * @private
     * @param {HTMLElement} linksUl - The <ul> containing link <li> elements
     */
    applyLinkLimit(linksUl) {
        const { settings } = this.plugin;
        if (!settings.limitLinks) return;

        const limit = Math.floor(Number(settings.linksLimit));
        if (!Number.isFinite(limit) || limit < 1) return;

        const items = Array.from(linksUl.children);
        if (items.length <= limit) return;

        const surplus = items.length - limit;

        // Give the list a unique id so the toggle can reference it via aria-controls
        const listId = `rich-foot-links-${++showMoreIdCounter}`;
        linksUl.id = listId;

        // Hide the surplus items initially
        for (let i = limit; i < items.length; i++) {
            items[i].addClass('rich-foot--link-hidden');
        }

        // Create the toggle button — a native <button> is keyboard-accessible and
        // announced correctly by screen readers without a role override.
        const toggleLi = linksUl.createEl('li', { cls: 'rich-foot--show-more-li' });
        const toggleBtn = toggleLi.createEl('button', {
            cls: 'rich-foot--show-more',
            text: `Show More (${surplus})`,
            attr: {
                type: 'button',
                'aria-expanded': 'false',
                'aria-controls': listId
            }
        });

        let expanded = false;
        toggleBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            expanded = !expanded;
            for (let i = limit; i < items.length; i++) {
                items[i].toggleClass('rich-foot--link-hidden', !expanded);
            }
            toggleBtn.setText(expanded ? 'Show Less' : `Show More (${surplus})`);
            toggleBtn.setAttribute('aria-expanded', String(expanded));
        });
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
     * Check if current view is in edit mode
     * @private
     */
    isEditMode() {
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return false;
        const mode = activeView.getMode?.() ?? activeView.mode;
        return mode === 'source';
    }
}
