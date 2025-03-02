import * as url from 'url';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
import * as path from 'node:path';
import _ from 'underscore';
import fs from 'fs-extra';
import { CronJob } from 'cron';

let prop = fs.readJsonSync(path.resolve(__dirname, 'Avatar.prop'), { throws: false });
if (prop === null) {
    prop = fs.readJsonSync(path.resolve(__dirname, '../assets/config/default/Avatar.prop'), { throws: true });
}

/**
 * @type {any}
 * @description A variable to hold the soundex value defined by the language
 */
var soundex;
if (prop.speech.locale.split('-')[0].toLowerCase() === 'fr') {
    soundex = await import('@jollie/soundex-fr');
    soundex = soundex.default;
} else if (prop.speech.locale.split('-')[0].toLowerCase() === 'en') {
    soundex = await import('soundex-code');
    soundex = soundex.soundex;
}

import levenshtein from 'talisman/metrics/levenshtein.js';

const  textToSpeechFile = import.meta.resolve("./"+prop.speech.speechToText+"/"+prop.speech.speechToText+".js");
const  textToSpeech = await import (textToSpeechFile);

let reconizerStopped = false, actions = [], isActionAka, AKAStopped = false, timeoutStarted;
let is_askme = {active: false, options: null}, is_silence;
let initProperties;

/**
 * Changes the voice configuration for the Avatar application.
 * 
 * This function updates the current voice configuration based on the active voices available
 * for the specified locale and type. If the server_speak configuration is enabled, it emits
 * a 'plugin_action' event to change the voice. Otherwise, it cycles through the available
 * voices and updates the configuration accordingly.
 * 
 * The updated configuration is then saved to a file and applied to the Avatar application.
 * Finally, a message indicating the voice change is spoken by the Avatar.
 * 
 * @function changeVoice
 */
function changeVoice() {

    if (Config.speech.server_speak) {
        Avatar.HTTP.socket.emit('plugin_action', Config.speech.module, {action : {command: "voiceChange"}});
    } else {
      if ((Config.voices.active[Config.speech.locale][Config.voices.type[Config.speech.locale]].indexOf(Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]]) === -1) 
        || (Config.voices.active[Config.speech.locale][Config.voices.type[Config.speech.locale]].indexOf(Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]]) === (Config.voices.active[Config.speech.locale][Config.voices.type[Config.speech.locale]].length - 1))) 
      {
        Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]] = Config.voices.active[Config.speech.locale][Config.voices.type[Config.speech.locale]][0];
      } else {
        Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]] = Config.voices.active[Config.speech.locale][Config.voices.type][Config.voices.active[Config.speech.locale][Config.voices.type[Config.speech.locale]].indexOf(Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]]) + 1];
      }
      
      //just in case of...
      if (!Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]]) Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]] = "by default";
  
      fs.writeJsonSync(path.resolve(__dirname, './Avatar.prop'), Config);
      Avatar.setConfig(Config);
    }
  
    Avatar.speak(L.get('mainInterface.voiceChanged'));

}


function remoteVoices(voices) {
    Avatar.Interface.openSettings (initProperties, voices);
}


async function getRemoteVoices(init, lang) {
    initProperties = init;
    await textToSpeech.getVoices(lang);
}


/**
 * Manages actions based on the provided buffer and aka.
 *
 * @param {string} buffer - The input buffer containing the action to be managed.
 * @param {string} aka - An alias or identifier associated with the action.
 * @returns {Promise<void>} A promise that resolves when the action management is complete.
 */
async function manageActions (buffer, aka) {

    if (timeoutStarted) {timeoutStarted.stop(); timeoutStarted = null};

    if (!buffer || buffer.length === 0) {
        infoOrange(L.get('mainInterface.bufferEmpty')); 
        return await end(Config.client, true);
    }

    if (buffer.toLowerCase() === Config.voices.change[Config.speech.locale].toLowerCase()) {
        return changeVoice();
    }

    await stopReconizerListen();
    if (!is_askme.active) {
        // simple rule
        buffer = await composeActions(buffer, aka);
        infoOrange(L.get('mainInterface.stopListen'));
        await action (buffer, aka);
    } else {
        // Askme
        info(L.get(['mainInterface.intent', buffer]));
        getTag(buffer, is_askme.options, tag => {
            Avatar.HTTP.socket.emit('answer', tag);
        });
    }
}


async function AKA() {
    await silence();
    isActionAka = false;
    Avatar.speak(Config.locale[Config.speech.locale].tts_restoreContext, () => {
        startListen();
    }, false);
}


function parseStringToObject(str) {
    const pairs = str.split('~');
    const action = {};

    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key !== '') action[key] = value;
    });
    return { action };
}


function directActionAKA(sentence, plugin, options) {
    info(L.get(['mainInterface.intent', sentence]));
    isActionAka = true;
    info(L.get('mainInterface.sendIntentRule'));
    options = parseStringToObject(options);
    Avatar.HTTP.socket.emit('plugin_action', plugin, options);
}


async function silence() {
    if (!is_silence) {
        await mute(Config.client);
        is_silence = true;
    }
}


function findSpeech(sentence, answers, tbl_answers) {

	let tts;
	_.map(answers, function(answer) {
		if (sentence.toLowerCase() === answer.toLowerCase())
			tts = tbl_answers[Math.floor(Math.random() * tbl_answers.length)];
	});

	if (!tts && soundex) {
		var sdx = soundex(sentence, sentence.length);
		var score = 0;
		_.map(answers, function(answer) {
			var sdx_gram = soundex(answer, answer.length);
			var levens  = levenshtein(sdx, sdx_gram);
			levens  = 1 - (levens / sdx_gram.length);
			if (levens > score && levens >= Config.listen.threashold) {
                infoOrange(L.get(['mainInterface.soundex', answer]));   
				score = levens;
				tts = tbl_answers[Math.floor(Math.random() * tbl_answers.length)];
			}
		});
	}

    return tts;
}


async function isIntercom (sentence) {

   for ( let i in Config.intercom.locale[Config.speech.locale].rules) {
		if (sentence.toLowerCase().indexOf(Config.intercom.locale[Config.speech.locale].rules[i].toLowerCase()) !== -1)
			return true;
	};

}

async function isGlobalIntercom (sentence) {
    for ( let i in Config.intercom.locale[Config.speech.locale].global) {
        if (sentence.toLowerCase() === Config.intercom.locale[Config.speech.locale].global[i].toLowerCase())
            return true;
    };
}

async function action (sentence, aka) {

    info(L.get(['mainInterface.intent', sentence]));
    isActionAka = aka;

    if (await isGlobalIntercom(sentence) === true ) {
        Avatar.intercom (sentence, true);
    } else if (await isIntercom(sentence) === true ) {
        Avatar.intercom (sentence);
    } else {
        let tts = findSpeech (sentence, Config.locale[Config.speech.locale].tts_cancel, Config.locale[Config.speech.locale].answers_cancel);
        if (!tts) tts = findSpeech (sentence, Config.locale[Config.speech.locale].tts_thank, Config.locale[Config.speech.locale].answers_thank);

        emitAction (tts, sentence);
    }
}


function emitAction (tts, sentence) {
    if (tts) {   
      isActionAka = true; // End of loop
      return Avatar.speak(tts, () => {
        if (!Config.speech.server_speak) end(Config.client, true);
        if (timeoutStarted) {timeoutStarted.stop(); timeoutStarted = null};
      });
    }
    info(L.get('mainInterface.sendIntentRule'));
    Avatar.HTTP.socket.emit('action', sentence);
}


async function end (...args) {

    let client, full;
    for (let n of args) {
		if (typeof n === 'string') client = n;
		if (typeof n === 'boolean') full = n;
	}

    if (!client) client = Config.client;
    if (full === undefined) full = true;

    // set isActionAka if undefined
    if (isActionAka === undefined) isActionAka = true;
    
	if (actions.length === 0 && Config.listen.loop_mode && !isActionAka && full !== 'end') {
        if (is_askme.active) {
            is_askme.active = false;
            is_askme.options = null;
        }
        Avatar.speak(Config.locale[Config.speech.locale].tts_restart_restoreContext, () => {
            startListen();
        }, false);
	} else if (actions.length > 0 && full !== 'end') {
		await action(actions[0].next, actions[0].aka);
		actions = actions.length > 1 ? _.rest(actions) : [];
	} else {
        if (full === 'end') full = true;
        await resetListen(client, full);
	}
}


async function resetListen (client, full) {
	if (full) {
        await startReconizerListen(true);
        await startAKA();
        infoGreen(L.get('mainInterface.readyToListen'));
        is_askme.active = is_silence = false, is_askme.options = null;
	}
    if (!Config.speech.server_speak)
	    await unmute(client);
    else
        await unmuteClosure(client);
}


async function mute (client) {
	Avatar.HTTP.socket.emit('mute', client);
}


async function unmute (client) {
	Avatar.HTTP.socket.emit('unmute', client);
}

async function unmuteClosure (client) {
	Avatar.HTTP.socket.emit('unmuteClosure', client);
}


function timeoutSpeech() {
    let d = new Date();
    let s = d.getSeconds()+Config.listen.timeout;
    d.setSeconds(s);
    if (timeoutStarted) timeoutStarted.stop();
    timeoutStarted = new CronJob(d, async () => {
        if (timeoutStarted) {timeoutStarted.stop(); timeoutStarted = null};
        isActionAka = true; // End of loop
        infoOrange(L.get('mainInterface.timeoutSpeech'));
        await end(Config.client, true);
    }, null, true);
}


async function stopReconizerListen (forced) {
    if (reconizerStopped === true && !forced) return;
    await textToSpeech.stopListen(forced);
    reconizerStopped = true;
}


async function startReconizerListen (forced) {
    if (reconizerStopped === false && !forced) return;
    await textToSpeech.startListen(forced);
    reconizerStopped = false;
}


async function startListen (forced) {
    await stopAKA();
    await startReconizerListen(forced);
    if (!is_askme.active) timeoutSpeech();
}

async function startListenAction () {
    await silence();
    isActionAka = false;
    Avatar.speak(Config.locale[Config.speech.locale].tts_restoreContext, () => {
        startListen();
    }, false);
}

async function stoptListenAction (...args) {

    let client, full;
	for (let n of args) {
		if (typeof n === 'string') client = n;
		if (typeof n === 'boolean' || (typeof n === 'string' && n === 'end')) full = n;
	}

    if (client === undefined) client = Config.client;

    if (timeoutStarted) {
        timeoutStarted.stop();
        timeoutStarted = null;
    }
    end(client, full);
}

async function startAKA () {
    if (!isAKAStopped()) return;
    await textToSpeech.startAKA();
    AKAStopped = false;
}


async function stopAKA () {
    if (isAKAStopped()) return;
    await textToSpeech.stopAKA();
    AKAStopped = true;
}


function isRecognizerStopped () {
    return reconizerStopped;
}


function isAKAStopped () {
    return AKAStopped;
}


async function composeActions (buffer, aka) {

    let separators = [];
    _.each(Config.action_separators[Config.speech.locale], async (num) => {
        separators = await countOccurences(buffer, num, separators);
    });

    if (separators.length === 0)  return buffer;

    separators = _.sortBy(separators, 'pos');
    actions = [];
    let pos=0, first, action;

    for(let i=0; i<separators.length; i++) {
        action = buffer.substring(pos, separators[i].pos);
        if (i > 0)
            actions.push({next: action, aka: aka});
        else
            first = action;

        pos = separators[i].pos + separators[i].separator.length;
        if (i+1 == separators.length)
            actions.push({next: buffer.substring(pos), aka: aka});
    };

    return first;
}


async function countOccurences (buffer, separator, separators) {
    let pos = buffer.toLowerCase().indexOf(" "+separator+" ");
    while ( pos !== -1 ) {
        separators.push({separator: " "+separator+" ", pos: pos});
        pos = buffer.toLowerCase().indexOf(" "+separator+" ",pos+1);
    }
    return separators;
}


function isGrammar(sentence, rules) {

    return new Promise((resolve) => {
        for (var i=0; i < rules.grammar.length; i++){
            if (sentence !== '*' && sentence.toLowerCase() === rules.grammar[i].toLowerCase()) {
                return resolve (rules.tags[i]);
            }
        }

        var match;
        // Only for French & English
        if (sentence !== '*' && soundex) {
            var sdx = soundex(sentence, sentence.length);
            var score = 0;
            for (var i=0; i < rules.grammar.length; i++){
                if (rules.grammar[i] !== '*') {
                    var sdx_gram = soundex(rules.grammar[i], rules.grammar[i].length);
                    var levens  = levenshtein(sdx, sdx_gram);
                    levens  = 1 - (levens / sdx_gram.length);
                    if (levens > score && levens >= Config.listen.threashold) {
                        infoOrange(L.get(['mainInterface.soundex', rules.grammar[i]]));
                        score = levens;
                        match = rules.tags[i];
                    }
                }
            }
        }

        // Generics taken into account
        if (!match) {
            for (var i=0; i < rules.grammar.length; i++){
                if (rules.grammar[i] === '*') {
                    match = rules.tags[i] + ':' + sentence.toLowerCase();
                    break;
                }
            }
        }

	    resolve (match ? match : null);
    })
}


async function getTag(sentence, rules, callback) {
    var tag = await isGrammar(sentence, rules);
    if (tag) return callback(tag);
    restartAskme(rules);
}


function restartAskme() {
    Avatar.speak(Config.locale[Config.speech.locale].restart, () => {
  		if (is_askme.active) socket.emit('reset_token');
        startListen();
  	}, false);
}


function askmeDone () {
  is_askme.active =  false;
  is_askme.options = null;
  end(Config.client, true);
}


async function askme(options) {

    is_askme.active = true;
    is_askme.options = options;

    infoGreen(L.get('mainInterface.ReadyToListenAskMe'));
  
    await silence();
    if (options.tts) {
        Avatar.speak(options.tts, () => {
            startListen();
        }, false, options.voice, options.volume, options.speed, options.pitch);
    } else {
        startListen();
    }
    
}

var remoteSpeakCallback
async function remoteSpeak(options) {
    if (options.callback) remoteSpeakCallback = options.callback
    await textToSpeech.remoteSpeak(options);
}


async function remoteSpeakEnd(end) {
    if (end === 'true') {
        infoGreen(L.get('mainInterface.startListenSpeak'));
        await Avatar.Listen.start();
    }
    if (remoteSpeakCallback) remoteSpeakCallback();
    remoteSpeakCallback = null;
}


async function initListen () {
    Avatar.Listen = {
        stop: stopReconizerListen,
        isStopped: isRecognizerStopped,
        start: startReconizerListen,
        manageActions: manageActions,
        AKA: AKA,
        directActionAKA: directActionAKA,
        end: end,
        stoptListenAction: stoptListenAction,
        startListen: startListen,
        startListenAction: startListenAction,
        askme : askme,
        askmeDone: askmeDone,
        remoteVoices: remoteVoices,
        getRemoteVoices: getRemoteVoices,
        remoteSpeak: remoteSpeak,
        remoteSpeakEnd: remoteSpeakEnd
    }
    return await textToSpeech.init();
}


export { initListen }; 