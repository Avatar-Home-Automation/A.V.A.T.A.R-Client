let interfaceProperties, appProperties, initialisation = false, BCP47, BCP47app, voices, AKAs, currentKeyWord;

window.onbeforeunload = async (e) => {
    e.returnValue = false;
    window.electronAPI.quitSettings(initialisation);
}


document.getElementById("exit").addEventListener("click", async (event) => {
    window.dispatchEvent(new Event ('beforeunload'))
})


function showTab(settingType) {
    document.getElementById("connexion-tab").style.display = "none";
    document.getElementById("dialog-tab").style.display = "none";
    document.getElementById("voice-tab").style.display = "none";
    document.getElementById("rules-tab").style.display = "none";
    document.getElementById("nodes-tab").style.display = "none";
    document.getElementById("background-tab").style.display = "none";
    document.getElementById("intercom-tab").style.display = "none";
    document.getElementById("theme-tab").style.display = "none";

    window.requestAnimationFrame(() => {
        document.getElementById(settingType).style.display = "block";
        if (settingType === "theme-tab" ) {
            document.getElementById("test-properties").style.display = "";
        } else {
            document.getElementById("test-properties").style.display = "none";
        }
    })
}

document.getElementById("connexion").addEventListener("click", (event) => {
  showTab("connexion-tab");
})
document.getElementById("dialog").addEventListener("click", (event) => {
  showTab("dialog-tab");
})
document.getElementById("voice").addEventListener("click", (event) => {
  showTab("voice-tab");
})
document.getElementById("rules").addEventListener("click", (event) => {
  showTab("rules-tab");
})
document.getElementById("nodes").addEventListener("click", (event) => {
    showTab("nodes-tab");
})
document.getElementById("intercom").addEventListener("click", (event) => {
    showTab("intercom-tab");
})
document.getElementById("background").addEventListener("click", (event) => {
  showTab("background-tab");
})
document.getElementById("theme").addEventListener("click", (event) => {
    showTab("theme-tab")
})


document.getElementById("test-properties").addEventListener("click", async (event) => {

    let theme, color, icons;
  
    let item = document.getElementsByClassName("theme-interface");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
          theme = item[i].value;
          break;
        }
    }
  
    item = document.getElementsByClassName("theme-color");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
          color = item[i].value;
          break;
        }
    }
  
    item = document.getElementsByClassName("theme-icons");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
          icons = item[i].value;
          break;
        }
    }
  
    setSettingsXel({
      screen:{
        xeltheme: theme,
        xelcolor: color,
        xelicons: icons
      }
    })
  
})



function getCurrentBCP47 () {
    let BCP47 = document.getElementById('BCP47');
    for (let i in BCP47.childNodes) {
        if (BCP47.childNodes[i].toggled) {
            return BCP47.childNodes[i].value;
        }
    }
}

document.getElementById("voice-type").addEventListener("click", (event) => {

    setTimeout(async () => { 
        let type;
        if (document.getElementById("web-voice").toggled) {
            type = "web-voice";
            document.getElementById('voice-pitch-div').style.display = "inline-flex";
        } else {
            type = "local-voice";
            document.getElementById('voice-pitch-div').style.display = "none";
        }

        let currentlanguage = getCurrentBCP47();

        if (appProperties.voices.current[currentlanguage] && appProperties.voices.current[currentlanguage][type])
            document.getElementById('current-voice').innerHTML = appProperties.voices.current[currentlanguage][type] === 'by default' ? await Lget("settings", "auto") : appProperties.voices.current[currentlanguage][type];
        else
            document.getElementById('current-voice').innerHTML = ""

        let Xtags = document.getElementById("active-voices");
        while (Xtags.firstChild) {
            Xtags.removeChild(Xtags.lastChild);
        }

        if (appProperties.voices.active[currentlanguage] && appProperties.voices.active[currentlanguage][type])
            setXtagList(appProperties.voices.active[currentlanguage][type], "active-voices");

        let availablevoices = document.getElementById('avalaible-voices');
        for (let e = availablevoices.children.length - 1; e > 1; e--) {
            availablevoices.removeChild(availablevoices.children[e])
        }

        voices[type].forEach(voice => {
            let itemOn = document.createElement("x-menuitem");
            itemOn.setAttribute('id', voice.name);
            itemOn.value = voice.name;
            let labelOn = document.createElement("x-label");
            labelOn.innerHTML = voice.name;
            itemOn.appendChild(labelOn);
            availablevoices.appendChild(itemOn);
        });
        document.getElementById('by-default-voice').toggled = true;
        
        document.getElementById('voice-test').disabled = document.getElementById('voice-add-current').disabled = document.getElementById('voice-add').disabled
        = (availablevoices.children.length === 2) ? "true" : ""

        document.getElementById('speed-voice').value = (appProperties.voices.speed[currentlanguage] && appProperties.voices.speed[currentlanguage][type])
        ? appProperties.voices.speed[currentlanguage][type]
        : document.getElementById('speed-voice').value = 50;

        document.getElementById('volume-voice').value = (appProperties.voices.volume[currentlanguage] && appProperties.voices.volume[currentlanguage][type])
        ? appProperties.voices.volume[currentlanguage][type]
        : document.getElementById('volume-voice').value = 100
    }, 300)
})


document.getElementById("save-properties").addEventListener("click", async (event) => {
    
    if (!await checkProperties()) return;
    
    await updateProperties();
    try {
        await window.electronAPI.applyProperties({app: appProperties, interface: interfaceProperties, init: initialisation});
        notification(await Lget("settings", "saved"));
    } catch(err) {
        notification('Error: '+err, true);
    }
})


document.getElementById("client").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("client").empty === true) {
        document.getElementById("client").setCustomValidity(await Lget("settings", "noName"));
    }
    else {
        document.getElementById("client").setCustomValidity("");
    }
});


document.getElementById("http").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("http").empty === true) {
        document.getElementById("http").setCustomValidity(await Lget("settings", "nohttp"));
    }
    else {
        document.getElementById("http").setCustomValidity("");
    }
});


document.getElementById("udp").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("udp").empty === true) {
        document.getElementById("udp").setCustomValidity(await Lget("settings", "noudp"));
    }
    else {
        document.getElementById("udp").setCustomValidity("");
    }
});


document.getElementById("recognizer-type").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("recognizer-type").empty === true) {
        document.getElementById("recognizer-type").setCustomValidity(await Lget("settings", "recognizerTypeError"));
    }
    else {
        document.getElementById("recognizer-type").setCustomValidity("");
    }
});


document.getElementById("adress-server").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("adress-server").empty === true) {
        let ip = document.getElementById('ex-adress-server-label').innerHTML;
        document.getElementById("adress-server").setCustomValidity(await Lget("settings", "noIP", `${ip}.90-110`, `${ip}.100`));
    }
    else {
        document.getElementById("adress-server").setCustomValidity("");
    }
});


document.getElementById("voice-add-current").addEventListener("click", async (event) => {
    let voice = await voiceAdd();
    document.getElementById("current-voice").innerHTML = voice;
})


document.getElementById("voice-add").addEventListener("click", (event) => {
    voiceAdd();
})


async function voiceAdd() {
    let voices = document.getElementById("avalaible-voices");
    for (var a = 0; a < voices.childNodes.length; a++) {
        if (voices.childNodes[a].toggled) break;
    }
    let found = false;
    let voiceList = document.getElementById('active-voices')
    for (let e = 0; e < voiceList.children.length; e++) {
      if (voiceList.children[e].value && voiceList.children[e].value.toLowerCase() === voices.childNodes[a].value.toLowerCase()) {
        found = true;
        break;
      }
    }
    if (!found) {
        let tag = document.createElement("x-tag");
        tag.value = voices.childNodes[a].value;
        tag.innerHTML = `<x-label>${voices.childNodes[a].innerHTML}</x-label>`;
        voiceList.appendChild(tag);
    }
    return voices.childNodes[a].children[0].innerHTML;
}




document.getElementById("voice-test").addEventListener("click", async (event) => {
    if (initialisation === true) {
        return notification(await Lget("settings", "voiceTestError"));
    }
    
    if (document.getElementById("test-sentence").value !== '') {
        try {
            const type = document.getElementById('voice-type');
            for (var i in type.childNodes) {
                if (type.childNodes[i].toggled) break;
            }

            const voices = document.getElementById("avalaible-voices");
            for (var a = 0; a < voices.childNodes.length; a++) {
                if (voices.childNodes[a].toggled) break;
            }
            await window.electronAPI.testVoice({init: initialisation, sentence: document.getElementById("test-sentence").value, voice: voices.childNodes[a].value, speed: document.getElementById("speed-voice").value, volume: document.getElementById("volume-voice").value, pitch: document.getElementById("pitch-voice").value, type: type.childNodes[i].value});
        } catch(err) {
            console.log('err', err.stack ? err.stack : err);
        }
    }
});


document.getElementById("select-background").addEventListener("click", async (event) => {
    let file = await window.electronAPI.openFile();
    if (file) {
        if (document.getElementById('img-house').style.display === "none")
          document.getElementById('img-house').style.display = "";
        document.getElementById('img-house').src = file;
      }
})


document.getElementById("select-screen-saver").addEventListener("click", async (event) => {
    let file = await window.electronAPI.openScreenSaverFile();
    if (file) document.getElementById('screen-saver').value = file
})


document.getElementById("select-powershell").addEventListener("click", async (event) => {
    let file = await window.electronAPI.openPowershellFile()
    if (file) document.getElementById('powershell').value = file
})


function notification (msg, err) {
    let notif = document.getElementById('notification');
    notif.style.color = (err) ? 'red' : 'rgba(255, 255, 255, 0.9)';
    if (notif.opened == true) notif.opened = false;
    notif.innerHTML = msg;
    notif.opened = true;
}


async function Lget (top, target, param, param1) {
    if (param) {
        if (param1) {
            return await window.electronAPI.getMsg([top+"."+target, param, param1]);
        } else
             return await window.electronAPI.getMsg([top+"."+target, param]);
    } else {
        return await window.electronAPI.getMsg(top+"."+target);
    }
}


document.getElementById("AKA-list").addEventListener("add", (event) => {
    let addedTag = event.detail;
    addedTag.onclick = () => {
        currentKeyWord = addedTag.querySelector("x-label").innerHTML;
        refreshDirectAKA("select-direct-AKA", null, true);
    };
    currentKeyWord = addedTag.querySelector("x-label").innerHTML;
    refreshDirectAKA("select-direct-AKA", null, true);
});


document.getElementById("delete-AKA-plugin").addEventListener("click", async (event) => {

    if (currentKeyWord) {
        let directAKASelection = getDirectAKASelection();
        let currentlanguage = getCurrentBCP47();

        if (AKAs[currentlanguage] && AKAs[currentlanguage][currentKeyWord]) {
            if (directAKASelection === "action-AKA") {
                if (document.getElementById("AKA-plugin").value !== "") {
                    delete AKAs[currentlanguage][currentKeyWord];
                    refreshDirectAKA("select-direct-AKA");
                    notification(await Lget("settings", "deleteAKA", currentKeyWord));
                } else {
                    notification(await Lget("settings", "noAssocPlugin", currentKeyWord), true);
                }
            } else if (directAKASelection === "nlp-AKA") {
                if (AKAs[currentlanguage][currentKeyWord].sentence) {
                    delete AKAs[currentlanguage][currentKeyWord];
                    refreshDirectAKA("select-direct-AKA");
                    notification(await Lget("settings", "deleteAKA", currentKeyWord));
                } else {
                    notification(await Lget("settings", "noKeyWordRule", currentKeyWord), true);
                }
            } else {
                notification(await Lget("settings", "noKeyWordAction", currentKeyWord), true);
            }
        } else {
            notification(await Lget("settings", "noKeyWordAction", currentKeyWord), true);
        }
    } else {
        notification(await Lget("settings", "keywordFirstClic"), true);
    }
});


document.getElementById("save-AKA-plugin").addEventListener("click", async (event) => {

    if (currentKeyWord) {
        let directAKASelection = getDirectAKASelection();
        if (directAKASelection === "select-direct-AKA") {
            return notification(await Lget("settings", "BeforeSave", currentKeyWord), true);
        }

        if ((directAKASelection === 'action-AKA' && document.getElementById("AKA-plugin").value !== "") ||
        directAKASelection === 'nlp-AKA') {
            var found = false;
            let currentlanguage = getCurrentBCP47();

            if (AKAs[currentlanguage]) {
                Object.entries(AKAs[currentlanguage]).forEach(([key, value]) => {
                    if (key === currentKeyWord) {
                        if (directAKASelection === "action-AKA") {
                            value.plugin = document.getElementById("AKA-plugin").value;
                            value.action = document.getElementById("AKA-options").value;
                            value.Of = document.getElementById('AKA-action-indexOf').toggled;
                        } else if (directAKASelection === "nlp-AKA") {
                            value.sentence = true;
                            value.Of = document.getElementById('AKA-sentence-indexOf').toggled;
                        } 
                        found = true;   
                    }
                });
            } else {
                AKAs[currentlanguage] = {};
            }

            if (!found) {
                if (directAKASelection === "action-AKA") {
                    AKAs[currentlanguage][currentKeyWord] = {
                        "plugin": document.getElementById("AKA-plugin").value,
                        "action": document.getElementById("AKA-options").value,
                        "Of": document.getElementById("AKA-action-indexOf").toggled
                    }
                } else {
                    AKAs[currentlanguage][currentKeyWord] = {
                        "sentence": true,
                        "Of": document.getElementById("AKA-sentence-indexOf").toggled
                    }
                }
            } 

            if (directAKASelection === "action-AKA") {
                document.getElementById("AKA-action-txt-label").innerHTML = await Lget("settings", "alreadyAssoc", currentKeyWord);
                notification(await Lget("settings", "keywordAssoc", currentKeyWord, document.getElementById("AKA-plugin").value));
            } else {
                document.getElementById("AKA-sentence-txt-label").innerHTML = await Lget("settings", "alreadyKeywordRule", currentKeyWord);
                notification(await Lget("settings", "KeywordRule", currentKeyWord));
            }
        } else {
            if (directAKASelection === 'action-AKA') {
                notification(await Lget("settings", "pluginOptionAssoc", currentKeyWord), true);
            } else {
                notification(await Lget("settings", "selectDirectActionFirst", currentKeyWord), true);
            }
        }
    } else {
        refreshDirectAKA("select-direct-AKA");
        notification(await Lget("settings", "selectKeywordFirst"), true);
    }
});


function getDirectAKASelection() {
    let directAKAMenu = document.getElementById('directAKAMenu');
    for (let i in directAKAMenu.childNodes) {
        if (directAKAMenu.childNodes[i].toggled) {
            return directAKAMenu.childNodes[i].value;
        }
    }
}


async function keywordByAction (inner, openedByClick) {

    let directAKASelection = getDirectAKASelection();
    
    var found = false;
    let currentlanguage = getCurrentBCP47();
    if (AKAs[currentlanguage]) {
        Object.entries(AKAs[currentlanguage]).forEach(([key, value]) => {
            if (key === inner) {
                if (value.plugin) {
                    document.getElementById("select-direct-AKA").toggled = false;
                    document.getElementById("nlp-AKA").toggled = false;
                    document.getElementById("action-AKA").toggled = true;
                    document.getElementById("AKA-plugin").value = value.plugin;
                    document.getElementById("AKA-options").value = value.action;
                    document.getElementById("AKA-action-indexOf").toggled = value.Of;
                    directAKASelection = "action-AKA"
                } else if (value.sentence) {
                    document.getElementById("select-direct-AKA").toggled = false;
                    document.getElementById("action-AKA").toggled = false;
                    document.getElementById("nlp-AKA").toggled = true;
                    document.getElementById("AKA-sentence-indexOf").toggled = value.Of;
                    directAKASelection = "nlp-AKA"
                    found = true;
                }
                found = true;
            } 
        });
    }

    if (found) {
        if (directAKASelection === "action-AKA") {
            document.getElementById("AKA-action-txt-label").innerHTML = await Lget("settings", "alreadyAssoc", currentKeyWord);
            resetDirectAkaBySentence(true);
            document.getElementById("AKA-action-txt-div").style.display = "";
        } else {
            document.getElementById("AKA-sentence-txt-label").innerHTML = await Lget("settings", "alreadyKeywordRule", currentKeyWord);
            resetDirectAkaByAction(true);
            resetDirectAkaBySentence();
        }
    } else {
        if (openedByClick) {
            if (currentKeyWord) {
                if (directAKASelection === "action-AKA") {
                    document.getElementById("AKA-action-txt-label").innerHTML = await Lget("settings", "addKeywordPlugin", currentKeyWord);
                    resetDirectAkaByAction();
                } else if (directAKASelection === "nlp-AKA") {
                    document.getElementById("AKA-sentence-txt-label").innerHTML = await Lget("settings", "addSentence", currentKeyWord);
                    resetDirectAkaBySentence();
                } else {
                    notification(await Lget("settings", "selectDirectActionFirst", currentKeyWord), true);
                    resetDirectAkaByAction(true);
                    resetDirectAkaBySentence(true);
                }
            } else {
                refreshDirectAKA("select-direct-AKA");
                notification(await Lget("settings", "selectKeywordFirstKeyword"), true);
            }
        } else {
            if (directAKASelection === "action-AKA") {
                resetDirectAkaByAction(true);
            } else {
                resetDirectAkaBySentence(true);
            }
        }
    }
}


function resetDirectAkaByAction (hide) {
    document.getElementById("AKA-plugin").value = "";
    document.getElementById("AKA-options").value = "";
    document.getElementById("AKA-action-txt-div").style.display = hide ? "none" : "";
}


function resetDirectAkaBySentence (hide) {
    document.getElementById("AKA-sentence-txt-div").style.display = hide ? "none" : "";
}


function setXtagList(list, ele, sentence) {
    let XTagsinput = document.getElementById(ele);
    list.forEach(async (elem) => {
        let inner = (elem === 'by default') ? await Lget("settings", "auto") : elem;
        let tag = document.createElement("x-tag");
        tag.value = elem;
        tag.innerHTML = `<x-label>${inner}</x-label>`;
        if (sentence) tag.onclick = () => {
            currentKeyWord = tag.value;
            refreshDirectAKA("select-direct-AKA", null, true);
        };
        XTagsinput.appendChild(tag);
    });
}


function getXtagList(ele) {
    let list = [];
    let XTagsinput = document.getElementById(ele).value;
    XTagsinput.forEach(elem => {
        list.push(elem)
    })
    return list;
}



function setRuleGroup(tag) {
   
    // Rules
    let Xtags = document.getElementById("thx-rule");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].tts_thank, "thx-rule");

    Xtags = document.getElementById("stop-rule");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].tts_cancel, "stop-rule");

    Xtags = document.getElementById("listen-answer");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].tts_restoreContext, "listen-answer");
    
    Xtags = document.getElementById("listen-again-answer");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].tts_restart_restoreContext, "listen-again-answer");
    
    Xtags = document.getElementById("askme-again-answer");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].restart, "askme-again-answer");
    
    Xtags = document.getElementById("thx-answer");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].answers_thank, "thx-answer");
    
    Xtags = document.getElementById("stop-answer");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.locale[tag]) setXtagList(appProperties.locale[tag].answers_cancel, "stop-answer");

    Xtags = document.getElementById("AKA-list");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.AKA[tag]) setXtagList(appProperties.AKA[tag], "AKA-list", true);

    Xtags = document.getElementById("AKA-separator-list");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.action_separators[tag]) setXtagList(appProperties.action_separators[tag], "AKA-separator-list");
    
    Xtags = document.getElementById("AKA-restart-list");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.refresh_AKA[tag]) setXtagList(appProperties.refresh_AKA[tag], "AKA-restart-list");

    // Intercom
    Xtags = document.getElementById("activate-intercom");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.intercom.locale[tag]) setXtagList(appProperties.intercom.locale[tag].rules, "activate-intercom");

    Xtags = document.getElementById("activate-global-intercom");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.intercom.locale[tag]) setXtagList(appProperties.intercom.locale[tag].global, "activate-global-intercom");

    Xtags = document.getElementById("answer-intercom");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.intercom.locale[tag]) setXtagList(appProperties.intercom.locale[tag].start, "answer-intercom");

    Xtags = document.getElementById("send-intercom");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.intercom.locale[tag]) setXtagList(appProperties.intercom.locale[tag].send, "send-intercom");
}


async function checkProperties() {

    if (document.getElementById('client').value === '')
        return notification(await Lget("settings", "clientError"), true);

    if (document.getElementById('adress-server').value === '')
        return notification(await Lget("settings", "adressError"), true);

    if (document.getElementById('http').value === '')
        return notification(await Lget("settings", "httpError"), true);

    if (document.getElementById('udp').value === '')
        return notification(await Lget("settings", "udpError"), true); 

    if (document.getElementById('client-http').value !== '' && document.getElementById('client-http-route').value === '')
        return notification(await Lget("settings", "httpClientRouteError"), true);   

    if (document.getElementById('client-http').value === '' && document.getElementById('client-http-route').value !== '' )
        return notification(await Lget("settings", "httpClientError"), true);   

    if (document.getElementById('client-http-route').value !== '' && document.getElementById('client-http-route').value.indexOf(' ') !== -1) 
        return notification(await Lget("settings", "httpClientRouteSpaceError"), true);   

    if (document.getElementById('AKA-list').children.length === 0)
        return notification(await Lget("settings", "AKAError"), true); 
    
    if (document.getElementById('askme-again-answer').children.length === 0)
        return notification(await Lget("settings", "askmeError"), true);  

    if (document.getElementById('listen-answer').children.length === 0)
        return notification(await Lget("settings", "listenAnswerError"), true);
    
    if (document.getElementById('loop-mode').toggled) {
        if (document.getElementById('thx-rule').children.length === 0)
            return notification(await Lget("settings", "thxRuleError"), true);
        if (document.getElementById('listen-again-answer').children.length === 0)
            return notification(await Lget("settings", "listenAgainAnswerError"), true);
        if (document.getElementById('thx-answer').children.length === 0)
            return notification(await Lget("settings", "thxAnswerError"), true);      
    }

    if (document.getElementById('recognizer-type').value === '')
        return notification(await Lget("settings", "recognizerTypeError"), true);   

    // voices
    if (document.getElementById('current-voice').innerHTML === "") 
        return notification(await Lget("settings", "currentVoiceError"), true);   

    // Intercom
    if (document.getElementById('activate-intercom').children.length !== 0) {

        if (document.getElementById('activate-global-intercom').children.length === 0)
            return notification(await Lget("settings", "globalError"), true);

        if (document.getElementById('answer-intercom').children.length === 0)
            return notification(await Lget("settings", "answerError"), true);  
        
        if (document.getElementById('send-intercom').children.length === 0)
            return notification(await Lget("settings", "sendError"), true);  
    }

    // Dialog
    if (document.getElementById('server-speak').toggled && !document.getElementById('server-speak-module').value)
        return notification(await Lget("settings", "speechModuleError"), true);  

    return true;
}


async function updateProperties() {
   // Parameters tab
    appProperties.verbose =  document.getElementById('info-start').toggled;
    let appLang = document.getElementById('BCP47app');
    for (let i in appLang.childNodes) {
        if (appLang.childNodes[i].toggled) {
            appProperties.language = appLang.childNodes[i].value;
            break;
        }
    }

    appProperties.http.server.port = document.getElementById('http').value;
    appProperties.UDP.port = document.getElementById('udp').value;
    appProperties.UDP.target = document.getElementById('adress-server').value;
    appProperties.UDP.restart = document.getElementById('restart-udp').value;
    appProperties.http.client.port = document.getElementById('client-http').value;
    appProperties.http.client.route = document.getElementById('client-http-route').value.toLowerCase();
    appProperties.client = document.getElementById('client').value;
    appProperties.restart = parseInt(document.getElementById('auto-restart').value);
    appProperties.screenSaver.exec = document.getElementById('screen-saver').value.replaceAll('\\', '/');
    appProperties.screenSaver.timeout = parseInt(document.getElementById('screen-saver-timer').value) * 1000;
    appProperties.screenSaver.active = document.getElementById('screen-saver-label-onoff').toggled;
    appProperties.checkUpdate = document.getElementById('update-start').toggled;
    appProperties.powerShell = document.getElementById('powershell').value.replaceAll('\\', '/');

    // Dialog tab
    appProperties.speech.speechToText = document.getElementById('recognizer-type').value;

    let currentlanguage = getCurrentBCP47();
    appProperties.speech.locale = currentlanguage;
     
    if (!appProperties.AKA[currentlanguage]) appProperties.AKA[currentlanguage] = {};
    appProperties.AKA[currentlanguage] = getXtagList("AKA-list");

    if (AKAs[currentlanguage] && Object.keys(AKAs[currentlanguage]).length > 0) {
        if (!appProperties["direct-AKA"]) appProperties["direct-AKA"] = {};
        if (!appProperties["direct-AKA"][currentlanguage]) appProperties["direct-AKA"][currentlanguage] = {};
        appProperties["direct-AKA"][currentlanguage] = AKAs[currentlanguage];
    } else {
        if (appProperties["direct-AKA"] && appProperties["direct-AKA"][currentlanguage]) {
            delete appProperties["direct-AKA"][currentlanguage];
            if (Object.keys(appProperties["direct-AKA"]).length === 0) {
                delete appProperties["direct-AKA"];
            }
        }
    }

    if (!appProperties.action_separators[currentlanguage]) appProperties.action_separators[currentlanguage] = {};
    appProperties.action_separators[currentlanguage] = getXtagList("AKA-separator-list");
    if (!appProperties.refresh_AKA[currentlanguage]) appProperties.refresh_AKA[currentlanguage] = {};
    appProperties.refresh_AKA[currentlanguage] = getXtagList("AKA-restart-list");
    appProperties.speech.server_speak = document.getElementById('server-speak').toggled;
    appProperties.speech.module = document.getElementById('server-speak-module').value;

    appProperties.listen.loop_mode = document.getElementById('loop-mode').toggled;
    appProperties.listen.timeout = document.getElementById('timout-listen').value;
    appProperties.speech.timeout = document.getElementById('timout-speak').value;
    
    // Voice
    const voiceType = document.getElementById('voice-type');
    for (let i in voiceType.childNodes) {
        if (voiceType.childNodes[i].toggled) {
            appProperties.voices.type[currentlanguage] = voiceType.childNodes[i].value;
            break;
        }
    }

    if (!appProperties.voices.current[currentlanguage]) appProperties.voices.current[currentlanguage] = {};
    appProperties.voices.current[currentlanguage][appProperties.voices.type[currentlanguage]] = document.getElementById('current-voice').innerHTML === await Lget("settings", "auto") ? 'by default' : document.getElementById('current-voice').innerHTML;
    if (!appProperties.voices.active[currentlanguage]) appProperties.voices.active[currentlanguage] = {};
    appProperties.voices.active[currentlanguage][appProperties.voices.type[currentlanguage]] = getXtagList("active-voices");
    if (!appProperties.voices.volume[currentlanguage]) appProperties.voices.volume[currentlanguage] = {};
    appProperties.voices.volume[currentlanguage][appProperties.voices.type[currentlanguage]] = document.getElementById('volume-voice').value;
    if (!appProperties.voices.speed[currentlanguage]) appProperties.voices.speed[currentlanguage] = {};
    appProperties.voices.speed[currentlanguage][appProperties.voices.type[currentlanguage]] = document.getElementById('speed-voice').value;
    appProperties.voices.pitch = document.getElementById('pitch-voice').value;
    appProperties.voices.change[currentlanguage] = document.getElementById('change-voice').value;
    appProperties.voices.test[currentlanguage] = document.getElementById('test-sentence').value;

    //rules
    if (!appProperties.locale[currentlanguage]) appProperties.locale[currentlanguage] = {};
    appProperties.locale[currentlanguage].tts_thank = getXtagList("thx-rule");
    appProperties.locale[currentlanguage].tts_cancel = getXtagList("stop-rule");
    appProperties.locale[currentlanguage].tts_restoreContext = getXtagList("listen-answer");
    appProperties.locale[currentlanguage].tts_restart_restoreContext = getXtagList("listen-again-answer");
    appProperties.locale[currentlanguage].restart = getXtagList("askme-again-answer");
    appProperties.locale[currentlanguage].answers_thank = getXtagList("thx-answer");
    appProperties.locale[currentlanguage].answers_cancel = getXtagList("stop-answer");

    //Intercom
    if (!appProperties.intercom.locale[currentlanguage]) appProperties.intercom.locale[currentlanguage] = {};
    appProperties.intercom.locale[currentlanguage].rules = getXtagList("activate-intercom");
    appProperties.intercom.locale[currentlanguage].global = getXtagList("activate-global-intercom");
    appProperties.intercom.locale[currentlanguage].start = getXtagList("answer-intercom");
    appProperties.intercom.locale[currentlanguage].send = getXtagList("send-intercom");
    appProperties.intercom.silence = document.getElementById('silence-intercom').value;
    appProperties.intercom.thresholdStart = document.getElementById('thresholdStart-intercom').value;
    appProperties.intercom.thresholdStop = document.getElementById('thresholdStop-intercom').value;
    appProperties.intercom.driver =  document.getElementById('driver-intercom').value;
    appProperties.intercom.device = document.getElementById('device-intercom').value || 'waveaudio';
    appProperties.intercom.debug = document.getElementById('info-intercom').toggled;

    // Interface
    interfaceProperties.nodes.shape_display = document.getElementById('shape-start').toggled;
    item = document.getElementsByClassName("item-shape");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
          interfaceProperties.nodes.type = item[i].value;
          break;
        }
    }
    interfaceProperties.nodes.shape_width = document.getElementById('width-shape').value;
    interfaceProperties.nodes.shape_height = document.getElementById('height-shape').value;
    interfaceProperties.nodes.shape_thickness = document.getElementById('thickness-shape').value;
    interfaceProperties.nodes.shape_opacity = document.getElementById('opacity-shape').value;
    interfaceProperties.nodes.shape_color = document.getElementById('color-shape').value;
    interfaceProperties.nodes.fontsize = document.getElementById('size-text').value;
    interfaceProperties.nodes.fontcolor = document.getElementById('color-text').value;
    interfaceProperties.nodes.fontoutline =  document.getElementById('size-outlinetext').value;
    interfaceProperties.nodes.fontbordercolor = document.getElementById('color-outlinetext').value;

    interfaceProperties.console.color = document.getElementById('console-color').value;
    interfaceProperties.console.background_color = document.getElementById('console-background-color').value;
    interfaceProperties.console.opacity = document.getElementById('console-opacity').value;
    interfaceProperties.console.textBold = document.getElementById('console-txt-bold').toggled;
    interfaceProperties.console.textColor = document.getElementById('console-txt-color').value;
    interfaceProperties.console.border = document.getElementById('console-border').toggled;
    interfaceProperties.console.header = document.getElementById('console-header').toggled;
    interfaceProperties.console.txtOpacity = document.getElementById('console-txt-opacity').toggled;

    interfaceProperties.visualizer.max_loud = document.getElementById('visualiser-loud').value;
    interfaceProperties.visualizer.txt_loud = document.getElementById('visualiser-loud-txt').toggled;
    interfaceProperties.visualizer.loud_text_color = document.getElementById('visualiser-loud-txt-color').value;

    if (document.getElementById('img-house').src.indexOf('.jpg') !== -1) {
        let src = new URL(document.getElementById('img-house').src);
        if (document.getElementById('img-house').alt.indexOf('.jpg') !== -1) {
          let currentImage = new URL(document.getElementById('img-house').alt);
          if (decodeURIComponent(src.pathname) !== decodeURIComponent(currentImage.pathname)) {
              interfaceProperties.screen.background = decodeURIComponent(src.pathname.substring(1));
          }
        } else {
          interfaceProperties.screen.background = decodeURIComponent(src.pathname.substring(1)); 
        }
    }

    item = document.getElementsByClassName("theme-interface");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
            interfaceProperties.screen.xeltheme = item[i].value;
            break;
        }
    }

    item = document.getElementsByClassName("theme-color");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
            interfaceProperties.screen.xelcolor = item[i].value;
            break;
        }
    }

    item = document.getElementsByClassName("theme-icons");
    for (let i = 0; i < item.length; i++) {
        if (item[i].toggled) {
            interfaceProperties.screen.xelicons = item[i].value;
            break;
        }
    }
    
} 


document.body.addEventListener('click', removeClient, false);


async function setDeleteLabel(event, xtag, label, found, tblfound) {
    let xMenus = document.getElementById(xtag).childNodes;
    for (var i = 0; i < xMenus.length; i++) {
        if (event.target.innerHTML === xMenus[i].value) {
            if (tblfound && tblfound.length > 0) {
                notification(await Lget("settings", "sameItem"));
                return;
            }
            if (!tblfound) tblfound = [];
            tblfound.push(found);
            document.getElementById(label).innerHTML = await Lget("settings", "remove", xMenus[i].value);
            return tblfound;
        }
    }

    return tblfound;
}


async function setDeleteAllLabel (count) {

    const removeLabel = await Lget("settings", "removeall");
    const labels = [
        'label-delete-AKA-list',
        'label-delete-AKA-separator-list',
        'label-delete-AKA-restart-list',
        'label-delete-active-voices',
        'label-delete-thx-rule',
        'label-delete-stop-rule',
        'label-delete-listen-answer',
        'label-delete-listen-again-answer',
        'label-delete-askme-again-answer',
        'label-delete-thx-answer',
        'label-delete-stop-answer',
        'label-delete-activate-intercom',
        'label-delete-activate-global-intercom',
        'label-delete-answer-intercom',
        'label-delete-send-intercom'
    ];

    for (let i=0; i<labels.length; i++) {
        if (count === null || (count && count && i !== count)) document.getElementById(labels[i]).innerHTML = removeLabel;
    }
}



async function removeClient(event) {

    var found = [];
    found = await setDeleteLabel(event, 'AKA-list', 'label-delete-AKA-list', 0, found);
    found = await setDeleteLabel(event, 'AKA-separator-list', 'label-delete-AKA-separator-list', 1, found);
    found = await setDeleteLabel(event, 'AKA-restart-list', 'label-delete-AKA-restart-list', 2, found);
    found = await setDeleteLabel(event, 'active-voices', 'label-delete-active-voices', 3, found);
    found = await setDeleteLabel(event, 'thx-rule', 'label-delete-thx-rule', 4, found);
    found = await setDeleteLabel(event, 'stop-rule', 'label-delete-stop-rule', 5, found);
    found = await setDeleteLabel(event, 'listen-answer', 'label-delete-listen-answer', 6, found);
    found = await setDeleteLabel(event, 'listen-again-answer', 'label-delete-listen-again-answer', 7, found);
    found = await setDeleteLabel(event, 'askme-again-answer', 'label-delete-askme-again-answer', 8, found);
    found = await setDeleteLabel(event, 'thx-answer', 'label-delete-thx-answer', 9, found);
    found = await setDeleteLabel(event, 'stop-answer', 'label-delete-stop-answer', 10, found);
    found = await setDeleteLabel(event, 'activate-intercom', 'label-delete-activate-intercom', 11, found);
    found = await setDeleteLabel(event, 'activate-global-intercom', 'label-delete-activate-global-intercom', 12, found);
    found = await setDeleteLabel(event, 'answer-intercom', 'label-delete-answer-intercom', 13, found);
    found = await setDeleteLabel(event, 'send-intercom', 'label-delete-send-intercom', 14, found);

    await setDeleteAllLabel ((found && found.length === 1 ? found[0] : null));

}


document.getElementById('delete-send-intercom').addEventListener('click', async () => {
    let xMenus = document.getElementById("send-intercom").childNodes;
    let remove = document.getElementById("label-delete-send-intercom").innerHTML;
    await deleteListItem(xMenus, remove);
})



document.getElementById('delete-answer-intercom').addEventListener('click', async () => {
    let xMenus = document.getElementById("answer-intercom").childNodes;
    let remove = document.getElementById("label-delete-answer-intercom").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-activate-global-intercom').addEventListener('click', async () => {
    let xMenus = document.getElementById("activate-global-intercom").childNodes;
    let remove = document.getElementById("label-delete-activate-global-intercom").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-activate-intercom').addEventListener('click', async () => {
    let xMenus = document.getElementById("activate-intercom").childNodes;
    let remove = document.getElementById("label-delete-activate-intercom").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-stop-answer').addEventListener('click', async () => {
    let xMenus = document.getElementById("stop-answer").childNodes;
    let remove = document.getElementById("label-delete-stop-answer").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-thx-answer').addEventListener('click', async () => {
    let xMenus = document.getElementById("thx-answer").childNodes;
    let remove = document.getElementById("label-delete-thx-answer").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-askme-again-answer').addEventListener('click', async () => {
    let xMenus = document.getElementById("askme-again-answer").childNodes;
    let remove = document.getElementById("label-delete-askme-again-answer").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-listen-again-answer').addEventListener('click', async () => {
    let xMenus = document.getElementById("listen-again-answer").childNodes;
    let remove = document.getElementById("label-delete-listen-again-answer").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-listen-answer').addEventListener('click', async () => {
    let xMenus = document.getElementById("listen-answer").childNodes;
    let remove = document.getElementById("label-delete-listen-answer").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-stop-rule').addEventListener('click', async () => {
    let xMenus = document.getElementById("stop-rule").childNodes;
    let remove = document.getElementById("label-delete-stop-rule").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-thx-rule').addEventListener('click', async () => {
    let xMenus = document.getElementById("thx-rule").childNodes;
    let remove = document.getElementById("label-delete-thx-rule").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-active-voices').addEventListener('click', async () => {
    let xMenus = document.getElementById("active-voices").childNodes;
    let remove = document.getElementById("label-delete-active-voices").innerHTML;
    await deleteListItem(xMenus, remove);
})

document.getElementById('delete-AKA-list').addEventListener('click', async () => {
    let xMenus = document.getElementById("AKA-list").childNodes;
    let remove = document.getElementById("label-delete-AKA-list").innerHTML;
    await deleteListItem(xMenus, remove);
    refreshDirectAKA("select-direct-AKA");
    currentKeyWord = null;
})


document.getElementById('delete-AKA-separator-list').addEventListener('click', async () => {
    let xMenus = document.getElementById("AKA-separator-list").childNodes;
    let remove = document.getElementById("label-delete-AKA-separator-list").innerHTML;
    await deleteListItem(xMenus, remove);
})


document.getElementById('delete-AKA-restart-list').addEventListener('click', async () => {
    let xMenus = document.getElementById("AKA-restart-list").childNodes;
    let remove = document.getElementById("label-delete-AKA-restart-list").innerHTML;
    await deleteListItem(xMenus, remove);
})


async function deleteListItem(xMenus, remove) {
    if (remove === await Lget("settings", "removeall")) {
      for (var i = xMenus.length -1; i > -1; i--) {
          xMenus[i].remove()
      }
    } else {
        for (var i = 0; i < xMenus.length; i++) {
            if (remove === await Lget("settings", "remove", xMenus[i].value)) {
                xMenus[i].remove()
                break;
            }
        }
    }
}


async function resetVoices(voices, type) {

    let currentlanguage = getCurrentBCP47();
    if (appProperties.voices.current[currentlanguage] && appProperties.voices.current[currentlanguage][type])
        document.getElementById('current-voice').innerHTML = appProperties.voices.current[currentlanguage][type] === 'by default' ? await Lget("settings", "auto") : appProperties.voices.current[currentlanguage][type];
    else 
        document.getElementById('current-voice').innerHTML = ""

    let Xtags = document.getElementById("active-voices");
    while (Xtags.firstChild) {
        Xtags.removeChild(Xtags.lastChild);
    }
    if (appProperties.voices.active[currentlanguage] && appProperties.voices.active[currentlanguage][type])
        setXtagList(appProperties.voices.active[currentlanguage][type], "active-voices");

    if (appProperties.voices.test[currentlanguage])
        document.getElementById('test-sentence').value = appProperties.voices.test[currentlanguage];
    else
        document.getElementById('test-sentence').value = "";

    if (appProperties.voices.change[currentlanguage])    
        document.getElementById('change-voice').value = appProperties.voices.change[currentlanguage];
    else
        document.getElementById('change-voice').value = "";

    const availablevoices = document.getElementById('avalaible-voices');
    for (let e = availablevoices.children.length - 1; e > 1; e--) {
        availablevoices.removeChild(availablevoices.children[e])
    }
    voices.forEach(voice => {
        let itemOn = document.createElement("x-menuitem");
        itemOn.setAttribute('id', voice.name);
        itemOn.value = voice.name;
        let labelOn = document.createElement("x-label");
        labelOn.innerHTML = voice.name;
        itemOn.appendChild(labelOn);
        availablevoices.appendChild(itemOn);
    });
    document.getElementById('by-default-voice').toggled = true;

    document.getElementById('voice-test').disabled = document.getElementById('voice-add-current').disabled = document.getElementById('voice-add').disabled
    = (availablevoices.children.length === 2) ? "true" : ""

    document.getElementById('speed-voice').value = (appProperties.voices.speed[currentlanguage] && appProperties.voices.speed[currentlanguage][type])
    ? appProperties.voices.speed[currentlanguage][type]
    : document.getElementById('speed-voice').value = 50;

    document.getElementById('volume-voice').value = (appProperties.voices.volume[currentlanguage] && appProperties.voices.volume[currentlanguage][type])
    ? appProperties.voices.volume[currentlanguage][type]
    : document.getElementById('volume-voice').value = 100;
}


function errorVoices () {
    let BCP47 = document.getElementById('BCP47');
    for (var i in BCP47.childNodes) {
        if (BCP47.childNodes[i].toggled) {
            break;
        }
    }
    window.electronAPI.errorVoices(BCP47.childNodes[i].innerHTML.split(':')[1].replace('</x-label>', '').trim());
    document.getElementById('voice-test').disabled = document.getElementById('voice-add-current').disabled = document.getElementById('voice-add').disabled = "true";
}


let VoicesStatus = 0;
window.electronAPI.setRemoteVoices((_event, remoteVoices) => {

    if (VoicesStatus === 1 && remoteVoices.length === 0 && voices["local-voice"].length === 0) {
        errorVoices();
        VoicesStatus = 0
    } else if (VoicesStatus === 0) {
        VoicesStatus = 2
    } else {
        VoicesStatus = 0
    }    

    voices["web-voice"] = remoteVoices;
    if (document.getElementById("web-voice").toggled) {
        resetVoices(remoteVoices, "web-voice");
    }
})


window.electronAPI.setLocalVoices((_event, localVoices) => {
    
    if (VoicesStatus === 2 && localVoices.length === 0 && voices["web-voice"].length === 0) {
        errorVoices();
        VoicesStatus = 0
    } else if (VoicesStatus === 0) {
        VoicesStatus = 1
    } else {
        VoicesStatus = 0
    }  

    voices["local-voice"] = localVoices;
    if (document.getElementById("local-voice").toggled) {
         resetVoices(localVoices, "local-voice");
    }

})


async function getVoices (tag) {
    await window.electronAPI.getVoices(tag);
}


function refreshDirectAKA(elem, inner, setKeyword, byClick) {
    setTimeout(() => { 
        document.getElementById("AKA-sentence-indexOf").toggled = false;
        document.getElementById("AKA-action-indexOf").toggled = false;
        document.getElementById("nlp-AKA").toggled = false;
        document.getElementById("action-AKA").toggled = false;
        document.getElementById("select-direct-AKA").toggled = false;
        document.getElementById(elem).toggled = true;
        resetDirectAkaByAction (true);
        resetDirectAkaBySentence (true);
        if (setKeyword === true) {
            keywordByAction((inner ? inner : currentKeyWord), (byClick ? byClick : false));
        }
    }, 100)
}

async function setHTMLContent() {
    // Parameters tab
    document.getElementById('info-start').toggled = appProperties.verbose;
    let menuOnApp = document.getElementById('BCP47app');
    for (let i in BCP47app) {
        let itemOn = document.createElement("x-menuitem");
        itemOn.setAttribute('id', 'L-'+BCP47app[i].tag);
        itemOn.value = BCP47app[i].tag;
        let labelOn = document.createElement("x-label");
        labelOn.innerHTML = BCP47app[i].tag+" : "+BCP47app[i].region;
        itemOn.appendChild(labelOn);
        menuOnApp.appendChild(itemOn);
    };
    document.getElementById('L-'+appProperties.language).toggled = true;

    if (appProperties.UDP.target.split('.').length === 4) {
        document.getElementById('adress-server').value = appProperties.UDP.target;
        document.getElementById('ex-adress-server-label').innerHTML = appProperties.UDP.target.split('.').slice(0, -1).join('.');
    } else {
        document.getElementById('ex-adress-server-label').innerHTML = appProperties.UDP.target;
        document.getElementById('adress-server').setAttribute("empty", true);
        document.getElementById('adress-server').setAttribute("error", true);
        document.getElementById('adress-server').focus();
    }   
    document.getElementById('http').value = appProperties.http.server.port;
    document.getElementById('udp').value = appProperties.UDP.port;
    document.getElementById('client-http').value = appProperties.http.client.port;
    document.getElementById('client-http-route').value = appProperties.http.client.route;
    if (appProperties.client !== '')
        document.getElementById('client').value = appProperties.client;
    else {
        document.getElementById('client').setAttribute("empty", true);
        document.getElementById('client').setAttribute("error", true);
        document.getElementById('client').focus();
    }  
    document.getElementById('restart-udp').value = appProperties.UDP.restart;
    document.getElementById('auto-restart').value = appProperties.restart;
    document.getElementById('screen-saver').value = appProperties.screenSaver.exec;
    document.getElementById('screen-saver-timer').value = appProperties.screenSaver.timeout / 1000;
    document.getElementById('screen-saver-label-onoff').toggled = appProperties.screenSaver.active;
    document.getElementById('update-start').toggled = appProperties.checkUpdate;
    document.getElementById('powershell').value = appProperties.powerShell;

    // Dialog tab
    let currentlanguage = appProperties.speech.locale;

    document.getElementById('recognizer-type').value = appProperties.speech.speechToText;
    setXtagList(appProperties.AKA[currentlanguage], "AKA-list", true);
    
    resetDirectAkaByAction(true);
    resetDirectAkaBySentence(true);
    AKAs = appProperties["direct-AKA"] ? appProperties["direct-AKA"] : {};

    let directAKAMenu = document.getElementById('directAKAMenu');
    for (var i in directAKAMenu.childNodes) {
        if (directAKAMenu.childNodes[i].value === 'nlp-AKA') 
            directAKAMenu.childNodes[i].onclick = () => refreshDirectAKA("nlp-AKA", null, true, true); 
        if (directAKAMenu.childNodes[i].value === 'action-AKA') 
            directAKAMenu.childNodes[i].onclick = () => refreshDirectAKA("action-AKA", null, true, true); 
        if (directAKAMenu.childNodes[i].value === 'select-direct-AKA') 
            directAKAMenu.childNodes[i].onclick = () => refreshDirectAKA("select-direct-AKA", null, true, true); 
    } 

    setXtagList(appProperties.action_separators[currentlanguage], "AKA-separator-list");
    setXtagList(appProperties.refresh_AKA[currentlanguage], "AKA-restart-list");

    document.getElementById('server-speak').toggled = appProperties.speech.server_speak;
    document.getElementById('server-speak-module').value = appProperties.speech.module;
    document.getElementById('loop-mode').toggled = appProperties.listen.loop_mode;
    let menuOn = document.getElementById('BCP47');
    for (let i in BCP47) {
        let itemOn = document.createElement("x-menuitem");
        itemOn.setAttribute('id', BCP47[i].tag);
        itemOn.value = BCP47[i].tag;
        itemOn.onclick = () => {
            setRuleGroup(BCP47[i].tag);
            getVoices(BCP47[i].tag);
            resetDirectAkaByAction(true);
            resetDirectAkaBySentence(true);
            currentKeyWord = null;
        };
        let labelOn = document.createElement("x-label");
        labelOn.innerHTML = BCP47[i].tag+" : "+BCP47[i].region;
        itemOn.appendChild(labelOn);
        menuOn.appendChild(itemOn);
    };
    document.getElementById(currentlanguage).toggled = true;
    document.getElementById('timout-listen').value = appProperties.listen.timeout;
    document.getElementById('timout-speak').value = appProperties.speech.timeout;
    
    // Voice
    document.getElementById(appProperties.voices.type[currentlanguage]).toggled = true;
    setXtagList(appProperties.voices.active[currentlanguage][appProperties.voices.type[currentlanguage]], "active-voices");
    let availablevoices = document.getElementById('avalaible-voices');
    voices[appProperties.voices.type[currentlanguage]].forEach(voice => {
        let itemOn = document.createElement("x-menuitem");
        itemOn.setAttribute('id', voice.name);
        itemOn.value = voice.name;
        let labelOn = document.createElement("x-label");
        labelOn.innerHTML = voice.name;
        itemOn.appendChild(labelOn);
        availablevoices.appendChild(itemOn);
    });
    document.getElementById('by-default-voice').value = "by default";
    document.getElementById('by-default-voice').toggled = true;

    document.getElementById('voice-test').disabled = document.getElementById('voice-add-current').disabled = document.getElementById('voice-add').disabled
    = (availablevoices.children.length === 2) ? "true" : ""

    document.getElementById('volume-voice').value = appProperties.voices.volume[currentlanguage][appProperties.voices.type[currentlanguage]];
    document.getElementById('speed-voice').value = appProperties.voices.speed[currentlanguage][appProperties.voices.type[currentlanguage]];
    document.getElementById('pitch-voice').value = appProperties.voices.pitch;
    document.getElementById('change-voice').value = appProperties.voices.change[currentlanguage];
    document.getElementById('test-sentence').value = appProperties.voices.test[currentlanguage];

    if (appProperties.voices.type[currentlanguage] === 'local-voice') {
        document.getElementById('voice-pitch-div').style.display = "none";
    }

    // Rules
    setXtagList(appProperties.locale[currentlanguage].tts_thank, "thx-rule");
    setXtagList(appProperties.locale[currentlanguage].tts_cancel, "stop-rule");
    setXtagList(appProperties.locale[currentlanguage].tts_restoreContext, "listen-answer");
    setXtagList(appProperties.locale[currentlanguage].tts_restart_restoreContext, "listen-again-answer");
    setXtagList(appProperties.locale[currentlanguage].restart, "askme-again-answer");
    setXtagList(appProperties.locale[currentlanguage].answers_thank, "thx-answer");
    setXtagList(appProperties.locale[currentlanguage].answers_cancel, "stop-answer");

    // Intercom
    setXtagList(appProperties.intercom.locale[currentlanguage].rules, "activate-intercom");
    setXtagList(appProperties.intercom.locale[currentlanguage].global, "activate-global-intercom");
    setXtagList(appProperties.intercom.locale[currentlanguage].start, "answer-intercom");
    setXtagList(appProperties.intercom.locale[currentlanguage].send, "send-intercom");
    document.getElementById('silence-intercom').value = appProperties.intercom.silence;
    document.getElementById('thresholdStart-intercom').value = appProperties.intercom.thresholdStart;
    document.getElementById('thresholdStop-intercom').value = appProperties.intercom.thresholdStop;
    document.getElementById('driver-intercom').value = appProperties.intercom.driver;
    document.getElementById('device-intercom').value = appProperties.intercom.device;
    document.getElementById('info-intercom').toggled = appProperties.intercom.debug;

    // Interface
    document.getElementById('shape-start').toggled = interfaceProperties.nodes.shape_display;
    document.getElementById(interfaceProperties.nodes.type).toggled = true;
    document.getElementById('width-shape').value = interfaceProperties.nodes.shape_width;
    document.getElementById('height-shape').value = interfaceProperties.nodes.shape_height;
    document.getElementById('thickness-shape').value = interfaceProperties.nodes.shape_thickness;
    document.getElementById('opacity-shape').value = interfaceProperties.nodes.shape_opacity;
    document.getElementById('color-shape').value = interfaceProperties.nodes.shape_color;
    document.getElementById('color-shape-picker').value = interfaceProperties.nodes.shape_color;
    document.getElementById('size-text').value = interfaceProperties.nodes.fontsize;
    document.getElementById('color-text').value = interfaceProperties.nodes.fontcolor;
    document.getElementById('color-text-picker').value = interfaceProperties.nodes.fontcolor;
    document.getElementById('size-outlinetext').value = interfaceProperties.nodes.fontoutline;
    document.getElementById('color-outlinetext').value = interfaceProperties.nodes.fontbordercolor;
    document.getElementById('color-outlinetext-picker').value = interfaceProperties.nodes.fontbordercolor;

    document.getElementById('console-color').value = interfaceProperties.console.color;
    document.getElementById('console-color-picker').value = interfaceProperties.console.color;
    document.getElementById('console-background-color').value = interfaceProperties.console.background_color;
    document.getElementById('console-background-color-picker').value = interfaceProperties.console.background_color;
    document.getElementById('console-opacity').value = interfaceProperties.console.opacity;
    document.getElementById('console-txt-bold').toggled = interfaceProperties.console.textBold;
    document.getElementById('console-txt-color').value = interfaceProperties.console.textColor;
    document.getElementById('console-txt-color-picker').value = interfaceProperties.console.textColor;
    document.getElementById('console-border').toggled = interfaceProperties.console.border;
    document.getElementById('console-header').toggled = interfaceProperties.console.header;
    document.getElementById('console-txt-opacity').toggled = interfaceProperties.console.txtOpacity;
    
    document.getElementById('visualiser-loud').value = interfaceProperties.visualizer.max_loud;
    document.getElementById('visualiser-loud-txt').toggled = interfaceProperties.visualizer.txt_loud;
    document.getElementById('visualiser-loud-txt-color').value = interfaceProperties.visualizer.loud_text_color;
    document.getElementById('visualiser-loud-txt-color-picker').value = interfaceProperties.visualizer.loud_text_color;

    // theme
    if (interfaceProperties.screen?.xeltheme) {
        document.getElementById(interfaceProperties.screen.xeltheme).toggled = true;
        document.getElementById(interfaceProperties.screen.xelcolor).toggled = true;
        document.getElementById(interfaceProperties.screen.xelicons+'-icon').toggled = true;
    } else {
        document.getElementById('cupertino-dark').toggled = true;
        document.getElementById('purple').toggled = true;
        document.getElementById('fluent-icon').toggled = true;
    }
}   


async function setLangTargets() {

    // Parameters tab
    document.getElementById('connexion-label').innerHTML = await Lget("settings", "settings");
    document.getElementById('label-info-start').innerHTML = await Lget("settings", "verbose")
    document.getElementById('label-update-start').innerHTML = await Lget("settings", "updateLabel");
    document.getElementById('lang').innerHTML = await Lget("settings", "lang");
    document.getElementById('L-auto-label').innerHTML = await Lget("settings", "auto");
    document.getElementById('adress-server-label').innerHTML = await Lget("settings", "server");
    document.getElementById('http-label').innerHTML = await Lget("settings", "http");
    document.getElementById('udp-label').innerHTML = await Lget("settings", "udp");
    document.getElementById('restart-udp-label').innerHTML = await Lget("settings", "udpRestart");
    document.getElementById('client-http-label').innerHTML = await Lget("settings", "httpclient");
    document.getElementById('client-http-route-label').innerHTML = await Lget("settings", "httpclientRoute");

    if (appProperties.client !== '')
        document.getElementById('client-http-route-ex-label').innerHTML = 'e.g. '+appProperties.client.replace(' ','');

    document.getElementById('client-label').innerHTML = await Lget("settings", "client");
    document.getElementById('ex-client-label').innerHTML = await Lget("settings", "exClient");
    document.getElementById('restart-label').innerHTML = await Lget("settings", "restart");
    document.getElementById('screen-saver-label').innerHTML = await Lget("settings", "screensaver");
    document.getElementById('select-screen-saver-label').innerHTML = await Lget("settings", "selectscreensaver");
    document.getElementById('screen-saver-timer-label').innerHTML = await Lget("settings", "screensavertimer");
    document.getElementById('label-screen-saver-label-onoff').innerHTML = await Lget("settings", "screensavertimerOnoff");
    document.getElementById('test-properties-label').innerHTML = await Lget("settings", "test");
    document.getElementById('label-save-properties').innerHTML = await Lget("settings", "saveproperties");
    document.getElementById('label-quit').innerHTML = await Lget("settings", "quit");
    document.getElementById('update-label').innerHTML = await Lget("settings", "update")
    document.getElementById('select-powershell-label').innerHTML = await Lget("settings", "powershell")
    document.getElementById('label-powershell').innerHTML = await Lget("settings", "powershellVersion")
    // Dialog tab
    document.getElementById('dialog-label').innerHTML = await Lget("settings", "dialog");
    document.getElementById('recognizer-type-label').innerHTML = await Lget("settings", "recognizerType");
    document.getElementById('AKA-label').innerHTML = await Lget("settings", "AKALabel");

    document.getElementById('AKA-action-label').innerHTML = await Lget("settings", "actionLabel");
    document.getElementById('AKA-options-label').innerHTML = await Lget("settings", "optionLabel");
    document.getElementById('AKA-action-indexOf-label').innerHTML = await Lget("settings", "indexOfLabel");
    document.getElementById('AKA-sentence-indexOf-label').innerHTML = await Lget("settings", "indexOfLabel");
    document.getElementById('select-AKA-label').innerHTML = await Lget("settings", "newLabel");
    document.getElementById('nlp-AKA-label').innerHTML = await Lget("settings", "bySentence");
    document.getElementById('action-AKA-label').innerHTML = await Lget("settings", "byAction");
    document.getElementById('save-AKA-plugin-label').innerHTML = await Lget("settings", "saveAction");
    document.getElementById('delete-AKA-plugin-label').innerHTML = await Lget("settings", "deleteAction");
    document.getElementById('new-AKA-plugin-label').innerHTML = await Lget("settings", "newAKALabel");
    document.getElementById("select-direct-AKA").toggled = true;

    document.getElementById('AKA-separator-label').innerHTML = await Lget("settings", "AKASeparatorLabel");
    document.getElementById('AKA-restart-label').innerHTML = await Lget("settings", "AKARestartLabel");
    document.getElementById('server-speak-label').innerHTML = await Lget("settings", "serverSpeak");
    document.getElementById('server-speak-module-label').innerHTML = await Lget("settings", "serverSpeakModule");
    document.getElementById('loop-mode-label').innerHTML = await Lget("settings", "loopMode");
    document.getElementById('recognize-lang-label').innerHTML = await Lget("settings", "recognizeLang");
    document.getElementById('timout-listen-label').innerHTML = await Lget("settings", "listenLabel");
    document.getElementById('timout-speak-label').innerHTML = await Lget("settings", "speakLabel");
   
    // voice
    document.getElementById('voice-label').innerHTML = await Lget("settings", "voiceTab");
    document.getElementById('voice-type-label').innerHTML = await Lget("settings", "voiceType");
    document.getElementById('web-voice-label').innerHTML = await Lget("settings", "webVoice");
    document.getElementById('local-voice-label').innerHTML = await Lget("settings", "localVoice");
    document.getElementById('current-voice-label').innerHTML = await Lget("settings", "voice");
    let currentlanguage = appProperties.speech.locale;
    document.getElementById('current-voice').innerHTML = appProperties.voices.current[currentlanguage][appProperties.voices.type[currentlanguage]] === 'by default' ? await Lget("settings", "auto") : appProperties.voices.current[currentlanguage][appProperties.voices.type[currentlanguage]];
    document.getElementById('active-voices-label').innerHTML = await Lget("settings", "activeVoices");
    document.getElementById('by-default-label').innerHTML = await Lget("settings", "auto");
    document.getElementById('available-voices-label').innerHTML = await Lget("settings", "availableVoices");
    document.getElementById('voice-test-label').innerHTML = await Lget("settings", "testVoice");
    document.getElementById('voice-add-label').innerHTML = await Lget("settings", "addVoice");
    document.getElementById('voice-add-current-label').innerHTML = await Lget("settings", "addCurrentVoice");
    document.getElementById('volume-voice-label').innerHTML = await Lget("settings", "volumeVoice");
    document.getElementById('speed-voice-label').innerHTML = await Lget("settings", "speedVoice");
    document.getElementById('pitch-voice-label').innerHTML = await Lget("settings", "pitchVoice");
    document.getElementById('very-low-volume-voice').innerHTML = await Lget("settings", "veryLowVolumeVoice");
    document.getElementById('low-volume-voice').innerHTML = await Lget("settings", "lowVolumeVoice");
    document.getElementById('normal-volume-voice').innerHTML = await Lget("settings", "normalVolumeVoice");
    document.getElementById('slow-speed-voice').innerHTML = await Lget("settings", "slowSpeedVoice");
    document.getElementById('normal-speed-voice').innerHTML = await Lget("settings", "normalSpeedVoice");
    document.getElementById('fast-speed-voice').innerHTML = await Lget("settings", "fastSpeedVoice");
    document.getElementById('0-pitch-voice').innerHTML = await Lget("settings", "deepPitchVoice");
    document.getElementById('1-pitch-voice').innerHTML = await Lget("settings", "normalPitchVoice");
    document.getElementById('2-pitch-voice').innerHTML = await Lget("settings", "hightPitchVoice");
    document.getElementById('test-voices-label').innerHTML = await Lget("settings", "testTextVoice");
    document.getElementById('test-voice-ex').innerHTML = await Lget("settings", "voiceTestEx");
    document.getElementById('change-voice-label').innerHTML = await Lget("settings", "changeVoice");
    document.getElementById('change-voice-ex').innerHTML = await Lget("settings", "voiceChangeEx");

    // Rules
    document.getElementById('rules-label').innerHTML = await Lget("settings", "rulesTab");
    document.getElementById('title-rules').innerHTML = await Lget("settings", "titleRules");
    document.getElementById('title-answer').innerHTML = await Lget("settings", "titleAnswer");
    document.getElementById('thx-rule-label').innerHTML = await Lget("settings", "thxRuleLabel");
    document.getElementById('stop-rule-label').innerHTML = await Lget("settings", "stopRuleLabel");
    document.getElementById('listen-answer-label').innerHTML = await Lget("settings", "listenAnswerLabel");
    document.getElementById('listen-again-answer-label').innerHTML = await Lget("settings", "listenAgainAnswerLabel");
    document.getElementById('askme-again-answer-label').innerHTML = await Lget("settings", "askmeAgainAnswerLabel");
    document.getElementById('thx-answer-label').innerHTML = await Lget("settings", "thxAnswerLabel");
    document.getElementById('stop-answer-label').innerHTML = await Lget("settings", "stopAnswerLabel");
   
    //Interface
    document.getElementById('nodes-label').innerHTML = await Lget("settings", "nodesTab");
    document.getElementById('intercom-label').innerHTML = await Lget("settings", "intercomTab");
    document.getElementById('shape-start-label').innerHTML = await Lget("settings", "shapeStartLabel");
    document.getElementById('shape-type-label').innerHTML = await Lget("settings", "shapeTypeLabel");
    document.getElementById('width-shape-label').innerHTML = await Lget("settings", "widthShapeLabel");
    document.getElementById('height-shape-label').innerHTML = await Lget("settings", "heightShapeLabel");
    document.getElementById('thickness-shape-label').innerHTML = await Lget("settings", "thicknessShapeLabel");
    document.getElementById('opacity-shape-label').innerHTML = await Lget("settings", "opacityShapeLabel");
    document.getElementById('color-shape-label').innerHTML = await Lget("settings", "colorShapeLabel");
    document.getElementById('size-text-label').innerHTML = await Lget("settings", "sizeTextLabel");
    document.getElementById('color-text-label').innerHTML = await Lget("settings", "colorTextLabel");
    document.getElementById('size-outlinetext-label').innerHTML = await Lget("settings", "sizeOutlineTextLabel");
    document.getElementById('color-outlinetext-label').innerHTML = await Lget("settings", "colorOutlineTextLabel");
    document.getElementById('shape-title').innerHTML = await Lget("settings", "shapeTitle");
    document.getElementById('console-title').innerHTML = await Lget("settings", "consoleTitle");
    document.getElementById('console-color-label').innerHTML = await Lget("settings", "consoleColor");
    document.getElementById('console-background-color-label').innerHTML = await Lget("settings", "consoleBackgroundColor");
    document.getElementById('console-opacity-label').innerHTML = await Lget("settings", "consoleOpacity");
    document.getElementById('console-txt-bold-label').innerHTML = await Lget("settings", "consoleTxtBold");
    document.getElementById('console-txt-color-label').innerHTML = await Lget("settings", "consoleTxtColor");
    document.getElementById('console-border-label').innerHTML = await Lget("settings", "consoleBorder");
    document.getElementById('console-header-label').innerHTML = await Lget("settings", "consoleHeader");
    document.getElementById('console-txt-opacity-label').innerHTML = await Lget("settings", "consoleTxtOpacity");
    
    document.getElementById('visualiser-loud-title').innerHTML = await Lget("settings", "visualizerTitle");
    document.getElementById('visualiser-loud-label').innerHTML = await Lget("settings", "visualizerLoud");
    document.getElementById('visualiser-loud-txt-label').innerHTML = await Lget("settings", "visualizerLoudTxt");
    document.getElementById('visualiser-loud-txt-color-label').innerHTML = await Lget("settings", "visualizerLoudColor");

    // intercom
    document.getElementById('activate-intercom-label').innerHTML = await Lget("settings", "activateIntercom");
    document.getElementById('activate-global-intercom-label').innerHTML = await Lget("settings", "activateGlobalIntercom");
    document.getElementById('activate-intercomInfo-label').innerHTML = await Lget("settings", "activateIntercomInfo");
    document.getElementById('answer-intercom-label').innerHTML = await Lget("settings", "answerIntercom");
    document.getElementById('send-intercom-label').innerHTML = await Lget("settings", "sendIntercom");
    document.getElementById('silence-intercom-label').innerHTML = await Lget("settings", "silenceIntercom");
    document.getElementById('thresholdStart-intercom-label').innerHTML = await Lget("settings", "thresholdStart");
    document.getElementById('thresholdStop-intercom-label').innerHTML = await Lget("settings", "thresholdStop");
    document.getElementById('driver-intercom-label').innerHTML = await Lget("settings", "driverIntercom");
    document.getElementById('device-intercom-label').innerHTML = await Lget("settings", "deviceIntercom");
    document.getElementById('ex-driver-intercom-label').innerHTML = await Lget("settings", "exdriverIntercom");
    document.getElementById('ex-device-intercom-label').innerHTML = await Lget("settings", "exdeviceIntercom");
    document.getElementById('label-info-intercom').innerHTML = await Lget("settings", "labelInfoIntercom");
    
    
    // background
    document.getElementById('background-label').innerHTML = await Lget("settings", "backgroundTab");

    if (interfaceProperties.screen.background) {
        document.getElementById('img-house').src = 'file://'+interfaceProperties.screen.background;
        document.getElementById('img-house').alt = 'file://'+interfaceProperties.screen.background;
    } else {
        document.getElementById('img-house').style.display = "none";
        document.getElementById('img-house').src = document.getElementById('img-house').alt = ""
    }

    document.getElementById('label-select-background').innerHTML = await Lget("settings", "selectimage")

    // Theme tab
    document.getElementById('theme').innerHTML = await Lget("settings", "theme")
    document.getElementById('theme-title').innerHTML = await Lget("settings", "themeTitle")
    document.getElementById('theme-label').innerHTML = await Lget("settings", "themeLabel")
    document.getElementById('theme-color-label').innerHTML = await Lget("settings", "themeColorLabel")
    document.getElementById('theme-icons-label').innerHTML = await Lget("settings", "themeIconsLabel")

}


async function setSettingsXel(interface) {
    if (interface && interface.screen?.xeltheme) {
      document
      .querySelector('meta[name="xel-theme"]')
      .setAttribute('content', '../../node_modules/xel/themes/' + interface.screen.xeltheme + '.css');
      
      document.querySelector('meta[name="xel-accent-color"]').setAttribute('content', interface.screen.xelcolor);
      
      document
      .querySelector('meta[name="xel-icons"]')
      .setAttribute('content', '../../node_modules/xel/icons/' + interface.screen.xelicons + '.svg');
    }
}


window.electronAPI.onInitApp(async (_event, arg) => {
    interfaceProperties = arg.interface;
    appProperties = arg.properties;
    initialisation = arg.init;
    BCP47 = arg.BCP47;
    BCP47app = arg.BCP47app;
    voices = arg.voices;
    await setSettingsXel(interfaceProperties);
    await setLangTargets();
    await setHTMLContent();
})
  