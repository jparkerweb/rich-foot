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
        // Derive backlinks from the public resolvedLinks graph (source -> { target: count })
        // rather than the private getBacklinksForFile().data internal Map.
        const resolvedLinks = this.app.metadataCache.resolvedLinks;
        const backlinks = new Map();

        for (const sourcePath in resolvedLinks) {
            const targets = resolvedLinks[sourcePath];
            if (targets[file.path]) {
                backlinks.set(sourcePath, targets[file.path]);
            }
        }

        return backlinks;
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

        // Process inline footnotes from file content. Use cachedRead (Obsidian's
        // recommended API when parsing for display) so we don't hit disk on every
        // footer refresh — important on mobile, where the plugin is also supported.
        const fileContent = await this.app.vault.cachedRead(file);
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
     * Group a list of items (each with a linkPath pointing at a backlinked note)
     * into named groups, either by the folder the linking note lives in or by
     * a frontmatter property set on the linking note.
     * @param {Array<Object>} items - Items with a `linkPath` property
     * @param {Object} settings - Plugin settings
     * @returns {Array<[string, Array<Object>]>} Sorted [groupName, items] entries,
     *   with the fallback group (if present) always sorted last
     */
    groupItemsByPath(items, settings) {
        const groupsMap = new Map();

        for (const item of items) {
            const groupNames = this.getGroupNamesForPath(item.linkPath, settings);
            for (const groupName of groupNames) {
                if (!groupsMap.has(groupName)) {
                    groupsMap.set(groupName, []);
                }
                groupsMap.get(groupName).push(item);
            }
        }

        return this.sortGroups(groupsMap, settings);
    }

    /**
     * Determine which group(s) a linked note belongs to
     * @private
     * @returns {Array<string>} One or more group names (more than one only
     *   when grouping by a property that holds a list)
     */
    getGroupNamesForPath(filePath, settings) {
        if (settings.groupBacklinksBy === 'property') {
            return this.getPropertyGroupNames(filePath, settings);
        }
        return [this.getFolderGroupName(filePath)];
    }

    /**
     * Get the folder group name for a file path
     * @private
     */
    getFolderGroupName(filePath) {
        const lastSlash = filePath.lastIndexOf('/');
        return lastSlash === -1 ? '/' : filePath.substring(0, lastSlash);
    }

    /**
     * Get the property-based group name(s) for a file, falling back to the
     * configured fallback label when the property isn't set
     * @private
     */
    getPropertyGroupNames(filePath, settings) {
        const fallback = settings.groupFallbackLabel || 'Property Not Set';
        const propName = settings.groupByProperty;
        if (!propName) return [fallback];

        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file) return [fallback];

        const cache = this.app.metadataCache.getFileCache(file);
        const value = cache?.frontmatter?.[propName];

        if (value === undefined || value === null || value === '') {
            return [fallback];
        }

        if (Array.isArray(value)) {
            const names = value
                .filter(v => v !== undefined && v !== null && v !== '')
                .map(v => String(v));
            return names.length ? names : [fallback];
        }

        return [String(value)];
    }

    /**
     * Sort group entries alphabetically, always placing the fallback group last
     * @private
     */
    sortGroups(groupsMap, settings) {
        const fallback = settings.groupFallbackLabel || 'Property Not Set';
        const entries = Array.from(groupsMap.entries());

        entries.sort(([nameA], [nameB]) => {
            if (nameA === fallback && nameB !== fallback) return 1;
            if (nameB === fallback && nameA !== fallback) return -1;
            return nameA.localeCompare(nameB);
        });

        return entries;
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
