import { default as octonode } from './lib/octonode/octonode.js';
import fs from 'fs-extra';
import {download} from 'electron-dl';
import * as path from 'node:path';

import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

let Config;


/**
 * Compares the current version with a list of new versions and resolves with the first new version that is greater than the current version.
 *
 * @param {string} currentVersion - The current version in the format 'x.x.x'.
 * @param {string[]} newVersions - An array of new versions to compare against the current version.
 * @returns {Promise<string|boolean>} - A promise that resolves with the first new version that is greater than the current version, or false if no new version is greater.
 */
const checkUpdateVersions = (currentVersion, newVersions) => {
    return new Promise((resolve) => {
        newVersions.some(newVersion => {
            let splitNewVersion = newVersion.split('.').map(Number);
            let splitCurrentVersion = currentVersion.map(Number);

            for (let i = 0; i < splitNewVersion.length; i++) {
                if (splitCurrentVersion[i] < splitNewVersion[i]) {
                    return resolve(newVersion.trim());
                } else if (splitCurrentVersion[i] > splitNewVersion[i]) {
                    break;
                }
            }
        });

        return resolve(false);
    });
}


const checkUpdate = (win) => {

    return new Promise(async (resolve) => { 

        const client = octonode.client();
        if (!client) return resolve(false);
        const repo = client.repo(Config.repository);
        if (!repo) return resolve(false);
        
        repo.contents('update/updateVersion.json', async (err, data) => {

            if (err || !data || !data.download_url) return resolve(false);

            const outputZip = path.resolve(__dirname, 'tmp/download');
            fs.ensureDirSync(outputZip);

            try {
                await download(win, data.download_url, {
                    directory: outputZip,
                    showBadge: false,
                    showProgressBar: false,
                    filename: 'updateVersion.json',
                    overwrite: true
                })

                const newVersionFile = path.resolve(__dirname, 'tmp/download/updateVersion.json');
                const newVersion = fs.readJsonSync(newVersionFile, { throws: true });
                const currentVersion = Config.version.split('.');
                resolve (await checkUpdateVersions (currentVersion, newVersion.versions));
            } catch (err) {
                error(L.get(["github.newVersion", err]));
                resolve(false);
            }
        })
    })
}

async function init(conf) {
    Config = conf;
    return {
        'checkUpdate': checkUpdate
    }
}
  
// Exports
export { init };

