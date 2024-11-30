import { Plugin, MarkdownView, debounce, Setting } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { releaseNotes } from 'virtual:release-notes';
import { RichFootSettingTab, FolderSuggestModal, DEFAULT_SETTINGS } from './settings';

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
    }
}

// Helper function to convert HSL to Hex
function hslToHex(h, s, l) {
    // Evaluate calc expressions if present
    const evalCalc = (expr) => {
        if (typeof expr !== 'string') return expr;
        if (expr.includes('calc(')) {
            // Extract the expression inside calc()
            const calcExpr = expr.match(/calc\((.*?)\)/)[1];
            // Basic evaluation of simple math expressions
            return Function(`'use strict'; return (${calcExpr})`)();
        }
        return parseFloat(expr);
    };

    h = evalCalc(h);
    s = evalCalc(s);
    l = evalCalc(l);

    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// Helper function to convert RGB/RGBA to hex
function rgbToHex(color) {
    // For HSLA colors, create a temporary div to convert to RGB
    if (color.startsWith('hsl')) {
        const temp = document.createElement('div');
        temp.style.color = color;
        document.body.appendChild(temp);
        color = getComputedStyle(temp).color;
        document.body.removeChild(temp);
    }
    
    // Extract RGB values, handling both RGB and RGBA
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) return '#000000';
    
    // Take only the first 3 values (RGB) and ensure they're valid hex values
    const [r, g, b] = rgb.slice(0, 3).map(x => {
        // Ensure value is between 0-255
        const val = Math.min(255, Math.max(0, Math.round(parseFloat(x))));
        return val.toString(16).padStart(2, '0');
    });
    
    return `#${r}${g}${b}`;
}

// Add the blendRgbaWithBackground function
function blendRgbaWithBackground(rgba, backgroundRgb) {
    // Extract foreground RGBA values
    const rgbaMatch = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)/);
    if (!rgbaMatch) return null;

    const [ , fr, fg, fb, fa] = rgbaMatch.map(Number); // Parse to numbers
    const alpha = fa !== undefined ? fa : 1; // Default alpha to 1 if not provided
    
    // Extract background RGB values
    const rgbMatch = backgroundRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return null;

    const [ , br, bg, bb] = rgbMatch.map(Number); // Parse to numbers

    // Blend each channel using the formula: result = fg * alpha + bg * (1 - alpha)
    const r = Math.round(fr * alpha + br * (1 - alpha));
    const g = Math.round(fg * alpha + bg * (1 - alpha));
    const b = Math.round(fb * alpha + bb * (1 - alpha));

    // Return the blended color as an RGB string
    return `rgb(${r}, ${g}, ${b})`;
}

// Add this helper function to format dates
function formatDate(date, format) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const weekday = d.getDay();
    
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthsShort = months.map(m => m.slice(0, 3));
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdaysShort = weekdays.map(w => w.slice(0, 3));

    // Helper to pad numbers
    const pad = (num) => num.toString().padStart(2, '0');

    // Create a map of tokens to their values
    const tokens = {
        'dddd': weekdays[weekday],
        'ddd': weekdaysShort[weekday],
        'dd': pad(day),
        'd': day.toString(),
        'mmmm': months[month],
        'mmm': monthsShort[month],
        'mm': pad(month + 1),
        'm': (month + 1).toString(),
        'yyyy': year.toString(),
        'yy': year.toString().slice(-2)
    };

    // Sort tokens by length (longest first) to avoid partial matches
    const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

    // Replace each token with a unique placeholder
    let result = format;
    const replacements = new Map();
    
    sortedTokens.forEach((token, index) => {
        const placeholder = `__${index}__`;
        replacements.set(placeholder, tokens[token]);
        result = result.replace(new RegExp(token, 'g'), placeholder);
    });

    // Replace placeholders with final values
    replacements.forEach((value, placeholder) => {
        result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
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

        // Check version and show release notes if needed
        await this.checkVersion();

        this.updateRichFoot = debounce(this.updateRichFoot.bind(this), 100, true);

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
                        this.updateRichFoot();
                    }
                }
            })
        );

        // Wait for the layout to be ready before registering events
        this.app.workspace.onLayoutReady(() => {
            this.registerEvent(
                this.app.workspace.on('layout-change', this.updateRichFoot)
            );

            this.registerEvent(
                this.app.workspace.on('active-leaf-change', this.updateRichFoot)
            );

            this.registerEvent(
                this.app.workspace.on('file-open', this.updateRichFoot)
            );

            this.registerEvent(
                this.app.workspace.on('editor-change', this.updateRichFoot)
            );

            // Initial update
            this.updateRichFoot();
        });

        this.contentObserver = new MutationObserver(this.updateRichFoot);
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

    updateRichFoot() {
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
        if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
            this.addRichFoot(activeLeaf.view);
        }
    }

    addRichFoot(view) {
        const file = view.file;
        if (!file || !file.path) {
            return;
        }

        // Check if the current file is in an excluded folder
        if (this.shouldExcludeFile(file.path)) {
            // Remove any existing Rich Foot if the file is now excluded
            const content = view.contentEl;
            let container;
            if ((view.getMode?.() ?? view.mode) === 'preview') {
                container = content.querySelector('.markdown-preview-section');
            } else if ((view.getMode?.() ?? view.mode) === 'source' || (view.getMode?.() ?? view.mode) === 'live') {
                container = content.querySelector('.cm-sizer');
            }
            if (container) {
                this.removeExistingRichFoot(container);
            }
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

        // Remove any existing Rich Foot
        this.removeExistingRichFoot(container);

        // Create the Rich Foot
        const richFoot = this.createRichFoot(file);

        // Append the Rich Foot to the container
        if ((view.getMode?.() ?? view.mode) === 'source' || (view.getMode?.() ?? view.mode) === 'live') {
            container.appendChild(richFoot);
        } else {
            container.appendChild(richFoot);
        }

        // Set up a mutation observer for this specific container
        this.observeContainer(container);
    }

    removeExistingRichFoot(container) {
        const existingRichFoot = container.querySelector('.rich-foot');
        if (existingRichFoot) {
            existingRichFoot.remove();
        }
        // Also check in .cm-sizer for editing mode
        const cmSizer = container.closest('.cm-editor')?.querySelector('.cm-sizer');
        if (cmSizer) {
            const richFootInSizer = cmSizer.querySelector('.rich-foot');
            if (richFootInSizer) {
                richFootInSizer.remove();
            }
        }
    }

    observeContainer(container) {
        if (this.containerObserver) {
            this.containerObserver.disconnect();
        }

        this.containerObserver = new MutationObserver((mutations) => {
            const richFoot = container.querySelector('.rich-foot');
            if (!richFoot) {
                this.addRichFoot(this.app.workspace.activeLeaf.view);
            }
        });

        this.containerObserver.observe(container, { childList: true, subtree: true });
    }

    createRichFoot(file) {
        const richFoot = createDiv({ cls: 'rich-foot' });
        const richFootDashedLine = richFoot.createDiv({ cls: 'rich-foot--dashed-line' });

        // ---------------
        // -- Backlinks --
        // ---------------
        if (this.settings.showBacklinks) {
            const backlinksData = this.app.metadataCache.getBacklinksForFile(file);

            if (backlinksData?.data && backlinksData.data.size > 0) {
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

                if (backlinksUl.childElementCount === 0) {
                    backlinksDiv.remove();
                }
            }
        }

        // --------------
        // -- Outlinks --
        // --------------
        if (this.settings.showOutlinks) {
            const outlinks = this.getOutlinks(file);
            
            if (outlinks.size > 0) {
                const outlinksDiv = richFoot.createDiv({ cls: 'rich-foot--outlinks' });
                const outlinksUl = outlinksDiv.createEl('ul');

                for (const linkPath of outlinks) {
                    const parts = linkPath.split('/');
                    const displayName = parts[parts.length - 1].slice(0, -3);
                    
                    const li = outlinksUl.createEl('li');
                    const link = li.createEl('a', {
                        href: linkPath,
                        text: displayName,
                        cls: this.isEditMode() ? 'cm-hmd-internal-link cm-underline' : 'internal-link'
                    });
                    link.dataset.href = linkPath;
                    link.dataset.sourcePath = file.path;
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
                    // Split on 'T' to handle timestamps
                    const datePart = tempDate.split('T')[0];
                    // If there's no time component, parse in local timezone by appending T00:00:00
                    const dateStr = tempDate.includes('T') ? tempDate : `${datePart}T00:00:00`;
                    // Create a Date object from the parts
                    const dateObj = new Date(dateStr);
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
                    // Split on 'T' to handle timestamps
                    const datePart = tempDate.split('T')[0];
                    // If there's no time component, parse in local timezone by appending T00:00:00
                    const dateStr = tempDate.includes('T') ? tempDate : `${datePart}T00:00:00`;
                    // Create a Date object from the parts
                    const dateObj = new Date(dateStr);
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

        return richFoot;
    }

    getOutlinks(file) {
        const cache = this.app.metadataCache.getFileCache(file);
        const links = new Set();
        
        // Check regular links in content
        if (cache?.links) {
            for (const link of cache.links) {
                // Handle both standard links and links with section references
                const linkPath = link.link.split('#')[0];  // Remove section reference if present
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
                if (targetFile && targetFile.extension === 'md') {
                    links.add(targetFile.path);
                }
            }
        }
        
        // Check frontmatter links
        if (cache?.frontmatter?.links) {
            const frontmatterLinks = cache.frontmatter.links;
            if (Array.isArray(frontmatterLinks)) {
                for (const link of frontmatterLinks) {
                    const linkText = link.match(/\[\[(.*?)\]\]/)?.[1];
                    if (linkText) {
                        const linkPath = linkText.split('#')[0];  // Remove section reference if present
                        const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
                        if (targetFile && targetFile.extension === 'md') {
                            links.add(targetFile.path);
                        }
                    }
                }
            }
        }

        // Check embeds/transclusions
        if (cache?.embeds) {
            for (const embed of cache.embeds) {
                const filePath = embed.link.split('#')[0];
                const targetFile = this.app.metadataCache.getFirstLinkpathDest(filePath, file.path);
                if (targetFile && targetFile.extension === 'md') {
                    links.add(targetFile.path);
                }
            }
        }

        // Check for data-href links in the rendered content
        if (cache?.sections) {
            for (const section of cache.sections) {
                if (section.type === 'paragraph') {
                    const matches = section.text?.match(/\[.*?\]\((.*?)(?:#.*?)?\)/g) || [];
                    for (const match of matches) {
                        const linkPath = match.match(/\[.*?\]\((.*?)(?:#.*?)?\)/)?.[1];
                        if (linkPath) {
                            const cleanPath = linkPath.split('#')[0];  // Remove section reference if present
                            const targetFile = this.app.metadataCache.getFirstLinkpathDest(cleanPath, file.path);
                            if (targetFile && targetFile.extension === 'md') {
                                links.add(targetFile.path);
                            }
                        }
                    }
                }
            }
        }
        
        return links;
    }

    onunload() {
        this.contentObserver.disconnect();
        if (this.richFootIntervalId) {
            clearInterval(this.richFootIntervalId);
        }
        if (this.containerObserver) {
            this.containerObserver.disconnect();
        }
    }

    // Add this method to check if a file should be excluded
    shouldExcludeFile(filePath) {
        if (!this.settings?.excludedFolders) {
            return false;
        }
        return this.settings.excludedFolders.some(folder => filePath.startsWith(folder));
    }

    isEditMode() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return false;
        return (activeView.getMode?.() ?? activeView.mode) === 'source';
    }
}

export default RichFootPlugin;
