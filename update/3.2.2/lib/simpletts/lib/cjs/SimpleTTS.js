"use strict";

// Cette ligne peut être générée par la compilation TypeScript/Babel.
// On la conserve pour éviter tout problème de compatibilité.
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };

Object.defineProperty(exports, "__esModule", { value: true });

// Dépendances natives
const { resolve, join } = require("node:path");
const { platform: getPlatform } = require("node:os");
const { exec, spawn } = require("node:child_process");
const {
  existsSync,
  readJsonSync,
  ensureDirSync,
  chmodSync,
} = require("fs-extra");

// Dépendances locales
const parseVoicesEspeak = __importDefault(require("./parseVoicesEspeak")).default;
const parseVoicesSAPI = __importDefault(require("./parseVoicesSAPI")).default;
const parseVoicesDarwin = __importDefault(require("./parseVoicesDarwin")).default;
const readOptionsToEspeakArgs = __importDefault(require("./readOptionsToEspeakArgs")).default;
const readOptionsToSAPIArgs = __importDefault(require("./readOptionsToSAPIArgs")).default;
const readOptionsToDarwinArgs = __importDefault(require("./readOptionsToDarwinArgs")).default;

// Détection de la plateforme
const CURRENT_PLATFORM = getPlatform().trim().toLowerCase();

// Emplacements et constantes
const tmpVoices = resolve(
  __dirname,
  "../../../../core/lib/tts",
  CURRENT_PLATFORM,
  "tmp"
);
const Jsonvoices = resolve(
  __dirname,
  "../../../../core/lib/tts",
  CURRENT_PLATFORM,
  "voices/voices.json"
);
const CSCRIPT_ARGS = ["//NoLogo", "//B"];

/**
 * Classe principal pour la lecture de texte avec synthèse vocale.
 */
class SimpleTTS {
  /**
   * @param {string} scriptsFolderPath - Chemin vers le dossier de scripts (par défaut ../../batchs).
   */
  constructor(scriptsFolderPath = join(__dirname, "..", "..", "batchs")) {
    /** @private {boolean} */
    this._forceStop = false;
    /** @private {Promise|null} */
    this._readPromise = null;
    /** @private {ChildProcess|null} */
    this._reader = null;

    /** @private {string} */
    this._scriptsDirectory = scriptsFolderPath;
    /** @public {string|null} */
    this.defaultVoice = null;
    /** @public {boolean} */
    this.forceEspeak = false;
  }

  /**
   * Détermine le moteur TTS en fonction de la plateforme.
   * @returns {string} - "sapi" (Windows), "espeak" (Linux) ou "say" (macOS).
   */
  getTTSSystem() {
    if (CURRENT_PLATFORM === "win32") return "sapi";
    if (CURRENT_PLATFORM === "linux") return "espeak";
    if (CURRENT_PLATFORM === "darwin") return "say";
    return "unknown";
  }

  /**
   * Récupère la liste des voix disponibles.
   * @returns {Promise<Array>} - Tableau d’objets représentant les voix (nom, langue, genre...).
   */
  async getVoices() {
    try {
      // Préparation de la commande selon la plateforme
      let command;
      if (CURRENT_PLATFORM === "win32") {
        command = `cscript ${CSCRIPT_ARGS.join(" ")} "${join(
          this._scriptsDirectory,
          "listvoices.vbs"
        )}"`;
      } else if (CURRENT_PLATFORM === "linux") {
        command = "espeak --voices";
      } else if (CURRENT_PLATFORM === "darwin") {
        command = "say -v '?'";
      } else {
        throw new Error(`Unsupported platform: ${CURRENT_PLATFORM}`);
      }

      // Exécution de la commande
      const { stdout } = await execCommand(command);

      const lines = stdout
        .trim()
        .replace(/\r/g, "\n")
        .replace(/\n\n/g, "\n")
        .split("\n");

      // Parsing selon l’OS
      if (CURRENT_PLATFORM === "win32") {
        return parseVoicesSAPI(lines).map((voice) => ({
          gender: voice.Gender.trim().toLowerCase(),
          name: voice.Name.trim().toLowerCase(),
          language: voice.Language.trim().toLowerCase(),
        }));
      }

      if (CURRENT_PLATFORM === "linux") {
        const voices = [];

        // Ajout des voix “spéciales” (Mbrola, etc.) depuis un JSON éventuel
        if (existsSync(Jsonvoices)) {
          const specialVoices = readJsonSync(Jsonvoices, { throws: true });
          specialVoices.forEach((voice) => {
            voices.push({
              gender: voice.gender,
              name: voice.name,
              language: voice.language,
            });
          });
        }

        // Ajout des voix “standard” espeak
        parseVoicesEspeak(lines).forEach((voice) => {
          voices.push({
            gender: voice["Age/Gender"] === "F" ? "female" : "male",
            name: voice.VoiceName.trim().toLowerCase(),
            language: voice.Language.trim().toLowerCase(),
          });
        });

        return voices;
      }

      if (CURRENT_PLATFORM === "darwin") {
        return parseVoicesDarwin(lines).map((voice) => ({
          name: voice.VoiceName,
          language: voice.Language,
        }));
      }

      return []; // Par défaut, renvoie un tableau vide si jamais on n’entre pas dans les conditions

    } catch (err) {
      throw err;
    }
  }

  /**
   * Indique si un texte est actuellement en cours de lecture.
   * @returns {boolean}
   */
  isReading() {
    return this._reader !== null;
  }

  /**
   * Lance la lecture d’un texte ou d’options.
   * @param {object|string} _options - Peut être un string (texte) ou un objet { text, voice, volume, speed, pitch, ... }.
   * @returns {Promise<any>} - Promesse résolue quand la lecture est terminée ou rejetée en cas d’erreur.
   */
  read(_options) {
    // Stockage de la promesse pour y accéder ailleurs (stopReading, etc.)
    this._readPromise = this._readInternal(_options);
    return this._readPromise;
  }

  /**
   * Stoppe la lecture en cours, s’il y en a une.
   * @returns {Promise<void>} - Résolue quand la lecture a bien été stoppée ou s’il n’y en avait pas.
   */
  async stopReading() {
    if (this._reader) {
      try {
        this._reader.kill();
        this._reader = null;
      } catch (e) {
        return Promise.reject(e);
      }
    } else {
      // S’il n’y a aucun process en cours, on force l’arrêt de la promesse
      this._forceStop = true;
    }

    if (this._readPromise) {
      // On attend la fin de la promesse en cours si elle est définie
      await this._readPromise.catch(() => {
        /* On ignore l’erreur ici, car on veut juste garantir l’arrêt */
      });
    }
    return Promise.resolve();
  }

  /**
   * Méthode interne pour gérer toute la logique de `read` avec async/await.
   * @private
   * @param {object|string} _options
   * @returns {Promise<any>}
   */
  async _readInternal(_options) {
    this._forceStop = false;

    // Vérifications de base
    if (typeof _options === "undefined") {
      return Promise.reject(new ReferenceError("Missing options parameter"));
    }
    if (typeof _options !== "object" && typeof _options !== "string") {
      return Promise.reject(
        new TypeError("options parameter is not an object or a string")
      );
    }

    // Normalisation des options
    const options =
      typeof _options === "string" ? { text: _options } : { ..._options };

    if (typeof options.text === "undefined") {
      return Promise.reject(new ReferenceError("Missing text parameter"));
    }
    if (typeof options.text !== "string") {
      return Promise.reject(new TypeError("text parameter is not a string"));
    }
    if (options.text.trim() === "") {
      return Promise.reject(new Error("text parameter is empty"));
    }
    if (this.isReading()) {
      return Promise.reject(new Error("Already reading a text"));
    }

    // Détermination de la voix par défaut si nécessaire
    if (!this.defaultVoice && CURRENT_PLATFORM !== "darwin") {
      try {
        const voices = await this.getVoices();
        // Cherche la voix “default”, sinon prend la première dispo
        const foundDefault = voices.find((v) => v.name === "default");
        this.defaultVoice = foundDefault ? foundDefault.name : voices[0]?.name || null;
      } catch (err) {
        return Promise.reject(err);
      }
    }

    // Gestion de la voix (Mbrola, etc.) sur Linux via JSON
    if (
      CURRENT_PLATFORM === "linux" &&
      existsSync(Jsonvoices) &&
      (typeof options.voice !== "string" || !options.voice)
    ) {
      // On tente de trouver une voix “default” dans le JSON, ou on force la voix par défaut
      const specialVoices = readJsonSync(Jsonvoices, { throws: true });
      let found = false;
      for (const voice of specialVoices) {
        // Si l’utilisateur n’a pas fourni de voix, ou que la voice qu’il a fournie n’est pas trouvée
        if (!found && voice.default === true) {
          options.voice = voice.code;
          options.file = voice.file;
          found = true;
        }
      }
      if (!options.voice) {
        options.voice = this.defaultVoice;
      }
    } else if (
      (typeof options.voice !== "string" || !options.voice) &&
      !existsSync(Jsonvoices)
    ) {
      // Sur Windows ou Mac, ou Linux sans JSON
      options.voice = this.defaultVoice;
    }

    // Bornage des paramètres volume et speed
    options.volume =
      typeof options.volume === "undefined" ? 100 : Math.round(options.volume);
    options.volume = Math.min(Math.max(options.volume, 0), 100);

    options.speed =
      typeof options.speed === "undefined" ? 50 : Math.round(options.speed);
    options.speed = Math.min(Math.max(options.speed, 0), 100);

    // Si _forceStop a été activé entre-temps
    if (this._forceStop) {
      return options;
    }

    // Construction des arguments selon la plateforme
    let args = [];
    try {
      switch (CURRENT_PLATFORM) {
        case "win32":
          args = readOptionsToSAPIArgs(options);
          break;
        case "linux":
          args = readOptionsToEspeakArgs(options);
          // Gestion spéciale si options.file (Mbrola, etc.)
          if (options.file) {
            args.push(options.file);
            args.push("special");
            ensureDirSync(tmpVoices);
            args.push(resolve(tmpVoices, "speak.wav"));
          } else {
            args.push(this.getTTSSystem());
          }
          break;
        case "darwin":
          args = readOptionsToDarwinArgs(options);
          break;
        default:
          return Promise.reject(
            new Error(`Unsupported platform: ${CURRENT_PLATFORM}`)
          );
      }
    } catch (err) {
      return Promise.reject(err);
    }

    // Ajout du texte à la fin des arguments
    args.push(options.text);

    // Lancement du processus de lecture
    try {
      // Détermine le script à exécuter
      let script;
      if (CURRENT_PLATFORM === "win32") {
        // Sur Windows, on utilise cscript + playtext.vbs
        script = "cscript";
        args = CSCRIPT_ARGS.concat([join(this._scriptsDirectory, "playtext.vbs")]).concat(args);
      } else {
        // Sur Linux ou Mac, on utilise playtext.sh
        script = join(this._scriptsDirectory, "playtext.sh");
        chmodSync(script, "755");
      }

      // On exécute spawn et on attend la fin
      const spawnResult = await spawnProcess(script, args);
      // spawnResult est le code de sortie si on le renvoie directement, ou la chaîne d’erreur.
      // Dans l’utilitaire défini en bas, on renvoie "resolve" seulement si code = 0.

      this._forceStop = false;
      this._reader = null;
      return spawnResult || options; // On peut renvoyer les options si besoin

    } catch (err) {
      this._forceStop = false;
      this._reader = null;
      return Promise.reject(err);
    }
  }
}

/* ------------------------------------------------------------------
   Fonctions utilitaires (execCommand, spawnProcess) en async/await
------------------------------------------------------------------- */

/**
 * Execute une commande en promesse (remplacement de exec).
 * @param {string} command
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        return reject(stderr ? new Error(stderr) : err);
      }
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Lance un processus en promesse (remplacement de spawn + events).
 * @param {string} script
 * @param {Array<string>} args
 * @returns {Promise<any>}
 */
function spawnProcess(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(script, args);

    // On attache l’instance à this._reader si on l’appelle depuis la classe
    // Pour simplifier, on suppose ici qu’on ne le fait que depuis la classe
    // => la classe appelle spawnProcess(script, args) après avoir défini this._reader = child
    // Mais on peut le faire directement ici aussi :
    // this._reader = child;

    let errorOutput = "";

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        errorOutput +=
          typeof data === "string" ? data : data.toString("ascii");
      });
    }

    child.on("close", (code) => {
      if (code && code !== 0) {
        reject(new Error(errorOutput || "Unknown TTS error"));
      } else {
        resolve(true);
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

exports.default = SimpleTTS;


