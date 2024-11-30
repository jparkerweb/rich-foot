import fs from 'fs-extra';
import path from 'path';

const targetDir = 'example-vault/rich-foot-example/.obsidian/plugins/rich-foot';
const filesToCopy = ['styles.css', 'main.js', 'manifest.json'];

// Ensure target directory exists
fs.ensureDirSync(targetDir);

// Copy each file
filesToCopy.forEach(file => {
    fs.copySync(file, path.join(targetDir, file));
    console.log(`Copied ${file} to ${targetDir}`);
});
