/* ------------------------------------------------------------------
   IMPORTS
------------------------------------------------------------------- */
import * as url from "url";
import * as path from "node:path";
import { default as SimpleTTS } from "../lib/simpletts/lib/cjs/main.cjs";

/* ------------------------------------------------------------------
   CONSTANTES & VARIABLES GLOBALES
   (Certaines variables comme `Config`, `Avatar`, `error`, `infoOrange`,
   `infoGreen`, `L` sont fournies ailleurs.)
------------------------------------------------------------------- */
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const vbsFolders = path.resolve(__dirname, "lib", "tts", process.platform, "scripts");
const TTS = new SimpleTTS(vbsFolders);

/* ------------------------------------------------------------------
   FONCTIONS
------------------------------------------------------------------- */

/**
 * Récupère la liste des voix disponibles via SimpleTTS.
 * En cas d’erreur, renvoie un tableau vide.
 * @returns {Promise<Array>} Liste des voix.
 */
async function getVoices() {
  try {
    // On attend réellement le résultat de TTS.
    // Si vous souhaitez résolument renvoyer [] quoiqu’il arrive,
    // il suffit de faire `return [];` en dur.
    return await TTS.getVoices();
  } catch (err) {
    return [];
  }
}

/**
 * Sélectionne une voix aléatoire dans l’objet donné.
 * @param {object} elem - Objet contenant des voix sous forme de propriétés.
 * @returns {string|any} - Valeur aléatoire tirée de l’objet.
 */
function randomTTS(elem) {
  const values = Object.values(elem);
  const randomIndex = Math.floor(Math.random() * values.length);
  return values.splice(randomIndex, 1)[0];
}

/**
 * Lit un texte (ou un ensemble de textes) grâce à SimpleTTS ou un système distant.
 * @param {string|object} tts - Texte ou objet contenant plusieurs textes.
 * @param {function} [callback] - Fonction de rappel à exécuter quand la lecture est terminée.
 * @param {boolean} [end=true] - Si vrai, relance l’écoute après la lecture.
 * @param {string} [voice] - Voix spécifique à utiliser.
 * @param {number} [volume] - Volume de la voix (0-100).
 * @param {number} [speed] - Vitesse de parole (0-100).
 * @param {number} [pitch] - Hauteur de la voix (selon la plateforme).
 * @param {string} [test] - Peut servir à distinguer certains cas, ex. `local-voice`.
 * @returns {Promise<void>}
 */
async function speak(tts, callback, end, voice, volume, speed, pitch, test) {
  // Vérification de la présence du texte
  if (!tts) {
    error("Speak error:", L.get("mainInterface.ttsError"));
    if (typeof callback === "function") callback();
    return;
  }

  // Si `tts` est un objet, on choisit aléatoirement parmi ses valeurs
  if (typeof tts === "object") {
    tts = randomTTS(tts);
  }

  // Nettoyage de certaines chaînes de caractères
  tts = tts.replace(/[\n]/gi, "").replace(/[\r]/gi, "");
  if (tts.includes("|")) {
    const parts = tts.split("|");
    tts = parts[Math.floor(Math.random() * parts.length)];
  }

  // Si l’écoute est active, on la stoppe avant de parler
  if (await Avatar.Listen.isStopped() === false) {
    infoOrange(L.get("mainInterface.stopListenSpeak"));
    await Avatar.Listen.stop();
  }

  // On retarde la lecture de `tts` pour laisser place à l’éventuel arrêt d’écoute
  setTimeout(async () => {
    // Valeur par défaut pour end
    end = end !== undefined ? end : true;

    // S’il faut parler depuis le serveur (ex. socket), on délègue
    if (Config.speech.server_speak === true) {
      const next = callback ? true : false;
      if (next) Avatar.serverSpeakCallback = callback;

      return Avatar.HTTP.socket.emit(
        "server_speak",
        tts,
        next,
        end,
        null,
        Config.speech.module,
        { voice, volume, speed, pitch }
      );
    }

    // Préparation des options pour SimpleTTS
    let type;
    const options = { text: tts };

    if (voice) {
      options.voice = voice;
    } else if (
      !test &&
      Config.voices.current[Config.speech.locale] &&
      Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]]?.toLowerCase() !== "by default"
    ) {
      // On récupère la voix depuis la config
      options.voice = Config.voices.current[Config.speech.locale][Config.voices.type[Config.speech.locale]];
    }

    // Permet d’outrepasser le type ou de le définir si paramètre test de voix
    type = test ? test : Config.voices.type[Config.speech.locale];

    if (volume) {
      options.volume = volume;
    } else if (Config.voices.volume) {
      options.volume =
        Config.voices.volume[Config.speech.locale][Config.voices.type[Config.speech.locale]];
    }

    if (speed) {
      options.speed = speed;
    } else if (Config.voices.speed) {
      options.speed =
        Config.voices.speed[Config.speech.locale][Config.voices.type[Config.speech.locale]];
    }

    if (pitch) {
      options.pitch = pitch;
    } else if (Config.voices.pitch) {
      options.pitch = Config.voices.pitch; 
    }

    // Selon le “type” de voix, on fait soit un speak local, soit distant
    switch (type) {
      case "local-voice":
        TTS.read(options)
          .catch((err) => {
            throw new Error("Speak error:", err);
          })
          .finally(async () => {
            infoGreen(L.get("mainInterface.startListenSpeak"));
            if (end === true) await Avatar.Listen.start();
            if (callback) callback();
          });
        break;

      default:
        // Lecture distante via Google Chrome
        options.end = end;
        options.callback = callback;
        await Avatar.Listen.remoteSpeak(options);
        break;
    }
  }, Config.speech.timeout * 1000);
}

/**
 * Initialise les fonctions de parole et de voix dans l’objet global Avatar.
 */
function initSpeak() {
  Avatar.speak = speak;
  Avatar.getVoices = getVoices;
  Avatar.setConfig = setConfig;
}

/**
 * Met à jour la configuration locale.
 * @param {object} conf - Objet de configuration.
 */
function setConfig(conf) {
  // `Config` globale.
  Config = conf;
}

/* ------------------------------------------------------------------
   EXPORTS
------------------------------------------------------------------- */
export { initSpeak };
