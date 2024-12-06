import { Plugin, MarkdownView, debounce, Setting } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { releaseNotes } from 'virtual:release-notes';
import { RichFootSettingTab, FolderSuggestModal, DEFAULT_SETTINGS } from './settings';
import { RichFootComponent } from './components';

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

class RichFootPlugin extends Plugin {
    richFootComponents = new Map(); // Track components for each view

    async onload() {
        // Load settings first
        await this.loadSettings();

        // Define the callbacks here only
        this.quickUpdateCallback = debounce(async () => {
            const activeLeaf = this.app.workspace.activeLeaf;
            if (!activeLeaf) return;

            const view = activeLeaf.view;
            if (!view || !(view instanceof MarkdownView)) return;

            await this.addRichFoot(view);  // Make sure to await this
        }, 300);

        this.editUpdateCallback = debounce(async () => {
            const activeLeaf = this.app.workspace.activeLeaf;
            if (!activeLeaf) return;

            const view = activeLeaf.view;
            if (!view || !(view instanceof MarkdownView)) return;

            await this.addRichFoot(view);  // Make sure to await this
        }, this.settings?.updateDelay || 1000);

        this.registerEvents();
        this.addSettingTab(new RichFootSettingTab(this.app, this));
        await this.checkVersion();

        // Initial render using quick update
        await this.quickUpdateCallback();  // Make sure to await this
    }

    async addRichFoot(view) {
        if (!view || !(view instanceof MarkdownView)) {
            return;
        }

        if (this.shouldExcludeFile(view.file.path)) {
            this.removeExistingRichFoot(view);
            return;
        }

        const contentEl = view.contentEl;
        const cmEditor = view.editor;
        const isEditMode = view.getMode() === 'source';

        // Create new component
        const component = new RichFootComponent(view, this);
        this.richFootComponents.set(view, component);
        
        // Load the component
        await component.onload();  // Make this awaitable
    }

    isEditMode(view) {
        if (!view || !(view instanceof MarkdownView)) return false;
        return view.getMode() === 'source';
    }

    removeExistingRichFoot(view) {
        const existingComponent = this.richFootComponents.get(view);
        if (existingComponent) {
            existingComponent.unload();
            this.richFootComponents.delete(view);
        }
    }

    onunload() {
        // Clean up all components
        for (const component of this.richFootComponents.values()) {
            component.unload();
        }
        this.richFootComponents.clear();
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
            this.adjustFooterPadding();
        }
    }

    // check if a file should be excluded
    shouldExcludeFile(filePath) {
        if (!this.settings?.excludedFolders) {
            return false;
        }
        return this.settings.excludedFolders.some(folder => filePath.startsWith(folder));
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
        const inlineFootnoteRegex = /\^\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]/g;
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

    formatDate(date, format) {
        if (!date || !format) return '';
        
        // Use Obsidian's moment instance
        return window.moment(date).format(format);
    }

    // Helper function to format a timestamp with a custom format
    formatTimestamp(timestamp, format) {
        if (!timestamp) return '';
        return this.formatDate(new Date(timestamp), format);
    }

    registerEvents() {
        // Clean up and recreate rich-foot when a file is opened
        this.registerEvent(
            this.app.workspace.on('file-open', async (file) => {  // Make async
                if (!file) return;
                document.querySelectorAll('.rich-foot').forEach(el => el.remove());
                await this.quickUpdateCallback(); // Make sure to await
            })
        );

        // Listen for layout changes
        this.registerEvent(
            this.app.workspace.on('layout-change', async () => {  // Make async
                await this.quickUpdateCallback(); // Make sure to await
            })
        );

        // Listen for active leaf changes
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', async (leaf) => {  // Make async
                await this.quickUpdateCallback(); // Make sure to await
            })
        );
    }

    adjustFooterPadding = debounce(() => {
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
        
        // Only add padding if there's significant space available
        if (availableSpace > 20) {
            readingView.style.setProperty('--rich-foot-top-padding', `${availableSpace}px`);
            readingView.style.setProperty('--rich-foot-margin-bottom', '0');
        } else {
            readingView.style.setProperty('--rich-foot-top-padding', '10px');
            readingView.style.setProperty('--rich-foot-margin-bottom', '20px');
        }
    }, 100);
}

export default RichFootPlugin;
