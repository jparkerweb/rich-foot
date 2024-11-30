import { PluginSettingTab, Setting, FuzzySuggestModal } from 'obsidian';

export const DEFAULT_SETTINGS = {
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
    dateDisplayFormat: 'mmmm dd, yyyy',
};

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

    const [ , fr, fg, fb, fa] = rgbaMatch.map(Number);
    const alpha = fa !== undefined ? fa : 1;
    
    // Extract background RGB values
    const rgbMatch = backgroundRgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return null;

    const [ , br, bg, bb] = rgbMatch.map(Number);

    // Blend each channel using the formula: result = fg * alpha + bg * (1 - alpha)
    const r = Math.round(fr * alpha + br * (1 - alpha));
    const g = Math.round(fg * alpha + bg * (1 - alpha));
    const b = Math.round(fb * alpha + bb * (1 - alpha));

    return `rgb(${r}, ${g}, ${b})`;
}

export class FolderSuggestModal extends FuzzySuggestModal {
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

export class RichFootSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.createdDateInput = null;
        this.modifiedDateInput = null;
    }

    async browseForFolder() {
        const folders = [];
        const files = this.app.vault.getAllLoadedFiles();
        files.forEach((file) => {
            if (file.children) {
                folders.push(file.path);
            }
        });

        const modal = new FolderSuggestModal(this.app, folders, (folder) => {
            if (this.createdDateInput) {
                this.createdDateInput.setValue(folder);
            }
            if (this.modifiedDateInput) {
                this.modifiedDateInput.setValue(folder);
            }
        });
        modal.open();
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Rich Foot Settings' });

        new Setting(containerEl)
            .setName('Border Width')
            .setDesc('Width of the footer border in pixels')
            .addSlider(slider => slider
                .setLimits(0, 5, 1)
                .setValue(this.plugin.settings.borderWidth)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.borderWidth = value;
                    document.documentElement.style.setProperty('--rich-foot-border-width', `${value}px`);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Border Style')
            .setDesc('Style of the footer border')
            .addDropdown(dropdown => dropdown
                .addOption('solid', 'Solid')
                .addOption('dashed', 'Dashed')
                .addOption('dotted', 'Dotted')
                .setValue(this.plugin.settings.borderStyle)
                .onChange(async (value) => {
                    this.plugin.settings.borderStyle = value;
                    document.documentElement.style.setProperty('--rich-foot-border-style', value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Border Opacity')
            .setDesc('Opacity of the footer border')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.borderOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.borderOpacity = value;
                    document.documentElement.style.setProperty('--rich-foot-border-opacity', value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Border Radius')
            .setDesc('Border radius of the footer in pixels')
            .addSlider(slider => slider
                .setLimits(0, 30, 1)
                .setValue(this.plugin.settings.borderRadius)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.borderRadius = value;
                    document.documentElement.style.setProperty('--rich-foot-border-radius', `${value}px`);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Dates Opacity')
            .setDesc('Opacity of the dates in the footer')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.datesOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.datesOpacity = value;
                    document.documentElement.style.setProperty('--rich-foot-dates-opacity', value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Links Opacity')
            .setDesc('Opacity of the links in the footer')
            .addSlider(slider => slider
                .setLimits(0, 1, 0.1)
                .setValue(this.plugin.settings.linksOpacity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.linksOpacity = value;
                    document.documentElement.style.setProperty('--rich-foot-links-opacity', value);
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Border Color')
            .setDesc('Color of the footer border')
            .addText(text => text
                .setValue(this.plugin.settings.borderColor)
                .onChange(async (value) => {
                    this.plugin.settings.borderColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Link Color')
            .setDesc('Color of the links in the footer')
            .addText(text => text
                .setValue(this.plugin.settings.linkColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Link Background Color')
            .setDesc('Background color of the links in the footer')
            .addText(text => text
                .setValue(this.plugin.settings.linkBackgroundColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkBackgroundColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Link Border Color')
            .setDesc('Border color of the links in the footer')
            .addText(text => text
                .setValue(this.plugin.settings.linkBorderColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkBorderColor = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Custom Created Date Property')
            .setDesc('Custom frontmatter property for created date')
            .addText(text => {
                this.createdDateInput = text;
                text.setValue(this.plugin.settings.customCreatedDateProp)
                    .onChange(async (value) => {
                        this.plugin.settings.customCreatedDateProp = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Custom Modified Date Property')
            .setDesc('Custom frontmatter property for modified date')
            .addText(text => {
                this.modifiedDateInput = text;
                text.setValue(this.plugin.settings.customModifiedDateProp)
                    .onChange(async (value) => {
                        this.plugin.settings.customModifiedDateProp = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Date Display Format')
            .setDesc('Format for displaying dates (e.g., "mmmm dd, yyyy" for "January 01, 2024")')
            .addText(text => text
                .setValue(this.plugin.settings.dateDisplayFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateDisplayFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Excluded Folders')
            .setDesc('Folders to exclude from footer display')
            .addTextArea(text => text
                .setValue(this.plugin.settings.excludedFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value.split('\n').filter(folder => folder.trim() !== '');
                    await this.plugin.saveSettings();
                }));
    }
}
