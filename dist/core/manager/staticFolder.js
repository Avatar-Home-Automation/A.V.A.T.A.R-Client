import {default as express } from 'express';
import _ from 'underscore';

let folders = [];


/**
 * Sets a static folder to be used by the application.
 * 
 * @param {string} folder - The path to the folder to be set as static.
 * @param {Function} [callback] - Optional callback function to be executed after setting the folder.
 */
function setStaticFolder(folder, callback) {
  if (!_.contains(folders, folder)) {
    if (!appClient) {
      error(L.get('mainInterface.static'));
    } else {
      appClient.use(express.static(folder));
      folders.push(folder);
    }
  }
  if (callback) callback();
}


async function initStatic() {
  Avatar.static = {
    'set' : setStaticFolder
  }
}

export { initStatic }