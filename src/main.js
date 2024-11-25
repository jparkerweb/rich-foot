import { Plugin, MarkdownView, debounce, Setting, PluginSettingTab, EditorView, FuzzySuggestModal } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { releaseNotes } from 'virtual:release-notes';

const DEFAULT_SETTINGS = {
    borderWidth: 1,
    borderStyle: "dashed",
    borderOpacity: 1,
    borderRadius: 15,
    datesOpacity: 1,
    linksOpacity: 1,
    showReleaseNotes: true,
    excludedFolders: [],
    dateColor: 'var(--text-accent)',
    borderColor: 'var(--text-accent)',
    linkColor: 'var(--link-color)',
    linkBackgroundColor: 'var(--tag-background)',
    linkBorderColor: 'rgba(255, 255, 255, 0.204)',
    customCreatedDateProp: '',
    customModifiedDateProp: '',
};

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

        // Backlinks
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
                        text: linkPath.split('/').pop().slice(0, -3)
                    });
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

        // Outlinks
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
                        text: displayName
                    });
                    link.addEventListener('click', (event) => {
                        event.preventDefault();
                        this.app.workspace.openLinkText(linkPath, file.path);
                    });
                }
            }
        }

        // Dates
        if (this.settings.showDates) {
            const datesWrapper = richFoot.createDiv({ cls: 'rich-foot--dates-wrapper' });
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter;

            // Modified date
            let modifiedDate;
            if (this.settings.customModifiedDateProp && frontmatter && frontmatter[this.settings.customModifiedDateProp]) {
                modifiedDate = new Date(frontmatter[this.settings.customModifiedDateProp]);
            } else {
                modifiedDate = new Date(file.stat.mtime);
            }
            const modified = `${modifiedDate.toLocaleString('default', { month: 'long' })} ${modifiedDate.getDate()}, ${modifiedDate.getFullYear()}`;
            datesWrapper.createDiv({
                cls: 'rich-foot--modified-date',
                text: `${modified}`
            });

            // Created date
            let createdDate;
            if (this.settings.customCreatedDateProp && frontmatter && frontmatter[this.settings.customCreatedDateProp]) {
                createdDate = new Date(frontmatter[this.settings.customCreatedDateProp]);
            } else {
                createdDate = new Date(file.stat.ctime);
            }
            const created = `${createdDate.toLocaleString('default', { month: 'long' })} ${createdDate.getDate()}, ${createdDate.getFullYear()}`;
            datesWrapper.createDiv({
                cls: 'rich-foot--created-date',
                text: `${created}`
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
}

class RichFootSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('rich-foot-settings');

        containerEl.createEl('div', { cls: 'rich-foot-info', text: '🦶 Rich Foot adds a footer to your notes with useful information such as backlinks, creation date, and last modified date. Use the settings below to customize the appearance.' });

        // Excluded Folders Section with description
        containerEl.createEl('h3', { text: 'Excluded Folders' });
        containerEl.createEl('p', { 
            text: 'Notes in excluded folders (and their subfolders) will not display the Rich Foot footer. This is useful for system folders or areas where you don\'t want footer information to appear.',
            cls: 'setting-item-description'
        });
        
        // Create container for excluded folders list
        const excludedFoldersContainer = containerEl.createDiv('excluded-folders-container');
        
        // Display current excluded folders
        if (this.plugin.settings?.excludedFolders) {
            this.plugin.settings.excludedFolders.forEach((folder, index) => {
                const folderDiv = excludedFoldersContainer.createDiv('excluded-folder-item');
                folderDiv.createSpan({ text: folder });
                
                const deleteButton = folderDiv.createEl('button', {
                    text: 'Delete',
                    cls: 'excluded-folder-delete'
                });
                
                deleteButton.addEventListener('click', async () => {
                    this.plugin.settings.excludedFolders.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
        }

        // Add new folder section
        const newFolderSetting = new Setting(containerEl)
            .setName('Add excluded folder')
            .setDesc('Enter a folder path or browse to select')
            .addText(text => text
                .setPlaceholder('folder/subfolder')
                .onChange(() => {
                    // We'll handle the change in the add button
                }))
            .addButton(button => button
                .setButtonText('Browse')
                .onClick(async () => {
                    const folder = await this.browseForFolder();
                    if (folder) {
                        const textComponent = newFolderSetting.components[0];
                        textComponent.setValue(folder);
                    }
                }))
            .addButton(button => button
                .setButtonText('Add')
                .onClick(async () => {
                    const textComponent = newFolderSetting.components[0];
                    const newFolder = textComponent.getValue().trim();
                    
                    if (newFolder && !this.plugin.settings.excludedFolders.includes(newFolder)) {
                        this.plugin.settings.excludedFolders.push(newFolder);
                        await this.plugin.saveSettings();
                        textComponent.setValue('');
                        this.display(); // Refresh the display
                    }
                }));

        // Add visibility toggles
        containerEl.createEl('h3', { text: 'Visibility Settings' });

        new Setting(containerEl)
            .setName('Show Backlinks')
            .setDesc('Show backlinks in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showBacklinks)
                .onChange(async (value) => {
                    this.plugin.settings.showBacklinks = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Show Outlinks')
            .setDesc('Show outgoing links in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showOutlinks)
                .onChange(async (value) => {
                    this.plugin.settings.showOutlinks = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Show Dates')
            .setDesc('Show creation and modification dates in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDates)
                .onChange(async (value) => {
                    this.plugin.settings.showDates = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }));

        // Add Date Settings
        containerEl.createEl('h3', { text: 'Date Settings' });
        
        new Setting(containerEl)
            .setName('Show Dates')
            .setDesc('Show creation and modification dates in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDates)
                .onChange(async (value) => {
                    this.plugin.settings.showDates = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Custom Created Date Property')
            .setDesc('Specify a frontmatter property to use for creation date (leave empty to use file creation date)')
            .addText(text => text
                .setValue(this.plugin.settings.customCreatedDateProp)
                .onChange(async (value) => {
                    this.plugin.settings.customCreatedDateProp = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Custom Modified Date Property')
            .setDesc('Specify a frontmatter property to use for modification date (leave empty to use file modification date)')
            .addText(text => text
                .setValue(this.plugin.settings.customModifiedDateProp)
                .onChange(async (value) => {
                    this.plugin.settings.customModifiedDateProp = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }));

        // Border Settings
        containerEl.createEl('h3', { text: 'Style Settings' });

        // Border Width
        new Setting(containerEl)
            .setName('Border Width')
            .setDesc('Adjust the width of the footer border (1-10px)')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.borderWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.borderWidth = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderWidth = DEFAULT_SETTINGS.borderWidth;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update just the slider value
                    const slider = this.containerEl.querySelector('input[type="range"]');
                    if (slider) slider.value = DEFAULT_SETTINGS.borderWidth;
                }));

        // Border Style
        new Setting(containerEl)
            .setName('Border Style')
            .setDesc('Choose the style of the footer border')
            .addDropdown(dropdown => dropdown
                .addOptions({
                    'solid': 'Solid',
                    'dashed': 'Dashed',
                    'dotted': 'Dotted',
                    'double': 'Double',
                    'groove': 'Groove',
                    'ridge': 'Ridge',
                    'inset': 'Inset',
                    'outset': 'Outset'
                })
                .setValue(this.plugin.settings.borderStyle)
                .onChange(async (value) => {
                    this.plugin.settings.borderStyle = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderStyle = DEFAULT_SETTINGS.borderStyle;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update just the dropdown value
                    const dropdown = this.containerEl.querySelector('select');
                    if (dropdown) dropdown.value = DEFAULT_SETTINGS.borderStyle;
                }));

        // Border Opacity
        new Setting(containerEl)
            .setName('Border Opacity')
            .setDesc('Adjust the opacity of the footer border (0-1)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.borderOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.borderOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderOpacity = DEFAULT_SETTINGS.borderOpacity;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update the slider value
                    const slider = button.buttonEl.parentElement.parentElement.querySelector('input[type="range"]');
                    if (slider) slider.value = DEFAULT_SETTINGS.borderOpacity;
                }));

        // Border Color
        new Setting(containerEl)
            .setName('Border Color')
            .setDesc('Choose the color for the footer border')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.borderColor.startsWith('var(--') ? 
                    (() => {
                        const temp = document.createElement('div');
                        temp.style.borderColor = 'var(--text-accent)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).borderColor;
                        document.body.removeChild(temp);
                        
                        const rgb = color.match(/\d+/g);
                        if (rgb) {
                            return '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                        }
                        return '#000000';
                    })() : 
                    this.plugin.settings.borderColor)
                .onChange(async (value) => {
                    this.plugin.settings.borderColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderColor = 'var(--text-accent)';
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Get the specific color picker for border color
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.borderColor = 'var(--text-accent)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).borderColor;
                        document.body.removeChild(temp);
                        
                        const rgb = color.match(/\d+/g);
                        if (rgb && colorPicker) {
                            colorPicker.value = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                        }
                    }
                }));

        // Link Border Radius
        new Setting(containerEl)
            .setName('Link Border Radius')
            .setDesc('Adjust the border radius of Backlinks and Outlinks (0-15px)')
            .addSlider(slider => slider
                .setLimits(0, 15, 1)
                .setValue(this.plugin.settings.borderRadius)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.borderRadius = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderRadius = DEFAULT_SETTINGS.borderRadius;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update just the slider value
                    const slider = button.buttonEl.parentElement.parentElement.querySelector('input[type="range"]');
                    if (slider) slider.value = DEFAULT_SETTINGS.borderRadius;
                }));

        // Links Opacity
        new Setting(containerEl)
            .setName('Links Opacity')
            .setDesc('Adjust the opacity of Backlinks and Outlinks (0-1)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.linksOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.linksOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linksOpacity = DEFAULT_SETTINGS.linksOpacity;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update just THIS setting's slider value
                    const slider = button.buttonEl.parentElement.parentElement.querySelector('input[type="range"]');
                    if (slider) slider.value = DEFAULT_SETTINGS.linksOpacity;
                }));

        // Link Text Color
        new Setting(containerEl)
            .setName('Link Text Color')
            .setDesc('Choose the color for link text')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.linkColor.startsWith('var(--') ? 
                    (() => {
                        const temp = document.createElement('div');
                        temp.style.color = 'var(--link-color)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).color;
                        document.body.removeChild(temp);
                        return rgbToHex(color);
                    })() : 
                    this.plugin.settings.linkColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkColor = 'var(--link-color)';
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.color = 'var(--link-color)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).color;
                        document.body.removeChild(temp);
                        
                        const rgb = color.match(/\d+/g);
                        if (rgb && colorPicker) {
                            colorPicker.value = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
                        }
                    }
                }));

        // Link Background Color
        new Setting(containerEl)
            .setName('Link Background Color')
            .setDesc('Choose the background color for links')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.linkBackgroundColor.startsWith('var(--') ? 
                    (() => {
                        // Get background color
                        const temp = document.createElement('div');
                        temp.style.backgroundColor = 'var(--background-primary)';
                        document.body.appendChild(temp);
                        const bgColor = getComputedStyle(temp).backgroundColor;
                        
                        // Get tag background color
                        temp.style.backgroundColor = 'var(--tag-background)';
                        const tagColor = getComputedStyle(temp).backgroundColor;
                        document.body.removeChild(temp);

                        // Blend colors and convert to hex
                        const blendedColor = blendRgbaWithBackground(tagColor, bgColor);
                        return blendedColor ? rgbToHex(blendedColor) : '#000000';
                    })() : 
                    this.plugin.settings.linkBackgroundColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkBackgroundColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkBackgroundColor = 'var(--tag-background)';
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        // Get background color
                        const temp = document.createElement('div');
                        temp.style.backgroundColor = 'var(--background-primary)';
                        document.body.appendChild(temp);
                        const bgColor = getComputedStyle(temp).backgroundColor;
                        
                        // Get tag background color
                        temp.style.backgroundColor = 'var(--tag-background)';
                        const tagColor = getComputedStyle(temp).backgroundColor;
                        document.body.removeChild(temp);

                        // Blend colors and convert to hex
                        const blendedColor = blendRgbaWithBackground(tagColor, bgColor);
                        if (blendedColor) {
                            colorPicker.value = rgbToHex(blendedColor);
                        }
                    }
                }));
        
        // Link Border Color
        new Setting(containerEl)
            .setName('Link Border Color')
            .setDesc('Choose the border color for links')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.linkBorderColor.startsWith('rgba(255, 255, 255,') ? 
                    (() => {
                        // Get background color
                        const temp = document.createElement('div');
                        temp.style.backgroundColor = 'var(--background-primary)';
                        document.body.appendChild(temp);
                        const bgColor = getComputedStyle(temp).backgroundColor;
                        
                        // Blend with default rgba color
                        const blendedColor = blendRgbaWithBackground('rgba(255, 255, 255, 0.204)', bgColor);
                        document.body.removeChild(temp);
                        return blendedColor ? rgbToHex(blendedColor) : '#000000';
                    })() : 
                    this.plugin.settings.linkBorderColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkBorderColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkBorderColor = 'rgba(255, 255, 255, 0.204)';
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        // Get background color
                        const temp = document.createElement('div');
                        temp.style.backgroundColor = 'var(--background-primary)';
                        document.body.appendChild(temp);
                        const bgColor = getComputedStyle(temp).backgroundColor;
                        
                        // Blend with default rgba color
                        const blendedColor = blendRgbaWithBackground('rgba(255, 255, 255, 0.204)', bgColor);
                        document.body.removeChild(temp);
                        if (blendedColor) {
                            colorPicker.value = rgbToHex(blendedColor);
                        }
                    }
                }));
        
        // Dates Opacity
        new Setting(containerEl)
            .setName('Dates Opacity')
            .setDesc('Adjust the opacity of the Created / Modified Dates (0-1)')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.datesOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.datesOpacity = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.datesOpacity = DEFAULT_SETTINGS.datesOpacity;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update just THIS setting's slider value
                    const slider = button.buttonEl.parentElement.parentElement.querySelector('input[type="range"]');
                    if (slider) slider.value = DEFAULT_SETTINGS.datesOpacity;
                }));

        // Date Color
        new Setting(containerEl)
            .setName('Date Color')
            .setDesc('Choose the color for Created / Modified Dates')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.dateColor.startsWith('var(--') ? 
                    (() => {
                        const temp = document.createElement('div');
                        temp.style.color = 'var(--text-accent)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).color;
                        document.body.removeChild(temp);
                        return rgbToHex(color);
                    })() : 
                    this.plugin.settings.dateColor)
                .onChange(async (value) => {
                    this.plugin.settings.dateColor = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.dateColor = 'var(--text-accent)';
                    await this.plugin.saveSettings();
                    this.plugin.updateRichFoot();
                    // Update just THIS setting's color picker
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.color = 'var(--text-accent)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).color;
                        document.body.removeChild(temp);
                        colorPicker.value = rgbToHex(color);
                    }
                }));

        // Add Example Screenshot section
        containerEl.createEl('h3', { text: 'Example Screenshot', cls: 'rich-foot-example-title' });
        const exampleDiv = containerEl.createDiv({ cls: 'rich-foot-example' });
        const img = exampleDiv.createEl('img', {
            attr: {
                src: 'https://raw.githubusercontent.com/jparkerweb/rich-foot/refs/heads/main/rich-foot.jpg',
                alt: 'Rich Foot Example'
            }
        });

        new Setting(containerEl)
            .setName('Show Release Notes')
            .setDesc('Show release notes after plugin updates')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showReleaseNotes)
                .onChange(async (value) => {
                    this.plugin.settings.showReleaseNotes = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Release Notes')
            .setDesc('View release notes for the current version')
            .addButton(button => button
                .setButtonText('Show Release Notes')
                .onClick(async () => {
                    const notes = await this.plugin.getReleaseNotes(this.plugin.manifest.version);
                    new ReleaseNotesModal(this.app, this.plugin, this.plugin.manifest.version, notes).open();
                }));
    }

    async browseForFolder() {
        // Get all folders in the vault
        const folders = this.app.vault.getAllLoadedFiles()
            .filter(file => file.children) // Only get folders
            .map(folder => folder.path);
        
        // Create and show a suggestion modal
        return new Promise(resolve => {
            const modal = new FolderSuggestModal(this.app, folders, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }
}

// Add this new class for the folder picker modal
class FolderSuggestModal extends FuzzySuggestModal {
    constructor(app, folders, onChoose) {
        super(app);
        this.folders = folders;
        this.onChoose = onChoose;
    }

    getItems() {
        return this.folders;
    }

    getItemText(item) {
        return item;
    }

    onChooseItem(item, evt) {
        this.onChoose(item);
    }
}

export default RichFootPlugin;
