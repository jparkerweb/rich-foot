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
            text: 'After each update you\'ll be prompted with the release notes. You can disable this in the plugin settings.',
            cls: 'release-notes-instructions'
        });

        // Promotional links
        const promotionalLinks = contentEl.createEl('div');
        promotionalLinks.style.display = 'flex';
        promotionalLinks.style.flexDirection = 'row';
        promotionalLinks.style.justifyContent = 'space-around';

        const equilllabsLink = promotionalLinks.createEl('a', {
            href: 'https://www.equilllabs.com',
            target: '_blank',
        });
        equilllabsLink.createEl('img', {
            attr: {
                height: '36',
                style: 'border:0px;height:36px;',
                src: 'https://raw.githubusercontent.com/jparkerweb/pixel-banner/refs/heads/main/img/equilllabs.png?raw=true',
                border: '0',
                alt: 'eQuill-Labs'
            }
        });
        const discordLink = promotionalLinks.createEl('a', {
            href: 'https://discord.gg/sp8AQQhMJ7',
            target: '_blank',
        });
        discordLink.createEl('img', {
            attr: {
                height: '36',
                style: 'border:0px;height:36px;',
                src: 'https://raw.githubusercontent.com/jparkerweb/pixel-banner/refs/heads/main/img/discord.png?raw=true',
                border: '0',
                alt: 'Discord'
            }
        });
        const kofiLink = promotionalLinks.createEl('a', {
            href: 'https://ko-fi.com/Z8Z212UMBI',
            target: '_blank',
        });
        kofiLink.createEl('img', {
            attr: {
                height: '36',
                style: 'border:0px;height:36px;',
                src: 'https://raw.githubusercontent.com/jparkerweb/pixel-banner/refs/heads/main/img/support.png?raw=true',
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