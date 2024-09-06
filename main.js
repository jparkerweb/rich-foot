const { Plugin, MarkdownView, debounce, Setting, PluginSettingTab } = require('obsidian');

class RichFootSettings {
    constructor() {
        this.excludedFolders = [];
    }
}

class RichFootPlugin extends Plugin {
    async onload() {
        console.log('Loading Rich Foot plugin');

        await this.loadSettings();

        this.updateRichFoot = debounce(this.updateRichFoot.bind(this), 100, true);

        this.addSettingTab(new RichFootSettingTab(this.app, this));

        this.registerEvent(
            this.app.workspace.on('layout-change', this.updateRichFoot)
        );

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', this.updateRichFoot)
        );

        this.registerEvent(
            this.app.workspace.on('file-open', this.updateRichFoot)
        );

        this.contentObserver = new MutationObserver(this.updateRichFoot);

        console.log('Rich Foot plugin loaded');
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
        if (view.getMode() !== 'preview') {
            return;
        }

        const file = view.file;
        if (!file || !file.path) {
            console.log('No valid file provided, skipping');
            return;
        }

        const content = view.contentEl;
        const markdownPreviewSection = content.querySelector('.markdown-preview-section');

        if (!markdownPreviewSection) {
            console.log('Markdown preview section not found, skipping');
            return;
        }

        // Remove any existing Rich Foot
        this.removeExistingRichFoot(markdownPreviewSection);

        // Create and add the Rich Foot
        this.createRichFoot(file, markdownPreviewSection);

        // Observe the markdown preview section for changes
        this.contentObserver.disconnect();
        this.contentObserver.observe(markdownPreviewSection, { childList: true, subtree: true });
    }

    removeExistingRichFoot(container) {
        const existingRichFoot = container.querySelector('.rich-foot');
        if (existingRichFoot) {
            existingRichFoot.remove();
        }
    }

    createRichFoot(file, container) {
        console.log('Creating Rich Foot for', file.path);

        const richFoot = createDiv({ cls: 'rich-foot' });

        // Backlinks
        const backlinkList = this.app.metadataCache.getBacklinksForFile(file);
        console.log('Backlink list:', backlinkList);

        if (backlinkList && backlinkList.data && Object.keys(backlinkList.data).length > 0) {
            console.log('Backlinks found, creating list');
            const backlinksDiv = richFoot.createDiv({ cls: 'rich-foot--backlinks' });
            const backlinksUl = backlinksDiv.createEl('ul');

            for (const [linkPath, backlinks] of Object.entries(backlinkList.data)) {
                console.log('Processing backlink:', linkPath);
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
                    console.log('Added backlink:', displayName);
                }
            }
        } else {
            console.log('No backlinks found');
        }

        // Modified date
        const fileUpdate = new Date(file.stat.mtime);
        const modified = `${fileUpdate.toLocaleString('default', { month: 'long' })} ${fileUpdate.getDate()}, ${fileUpdate.getFullYear()}`;
        richFoot.createDiv({
            cls: 'rich-foot--modified-date',
            text: `${modified}`
        });

        // Created date
        const fileCreated = new Date(file.stat.ctime);
        const created = `${fileCreated.toLocaleString('default', { month: 'long' })} ${fileCreated.getDate()}, ${fileCreated.getFullYear()}`;
        richFoot.createDiv({
            cls: 'rich-foot--created-date',
            text: `${created}`
        });

        container.appendChild(richFoot);
        console.log('Rich Foot added successfully');
    }

    shouldIncludeBacklink(linkPath) {
        return !this.settings.excludedFolders.some(folder => linkPath.startsWith(folder));
    }

    onunload() {
        this.contentObserver.disconnect();
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
        containerEl.createEl('h2', { text: 'Rich Foot Settings' });

        new Setting(containerEl)
            .setName('Excluded Folders')
            .setDesc('Enter folder paths to exclude from backlinks (one per line)')
            .addTextArea(text => text
                .setPlaceholder('folder1\nfolder2/subfolder')
                .setValue(this.plugin.settings.excludedFolders.join('\n'))
                .onChange(async (value) => {
                    this.plugin.settings.excludedFolders = value.split('\n').filter(folder => folder.trim() !== '');
                    await this.plugin.saveSettings();
                })
            );
    }
}

module.exports = RichFootPlugin;
