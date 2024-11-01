import { Modal, Setting, MarkdownRenderer } from 'obsidian';

export class ReleaseNotesModal extends Modal {
    constructor(app, plugin, version, releaseNotes) {
        super(app);
        this.plugin = plugin;
        this.version = version;
        this.releaseNotes = releaseNotes;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Header
        contentEl.createEl('h2', { text: `Welcome to 🦶 Rich Foot v${this.version}` });

        // Message
        contentEl.createEl('p', { 
            text: 'After each update you\'ll be prompted with the release notes. You can disable this in the plugin settings.' 
        });

        // Ko-fi container
        const kofiContainer = contentEl.createEl('div');
        kofiContainer.style.textAlign = 'right';

        const kofiLink = kofiContainer.createEl('a', {
            href: 'https://ko-fi.com/jparkerweb',
            target: '_blank',
        });
        kofiLink.createEl('img', {
            attr: {
                height: '36',
                style: 'border:0px;height:36px;',
                src: 'https://raw.githubusercontent.com/jparkerweb/rich-foot/refs/heads/main/img/support.png',
                border: '0',
                alt: 'Buy Me a Coffee at ko-fi.com'
            }
        });

        // Release notes content
        const notesContainer = contentEl.createDiv('release-notes-container');
        await MarkdownRenderer.renderMarkdown(
            this.releaseNotes,
            notesContainer,
            '',
            this.plugin,
            this
        );

        // Add some spacing
        contentEl.createEl('div', { cls: 'release-notes-spacer' }).style.height = '20px';

        // Close button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Close')
                .onClick(() => this.close()));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 