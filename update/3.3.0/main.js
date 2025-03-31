import { app, BrowserWindow, globalShortcut, safeStorage, ipcMain, dialog, Menu, shell } from 'electron';
import fs from 'fs-extra';
import * as path from 'node:path';
import { exec, execSync } from 'node:child_process';
import _ from 'underscore';
import moment from 'moment';
import { CronJob } from 'cron';
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

import * as githubLib from './githubRepos.js';

await import ('file:///'+path.resolve(__dirname, 'message.js'));
import * as avatar from './core/avatar.js';
import * as reportLibrary from './reportLibrary.js';
import * as scenarioLibrary from './scenarioLibrary.js';

import { default as SimpleTTS } from './lib/simpletts/lib/cjs/main.cjs';
const vbsFolders = path.resolve(__dirname, "core", "lib", "tts",  process.platform, "scripts");
const TTS = new SimpleTTS(vbsFolders);


// Patch for MacOS, retrieving the PATH for the application
if (process.platform === 'darwin') {
  try {
    // Try first with launchctl
    let updatedPath = execSync('launchctl getenv PATH', { encoding: 'utf8' }).trim();
    // If it's empty, launch a login shell to retrieve the PATH
    if (!updatedPath) {
      updatedPath = execSync('zsh -l -c "echo $PATH"', { encoding: 'utf8' }).trim();
    }
    process.env.PATH = updatedPath;
  } catch (error) {
    console.error('Error retrieving PATH via launchctl:', error);
  }
}

// Windows
let mainWindow;
let settingsWindow;
let pluginStudioWindow;
let encryptWindow;
let welcomeSettingWindow;
let backupRestoreWindow;
let initInformationWindow;
let informationWindow;
let newVersionInfo;
let scenarioStudioWindow;

// Property files
let appProperties;
let interfaceProperties;
let appPropertiesOld;
let interfacePropertiesOld;
let Scenario;
let BCP47dialog;
let BCP47app;
setProperties();

// Localisation language
let language;
let preferredLanguage;
// Global
global.L  = new Language();

// internal
let timeoutStartControl;
let fullScreen;
let github;
let Report;

function setProperties() {

  if (fs.existsSync(path.resolve(__dirname, 'core/Avatar.prop')))
    appProperties = fs.readJsonSync(path.resolve(__dirname, 'core/Avatar.prop'), { throws: true });

  if (!appProperties) {
    appProperties = fs.readJsonSync(path.resolve(__dirname, 'assets/config/default/Avatar.prop'), { throws: true });
  }
  appPropertiesOld = appProperties;

  if (fs.existsSync(path.resolve(__dirname, 'assets/config/interface.prop')))
    interfaceProperties = fs.readJsonSync(path.resolve(__dirname, 'assets/config/interface.prop'), { throws: true });
  if (!interfaceProperties) {
    interfaceProperties = fs.readJsonSync(path.resolve(__dirname, 'assets/config/default/interface.prop'), { throws: true });
  }
  const test = interfaceProperties;
  interfacePropertiesOld = test;

  BCP47dialog = fs.readJsonSync(path.resolve(__dirname, 'locales/BCP47-dialog.loc'), { throws: true });
  BCP47app = fs.readJsonSync(path.resolve(__dirname, 'locales/BCP47-app.loc'), { throws: true });
}


function saveProperties(arg) {
	fs.writeJsonSync(path.resolve(__dirname, 'core/Avatar.prop'), arg.app);
}

function saveBackgroundImage(image) {

  switch (process.platform) {
    case 'linux':  
    case 'darwin':  
      if (image && !path.isAbsolute(image)) {
        interfaceProperties.screen.background = image = '/'+image
      }
  } 

  let file = path.basename(image);
  let imagePath = path.resolve (__dirname, 'assets/images/background', file);
  if (!fs.existsSync(imagePath)) fs.copySync(image, imagePath);
}

// Fenetre principale AVATAR Client
function createWindow () {

    if (mainWindow) return mainWindow.show();

    let style = {
      show: false,
      webPreferences: {
        preload: path.resolve(__dirname, 'main-preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      },
      icon: path.resolve(__dirname, 'assets/images/Avatar.png')
    };
    style.fullscreen = fullScreen = interfaceProperties.screen.fullscreen;
    style.height = interfaceProperties.screen.height;
    style.width = interfaceProperties.screen.width;
    style.title = L.get("init.name")+' '+appProperties.version;

    mainWindow = new BrowserWindow(style);
    mainWindow.loadFile(path.resolve(__dirname, 'assets/html/main.html'));

    global.logger = (type, msg) => {mainWindow.webContents.send('update-logger', type+'@@@'+msg)};
    global.loggerConsole = (msg) => {mainWindow.webContents.send('update-loggerConsole', msg)};
    
    mainWindow.setMenu(null);

    globalShortcut.register('F10', () => {
      if (settingsWindow) settingsWindow.webContents.openDevTools();
      if (pluginStudioWindow) pluginStudioWindow.webContents.openDevTools();
      if (encryptWindow)  encryptWindow.webContents.openDevTools();
      if (welcomeSettingWindow) welcomeSettingWindow.webContents.openDevTools();
      if (backupRestoreWindow) backupRestoreWindow.webContents.openDevTools();
      if (initInformationWindow) initInformationWindow.webContents.openDevTools();
      if (newVersionInfo) newVersionInfo.webContents.openDevTools();
      if (informationWindow) informationWindow.webContents.openDevTools();
      if (scenarioStudioWindow) scenarioStudioWindow.webContents.openDevTools();
      mainWindow.webContents.openDevTools();
    });

    mainWindow.once('ready-to-show', async () => {
      mainWindow.webContents.send('initApp', {app: appProperties, interface: interfaceProperties});
      mainWindow.show();

      if (await appInit() === true) {
        await mainWindow.webContents.send('initWidgets');
        Avatar.Interface.restart = () => {
          app.relaunch();
          app.exit();
        };
        
        Avatar.Interface.information = async () => initInformation();
        Avatar.Interface.showRestartBox = async (arg) => mainWindow.webContents.send('showRestartBox', arg);
        Avatar.Interface.quit = () => mainWindow.destroy();
        Avatar.Interface.openSettings = (init, voices) => openSettings(init, voices);
        Avatar.Interface.setRemoteVoices = voices => {
          settingsWindow.webContents.send('setRemoteVoices', voices);
        }
        Avatar.Interface.mainWindow = () => {return mainWindow};
        Avatar.Interface.dialog = () => {return dialog};
        Avatar.Interface.BrowserWindow = (param, htmlfile, isMenu) => {
          const win = new BrowserWindow(param);
          win.loadFile(htmlfile);
          if (!isMenu) win.removeMenu();
          return Promise.resolve(win);
        };
        Avatar.Interface.ipcMain = () => {return ipcMain};
        Avatar.Interface.Menu = () => {return Menu};
        Avatar.Interface.shell = () => {return shell};
        Avatar.Interface.ipcMain = () => {return ipcMain};
        Avatar.Interface.globalShortcut = () => {return globalShortcut}; 
        Avatar.Interface.refreshWidgetInfo = async (arg) => {
          try { mainWindow.webContents.send('newPluginWidgetInfo', arg); } catch (err) {};
        }
        screenSaver();
        checkUpdate();
        await mainWindow.webContents.send('readyToMenu');
      } else {
        await mainWindow.webContents.send('readyToMenu');
      }

    });

    mainWindow.on('closed', async () => {
      mainWindow = null;
    });

    ipcMain.handle('getInfoPackage', async (event, arg) => {
      if (!initInformationWindow && informationWindow) await initInformation(true);
      return await Report.getInfoPackage(arg);
    });
    ipcMain.handle('showInfoWindow', async () => {
      if (informationWindow) {informationWindow.show();}
      return;
    });
    ipcMain.handle('destroyInitInfo', () => initInformationWindow.destroy());
    ipcMain.handle('changeLog', () => showNewVersionInfo(informationWindow));
    ipcMain.handle('auditPlugin', () => Report.auditPlugin(pluginStudioWindow));
    ipcMain.handle('pluginVulnerabilityFix', (event, arg) => Report.pluginVulnerabilityFix(arg));
    ipcMain.handle('pluginUpdatePackage', (event, arg) => Report.pluginUpdatePackage(arg));
    ipcMain.handle('quit-information', () => informationWindow.destroy());
    ipcMain.handle('showAvatarGithub', () => showAvatarGithub());
    ipcMain.handle('getPluginWidgets', async () => {
      if (Avatar.pluginLibrairy)
        return await Avatar.pluginLibrairy.getPluginWidgets();
      else
        return [];
    })
    ipcMain.handle('readyToShow', async (event) => {return await Avatar.pluginLibrairy.readyToShow()});
    ipcMain.handle('quitStudio', async (event, arg) => {
      pluginStudioWindow.destroy();
      if (arg === true) mainWindow.webContents.send('properties-changed');
    })
    ipcMain.handle('quit-backupRestore', async (event, arg) => {
      backupRestoreWindow.destroy();
      if (arg === true) mainWindow.webContents.send('properties-changed');
    });
    ipcMain.handle('applyBackupRestore', async (event, arg) => {return await applyBackupRestore(arg)});
    ipcMain.handle('dialog:openBackupFolder', handleBackupFolderOpen);
    ipcMain.handle('get-Plugins', async () => { 
      if (!Avatar.pluginLibrairy) return []; 
      return await Avatar.pluginLibrairy.getPlugins()
    });
    ipcMain.handle('errorVoices', async (event, arg) => {errorVoices(arg)});
    ipcMain.handle('getVoices', async (event, arg) => await getVoices(arg));
    ipcMain.handle('show-StudioEditorMenu', async (event, arg) => showStudioEditorMenu(event, arg));
    ipcMain.handle('show-PluginMenu' , async (event, arg) => showPluginMenu(event, arg.id, arg.name));
    ipcMain.handle('encryptString', async (event, arg) => {return await Avatar.encrypt(arg)});
    ipcMain.handle('decryptString', async (event, arg) => {return await Avatar.decrypt(arg)});
    ipcMain.handle('quit-encrypt', async () => encryptWindow.destroy());
    ipcMain.handle('save-plugin-property-file', async (event, arg) => {
      if (!_.isEqual(arg.property, arg.editor)) {
        let options = {
             type: 'question',
             title: L.get("pluginStudio.saveWinTitle"),
             message: L.get(["pluginStudio.saveWinMsg", arg.id]),
             detail: L.get("pluginStudio.saveWinDetail"),
             buttons: [L.get("pluginStudio.saveWin"), L.get("pluginStudio.noSaveWin"), L.get("pluginStudio.winDeleteCancel")]
         };

        let answer = dialog.showMessageBoxSync(settingsWindow, options);
        if (answer === 0) fs.writeJsonSync(arg.fullPath, arg.editor);
        return answer;
      } else
        return 1;
    })
    ipcMain.handle('pluginWidgetAction', async (event, arg) => { return await Avatar.pluginLibrairy.pluginWidgetAction(arg)})
    ipcMain.handle('refreshPluginWidgetInfo', async (event, arg) => {return await Avatar.pluginLibrairy.refreshPluginWidgetInfo(arg)})
    ipcMain.handle('getNewValuePluginWidgetById', async (event, arg) => {return await Avatar.pluginLibrairy.getNewValuePluginWidgetById(arg)})
    ipcMain.handle('get-msg', async (event, arg) => {return L.get(arg)})
    ipcMain.handle('isCloseApp', async () => { return await isCloseApp()});
    ipcMain.handle('closeApp', async (event, arg) => closeApp(arg, true));
    ipcMain.handle('reloadApp', async (event, arg) => closeApp(arg, false));
    ipcMain.handle('setNewVersion', async (event, arg) => {return setNewVersion(arg)});
    ipcMain.handle('showMenu' , async (event, arg) => {return showMenu(arg)});
    ipcMain.handle('testVoice' , async (event, arg) => {return testVoice(arg)});
    ipcMain.handle('dialog:openFile', handleFileOpen);
    ipcMain.handle('dialog:openPowershellFile', handlePowershellFileFileOpen);
    ipcMain.handle('dialog:openScreenSaverFile', handleScreenSaverFileOpen);
    ipcMain.handle('applyWelcomeProperties', (event, arg) => {
      fs.writeJsonSync(path.resolve(__dirname, 'core/Avatar.prop'), arg);
      welcomeSettingWindow.destroy();
    })
    ipcMain.handle('applyProperties', (event, arg) => {
      saveProperties(arg);
      appProperties = arg.app;
      interfaceProperties = arg.interface;
      if (!_.isEqual(interfaceProperties, interfacePropertiesOld)) {
        saveBackgroundImage(interfaceProperties.screen.background);
        if (arg.init === true) {
          mainWindow.webContents.send('update-background', interfaceProperties.screen.background);
        }
      }
    });
    ipcMain.handle('quit-settings', async (event, arg) => {
      settingsWindow.destroy();
      if (arg === false && (!_.isEqual(appProperties, appPropertiesOld) || !_.isEqual(interfaceProperties, interfacePropertiesOld))) {
        mainWindow.webContents.send('properties-changed');
      }
    })
    ipcMain.handle('info', async () => {
      return appProperties.version;
    });

    // Scenarios
    ipcMain.handle('scenario-testTask', async (event, arg) => { return await Scenario.testTask(arg) });
    ipcMain.handle('scenario-testSpeak', async (event, arg) => { return await Scenario.testSpeak(arg) });
    ipcMain.handle('validateCronExpression', async (event, arg) => { return await Scenario.validateCronExpression(arg) });
    ipcMain.handle('scenario-create', async (event, arg) => { return await Scenario.create(arg) });
    ipcMain.handle('scenario-remove', async (event, arg) => { return await removeScenario(arg) });
    ipcMain.handle('scenario-confirmRefresh', async (event, arg) => { return await ScenarioConfirmRefresh() });
    ipcMain.handle('scenario-getJobInfo', async (event, arg) => { return await Scenario.getJobInfo(arg) });
    ipcMain.handle('scenario-startCronJob', async (event, arg) => { return await Scenario.startCronJob(arg) });
    ipcMain.handle('scenario-stopCronJob', async (event, arg) => { return await Scenario.stopCronJob(arg) });
    ipcMain.handle('scenario-restartCronJob', async (event, arg) => { return await Scenario.restartCronJob(arg) });
    ipcMain.handle('scenario-quit', (event, arg) => {
      scenarioStudioWindow.destroy();
      if (arg === true) { mainWindow.webContents.send('properties-changed'); };
    });
}


async function ScenarioConfirmRefresh() {
  const options = {
    type: 'question',
    title: L.get("scenario.refreshQuestionTitle"),
    message: L.get("scenario.refreshQuestion"),
    buttons: [L.get("scenario.questionYes"), L.get("scenario.questionNo")]
  } 

  const response = dialog.showMessageBoxSync(scenarioStudioWindow, options);
  if (response === 0) {
    return true;
  } else {
    return false;
  }
}


async function removeScenario (scenario) {

  const options = {
    type: 'question',
    title: L.get("scenario.removeQuestionTitle"),
    message: L.get(["scenario.removeQuestion", scenario.name]),
    buttons: [L.get("scenario.questionYes"), L.get("scenario.questionNo")]
  } 

  const response = dialog.showMessageBoxSync(scenarioStudioWindow, options);
  if (response === 0) {
    return await Scenario.remove(scenario.id);
  } else {
    return false;
  }

}


async function scenarioStudio() {
  if (scenarioStudioWindow) return scenarioStudioWindow.show();

  const style = {
    parent: mainWindow,
    frame: true,
    resizable: true,
    show: false,
    width: 1000,
    height: 650,
    maximizable: true,
    icon: path.resolve(__dirname, 'assets/images/icons/scenario.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'scenario-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: L.get("scenario.wintitle")
  };

  let infos = {plugins: [], clients: [], allClients: [], scenarios: {}};
  infos.plugins = await Avatar.pluginLibrairy.getPlugins();
  infos.plugins = infos.plugins.map(({ name, id }) => ({ name, id }));
  infos.clients = [Config.client];
  infos.allClients = [Config.client];
  infos.scenarios = await Scenario.getScenarios();

  scenarioStudioWindow = new BrowserWindow(style);
  scenarioStudioWindow.loadFile(path.resolve(__dirname, 'assets/html/scenario.html'));
  scenarioStudioWindow.setMenu(null);
  
  scenarioStudioWindow.once('ready-to-show', async () => {
    scenarioStudioWindow.show();
    scenarioStudioWindow.webContents.send('init-scenario', infos, interfaceProperties, true);
  });

  scenarioStudioWindow.on('closed', () => {
    scenarioStudioWindow = null;
  })
}


function showAvatarGithub() {
  shell.openExternal(`https://github.com/${Config.repository}`);
}

async function initInformation(next) {

  if (!next) {
    if (informationWindow) return informationWindow.show();
    if (initInformationWindow) return initInformationWindow.show();
  }

  const style = {
    parent: mainWindow,
    frame: false,
    movable: false,
    resizable: false,
    minimizable: false,
    alwaysOnTop: false,
    show: false,
    width: 300,
    height: 130,
    webPreferences: {
      preload: path.resolve(__dirname, 'initInformation-preload.js')
    }
  };

  initInformationWindow = new BrowserWindow(style);
  initInformationWindow.loadFile('./assets/html/initInformation.html');
  initInformationWindow.setMenu(null);

  if (!next) {
    var audit, outdated;
    initInformationWindow.once('ready-to-show', async () => {
      initInformationWindow.show();
      initInformationWindow.webContents.send('set-init-title', L.get("infos.titleInitMsg"), interfaceProperties);
      initInformationWindow.webContents.send('set-init-message', L.get("infos.auditMsg"));
      audit = await Report.runAudit(__dirname, 'audit');
      initInformationWindow.webContents.send('set-init-message', L.get("infos.outdatedMsg"));
      outdated = await Report.runAudit(__dirname, 'outdated');
      initInformationWindow.destroy();
    })
  } else {
    initInformationWindow.once('ready-to-show', async () => {
      initInformationWindow.show();
      initInformationWindow.webContents.send('set-init-title', L.get("infos.titleInitMsg"), interfaceProperties);
      initInformationWindow.webContents.send('set-init-message', L.get("infos.morePackageInfo"));
    })
  }

  initInformationWindow.on('closed', () => {
    initInformationWindow = null;
    if (!next) { information(audit, outdated);}
  })
}

async function information(audit, outdated) {

  if (informationWindow) return informationWindow.show();

  const infos = {
    version: Config.version,
    repository: Config.repository,
    arch: process.arch,
    nodeVer: process.versions.node,
    chromeVer: process.versions.chrome,
    electronVer: process.versions.electron 
  }

  const style = {
    parent: mainWindow,
    frame: true,
    resizable: true,
    show: false,
    minWidth: 400,
    width: 690,
    minHeight: 550,
    height: 550,
    maxHeight: 550,
    maximizable: false,
    icon: path.resolve(__dirname, 'assets/images/icons/info.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'information-preload.js')
    },
    title: L.get("infos.wintitle")
  };

  informationWindow = new BrowserWindow(style);
  informationWindow.loadFile(path.resolve(__dirname, 'assets/html/information.html'));
  informationWindow.setMenu(null);
  informationWindow.once('ready-to-show', () => {
    informationWindow.webContents.send('initApp', {audit: audit, outdated: outdated, infos: infos, interface: interfaceProperties});
  })

  informationWindow.on('closed', () => {
    informationWindow = null;
  })
}


function errorVoices (lang) {

  let options = {
    type: 'warning',
    title: L.get("settings.errorVoicesTitle"),
    message: L.get(["settings.errorVoicesMsg", lang])
  };
  dialog.showMessageBoxSync(settingsWindow, options);
}


function backupRestore () {
  if (backupRestoreWindow) return backupRestoreWindow.show();

  const style = {
    parent: mainWindow,
    frame: true,
    resizable: true,
    show: false,
    width: 450,
    height: 310,
    maximizable: false,
    icon: path.resolve(__dirname, 'assets/images/icons/backuprestore.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'backupRestore-preload.js')
    },
    title: L.get("backupRestore.wintitle")
  };

  backupRestoreWindow = new BrowserWindow(style);
  backupRestoreWindow.loadFile(path.resolve(__dirname, 'assets/html/backupRestore.html'));
  backupRestoreWindow.setMenu(null);
  
  backupRestoreWindow.once('ready-to-show', () => {
    backupRestoreWindow.show();
    backupRestoreWindow.webContents.send('initApp', {properties: appProperties, interface: interfaceProperties})
  })

  backupRestoreWindow.on('closed', () => {
    backupRestoreWindow = null;
  })
}


async function handleBackupFolderOpen() {

  const options = {
    defaultPath: path.parse(__dirname).root,
    properties: ['openDirectory']
  };

  const { canceled, filePaths } = await dialog.showOpenDialog(backupRestoreWindow, options);
  if (!canceled) return filePaths[0];

}

async function handlePowershellFileFileOpen () {
  const options = {
    title: L.get("settings.powershellTitle"),
    defaultPath: path.resolve (__dirname),
    filters: [{
      name: 'PowerShell exe',
      extensions: ['exe']
    }],
    properties: ['openFile', 'noResolveAliases']
  };

  const { canceled, filePaths } = await dialog.showOpenDialog(settingsWindow, options);

  if (!canceled) {
    return filePaths[0];
  }
}

async function applyBackupRestore(arg) {

  try {
    const folder = path.resolve(arg.folder, moment().format("DDMMYYYY-HHmm"));
    const location = {
      property: path.resolve(__dirname, 'core/Avatar.prop'),
      interface: path.resolve(__dirname, 'assets/config/interface.prop'),
      plugin: path.resolve(__dirname, 'core/plugins')
    }
    switch (arg.index) {
      case 0: 
        if (arg.reason === 'backup') {
          fs.copySync(location.property, folder + '/core/Avatar.prop')
        } else if (arg.reason === 'restore') {
          if (fs.existsSync(arg.folder + '/core/Avatar.prop'))
            fs.copySync(arg.folder + '/core/Avatar.prop', location.property);
          else 
            return false;
        } else if (arg.reason === 'default' && fs.existsSync(location.property)) { 
          await shell.trashItem(path.resolve(location.property));
        }
        return true;
      case 1: 
        if (arg.reason === 'backup') {
          fs.copySync(location.interface, folder + '/assets/config/interface.prop')
        } else if (arg.reason === 'restore') {
          if (fs.existsSync(arg.folder + '/assets/config/interface.prop'))
            fs.copySync(arg.folder + '/assets/config/interface.prop', location.interface);
          else 
            return false;
        } else if (arg.reason === 'default' && fs.existsSync(location.interface)) { 
          await shell.trashItem(path.resolve(location.interface));
        }
        return true;
      case 2: 
        if (arg.reason === 'backup') {
          fs.copySync(location.plugin, folder + '/core/plugins');
        } else if (arg.reason === 'restore') {
          if (fs.existsSync(arg.folder + '/core/plugins'))
            fs.copySync(arg.folder + '/core/plugins', location.plugin);
          else 
              return false;
        } 
        return true;
    }
    
  } catch (err) {
    return err;
  }
}



function pluginStudio() {

  if (pluginStudioWindow) return pluginStudioWindow.show();

  var style = {
    parent: mainWindow,
    frame: true,
    resizable: true,
    show: false,
    width: 790,
    height: 650,
    maximizable: true,
    icon: path.resolve(__dirname, 'assets/images/icons/pluginStudio.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'pluginStudio-preload.js')
    },
    title: L.get("pluginStudio.wintitle")
  };

  pluginStudioWindow = new BrowserWindow(style);
  pluginStudioWindow.loadFile(path.resolve(__dirname, 'assets/html/pluginStudio.html'));
  pluginStudioWindow.setMenu(null);
  pluginStudioWindow.once('ready-to-show', () => {
    pluginStudioWindow.show();
    pluginStudioWindow.webContents.send('initApp', interfaceProperties);
  })

  pluginStudioWindow.on('closed', function () {
    pluginStudioWindow = null;
  })
}


function showStudioEditorMenu(event, arg) {
  let template = [
    {
        label: L.get("pluginStudioMenu.save"),
        icon: path.resolve(__dirname, 'assets/images/icons/save.png'),
        click: () => {
          let propfile = fs.readJsonSync (arg.fullPath, { throws: false });
          let saved;
          if (propfile && !_.isEqual(propfile, arg.property)) {
            fs.writeJsonSync(arg.fullPath, arg.property);
            saved = true;
          }
          event.sender.send('property-Saved', {property: arg.property, saved: saved})
        }
    }
  ];
  let ext = path.extname(arg.fullPath);
  if (ext !== '.json') {
    template.push({
        label: L.get("pluginStudioMenu.reload"),
          icon: path.resolve(__dirname, 'assets/images/icons/restart.png'),
          click: async () => {
            Config = await Avatar.pluginLibrairy.reloadPlugin(arg.plugin);
            event.sender.send('refresh-Plugin', arg.plugin);
          }
    });
  }
  template.push(
    {type: 'separator'},
    {
        label: L.get("encrypt.wintitle"),
        icon: path.resolve(__dirname, 'assets/images/icons/encrypt.png'),
        click: () => {
          encrypt();
        }
    }
  );

  try {
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: pluginStudioWindow});
  } catch(err) {
    error(L.get("mainInterface.errorMenu"), err);
  }
}



function showPluginMenu (event, plugin, name) {

  let script = Avatar.find(plugin);
  if (!script) return;

  let state = (Config.modules[plugin] && ((Config.modules[plugin].active && Config.modules[plugin].active === true) || Config.modules[plugin].active === undefined)) ? true : false

  let pluginMenu = [
    {
        label: state === true ? L.get("pluginStudioMenu.disableLabel") : L.get("pluginStudioMenu.activeLabel"),
        icon: state === true ? path.resolve(__dirname, 'assets/images/icons/desactivate.png') : path.resolve(__dirname, 'assets/images/icons/activate.png'),
        click: () => {
          state = (Config.modules[plugin] && (Config.modules[plugin].active || Config.modules[plugin].active === undefined)) ? false : true
          Avatar.pluginLibrairy.activePlugin(plugin, state);
          event.sender.send('active-Plugin', {plugin: plugin, name: name, state: state})
        }
    },
    {type: 'separator'}
  ];

  pluginMenu.push(
    {
        label: L.get("pluginStudioMenu.delete"),
        icon: path.resolve(__dirname, 'assets/images/icons/close.png'),
        click: () => {deletePlugin(event, plugin)}
    }
  )

  if (fs.existsSync(path.resolve(__dirname, 'core/plugins', plugin, 'documentation'))) {
    if (fs.existsSync(path.resolve(__dirname, 'core/plugins', plugin, 'documentation', 'documentation.ini'))) {
      let docProps = fs.readJsonSync(path.resolve (__dirname, 'core/plugins', plugin , 'documentation/documentation.ini'), { throws: false });
      if (docProps && docProps.start) {
          pluginMenu.push(
            {type: 'separator'},
            {
                label: L.get("pluginStudioMenu.documentation"),
                icon: path.resolve(__dirname, 'assets/images/icons/help.png'),
                click: () => {
                  if (!appProperties.http.client.port) {
                    return warn(L.get("mainInterface.errorHTTPServer"));
                  } 
                  if (docProps.static) {
                    Avatar.static.set(path.resolve(__dirname, 'core/plugins', plugin, 'documentation'), () => {
                      shell.openExternal('http://localhost:'+appProperties.http.client.port+'/' + docProps.start);
                    });
                  } else {
                      shell.openExternal('file://'+path.resolve(__dirname, 'core/plugins', plugin, 'documentation')+'/'+docProps.start);
                  }
                }
            }
          )
        } else {
          event.sender.send('documentation-error', L.get("pluginStudioMenu.startError"))
        }
    } else {
      event.sender.send('documentation-error',  L.get("pluginStudioMenu.fileError"))
    }
  }

  const menu = Menu.buildFromTemplate(pluginMenu);
  menu.popup({window: pluginStudioWindow});

}


async function deletePlugin (event, plugin) {

  const pluginFolder = path.resolve(__dirname, 'core/plugins', plugin)
  let options = {
       type: 'question',
       title: L.get("pluginStudio.winDeleteTitle"),
       message: L.get(["pluginStudio.winDeleteMsg", plugin]),
       detail: L.get(["pluginStudio.winDeleteDetail", pluginFolder]),
       buttons: [L.get("pluginStudio.winDeleteOk"), L.get("pluginStudio.winDeleteCancel")]
   };

  const answer = dialog.showMessageBoxSync(settingsWindow, options);
  if (answer === 0) {
    if (Avatar.Plugin.exists(plugin)) Avatar.Plugin.removeCache(plugin);
    await shell.trashItem(pluginFolder);
    event.sender.send('delete-Plugin', plugin);
  }

}



function encrypt() {

  if (encryptWindow) return encryptWindow.show();

  var style = {
    parent: pluginStudioWindow,
    frame: true,
    movable: true,
    resizable: false,
    minimizable: false,
    alwaysOnTop: false,
    show: false,
    width: 430,
    height: 290,
    icon: path.resolve(__dirname, 'assets/images/icons/encrypt.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'encrypt-preload.js')
    },
    title: L.get("encrypt.wintitle")
  }

  encryptWindow = new BrowserWindow(style);
  encryptWindow.loadFile('./assets/html/encrypt.html');
  encryptWindow.setMenu(null);
   
  encryptWindow.once('ready-to-show', async () => {
    encryptWindow.show();
    const passwdFile = path.resolve(__dirname, "lib/encrypt/encrypt.json");
    let passwd = null;
    if (fs.existsSync(passwdFile)) {
       let encrypted = fs.readJsonSync (passwdFile, { throws: false });
       try {
        passwd = Avatar.decrypt(encrypted.password);
       } catch (err) {
          error ('Error:', err && err.length > 0 ? err : 'Error while decrypting the password. The password has been removed')
          await shell.trashItem(passwdFile);
          passwd = null;
       }
    }
    encryptWindow.webContents.send('initApp', passwd, interfaceProperties);
  })

  encryptWindow.on('closed', () => {
    encryptWindow = null;
  })  
}



async function handleFileOpen () {

  let options = {
    title: L.get("settings.backgroundtitle"),
    defaultPath: path.resolve (__dirname, 'assets/images/background'),
    filters: [{name: 'Images', extensions: ['jpg']}],
    properties: ['openFile']
  };

  const { canceled, filePaths } = await dialog.showOpenDialog(settingsWindow, options)
  if (!canceled) return filePaths[0];
}


async function handleScreenSaverFileOpen () {
  let options = {
    title: L.get("settings.screensavertitle"),
    defaultPath: path.resolve (__dirname),
    filters: [],
    properties: ['openFile']
  };

  const { canceled, filePaths } = await dialog.showOpenDialog(settingsWindow, options)
  if (!canceled) return filePaths[0]
}


async function isCloseApp() {

  let options = 
  {
       type: 'question',
       title: L.get("mainInterface.quit"),
       message: L.get("mainInterface.quitAsk"),
       buttons: [L.get("mainInterface.buttonYes"), L.get("mainInterface.buttonNo")]
   };

   return dialog.showMessageBoxSync(mainWindow, options)
}



async function closeApp(arg, flag) {
  try {
    await Avatar.pluginLibrairy.onPluginClose(arg.widgets);
  } catch (err) {
    return error("Onclose plugin error:", err || 'Unknow error' );
  }

  let style = {};
  style.screen = interfaceProperties.screen;
  style.screen.width = arg.main.width;
  style.screen.height= arg.main.height;
  style.screen.fullscreen = fullScreen;
  
  style.console = interfaceProperties.console;
  style.console.width = arg.console.width;
  style.console.height = arg.console.height;
  style.console.left = arg.console.left;
  style.console.top = arg.console.top;

  style.visualizer = interfaceProperties.visualizer;
  if (interfaceProperties.visualizer.display === true) {
    style.visualizer.width = arg.visualizer.width;
    style.visualizer.height = arg.visualizer.height;
    style.visualizer.left = arg.visualizer.left;
    style.visualizer.top = arg.visualizer.top;
  }

  style.nodes = interfaceProperties.nodes;
  style.nodes.left = arg.nodes.left;
  style.nodes.top = arg.nodes.top;

  let file = path.resolve(__dirname, 'assets/config/interface.prop');
  fs.writeJsonSync(file, style);
  
  if (flag) {
    mainWindow.destroy();
  } else {
    app.relaunch();
    app.exit();
  } 
}


function startControl() {
  const d = new Date();
  const s = d.getMinutes()+5;
  d.setMinutes(s);
  timeoutStartControl = new CronJob(d, async () => {
    if (timeoutStartControl) {
      error(L.get("mainInterface.notStarted"));
      const d = new Date();
      const s = d.getMinutes()+1;
      d.setMinutes(s);
      new CronJob(d, async () => {
        app.relaunch();
        app.exit();
      }, null, true);
    }
  }, null, true);
}


async function appInit () {
    try {
      if (appProperties.client === '' || appProperties.UDP.target === '') {
        welcomeSetting();
        return false;
      } else { 
        startControl();
        let result = await avatar.initClient(appProperties, safeStorage);
        if (timeoutStartControl) {
          timeoutStartControl.stop();
          timeoutStartControl = null;
        }
        if (typeof result === 'string') {
            return error(result);
        }
        await Avatar.pluginLibrairy.initVar(Config);
        github = await githubLib.init(Config);
        Report = await reportLibrary.init();
        Scenario = await scenarioLibrary.init();
        return true;
      }
    } catch (err) {
      error(err.stack ? err.stack : err);
      return false;
    }
}


function screenSaver () {
  if (appProperties.screenSaver.active === true) {
    const script = process.platform === 'win32'
    ? path.join(__dirname, "lib", "screensaver", "win32", (fs.existsSync("screensaver.bat") ? "screensaver.bat" : "screensaver.vbs")).concat(" \"" + appProperties.screenSaver.exec + "\"")
    : path.join(__dirname, "lib", "screensaver", process.platform, "screensaver.sh").concat(" \"" + appProperties.screenSaver.exec + "\"");

    setTimeout(() => {    
      exec(script, (err, _stdout, stderr) => {
        if (err) {
          error(L.get(["mainInterface.noScreenSaver", err]));
        }
      })
    }, appProperties.screenSaver.timeout);
  }
}


async function testVoice (arg) {
  if (arg.init === true) {
    warn(L.get("settings.voiceTestError"));
    return;
  }

  if (arg.voice === 'by default') arg.voice = null;
  info(L.get("settings.testVoiceInfo"));
  Avatar.speak(arg.sentence, () => {
    infoGreen(L.get('mainInterface.readyToListen'));
  }, true, arg.voice, arg.volume, arg.speed, arg.pitch, arg.type);
}


function welcomeSetting() {

  if (welcomeSettingWindow) return welcomeSettingWindow.show();

  let style = {
    parent: mainWindow,
    resizable: true,
    show: false,
    width: 400,
    height: 250,
    maximizable: false,
    icon: path.resolve(__dirname, 'assets/images/Avatar.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'welcomeSetting-preload.js')
    },
    title: L.get("init.newTitle")
  };

  welcomeSettingWindow = new BrowserWindow(style);
  welcomeSettingWindow.loadFile(path.resolve(__dirname, 'assets/html/welcomeSetting.html'));
  welcomeSettingWindow.setMenu(null);
 
  welcomeSettingWindow.once('ready-to-show', async () => {
    welcomeSettingWindow.show();
    welcomeSettingWindow.webContents.send('initApp', {properties: appProperties, interface: interfaceProperties})
  });

  welcomeSettingWindow.on('closed', async () => {
    app.relaunch();
    app.exit();
  })
}


function settings(init) {

  if (settingsWindow) return settingsWindow.show();

  let style = {
    parent: mainWindow,
    resizable: true,
    show: false,
    width: 730,
    height: 730,
    maximizable: true,
    icon: path.resolve(__dirname, 'assets/images/icons/settings.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'settings-preload.js')
    },
    title: L.get("settings.wintitle")
  };

  settingsWindow = new BrowserWindow(style);
  settingsWindow.loadFile(path.resolve(__dirname, 'assets/html/settings.html'));
  settingsWindow.setMenu(null);
 
  settingsWindow.once('ready-to-show', async () => {
    if (!init) Avatar.Listen.getRemoteVoices(init);
  });

  settingsWindow.on('closed', async () => {
    settingsWindow = null;
    if (init === true) appInit();
  })
}


function getVoices (lang, initSettings) {

  return new Promise(async (resolve) => {

    if (!initSettings) Avatar.Listen.getRemoteVoices(false, lang);

    const voices = await getSystemVoices();
    var langVoices = [];
    switch (process.platform) {
      case 'win32':
        langVoices = _.reject(BCP47dialog, num => { 
          return num.tag !== lang; 
        });
        if (langVoices.length > 0) {
            langVoices = _.reject(voices, num => { 
            return num.language !== langVoices[0].code.toLowerCase(); 
          });
        }
        break;
      case 'darwin':
        lang = lang.replace('-', '_');
        langVoices = _.reject(voices, num => { 
          return num.language !== lang; 
        });
        break;
      case 'linux':
        langVoices = _.reject(voices, num => { 
          return num.language.toLowerCase() !== lang.toLowerCase() && num.language.toLowerCase() !== lang.split('-')[0].toLowerCase(); 
        });
    }   

    setTimeout(() => {
      if (initSettings === true)
        resolve(langVoices);
      else
        settingsWindow.webContents.send('setLocalVoices', langVoices);
        resolve();
    }, 300)  
  });
}


async function openSettings(init, webVoices) {

  let langVoices = await getVoices(appProperties.speech.locale, true)
  const tblvoices = {"web-voice": webVoices, "local-voice": langVoices};
  setTimeout(() => {
    settingsWindow.webContents.send('initApp', {interface: interfaceProperties, properties: appProperties, BCP47: BCP47dialog, BCP47app: BCP47app, voices: tblvoices, init: init});
    settingsWindow.show();
  }, 300)
}


function getSystemVoices() {
  return new Promise((resolve) => {
    TTS.getVoices().then((voices) => {
      resolve(voices);
    })
    .catch((err) => {
      error ('Error getSystemVoices:', err)
      resolve ([]);
    });
  });
}


async function showMenu(arg) {

  let iconPath = path.resolve(__dirname, 'assets/images/icons');
  const template = [
    {
      label: L.get("menu.listening"),
      icon: iconPath+'/unmute.png',
      click: async () => {
          infoGreen(L.get('mainInterface.listenStarted'));
          Avatar.Listen.start(true);
      }
    },
    {
        label: L.get("menu.desactiveListening"),
        icon: iconPath+'/mute.png',
        click: async () => {
          infoOrange(L.get('mainInterface.listenStopped'));
          Avatar.Listen.stop(true);
        }
    },
    {type: 'separator'},
    {
        label: L.get("menu.startListening"),
        icon: iconPath+'/start_micro.png',
        click: async () => Avatar.Listen.startListenAction()
    },
    {
        label: L.get("menu.stopListening"),
        icon: iconPath+'/stop_micro.png',
        click: async () => {
          infoOrange(L.get('mainInterface.listenCanceled'));
			    Avatar.Listen.stoptListenAction(appProperties.client, true);
        }
    },
    {type: 'separator'},
    {
      label: L.get("menu.edition"),
      icon: iconPath+'/edition.png',
      submenu: [
        {
          label: L.get("menu.pluginStudio"),
          icon: iconPath+'/pluginStudio.png',
          click: async () => pluginStudio()
        },
        {
          label: L.get("backupRestore.wintitle"),
          icon: iconPath+'/backuprestore.png',
          click: async () => backupRestore()
        },
        {type: 'separator'},
        {
          label: L.get("scenario.wintitle"),
          icon: iconPath+'/scenario16.png',
          click: async () => scenarioStudio()
        },
        {type: 'separator'},
        {
            label: L.get("menu.vsCode"),
            icon: iconPath+'/vscode.png',
            click: async () => shell.openExternal('https://vscode.dev')
            
        }
      ]
    },
    {type: 'separator'},
    {
      label: L.get("menu.property"),
      icon: iconPath+'/settings.png',
      click: async () => settings(false)
    },
    {type: 'separator'},
    {
      label : L.get("menu.interface"),
      icon  : iconPath+'/toggle.png',
      submenu : [
        {
          label: L.get("menu.console"),
          icon: iconPath+'/toggle.png',
          click: async () => {
            interfaceProperties.console.display = !interfaceProperties.console.display;
            mainWindow.webContents.send('to-console');
          }
        },
        {
          label: L.get("menu.visualizer"),
          icon: iconPath+'/toggle.png',
          click: async () => {
            interfaceProperties.visualizer.display = !interfaceProperties.visualizer.display;
            mainWindow.webContents.send('to-visualizer');
          }
        },
        {
          label: L.get("menu.fullscreen"),
          icon: iconPath+'/fullscreen.png',
          click: async () => {
            fullScreen = !fullScreen; 
            mainWindow.setFullScreen(fullScreen);
          }
        },
        {
          label: L.get("menu.minimize"),
          icon: iconPath+'/minimize.png',
          click: async () => mainWindow.minimize()
        }
      ]
    },
    {type: 'separator'},
    {
      label: L.get("menu.documentation"),
      icon: iconPath+'/help.png',
      click: async () => documentation()
    },
    {type: 'separator'},
    {
      label: L.get("infos.menu"),
      icon: iconPath+'/info.png',
      click: async () => {Avatar.Interface.information()}
    },
    {type: 'separator'},
    {
      label: L.get("menu.restart"),
      icon: iconPath+'/restart.png',
      click: async () => mainWindow.webContents.send('to-appReload')
    },
    {
      label: L.get("menu.quit"),
      icon: iconPath+'/exit.png',
      click: async () => mainWindow.webContents.send('to-appExit')
    }
  ];

  try {
    const menu = Menu.buildFromTemplate(template);
    menu.popup({x: Math.round(arg.pos.x), y: Math.round(arg.pos.y)});
  } catch(err) {
    error(L.get("mainInterface.errorMenu"));
  }

}


function documentation() {
    shell.openExternal(Config.docs);
}


function setNewVersion (version) {
    const options = {
        type: 'question',
        title: L.get(["newVersion.newVersionTitle", version]),
        message: L.get("newVersion.newVersionMsg"),
        detail: L.get("newVersion.newVersionDetail"),
        noLink: true,
        buttons: [L.get("newVersion.clientOnly"), L.get("newVersion.allClients"), L.get("newVersion.cancelupdate")]
    };

    const answer = dialog.showMessageBoxSync(mainWindow, options);
    if (answer === 2) return false;

    Avatar.updateVersionStep1(version, answer);
    return true;
}


const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  // Someone tried to execute a second instance, closing the second instance.
  app.quit();
} else  {
  app.on('second-instance', (event, commandLine, workingDirectory, additionalData) => {
    // Someone tried to run a second instance, focus on the window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  })

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
      if (mainWindow === null) createWindow();
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    })

  })

  app.on('window-all-closed',() => {
    app.quit();
  })

  app.on('will-quit', () => {
      globalShortcut.unregisterAll();
  })
}


function Language() {
    var __construct = function() {
      preferredLanguage = appProperties.language === 'auto' ? app.getPreferredSystemLanguages()[0].split('-')[0] : appProperties.language;
      if (preferredLanguage && fs.existsSync(path.resolve(__dirname, 'locales/'+preferredLanguage+'.loc')))
        language = fs.readJsonSync(path.resolve(__dirname, 'locales/'+preferredLanguage+'.loc'), { throws: appProperties.verbose });
      if (!language) language = fs.readJsonSync(path.resolve(__dirname, 'locales/en.loc'), { throws: appProperties.verbose });
      return;
    }()
    this.get = function() {
      let tblarg = [], str;
      if (typeof arguments[0] === "object") {
        for (var i = 1; i < arguments[0].length; i++) {
          tblarg.push(arguments[0][i])
        }
        str = arguments[0][0]
      } else {
        str = arguments[0]
        for (var i = 1; i < arguments.length; i++) {
          tblarg.push(arguments[i])
        }
      }
      var retStr = eval('eval(language).'+str);
      if (typeof retStr !== 'undefined') {
        return setLParameters(retStr, tblarg)
      } else
        return 'Label not defined: '+str
    }
}


function setLParameters(str, arg) {
  let words = str.split(' '), a = 0;
  for (var i = 0; i < words.length && arg.length > 0; i++) {
    if (words[i].indexOf('$$') !== -1 && arg[a]) {
      words[i] = words[i].replace('$$', arg[a])
      a += 1
    }
  }
  return words.join(' ')
}


const showNewVersionInfo = parent => {

  if (!fs.existsSync(path.resolve(__dirname, 'README.md'))) return;

  const style = {
    parent: parent,
    frame: true,
    movable: true,
    resizable: true,
    minimizable: false,
    alwaysOnTop: false,
    show: false,
    width: 650,
    height: 500,
    icon: path.resolve(__dirname, 'assets/images/icons/changeLog.png'),
    webPreferences: {
      preload: path.resolve(__dirname, 'newVersionInfo-preload.js')
    },
    title: L.get("mainInterface.changeLog")
  }

  const mdInfos = fs.readFileSync(path.resolve(__dirname, 'README.md'), 'utf8');
  
  newVersionInfo = new BrowserWindow(style);
  newVersionInfo.loadFile('./assets/html/newVersionInfo.html');
  newVersionInfo.setMenu(null);
  
  newVersionInfo.once('ready-to-show', () => {
    newVersionInfo.show();
    newVersionInfo.webContents.send('initApp', mdInfos, interfaceProperties);
  })

  newVersionInfo.on('closed', () => {
    newVersionInfo = null;
  })  

}


const checkUpdate = async () => {

  if (fs.existsSync(path.resolve(__dirname, 'tmp', 'step-2.txt'))) {
    let installType = fs.readFileSync(path.resolve(__dirname, 'tmp', 'step-2.txt'), 'utf8');
    installType = installType.split('-');
    return Avatar.HTTP.socket.emit('sendNewClientVersion', ((installType[1] === '0') ? appProperties.client : null), installType[0]);
  } 

  if (fs.existsSync(path.resolve(__dirname, 'tmp', 'step-3.txt'))) {
    fs.removeSync(path.resolve(__dirname, 'tmp', 'step-3.txt'));
    if (process.platform === 'linux') fs.removeSync(path.resolve(__dirname, 'tmp', 'shell.sh'));
    Avatar.HTTP.socket.emit('installClientVersionDone', appProperties.client);
    infoGreen(L.get('newVersion.step3'));
    showNewVersionInfo(mainWindow);
  }
  
  if (Config.checkUpdate === true) {
    const result = await github.checkUpdate(mainWindow);
    if (result !== false) {
      if (fs.existsSync(path.resolve(__dirname, 'README.md'))) fs.removeSync(path.resolve(__dirname, 'README.md'));
      await mainWindow.webContents.send('newVersion', result);
    }
  }
}


global.getApp = () => {
  return app;
}

process.on('uncaughtException', function (err) {
  error('Caught exception: '+ err.stack)
})

process.on('UnhandledPromiseRejectionWarning', function (err) {
  error('Caught exception: '+ err.stack)
})

