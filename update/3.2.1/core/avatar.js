import {default as express } from 'express';
import * as http from 'node:http';
import { default as scanIP } from 'evilscan';
import { CronJob } from 'cron';
import { io } from "socket.io-client";
import { default as ss } from '../lib/socket.io-stream/index.js';
import dgram from 'node:dgram';
import { Buffer } from 'node:buffer';
import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
import * as os from 'node:os';
import { exec } from 'node:child_process';
import * as path from 'node:path';
import fs from 'fs-extra';
import moment from 'moment';

import * as pluginLib from '../pluginLibrairy.js';
import * as functionsLib from '../functionLibrairy.js';
import * as widgetlib from '../widgetLibrairy.js';

import { initPluginLanguage } from './language.js';
import { FFplay }  from './ffplay.js';
import * as Speak from './speak.js';
import * as Listen from './listen.js';
import { AudioRecorder } from './intercom.js';
import { initStatic } from './manager/staticFolder.js';
import { initScript } from "./manager/script.js";
import { initConfig } from "./manager/config.js";
import { initPlugin } from "./manager/plugin.js";
import { initCron } from "./manager/cron.js";

const controller = new AbortController();
const { signal } = controller;
const udpClient = dgram.createSocket({type: 'udp4', signal });
let UDPcron, ipClient;
let player;
let safeStorage;
let udpServers = [];


function autoRestart() {
	if (Config.restart > 0) {
		const hour = Math.round(24/Config.restart)
		const delay = Config.mnToRestart + " */" + hour + " * * *";
		appInfo(L.get(['mainInterface.autoRestart', hour, Config.mnToRestart]));
		new CronJob(delay, async () => {
			Avatar.Interface.restart();
		}, null, true);
	}
}


function encrypt (value) {
    if (safeStorage.isEncryptionAvailable() && typeof value === "string") {
        let encrypted = safeStorage.encryptString(value);
        encrypted = encrypted.toJSON();
        return encrypted.data.toString();
    } else {
		return false;
	}
}


function decrypt (value) {
    if (safeStorage.isEncryptionAvailable() && (typeof value === "string" || typeof value === "object")) {
		if (typeof value === "string") value = value.split(',');
        const encrypted = Buffer.from(value);
        let decrypted = safeStorage.decryptString(encrypted);
        return decrypted;
    } else {
		return false;
	}
}


async function initHTTP () {

	if (Config.http.client.port && Config.http.client.route) {
		let appClient = express();
		let server = http.createServer(appClient);
		global.appClient = appClient;

		appClient.get (`/avatarclient-${Config.http.client.route}/:plugin`, Avatar.Script.routes); // HTTP routes
		appClient.post(`/avatarclient-${Config.http.client.route}/:plugin`, Avatar.Script.routes); // HTTP routes

		let webapp = server.listen(Config.http.client.port);  
		appInfo(L.get(["mainInterface.httpClient", Config.client, webapp.address().port])) // logger
	} else 
		global.appClient = null;

}


function initClient (prop, electronEncrypt) {

	return new Promise(async (resolve) => {

		global.Config = prop;
		global.Avatar = {};

		global.Avatar.intercom = intercom;

		safeStorage = electronEncrypt;
		Avatar.encrypt = encrypt;
		Avatar.decrypt = decrypt;
		Avatar.play = play;
		Avatar.stop = stop;
		Avatar.getProperty = getProperty;
		Avatar.updateVersionStep1 = updateVersionStep1;

		fs.ensureDirSync(path.resolve(__dirname, 'plugins')); 

		Avatar.APIFunctions = await functionsLib.init();
		Avatar.Widget = await widgetlib.init();
		Avatar.pluginLibrairy = await pluginLib.init();

		await initPluginLanguage();
		await initScript();
		await initConfig();
		await initPlugin();
		await initCron();
		await initHTTP();
		await initStatic();

		let serverIp = await connect();
		await HTTPconnect(serverIp);

		global.Avatar.Interface = {};
		
		autoRestart();

		appInfo(L.get('mainInterface.initTTS'));
		Speak.initSpeak ();
		
		appInfo(L.get('mainInterface.initListen'));
		let result = await Listen.initListen ();

		resolve (result);
	})
}


async function sendPingToServer (appServer) {

    return new Promise((resolve) => {
        udpClient.on('message', () => {
			udpServers.push(appServer);
        });

		const msg = Buffer.from("AvatarClientPing:fixe:"+Config.client);
		udpClient.send(msg, Config.UDP.port, appServer, (err) => {
			if(err) {
				throw new Error (L.get(["mainInterface.networkScanError", err]))
			}
            resolve();
		});
    })
}


async function UDPconnect (resolve) {

	let WifiIP = [];
	let options = {
		target: Config.UDP.target,
		port: Config.http.server.port,
		status:'O' // Open
	};

	const scanner = new scanIP(options);
	scanner.on('result',function(data) {
		WifiIP.push(data);
	});
	scanner.on('error',function(err) {
	  throw new Error (L.get(["mainInterface.wifiScanError", err]));
	});

	scanner.on('done', async () => {
		if (WifiIP && WifiIP.length > 0) {
			let count = WifiIP.length;
            for(let s in WifiIP) {
                await sendPingToServer(WifiIP[s].ip);
				if (!--count) getUdpServer(resolve);
            }
		} else {
			getUdpServer(resolve);
		}
	});
	scanner.run();
}


function UDPScanRestart (resolve) {
	if (UDPcron) UDPcron.stop();
	let d = new Date();
	let s = d.getSeconds()+Config.UDP.restart;
	d.setSeconds(s);

	UDPcron = new CronJob(d, () => {
		if (UDPcron) {
		  UDPcron.stop();
		  UDPcron = null;
		}
		UDPconnect(resolve);
	}, null, true);

}


function getUdpServer(resolve) {
	let d = new Date();
	let s = d.getSeconds()+2;
	d.setSeconds(s);
	new CronJob(d, () => {
		switch (udpServers.length) {
			case 0:
				warn(L.get(["mainInterface.retryNetworkScan", Config.UDP.restart]));
				UDPScanRestart(resolve);
				break;
			case 1:
				resolve(udpServers[0]);
			default:
				controller.abort();
				udpServers = [];
				if (udpServers.length > 1)
					throw new Error (L.get(["mainInterface.multiAppError", Config.http.server.port]))
		}
	}, null, true);
}


async function getIpAddress() {
	let ip = '127.0.0.1';
	const ips = os.networkInterfaces();
	Object
	.keys(ips)
	.forEach(function(_interface) {
		ips[_interface]
		.forEach(function(_dev) {
			if (_dev.family === 'IPv4' && !_dev.internal) ip = _dev.address 
		}) 
	});

	return ip;
}


function connect () {
    return new Promise(async (resolve) => {
        appInfo(L.get('mainInterface.networkScan'));
		 Config.http.client.ip = ipClient = await getIpAddress();
         UDPconnect(resolve);
    })
}


async function HTTPconnect(serverIp) {

	return new Promise((resolve) => {

		let socket = io('http://' + ((serverIp) ? serverIp : Config.http.server.ip) + ':' + Config.http.server.port, 
			{forceNew: true, autoConnect: true, reconnection: true, reconnectionDelay: 15000, reconnectionAttempts: Infinity})
		.on('connect_error', (err) => {
			warn(L.get('mainInterface.restartConnection'));
		})
		.on('connect', () => {
			socket.emit('client_connect', Config.client, ipClient, Config.http.client.port, Config.speech.server_speak, Config.listen.loop_mode, null , Config.speech.locale, process.platform);
		})
		.on('disconnect', () => {
			error(L.get('mainInterface.interruptConnection'));
		})
		.on('connected', () => {
			infoGreen(L.get('mainInterface.connected'));
			resolve();
		})
		.on('mute', (qs, callback) => {
			Avatar.Listen.silence(() => {
				if (qs.sync) socket.emit('callback', callback);
			});
		})
		.on('end', (client, full) => Avatar.Listen.end(client, full))
		.on('speak', (qs, callback) => {
			if (qs.sync) {
				if (qs.end === true) {
					Avatar.speak( qs.tts, async () => {
						await Avatar.Listen.end(Config.client, true);
						socket.emit('callback', callback);
					}, true, qs.voice, qs.volume, qs.speed, qs.pitch);
				} else {
					Avatar.speak( qs.tts, () => socket.emit('callback', callback), false, qs.voice, qs.volume, qs.speed, qs.pitch);
				}
			} else if (qs.end === true) {
				Avatar.speak(qs.tts, () => Avatar.Listen.end(Config.client, true), true, qs.voice, qs.volume, qs.speed, qs.pitch);
			} else if (qs.end === false)  {
				Avatar.speak(qs.tts, null, false, qs.voice, qs.volume, qs.speed, qs.pitch);
			}
		})
		.on('listen_again', () => Avatar.Listen.startListen())
		.on('client_speak', (tts, callback) => Avatar.speak(tts, callback))
		.on('callback_client_speak', () => {
			if (Avatar.serverSpeakCallback) Avatar.serverSpeakCallback();
			Avatar.serverSpeakCallback = null;
		})
		.on('askme', options => Avatar.Listen.askme(options))
		.on('askme_stop', () => Avatar.Listen.stop())
		.on('askme_done', () => Avatar.Listen.askmeDone())
		.on('listenOnOff', listen => {
			if (listen === true) {
				infoGreen(L.get('mainInterface.listenStarted'));
				Avatar.Listen.start(true);
			} else {
				infoOrange(L.get('mainInterface.listenStopped'));
				Avatar.Listen.stop(true);
			}
		})
		.on('start_listen', () => Avatar.Listen.startListenAction())
		.on('stop_listen', (client, full) => {
			infoOrange(L.get('mainInterface.listenCanceled'));
			Avatar.Listen.stoptListenAction(client, full);
		})
		.on('backupPlugin', (qs, callback) => backupPlugin(qs, callback)) 
		.on('plugin', (qs, callback) => runPlugin(qs, callback))
		.on('setStaticFolder', (qs, callback) => {
			if (qs.sync) {
				Avatar.static.set(qs.folder, () => {
					Avatar.HTTP.socket.emit('callback', callback);
				})
			} else {
				Avatar.static.set(qs.folder);
			}
		})
		.on('run', (qs, callback) => runApp(qs, callback))
		.on('play', (qs, callback) => musicPlay(qs, callback))
		.on('stop', (qs, callback) => musicStop(qs, callback))
		.on('playIntercom', (from, adress) => playIntercom(from, adress))
		.on('copyFile', (qs, callback) => copyFile(qs, callback))
		.on('updateVersionFromServer', (src, version) => updateVersionFromServer(src, version))
		.on('updateLocalVersion', version => updateVersionStep2(version, true))
		.on('restart', () => Avatar.Interface.restart())
		.on('quit', () => Avatar.Interface.quit())
		.on('shutdown', () => shutdown())
		Avatar.HTTP = { socket : socket };

		ss(socket).on('copyIntercomFile', (stream, callback) => {
			copyIntercomFile(stream, callback);
		});

		ss(socket).on('copyNewVersion', (stream, callback) => {
			copyNewVersionFile(stream, callback);
		});
	})
}


async function copyIntercomFile(stream, callback) {
	const sharedFolder = path.resolve(__dirname, 'intercom');
  	fs.ensureDirSync(sharedFolder);
	let file = path.resolve(sharedFolder, 'intercom.wav');
	fs.createReadStream(file).pipe(stream);
	stream.on('end', async() => {
		if (callback) Avatar.HTTP.socket.emit('callback', callback);
	});
}


async function copyNewVersionFile(stream, callback) {
	const sharedFolder = path.resolve(__dirname, '..', 'tmp');
  	fs.ensureDirSync(sharedFolder);
	let file = path.resolve(sharedFolder, `newVersion.zip`);
	fs.createReadStream(file).pipe(stream);
	stream.on('end', async() => {
		if (callback) Avatar.HTTP.socket.emit('callback', callback);
	});
}


function backupPlugin (qs, callback) {
	const pluginFolder = path.resolve(__dirname, 'plugins', qs.plugin);
	const backupFolder = path.resolve(__dirname, 'backup-plugins', qs.plugin, moment().format("DDMMYYYY-HHmm"));

	if (fs.exists(pluginFolder)) {
		fs.copy(pluginFolder, backupFolder, err => {
			if (err) error(`Error ${qs.plugin} backup:`, err);
			if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
		})
	} else {
		if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
	}
}


async function updateVersionStep1 (version, answer) {

	const exitApp = () => {
		warn(L.get(['newVersion.step1', version]));
		const d = new Date();
		const s = d.getSeconds()+5;
		d.setSeconds(s);
		new CronJob(d, async () => {
			Avatar.Interface.mainWindow().destroy();
		}, null, true);
	}

	let cmd, batch;
	let installPath = path.resolve(__dirname, '..', 'tmp');
    switch (process.platform) {
	case 'win32':

		const powerShell = (Config.powerShell) ? Config.powerShell : "powershell";

		cmd = "@echo off";
		cmd += "\n";
		cmd += `call cmd /K "${powerShell}" -ExecutionPolicy Bypass -command ./${version}-${answer}.ps1`;
		
		fs.copySync(path.resolve(__dirname, '..', 'lib', 'versioning', 'win32', 'step-1.ps1'), path.resolve(`${installPath}`, `${version}-${answer}.ps1`));
		fs.writeFileSync(path.resolve(`${installPath}`, 'shell.bat'), cmd, 'utf8');

		const opened = await Avatar.Interface.shell().openPath(path.resolve(`${installPath}`, "shell.bat"));
		if (opened) {
			Avatar.Interface.dialog().showErrorBox('Error:', L.get(['newVersion.errorOpenTerminal', version, opened]));
		} else {
			exitApp();
		}
		break;
	case 'linux':
		cmd = `cd ${installPath}\n`;
		cmd += `export NVM_DIR="$HOME/.nvm"\n`;
		cmd += `[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"\n`;
		cmd += `[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"\n`;
		cmd += `pwsh -ExecutionPolicy Bypass -command ./${version}-${answer}.ps1`;
				
        fs.copySync(path.resolve(__dirname, '..', 'lib', 'versioning', 'linux', 'step-1.ps1'), path.resolve(`${installPath}`, `${version}-${answer}.ps1`));
		fs.writeFileSync(path.resolve(`${installPath}`, 'shell.sh'), cmd, 'utf8');
        fs.chmodSync(path.resolve(`${installPath}`, 'shell.sh'), "755");
        batch = `gnome-terminal --working-directory=${installPath} -- ./shell.sh`;

        exec(batch, (err, stdout, stderr) => {
            if (err) {
              return Avatar.Interface.dialog().showErrorBox('Error:', L.get(['newVersion.errorOpenTerminal', version, opened]));
            }
            exitApp();
        });
		break;
	case 'darwin':
		cmd = `osascript -e 'tell application "Terminal" to do script "cd ${installPath} && pwsh -command ./${version}-${answer}.ps1" & activate'`;
		
        fs.copySync(path.resolve(__dirname, '..', 'lib', 'versioning', 'darwin', 'step-1.ps1'), path.resolve(`${installPath}`, `${version}-${answer}.ps1`));
		
		batch = `${installPath}/shell.sh`
		fs.writeFileSync(batch, cmd, 'utf8');
        fs.chmodSync(batch, "755");

        exec(batch, err => {
            if (err) {
              return Avatar.Interface.dialog().showErrorBox('Error:', L.get(['newVersion.errorOpenTerminal', version, err]));
            }
			exitApp();
        });
		break;		
	}
}


async function updateVersionStep2 (version, local) {
	
	version = version.replace(/^\uFEFF/, '');

	const exitApp = () => {
		const msg = local ? L.get(['newVersion.localStep2', version]) : L.get(['newVersion.step2', version]);
		warn(msg);
		const d = new Date();
		const s = d.getSeconds()+5;
		d.setSeconds(s);
		new CronJob(d, async () => {
			Avatar.Interface.mainWindow().destroy();
		}, null, true);
	}

	let cmd, batch;
	let installPath = path.resolve(__dirname, '..', 'tmp');
	switch (process.platform) {
		case 'win32':
			const powerShell = (Config.powerShell) ? Config.powerShell : "powershell"

			cmd = "@echo off";
			cmd += "\n";
			cmd += `call cmd /K "${powerShell}" -ExecutionPolicy Bypass -command ./${version}.ps1`;
			
			fs.copySync(path.resolve(__dirname, '..', 'lib', 'versioning', 'win32', 'step-2.ps1'), path.resolve(`${installPath}`, `${version}.ps1`));
			fs.writeFileSync(path.resolve(`${installPath}`, 'shell.bat'), cmd, 'utf8');

			const opened = await Avatar.Interface.shell().openPath(path.resolve(`${installPath}`, "shell.bat"));
			if (opened) {
				return Avatar.Interface.dialog().showErrorBox('Error:', L.get(['newVersion.errorOpenTerminal', version, opened]));
			} 

			exitApp();
			break;
		case 'linux':
			cmd = `cd ${installPath}\n`;
			cmd += `export NVM_DIR="$HOME/.nvm"\n`;
			cmd += `[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"\n`;
			cmd += `[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"\n`;
			cmd += `pwsh -ExecutionPolicy Bypass -command ./${version}.ps1`;
				
			fs.copySync(path.resolve(__dirname, '..', 'lib', 'versioning', 'linux', 'step-2.ps1'), path.resolve(__dirname, '..', 'tmp', `${version}.ps1`));
			fs.writeFileSync(path.resolve(`${installPath}`, 'shell.sh'), cmd, 'utf8');
			fs.chmodSync(path.resolve(`${installPath}`, 'shell.sh'), "755");
			batch = `gnome-terminal --working-directory=${installPath} -- ./shell.sh` 

			exec(batch, (err) => {
				if (err) {
					return Avatar.Interface.dialog().showErrorBox('Error:', L.get(['newVersion.errorOpenTerminal', version, opened]));
				}

				exitApp();
			});
			break;
		case 'darwin':
			cmd = `osascript -e 'tell application "Terminal" to do script "cd ${installPath} && pwsh -command ./${version}.ps1" & activate'`;
			
			fs.copySync(path.resolve(__dirname, '..', 'lib', 'versioning', 'darwin', 'step-2.ps1'), path.resolve(`${installPath}`, `${version}.ps1`));
			
			batch = `${installPath}/shell.sh`
			fs.writeFileSync(batch, cmd, 'utf8');
			fs.chmodSync(batch, "755");

			exec(batch, err => {
				if (err) {
				return Avatar.Interface.dialog().showErrorBox('Error:', L.get(['newVersion.errorOpenTerminal', version, err]));
				}
				exitApp();
			});
			break;		
	}
}


async function updateVersionFromServer(src, version) {
	version = version.replace(/^\uFEFF/, '');
	info(L.get(['newVersion.download', version]));

	const sharedFolder = path.resolve(__dirname, '..', 'tmp', 'download');
	const file = path.resolve(sharedFolder, 'newVersion-'+version+'.zip');
	fs.ensureDirSync(sharedFolder);

	const stream = ss.createStream();
	stream.pipe(fs.createWriteStream(file));
	stream.on('end', async () => {
		updateVersionStep2(version);
	});
	ss(Avatar.HTTP.socket).emit('copyFile', src, stream);
}


async function copyFile (qs, callback) {

	if (qs.end && qs.end === 'before') await Avatar.Listen.end(Config.client, true);

	qs.dest = qs.dest.replace('__dirname', __dirname);
	qs.dest = qs.dest.replace('PLUGIN:', __dirname+path.sep+'plugins'+path.sep);
	qs.dest = path.normalize(qs.dest);
	
	let folder = path.dirname(qs.dest);
	fs.ensureDirSync(folder);
	if (fs.existsSync(qs.dest) && qs.backup === true) {
		let fileName = path.basename(qs.dest);
		const extName = path.extname(fileName);
		fileName = fileName.replace(extName, '')+"_old"+extName;
		const backupFile = path.resolve (folder, fileName);
  		fs.copySync(qs.dest, backupFile);
	}

	let stream = ss.createStream();
	stream.pipe(fs.createWriteStream(qs.dest));
	stream.on('end', async() => {
		if (qs.end && qs.end === 'after') await Avatar.Listen.end(Config.client, true);
		if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
	});
	ss(Avatar.HTTP.socket).emit('copyFile', qs.src, stream);
}


function runPlugin (qs, callback) {

	Avatar.call (qs.plugin, qs.param, () => {
		if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
	})

}


function runApp( qs, callback) {

	qs.run.replace('__dirname', __dirname);
	qs.run = path.normalize(qs.run);
	if (qs.param) qs.run = qs.run+' '+qs.param;

	appInfo(L.get(['mainInterface.runApp', qs.run]));

	exec(qs.run, (err, stdout, stderr) => {
		if (err) error(L.get(['mainInterface.runAppError', (stderr || err || 'Unknow')]));
		if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
	});

}


function intercom(sentence, full) {

	if (!appClient) {
		error(L.get('intercom.noRoute'));
		return;
	}

	Avatar.speak(Config.intercom.locale[Config.speech.locale].start, async () => {
		let startTime, endTime;

		const DIRECTORY = path.join (__dirname, 'intercom');
		if (!fs.existsSync(DIRECTORY)) fs.mkdirSync(DIRECTORY);

		const fileName = path.join(DIRECTORY, 'intercom.wav');
		if (fs.existsSync(fileName)) fs.removeSync(fileName);
		try  {
			const recorder = new AudioRecorder({
				program: 'sox',
				silence: Config.intercom.silence,
				driver: Config.intercom.driver,
				device: Config.intercom.device,
				thresholdStart: Config.intercom.thresholdStart,      
				thresholdStop: Config.intercom.thresholdStop,   
				keepSilence: false     
			}, Config.intercom.debug);	

			recorder.on('error', async (error) => {
				Avatar.speak(L.get('intercom.recordError'));
				error(L.get(['intercom.error', error || L.get('intercom.defaultError')]));
			});
			recorder.on('close', (exitCode) => {
				if (exitCode === 0 && fs.existsSync(fileName)) {
					endTime = new Date().getTime();
					info(L.get('intercom.done'));
					Avatar.speak(Config.intercom.locale[Config.speech.locale].send, async () => {
						Avatar.static.set(DIRECTORY, () => {
							let duration = (endTime - startTime) / 1000;
							Avatar.HTTP.socket.emit('sendIntercom', sentence, duration, full);
						});
					}, (Config.speech.server_speak === true) ? false : true)
				}
			});

			const fileStream = fs.createWriteStream(fileName, { encoding: 'binary' });
			startTime = new Date().getTime();

			recorder
			.start()
			.stream()
			.pipe(fileStream);

		} catch {
			Avatar.speak(L.get('intercom.recordError'));
			error(L.get('intercom.defaultError'));
		}

	}, false);

}


function playIntercom (from, adress) {

	info(L.get(['intercom.play', from]));
	musicPlay({
		play: 'http:'+adress+'/intercom.wav',
		end: 'after',
		type: 'url',
		sync: 'false'
	});
	
}


function play (playfile, ...args) {
	
	let end, type, callback;
	for (let n of args) {
		if (typeof n === 'function') callback = n;
		if (typeof n === 'string' && (n === 'url' || n === 'local')) type = n;
		if (typeof n === 'string' && (n === 'before' || n === 'after')) end = n;
	}
	if (end === undefined) end = true;
	if (type === undefined) type = 'local';

	const qs = {
		'play': playfile,
		'end': end,
		'type': type
	}

	musicPlay(qs, callback);

}


async function musicPlay(qs, callback) {
	let ffplay;
	switch (process.platform) {
		case 'win32':
			ffplay = path.resolve(__dirname, "../lib/ffmpeg/win32/bin/ffplay");
			break;
		case 'linux':
		case 'darwin':
			ffplay = 'ffplay'
			break;	
	}

	if (qs.end === 'before') await Avatar.Listen.end(Config.client, true);

	if (qs.type !== 'url') {
		qs.play.replace('__dirname', __dirname);
		qs.play = path.normalize(qs.play);
	}

	if (qs.type === 'url' || (qs.type !== 'url' && fs.existsSync(qs.play))) {
		player = new FFplay(qs.play, null, ffplay, async () => {
			player = null;
			if (qs.end === 'after' || qs.end === true) await Avatar.Listen.end(Config.client, true);
			if (qs.sync && qs.sync === true) 
				Avatar.HTTP.socket.emit('callback', callback);
			else if (callback)
				callback();
		});
	} else if (qs.sync && qs.sync === true) 
		Avatar.HTTP.socket.emit('callback', callback);
	else if (callback)
			callback();
}


function stop (callback) {
	if (player) {
		player.stop(() => {
			player = null;
			if (callback) callback();
		});
	} else if (callback) callback();
}


async function musicStop(qs, callback) {
	if (player) {
		player.stop(() => {
			player = null;
			if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
		});
	} else if (qs.sync) Avatar.HTTP.socket.emit('callback', callback);
}


function shutdown () {
	const ext = process.platform === 'win32' ? ".bat" : ".sh"
	const cmd = path.resolve(__dirname, "..", "lib", "shutdown", process.platform, "shutdownOS" + ext);
	exec(cmd, (err, stdout, stderr) => {
		if (err) error("Shutdown error:", stderr);
	})
}


function getProperty(file, property) {
	if (fs.existsSync(file)) {
		const properties = fs.readJsonSync(file, { throws: false });
		if (property && Object.prototype.hasOwnProperty.call(properties, property)) {
				return property[property];
		} else {
			return properties;
		}
	} else {
		return {};
	}
}

export { initClient}; 