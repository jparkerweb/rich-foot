import { PluginSettingTab, Setting, FuzzySuggestModal, Notice } from 'obsidian';
import { ReleaseNotesModal } from './modals';
import { resolveCssVar } from './utils';

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
    limitLinks: false,
    linksLimit: 10,
    updateDelay: 3000,
    excludedParentSelectors: [],
    frontmatterExclusionField: '',
};




export class RichFootSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.excludedParentSelectors = [];
        this.frontmatterExclusionField = '';
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass('rich-foot-settings');

        containerEl.createEl('div', { cls: 'rich-foot-info', text: '🦶 Rich Foot adds a footer to your notes with useful information such as backlinks, creation date, and last modified date. Use the settings below to customize the appearance.' });

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

        new Setting(containerEl)
            .setName('Limit Links Shown')
            .setDesc('Limit the number of backlinks/outlinks shown in the footer. Surplus links are hidden behind a "Show More" button that expands them on click.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.limitLinks)
                .onChange(async (value) => {
                    this.plugin.settings.limitLinks = value;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                }));

        let linksLimitInput;
        new Setting(containerEl)
            .setName('Links Limit')
            .setDesc('Maximum number of links to show before the "Show More" button (only applies when "Limit Links Shown" is enabled)')
            .addText(text => {
                linksLimitInput = text;
                text.setPlaceholder('10')
                    .setValue(String(this.plugin.settings.linksLimit))
                    .onChange(async (value) => {
                        const numValue = Math.floor(Number(value));
                        if (!isNaN(numValue) && numValue > 0) {
                            this.plugin.settings.linksLimit = numValue;
                            await this.plugin.saveSettings();
                            await this.plugin.updateRichFoot();
                        }
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linksLimit = DEFAULT_SETTINGS.linksLimit;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    if (linksLimitInput) {
                        linksLimitInput.setValue(String(DEFAULT_SETTINGS.linksLimit));
                    }
                }));

        let updateDelayInput;
        new Setting(containerEl)
            .setName('Rich-foot update delay')
            .setDesc('Delay in milliseconds before updating the rich-foot in edit mode (lower values may impact performance)')
            .addText(text => {
                updateDelayInput = text;
                text.setPlaceholder('3000')
                    .setValue(String(this.plugin.settings.updateDelay))
                    .onChange(async (value) => {
                        const numValue = Math.floor(Number(value));
                        if (!isNaN(numValue) && numValue > 0) {
                            // The edit-mode debounce in main.js reads settings.updateDelay
                            // live on each editor-change, so saving is all that's needed.
                            this.plugin.settings.updateDelay = numValue;
                            await this.plugin.saveSettings();
                        }
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.updateDelay = DEFAULT_SETTINGS.updateDelay;
                    await this.plugin.saveSettings();
                    if (updateDelayInput) {
                        updateDelayInput.setValue(String(DEFAULT_SETTINGS.updateDelay));
                    }
                }));

        containerEl.createEl('hr');

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
                    const example = this.plugin.dataManager.formatDate(today, format);
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

        containerEl.createEl('hr');

        // Style Settings
        containerEl.createEl('h3', { text: 'Style Settings' });

        // Border Width
        let borderWidthSlider;
        new Setting(containerEl)
            .setName('Border Width')
            .setDesc('Adjust the width of the footer border (1-10px)')
            .addSlider(slider => {
                borderWidthSlider = slider;
                slider.setLimits(1, 10, 1)
                    .setValue(this.plugin.settings.borderWidth)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.borderWidth = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderWidth = DEFAULT_SETTINGS.borderWidth;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    borderWidthSlider.setValue(DEFAULT_SETTINGS.borderWidth);
                }));

        // Border Style
        let borderStyleDropdown;
        new Setting(containerEl)
            .setName('Border Style')
            .setDesc('Choose the style of the footer border')
            .addDropdown(dropdown => {
                borderStyleDropdown = dropdown;
                dropdown.addOptions({
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
                });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderStyle = DEFAULT_SETTINGS.borderStyle;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    borderStyleDropdown.setValue(DEFAULT_SETTINGS.borderStyle);
                }));

        // Border Opacity
        let borderOpacitySlider;
        new Setting(containerEl)
            .setName('Border Opacity')
            .setDesc('Adjust the opacity of the footer border (0-1)')
            .addSlider(slider => {
                borderOpacitySlider = slider;
                slider.setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.borderOpacity)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.borderOpacity = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderOpacity = DEFAULT_SETTINGS.borderOpacity;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    borderOpacitySlider.setValue(DEFAULT_SETTINGS.borderOpacity);
                }));

        // Border Color
        let borderColorPicker;
        new Setting(containerEl)
            .setName('Border Color')
            .setDesc('Choose the color for the footer border')
            .addColorPicker(color => {
                borderColorPicker = color;
                color.setValue(this.plugin.settings.borderColor.startsWith('var(--')
                        ? resolveCssVar('var(--text-accent)', 'borderColor')
                        : this.plugin.settings.borderColor)
                    .onChange(async (value) => {
                        this.plugin.settings.borderColor = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderColor = DEFAULT_SETTINGS.borderColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    borderColorPicker.setValue(resolveCssVar('var(--text-accent)', 'borderColor'));
                }));

        // Link Border Radius
        let borderRadiusSlider;
        new Setting(containerEl)
            .setName('Link Border Radius')
            .setDesc('Adjust the border radius of Backlinks and Outlinks (0-15px)')
            .addSlider(slider => {
                borderRadiusSlider = slider;
                slider.setLimits(0, 15, 1)
                    .setValue(this.plugin.settings.borderRadius)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.borderRadius = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.borderRadius = DEFAULT_SETTINGS.borderRadius;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    borderRadiusSlider.setValue(DEFAULT_SETTINGS.borderRadius);
                }));

        // Links Opacity
        let linksOpacitySlider;
        new Setting(containerEl)
            .setName('Links Opacity')
            .setDesc('Adjust the opacity of Backlinks and Outlinks (0-1)')
            .addSlider(slider => {
                linksOpacitySlider = slider;
                slider.setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.linksOpacity)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.linksOpacity = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linksOpacity = DEFAULT_SETTINGS.linksOpacity;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    linksOpacitySlider.setValue(DEFAULT_SETTINGS.linksOpacity);
                }));

        // Link Text Color
        let linkColorPicker;
        new Setting(containerEl)
            .setName('Link Text Color')
            .setDesc('Choose the color for link text')
            .addColorPicker(color => {
                linkColorPicker = color;
                color.setValue(this.plugin.settings.linkColor.startsWith('var(--')
                        ? resolveCssVar('var(--link-color)', 'color')
                        : this.plugin.settings.linkColor)
                    .onChange(async (value) => {
                        this.plugin.settings.linkColor = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkColor = DEFAULT_SETTINGS.linkColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    linkColorPicker.setValue(resolveCssVar('var(--link-color)', 'color'));
                }));

        // Link Background Color
        let linkBackgroundColorPicker;
        new Setting(containerEl)
            .setName('Link Background Color')
            .setDesc('Choose the background color for links')
            .addColorPicker(color => {
                linkBackgroundColorPicker = color;
                color.setValue(this.plugin.settings.linkBackgroundColor.startsWith('var(--')
                        ? resolveCssVar('var(--tag-background)', 'backgroundColor')
                        : this.plugin.settings.linkBackgroundColor)
                    .onChange(async (value) => {
                        this.plugin.settings.linkBackgroundColor = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkBackgroundColor = DEFAULT_SETTINGS.linkBackgroundColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    linkBackgroundColorPicker.setValue(resolveCssVar('var(--tag-background)', 'backgroundColor'));
                }));

        // Link Border Color
        let linkBorderColorPicker;
        new Setting(containerEl)
            .setName('Link Border Color')
            .setDesc('Choose the border color for links')
            .addColorPicker(color => {
                linkBorderColorPicker = color;
                color.setValue(this.plugin.settings.linkBorderColor.startsWith('rgba(')
                        ? resolveCssVar(this.plugin.settings.linkBorderColor, 'borderColor')
                        : this.plugin.settings.linkBorderColor)
                    .onChange(async (value) => {
                        this.plugin.settings.linkBorderColor = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.linkBorderColor = DEFAULT_SETTINGS.linkBorderColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    linkBorderColorPicker.setValue(resolveCssVar(DEFAULT_SETTINGS.linkBorderColor, 'borderColor'));
                }));

        // Dates Opacity
        let datesOpacitySlider;
        new Setting(containerEl)
            .setName('Dates Opacity')
            .setDesc('Adjust the opacity of the Created / Modified Dates (0-1)')
            .addSlider(slider => {
                datesOpacitySlider = slider;
                slider.setLimits(0, 1, 0.1)
                    .setValue(this.plugin.settings.datesOpacity)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.datesOpacity = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.datesOpacity = DEFAULT_SETTINGS.datesOpacity;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    datesOpacitySlider.setValue(DEFAULT_SETTINGS.datesOpacity);
                }));

        // Date Color
        let dateColorPicker;
        new Setting(containerEl)
            .setName('Date Color')
            .setDesc('Choose the color for Created / Modified Dates')
            .addColorPicker(color => {
                dateColorPicker = color;
                color.setValue(this.plugin.settings.dateColor.startsWith('var(--')
                        ? resolveCssVar('var(--text-accent)', 'color')
                        : this.plugin.settings.dateColor)
                    .onChange(async (value) => {
                        this.plugin.settings.dateColor = value;
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.dateColor = DEFAULT_SETTINGS.dateColor;
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    dateColorPicker.setValue(resolveCssVar('var(--text-accent)', 'color'));
                }));

        containerEl.createEl('hr');
        
        // Exclusions
        containerEl.createEl('h3', { text: 'Exclusion Rules' });

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


        // Frontmatter Exclusion Field
        containerEl.createEl('h4', { text: 'Exclude Rich Foot via Frontmatter' });
        let frontmatterExclusionInput;
        new Setting(containerEl)
            .setName('Frontmatter Exclusion Field')
            .setDesc('If this frontmatter field exists and has a truthy value (true, yes, 1, on), Rich Foot will not be shown on that note')
            .addText(text => {
                frontmatterExclusionInput = text;
                text.setPlaceholder('e.g., exclude-rich-foot')
                    .setValue(this.plugin.settings.frontmatterExclusionField)
                    .onChange(async (value) => {
                        this.plugin.settings.frontmatterExclusionField = value.trim();
                        await this.plugin.saveSettings();
                        await this.plugin.updateRichFoot();
                    });
            })
            .addButton(button => button
                .setButtonText('Reset')
                .onClick(async () => {
                    this.plugin.settings.frontmatterExclusionField = '';
                    await this.plugin.saveSettings();
                    await this.plugin.updateRichFoot();
                    if (frontmatterExclusionInput) {
                        frontmatterExclusionInput.setValue('');
                    }
                }));

        // Excluded Parent Selectors Section
        containerEl.createEl('h4', { text: 'Excluded Parent Selectors' });
        containerEl.createEl('p', { 
            text: 'Rich Foot will not be added to notes that have any of these parent selectors in their DOM hierarchy. Useful for compatibility with other plugins.',
            cls: 'setting-item-description'
        });
        
        // Create container for excluded selectors list
        const excludedSelectorsContainer = containerEl.createDiv('excluded-selectors-container');
        
        // Display current excluded selectors
        if (this.plugin.settings?.excludedParentSelectors) {
            this.plugin.settings.excludedParentSelectors.forEach((selector, index) => {
                const selectorDiv = excludedSelectorsContainer.createDiv('excluded-selector-item');
                selectorDiv.createSpan({ text: selector });
                
                const deleteButton = selectorDiv.createEl('button', {
                    text: 'Delete',
                    cls: 'excluded-selector-delete'
                });
                
                deleteButton.addEventListener('click', async () => {
                    this.plugin.settings.excludedParentSelectors.splice(index, 1);
                    await this.plugin.saveSettings();
                    this.display();
                });
            });
        }

        // CSS selector section
        const newSelectorSetting = new Setting(containerEl)
            .setName('Add excluded parent selector')
            .setDesc('Enter a CSS selector (e.g., .some-class, #some-id, [data-type="special"])')
            .addText(text => text
                .setPlaceholder('Enter selector')
                .onChange(() => {
                    // Validate selector when it changes
                    try {
                        document.querySelector(text.getValue());
                        text.inputEl.removeClass('rich-foot-input-error');
                    } catch (e) {
                        text.inputEl.addClass('rich-foot-input-error');
                    }
                }))
            .addButton(button => button
                .setButtonText('Add')
                .onClick(async () => {
                    const textComponent = newSelectorSetting.components[0];
                    const newSelector = textComponent.getValue().trim();
                    
                    if (!newSelector) return;

                    // Validate selector
                    try {
                        document.querySelector(newSelector);
                    } catch (e) {
                        new Notice('Invalid CSS selector');
                        return;
                    }
                    
                    if (!this.plugin.settings.excludedParentSelectors.includes(newSelector)) {
                        this.plugin.settings.excludedParentSelectors.push(newSelector);
                        await this.plugin.saveSettings();
                        textComponent.setValue('');
                        this.display();
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
