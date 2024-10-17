/*
This is a sample banner
*/

// src/main.js
var { Plugin, MarkdownView, debounce, Setting, PluginSettingTab, EditorView } = require("obsidian");
var RichFootSettings = class {
  constructor() {
    this.excludedFolders = [];
  }
};
var RichFootPlugin = class extends Plugin {
  async onload() {
    await this.loadSettings();
    this.updateRichFoot = debounce(this.updateRichFoot.bind(this), 100, true);
    this.addSettingTab(new RichFootSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.workspace.on("layout-change", this.updateRichFoot)
      );
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", this.updateRichFoot)
      );
      this.registerEvent(
        this.app.workspace.on("file-open", this.updateRichFoot)
      );
      this.registerEvent(
        this.app.workspace.on("editor-change", this.updateRichFoot)
      );
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
      if (activeLeaf.view.previewMode && activeLeaf.view.previewMode.rendered) {
        this.addRichFoot(activeLeaf.view);
      } else if (activeLeaf.view.editor) {
        this.addRichFoot(activeLeaf.view);
      }
    }
  }
  addRichFoot(view) {
    const file = view.file;
    if (!file || !file.path) {
      return;
    }
    const content = view.contentEl;
    let container;
    if (view.getMode() === "preview") {
      container = content.querySelector(".markdown-preview-section");
    } else if (view.getMode() === "source" || view.getMode() === "live") {
      const cmSizer = content.querySelector(".cm-sizer");
      if (cmSizer) {
        this.removeExistingRichFoot(cmSizer);
        const richFoot2 = this.createRichFoot(file);
        cmSizer.appendChild(richFoot2);
        this.contentObserver.disconnect();
        this.contentObserver.observe(cmSizer, { childList: true, subtree: true });
        return;
      }
    }
    if (!container) {
      return;
    }
    this.removeExistingRichFoot(container);
    const richFoot = this.createRichFoot(file);
    container.appendChild(richFoot);
    this.contentObserver.disconnect();
    this.contentObserver.observe(container, { childList: true, subtree: true });
  }
  removeExistingRichFoot(container) {
    const existingRichFoot = container.querySelector(".rich-foot");
    if (existingRichFoot) {
      existingRichFoot.remove();
    }
  }
  createRichFoot(file) {
    const richFoot = createDiv({ cls: "rich-foot" });
    const richFootDashedLine = richFoot.createDiv({ cls: "rich-foot--dashed-line" });
    const resolvedLinks = this.app.metadataCache.resolvedLinks;
    const backlinkList = resolvedLinks[file.path] || {};
    if (Object.keys(backlinkList).length > 0) {
      const backlinksDiv = richFoot.createDiv({ cls: "rich-foot--backlinks" });
      const backlinksUl = backlinksDiv.createEl("ul");
      for (const [linkPath, count] of Object.entries(backlinkList)) {
        if (linkPath === file.path) continue;
        if (this.shouldIncludeBacklink(linkPath)) {
          const parts = linkPath.split("/");
          const displayName = parts[parts.length - 1].slice(0, -3);
          const li = backlinksUl.createEl("li");
          const link = li.createEl("a", {
            href: linkPath,
            text: displayName
          });
          link.addEventListener("click", (event) => {
            event.preventDefault();
            this.app.workspace.openLinkText(linkPath, file.path);
          });
        }
      }
      if (backlinksUl.childElementCount === 0) {
        backlinksDiv.remove();
      }
    }
    const datesWrapper = richFoot.createDiv({ cls: "rich-foot--dates-wrapper" });
    const fileUpdate = new Date(file.stat.mtime);
    const modified = `${fileUpdate.toLocaleString("default", { month: "long" })} ${fileUpdate.getDate()}, ${fileUpdate.getFullYear()}`;
    datesWrapper.createDiv({
      cls: "rich-foot--modified-date",
      text: `${modified}`
    });
    const fileCreated = new Date(file.stat.ctime);
    const created = `${fileCreated.toLocaleString("default", { month: "long" })} ${fileCreated.getDate()}, ${fileCreated.getFullYear()}`;
    datesWrapper.createDiv({
      cls: "rich-foot--created-date",
      text: `${created}`
    });
    return richFoot;
  }
  shouldIncludeBacklink(linkPath) {
    return !this.settings.excludedFolders.some((folder) => linkPath.startsWith(folder));
  }
  onunload() {
    this.contentObserver.disconnect();
  }
};
var RichFootSettingTab = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    let { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("rich-foot-settings");
    const infoDiv = containerEl.createEl("div", { cls: "rich-foot-info" });
    infoDiv.createEl("p", { text: "Rich Foot adds a footer to your notes with useful information such as backlinks, creation date, and last modified date." });
    new Setting(containerEl).setName("Excluded folders").setDesc("Enter folder paths to exclude from backlinks (one per line)").addTextArea(
      (text) => text.setPlaceholder("folder1\nfolder2/subfolder").setValue(this.plugin.settings.excludedFolders.join("\n")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split("\n").filter((folder) => folder.trim() !== "");
        await this.plugin.saveSettings();
      })
    );
    const textArea = containerEl.querySelector("textarea");
    if (textArea) {
      textArea.style.width = "400px";
      textArea.style.height = "250px";
    }
  }
};
module.exports = RichFootPlugin;
