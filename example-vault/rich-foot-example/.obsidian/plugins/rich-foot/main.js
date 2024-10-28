/*
This is a sample banner
*/

// src/main.js
var { Plugin, MarkdownView, debounce, Setting, PluginSettingTab, EditorView, FuzzySuggestModal } = require("obsidian");
var RichFootSettings = class {
  constructor() {
    this.excludedFolders = [];
    this.showBacklinks = true;
    this.showOutlinks = false;
    this.showDates = true;
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
      this.addRichFoot(activeLeaf.view);
    }
  }
  addRichFoot(view) {
    const file = view.file;
    if (!file || !file.path) {
      return;
    }
    if (this.shouldExcludeFile(file.path)) {
      const content2 = view.contentEl;
      let container2;
      if (view.getMode() === "preview") {
        container2 = content2.querySelector(".markdown-preview-section");
      } else if (view.getMode() === "source" || view.getMode() === "live") {
        container2 = content2.querySelector(".cm-sizer");
      }
      if (container2) {
        this.removeExistingRichFoot(container2);
      }
      return;
    }
    const content = view.contentEl;
    let container;
    if (view.getMode() === "preview") {
      container = content.querySelector(".markdown-preview-section");
    } else if (view.getMode() === "source" || view.getMode() === "live") {
      container = content.querySelector(".cm-sizer");
    }
    if (!container) {
      return;
    }
    this.removeExistingRichFoot(container);
    const richFoot = this.createRichFoot(file);
    if (view.getMode() === "source" || view.getMode() === "live") {
      container.appendChild(richFoot);
    } else {
      container.appendChild(richFoot);
    }
    this.observeContainer(container);
  }
  removeExistingRichFoot(container) {
    var _a;
    const existingRichFoot = container.querySelector(".rich-foot");
    if (existingRichFoot) {
      existingRichFoot.remove();
    }
    const cmSizer = (_a = container.closest(".cm-editor")) == null ? void 0 : _a.querySelector(".cm-sizer");
    if (cmSizer) {
      const richFootInSizer = cmSizer.querySelector(".rich-foot");
      if (richFootInSizer) {
        richFootInSizer.remove();
      }
    }
  }
  observeContainer(container) {
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    this.containerObserver = new MutationObserver((mutations) => {
      const richFoot = container.querySelector(".rich-foot");
      if (!richFoot) {
        this.addRichFoot(this.app.workspace.activeLeaf.view);
      }
    });
    this.containerObserver.observe(container, { childList: true, subtree: true });
  }
  createRichFoot(file) {
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
            text: linkPath.split("/").pop().slice(0, -3)
          });
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
      const outlinks = this.getOutlinks(file);
      if (outlinks.size > 0) {
        const outlinksDiv = richFoot.createDiv({ cls: "rich-foot--outlinks" });
        const outlinksUl = outlinksDiv.createEl("ul");
        for (const linkPath of outlinks) {
          const parts = linkPath.split("/");
          const displayName = parts[parts.length - 1].slice(0, -3);
          const li = outlinksUl.createEl("li");
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
    }
    if (this.settings.showDates) {
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
    }
    return richFoot;
  }
  getOutlinks(file) {
    var _a, _b;
    const cache = this.app.metadataCache.getFileCache(file);
    const links = /* @__PURE__ */ new Set();
    if (cache == null ? void 0 : cache.links) {
      for (const link of cache.links) {
        const targetFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (targetFile && targetFile.extension === "md") {
          links.add(targetFile.path);
        }
      }
    }
    if ((_a = cache == null ? void 0 : cache.frontmatter) == null ? void 0 : _a.links) {
      const frontmatterLinks = cache.frontmatter.links;
      if (Array.isArray(frontmatterLinks)) {
        for (const link of frontmatterLinks) {
          const linkText = (_b = link.match(/\[\[(.*?)\]\]/)) == null ? void 0 : _b[1];
          if (linkText) {
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkText, file.path);
            if (targetFile && targetFile.extension === "md") {
              links.add(targetFile.path);
            }
          }
        }
      }
    }
    return links;
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
  // Add this method to check if a file should be excluded
  shouldExcludeFile(filePath) {
    return this.settings.excludedFolders.some((folder) => filePath.startsWith(folder));
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
    containerEl.createEl("h3", { text: "Excluded Folders" });
    containerEl.createEl("p", {
      text: "Notes in excluded folders (and their subfolders) will not display the Rich Foot footer. This is useful for system folders or areas where you don't want footer information to appear.",
      cls: "setting-item-description"
    });
    const excludedFoldersContainer = containerEl.createDiv("excluded-folders-container");
    this.plugin.settings.excludedFolders.forEach((folder, index) => {
      const folderDiv = excludedFoldersContainer.createDiv("excluded-folder-item");
      folderDiv.createSpan({ text: folder });
      const deleteButton = folderDiv.createEl("button", {
        text: "Delete",
        cls: "excluded-folder-delete"
      });
      deleteButton.addEventListener("click", async () => {
        this.plugin.settings.excludedFolders.splice(index, 1);
        await this.plugin.saveSettings();
        this.display();
      });
    });
    const newFolderSetting = new Setting(containerEl).setName("Add excluded folder").setDesc("Enter a folder path or browse to select").addText((text) => text.setPlaceholder("folder/subfolder").onChange(() => {
    })).addButton((button) => button.setButtonText("Browse").onClick(async () => {
      const folder = await this.browseForFolder();
      if (folder) {
        const textComponent = newFolderSetting.components[0];
        textComponent.setValue(folder);
      }
    })).addButton((button) => button.setButtonText("Add").onClick(async () => {
      const textComponent = newFolderSetting.components[0];
      const newFolder = textComponent.getValue().trim();
      if (newFolder && !this.plugin.settings.excludedFolders.includes(newFolder)) {
        this.plugin.settings.excludedFolders.push(newFolder);
        await this.plugin.saveSettings();
        textComponent.setValue("");
        this.display();
      }
    }));
    containerEl.createEl("h3", { text: "Visibility Settings" });
    new Setting(containerEl).setName("Show Backlinks").setDesc("Show backlinks in the footer").addToggle((toggle) => toggle.setValue(this.plugin.settings.showBacklinks).onChange(async (value) => {
      this.plugin.settings.showBacklinks = value;
      await this.plugin.saveSettings();
      this.plugin.updateRichFoot();
    }));
    new Setting(containerEl).setName("Show Outlinks").setDesc("Show outgoing links in the footer").addToggle((toggle) => toggle.setValue(this.plugin.settings.showOutlinks).onChange(async (value) => {
      this.plugin.settings.showOutlinks = value;
      await this.plugin.saveSettings();
      this.plugin.updateRichFoot();
    }));
    new Setting(containerEl).setName("Show Dates").setDesc("Show creation and modification dates in the footer").addToggle((toggle) => toggle.setValue(this.plugin.settings.showDates).onChange(async (value) => {
      this.plugin.settings.showDates = value;
      await this.plugin.saveSettings();
      this.plugin.updateRichFoot();
    }));
    containerEl.createEl("h3", { text: "Example Screenshot", cls: "rich-foot-example-title" });
    const exampleDiv = containerEl.createDiv({ cls: "rich-foot-example" });
    const img = exampleDiv.createEl("img", {
      attr: {
        src: "https://raw.githubusercontent.com/jparkerweb/rich-foot/refs/heads/main/rich-foot.jpg",
        alt: "Rich Foot Example"
      }
    });
  }
  async browseForFolder() {
    const folders = this.app.vault.getAllLoadedFiles().filter((file) => file.children).map((folder) => folder.path);
    return new Promise((resolve) => {
      const modal = new FolderSuggestModal(this.app, folders, (result) => {
        resolve(result);
      });
      modal.open();
    });
  }
};
var FolderSuggestModal = class extends FuzzySuggestModal {
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
module.exports = RichFootPlugin;
