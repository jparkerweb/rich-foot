const { Plugin, MarkdownView, debounce, Setting, PluginSettingTab, EditorView } = require('obsidian');

class RichFootSettings {
    constructor() {
        this.excludedFolders = [];
    }
}

class RichFootPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

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
        this.settings = Object.assign(new RichFootSettings(), await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    updateRichFoot() {
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

        const content = view.contentEl;
        let container;

        if (view.getMode() === 'preview') {
            container = content.querySelector('.markdown-preview-section');
        } else if (view.getMode() === 'source' || view.getMode() === 'live') {
            container = content.querySelector('.cm-scroller');
        }

        if (!container) {
            return;
        }

        // Remove any existing Rich Foot
        this.removeExistingRichFoot(container);

        // Create the Rich Foot
        const richFoot = this.createRichFoot(file);

        // Append the Rich Foot to the container
        container.appendChild(richFoot);

        // Set up a mutation observer for this specific container
        this.observeContainer(container);
    }

    removeExistingRichFoot(container) {
        const existingRichFoot = container.querySelector('.rich-foot');
        if (existingRichFoot) {
            existingRichFoot.remove();
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
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const backlinkList = resolvedLinks[file.path] || {};

        if (Object.keys(backlinkList).length > 0) {
            const backlinksDiv = richFoot.createDiv({ cls: 'rich-foot--backlinks' });
            const backlinksUl = backlinksDiv.createEl('ul');

            for (const [linkPath, count] of Object.entries(backlinkList)) {
                // Skip if the linkPath is the same as the current file's path
                if (linkPath === file.path) continue;

                if (this.shouldIncludeBacklink(linkPath)) {
                    const parts = linkPath.split('/');
                    const displayName = parts[parts.length - 1].slice(0, -3); // Remove '.md'
                    
                    const li = backlinksUl.createEl('li');
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

            // Only add the backlinks div if there are actually backlinks
            if (backlinksUl.childElementCount === 0) {
                backlinksDiv.remove();
            }
        }

        // Dates Wrapper
        const datesWrapper = richFoot.createDiv({ cls: 'rich-foot--dates-wrapper' });

        // Modified date
        const fileUpdate = new Date(file.stat.mtime);
        const modified = `${fileUpdate.toLocaleString('default', { month: 'long' })} ${fileUpdate.getDate()}, ${fileUpdate.getFullYear()}`;
        datesWrapper.createDiv({
            cls: 'rich-foot--modified-date',
            text: `${modified}`
        });

        // Created date
        const fileCreated = new Date(file.stat.ctime);
        const created = `${fileCreated.toLocaleString('default', { month: 'long' })} ${fileCreated.getDate()}, ${fileCreated.getFullYear()}`;
        datesWrapper.createDiv({
            cls: 'rich-foot--created-date',
            text: `${created}`
        });

        return richFoot;
    }

    shouldIncludeBacklink(linkPath) {
        return !this.settings.excludedFolders.some(folder => linkPath.startsWith(folder));
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

        // Add informative text
        const infoDiv = containerEl.createEl('div', { cls: 'rich-foot-info' });
        infoDiv.createEl('p', { text: 'Rich Foot adds a footer to your notes with useful information such as backlinks, creation date, and last modified date.' });

        new Setting(containerEl)
            .setName('Excluded folders')
            .setDesc('Enter folder paths to exclude from backlinks (one per line)')
            .addTextArea(text => text
                .setPlaceholder('folder1\nfolder2/subfolder')
                .setValue(this.plugin.settings.excludedFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value.split('\n').filter(folder => folder.trim() !== '');
                    await this.plugin.saveSettings();
                })
            );

        // Update the textarea size
        const textArea = containerEl.querySelector('textarea');
        if (textArea) {
            textArea.style.width = '400px';
            textArea.style.height = '250px';
        }
    }
}

module.exports = RichFootPlugin;
