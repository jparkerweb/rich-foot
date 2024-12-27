import { Plugin, MarkdownView, debounce } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { releaseNotes } from 'virtual:release-notes';
import { RichFootSettingTab, DEFAULT_SETTINGS } from './settings';
import { formatDate } from './utils';

class RichFootSettings {
    constructor() {
        this.excludedFolders = [];
        this.showBacklinks = true;
        this.showOutlinks = false;
        this.showDates = true;
        this.showReleaseNotes = true;
        this.lastVersion = null;
        this.borderWidth = DEFAULT_SETTINGS.borderWidth;
        this.borderStyle = DEFAULT_SETTINGS.borderStyle;
        this.borderOpacity = DEFAULT_SETTINGS.borderOpacity;
        this.borderRadius = DEFAULT_SETTINGS.borderRadius;
        this.datesOpacity = DEFAULT_SETTINGS.datesOpacity;
        this.linksOpacity = DEFAULT_SETTINGS.linksOpacity;
        this.borderColor = DEFAULT_SETTINGS.borderColor;
        this.linkColor = DEFAULT_SETTINGS.linkColor;
        this.linkBackgroundColor = DEFAULT_SETTINGS.linkBackgroundColor;
        this.linkBorderColor = DEFAULT_SETTINGS.linkBorderColor;
        this.customCreatedDateProp = DEFAULT_SETTINGS.customCreatedDateProp;
        this.customModifiedDateProp = DEFAULT_SETTINGS.customModifiedDateProp;
        this.dateDisplayFormat = DEFAULT_SETTINGS.dateDisplayFormat;
        this.combineLinks = DEFAULT_SETTINGS.combineLinks;
        this.updateDelay = DEFAULT_SETTINGS.updateDelay;
        this.excludedParentSelectors = [];
        this.frontmatterExclusionField = '';
    }
}

class RichFootPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        // Set initial CSS custom properties
        document.documentElement.style.setProperty('--rich-foot-border-width', `${this.settings.borderWidth}px`);
        document.documentElement.style.setProperty('--rich-foot-border-style', this.settings.borderStyle);
        document.documentElement.style.setProperty('--rich-foot-border-opacity', this.settings.borderOpacity);
        document.documentElement.style.setProperty('--rich-foot-border-radius', `${this.settings.borderRadius}px`);
        document.documentElement.style.setProperty('--rich-foot-dates-opacity', this.settings.datesOpacity);
        document.documentElement.style.setProperty('--rich-foot-links-opacity', this.settings.linksOpacity);
        document.documentElement.style.setProperty('--rich-foot-date-color', this.settings.dateColor);
        document.documentElement.style.setProperty('--rich-foot-border-color', this.settings.borderColor);
        document.documentElement.style.setProperty('--rich-foot-link-color', this.settings.linkColor);
        document.documentElement.style.setProperty('--rich-foot-link-background', this.settings.linkBackgroundColor);
        document.documentElement.style.setProperty('--rich-foot-link-border-color', this.settings.linkBorderColor);

        // Check version and show release notes if needed
        await this.checkVersion();

        // Create a debounced version of updateRichFoot for edit mode
        const updateRichFootCallback = async () => {
            const activeLeaf = this.app.workspace.activeLeaf;
            try {
                await this.addRichFoot(activeLeaf.view);
                this.adjustFooterPadding();
            } catch (error) {
                console.error('Error in debouncedUpdateRichFoot:', error);
            }
        };
        this.debouncedUpdateRichFoot = debounce(updateRichFootCallback, this.settings.updateDelay, true);
        // Store the callback for later use when updating debounce timing
        this.debouncedUpdateRichFoot.callback = updateRichFootCallback;

        // Non-debounced version for reading mode
        this.immediateUpdateRichFoot = async () => {
            const activeLeaf = this.app.workspace.activeLeaf;
            try {
                await this.addRichFoot(activeLeaf.view);
                this.adjustFooterPadding();
            } catch (error) {
                console.error('Error in immediateUpdateRichFoot:', error);
            }
        };

        this.addSettingTab(new RichFootSettingTab(this.app, this));

        // Register for frontmatter changes
        this.registerEvent(
            this.app.metadataCache.on('changed', (file) => {
                const cache = this.app.metadataCache.getFileCache(file);
                if (cache?.frontmatter) {
                    const customCreatedProp = this.settings.customCreatedDateProp;
                    const customModifiedProp = this.settings.customModifiedDateProp;
                    
                    if ((customCreatedProp && customCreatedProp in cache.frontmatter) ||
                        (customModifiedProp && customModifiedProp in cache.frontmatter)) {
                        if (this.isEditMode()) {
                            this.debouncedUpdateRichFoot();
                        } else {
                            this.immediateUpdateRichFoot();
                        }
                    }
                }
            })
        );

        // Wait for the layout to be ready before registering events
        this.app.workspace.onLayoutReady(() => {
            this.registerEvent(
                this.app.workspace.on('layout-change', async () => {
                    await this.immediateUpdateRichFoot();
                })
            );

            this.registerEvent(
                this.app.workspace.on('active-leaf-change', async () => {
                    if (this.isEditMode()) {
                        await this.debouncedUpdateRichFoot();
                    } else {
                        await this.immediateUpdateRichFoot();
                    }
                })
            );

            this.registerEvent(
                this.app.workspace.on('file-open', async () => {
                    await this.immediateUpdateRichFoot();
                })
            );

            // Add mode change handler
            this.registerEvent(
                this.app.workspace.on('mode-change', async (event) => {
                    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (activeView) {
                        // Immediately update on mode change
                        await this.immediateUpdateRichFoot();
                    }
                })
            );

            this.registerEvent(
                this.app.workspace.on('editor-change', async () => {
                    await this.debouncedUpdateRichFoot();
                })
            );

            // Initial update
            this.immediateUpdateRichFoot();
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        document.documentElement.style.setProperty('--rich-foot-date-color', this.settings.dateColor);

        // Ensure excludedFolders is always an array
        if (!Array.isArray(this.settings.excludedFolders)) {
            this.settings.excludedFolders = [];
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async checkVersion() {
        const currentVersion = this.manifest.version;
        const lastVersion = this.settings.lastVersion;
        const shouldShow = this.settings.showReleaseNotes && 
            (!lastVersion || lastVersion !== currentVersion);

        if (shouldShow) {
            const releaseNotes = await this.getReleaseNotes(currentVersion);
            
            // Show the modal
            new ReleaseNotesModal(this.app, this, currentVersion, releaseNotes).open();
            
            // Update the last shown version
            this.settings.lastVersion = currentVersion;
            await this.saveSettings();
        }
    }

    async getReleaseNotes(version) {
        // Simply return the bundled release notes
        return releaseNotes;
    }

    async updateRichFoot() {
        // Update CSS custom properties
        document.documentElement.style.setProperty('--rich-foot-border-width', `${this.settings.borderWidth}px`);
        document.documentElement.style.setProperty('--rich-foot-border-style', this.settings.borderStyle);
        document.documentElement.style.setProperty('--rich-foot-border-opacity', this.settings.borderOpacity);
        document.documentElement.style.setProperty('--rich-foot-border-radius', `${this.settings.borderRadius}px`);
        document.documentElement.style.setProperty('--rich-foot-dates-opacity', this.settings.datesOpacity);
        document.documentElement.style.setProperty('--rich-foot-links-opacity', this.settings.linksOpacity);
        document.documentElement.style.setProperty('--rich-foot-date-color', this.settings.dateColor);
        document.documentElement.style.setProperty('--rich-foot-border-color', this.settings.borderColor);
        document.documentElement.style.setProperty('--rich-foot-link-color', this.settings.linkColor);
        document.documentElement.style.setProperty('--rich-foot-link-background', this.settings.linkBackgroundColor);
        document.documentElement.style.setProperty('--rich-foot-link-border-color', this.settings.linkBorderColor);

        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view instanceof MarkdownView) {
            await this.addRichFoot(activeLeaf.view);
        }
    }

    async addRichFoot(view) {
        try {
            const file = view.file;
            if (!file || !file.path) {
                return;
            }

            // Check if the current file is in an excluded folder or has excluded parent
            if (this.shouldExcludeFile(file.path)) {
                const existingRichFoots = document.querySelectorAll('.rich-foot');
                existingRichFoots.forEach(el => el.remove());
                return;
            }

            const content = view.contentEl;
            let container;

            if ((view.getMode?.() ?? view.mode) === 'preview') {
                container = content.querySelector('.markdown-preview-section');
            } else if ((view.getMode?.() ?? view.mode) === 'source' || (view.getMode?.() ?? view.mode) === 'live') {
                container = content.querySelector('.cm-sizer');
            }

            if (!container) {
                return;
            }

            // Additional check for excluded parent selectors directly on the container
            if (this.settings?.excludedParentSelectors?.some(selector => {
                try {
                    const matchingElements = document.querySelectorAll(selector);
                    return Array.from(matchingElements).some(el => 
                        el === container || 
                        el.contains(container)
                    );
                } catch (e) {
                    console.error(`Invalid selector in Rich Foot settings: ${selector}`);
                    return false;
                }
            })) {
                const existingRichFoots = document.querySelectorAll('.rich-foot');
                existingRichFoots.forEach(el => el.remove());
                return;
            }

            // Remove ALL existing Rich Foot elements from the document BEFORE creating new one
            const existingRichFoots = document.querySelectorAll('.rich-foot');
            existingRichFoots.forEach(el => el.remove());

            // Disconnect observers
            this.disconnectObservers();

            // Create and append the Rich Foot
            const richFoot = await this.createRichFoot(file);
            
            // Double check no rich-foot was added while we were creating this one
            const newCheck = document.querySelectorAll('.rich-foot');
            if (newCheck.length > 0) {
                newCheck.forEach(el => el.remove());
            }
            
            container.appendChild(richFoot);

            // Set up a mutation observer for this specific container
            this.observeContainer(container);
        } catch (error) {
            console.error('Error in addRichFoot:', error);
        }
    }

    removeExistingRichFoot(container) {
        // Remove ALL rich-foot elements from ALL windows
        document.querySelectorAll('.rich-foot').forEach(el => el.remove());
        
        // Get all shadow roots and remove rich-foot elements from them too
        document.querySelectorAll('*').forEach(el => {
            if (el.shadowRoot) {
                el.shadowRoot.querySelectorAll('.rich-foot').forEach(foot => foot.remove());
            }
        });
    }

    disconnectObservers() {
        // Disconnect any existing observers
        if (this.contentObserver) {
            this.contentObserver.disconnect();
        }
        if (this.containerObserver) {
            this.containerObserver.disconnect();
        }
    }

    observeContainer(container) {
        if (this.containerObserver) {
            this.containerObserver.disconnect();
        }

        this.containerObserver = new MutationObserver(async (mutations) => {
            const richFoot = container.querySelector('.rich-foot');
            if (!richFoot) {
                const view = this.app.workspace.activeLeaf?.view;
                if (view instanceof MarkdownView) {
                    try {
                        await this.addRichFoot(view);
                    } catch (error) {
                        console.error('Error in mutation observer:', error);
                    }
                }
            }
        });

        this.containerObserver.observe(container, { childList: true, subtree: true });
    }

    async createRichFoot(file) {
        // Remove the duplicate removal here since we're handling it in addRichFoot
        const richFoot = createDiv({ cls: 'rich-foot rich-foot--hidden' });
        richFoot.createDiv({ cls: 'rich-foot--dashed-line' });

        // Get both backlinks and outlinks data
        const backlinksData = this.app.metadataCache.getBacklinksForFile(file);
        const outlinks = await this.getOutlinks(file);

        if (this.settings.combineLinks) {
            // Combined Links View
            if ((backlinksData?.data && backlinksData.data.size > 0) || outlinks.size > 0) {
                const linksDiv = richFoot.createDiv({ cls: 'rich-foot--links' });
                const linksUl = linksDiv.createEl('ul');

                // Create a Set to track all unique links
                const processedLinks = new Set();

                // Process backlinks
                if (backlinksData?.data) {
                    for (const [linkPath, linkData] of backlinksData.data) {
                        if (!linkPath.endsWith('.md')) continue;
                        processedLinks.add(linkPath);

                        const li = linksUl.createEl('li');
                        const link = li.createEl('a', {
                            href: linkPath,
                            text: linkPath.split('/').pop().slice(0, -3),
                            cls: this.isEditMode() ? 'cm-hmd-internal-link cm-underline' : 'internal-link'
                        });
                        link.dataset.href = linkPath;
                        link.dataset.sourcePath = file.path;
                        link.dataset.isBacklink = 'true';
                        if (outlinks.has(linkPath)) {
                            link.dataset.isOutlink = 'true';
                        }
                        this.setupLinkBehavior(link, linkPath, file);
                    }
                }

                // Process outlinks
                for (const linkPath of outlinks) {
                    if (processedLinks.has(linkPath)) continue;

                    const li = linksUl.createEl('li');
                    const link = li.createEl('a', {
                        href: linkPath,
                        text: linkPath.split('/').pop().slice(0, -3),
                        cls: this.isEditMode() ? 'cm-hmd-internal-link cm-underline' : 'internal-link'
                    });
                    link.dataset.href = linkPath;
                    link.dataset.sourcePath = file.path;
                    link.dataset.isOutlink = 'true';
                    this.setupLinkBehavior(link, linkPath, file);
                }

                if (linksUl.childElementCount === 0) {
                    linksDiv.remove();
                }
            }
        } else {
            // Separate Backlinks and Outlinks Views
            if (this.settings.showBacklinks && backlinksData?.data && backlinksData.data.size > 0) {
                const backlinksDiv = richFoot.createDiv({ cls: 'rich-foot--backlinks' });
                const backlinksUl = backlinksDiv.createEl('ul');

                for (const [linkPath, linkData] of backlinksData.data) {
                    if (!linkPath.endsWith('.md')) continue;

                    const li = backlinksUl.createEl('li');
                    const link = li.createEl('a', {
                        href: linkPath,
                        text: linkPath.split('/').pop().slice(0, -3),
                        cls: this.isEditMode() ? 'cm-hmd-internal-link cm-underline' : 'internal-link'
                    });
                    link.dataset.href = linkPath;
                    link.dataset.sourcePath = file.path;
                    this.setupLinkBehavior(link, linkPath, file);
                }

                if (backlinksUl.childElementCount === 0) {
                    backlinksDiv.remove();
                }
            }

            if (this.settings.showOutlinks && outlinks.size > 0) {
                const outlinksDiv = richFoot.createDiv({ cls: 'rich-foot--outlinks' });
                const outlinksUl = outlinksDiv.createEl('ul');

                for (const linkPath of outlinks) {
                    const li = outlinksUl.createEl('li');
                    const link = li.createEl('a', {
                        href: linkPath,
                        text: linkPath.split('/').pop().slice(0, -3),
                        cls: this.isEditMode() ? 'cm-hmd-internal-link cm-underline' : 'internal-link'
                    });
                    link.dataset.href = linkPath;
                    link.dataset.sourcePath = file.path;
                    this.setupLinkBehavior(link, linkPath, file);
                }

                if (outlinksUl.childElementCount === 0) {
                    outlinksDiv.remove();
                }
            }
        }

        // -----------
        // -- Dates --
        // -----------
        if (this.settings.showDates) {
            const datesWrapper = richFoot.createDiv({ cls: 'rich-foot--dates-wrapper' });
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;

            // -- Modified date --
            let modifiedDate;
            if (this.settings.customModifiedDateProp && frontmatter && frontmatter[this.settings.customModifiedDateProp]) {
                modifiedDate = frontmatter[this.settings.customModifiedDateProp];
                let isValidDate = false;
                let tempDate = modifiedDate;

                // Try original string
                if (!isNaN(Date.parse(tempDate))) {
                    isValidDate = true;
                }
                // Try replacing periods with hyphens (only first two occurrences)
                if (!isValidDate) {
                    let count = 0;
                    tempDate = modifiedDate.replace(/\./g, (match) => {
                        count++;
                        return count <= 2 ? '-' : match;
                    });
                    if (!isNaN(Date.parse(tempDate))) {
                        isValidDate = true;
                    }
                }
                // Try replacing forward slashes with hyphens (only first two occurrences)
                if (!isValidDate) {
                    let count = 0;
                    tempDate = modifiedDate.replace(/\//g, (match) => {
                        count++;
                        return count <= 2 ? '-' : match;
                    });
                    if (!isNaN(Date.parse(tempDate))) {
                        isValidDate = true;
                    }
                }

                if (isValidDate) {
                    // if tempDate doesn't have a time component, add it (using midnight in the current timezone)
                    if (!tempDate.includes('T') && !tempDate.includes(' ')) {
                        tempDate = `${tempDate}T00:00:00`;
                    }
                    const dateObj = new Date(tempDate);
                    modifiedDate = formatDate(dateObj, this.settings.dateDisplayFormat);
                } else {
                    modifiedDate = modifiedDate;
                }
            } else {
                modifiedDate = new Date(file.stat.mtime);
                modifiedDate = formatDate(modifiedDate, this.settings.dateDisplayFormat);
            }
            datesWrapper.createDiv({
                cls: 'rich-foot--modified-date',
                text: `${modifiedDate}`
            });

            // -- Created date --
            let createdDate;
            if (this.settings.customCreatedDateProp && frontmatter && frontmatter[this.settings.customCreatedDateProp]) {
                createdDate = frontmatter[this.settings.customCreatedDateProp];
                let isValidDate = false;
                let tempDate = createdDate;

                // Try original string
                if (!isNaN(Date.parse(tempDate))) {
                    isValidDate = true;
                }
                // Try replacing periods with hyphens (only first two occurrences)
                if (!isValidDate) {
                    let count = 0;
                    tempDate = createdDate.replace(/\./g, (match) => {
                        count++;
                        return count <= 2 ? '-' : match;
                    });
                    if (!isNaN(Date.parse(tempDate))) {
                        isValidDate = true;
                    }
                }
                // Try replacing forward slashes with hyphens (only first two occurrences)
                if (!isValidDate) {
                    let count = 0;
                    tempDate = createdDate.replace(/\//g, (match) => {
                        count++;
                        return count <= 2 ? '-' : match;
                    });
                    if (!isNaN(Date.parse(tempDate))) {
                        isValidDate = true;
                    }
                }

                if (isValidDate) {
                    // if tempDate doesn't have a time component, add it (using midnight in the current timezone)
                    if (!tempDate.includes('T') && !tempDate.includes(' ')) {
                        tempDate = `${tempDate}T00:00:00`;
                    }
                    const dateObj = new Date(tempDate);
                    createdDate = formatDate(dateObj, this.settings.dateDisplayFormat);
                } else {
                    createdDate = createdDate;
                }
            } else {
                createdDate = new Date(file.stat.ctime);
                createdDate = formatDate(createdDate, this.settings.dateDisplayFormat);
            }
            datesWrapper.createDiv({
                cls: 'rich-foot--created-date',
                text: `${createdDate}`
            });
        }

        // Trigger fade in after a brief delay to ensure DOM is ready
        setTimeout(() => {
            richFoot.removeClass('rich-foot--hidden');
        }, 10);

        return richFoot;
    }

    async getOutlinks(file) {
        const cache = this.app.metadataCache.getFileCache(file);
        const links = new Set();

        // Check regular links from the cache
        if (cache?.links) {
            for (const link of cache.links) {
                const linkPath = link.link.split('#')[0];
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
                if (targetFile && targetFile.extension === 'md') {
                    links.add(targetFile.path);
                }
            }
        }

        // Add frontmatter links
        if (cache?.frontmatterLinks) {
            for (const link of cache.frontmatterLinks) {
                const linkPath = link.link.split('#')[0];
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
                if (targetFile && targetFile.extension === 'md') {
                    links.add(targetFile.path);
                }
            }
        }

        // Process footnotes from the metadata cache first
        if (cache?.blocks) {
            for (const block of Object.values(cache.blocks)) {
                if (block.type === 'footnote') {
                    const wikiLinkRegex = /\[\[(.*?)\]\]/g;
                    let wikiMatch;
                    while ((wikiMatch = wikiLinkRegex.exec(block.text)) !== null) {
                        const linkText = wikiMatch[1];
                        const linkPath = linkText.split('#')[0];
                        const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
                        if (targetFile && targetFile.extension === 'md') {
                            links.add(targetFile.path);
                        }
                    }
                }
            }
        }

        // Handle inline footnotes by reading the file content
        const fileContent = await this.app.vault.read(file);
        
        // Match inline footnotes (nested brackets)
        const inlineFootnoteRegex = /\^\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*)*)\]/g; // altering this will break link detection
        const refFootnoteRegex = /\[\^[^\]]+\]:\s*((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)/g;
        
        let match;
        // Process inline footnotes
        while ((match = inlineFootnoteRegex.exec(fileContent)) !== null) {
            const footnoteContent = match[1];
            await this.processFootnoteContent(footnoteContent, file, links);
        }
        
        // Process reference footnotes
        while ((match = refFootnoteRegex.exec(fileContent)) !== null) {
            const footnoteContent = match[1];
            await this.processFootnoteContent(footnoteContent, file, links);
        }

        return links;
    }

    async processFootnoteContent(content, file, links) {
        // Use a non-greedy regex for wiki links to avoid over-matching
        const wikiLinkRegex = /\[\[(.*?)\]\]/g;
        let wikiMatch;
        while ((wikiMatch = wikiLinkRegex.exec(content)) !== null) {
            const linkText = wikiMatch[1].trim();
            const linkPath = linkText.split('#')[0];
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
            if (targetFile && targetFile.extension === 'md') {
                links.add(targetFile.path);
            }
        }
    }

    setupLinkBehavior(link, linkPath, file) {
        if (this.isEditMode()) {
            let hoverTimeout = null;
            
            // Handle mouseover
            link.addEventListener('mouseover', (mouseEvent) => {
                // Check if the page preview plugin is enabled
                const pagePreviewPlugin = this.app.internalPlugins.plugins['page-preview'];
                if (!pagePreviewPlugin?.enabled) {
                    return;
                }

                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
                
                const previewPlugin = this.app.internalPlugins.plugins['page-preview']?.instance;
                if (previewPlugin?.onLinkHover) {
                    previewPlugin.onLinkHover(mouseEvent, link, linkPath, file.path);
                }
            });

            // Handle mouseout with debounce
            link.addEventListener('mouseout', (mouseEvent) => {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                }
                
                hoverTimeout = setTimeout(() => {
                    const previewPlugin = this.app.internalPlugins.plugins['page-preview']?.instance;
                    const hoverParent = previewPlugin?.hoverParent || document.body;
                    
                    // Try to find and remove any existing previews
                    const previews = hoverParent.querySelectorAll('.hover-popup');
                    previews.forEach(preview => preview.remove());
                    
                    hoverTimeout = null;
                }, 50);
            });
        }
        link.addEventListener('click', (event) => {
            event.preventDefault();
            this.app.workspace.openLinkText(linkPath, file.path);
        });
    }

    onunload() {
        // Clean up observers
        this.disconnectObservers();
        
        // Remove any existing rich foot elements
        document.querySelectorAll('.rich-foot').forEach(el => el.remove());
        
        // Remove registered events
        this.app.workspace.off('layout-change', this.updateRichFoot);
        this.app.workspace.off('active-leaf-change', this.updateRichFoot);
        this.app.workspace.off('file-open', this.updateRichFoot);
        this.app.workspace.off('editor-change', this.updateRichFoot);
    }

    // check if a file should be excluded
    shouldExcludeFile(filePath) {
        // Check excluded folders
        if (this.settings?.excludedFolders?.some(folder => filePath.startsWith(folder))) {
            return true;
        }

        // Check frontmatter exclusion field
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file && this.settings.frontmatterExclusionField) {
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatterValue = cache?.frontmatter?.[this.settings.frontmatterExclusionField];
            if (this.isTruthy(frontmatterValue)) {
                return true;
            }
        }

        // Check excluded parent selectors
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view?.containerEl) {
            return this.settings?.excludedParentSelectors?.some(selector => {
                try {
                    // Check if any parent element matches the selector
                    let element = activeLeaf.view.containerEl;
                    while (element) {
                        if (element.matches?.(selector)) {
                            return true;
                        }
                        // Also check if the current element contains any matching elements
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

        return false;
    }

    isEditMode() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return false;
        return (activeView.getMode?.() ?? activeView.mode) === 'source';
    }

    // adjust footer padding
    adjustFooterPadding() {
        setTimeout(() => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) return;

            const readingView = activeView.contentEl.querySelector('.markdown-reading-view');
            if (!readingView) return;

            const preview = readingView.querySelector('.markdown-preview-view');
            const previewSizer = readingView.querySelector('.markdown-preview-sizer');
            const footer = readingView.querySelector('.markdown-preview-sizer > .rich-foot');
            
            if (!preview || !previewSizer || !footer) return;

            // Reset any existing padding first
            readingView.style.setProperty('--rich-foot-top-padding', '0px');
            
            // Get the content height excluding the footer
            const contentHeight = previewSizer.offsetHeight - footer.offsetHeight;
            
            // Calculate available space
            const availableSpace = preview.offsetHeight - contentHeight - footer.offsetHeight - 85;
            
            // Only add padding if there's significant space available (more than 20px)
            if (availableSpace > 20) {
                readingView.style.setProperty('--rich-foot-top-padding', `${availableSpace}px`);
                readingView.style.setProperty('--rich-foot-margin-bottom', '0');
            } else {
                readingView.style.setProperty('--rich-foot-top-padding', '10px');
                readingView.style.setProperty('--rich-foot-margin-bottom', '20px');
            }
        }, 100);
    }

    isTruthy(value) {
        if (!value) return false;
        const truthyValues = ['true', 'yes', '1', 'on'];
        return truthyValues.includes(String(value).toLowerCase());
    }
}

export default RichFootPlugin;
