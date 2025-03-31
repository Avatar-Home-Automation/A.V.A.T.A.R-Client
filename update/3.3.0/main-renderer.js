let interfaceProperty, appProperties, start = false;
let readyToMenu = false;
var AudioContext, audioContent;

window.electronAPI.toAppReload(() => {
  close(false);
})

window.electronAPI.toAppExit(() => {
  window.dispatchEvent(new Event ('beforeunload'));
})

window.onbeforeunload = async (e) => {
  e.returnValue = undefined;
  let response = await window.electronAPI.isCloseApp();
  if (response === 0) close(true);
}


window.electronAPI.showRestartBox (async (_event, value) => {
  document.getElementById('dialog-notification-title').innerHTML = value.title ? value.title : "";
  document.getElementById('dialog-notification-message').innerHTML = value.detail ? value.detail : "";
  showMsgBox();
})


window.electronAPI.propertiesChanged (async (_event) => {
  document.getElementById('dialog-notification-title').innerHTML = await Lget("mainInterface", "notiftitle");
  document.getElementById('dialog-notification-message').innerHTML = await Lget("mainInterface", "notifmessage");
  showMsgBox();
})


function showMsgBox() {

  document.getElementById('agree').addEventListener('click', () => {
    document.getElementById('dialog-notification').close();
    close(false);
  });
  document.getElementById('disagree').addEventListener('click', () => {
     document.getElementById('dialog-notification').close();
  });
  document.getElementById('notification').click();
}


window.electronAPI.updateBackground((_event, image) => {
  setBackground(image);
})


async function close(flag) {
  let infos = {};
  let widgets = await getWidgets();
  infos.widgets = widgets;
  infos.main = {
    width: window.outerWidth,
    height: window.outerHeight
  };
  let elem = document.getElementById("console");
  infos.console = {
    width: elem.offsetWidth,
    height: elem.offsetHeight,
    left: elem.offsetLeft,
    top: elem.offsetTop
  };
  elem = document.getElementById("micro");
  infos.visualizer = {
    width: elem.offsetWidth,
    height: elem.offsetHeight,
    left: elem.offsetLeft,
    top: elem.offsetTop
  };
  let ele = cy.$('#ClientName');
  infos.nodes = {
    'left' : Math.trunc(ele.renderedPosition('x')),
    'top' : Math.trunc(ele.renderedPosition('y'))
  }
  flag 
    ? await window.electronAPI.closeApp(infos)
    : await window.electronAPI.reloadApp(infos);
}


dragElement(document.getElementById("micro"));
dragElement(document.getElementById("console"));
function dragElement(elmnt) {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  if (document.getElementById(elmnt.id + "header")) {
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    document.getElementById('txt'+elmnt.id+"header").onmousedown = dragMouseDown;
  } else if (document.getElementById("visualizer")) {
    document.getElementById("visualizer").onmousedown = dragVisualizerMouseDown;
  } else {
    elmnt.onmousedown = dragMouseDown;
  }

  function dragVisualizerMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    if ((elmnt.offsetTop - pos2) + elmnt.offsetHeight > window.innerHeight) {
      elmnt.style.top = (window.innerHeight - elmnt.offsetHeight - pos2) + "px"; 
    } else if ((elmnt.offsetTop - pos2) < 0) {
      elmnt.style.top = "0px"
    } else {
      elmnt.style.top = (elmnt.offsetTop - pos2) + "px"
    }
    
    if ((elmnt.offsetLeft - pos1) + elmnt.offsetWidth > window.innerWidth) {
      elmnt.style.left = (window.innerWidth - elmnt.offsetWidth - pos1) + "px"; 
    } else if ((elmnt.offsetLeft - pos1) < 0) {
      elmnt.style.left = "0px";
    } else {
      elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
    }
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

document.getElementById('police-add').addEventListener('mouseover', async (event) => {
  tooltipShow (event, 'police-add', await Lget("mainInterface", "largeFont"))
})

document.getElementById('police-less').addEventListener('mouseover', async (event) => {
  tooltipShow (event, 'police-less', await Lget("mainInterface", "lessFont"))
})

document.getElementById('copy_msg').addEventListener('mouseover', async (event) => {
  tooltipShow (event, 'copy_msg', await Lget("mainInterface", "copyConsoleMsg"))
})

document.getElementById('clean_msg').addEventListener('mouseover', async (event) => {
  tooltipShow (event, 'clean_msg', await Lget("mainInterface", "delConsole"))
})

document.getElementById('clean_msg').addEventListener('click', () => {
  var infomsg = document.getElementById('txtconsoleheader');
  infomsg.innerHTML = "";
})

document.getElementById('police-add').addEventListener('click', async () => {
  let fontSize = await getfontSize();
  let txt = document.getElementById('txtconsoleheader')
  txt.style.fontSize = (parseInt(fontSize) + 1) + 'px';
});

document.getElementById('police-less').addEventListener('click', async () => {
  let fontSize = await getfontSize();
  let txt = document.getElementById('txtconsoleheader')
  if (fontSize > 6) txt.style.fontSize = (parseInt(fontSize) - 1) + 'px';
});

function getfontSize () {
  let txt = document.getElementById('txtconsoleheader')
  return parseInt(window.getComputedStyle(txt, null).getPropertyValue('font-size'))
}


let btn = document.getElementById('copy_msg');
let clipboard = new ClipboardJS(btn);
clipboard.on('success', async (e) => {
  const isEmpty = await Lget("mainInterface", "emptyConsole")
  if (e.text.indexOf('warn: '+isEmpty) !== -1) {
    let txt = RegExp('warn: '+isEmpty,'gm');
    e.text = e.text.replace(txt,'');
    e.text = e.text.replace(/(\r\n|\n|\r)/gm, '');
  }
  if (e.text === "")
    infoLogger('warn@@@'+isEmpty)
  else {
    const copied = await Lget("mainInterface", "copyConsole")
    infoLogger('info@@@'+copied)
  }
})
.on('error', async (e) => {
    const errCopy = await Lget("mainInterface", "errorConsole")
    infoLogger('error@@@'+errCopy+": "+e)
});


window.electronAPI.toConsole(() => {
  document.getElementById('console').style.display === "none"
  ? document.getElementById('console').style.display = "block"
  : document.getElementById('console').style.display = "none";
})


window.electronAPI.toVisualizer(() => {
  start = !start;
  document.getElementById('micro').style.display === "none"
  ? document.getElementById('micro').style.display = "block"
  : document.getElementById('micro').style.display = "none";
})


function tooltipShow(event, type, txt) {

  $('#'+type).qtip({
    overwrite: false, 
    content: {text: txt},
    position: {
      my: 'center left',
      at:  'center right',
    },
    show: {
        event: event.type, 
        ready: true 
    },
    style: {
      classes: "qtip-red qtip-rounded",
      tip: {
        width: 8,
        height: 8
      }
    }
  }, event);
}



function notification (msg, err) {
  let notif = document.getElementById('nonode');
  notif.style.color = (err) ? 'red' : 'rgba(255, 255, 255, 0.9)';
  if (notif.opened === true) {
    notif.innerHTML = notif.innerHTML+"<br>"+msg;
  } else {
    notif.innerHTML = msg;
    notif.opened = true;
  }
}


function infoLogger (value) {
  const logger = document.getElementById('txtconsoleheader')
  let type = value.split('@@@')[0]
  let msg = value.split('@@@')[1]

  if (typeof(msg) === 'object') msg = JSON.stringify(msg)
  switch (type ) {
    case 'error' :
      msg = "<b>"+type+":</b> <font color='red'>"+msg+"</font>"
      break;
    case 'warn' :
      msg = "<b>"+type+":</b> <font color='orange'>"+msg+"</font>"
      break;
    case 'info' :
      msg = interfaceProperty.console.textBold === true 
      ? "<b>"+type+": <font color='"+interfaceProperty.console.textColor+"'>"+msg+"</b></font>"
      : "<b>"+type+":</b> <font color='"+interfaceProperty.console.textColor+"'>"+msg+"</font>"
      break;
    case 'infoGreen':
      msg = "<b>info:</b> <font color='green'>"+msg+"</font>"
      break;
    case 'infoOrange':
      msg = "<b>info:</b> <font color='orange'>"+msg+"</font>"
  }

  if (logger.innerHTML != "") {
    let reg = new RegExp("info","g")
    if (logger.innerHTML.match(reg) == 100) logger.innerHTML = ""
  }

  logger.innerHTML = logger.innerHTML != "" ? logger.innerHTML+"<br>"+msg : msg
  logger.scrollTop = logger.scrollHeight
}


window.electronAPI.onUpdateLogger((_event, value) => {
  infoLogger(value);
})


window.electronAPI.onUpdateLoggerConsole((_event, value) => {
  for (let i in value) {
    console.log(value[i])
  }
})


function setBackground (image) {
  document.body.style.margin = 0;
  document.body.style.padding = 0;
  interfaceProperty.screen.background = interfaceProperty.screen.background.replaceAll('\\', '/');
  document.body.style.background = "url('"+(image !== undefined ? image : interfaceProperty.screen.background)+"') no-repeat center fixed";
  document.body.style["background-size"] = "cover";
}


async function Lget (top, target, param, param1) {
  if (param) {
      if (param1)
           return await window.electronAPI.getMsg([top+"."+target, param, param1]);
      else
           return await window.electronAPI.getMsg([top+"."+target, param]);
  } else {
      return await window.electronAPI.getMsg(top+"."+target);
  }
}


function setHTMLContent() {

  //Console
  document.getElementById('console').style.width = interfaceProperty.console.width+"px";
  document.getElementById('console').style.height = interfaceProperty.console.height+"px";

  document.getElementById('console').style.left = ((interfaceProperty.console.left + interfaceProperty.console.width) > window.innerWidth)
    ? (window.innerWidth - interfaceProperty.console.width)+"px"
    : interfaceProperty.console.left+"px";
    document.getElementById('console').style.top = ((interfaceProperty.console.top + interfaceProperty.console.height) > window.innerHeight)
    ? (window.innerHeight - interfaceProperty.console.innerHeight)+"px"
    : document.getElementById('console').style.top = interfaceProperty.console.top+"px";
  //#2196F3
  document.getElementById('console').style['background-color'] = interfaceProperty.console.color;
  let border = !interfaceProperty.console.border ? "none" : "ridge";
  document.getElementById('console').style.border = "5px "+border+" "+interfaceProperty.console.color;
  
  document.getElementById('console').style.opacity = interfaceProperty.console.opacity;
  document.getElementById('console').style.background = interfaceProperty.console.txtOpacity === true ?
  "rgba(0,0,0,0)"
  :document.getElementById('console').style.background = interfaceProperty.console.background_color
   
  document.getElementById('consoleheader').style['background-color'] = interfaceProperty.console.color;
  if (!interfaceProperty.console.header) {
    document.getElementById('consoleheader').style.display = "none";
    document.getElementById('console_buttons').style.display = "none";
    document.getElementById('txtconsoleheader').style.width = "100%";
    document.getElementById('txtconsoleheader').style.left = "0px";
  }
  document.getElementById('console').style.display =  !interfaceProperty.console.display ? "none" : "block";
 
  // Visualizer
  document.getElementById('micro').style.width = interfaceProperty.visualizer.width+"px";
  document.getElementById('micro').style.height = interfaceProperty.visualizer.height+"px";
  document.getElementById('micro').style.left = ((interfaceProperty.visualizer.left + interfaceProperty.visualizer.width) > window.innerWidth)
    ? (window.innerWidth - interfaceProperty.visualizer.width)+"px"
    : interfaceProperty.visualizer.left+"px";
  document.getElementById('micro').style.top = ((interfaceProperty.visualizer.top + interfaceProperty.visualizer.height) > window.innerHeight)
    ? (window.innerHeight - interfaceProperty.visualizer.innerHeight)+"px"
    : interfaceProperty.visualizer.top+"px";
  document.getElementById('micro').style.display = !interfaceProperty.visualizer.display ? "none" : "block";
  document.getElementById('loud-text').style.display = !interfaceProperty.visualizer.txt_loud ? "none" : "block";
  document.getElementById('loud-text').style.color = interfaceProperty.visualizer.loud_text_color;

}

async function setLangTargets() {
  document.getElementById('restart').innerHTML = await Lget("mainInterface", "restart");
  document.getElementById('later').innerHTML = await Lget("mainInterface", "later");
}


async function addNode(id, name, type) {

  if (cy) {
    cy.add(
        {
          group: "nodes",
          data: { id: id, name: name }
        }
      );
      let style = {
        'shape': interfaceProperty.nodes.type,
        'height': interfaceProperty.nodes.shape_height,
        'width': interfaceProperty.nodes.shape_width,
        'text-opacity': 1,
        'text-outline-opacity' : 1,
        'text-background-opacity': 0,
        'text-border-opacity': 0,
        'text-outline-width': interfaceProperty.nodes.fontoutline,
        'text-outline-color': interfaceProperty.nodes.fontbordercolor,
        "text-valign": 'center',
        "text-halign": 'center',
        "text-margin-y": 0,
        "text-margin-x": 0,
        'font-size': interfaceProperty.nodes.fontsize,
        'color': interfaceProperty.nodes.fontcolor,
        'background-fit': 'cover',
        'background-opacity': 0,
        'background-color': '#999999',
        'selection-box-opacity': 0,
        'selection-box-border-color': 'red',
        'border-color': interfaceProperty.nodes.shape_color,
        'border-width': interfaceProperty.nodes.shape_thickness,
        'border-opacity': interfaceProperty.nodes.shape_display ? interfaceProperty.nodes.shape_opacity : 0,
        'padding': "0px",
        'opacity': 1,
        'label': name
      };
      
      let x = interfaceProperty.nodes.left;
      let y = interfaceProperty.nodes.top;

      let s = cy.$('#'+id);
      s.style (style);
      s.renderedPosition('x', x);
      s.renderedPosition('y', y);
      s.addClass(type);
      s.on('onetap', async (evt) => {
        x = evt.target.renderedPosition('x');
        y = evt.target.renderedPosition('y');
        if (readyToMenu === true) {
          await window.electronAPI.showMenu({pos: {x: x, y: y}});
        } else {
          const noReady = await Lget("mainInterface", "noReady");
          infoLogger('warn@@@'+noReady);
        }

      });
  }
}

async function setCY (){

  let documentCY = document.getElementById('cy');
  cy = cytoscape({
    container: documentCY,
    boxSelectionEnabled: false,
    autounselectify: false,
    zoomingEnabled: false,
    userZoomingEnabled: false,
    userPanningEnabled: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    pixelRatio: 'auto',
    style: cytoscape.stylesheet().selector('node')
  });

  addNode('ClientName', appProperties.client, "ClientName");
}


var soundAllowed = async function (stream) {
  var paths = document.getElementsByTagName('path');
  var visualizer = document.getElementById('visualizer');
  var mask = visualizer.getElementById('mask');
  var h = document.getElementById('db-text');
  var progress = document.getElementById('db-progressbar');
  var hSub = document.getElementsByTagName('h1')[0];
  var path;
  var seconds = 0;
  var loud_volume_threshold = interfaceProperty.visualizer.max_loud;
  var audioStream = audioContent.createMediaStreamSource( stream );
  var analyser = audioContent.createAnalyser();
  var fftSize = 1024;
  let visualizerMsgStart = await Lget("mainInterface", "visualizerMsgStart");
  let visualizerMsgEnd = await Lget("mainInterface", "visualizerMsgEnd");

  analyser.fftSize = fftSize;
  audioStream.connect(analyser);

  var bufferLength = analyser.frequencyBinCount;
  var frequencyArray = new Uint8Array(bufferLength);
  visualizer.setAttribute('viewBox', '0 0 255 255');

  for (var i = 0 ; i < 255; i++) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-dasharray', '4,1');
      mask.appendChild(path);
  }

  var doDraw = function () {
      requestAnimationFrame(doDraw);
      if (start) {
          analyser.getByteFrequencyData(frequencyArray);
          var adjustedLength;
          for (var i = 0 ; i < 255; i++) {
              adjustedLength = Math.floor(frequencyArray[i]) - (Math.floor(frequencyArray[i]) % 5);
              paths[i].setAttribute('d', 'M '+ (i) +',255 l 0,-' + adjustedLength);
          }
      }
      else {
          for (var i = 0 ; i < 255; i++) {
              paths[i].setAttribute('d', 'M '+ (i) +',255 l 0,-' + 0);
          }
      }
  }

  var showVolume = function () {
      setTimeout(showVolume, 500);
      if (start) {
          analyser.getByteFrequencyData(frequencyArray);
          var total = 0
          for(var i = 0; i < 255; i++) {
             var x = frequencyArray[i];
             total += x * x;
          }
          var rms = Math.sqrt(total / bufferLength);
          var db = 20 * ( Math.log(rms) / Math.log(10) );
          db = Math.max(db, 0); 

          h.innerHTML = Math.floor(db) + " dB";
          progress.value = Math.floor(db);
          if (db >= loud_volume_threshold) {
              seconds += 0.5;
              if (seconds >= 5) {
                  hSub.innerHTML = visualizerMsgStart+" "+Math.floor(seconds)+" "+visualizerMsgEnd;
              }
          }
          else {
              seconds = 0;
              hSub.innerHTML = "";
          }
      }
      else {
          h.innerHTML = "";
          hSub.innerHTML = "";
      }
  }
  doDraw();
  showVolume();
}


var soundNotAllowed = async function (error) {
  notification(await Lget("mainInterface", "visualizerError")+" "+error, true);
}

function startVisualizer() {
    navigator.mediaDevices.getUserMedia({audio:true})
    .then(soundAllowed)
    .catch(soundNotAllowed);
    AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContent = new AudioContext();
    start = interfaceProperty.visualizer.display;
}


window.electronAPI.newVersion(async (_event, version) => {

  const signs = document.querySelectorAll('x-sign');
  const randomIn = (min, max) => (
    Math.floor(Math.random() * (max - min + 1) + min)
  )

  const mixupInterval = el => {
    const ms = randomIn(2000, 4000)
    el.style.setProperty('--interval', `${ms}ms`)
  }

  signs.forEach(el => {
    mixupInterval(el)
    el.addEventListener('webkitAnimationIteration', () => {
      mixupInterval(el)
    })
  })

  const msg = await Lget("mainInterface", "newVersion", version);
  document.getElementById('newVersionLabel').innerHTML = msg;
  document.getElementById('newVersionLabel').onclick = async () => {
    const result = await window.electronAPI.setNewVersion(version);
    if (result === true) {
      document.getElementById('newVersion').style.display = "none";
    }
  };
  infoLogger('info@@@'+msg);
  document.getElementById('newVersion').style.display = "block";
})


window.electronAPI.readyToMenu(async () => {
  readyToMenu = true;
})


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


window.electronAPI.onInitApp((_event, arg) => {
  interfaceProperty = arg.interface;
  appProperties = arg.app;
  setSettingsXel(interfaceProperty);
  setBackground();
  setHTMLContent();
  setLangTargets();
  if (interfaceProperty.nodes.display === true) setCY ();
  startVisualizer();
})

