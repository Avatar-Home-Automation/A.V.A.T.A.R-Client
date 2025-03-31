let appProperties;


document.getElementById("save-properties").addEventListener("click", async (event) => {

    if (!await checkProperties()) return;
    await updateProperties();
    try {
        await window.electronAPI.applyWelcomeProperties(appProperties);
    } catch(err) {
        notification('Error: '+err, true);
    }
})



async function updateProperties() { 
    appProperties.UDP.port = document.getElementById('udp').value;
    appProperties.UDP.target = document.getElementById('adress-server').value;
    appProperties.client = document.getElementById('client').value;
}



async function checkProperties() {

    if (document.getElementById('client').value === '')
        return notification(await Lget("settings", "clientError"), true);

    if (document.getElementById('adress-server').value === '')
        return notification(await Lget("settings", "adressError"), true);

    if (document.getElementById('udp').value === '')
        return notification(await Lget("settings", "udpError"), true); 

    return true;

}


function notification (msg, err) {
    let notif = document.getElementById('notification');
    notif.style.color = (err) ? 'red' : 'rgba(255, 255, 255, 0.9)';
    if (notif.opened == true) notif.opened = false;
    notif.innerHTML = msg;
    notif.opened = true;
}


document.getElementById("client").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("client").empty === true) {
        document.getElementById("client").setCustomValidity(await Lget("settings", "noName"));
    }
    else {
        document.getElementById("client").setCustomValidity("");
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


document.getElementById("udp").addEventListener("beforevalidate", async (event) => {
    event.preventDefault();

    if (document.getElementById("udp").empty === true) {
        document.getElementById("udp").setCustomValidity(await Lget("settings", "noudp"));
    }
    else {
        document.getElementById("udp").setCustomValidity("");
    }
});


function setHTMLContent() {

    document.getElementById('udp').value = appProperties.UDP.port;

}

async function setLangTargets() {
    document.getElementById('label-subtitle').innerHTML = await Lget("init", "newSubTile");
    document.getElementById('client-label').innerHTML = await Lget("settings", "client");
    document.getElementById('ex-client-label').innerHTML = await Lget("settings", "exClient");
    document.getElementById('adress-server-label').innerHTML = await Lget("settings", "server");
    document.getElementById('udp-label').innerHTML = await Lget("settings", "udp");
    document.getElementById('label-save-properties').innerHTML = await Lget("settings", "saveproperties");
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
    appProperties = arg.properties;
    setSettingsXel(arg.interface);
    await setLangTargets();
    setHTMLContent();
  })