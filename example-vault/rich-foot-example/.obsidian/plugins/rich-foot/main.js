/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/modals.js
var import_obsidian = require("obsidian");
var ReleaseNotesModal = class extends import_obsidian.Modal {
  constructor(app, plugin, version, releaseNotes2) {
    super(app);
    this.plugin = plugin;
    this.version = version;
    this.releaseNotes = releaseNotes2;
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: `Welcome to \u{1F9B6} Rich Foot v${this.version}` });
    contentEl.createEl("p", {
      text: "After each update you'll be prompted with the release notes. You can disable this in the plugin settings.",
      cls: "release-notes-instructions"
    });
    const promotionalLinks = contentEl.createEl("div");
    promotionalLinks.style.display = "flex";
    promotionalLinks.style.flexDirection = "row";
    promotionalLinks.style.justifyContent = "space-around";
    const equilllabsLink = promotionalLinks.createEl("a", {
      href: "https://www.equilllabs.com",
      target: "_blank"
    });
    equilllabsLink.createEl("img", {
      attr: {
        height: "36",
        style: "border:0px;height:36px;",
        src: "https://raw.githubusercontent.com/jparkerweb/pixel-banner/refs/heads/main/img/equilllabs.png?raw=true",
        border: "0",
        alt: "eQuill-Labs"
      }
    });
    const discordLink = promotionalLinks.createEl("a", {
      href: "https://discord.gg/sp8AQQhMJ7",
      target: "_blank"
    });
    discordLink.createEl("img", {
      attr: {
        height: "36",
        style: "border:0px;height:36px;",
        src: "https://raw.githubusercontent.com/jparkerweb/pixel-banner/refs/heads/main/img/discord.png?raw=true",
        border: "0",
        alt: "Discord"
      }
    });
    const kofiLink = promotionalLinks.createEl("a", {
      href: "https://ko-fi.com/Z8Z212UMBI",
      target: "_blank"
    });
    kofiLink.createEl("img", {
      attr: {
        height: "36",
        style: "border:0px;height:36px;",
        src: "https://raw.githubusercontent.com/jparkerweb/pixel-banner/refs/heads/main/img/support.png?raw=true",
        border: "0",
        alt: "Buy Me a Coffee at ko-fi.com"
      }
    });
    const notesContainer = contentEl.createDiv("release-notes-container");
    await import_obsidian.MarkdownRenderer.renderMarkdown(
      this.releaseNotes,
      notesContainer,
      "",
      this.plugin,
      this
    );
    contentEl.createEl("div", { cls: "release-notes-spacer" }).style.height = "20px";
    new import_obsidian.Setting(contentEl).addButton((btn) => btn.setButtonText("Close").onClick(() => this.close()));
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};

// virtual-module:virtual:release-notes
var releaseNotes = '<h2>\u{1FAE3} Page Preview Support</h2>\n<h3>[1.8.1] - 2024-11-30</h3>\n<h4>\u{1F41B} Fixed</h4>\n<ul>\n<li><code>Page Preview</code> not displaying properly in <code>editing mode</code></li>\n</ul>\n<h3>[1.8.0] - 2024-11-29</h3>\n<h4>\u2728 Added</h4>\n<ul>\n<li>Support for <code>Page Preview</code> core plugin for <code>Outlinks</code> &amp; <code>Backlinks</code></li>\n</ul>\n<p><a href="https://raw.githubusercontent.com/jparkerweb/rich-foot/refs/heads/main/img/releases/rich-foot-v1.8.0.jpg"><img src="https://raw.githubusercontent.com/jparkerweb/rich-foot/refs/heads/main/img/releases/rich-foot-v1.8.0.jpg" alt="screenshot"></a></p>\n';

// src/settings.js
var import_obsidian2 = require("obsidian");
var DEFAULT_SETTINGS = {
  borderWidth: 1,
  borderStyle: "dashed",
  borderOpacity: 1,
  borderRadius: 15,
  datesOpacity: 1,
  linksOpacity: 1,
  showReleaseNotes: true,
  excludedFolders: [],
  dateColor: "var(--text-accent)",
  borderColor: "var(--text-accent)",
  linkColor: "var(--link-color)",
  linkBackgroundColor: "var(--tag-background)",
  linkBorderColor: "rgba(255, 255, 255, 0.204)",
  customCreatedDateProp: "",
  customModifiedDateProp: "",
  dateDisplayFormat: "mmmm dd, yyyy"
};
var FolderSuggestModal = class extends import_obsidian2.FuzzySuggestModal {
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
};
var RichFootSettingTab = class extends import_obsidian2.PluginSettingTab {
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
    containerEl.createEl("h2", { text: "Rich Foot Settings" });
    new import_obsidian2.Setting(containerEl).setName("Border Width").setDesc("Width of the footer border in pixels").addSlider((slider) => slider.setLimits(0, 5, 1).setValue(this.plugin.settings.borderWidth).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.borderWidth = value;
      document.documentElement.style.setProperty("--rich-foot-border-width", `${value}px`);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Border Style").setDesc("Style of the footer border").addDropdown((dropdown) => dropdown.addOption("solid", "Solid").addOption("dashed", "Dashed").addOption("dotted", "Dotted").setValue(this.plugin.settings.borderStyle).onChange(async (value) => {
      this.plugin.settings.borderStyle = value;
      document.documentElement.style.setProperty("--rich-foot-border-style", value);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Border Opacity").setDesc("Opacity of the footer border").addSlider((slider) => slider.setLimits(0, 1, 0.1).setValue(this.plugin.settings.borderOpacity).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.borderOpacity = value;
      document.documentElement.style.setProperty("--rich-foot-border-opacity", value);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Border Radius").setDesc("Border radius of the footer in pixels").addSlider((slider) => slider.setLimits(0, 30, 1).setValue(this.plugin.settings.borderRadius).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.borderRadius = value;
      document.documentElement.style.setProperty("--rich-foot-border-radius", `${value}px`);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Dates Opacity").setDesc("Opacity of the dates in the footer").addSlider((slider) => slider.setLimits(0, 1, 0.1).setValue(this.plugin.settings.datesOpacity).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.datesOpacity = value;
      document.documentElement.style.setProperty("--rich-foot-dates-opacity", value);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Links Opacity").setDesc("Opacity of the links in the footer").addSlider((slider) => slider.setLimits(0, 1, 0.1).setValue(this.plugin.settings.linksOpacity).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.linksOpacity = value;
      document.documentElement.style.setProperty("--rich-foot-links-opacity", value);
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Border Color").setDesc("Color of the footer border").addText((text) => text.setValue(this.plugin.settings.borderColor).onChange(async (value) => {
      this.plugin.settings.borderColor = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Link Color").setDesc("Color of the links in the footer").addText((text) => text.setValue(this.plugin.settings.linkColor).onChange(async (value) => {
      this.plugin.settings.linkColor = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Link Background Color").setDesc("Background color of the links in the footer").addText((text) => text.setValue(this.plugin.settings.linkBackgroundColor).onChange(async (value) => {
      this.plugin.settings.linkBackgroundColor = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Link Border Color").setDesc("Border color of the links in the footer").addText((text) => text.setValue(this.plugin.settings.linkBorderColor).onChange(async (value) => {
      this.plugin.settings.linkBorderColor = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Custom Created Date Property").setDesc("Custom frontmatter property for created date").addText((text) => {
      this.createdDateInput = text;
      text.setValue(this.plugin.settings.customCreatedDateProp).onChange(async (value) => {
        this.plugin.settings.customCreatedDateProp = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Custom Modified Date Property").setDesc("Custom frontmatter property for modified date").addText((text) => {
      this.modifiedDateInput = text;
      text.setValue(this.plugin.settings.customModifiedDateProp).onChange(async (value) => {
        this.plugin.settings.customModifiedDateProp = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Date Display Format").setDesc('Format for displaying dates (e.g., "mmmm dd, yyyy" for "January 01, 2024")').addText((text) => text.setValue(this.plugin.settings.dateDisplayFormat).onChange(async (value) => {
      this.plugin.settings.dateDisplayFormat = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Excluded Folders").setDesc("Folders to exclude from footer display").addTextArea((text) => text.setValue(this.plugin.settings.excludedFolders.join("\n")).onChange(async (value) => {
      this.plugin.settings.excludedFolders = value.split("\n").filter((folder) => folder.trim() !== "");
      await this.plugin.saveSettings();
    }));
  }
};

// src/main.js
function formatDate(date, format) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const weekday = d.getDay();
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthsShort = months.map((m) => m.slice(0, 3));
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdaysShort = weekdays.map((w) => w.slice(0, 3));
  const pad = (num) => num.toString().padStart(2, "0");
  const tokens = {
    "dddd": weekdays[weekday],
    "ddd": weekdaysShort[weekday],
    "dd": pad(day),
    "d": day.toString(),
    "mmmm": months[month],
    "mmm": monthsShort[month],
    "mm": pad(month + 1),
    "m": (month + 1).toString(),
    "yyyy": year.toString(),
    "yy": year.toString().slice(-2)
  };
  const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);
  let result = format;
  const replacements = /* @__PURE__ */ new Map();
  sortedTokens.forEach((token, index) => {
    const placeholder = `__${index}__`;
    replacements.set(placeholder, tokens[token]);
    result = result.replace(new RegExp(token, "g"), placeholder);
  });
  replacements.forEach((value, placeholder) => {
    result = result.replace(new RegExp(placeholder, "g"), value);
  });
  return result;
}
var RichFootPlugin = class extends import_obsidian3.Plugin {
  async onload() {
    await this.loadSettings();
    document.documentElement.style.setProperty("--rich-foot-border-width", `${this.settings.borderWidth}px`);
    document.documentElement.style.setProperty("--rich-foot-border-style", this.settings.borderStyle);
    document.documentElement.style.setProperty("--rich-foot-border-opacity", this.settings.borderOpacity);
    document.documentElement.style.setProperty("--rich-foot-border-radius", `${this.settings.borderRadius}px`);
    document.documentElement.style.setProperty("--rich-foot-dates-opacity", this.settings.datesOpacity);
    document.documentElement.style.setProperty("--rich-foot-links-opacity", this.settings.linksOpacity);
    await this.checkVersion();
    this.debouncedUpdateRichFoot = (0, import_obsidian3.debounce)(async () => {
      const activeLeaf = this.app.workspace.activeLeaf;
      if ((activeLeaf == null ? void 0 : activeLeaf.view) instanceof import_obsidian3.MarkdownView) {
        await this.addRichFoot(activeLeaf.view);
      }
    }, 100, true);
    this.addSettingTab(new RichFootSettingTab(this.app, this));
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache == null ? void 0 : cache.frontmatter) {
          const customCreatedProp = this.settings.customCreatedDateProp;
          const customModifiedProp = this.settings.customModifiedDateProp;
          if (customCreatedProp && customCreatedProp in cache.frontmatter || customModifiedProp && customModifiedProp in cache.frontmatter) {
            this.debouncedUpdateRichFoot();
          }
        }
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.workspace.on("layout-change", () => this.debouncedUpdateRichFoot())
      );
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", () => this.debouncedUpdateRichFoot())
      );
      this.registerEvent(
        this.app.workspace.on("file-open", () => this.debouncedUpdateRichFoot())
      );
      this.registerEvent(
        this.app.workspace.on("editor-change", () => this.debouncedUpdateRichFoot())
      );
      this.debouncedUpdateRichFoot();
    });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    document.documentElement.style.setProperty("--rich-foot-date-color", this.settings.dateColor);
    if (!Array.isArray(this.settings.excludedFolders)) {
      this.settings.excludedFolders = [];
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async checkVersion() {
    const currentVersion = this.manifest.version;
    const lastVersion = this.settings.lastVersion;
    const shouldShow = this.settings.showReleaseNotes && (!lastVersion || lastVersion !== currentVersion);
    if (shouldShow) {
      const releaseNotes2 = await this.getReleaseNotes(currentVersion);
      new ReleaseNotesModal(this.app, this, currentVersion, releaseNotes2).open();
      this.settings.lastVersion = currentVersion;
      await this.saveSettings();
    }
  }
  async getReleaseNotes(version) {
    return releaseNotes;
  }
  async updateRichFoot() {
    document.documentElement.style.setProperty("--rich-foot-border-width", `${this.settings.borderWidth}px`);
    document.documentElement.style.setProperty("--rich-foot-border-style", this.settings.borderStyle);
    document.documentElement.style.setProperty("--rich-foot-border-opacity", this.settings.borderOpacity);
    document.documentElement.style.setProperty("--rich-foot-border-radius", `${this.settings.borderRadius}px`);
    document.documentElement.style.setProperty("--rich-foot-dates-opacity", this.settings.datesOpacity);
    document.documentElement.style.setProperty("--rich-foot-links-opacity", this.settings.linksOpacity);
    document.documentElement.style.setProperty("--rich-foot-date-color", this.settings.dateColor);
    document.documentElement.style.setProperty("--rich-foot-border-color", this.settings.borderColor);
    document.documentElement.style.setProperty("--rich-foot-link-color", this.settings.linkColor);
    document.documentElement.style.setProperty("--rich-foot-link-background", this.settings.linkBackgroundColor);
    document.documentElement.style.setProperty("--rich-foot-link-border-color", this.settings.linkBorderColor);
    const activeLeaf = this.app.workspace.activeLeaf;
    if ((activeLeaf == null ? void 0 : activeLeaf.view) instanceof import_obsidian3.MarkdownView) {
      await this.addRichFoot(activeLeaf.view);
    }
  }
  async addRichFoot(view) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const file = view.file;
    if (!file || !file.path) {
      return;
    }
    if (this.shouldExcludeFile(file.path)) {
      const content2 = view.contentEl;
      let container2;
      if (((_b = (_a = view.getMode) == null ? void 0 : _a.call(view)) != null ? _b : view.mode) === "preview") {
        container2 = content2.querySelector(".markdown-preview-section");
      } else if (((_d = (_c = view.getMode) == null ? void 0 : _c.call(view)) != null ? _d : view.mode) === "source" || ((_f = (_e = view.getMode) == null ? void 0 : _e.call(view)) != null ? _f : view.mode) === "live") {
        container2 = content2.querySelector(".cm-sizer");
      }
      if (container2) {
        this.removeExistingRichFoot(container2);
      }
      return;
    }
    const content = view.contentEl;
    let container;
    if (((_h = (_g = view.getMode) == null ? void 0 : _g.call(view)) != null ? _h : view.mode) === "preview") {
      container = content.querySelector(".markdown-preview-section");
    } else if (((_j = (_i = view.getMode) == null ? void 0 : _i.call(view)) != null ? _j : view.mode) === "source" || ((_l = (_k = view.getMode) == null ? void 0 : _k.call(view)) != null ? _l : view.mode) === "live") {
      container = content.querySelector(".cm-sizer");
    }
    if (!container) {
      return;
    }
    this.removeExistingRichFoot(container);
    this.disconnectObservers();
    const richFoot = await this.createRichFoot(file);
    container.appendChild(richFoot);
    this.observeContainer(container);
  }
  removeExistingRichFoot(container) {
    var _a;
    const existingRichFoot = container.querySelector(".rich-foot");
    if (existingRichFoot) {
      existingRichFoot.remove();
    }
    const cmEditor = container.closest(".cm-editor");
    if (cmEditor) {
      const cmSizer = cmEditor.querySelector(".cm-sizer");
      if (cmSizer) {
        const richFootInSizer = cmSizer.querySelector(".rich-foot");
        if (richFootInSizer) {
          richFootInSizer.remove();
        }
      }
    }
    const previewSection = (_a = container.closest(".markdown-reading-view")) == null ? void 0 : _a.querySelector(".markdown-preview-section");
    if (previewSection) {
      const richFootInPreview = previewSection.querySelector(".rich-foot");
      if (richFootInPreview) {
        richFootInPreview.remove();
      }
    }
  }
  disconnectObservers() {
    if (this.contentObserver) {
      this.contentObserver.disconnect();
    }
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
  }
  observeContainer(container) {
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    this.containerObserver = new MutationObserver((mutations) => {
      var _a;
      const richFoot = container.querySelector(".rich-foot");
      if (!richFoot) {
        const view = (_a = this.app.workspace.activeLeaf) == null ? void 0 : _a.view;
        if (view instanceof import_obsidian3.MarkdownView) {
          this.addRichFoot(view);
        }
      }
    });
    this.containerObserver.observe(container, { childList: true, subtree: true });
  }
  async createRichFoot(file) {
    const richFoot = createDiv({ cls: "rich-foot" });
    const richFootDashedLine = richFoot.createDiv({ cls: "rich-foot--dashed-line" });
    if (this.settings.showBacklinks) {
      const backlinksData = this.app.metadataCache.getBacklinksForFile(file);
      if ((backlinksData == null ? void 0 : backlinksData.data) && backlinksData.data.size > 0) {
        const backlinksDiv = richFoot.createDiv({ cls: "rich-foot--backlinks" });
        const backlinksUl = backlinksDiv.createEl("ul");
        for (const [linkPath, linkData] of backlinksData.data) {
          if (!linkPath.endsWith(".md")) continue;
          const li = backlinksUl.createEl("li");
          const link = li.createEl("a", {
            href: linkPath,
            text: linkPath.split("/").pop().slice(0, -3),
            cls: this.isEditMode() ? "cm-hmd-internal-link cm-underline" : "internal-link"
          });
          link.dataset.href = linkPath;
          link.dataset.sourcePath = file.path;
          if (this.isEditMode()) {
            let hoverTimeout = null;
            link.addEventListener("mouseover", (mouseEvent) => {
              var _a;
              const pagePreviewPlugin = this.app.internalPlugins.plugins["page-preview"];
              if (!(pagePreviewPlugin == null ? void 0 : pagePreviewPlugin.enabled)) {
                return;
              }
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }
              const previewPlugin = (_a = this.app.internalPlugins.plugins["page-preview"]) == null ? void 0 : _a.instance;
              if (previewPlugin == null ? void 0 : previewPlugin.onLinkHover) {
                previewPlugin.onLinkHover(mouseEvent, link, linkPath, file.path);
              }
            });
            link.addEventListener("mouseout", (mouseEvent) => {
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
              }
              hoverTimeout = setTimeout(() => {
                var _a;
                const previewPlugin = (_a = this.app.internalPlugins.plugins["page-preview"]) == null ? void 0 : _a.instance;
                const hoverParent = (previewPlugin == null ? void 0 : previewPlugin.hoverParent) || document.body;
                const previews = hoverParent.querySelectorAll(".hover-popup");
                previews.forEach((preview) => preview.remove());
                hoverTimeout = null;
              }, 50);
            });
          }
          link.addEventListener("click", (event) => {
            event.preventDefault();
            this.app.workspace.openLinkText(linkPath, file.path);
          });
        }
        if (backlinksUl.childElementCount === 0) {
          backlinksDiv.remove();
        }
      }
    }
    if (this.settings.showOutlinks) {
      const outlinks = await this.getOutlinks(file);
      if (outlinks.size > 0) {
        const outlinksDiv = richFoot.createDiv({ cls: "rich-foot--outlinks" });
        const outlinksUl = outlinksDiv.createEl("ul");
        for (const linkPath of outlinks) {
          const parts = linkPath.split("/");
          const displayName = parts[parts.length - 1].slice(0, -3);
          const li = outlinksUl.createEl("li");
          const link = li.createEl("a", {
            href: linkPath,
            text: displayName,
            cls: this.isEditMode() ? "cm-hmd-internal-link cm-underline" : "internal-link"
          });
          link.dataset.href = linkPath;
          link.dataset.sourcePath = file.path;
          if (this.isEditMode()) {
            let hoverTimeout = null;
            link.addEventListener("mouseover", (mouseEvent) => {
              var _a;
              const pagePreviewPlugin = this.app.internalPlugins.plugins["page-preview"];
              if (!(pagePreviewPlugin == null ? void 0 : pagePreviewPlugin.enabled)) {
                return;
              }
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
              }
              const previewPlugin = (_a = this.app.internalPlugins.plugins["page-preview"]) == null ? void 0 : _a.instance;
              if (previewPlugin == null ? void 0 : previewPlugin.onLinkHover) {
                previewPlugin.onLinkHover(mouseEvent, link, linkPath, file.path);
              }
            });
            link.addEventListener("mouseout", (mouseEvent) => {
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
              }
              hoverTimeout = setTimeout(() => {
                var _a;
                const previewPlugin = (_a = this.app.internalPlugins.plugins["page-preview"]) == null ? void 0 : _a.instance;
                const hoverParent = (previewPlugin == null ? void 0 : previewPlugin.hoverParent) || document.body;
                const previews = hoverParent.querySelectorAll(".hover-popup");
                previews.forEach((preview) => preview.remove());
                hoverTimeout = null;
              }, 50);
            });
          }
          link.addEventListener("click", (event) => {
            event.preventDefault();
            this.app.workspace.openLinkText(linkPath, file.path);
          });
        }
      }
    }
    if (this.settings.showDates) {
      const datesWrapper = richFoot.createDiv({ cls: "rich-foot--dates-wrapper" });
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache == null ? void 0 : cache.frontmatter;
      let modifiedDate;
      if (this.settings.customModifiedDateProp && frontmatter && frontmatter[this.settings.customModifiedDateProp]) {
        modifiedDate = frontmatter[this.settings.customModifiedDateProp];
        let isValidDate = false;
        let tempDate = modifiedDate;
        if (!isNaN(Date.parse(tempDate))) {
          isValidDate = true;
        }
        if (!isValidDate) {
          let count = 0;
          tempDate = modifiedDate.replace(/\./g, (match) => {
            count++;
            return count <= 2 ? "-" : match;
          });
          if (!isNaN(Date.parse(tempDate))) {
            isValidDate = true;
          }
        }
        if (!isValidDate) {
          let count = 0;
          tempDate = modifiedDate.replace(/\//g, (match) => {
            count++;
            return count <= 2 ? "-" : match;
          });
          if (!isNaN(Date.parse(tempDate))) {
            isValidDate = true;
          }
        }
        if (isValidDate) {
          const datePart = tempDate.split("T")[0];
          const dateStr = tempDate.includes("T") ? tempDate : `${datePart}T00:00:00`;
          const dateObj = new Date(dateStr);
          modifiedDate = formatDate(dateObj, this.settings.dateDisplayFormat);
        } else {
          modifiedDate = modifiedDate;
        }
      } else {
        modifiedDate = new Date(file.stat.mtime);
        modifiedDate = formatDate(modifiedDate, this.settings.dateDisplayFormat);
      }
      datesWrapper.createDiv({
        cls: "rich-foot--modified-date",
        text: `${modifiedDate}`
      });
      let createdDate;
      if (this.settings.customCreatedDateProp && frontmatter && frontmatter[this.settings.customCreatedDateProp]) {
        createdDate = frontmatter[this.settings.customCreatedDateProp];
        let isValidDate = false;
        let tempDate = createdDate;
        if (!isNaN(Date.parse(tempDate))) {
          isValidDate = true;
        }
        if (!isValidDate) {
          let count = 0;
          tempDate = createdDate.replace(/\./g, (match) => {
            count++;
            return count <= 2 ? "-" : match;
          });
          if (!isNaN(Date.parse(tempDate))) {
            isValidDate = true;
          }
        }
        if (!isValidDate) {
          let count = 0;
          tempDate = createdDate.replace(/\//g, (match) => {
            count++;
            return count <= 2 ? "-" : match;
          });
          if (!isNaN(Date.parse(tempDate))) {
            isValidDate = true;
          }
        }
        if (isValidDate) {
          const datePart = tempDate.split("T")[0];
          const dateStr = tempDate.includes("T") ? tempDate : `${datePart}T00:00:00`;
          const dateObj = new Date(dateStr);
          createdDate = formatDate(dateObj, this.settings.dateDisplayFormat);
        } else {
          createdDate = createdDate;
        }
      } else {
        createdDate = new Date(file.stat.ctime);
        createdDate = formatDate(createdDate, this.settings.dateDisplayFormat);
      }
      datesWrapper.createDiv({
        cls: "rich-foot--created-date",
        text: `${createdDate}`
      });
    }
    return richFoot;
  }
  async getOutlinks(file) {
    const cache = this.app.metadataCache.getFileCache(file);
    const links = /* @__PURE__ */ new Set();
    if (cache == null ? void 0 : cache.links) {
      for (const link of cache.links) {
        const linkPath = link.link.split("#")[0];
        const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
        if (targetFile && targetFile.extension === "md") {
          links.add(targetFile.path);
        }
      }
    }
    if (cache == null ? void 0 : cache.blocks) {
      for (const block of Object.values(cache.blocks)) {
        if (block.type === "footnote") {
          const wikiLinkRegex = /\[\[(.*?)\]\]/g;
          let wikiMatch;
          while ((wikiMatch = wikiLinkRegex.exec(block.text)) !== null) {
            const linkText = wikiMatch[1];
            const linkPath = linkText.split("#")[0];
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
            if (targetFile && targetFile.extension === "md") {
              links.add(targetFile.path);
            }
          }
        }
      }
    }
    const fileContent = await this.app.vault.read(file);
    const inlineFootnoteRegex = /\^\[((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)\]/g;
    const refFootnoteRegex = /\[\^[^\]]+\]:\s*((?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*)/g;
    let match;
    while ((match = inlineFootnoteRegex.exec(fileContent)) !== null) {
      const footnoteContent = match[1];
      await this.processFootnoteContent(footnoteContent, file, links);
    }
    while ((match = refFootnoteRegex.exec(fileContent)) !== null) {
      const footnoteContent = match[1];
      await this.processFootnoteContent(footnoteContent, file, links);
    }
    return links;
  }
  async processFootnoteContent(content, file, links) {
    const wikiLinkRegex = /\[\[(.*?)\]\]/g;
    let wikiMatch;
    while ((wikiMatch = wikiLinkRegex.exec(content)) !== null) {
      const linkText = wikiMatch[1].trim();
      const linkPath = linkText.split("#")[0];
      const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, file.path);
      if (targetFile && targetFile.extension === "md") {
        links.add(targetFile.path);
      }
    }
  }
  onunload() {
    this.disconnectObservers();
    document.querySelectorAll(".rich-foot").forEach((el) => el.remove());
    this.app.workspace.off("layout-change", this.updateRichFoot);
    this.app.workspace.off("active-leaf-change", this.updateRichFoot);
    this.app.workspace.off("file-open", this.updateRichFoot);
    this.app.workspace.off("editor-change", this.updateRichFoot);
  }
  // Add this method to check if a file should be excluded
  shouldExcludeFile(filePath) {
    var _a;
    if (!((_a = this.settings) == null ? void 0 : _a.excludedFolders)) {
      return false;
    }
    return this.settings.excludedFolders.some((folder) => filePath.startsWith(folder));
  }
  isEditMode() {
    var _a, _b;
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian3.MarkdownView);
    if (!activeView) return false;
    return ((_b = (_a = activeView.getMode) == null ? void 0 : _a.call(activeView)) != null ? _b : activeView.mode) === "source";
  }
};
var main_default = RichFootPlugin;
