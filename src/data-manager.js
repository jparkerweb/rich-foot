/**
 * RichFootDataManager
 * Handles all data fetching and parsing operations for the Rich Foot plugin.
 * Separates data concerns from rendering and view management.
 */

export class RichFootDataManager {
    constructor(app) {
        this.app = app;
    }

    /**
     * Get backlinks for a file
     * @param {TFile} file - The file to get backlinks for
     * @returns {Map} Map of backlink paths to their data
     */
    getBacklinks(file) {
        const backlinksData = this.app.metadataCache.getBacklinksForFile(file);
        return backlinksData?.data || new Map();
    }

    /**
     * Get all outlinks from a file (links, embeds, frontmatter, footnotes)
     * @param {TFile} file - The file to get outlinks from
     * @returns {Promise<Set>} Set of outlink paths
     */
    async getOutlinks(file) {
        const cache = this.app.metadataCache.getFileCache(file);
        const links = new Set();

        // Process regular links from cache
        if (cache?.links) {
            for (const link of cache.links) {
                this.addResolvedLink(link.link, file, links);
            }
        }

        // Process embedded notes
        if (cache?.embeds) {
            for (const embed of cache.embeds) {
                this.addResolvedLink(embed.link, file, links);
            }
        }

        // Process frontmatter links
        if (cache?.frontmatterLinks) {
            for (const link of cache.frontmatterLinks) {
                this.addResolvedLink(link.link, file, links);
            }
        }

        // Process footnote blocks from metadata cache
        if (cache?.blocks) {
            for (const block of Object.values(cache.blocks)) {
                if (block.type === 'footnote') {
                    this.extractWikiLinks(block.text, file, links);
                }
            }
        }

        // Process inline footnotes from file content
        const fileContent = await this.app.vault.read(file);
        this.processFootnotes(fileContent, file, links);

        return links;
    }

    /**
     * Add a resolved link to the set
     * @private
     */
    addResolvedLink(linkText, sourceFile, linksSet) {
        const linkPath = linkText.split('#')[0];
        const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, sourceFile.path);
        if (targetFile && targetFile.extension === 'md') {
            linksSet.add(targetFile.path);
        }
    }

    /**
     * Extract wiki links from text
     * @private
     */
    extractWikiLinks(text, sourceFile, linksSet) {
        const wikiLinkRegex = /\[\[(.*?)\]\]/g;
        let match;
        while ((match = wikiLinkRegex.exec(text)) !== null) {
            const linkText = match[1].trim();
            this.addResolvedLink(linkText, sourceFile, linksSet);
        }
    }

    /**
     * Process footnotes from file content
     * @private
     */
    processFootnotes(content, file, links) {
        // Match inline footnotes (nested brackets)
        const inlineFootnoteRegex = /\^\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]/g;
        const refFootnoteRegex = /\[\^[^\]]+\]:\s*((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)/g;

        let match;

        // Process inline footnotes
        while ((match = inlineFootnoteRegex.exec(content)) !== null) {
            const footnoteContent = match[1];
            this.extractWikiLinks(footnoteContent, file, links);
        }

        // Process reference footnotes
        while ((match = refFootnoteRegex.exec(content)) !== null) {
            const footnoteContent = match[1];
            this.extractWikiLinks(footnoteContent, file, links);
        }
    }

    /**
     * Get dates for a file (created and modified)
     * @param {TFile} file - The file to get dates for
     * @param {Object} settings - Plugin settings
     * @returns {Object} { created, modified } formatted dates
     */
    getDates(file, settings) {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        return {
            created: this.getFormattedDate(
                file,
                frontmatter,
                settings.customCreatedDateProp,
                'ctime',
                settings.dateDisplayFormat
            ),
            modified: this.getFormattedDate(
                file,
                frontmatter,
                settings.customModifiedDateProp,
                'mtime',
                settings.dateDisplayFormat
            )
        };
    }

    /**
     * Get a formatted date from frontmatter or file stats
     * @private
     */
    getFormattedDate(file, frontmatter, customProp, statProp, format) {
        let dateValue;

        // Try custom frontmatter property first
        if (customProp && frontmatter && frontmatter[customProp]) {
            const parsed = this.parseDate(frontmatter[customProp]);
            if (parsed) {
                dateValue = parsed;
            }
        }

        // Fallback to file stat
        if (!dateValue) {
            dateValue = new Date(file.stat[statProp]);
        }

        return this.formatDate(dateValue, format);
    }

    /**
     * Parse a date string with multiple format attempts
     * @param {string} value - Date string to parse
     * @returns {Date|null} Parsed date or null if invalid
     */
    parseDate(value) {
        if (!value) return null;

        let tempDate = String(value);

        // Try original string
        if (!isNaN(Date.parse(tempDate))) {
            return this.createDateWithTime(tempDate);
        }

        // Try replacing periods with hyphens (first two occurrences)
        tempDate = this.replaceNTimes(String(value), /\./g, '-', 2);
        if (!isNaN(Date.parse(tempDate))) {
            return this.createDateWithTime(tempDate);
        }

        // Try replacing forward slashes with hyphens (first two occurrences)
        tempDate = this.replaceNTimes(String(value), /\//g, '-', 2);
        if (!isNaN(Date.parse(tempDate))) {
            return this.createDateWithTime(tempDate);
        }

        return null;
    }

    /**
     * Replace pattern N times in a string
     * @private
     */
    replaceNTimes(str, pattern, replacement, times) {
        let count = 0;
        return str.replace(pattern, (match) => {
            count++;
            return count <= times ? replacement : match;
        });
    }

    /**
     * Create date object and add midnight time if no time component exists
     * @private
     */
    createDateWithTime(dateStr) {
        let tempDate = dateStr;
        if (!tempDate.includes('T') && !tempDate.includes(' ')) {
            tempDate = `${tempDate}T00:00:00`;
        }
        return new Date(tempDate);
    }

    /**
     * Format a date according to the specified format
     * @param {Date} date - Date to format
     * @param {string} format - Format string
     * @returns {string} Formatted date string
     */
    formatDate(date, format) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth();
        const day = d.getDate();
        const weekday = d.getDay();

        const months = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
        const monthsShort = months.map(m => m.slice(0, 3));
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdaysShort = weekdays.map(w => w.slice(0, 3));

        const pad = (num) => num.toString().padStart(2, '0');

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

        const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);

        let result = format.toLowerCase();
        const replacements = new Map();

        sortedTokens.forEach((token, index) => {
            const placeholder = `__${index}__`;
            replacements.set(placeholder, tokens[token]);
            result = result.replace(new RegExp(token, 'gi'), placeholder);
        });

        replacements.forEach((value, placeholder) => {
            result = result.replace(new RegExp(placeholder, 'g'), value);
        });

        return result;
    }
}
