import { Component, debounce } from 'obsidian';

export class RichFootComponent extends Component {
    constructor(view, plugin) {
        super();
        this.view = view;
        this.plugin = plugin;
        this.container = null;
        
        // Create two different debounced renders with maxWait
        this.debouncedEditRender = debounce(
            () => this.render(),
            this.plugin.settings.updateDelay,
            { maxWait: this.plugin.settings.updateDelay }
        );
        
        // Quick render for non-edit events (300ms is a good balance)
        this.quickRender = debounce(
            () => this.render(),
            150
        );
    }

    async onload() {
        try {
            if (this.plugin.shouldExcludeFile(this.view.file.path)) {
                return;
            }

            const contentEl = this.view.contentEl;
            const isEditMode = this.view.getMode() === 'source';
            
            // Find the appropriate container based on mode
            let targetEl;
            
            if (isEditMode) {
                // In edit mode, find the cm-sizer element
                const cmSizer = contentEl.querySelector('.cm-sizer');
                if (cmSizer) {
                    targetEl = cmSizer;
                } else {
                    targetEl = contentEl;
                }
            } else {
                targetEl = contentEl.querySelector('.markdown-preview-sizer') || contentEl;
            }
            
            if (!targetEl) {
                console.error('Could not find target element for footer');
                return;
            }
            
            // Clean up any existing footer
            const existingFooter = targetEl.querySelector('.rich-foot');
            if (existingFooter) {
                existingFooter.remove();
            }
            
            // Create the container
            this.container = document.createElement('div');
            this.container.addClass('rich-foot', 'rich-foot--hidden');
            
            // Append the container
            targetEl.appendChild(this.container);
            
            // Modify the editor change listener section
            if (this.view.getMode() === 'source') {
                const editorView = this.view.editor.cm;
                
                // Use one listener instead of potentially multiple
                const listener = () => {
                    // Cancel any pending render and start a new one
                    this.debouncedEditRender.cancel();
                    this.debouncedEditRender();
                };
                
                this.registerEvent(
                    editorView.dom.addEventListener('keyup', listener)
                );
            }

            // Initial render - use quick render
            await this.quickRender();
        } catch (error) {
            console.error('Error loading RichFoot component:', error);
            this.container?.remove();
        }
    }

    onunload() {
        // Clean up the container
        this.container?.remove();
        this.container = null;
    }

    async render() {
        try {
            if (this.plugin.shouldExcludeFile(this.view.file.path)) {
                this.container?.remove();
                return;
            }

            if (!this.container) {
                console.error('No container element found');
                return;
            }

            // If we're not in source mode, use quickRender for subsequent renders
            if (this.view.getMode() !== 'source') {
                this.debouncedEditRender.cancel(); // Cancel any pending edit renders
            }

            this.hide(); // Hide while rendering
            this.container.empty(); // Clear existing content

            this.container.createDiv({ cls: 'rich-foot--dashed-line' });

            // Get links data
            const { backlinksData, outlinks } = await this.getLinksData();

            // Handle links based on settings
            if (this.plugin.settings.combineLinks) {
                // Combined links view
                if ((backlinksData?.data && backlinksData.data.size > 0) || outlinks.size > 0) {
                    const linksDiv = this.container.createDiv({ cls: 'rich-foot--links' });
                    const linksList = linksDiv.createEl('ul');
                    
                    // Add backlinks
                    if (backlinksData?.data) {
                        for (const [linkPath] of backlinksData.data) {
                            if (!linkPath.endsWith('.md')) continue;
                            const li = linksList.createEl('li');
                            const link = li.createEl('a', {
                                cls: 'internal-link',
                                href: linkPath,
                                text: linkPath.split('/').pop().replace('.md', '')
                            });
                            link.dataset.href = linkPath;
                            link.dataset.sourcePath = this.view.file.path;
                            link.dataset.isBacklink = 'true';
                            // If it's also an outlink, mark it as both
                            if (outlinks.has(linkPath)) {
                                link.dataset.isOutlink = 'true';
                            }
                            this.setupLinkBehavior(link, linkPath);
                        }
                    }
                    
                    // Add outlinks
                    for (const linkPath of outlinks) {
                        // Only add outlinks that aren't already shown as backlinks
                        if (!backlinksData?.data?.has(linkPath)) {
                            const li = linksList.createEl('li');
                            const link = li.createEl('a', {
                                cls: 'internal-link',
                                href: linkPath,
                                text: linkPath.split('/').pop().replace('.md', '')
                            });
                            link.dataset.href = linkPath;
                            link.dataset.sourcePath = this.view.file.path;
                            link.dataset.isOutlink = 'true';
                            this.setupLinkBehavior(link, linkPath);
                        }
                    }
                }
            } else {
                // Separate links view
                // Add backlinks if we have any
                if (this.plugin.settings.showBacklinks && backlinksData?.data && backlinksData.data.size > 0) {
                    const backlinksDiv = this.container.createDiv({ cls: 'rich-foot--backlinks' });
                    const backlinksUl = backlinksDiv.createEl('ul');
                    for (const [linkPath] of backlinksData.data) {
                        if (!linkPath.endsWith('.md')) continue;
                        const li = backlinksUl.createEl('li');
                        const link = li.createEl('a', {
                            cls: 'internal-link',
                            href: linkPath,
                            text: linkPath.split('/').pop().replace('.md', '')
                        });
                        link.dataset.href = linkPath;
                        link.dataset.sourcePath = this.view.file.path;
                        this.setupLinkBehavior(link, linkPath);
                    }
                }

                // Add outlinks if we have any
                if (this.plugin.settings.showOutlinks && outlinks && outlinks.size > 0) {
                    const outlinksDiv = this.container.createDiv({ cls: 'rich-foot--outlinks' });
                    const outlinksUl = outlinksDiv.createEl('ul');
                    for (const linkPath of outlinks) {
                        const li = outlinksUl.createEl('li');
                        const link = li.createEl('a', {
                            cls: 'internal-link',
                            href: linkPath,
                            text: linkPath.split('/').pop().replace('.md', '')
                        });
                        link.dataset.href = linkPath;
                        link.dataset.sourcePath = this.view.file.path;
                        this.setupLinkBehavior(link, linkPath);
                    }
                }
            }

            // Add dates wrapper and dates
            if (this.plugin.settings.showDates) {
                const datesWrapper = this.container.createDiv({ cls: 'rich-foot--dates-wrapper' });
                
                // Get dates from file stats or custom frontmatter properties
                const modifiedDate = this.getFormattedDate(
                    this.view.file.stat.mtime,
                    this.plugin.settings.customModifiedDateProp
                );

                const createdDate = this.getFormattedDate(
                    this.view.file.stat.ctime,
                    this.plugin.settings.customCreatedDateProp
                );

                // Add dates to wrapper
                datesWrapper.createDiv({
                    cls: 'rich-foot--modified-date',
                    text: modifiedDate
                });

                datesWrapper.createDiv({
                    cls: 'rich-foot--created-date',
                    text: createdDate
                });
            }

            this.show(); // Show after rendering is complete

            // Adjust padding in preview mode
            if (this.view.getMode() !== 'source') {
                this.plugin.adjustFooterPadding();
            }
        } catch (error) {
            console.error('Error rendering RichFoot component:', error);
            // Clean up on error
            this.container?.empty();
            this.container?.createEl('div', {
                cls: 'rich-foot-error',
                text: 'Error rendering footer'
            });
        }
    }

    async getLinksData() {
        const file = this.view.file;
        if (!file) {
            return;
        }

        // Get backlinks and outlinks data
        const backlinksData = this.plugin.app.metadataCache.getBacklinksForFile(file);
        const outlinks = await this.plugin.getOutlinks(file);

        return { backlinksData, outlinks };
    }

    setupLinkBehavior(link, linkPath) {
        if (this.view.getMode() === 'source') {
            let hoverTimeout = null;
            
            link.addEventListener('mouseover', (mouseEvent) => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                
                hoverTimeout = setTimeout(() => {
                    this.plugin.app.workspace.trigger('hover-link', {
                        event: mouseEvent,
                        source: 'rich-foot',
                        hoverParent: link,
                        targetEl: link,
                        linktext: linkPath
                    });
                }, 300);
            });
            
            link.addEventListener('mouseout', () => {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
            });
        }

        link.addEventListener('click', (event) => {
            event.preventDefault();
            this.plugin.app.workspace.openLinkText(linkPath, this.view.file.path);
        });
    }

    getFormattedDate(defaultDate, customProp) {
        // Check for custom date in frontmatter if property is specified
        if (customProp) {
            const cache = this.plugin.app.metadataCache.getFileCache(this.view.file);
            const frontmatter = cache?.frontmatter;
            if (frontmatter && frontmatter[customProp]) {
                const customDate = frontmatter[customProp];
                // Try to parse the custom date
                const d = new Date(customDate);
                if (!isNaN(d.getTime())) {
                    return this.formatDate(d, this.plugin.settings.dateDisplayFormat);
                }
                // If parsing fails, return the raw value
                return customDate;
            }
        }

        // Use file stat date as fallback
        return this.formatDate(new Date(defaultDate), this.plugin.settings.dateDisplayFormat);
    }

    formatDate(date, format) {
        const d = date;
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

    show() {
        if (this.container) {
            requestAnimationFrame(() => {
                this.container.removeClass('rich-foot--hidden');
                this.container.style.removeProperty('display');
                // Force a reflow
                this.container.style.opacity = '0';
                requestAnimationFrame(() => {
                    this.container.style.opacity = '1';
                });
            });
        }
    }

    hide() {
        if (this.container) {
            this.container.addClass('rich-foot--hidden');
            this.container.style.display = 'none';
        }
    }
}
