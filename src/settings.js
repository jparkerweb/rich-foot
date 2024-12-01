import { PluginSettingTab, Setting, FuzzySuggestModal } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { releaseNotes } from 'virtual:release-notes';

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
    showBacklinks: true,
    showOutlinks: true,
    showDates: true,
    combineLinks: false,
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
    let result = format.toLowerCase(); // Make case-insensitive
    const replacements = new Map();
    
    sortedTokens.forEach((token, index) => {
        const placeholder = `__${index}__`;
        replacements.set(placeholder, tokens[token]);
        result = result.replace(new RegExp(token, 'gi'), placeholder);
    });

    // Replace placeholders with final values
    replacements.forEach((value, placeholder) => {
        result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
}

export class RichFootSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.createdDateInput = null;
        this.modifiedDateInput = null;
    }

    display() {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('rich-foot-settings');

        containerEl.createEl('div', { cls: 'rich-foot-info', text: '🦶 Rich Foot adds a footer to your notes with useful information such as backlinks, creation date, and last modified date. Use the settings below to customize the appearance.' });

        // Excluded Folders Section
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
                .setPlaceholder('folder/subfolder'))
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
                        this.display();
                    }
                }));

        // Visibility Settings
        containerEl.createEl('h3', { text: 'Visibility Settings' });

        new Setting(containerEl)
            .setName('Show Backlinks')
            .setDesc('Show backlinks in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showBacklinks)
                .onChange(async (value) => {
                    this.plugin.settings.showBacklinks = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Show Outlinks')
            .setDesc('Show outgoing links in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showOutlinks)
                .onChange(async (value) => {
                    this.plugin.settings.showOutlinks = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Show Combine Links')
            .setDesc('Show backlinks and outlinks in a single combined section (overrides show backlinks and show outlinks settings)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.combineLinks)
                .onChange(async (value) => {
                    this.plugin.settings.combineLinks = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }));

        // Date Settings
        containerEl.createEl('h3', { text: 'Date Settings' });
        
        new Setting(containerEl)
            .setName('Show Dates')
            .setDesc('Show creation and modification dates in the footer')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showDates)
                .onChange(async (value) => {
                    this.plugin.settings.showDates = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }));

        new Setting(containerEl)
            .setName('Date Display Format')
            .setDesc('Choose how dates should be displayed in the footer')
            .addDropdown(dropdown => {
                const today = new Date();
                const formats = [
                    'mm/dd/yyyy',
                    'dd/mm/yyyy',
                    'yyyy-mm-dd',
                    'mmm dd, yyyy',
                    'dd mmm yyyy',
                    'mmmm dd, yyyy',
                    'ddd, mmm dd, yyyy',
                    'dddd, mmmm dd, yyyy',
                    'mm/dd/yy',
                    'dd/mm/yy',
                    'yy-mm-dd',
                    'm/d/yy'
                ];
                
                formats.forEach(format => {
                    const example = formatDate(today, format);
                    dropdown.addOption(format, `${format} (${example})`);
                });
                
                dropdown
                    .setValue(this.plugin.settings.dateDisplayFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.dateDisplayFormat = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            });

        new Setting(containerEl)
            .setName('Custom Created Date Property')
            .setDesc('Specify a frontmatter property to use for creation date (leave empty to use file creation date)')
            .addText(text => {
                text.setValue(this.plugin.settings.customCreatedDateProp)
                    .onChange(async (value) => {
                        this.plugin.settings.customCreatedDateProp = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
                this.createdDateInput = text;
                return text;
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.customCreatedDateProp = '';
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    this.createdDateInput.setValue('');
                }));

        new Setting(containerEl)
            .setName('Custom Modified Date Property')
            .setDesc('Specify a frontmatter property to use for modification date (leave empty to use file modification date)')
            .addText(text => {
                text.setValue(this.plugin.settings.customModifiedDateProp)
                    .onChange(async (value) => {
                        this.plugin.settings.customModifiedDateProp = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
                this.modifiedDateInput = text;
                return text;
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.customModifiedDateProp = '';
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    this.modifiedDateInput.setValue('');
                }));

        // Style Settings
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderWidth = DEFAULT_SETTINGS.borderWidth;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderStyle = DEFAULT_SETTINGS.borderStyle;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderOpacity = DEFAULT_SETTINGS.borderOpacity;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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
                        return rgbToHex(color);
                    })() : 
                    this.plugin.settings.borderColor)
                .onChange(async (value) => {
                    this.plugin.settings.borderColor = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderColor = DEFAULT_SETTINGS.borderColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.borderColor = 'var(--text-accent)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).borderColor;
                        document.body.removeChild(temp);
                        colorPicker.value = rgbToHex(color);
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderRadius = DEFAULT_SETTINGS.borderRadius;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linksOpacity = DEFAULT_SETTINGS.linksOpacity;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkColor = DEFAULT_SETTINGS.linkColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.color = 'var(--link-color)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).color;
                        document.body.removeChild(temp);
                        colorPicker.value = rgbToHex(color);
                    }
                }));

        // Link Background Color
        new Setting(containerEl)
            .setName('Link Background Color')
            .setDesc('Choose the background color for links')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.linkBackgroundColor.startsWith('var(--') ? 
                    (() => {
                        const temp = document.createElement('div');
                        temp.style.backgroundColor = 'var(--tag-background)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).backgroundColor;
                        document.body.removeChild(temp);
                        return rgbToHex(color);
                    })() : 
                    this.plugin.settings.linkBackgroundColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkBackgroundColor = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkBackgroundColor = DEFAULT_SETTINGS.linkBackgroundColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.backgroundColor = 'var(--tag-background)';
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).backgroundColor;
                        document.body.removeChild(temp);
                        colorPicker.value = rgbToHex(color);
                    }
                }));

        // Link Border Color
        new Setting(containerEl)
            .setName('Link Border Color')
            .setDesc('Choose the border color for links')
            .addColorPicker(color => color
                .setValue(this.plugin.settings.linkBorderColor.startsWith('rgba(') ? 
                    (() => {
                        const temp = document.createElement('div');
                        temp.style.borderColor = this.plugin.settings.linkBorderColor;
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).borderColor;
                        document.body.removeChild(temp);
                        return rgbToHex(color);
                    })() : 
                    this.plugin.settings.linkBorderColor)
                .onChange(async (value) => {
                    this.plugin.settings.linkBorderColor = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkBorderColor = DEFAULT_SETTINGS.linkBorderColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    const colorPicker = button.buttonEl.parentElement.parentElement.querySelector('input[type="color"]');
                    if (colorPicker) {
                        const temp = document.createElement('div');
                        temp.style.borderColor = DEFAULT_SETTINGS.linkBorderColor;
                        document.body.appendChild(temp);
                        const color = getComputedStyle(temp).borderColor;
                        document.body.removeChild(temp);
                        colorPicker.value = rgbToHex(color);
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.datesOpacity = DEFAULT_SETTINGS.datesOpacity;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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
                    await this.plugin.updateRichFoot();
                }))
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.dateColor = DEFAULT_SETTINGS.dateColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
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

        // Example Screenshot
        containerEl.createEl('h3', { text: 'Example Screenshot', cls: 'rich-foot-example-title' });
        const exampleDiv = containerEl.createDiv({ cls: 'rich-foot-example' });
        exampleDiv.createEl('img', {
            attr: {
                src: 'https://raw.githubusercontent.com/jparkerweb/rich-foot/refs/heads/main/rich-foot.jpg',
                alt: 'Rich Foot Example'
            }
        });

        // Release Notes
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
            .setName('View Release Notes')
            .setDesc('View release notes for the current version')
            .addButton(button => button
                .setButtonText('View Release Notes')
                .onClick(async () => {
                    const notes = await this.plugin.getReleaseNotes(this.plugin.manifest.version);
                    new ReleaseNotesModal(this.app, this.plugin, this.plugin.manifest.version, notes).open();
                }));
    }

    async browseForFolder() {
        const folders = this.app.vault.getAllLoadedFiles()
            .filter(file => file.children)
            .map(folder => folder.path);
        
        return new Promise(resolve => {
            const modal = new FolderSuggestModal(this.app, folders, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }
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
