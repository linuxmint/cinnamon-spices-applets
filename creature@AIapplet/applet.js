const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const ByteArray = imports.byteArray;
const Main = imports.ui.main;

const { St, Clutter, GLib, Gio, GObject, GdkPixbuf, Gdk, Pango } = imports.gi;
let Cairo = null;
try { Cairo = imports.cairo; } catch (e) { try { Cairo = imports.gi.cairo; } catch (e2) { Cairo = null; } }

const UUID = "creature@AIapplet";
const LOVE_MESSAGE = "Je n'ai plus d'idée mais je t'aime quand même, garde-moi.";
const LOVE_MESSAGE_REPEATS = 3;
const DEFAULT_EMPTY_MESSAGE = "Clique sur « Nourrir » pour entendre une citation.";
const DEFAULT_PROFILE_IMAGE_PATH = "/home/manigael/.local/share/cinnamon/applets/creature@AIapplet/profil_picture/roberto.png";

const DEFAULT_CUSTOM_EMOJI_BANK = ["😀","😂","🥰","😴","🤔","😎","😭","😡","🫶","✨","🔥","💧","🌱","🍀","🌙","⭐","🎵","📚","🧠","👁","⚡","🔋","🧩","🪄","💎"];
const DEFAULT_CUSTOM_SYMBOL_BANK = ["α","β","γ","δ","θ","λ","μ","π","Σ","Δ","Ω","ω","∞","≈","≠","≤","≥","√","∫","∑","→","↔","±","×","÷"];

function _sanitizeOneGlyph(value, fallback) {
    value = safeString(value).trim();
    return value !== "" ? value : fallback;
}

function _settingsBank(settingsData, prefix, defaults, countValue) {
    let count = parseInt(countValue, 10);
    if (isNaN(count)) count = 10;
    if (count < 5) count = 5;
    if (count > 25) count = 25;
    let out = [];
    for (let i = 1; i <= count; i++) {
        let fallback = defaults[i - 1] || defaults[0] || "•";
        out.push(_sanitizeOneGlyph(settingsData[prefix + i], fallback));
    }
    return out;
}

function _stableVariant(items, key) {
    if (!items || items.length === 0) return "";
    key = safeString(key);
    let sum = Math.floor(nowSeconds() / 900);
    for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
    return items[Math.abs(sum) % items.length];
}


let I18N_FR = {};
let I18N_EN = {};

function _readI18nFile(code) {
    try {
        let path = joinPath([getAppletDir({ uuid: UUID }), "i18n", code + ".json"]);
        return readJsonFile(path) || {};
    } catch (e) {
        return {};
    }
}

function _ensureI18nLoaded() {
    if (!I18N_FR || Object.keys(I18N_FR).length === 0) I18N_FR = _readI18nFile("fr");
    if (!I18N_EN || Object.keys(I18N_EN).length === 0) I18N_EN = _readI18nFile("en");
}

function _formatTemplate(template, values) {
    let out = String(template || "");
    values = values || {};
    for (let key in values) {
        out = out.split("{" + key + "}").join(String(values[key]));
    }
    return out;
}

function _detectSystemLanguageCode() {
    try {
        let vars = ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"];
        for (let i = 0; i < vars.length; i++) {
            let v = GLib.getenv(vars[i]);
            if (v && v.toLowerCase().indexOf("en") === 0) return "en";
        }
    } catch (e) {}
    return "fr";
}

function _tr(lang, key, fallback) {
    _ensureI18nLoaded();
    let dict = lang === "en" ? I18N_EN : I18N_FR;
    if (dict && dict[key] !== undefined) return dict[key];
    if (lang === "en" && I18N_FR && I18N_FR[key] !== undefined) return I18N_FR[key];
    return fallback;
}

const CLIPBOARD_POLL_INTERVAL_MS = 2000;
const CLIPBOARD_TEXT_MAX_CHARS = 5000;
const SYSTEM_POLL_INTERVAL_MS = 120000;
const XP_PER_COPY = 1;
const XP_PER_FEED = 10;
const XP_PER_ACTIVE_MINUTE = 1;
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"];
const CARE_TICK_INTERVAL_MS = 60000;
const HUNGER_DECAY_PER_HOUR = 8;
const CLEAN_DECAY_PER_HOUR = 6;
const EMOJI_BANK = ["😀","😂","🥰","😴","🤔","😎","😭","😡","🫶","✨","🔥","💧","🌱","🍀","🌙","⭐","🎵","📚","🧠"];
const MATH_SYMBOL_BANK = ["α","β","γ","δ","θ","λ","μ","π","Σ","Δ","Ω","ω","∞","≈","≠","≤","≥","√","∫","∑","→","↔","±","×","÷"];
const TREASURE_BANK = [
    { emoji: "🪶", text: "plume" },
    { emoji: "💎", text: "pierre brillante" },
    { emoji: "🌿", text: "branche légendaire" }
];
const DEFAULT_STUDY_PLAYLIST = "https://open.spotify.com/playlist/4z1OYVJ5j2oU2Io7SU6Q5e?si=845ba73150fb4e5d";
const CLEANING_ITEMS = [
    { emoji: "🧼", name: "savon", clean: 35, reaction: "Ça mousse, je suis comme neuf !" },
    { emoji: "💧", name: "eau", clean: 25, reaction: "Ça fait du bien…" },
    { emoji: "🍃", name: "feuille", clean: 10, reaction: "Nettoyage nature, validé." },
    { emoji: "🔥", name: "feu", clean: -25, reaction: "AHHH tu me brûles au secours !" },
    { emoji: "💩", name: "caca", clean: -30, reaction: "Ah bah merci… super le nettoyage." },
    { emoji: "🟫", name: "boue", clean: -20, reaction: "Tu viens de me salir encore plus." },
    { emoji: "📎", name: "trombone", clean: 0, reaction: "Je ne suis pas un dossier administratif." }
];
const FOOD_ITEMS = {
    generic: [
        { emoji: "🍎", name: "pomme", reaction: "Croquant, simple, efficace." },
        { emoji: "🍞", name: "pain", reaction: "Encore du pain sec… mais bon." },
        { emoji: "🥕", name: "carotte", reaction: "Ça fait très sérieux comme repas." }
    ],
    bird: [
        { emoji: "🌾", name: "graines", reaction: "MES GRAINES PRÉFÉRÉES !" },
        { emoji: "🪱", name: "ver", reaction: "Protéines de pigeon, miam." },
        { emoji: "🍞", name: "pain", reaction: "Encore du pain sec…" }
    ],
    cat: [
        { emoji: "🐟", name: "poisson", reaction: "Poisson détecté. Respect +100." },
        { emoji: "🥩", name: "viande", reaction: "Enfin un vrai repas de félin." },
        { emoji: "🥛", name: "lait", reaction: "Je fais semblant d’être mignon." }
    ],
    plant: [
        { emoji: "💧", name: "eau", reaction: "Hydratation parfaite." },
        { emoji: "☀️", name: "soleil", reaction: "Photosynthèse en cours." },
        { emoji: "🌱", name: "engrais", reaction: "Je pousse en silence." }
    ],
    spirit: [
        { emoji: "✨", name: "étoiles", reaction: "Je mange de la lumière." },
        { emoji: "🌙", name: "lune", reaction: "Goût de nuit magique." },
        { emoji: "💭", name: "rêve", reaction: "Délicieux souvenir." }
    ],
    object: [
        { emoji: "🔋", name: "énergie", reaction: "Batterie émotionnelle chargée." },
        { emoji: "⚙️", name: "rouage", reaction: "Mécanisme content." },
        { emoji: "✨", name: "poussière magique", reaction: "Objet mais vivant, logique." }
    ],
    digital_eye: [
        { emoji: "🔋", name: "pile", reaction: "Charge parfaite. Je vois plus clair." },
        { emoji: "⚡", name: "éclair", reaction: "Énergie directe dans la pupille." },
        { emoji: "📦", name: "paquet de données", reaction: "Données avalées. Regard mis à jour." },
        { emoji: "🔆", name: "pixel lumineux", reaction: "Pixel absorbé. Brillance +1." },
        { emoji: "🐞", name: "bug croustillant", reaction: "Bug digéré. Le regard est stable." },
        { emoji: "🧩", name: "fragment de code", reaction: "Fragment compilé. Esprit éveillé." }
    ]
};
const BAD_FOOD_ITEMS = [
    { emoji: "📎", name: "trombone" },
    { emoji: "🧦", name: "chaussette" },
    { emoji: "🪨", name: "caillou" },
    { emoji: "💩", name: "caca" },
    { emoji: "🔥", name: "feu" },
    { emoji: "🧼", name: "savon" }
];


const MOOD_VARIANTS = {
    late: ["😴 Tu travailles tard… je suis fatigué.", "🌙 Même les pixels ont sommeil à cette heure-ci.", "💤 Je garde un œil ouvert, mais doucement."],
    dirty: ["🫧 Je commence à sentir le vieux tiroir.", "🧽 Un petit nettoyage ne serait pas de refus.", "🌫️ Ma brillance baisse, chef."],
    hungry: ["🥺 J’ai faim… vraiment faim.", "🍽️ Mon ventre fait du bruit dans le panneau.", "🔋 Niveau énergie émotionnelle bas."],
    daily: ["🥺 Je n’ai pas encore mangé aujourd’hui.", "🍪 J’attends mon petit rituel du jour.", "👀 Je te regarde en mode snack absent."],
    idle: ["🥺 Ça fait longtemps… tu m’avais oublié ?", "👋 Je suis toujours là, discrètement.", "🕰️ Long silence détecté."],
    fed: ["🥰 Merci pour les snacks.", "✨ Repas reçu, humeur lumineuse.", "😌 Je suis bien nourri et très digne."],
    calm: ["🙂 Je surveille le panneau tranquillement.", "👁️ Tout est calme dans le panneau.", "🌿 Présence stable, esprit léger."]
};

const CLEANING_REACTION_VARIANTS = {
    "savon": ["Ça mousse, je suis comme neuf !", "Nettoyage savonneux validé.", "Ça brille presque trop."],
    "eau": ["Ça fait du bien…", "Fraîcheur douce détectée.", "Hydratation de surface réussie."],
    "feuille": ["Nettoyage nature, validé.", "Une caresse végétale, pourquoi pas.", "Méthode douce acceptée."],
    "feu": ["AHHH tu me brûles au secours !", "Feu non recommandé, vraiment.", "Température émotionnelle critique."],
    "caca": ["Ah bah merci… super le nettoyage.", "Ceci n’est pas un produit d’entretien.", "Propreté en chute libre."],
    "boue": ["Tu viens de me salir encore plus.", "La boue n’a pas aidé, étonnamment.", "Texture discutable."],
    "trombone": ["Je ne suis pas un dossier administratif.", "Le trombone classe mes émotions, pas ma poussière.", "Objet de bureau refusé."]
};

const FOOD_REACTION_VARIANTS = {
    "pile": ["Charge parfaite. Je vois plus clair.", "Batterie avalée, regard stabilisé.", "Énergie propre dans la pupille."],
    "éclair": ["Énergie directe dans la pupille.", "Voltage reçu. Clignement optimisé.", "Éclair digéré sans court-circuit."],
    "paquet de données": ["Données avalées. Regard mis à jour.", "Paquet reçu, checksum affectif OK.", "Miam, des données bien rangées."],
    "pixel lumineux": ["Pixel absorbé. Brillance +1.", "Un pixel de plus dans l’iris.", "Luminosité intérieure augmentée."],
    "bug croustillant": ["Bug digéré. Le regard est stable.", "Croustillant, mais légèrement instable.", "Bug supprimé par mastication."],
    "fragment de code": ["Fragment compilé. Esprit éveillé.", "Code avalé, syntaxe intérieure correcte.", "Ça nourrit mon âme JavaScript."],
    "pomme": ["Croquant, simple, efficace.", "Pomme acceptée avec sérieux.", "Ça donne une énergie honnête."],
    "pain": ["Encore du pain sec… mais bon.", "Pain reçu, dignité conservée.", "Classique, mais utile."],
    "carotte": ["Ça fait très sérieux comme repas.", "Vision améliorée, paraît-il.", "La carotte donne une posture responsable."],
    "graines": ["MES GRAINES PRÉFÉRÉES !", "Graines validées instantanément.", "Petit festin de bec imaginaire."],
    "ver": ["Protéines de pigeon, miam.", "Ver reçu, instinct activé.", "C’est étrange mais efficace."],
    "poisson": ["Poisson détecté. Respect +100.", "Repas félin de qualité.", "Ça sent fort, donc c’est probablement bon."],
    "viande": ["Enfin un vrai repas de félin.", "Protéines nobles détectées.", "Le carnivore intérieur approuve."],
    "lait": ["Je fais semblant d’être mignon.", "Petit bol reçu avec élégance.", "Douceur lactée validée."],
    "eau": ["Hydratation parfaite.", "Eau reçue, sauf pour l’œil numérique.", "Fraîcheur intérieure."],
    "soleil": ["Photosynthèse en cours.", "Lumière absorbée calmement.", "Rayons reçus, croissance douce."],
    "engrais": ["Je pousse en silence.", "Nutriments détectés.", "Croissance discrète activée."],
    "étoiles": ["Je mange de la lumière.", "Poussière d’étoile absorbée.", "Goût cosmique très correct."],
    "lune": ["Goût de nuit magique.", "Lumière lunaire acceptée.", "Ça apaise l’esprit."],
    "rêve": ["Délicieux souvenir.", "Rêve avalé sans se réveiller.", "Nourriture légère et profonde."],
    "énergie": ["Batterie émotionnelle chargée.", "Énergie acceptée par le mécanisme.", "Recharge sentimentale complète."],
    "rouage": ["Mécanisme content.", "Ça tourne mieux dedans.", "Rouage croquant, curieux mais utile."],
    "poussière magique": ["Objet mais vivant, logique.", "Poussière absorbée, logique suspendue.", "Magie de maintenance effectuée."]
};

const SYSTEM_EVENT_VARIANTS = {
    battery: ["🔋 Batterie faible… je vais économiser mes plumes.", "🔋 Énergie basse détectée. Je baisse ma luminosité intérieure.", "🪫 Le système fatigue, je surveille doucement."],
    network: ["📡 Wi‑Fi perdu… je capte seulement ton affection.", "📡 Réseau absent. Je reste connecté au panneau.", "🛰️ Signal perdu, présence maintenue."]
};

const FISH_QUOTES = [
    "Un anneau pour les gouverner tous, un anneau pour les trouver, un anneau pour les amener tous et dans les ténèbres les lier. — J.R.R. Tolkien",
    "Dans vingt ans vous serez plus déçus par les choses que vous n'avez pas faites que par celles que vous avez faites. — Mark Twain",
    "Le secret pour avancer, c'est de commencer. — Mark Twain",
    "Les deux jours les plus importants de votre vie sont le jour où vous êtes né et le jour où vous découvrez pourquoi. — Mark Twain",
    "Là où se trouve votre trésor, là aussi sera votre cœur. — J.R.R. Tolkien",
    "Tous ceux qui errent ne sont pas perdus. — J.R.R. Tolkien",
    "Le courage se trouve dans des endroits inattendus. — J.R.R. Tolkien",
    "Il ne faut pas juger de la valeur d'un homme par ses qualités, mais par l'usage qu'il en fait. — La Rochefoucauld",
    "Le souvenir d'un bonheur passé est encore du bonheur. — Rémy de Gourmont",
    "Rien n'est si contagieux que l'exemple. — La Rochefoucauld",
    "On n'est jamais si heureux ni si malheureux qu'on s'y imagine. — La Rochefoucauld",
    "La politesse de l'esprit consiste à penser des choses honnêtes et délicates. — La Rochefoucauld",
    "Il est mais aisé d'être sage pour les autres que pour soi-même. — La Rochefoucauld",
    "La clarté est la bonne foi des philosophes. — Luc de Clapiers",
    "La patience est amère, mais son fruit est doux. — Jean-Jacques Rousseau",
    "Un voyage de mille lieues commence par un pas. — Lao-Tseu",
    "La vie est vraiment simple, mais nous insistons à la rendre compliquée. — Confucius",
    "Exige beaucoup de toi-même et attends peu des autres. Ainsi beaucoup d'ennuis te seront épargnés. — Confucius",
    "Choisissez un travail que vous aimez et vous n'aurez pas à travailler un seul jour de votre vie. — Confucius",
    "Notre plus grande gloire n'est pas de ne jamais tomber, mais de nous relever à chaque fois que nous tombons. — Confucius",
    "Le sage se demande ce qu'il déduit de ses erreurs, l'insensé demande ce que les autres en pensent. — Proverbe",
    "L'arbre inversé cache ses racines profondes. — Proverbe",
    "Qui marche dans les traces d'un autre ne laisse pas d'empreintes. — Proverbe",
    "Le vent balaie les feuilles mais n'ébranle pas la montagne. — Proverbe",
    "Le temps passe comme le courant d'une rivière, mais la pierre reste. — Proverbe",
    "On peut guérir d'un coup de poignard, mais pas d'un coup de langue. — Proverbe",
    "La vérité est comme le soleil. Elle se montre toujours, peu importe l'épaisseur des nuages. — Proverbe",
    "Un moment de patience peut préserver de grands malheurs, un moment d'impatience peut détruire toute une vie. — Proverbe",
    "Si vous fermez la porte à toutes les erreurs, la vérité restera dehors. — Rabindranath Tagore",
    "La musique remplit l'infini qui sépare deux âmes. — Rabindranath Tagore",
    "On n'atteint pas le sommet de la montagne en un seul saut, mais marche après marche. — Proverbe",
    "L'esprit est comme un parachute : il ne fonctionne que s'il est ouvert. — Thomas Dewar",
    "Le secret du bonheur est la liberté, le secret de la liberté est le courage. — Thucydide",
    "Il n'y a pas de chemin vers le bonheur, le bonheur est le chemin. — Thich Nhat Hanh",
    "La clarté de l'esprit produit la paix de l'âme. — Proverbe",
    "Il est plus facile de briser un atome qu'un préjugé. — Albert Einstein",
    "Au milieu de la difficulté se trouve l'opportunité. — Albert Einstein",
    "La logique vous mènera d'un point A à un point B. L'imagination vous emmènera partout. — Albert Einstein",
    "La vie, c'est comme une bicyclette, il faut avancer pour ne pas perdre l'équilibre. — Albert Einstein",
    "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux. — Le Petit Prince",
    "C'est le temps que tu as perdu pour ta rose qui fait ta rose si importante. — Le Petit Prince",
    "Droit devant soi on ne peut pas aller bien loin. — Le Petit Prince",
    "Fais de ta vie un rêve, et d'un rêve, une réalité. — Antoine de Saint-Exupéry",
    "Ce sont nos choix qui déterminent ce que nous sommes, beaucoup plus que nos aptitudes. — Albus Dumbledore",
    "On peut trouver le bonheur même dans les moments les plus sombres... Il suffit de se souvenir d'allumer la lumière. — Albus Dumbledore",
    "Après tout ce temps ? — Toujours. — Severus Rogue",
    "Je jure solennellement que mes intentions sont mauvaises. — Les Maraudeurs",
    "Que la Force soit avec toi. — Star Wars",
    "Fais-le ou ne le fais pas. Il n'y a pas d'essai. — Maître Yoda",
    "C'est ainsi que la liberté meurt... sous des applaudissements nourris. — Padmé Amidala",
    "J'ai un mauvais pressentiment d'un coup... — Star Wars",
    "Un grand pouvoir implique de grandes responsabilités. — Oncle Ben",
    "Je t'aime plus que trois fois mille. — Avengers",
    "Ce n'est pas le costume qui fait le héros, c'est l'homme à l'intérieur. — Iron Man",
    "Le travail, c'est tout ce qu'on est obligé de faire. Le jeu, c'est tout ce qu'on fait sans y être obligé. — Mark Twain",
    "Pour donner envie à un homme de faire une chose, il suffit de la rendre difficile à obtenir. — Mark Twain",
    "Être ou ne pas être, telle est la question. — William Shakespeare",
    "Demain est un autre jour. — Autant en emporte le vent",
    "Vers l'infini et au-delà ! — Buzz l'Éclair",
    "Les choses que l'on possède finissent par nous posséder. — Fight Club",
    "Pourquoi cet air si sérieux ? — Le Joker",
    "Pas de pierres, pas de construction. Pas de construction, pas de palais. Pas de palais... pas de palais. — Numérobis",
    "C’est une bonne situation, ça, scribe ? — Otis",
    "Au milieu de l'hiver, j'apprenais enfin qu'il y avait en moi un invincible été. — Albert Camus",
    "La vraie générosité envers l'avenir consiste à tout donner au présent. — Albert Camus",
    "Créer, c'est vivre deux fois. — Albert Camus",
    "C'est cela la jeunesse, le droit de se tromper et le devoir de réussir. — Albert Camus",
    "L'automne est un deuxième ressort où chaque feuille est une fleur. — Albert Camus",
    "Changer de mode d'agir, changer de but, jamais. — Victor Hugo",
    "Rien n'est plus puissant qu'une idée dont le temps est venu. — Victor Hugo",
    "Rêver, c'est le bonheur ; attendre, c'est la vie. — Victor Hugo",
    "Plus l'aveuglement est grand, plus le but doit être lumineux. — Victor Hugo",
    "Le rire, c'est le soleil, il chasse l'hiver du visage humain. — Victor Hugo",
    "Aimer, c'est agir. — Victor Hugo",
    "Choisis la pilule rouge et tu restes au Pays des Merveilles. — Matrix",
    "Il n'y a pas de cuillère. — Matrix",
    "Le gras, c'est la vie. — Kaamelott",
    "La joie de vivre, c'est deux hectares de frites. — Kaamelott",
    "Sir, on en a gros ! — Kaamelott",
    "Nom de Zeus ! — Doc Brown",
    "Là où on va, on n'a pas besoin de routes. — Doc Brown",
    "Le gâteau est un mensonge. — Portal",
    "C'est dangereux d'y aller seul ! Prends ceci. — Zelda",
    "J'ai pris une flèche dans le genou. — Skyrim",
    "Loué soit le Soleil ! — Dark Souls",
    "Les ogres, c'est comme les oignons. Ça a des couches. — Shrek",
    "Houston, on a un problème. — Apollo 13",
    "Élémentaire, mon cher Watson. — Sherlock Holmes",
    "Sayonara, baby. — Terminator 2",
    "Pas de panique ! — Le Guide du voyageur galactique",
    "Libérée, délivrée ! — La Reine des Neiges",
    "Hakuna Matata ! Quel magnifique mot ! — Le Roi Lion",
    "Garde tes amis proches, et tes ennemis encore plus proches. — Le Parrain"
];

function joinPath(parts) {
    return GLib.build_filenamev(parts);
}

function getAppletDir(metadata) {
    if (metadata && metadata.path) {
        return metadata.path;
    }
    return joinPath([GLib.get_home_dir(), ".local", "share", "cinnamon", "applets", UUID]);
}

function expandHome(path) {
    if (!path) {
        return path;
    }
    if (path.indexOf("~/") === 0) {
        return GLib.get_home_dir() + path.substring(1);
    }
    return path;
}

function readJsonFile(path) {
    let [ok, data] = GLib.file_get_contents(path);
    if (!ok) {
        throw new Error("Impossible de lire le fichier JSON : " + path);
    }
    return JSON.parse(ByteArray.toString(data));
}

function safeParseJSON(value, fallbackValue) {
    try {
        return JSON.parse(value);
    } catch (e) {
        return fallbackValue;
    }
}

function normalizeClipboardText(text) {
    if (!text) {
        return "";
    }

    text = String(text);
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    if (text.length > CLIPBOARD_TEXT_MAX_CHARS) {
        text = text.substring(0, CLIPBOARD_TEXT_MAX_CHARS);
    }

    return text;
}

function previewClipboardText(text) {
    text = normalizeClipboardText(text).replace(/\s+/g, " " ).trim();
    if (text.length > 90) {
        return text.substring(0, 90) + "…";
    }
    return text;
}


function clampNumber(value, min, max, fallbackValue) {
    value = parseInt(value, 10);
    if (isNaN(value)) {
        value = fallbackValue;
    }
    if (value < min) {
        value = min;
    }
    if (value > max) {
        value = max;
    }
    return value;
}

function nowSeconds() {
    return Math.floor(Date.now() / 1000);
}

function safeString(value) {
    if (value === null || value === undefined) {
        return "";
    }
    return String(value);
}

function clampPercent(value) {
    value = parseInt(value, 10);
    if (isNaN(value)) value = 100;
    if (value < 0) value = 0;
    if (value > 100) value = 100;
    return value;
}

function randomChoice(items) {
    if (!items || items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)];
}

function shuffledCopy(items) {
    let copy = (items || []).slice(0);
    for (let i = copy.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
}

function uniqueCareItems(items) {
    let seen = {};
    let out = [];
    for (let i = 0; i < items.length; i++) {
        let key = items[i].emoji + ':' + items[i].name;
        if (!seen[key]) { seen[key] = true; out.push(items[i]); }
    }
    return out;
}

function clipboardItemText(item) {
    if (typeof item === "string") {
        return item;
    }
    return safeString(item.text);
}

function isLikelyUrl(text) {
    return /^https?:\/\//i.test(text) || /^www\./i.test(text);
}

function isYoutubeUrl(text) {
    return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(text);
}

function isLikelyCode(text) {
    return /\b(function|const|let|var|class|import|return|def|if|else|for|while)\b/.test(text) || /[{};]\s*$/.test(text) || /=>/.test(text);
}

function isLikelyFilePath(text) {
    return /^(\/|~\/|file:\/\/)/.test(text) || /^[A-Za-z]:\\/.test(text);
}

function hasImageExtension(text) {
    let lower = text.toLowerCase().split("?")[0].split("#")[0];
    for (let i = 0; i < IMAGE_EXTENSIONS.length; i++) {
        if (lower.endsWith(IMAGE_EXTENSIONS[i])) {
            return true;
        }
    }
    return false;
}

function detectClipboardKind(text) {
    text = safeString(text).trim();
    if (hasImageExtension(text) && (isLikelyFilePath(text) || isLikelyUrl(text))) {
        return { icon: "📷", label: "image", type: "image" };
    }
    if (isLikelyUrl(text)) {
        return { icon: "🔗", label: "lien", type: "url" };
    }
    if (isLikelyFilePath(text)) {
        return { icon: "📁", label: "chemin", type: "path" };
    }
    if (isLikelyCode(text)) {
        return { icon: "💻", label: "code", type: "code" };
    }
    return { icon: "📄", label: "texte", type: "text" };
}

function makeClipboardEntry(text) {
    text = normalizeClipboardText(text);
    let kind = detectClipboardKind(text);
    return {
        text: text,
        icon: kind.icon,
        kind: kind.type,
        label: kind.label,
        createdAt: nowSeconds()
    };
}

function getXpLevel(xp) {
    xp = parseInt(xp, 10) || 0;
    return Math.floor(Math.sqrt(xp / 20)) + 1;
}

function getEvolutionStage(level, slug) {
    if (slug === "pigeon") {
        if (level >= 10) return "pigeon sage cosmique";
        if (level >= 5) return "pigeon";
        return "bébé pigeon";
    }
    if (level >= 10) return "forme cosmique";
    if (level >= 5) return "forme adulte";
    return "bébé créature";
}

function achievementUnlockedIds(state) {
    let ids = {};
    let quotes = (state.usedQuoteIds || []).length;
    let copies = state.totalCopies || 0;
    let friendship = state.friendshipLevel || 0;
    let xpLevel = getXpLevel(state.xp || 0);

    if (quotes >= 1) ids.first_quote = true;
    if (quotes >= 10) ids.ten_quotes = true;
    if (quotes >= 50) ids.fifty_quotes = true;
    if (copies >= 1) ids.first_copy = true;
    if (copies >= 25) ids.copy_25 = true;
    if (copies >= 100) ids.copy_100 = true;
    if (friendship >= 5) ids.friend_5 = true;
    if (friendship >= 25) ids.friend_25 = true;
    if (friendship >= 50) ids.friend_50 = true;
    if (xpLevel >= 5) ids.level_5 = true;
    if (xpLevel >= 10) ids.level_10 = true;
    return ids;
}

function achievementList(state) {
    let unlocked = achievementUnlockedIds(state);
    let all = [
        ["first_quote", "Première citation", "Lire ta première citation"],
        ["ten_quotes", "Collectionneur", "Lire 10 citations"],
        ["fifty_quotes", "Bibliothèque vivante", "Lire 50 citations"],
        ["first_copy", "Premier souvenir", "Copier ton premier élément"],
        ["copy_25", "Presse-papier fidèle", "Copier 25 éléments"],
        ["copy_100", "Archiviste", "Copier 100 éléments"],
        ["friend_5", "Copain", "Atteindre 5 d’amitié"],
        ["friend_25", "Vrai compagnon", "Atteindre 25 d’amitié"],
        ["friend_50", "Âme liée", "Atteindre 50 d’amitié"],
        ["level_5", "Évolution", "Atteindre le niveau RPG 5"],
        ["level_10", "Créature cosmique", "Atteindre le niveau RPG 10"]
    ];
    let result = [];
    for (let i = 0; i < all.length; i++) {
        result.push({ id: all[i][0], title: all[i][1], description: all[i][2], unlocked: !!unlocked[all[i][0]] });
    }
    return result;
}

function uniqueQuotes(quotes) {
    let seen = {};
    let result = [];
    for (let i = 0; i < quotes.length; i++) {
        if (!quotes[i] || !quotes[i].text || !quotes[i].id) {
            continue;
        }
        if (seen[quotes[i].id]) {
            continue;
        }
        seen[quotes[i].id] = true;
        result.push(quotes[i]);
    }
    return result;
}

function formatText(template, profile, friendshipLevel) {
    let text = String(template);
    let replacements = {
        "{name}": profile.name,
        "{creature}": profile.label.toLowerCase(),
        "{Creature}": profile.label,
        "{category}": profile.categoryLabel.toLowerCase(),
        "{type}": profile.typeLabel.toLowerCase(),
        "{habitat}": profile.habitatLabel.toLowerCase(),
        "{family}": profile.familyLabel.toLowerCase(),
        "{color}": profile.favoriteColor,
        "{country}": profile.country,
        "{birthday}": profile.birthday,
        "{friendship}": String(friendshipLevel)
    };

    let keys = Object.keys(replacements);
    for (let i = 0; i < keys.length; i++) {
        text = text.split(keys[i]).join(replacements[keys[i]]);
    }
    return text;
}

function makeQuoteObjects(key, lines, profile, friendshipLevel) {
    let result = [];
    if (!lines) {
        return result;
    }
    for (let i = 0; i < lines.length; i++) {
        result.push({
            id: key + "-" + i,
            text: formatText(lines[i], profile, friendshipLevel)
        });
    }
    return result;
}

function friendshipTitle(level) {
    if (level >= 50) {
        return "âme liée";
    }
    if (level >= 30) {
        return "complice";
    }
    if (level >= 15) {
        return "compagnon";
    }
    if (level >= 5) {
        return "copain";
    }
    return "curieux";
}

function friendshipHearts(level) {
    let count = 1 + Math.floor(level / 5);
    if (count > 10) {
        count = 10;
    }
    let hearts = [];
    for (let i = 0; i < count; i++) {
        hearts.push("❤");
    }
    return hearts.join(" ");
}

function buildCreatureIndex(library) {
    let index = {};
    let tree = library.tree;
    let categoryKeys = Object.keys(tree);

    for (let c = 0; c < categoryKeys.length; c++) {
        let categoryKey = categoryKeys[c];
        let categoryNode = tree[categoryKey];
        let typeKeys = Object.keys(categoryNode.children);

        for (let t = 0; t < typeKeys.length; t++) {
            let typeKey = typeKeys[t];
            let typeNode = categoryNode.children[typeKey];
            let habitatKeys = Object.keys(typeNode.children);

            for (let h = 0; h < habitatKeys.length; h++) {
                let habitatKey = habitatKeys[h];
                let habitatNode = typeNode.children[habitatKey];
                let familyKeys = Object.keys(habitatNode.children);

                for (let f = 0; f < familyKeys.length; f++) {
                    let familyKey = familyKeys[f];
                    let familyNode = habitatNode.children[familyKey];
                    let creatures = familyNode.creatures || [];

                    for (let i = 0; i < creatures.length; i++) {
                        let creature = creatures[i];
                        index[creature.slug] = {
                            slug: creature.slug,
                            label: creature.label,
                            categoryKey: categoryKey,
                            categoryLabel: categoryNode.label,
                            typeKey: typeKey,
                            typeLabel: typeNode.label,
                            habitatKey: habitatKey,
                            habitatLabel: habitatNode.label,
                            familyKey: familyKey,
                            familyLabel: familyNode.label
                        };
                    }
                }
            }
        }
    }

    return index;
}


function dayKey(date) {
    date = date || new Date();
    let month = String(date.getMonth() + 1);
    let day = String(date.getDate());
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return date.getFullYear() + "-" + month + "-" + day;
}

function formatDateTime(seconds) {
    if (!seconds) return "jamais";
    try {
        return new Date(seconds * 1000).toLocaleString();
    } catch (e) {
        return String(seconds);
    }
}

function addMemoryEvent(state, type, title, text) {
    if (!state.memoryJournal) state.memoryJournal = [];
    let key = type + ":" + title + ":" + dayKey(new Date());
    for (let i = 0; i < state.memoryJournal.length; i++) {
        if (state.memoryJournal[i].key === key) return false;
    }
    state.memoryJournal.unshift({
        key: key,
        type: type,
        title: title,
        text: text,
        createdAt: nowSeconds()
    });
    state.memoryJournal = state.memoryJournal.slice(0, 50);
    return true;
}

function achievementTitleById(id) {
    let list = achievementList({usedQuoteIds:[], totalCopies:0, friendshipLevel:0, xp:0});
    let titles = {
        first_quote: "Première citation",
        ten_quotes: "Collectionneur",
        fifty_quotes: "Bibliothèque vivante",
        first_copy: "Premier souvenir",
        copy_25: "Presse-papier fidèle",
        copy_100: "Archiviste",
        friend_5: "Copain",
        friend_25: "Vrai compagnon",
        friend_50: "Âme liée",
        level_5: "Évolution",
        level_10: "Créature cosmique"
    };
    return titles[id] || id;
}

const PERSONAL_QUOTES = [
    "{name} aime qu'on se souvienne de son anniversaire, le {birthday}.",
    "{name} vient de {country} et il en parle avec beaucoup de fierté.",
    "La couleur préférée de {name}, c'est {color}, et ça se voit dans son regard imaginaire.",
    "Quand l'amitié monte à {friendship}, {name} devient encore plus tendre.",
    "{name} n'est peut-être qu'un {creature}, mais il prend ton affection très au sérieux.",
    "Un panneau est plus chaleureux quand {name} s'y sent aimé.",
    "{name} adore quand tu reviens juste pour lui dire bonjour.",
    "Plus tu me nourris, plus je garde une petite place pour toi dans ma tête.",
    "Je suis un {creature} de {country}, mais mon vrai pays, c'est ton panneau.",
    "Le {birthday}, j'espère au moins une attention en plus."
];

const CATEGORY_QUOTES = {
    "animal": [
        "Les animaux sentent tout de suite les mains patientes.",
        "Un {creature} bien traité garde toujours un peu d'affection en réserve.",
        "Le vivant répond aux gestes simples mieux qu'aux grands discours.",
        "Dans le monde animal, la confiance se gagne clic après clic.",
        "Une créature nourrie avec douceur devient plus expressive.",
        "Même un petit {creature} mérite qu'on lui parle gentiment."
    ],
    "vegetal": [
        "Un végétal grandit mieux dans une ambiance calme.",
        "Les plantes aiment les rythmes réguliers et les petites attentions.",
        "Même enraciné, un {creature} peut avoir du caractère.",
        "Le silence des végétaux n'est jamais un vide, c'est une manière d'écouter.",
        "{name} a beau être un {creature}, il sait reconnaître la tendresse."
    ],
    "champignon": [
        "Les champignons ont l'art d'apparaître là où on ne les attend pas.",
        "Un champignon garde toujours une part de mystère.",
        "Le monde fongique est discret, mais jamais vide.",
        "Un {creature} pousse mieux dans une histoire qu'on prend au sérieux.",
        "{name} préfère les coins doux aux lumières agressives."
    ],
    "non_vivant": [
        "Même les choses immobiles racontent quelque chose à qui fait attention.",
        "Le non-vivant a aussi sa poésie, surtout quand on le regarde longtemps.",
        "Un {creature} peut sembler muet, pourtant il garde une vraie personnalité.",
        "Les objets et les minéraux aiment qu'on leur prête une âme.",
        "{name} n'est pas vivant au sens strict, mais il sait créer de l'attachement."
    ],
    "esprit": [
        "Les esprits se montrent davantage aux gens qui restent doux.",
        "Un esprit bien accueilli devient un compagnon fidèle.",
        "Le monde invisible remarque les gestes constants.",
        "{name} n'apparaît jamais complètement à quelqu'un de pressé.",
        "Les présences légères aiment les endroits où l'amitié dure.",
        "Un esprit se nourrit surtout de mémoire, de calme et d'affection."
    ]
};

const TYPE_QUOTES = {
    "mammifere": [
        "Les mammifères aiment la chaleur, même symbolique.",
        "Un mammifère garde longtemps le souvenir des gestes rassurants."
    ],
    "ovipaire": [
        "Les ovipares ont souvent l'élégance des commencements fragiles.",
        "Un ovipare sait qu'une coquille n'est qu'un premier abri."
    ],
    "arbre": [
        "Un arbre prend son temps, mais n'oublie jamais ce qui le fait tenir.",
        "Les arbres savent rester dignes même dans le vent."
    ],
    "fleur": [
        "Une fleur ne dure pas moins parce qu'elle est délicate.",
        "Les fleurs savent rayonner sans hausser le ton."
    ],
    "plante-potagere": [
        "Une plante potagère aime être utile sans perdre sa grâce.",
        "Le potager apprend la simplicité et la constance."
    ],
    "plante-aromatique": [
        "Les plantes aromatiques laissent toujours une trace subtile.",
        "L'arôme d'un bon souvenir reste plus longtemps qu'on ne croit."
    ],
    "comestible": [
        "Un champignon comestible rappelle que la forêt sait aussi nourrir.",
        "Le comestible n'est pas banal, il est généreux."
    ],
    "forestier": [
        "Le forestier connaît les sols humides et les secrets en silence.",
        "Les habitants des sous-bois préfèrent les pas tranquilles."
    ],
    "fantastique": [
        "Le fantastique n'est crédible qu'avec un peu de douceur.",
        "Les choses étranges deviennent familières quand on les respecte."
    ],
    "objet": [
        "Un objet aimé devient vite plus qu'un simple objet.",
        "Les objets gardent la mémoire des mains qui les choisissent."
    ],
    "mineral": [
        "Le minéral pense lentement, mais très profondément.",
        "La pierre ne parle pas fort, elle dure."
    ],
    "bienveillant": [
        "Les êtres bienveillants répondent surtout à la confiance.",
        "La douceur attire la douceur, même chez les esprits."
    ],
    "nocturne": [
        "Le nocturne n'est pas forcément menaçant, souvent il protège à sa manière.",
        "La nuit laisse entendre des voix qu'on oublie le jour."
    ],
    "ancestral": [
        "L'ancestral aime les promesses tenues.",
        "Ce qui vient de loin respecte les liens qui durent."
    ]
};

const HABITAT_QUOTES = {
    "air": [
        "Ce qui aime l'air cherche toujours un peu d'élan.",
        "L'air apprend à regarder plus loin que le bord du panneau."
    ],
    "terre": [
        "La terre rassure, même les créatures les plus étranges.",
        "Tout ce qui vient de la terre aime un rythme stable."
    ],
    "eau": [
        "L'eau garde les reflets, les secrets et les retours.",
        "Les créatures d'eau savent que la douceur peut être très puissante."
    ],
    "foret": [
        "La forêt préfère les présences calmes.",
        "Un être de forêt juge vite la qualité d'un silence."
    ],
    "nuit": [
        "La nuit agrandit les mystères sans forcément les rendre sombres.",
        "Les créatures de nuit aiment les attentions discrètes."
    ],
    "ombre": [
        "L'ombre n'est pas toujours une absence, parfois c'est une couverture.",
        "Ce qui vit dans l'ombre se montre surtout à ceux qui n'insistent pas."
    ],
    "temple": [
        "Ce qui vient d'un temple respecte la patience.",
        "Les présences de temple aiment les gestes précis."
    ],
    "riviere": [
        "Une présence de rivière pense en courants plus qu'en lignes droites.",
        "La rivière enseigne à revenir sans refaire exactement le même chemin."
    ]
};

const FAMILY_QUOTES = {
    "oiseau": [
        "Les oiseaux savent qu'un bon perchoir vaut mieux qu'une grande promesse.",
        "Un oiseau heureux transforme le moindre rebord en royaume.",
        "Les plumes préfèrent les habitudes tendres.",
        "Un oiseau n'oublie pas la main qui revient sans brusquer."
    ],
    "canide": [
        "Les canidés reconnaissent vite les âmes franches.",
        "Chez les canidés, la loyauté se nourrit de constance."
    ],
    "felin": [
        "Les félins donnent leur confiance par petites permissions.",
        "Un félin observe longtemps avant d'offrir vraiment son affection."
    ],
    "equide": [
        "Les équidés aiment l'élan, mais aussi les repères sûrs.",
        "Un équidé respecte les gestes calmes plus que les gestes rapides."
    ],
    "cetace": [
        "Les cétacés portent de grandes mémoires dans de grands souffles.",
        "Un cétacé pense plus large que l'horizon visible."
    ],
    "poisson": [
        "Les poissons savent suivre les flux sans perdre leur nature.",
        "Un poisson garde son cap même quand la surface s'agite."
    ],
    "feuillu": [
        "Les feuillus savent changer sans cesser d'être eux-mêmes.",
        "Un feuillu connaît la valeur des saisons franches."
    ],
    "jardin": [
        "Une fleur de jardin aime les attentions régulières.",
        "Ce qui pousse au jardin aime qu'on revienne sans tarder."
    ],
    "glisse": [
        "Les choses faites pour rouler aiment qu'on leur laisse de l'élan.",
        "Un objet de glisse rêve toujours d'une ligne propre."
    ],
    "rangement": [
        "Un coffre ou une valise aime ce qu'on lui confie avec soin.",
        "Le rangement n'est pas froid quand il protège quelque chose de précieux."
    ],
    "pierre": [
        "Les pierres savent rester là sans perdre leur dignité.",
        "Une pierre n'est pas immobile par manque d'idée, mais par maîtrise."
    ],
    "fantome": [
        "Les fantômes préfèrent les gens qui n'essaient pas de les posséder.",
        "Un fantôme amical devient plus léger quand on le respecte."
    ],
    "fee": [
        "Une fée se méfie des ordres, pas des gentillesses.",
        "Les fées restent volontiers là où l'émerveillement n'est pas forcé."
    ]
};

const SPECIFIC_QUOTES = {
    "oeil": [
        "Je vois passer les fenêtres, les pixels et les petites habitudes.",
        "Un œil de panneau ne juge pas : il observe avec style.",
        "Je cligne quand l’ordinateur respire.",
        "Donne-moi une pile et je garde un regard stable sur le monde.",
        "Les applets passent, le regard reste.",
        "Je ne dors jamais vraiment, je baisse juste un peu la luminosité.",
        "Un bug croustillant au petit-déjeuner, et me voilà parfaitement éveillé.",
        "Je suis un esprit JavaScript : léger, curieux, et parfois un peu dramatique."
    ],
    "pigeon": [
        "Les graines ne poussent pas dans mon ventre une fois que je les ai mangées.",
        "Un pigeon digne ne marche jamais, il parade.",
        "Je connais mille toits, mais j'aime surtout celui où on me nourrit.",
        "Si je penche la tête, c'est peut-être pour réfléchir. Ou pour avoir l'air plus intelligent.",
        "On critique souvent les pigeons, puis on nous regarde toujours en premier sur une place.",
        "Je ne roucoule pas pour rien, je fais de la gestion émotionnelle.",
        "Un bon pigeonnier, c'est comme une bonne amitié : stable et sans drame inutile.",
        "Je peux reconnaître un visage humain, alors oui, je sais très bien que c'est toi.",
        "Le pain sec, c'est non. L'attention sincère, c'est oui.",
        "Je suis urbain, élégant et légèrement dramatique. Donc parfait.",
        "Un pigeon ne se perd pas, il improvise un itinéraire.",
        "Roberto est peut-être un pigeon, mais Roberto a une réputation à tenir."
    ],
    "chat": [
        "Je ne viens pas quand tu m'appelles, je viens quand l'ambiance mérite ma présence.",
        "Un chat pardonne presque tout, sauf un manque d'esthétique.",
        "La sieste est une philosophie complète.",
        "Le meilleur trône reste toujours celui qu'on n'avait pas prévu."
    ],
    "chien": [
        "Un chien croit encore aux retours joyeux, même après une simple minute.",
        "La loyauté n'est pas un effort, c'est mon style naturel.",
        "Si je remue la queue, c'est un poème entier.",
        "Un chien bien aimé devient une fête portable."
    ],
    "loup": [
        "Le loup écoute le vent avant de décider.",
        "Même seul, un loup garde l'idée de la meute quelque part.",
        "Je respecte les distances, mais je reconnais les vraies présences.",
        "Un loup digne ne crie pas pour exister."
    ],
    "baleine": [
        "Une baleine n'est jamais pressée, elle traverse l'immense avec méthode.",
        "Le souffle d'une baleine vaut parfois mieux qu'un long discours.",
        "Je pense à une échelle où les paniques humaines paraissent minuscules.",
        "Même grande, une baleine peut aimer la douceur."
    ],
    "chene": [
        "Le chêne sait que la force n'a pas besoin d'être nerveuse.",
        "On ne devient pas chêne en voulant aller vite.",
        "J'ai peut-être l'air immobile, mais je travaille en profondeur.",
        "Un chêne ne voit pas le temps comme les gens pressés."
    ],
    "rose": [
        "Une rose ne s'excuse ni pour son parfum ni pour ses épines.",
        "La délicatesse n'exclut pas les limites.",
        "On parle souvent de mes pétales, pas assez de mon courage.",
        "Une rose sait être douce sans devenir floue."
    ],
    "cepe": [
        "Un cèpe digne ne sort pas n'importe où, il choisit sa scène.",
        "La forêt a ses trésors, mais elle ne les donne pas aux gens impatients.",
        "Un cèpe bien né a toujours un petit air de secret."
    ],
    "skateboard": [
        "Un skateboard n'aime pas rester immobile trop longtemps dans sa tête.",
        "La meilleure ligne est celle qu'on ose enfin tenter.",
        "Je suis du bois, des roues et un très bon sens du style.",
        "Le bruit des roues sur le sol, c'est presque une signature."
    ],
    "coffre": [
        "Un coffre bien fermé n'est pas froid, il protège.",
        "Ce que je garde compte souvent plus que ce que je montre.",
        "On ouvre un coffre avec confiance, pas avec arrogance."
    ],
    "galet": [
        "Un galet est une patience polie par l'eau.",
        "Je suis la preuve qu'on peut devenir doux sans devenir fragile.",
        "Même petit, un galet connaît très bien le temps."
    ],
    "fantome": [
        "Je traverse les murs, pas les promesses.",
        "Un fantôme amical préfère les lieux où l'on se souvient gentiment.",
        "Je fais moins peur quand on cesse de confondre présence et menace.",
        "Mon meilleur talent reste d'apparaître au bon moment."
    ],
    "fee": [
        "Une fée ne vient pas pour obéir, mais pour embellir un peu.",
        "Je préfère les surprises fines aux grands effets bruyants.",
        "Le merveilleux s'abîme vite quand on veut l'utiliser comme un outil.",
        "Une fée reste là où l'émerveillement est sincère."
    ]
};

const AnimatedSprite = GObject.registerClass(
class AnimatedSprite extends St.Bin {
    constructor(config) {
        super({ style_class: "creature-animation" });
        this.filePath = config.filePath;
        this.frames = config.frames;
        this.speed = config.speed;
        this.height = config.height;
        this.frame = 0;
        this.timeoutId = 0;
        this._load();
        this.drawingArea = new St.DrawingArea();
        this.drawingArea.set_size(this.frameWidth, this.frameHeight);
        this.drawingArea.connect("repaint", this._onRepaint.bind(this));
        this.set_child(this.drawingArea);
        this._mappedId = this.connect("notify::mapped", () => {
            if (this.mapped) {
                this.play();
            } else {
                this.stop();
            }
        });
        this.connect("destroy", this._onDestroy.bind(this));
        if (this.mapped) {
            this.play();
        }
    }

    _load() {
        let original = GdkPixbuf.Pixbuf.new_from_file(this.filePath);
        if (!original) {
            throw new Error("Image introuvable : " + this.filePath);
        }

        let originalWidth = original.get_width();
        let originalHeight = original.get_height();

        if (this.frames < 1) {
            throw new Error("Nombre de frames invalide.");
        }

        let originalFrameWidth = Math.floor(originalWidth / this.frames);
        if (originalFrameWidth < 1) {
            throw new Error("Frame width invalide.");
        }

        let scaleRatio = this.height / originalHeight;
        let scaledFrameWidth = Math.max(1, Math.round(originalFrameWidth * scaleRatio));
        let scaledTotalWidth = scaledFrameWidth * this.frames;

        let scaled = GdkPixbuf.Pixbuf.new_from_file_at_scale(this.filePath, scaledTotalWidth, this.height, false);
        this.surface = Gdk.cairo_surface_create_from_pixbuf(scaled, 1, null);
        this.frameWidth = Math.round(scaled.get_width() / this.frames);
        this.frameHeight = scaled.get_height();
    }

    play() {
        this.stop();
        this.timeoutId = Mainloop.timeout_add(this.speed, () => {
            this.frame = (this.frame + 1) % this.frames;
            if (this.drawingArea) {
                this.drawingArea.queue_repaint();
            }
            return true;
        });
    }

    stop() {
        if (this.timeoutId > 0) {
            Mainloop.source_remove(this.timeoutId);
            this.timeoutId = 0;
        }
    }

    _onRepaint(area) {
        let cr = null;
        try {
            if (!this.surface || !area) {
                return;
            }
            cr = area.get_context();
            let offset = this.frame * this.frameWidth;
            cr.setSourceSurface(this.surface, -offset, 0);
            if (Cairo && Cairo.Filter && cr.getSource()) {
                cr.getSource().setFilter(Cairo.Filter.BEST);
            }
            if (Cairo && Cairo.Operator) {
                cr.setOperator(Cairo.Operator.SOURCE);
            }
            cr.paint();
        } catch (e) {
            global.logError(UUID + " repaint error: " + e.message);
        } finally {
            if (cr && cr.$dispose) {
                cr.$dispose();
            }
        }
    }

    _onDestroy() {
        this.stop();
        if (this._mappedId) {
            try {
                this.disconnect(this._mappedId);
            } catch (e) {}
            this._mappedId = 0;
        }
        this.drawingArea = null;
        this.surface = null;
    }
});

class CreaturePopupMenu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation, appletInstance) {
        super(launcher, orientation);
        this.appletInstance = appletInstance;
        this.actor.add_style_class_name("creature-menu");
        this.inventoryTab = "clipboard";
        this.feedChoicesVisible = false;
        this.cleanChoicesVisible = false;

        let container = new St.BoxLayout({ style_class: "creature-popup-container" });

        let leftColumn = new St.BoxLayout({ vertical: true, style_class: "creature-main-column" });

        this.inventoryColumn = new St.BoxLayout({ vertical: true, style_class: "creature-inventory-column" });
        this.inventoryTitleLabel = new St.Label({ text: "Inventaire", style_class: "creature-clipboard-title" });
        let tabRow = new St.BoxLayout({ style_class: "creature-inventory-tabs" });
        this.clipboardTabButton = new St.Button({ label: "🗊", style_class: "creature-inventory-tab-button" });
        this.journalTabButton = new St.Button({ label: "🕮", style_class: "creature-inventory-tab-button" });
        this.visualTabButton = new St.Button({ label: "🎨", style_class: "creature-inventory-tab-button" });
        this.musicTabButton = new St.Button({ label: "♬", style_class: "creature-inventory-tab-button" });
        this.clipboardTabButton.connect("clicked", () => { this.inventoryTab = "clipboard"; this.feedChoicesVisible = false; this.cleanChoicesVisible = false; this._refreshInventoryTab(); });
        this.journalTabButton.connect("clicked", () => { this.inventoryTab = "journal"; this.feedChoicesVisible = false; this.cleanChoicesVisible = false; this._refreshInventoryTab(); });
        this.visualTabButton.connect("clicked", () => { this.inventoryTab = "visual"; this.feedChoicesVisible = false; this.cleanChoicesVisible = false; this._refreshInventoryTab(); });
        this.musicTabButton.connect("clicked", () => { this.inventoryTab = "music"; this.feedChoicesVisible = false; this.cleanChoicesVisible = false; this._refreshInventoryTab(); });
        tabRow.add(this.clipboardTabButton);
        tabRow.add(this.journalTabButton);
        tabRow.add(this.visualTabButton);
        tabRow.add(this.musicTabButton);

        this.inventoryContent = new St.BoxLayout({ vertical: true, style_class: "creature-clipboard-list" });
        this.inventoryColumn.add(this.inventoryTitleLabel);
        this.inventoryColumn.add(tabRow);
        this.inventoryColumn.add(this.inventoryContent);

        this.profileFrame = new St.Bin({ style_class: "creature-profile-frame" });
        this.profileIcon = new St.Icon({ style_class: "creature-profile-image", icon_size: 48 });
        this.profileFallbackLabel = new St.Label({ text: "🐦", style_class: "creature-profile-fallback" });
        this.profileFrame.set_child(this.profileFallbackLabel);
        this.titleLabel = new St.Label({ style_class: "creature-title-label" });
        this.subtitleLabel = new St.Label({ style_class: "creature-subtitle-label" });
        this.headerRow = new St.BoxLayout({ style_class: "creature-header-row" });
        this.headerTextColumn = new St.BoxLayout({ vertical: true, style_class: "creature-header-text-column" });
        this.headerTextColumn.add(this.titleLabel);
        this.headerTextColumn.add(this.subtitleLabel);
        this.headerRow.add(this.profileFrame);
        this.headerRow.add(this.headerTextColumn);
        this.friendshipLabel = new St.Label({ style_class: "creature-friendship-label" });
        this.heartsLabel = new St.Label({ style_class: "creature-hearts-label" });
        this.bioLabel = new St.Label({ style_class: "creature-bio-label" });

        this.quoteBox = new St.BoxLayout({ vertical: true, style_class: "creature-quote-scroll" });
        this.quoteLabel = new St.Label({ style_class: "creature-quote-label" });
        let quoteText = this.quoteLabel.get_clutter_text();
        quoteText.set_ellipsize(Pango.EllipsizeMode.NONE);
        quoteText.set_line_wrap(true);
        quoteText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.quoteBox.add(this.quoteLabel);

        this.careStatusLabel = new St.Label({ style_class: "creature-care-status-label" });
        this.statusLabel = new St.Label({ style_class: "creature-status-label" });
        this.rpgLabel = new St.Label({ style_class: "creature-rpg-label" });
        this.moodLabel = new St.Label({ style_class: "creature-mood-label" });
        this.achievementList = new St.BoxLayout({ vertical: true, style_class: "creature-achievement-list" });

        let buttons = new St.BoxLayout({ style_class: "creature-button-row" });
        this.feedButton = new St.Button({ label: "Nourrir", style_class: "creature-feed-button" });
        this.feedButton.connect("clicked", () => this._toggleFeedChoices());
        this.cleanButton = new St.Button({ label: "Nettoyer", style_class: "creature-feed-button" });
        this.cleanButton.connect("clicked", () => this._toggleCleanChoices());
        this.resetButton = new St.Button({ label: "Réinitialiser", style_class: "creature-reset-button" });
        this.resetButton.connect("clicked", () => this.appletInstance.resetFriendshipState());
        this.achievementsButton = new St.Button({ label: "Voir mes succès", style_class: "creature-achievements-button" });
        this.achievementsButton.connect("clicked", () => this.showAchievements());
        buttons.add(this.feedButton);
        buttons.add(this.cleanButton);
        buttons.add(this.resetButton);
        buttons.add(this.achievementsButton);

        leftColumn.add(this.headerRow);
        leftColumn.add(this.friendshipLabel);
        leftColumn.add(this.heartsLabel);
        leftColumn.add(this.bioLabel);
        leftColumn.add(this.quoteBox);
        leftColumn.add(this.careStatusLabel);
        leftColumn.add(this.statusLabel);
        leftColumn.add(this.rpgLabel);
        leftColumn.add(this.moodLabel);
        leftColumn.add(buttons);
        this.careChoicesArea = new St.BoxLayout({ vertical: true, style_class: "creature-care-choice-area" });
        this.feedChoicesBox = new St.BoxLayout({ vertical: true, style_class: "creature-care-choice-box" });
        this.cleanChoicesBox = new St.BoxLayout({ vertical: true, style_class: "creature-care-choice-box" });
        this.careChoicesArea.add(this.feedChoicesBox);
        this.careChoicesArea.add(this.cleanChoicesBox);
        leftColumn.add(this.careChoicesArea);
        this.careChoicesArea.visible = false;
        leftColumn.add(this.achievementList);

        container.add(leftColumn);
        container.add(this.inventoryColumn);
        this.box.add(container);
    }


    _updateProfileImage(profileImagePath, profileImageSize) {
        let size = parseInt(profileImageSize || 48);
        if (!size || size < 24) size = 48;
        if (size > 160) size = 160;
        try {
            this.profileFrame.set_size(size, size);
            this.profileFrame.set_style("width: " + size + "px; height: " + size + "px;");
            this.profileIcon.set_icon_size(size);
        } catch (e) {}
        try {
            let requestedPath = expandHome(profileImagePath || "");
            let fallbackProfile = joinPath([getAppletDir({ uuid: UUID }), "profil_picture", "roberto.png"]);
            let fallbackSprite = joinPath([getAppletDir({ uuid: UUID }), "animations", "roberto.png"]);
            let path = requestedPath || DEFAULT_PROFILE_IMAGE_PATH || fallbackProfile;
            if (!path || !GLib.file_test(path, GLib.FileTest.EXISTS)) path = fallbackProfile;
            if (!path || !GLib.file_test(path, GLib.FileTest.EXISTS)) path = fallbackSprite;
            if (path && GLib.file_test(path, GLib.FileTest.EXISTS)) {
                this.profileIcon.set_gicon(new Gio.FileIcon({ file: Gio.File.new_for_path(path) }));
                this.profileFrame.set_child(this.profileIcon);
            } else {
                this.profileFrame.set_child(this.profileFallbackLabel);
            }
        } catch (e) {
            this.profileFrame.set_child(this.profileFallbackLabel);
        }
    }

    updateView(data) {
        this._lastData = data;
        this.titleLabel.set_text(data.title);
        this.subtitleLabel.set_text(data.subtitle);
        this.friendshipLabel.set_text(data.friendship);
        this.heartsLabel.set_text(data.hearts);
        this._updateProfileImage(data.profileImagePath || DEFAULT_PROFILE_IMAGE_PATH, data.profileImageSize || 48);
        this.bioLabel.set_text(data.bio);
        this.quoteLabel.set_text(data.quote);
        this.careStatusLabel.set_text(data.careStatus || "");
        this.statusLabel.set_text(data.status);
        this.rpgLabel.visible = !!data.rpg;
        this.rpgLabel.set_text(data.rpg || "");
        this.moodLabel.visible = !!data.mood;
        this.moodLabel.set_text(data.mood || "");
        if (data.labels) {
            this.inventoryTitleLabel.set_text(data.labels.inventory || "Inventaire");
            this.feedButton.set_label(data.labels.feed || "Nourrir");
            this.cleanButton.set_label(data.labels.clean || "Nettoyer");
            this.resetButton.set_label(data.labels.reset || "Réinitialiser");
            this.achievementsButton.set_label(data.labels.achievements || "Voir mes succès");
        }
        this.achievementsButton.visible = !!data.achievementsEnabled;
        this._lastAchievements = data.achievements || [];
        this.achievementList.visible = false;

        this.inventoryColumn.visible = true;
        this._clipboardSmartDetection = data.clipboardSmartDetection;
        this._clipboardImagePreview = data.clipboardImagePreview;
        this._refreshInventoryTab();
        this._refreshCareChoices();
    }

    _toggleFeedChoices() {
        this.feedChoicesVisible = !this.feedChoicesVisible;
        this.cleanChoicesVisible = false;
        this._refreshCareChoices();
    }

    _toggleCleanChoices() {
        this.cleanChoicesVisible = !this.cleanChoicesVisible;
        this.feedChoicesVisible = false;
        this._refreshCareChoices();
    }

    _addCareChoiceGrid(parentBox, choices, callback) {
        // Les menus Cinnamon peuvent mal recalculer la taille si une seule ligne
        // devient trop large. On découpe donc en petites lignes stables.
        let perRow = 6;
        let row = null;
        for (let i = 0; i < choices.length; i++) {
            if (i % perRow === 0) {
                row = new St.BoxLayout({ style_class: "creature-care-choice-row" });
                parentBox.add(row);
            }
            let item = choices[i];
            let b = new St.Button({ label: item.emoji, style_class: "creature-care-emoji-button" });
            b.connect("clicked", () => callback(item));
            row.add(b);
        }
    }

    _refreshCareChoices() {
        let data = this._lastData || {};
        if (!this.feedChoicesBox || !this.cleanChoicesBox) return;
        this.feedChoicesBox.remove_all_children();
        this.cleanChoicesBox.remove_all_children();
        let showChoices = !!(this.feedChoicesVisible || this.cleanChoicesVisible);
        this.feedChoicesBox.visible = !!this.feedChoicesVisible;
        this.cleanChoicesBox.visible = !!this.cleanChoicesVisible;
        if (this.careChoicesArea) this.careChoicesArea.visible = showChoices;

        if (this.feedChoicesVisible) {
            this.feedChoicesBox.add(new St.Label({ text: (data.labels ? data.labels.chooseFood : "Choisis une nourriture :"), style_class: "creature-clipboard-empty" }));
            this._addCareChoiceGrid(this.feedChoicesBox, data.feedChoices || [], (item) => {
                this.appletInstance.feedCreatureWithItem(item);
                this.feedChoicesVisible = false;
                this._refreshCareChoices();
            });
        }
        if (this.cleanChoicesVisible) {
            this.cleanChoicesBox.add(new St.Label({ text: (data.labels ? data.labels.chooseClean : "Choisis avec quoi nettoyer :"), style_class: "creature-clipboard-empty" }));
            this._addCareChoiceGrid(this.cleanChoicesBox, data.cleanChoices || [], (item) => {
                this.appletInstance.cleanCreatureWithItem(item);
                this.cleanChoicesVisible = false;
                this._refreshCareChoices();
            });
        }

        // Force Cinnamon à recalculer le layout après ouverture/fermeture dynamique.
        try {
            this.careChoicesArea.queue_relayout();
            this.actor.queue_relayout();
            this.box.queue_relayout();
        } catch (e) {}
    }

    showAchievements() {
        this.achievementList.remove_all_children();
        let items = this._lastAchievements || [];
        let shown = 0;
        for (let i = 0; i < items.length; i++) {
            if (!items[i].unlocked) continue;
            shown++;
            let label = new St.Label({
                text: "🏆 " + items[i].title + "\n" + items[i].description,
                style_class: "creature-achievement-unlocked"
            });
            let clutterText = label.get_clutter_text();
            clutterText.set_line_wrap(true);
            clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            this.achievementList.add(label);
        }
        if (shown === 0) {
            this.achievementList.add(new St.Label({ text: ((this._lastData && this._lastData.labels) ? this._lastData.labels.noAchievements : "Aucun succès débloqué pour l’instant."), style_class: "creature-achievement-unlocked" }));
        }
        this.achievementList.visible = !this.achievementList.visible;
    }

    _refreshInventoryTab() {
        let data = this._lastData || {};
        if (this.inventoryTab === "journal" && !data.memoryJournalEnabled) this.inventoryTab = "visual";
        this.feedChoicesVisible = false;
        this.cleanChoicesVisible = false;
        if (this.inventoryTab === "clipboard" && !data.clipboardEnabled) this.inventoryTab = data.memoryJournalEnabled ? "journal" : "visual";
        this.inventoryContent.remove_all_children();
        this.clipboardTabButton.visible = !!data.clipboardEnabled;
        this.journalTabButton.visible = !!data.memoryJournalEnabled;
        this.visualTabButton.visible = true;
        this.musicTabButton.visible = true;
        if (this.inventoryTab === "journal") this._rebuildJournalList(data.memoryItems || []);
        else if (this.inventoryTab === "visual") this._rebuildVisualList();
        else if (this.inventoryTab === "music") this._rebuildMusicList(data.playlistItems || []);
        else this._rebuildClipboardList(data.clipboardItems || []);
    }

    _rebuildJournalList(items) {
        if (items.length === 0) {
            this.inventoryContent.add(new St.Label({ text: (data.labels ? data.labels.journalEmpty : "🕮 Le journal est encore vide."), style_class: "creature-clipboard-empty" }));
            return;
        }
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let row = new St.BoxLayout({ vertical: true, style_class: "creature-clipboard-item" });
            let label = new St.Label({ text: "📖 " + item.title + "\n" + item.text, style_class: "creature-clipboard-text" });
            let clutterText = label.get_clutter_text();
            clutterText.set_line_wrap(true);
            clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            row.add(label);
            this.inventoryContent.add(row);
        }
    }

    _rebuildVisualList() {
        this.inventoryContent.add(new St.Label({ text: (this._lastData && this._lastData.labels ? this._lastData.labels.visualTitle : "🎨 Visuel"), style_class: "creature-clipboard-empty" }));
        this.inventoryContent.add(new St.Label({ text: (this._lastData && this._lastData.labels ? this._lastData.labels.emojiBank : "☺︎ Banque d’émojis"), style_class: "creature-clipboard-empty" }));
        this._addCopyBank((this._lastData && this._lastData.emojiBank) ? this._lastData.emojiBank : EMOJI_BANK);
        this.inventoryContent.add(new St.Label({ text: (this._lastData && this._lastData.labels ? this._lastData.labels.mathSymbols : "Σ Symboles grecs/math"), style_class: "creature-clipboard-empty" }));
        this._addCopyBank((this._lastData && this._lastData.symbolBank) ? this._lastData.symbolBank : MATH_SYMBOL_BANK);
    }

    _addCopyBank(items) {
        // Banques emoji/symboles : lignes courtes pour ne jamais dépasser à droite
        // dans la colonne d'inventaire, même avec des thèmes Cinnamon larges.
        let perRow = 5;
        let row = null;
        for (let i = 0; i < items.length; i++) {
            if (i % perRow === 0) {
                row = new St.BoxLayout({ style_class: "creature-bank-row" });
                this.inventoryContent.add(row);
            }
            let value = items[i];
            let b = new St.Button({ label: value, style_class: "creature-bank-button" });
            b.connect("clicked", () => this.appletInstance.copyClipboardItem(value));
            row.add(b);
        }
    }

    _rebuildTreasureList(items) {
        if (!items || items.length === 0) {
            this.inventoryContent.add(new St.Label({ text: (this._lastData && this._lastData.labels ? this._lastData.labels.noTreasure : "💎 Aucun trésor pour l’instant."), style_class: "creature-clipboard-empty" }));
            return;
        }
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let row = new St.BoxLayout({ vertical: true, style_class: "creature-clipboard-item" });
            let text = (item.emoji || "💎") + " " + (item.text || item.name || (this._lastData && this._lastData.labels ? this._lastData.labels.treasureFallback : "trésor"));
            row.add(new St.Label({ text: text, style_class: "creature-clipboard-text" }));
            let copyButton = new St.Button({ label: (this._lastData && this._lastData.labels ? this._lastData.labels.copy : "Copier"), style_class: "creature-clipboard-copy-button" });
            copyButton.connect("clicked", () => this.appletInstance.copyClipboardItem(text));
            row.add(copyButton);
            this.inventoryContent.add(row);
        }
    }

    _rebuildMusicList(items) {
        this.inventoryContent.add(new St.Label({ text: (this._lastData && this._lastData.labels ? this._lastData.labels.studyPlaylist : "♬ Playlist pour étudier"), style_class: "creature-clipboard-empty" }));
        let row = new St.BoxLayout({ vertical: true, style_class: "creature-clipboard-item" });
        row.add(new St.Label({ text: DEFAULT_STUDY_PLAYLIST, style_class: "creature-clipboard-text" }));
        let copyButton = new St.Button({ label: (this._lastData && this._lastData.labels ? this._lastData.labels.copy : "Copier"), style_class: "creature-clipboard-copy-button" });
        copyButton.connect("clicked", () => this.appletInstance.copyClipboardItem(DEFAULT_STUDY_PLAYLIST));
        row.add(copyButton);
        this.inventoryContent.add(row);
        if (items && items.length > 0) {
            for (let i = 0; i < items.length; i++) {
                let r = new St.BoxLayout({ vertical: true, style_class: "creature-clipboard-item" });
                r.add(new St.Label({ text: items[i], style_class: "creature-clipboard-text" }));
                this.inventoryContent.add(r);
            }
        }
    }

    _rebuildClipboardList(items) {
        let clearButton = new St.Button({ label: (this._lastData && this._lastData.labels ? this._lastData.labels.clearClipboard : "💣 Vider le presse-papier"), style_class: "creature-clipboard-copy-button" });
        clearButton.connect("clicked", () => this.appletInstance.clearClipboardHistory());
        this.inventoryContent.add(clearButton);
        if (items.length === 0) {
            this.inventoryContent.add(new St.Label({ text: (this._lastData && this._lastData.labels ? this._lastData.labels.clipboardEmpty : "Rien copié pour l’instant."), style_class: "creature-clipboard-empty" }));
            return;
        }
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let text = clipboardItemText(item);
            let meta = detectClipboardKind(text);
            if (typeof item === "object" && item.icon) { meta.icon = item.icon; meta.label = item.label || meta.label; meta.type = item.kind || meta.type; }
            let row = new St.BoxLayout({ vertical: true, style_class: "creature-clipboard-item" });
            let label = new St.Label({
                text: (i + 1) + ". " + (this._clipboardSmartDetection ? meta.icon + " " : "") + previewClipboardText(text),
                style_class: "creature-clipboard-text"
            });
            let clutterText = label.get_clutter_text();
            clutterText.set_ellipsize(Pango.EllipsizeMode.NONE);
            clutterText.set_line_wrap(true);
            clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
            row.add(label);

            /*
             * Image previews have been disabled.  The applet no longer loads
             * local images referenced in clipboard entries because this can
             * cause errors in certain environments and adds overhead to the
             * panel.  The code that previously loaded thumbnails has been
             * removed.  If you wish to re-enable this behaviour, see the
             * previous revisions of this file where a St.TextureCache preview
             * was added when meta.type === "image" and isLikelyFilePath(text).
             */

            let copyButton = new St.Button({ label: (this._lastData && this._lastData.labels ? this._lastData.labels.copy : "Copier"), style_class: "creature-clipboard-copy-button" });
            copyButton.connect("clicked", () => this.appletInstance.copyClipboardItem(text));
            row.add(copyButton);
            this.inventoryContent.add(row);
        }
    }
}

class CreatureApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);

        this.metadata = metadata;
        this.uuid = metadata.uuid;
        this.instanceId = instanceId;
        this.panelHeight = panelHeight;
        this.appletDir = getAppletDir(metadata);
        try {
            this.library = readJsonFile(joinPath([this.appletDir, "creature-library.json"]));
        } catch (e) {
            global.logError(UUID + " creature-library load error: " + e.message);
            this.library = { default_slug: "pigeon", tree: { animal: { label: "Animal", children: { oiseau: { label: "Oiseau", children: { ville: { label: "Ville", children: { columbide: { label: "Columbidé", creatures: [{ slug: "pigeon", label: "Pigeon" }] } } } } } } } } };
        }
        this.creatureIndex = buildCreatureIndex(this.library);
        this.settingsData = {};
        this.animationBuildIdleId = 0;

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.actor.add_style_class_name("creature-applet");

        this.settings = new Settings.AppletSettings(this.settingsData, this.uuid, this.instanceId);

        this.settings.bind("keyCreatureName", "creatureName", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyProfileImagePath", "profileImagePath", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyProfileImageSize", "profileImageSize", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyLanguage", "language", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyFavoriteColor", "favoriteColor", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyCountry", "country", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyFrames", "frames", this._onAnimationSettingsChanged.bind(this));
        this.settings.bind("keyPausePerFrameInSeconds", "pausePerFrameInSeconds", this._onAnimationSettingsChanged.bind(this));
        this.settings.bind("keyClipboardEnabled", "clipboardEnabled", this._onClipboardSettingsChanged.bind(this));
        this.settings.bind("keyClipboardLimit", "clipboardLimit", this._onClipboardSettingsChanged.bind(this));
        this.settings.bind("keyAchievementsEnabled", "achievementsEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyMoodEnabled", "moodEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keySmartClipboardDetection", "smartClipboardDetection", this._onFeatureSettingsChanged.bind(this));
        /*
         * The clipboard image preview feature has been removed.  Previously the applet
         * would attempt to load a thumbnail when the copied text looked like a local
         * image file path.  This caused stability issues on some Cinnamon versions
         * and has been disabled.  Leaving the binding in place would throw an error
         * because the corresponding key no longer exists in the settings schema.
         */
        // this.settings.bind("keyClipboardImagePreview", "clipboardImagePreview", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyContextualClipboardQuotes", "contextualClipboardQuotes", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyRpgEnabled", "rpgEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keySystemReactionsEnabled", "systemReactionsEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keySystemNotificationsEnabled", "systemNotificationsEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyFeedCooldownEnabled", "feedCooldownEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyFeedCooldownHours", "feedCooldownHours", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyDailyCareMoodEnabled", "dailyCareMoodEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyMemoryJournalEnabled", "memoryJournalEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyBirthdayDay", "birthdayDay", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyBirthdayMonth", "birthdayMonth", this._onCreatureSettingsChanged.bind(this));
        this.settings.bind("keyHolidayMessagesEnabled", "holidayMessagesEnabled", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyEmojiBankCount", "emojiBankCount", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keySymbolBankCount", "symbolBankCount", this._onFeatureSettingsChanged.bind(this));
        this.settings.bind("keyFriendshipIcon", "friendshipIcon", this._onFeatureSettingsChanged.bind(this));
        for (let i = 1; i <= 25; i++) {
            this.settings.bind("keyEmojiBank" + i, "emojiBank" + i, this._onFeatureSettingsChanged.bind(this));
            this.settings.bind("keySymbolBank" + i, "symbolBank" + i, this._onFeatureSettingsChanged.bind(this));
        }

        this.settings.connect("changed::keyCreatureSlug", () => {
            this.settingsData.creatureSlug = this.settings.getValue("keyCreatureSlug");
            this._onCreatureSettingsChanged();
        });

        this.settings.connect("changed::keyImagePath", () => {
            this.settingsData.imagePath = this.settings.getValue("keyImagePath");
            this._onAnimationSettingsChanged();
        });

        this.settings.connect("changed::keyPanelDisplayMode", () => {
            this.settingsData.panelDisplayMode = this.settings.getValue("keyPanelDisplayMode") || "sprite";
            this._onAnimationSettingsChanged();
        });

        this.settings.connect("changed::keyEmbeddedAppletUuid", () => {
            this.settingsData.embeddedAppletUuid = this.settings.getValue("keyEmbeddedAppletUuid") || "c-eyes@anaximeno";
            this._onAnimationSettingsChanged();
        });

        this.settings.connect("changed::keyEmbeddedSlotWidth", () => {
            this.settingsData.embeddedSlotWidth = this.settings.getValue("keyEmbeddedSlotWidth") || 48;
            this._onAnimationSettingsChanged();
        });

        this.settings.connect("changed::keyEmbeddedClickPriority", () => {
            this.settingsData.embeddedClickPriority = this.settings.getValue("keyEmbeddedClickPriority");
            this._onAnimationSettingsChanged();
        });

        this.settings.connect("changed::keyProfileImagePath", () => {
            this.settingsData.profileImagePath = this.settings.getValue("keyProfileImagePath") || DEFAULT_PROFILE_IMAGE_PATH;
            this._onCreatureSettingsChanged();
        });

        this.settings.connect("changed::keyLanguage", () => {
            this.settingsData.language = this.settings.getValue("keyLanguage") || "fr";
            this._onCreatureSettingsChanged();
        });

        this.settingsData.creatureSlug = this.settings.getValue("keyCreatureSlug");
        this.settingsData.imagePath = this.settings.getValue("keyImagePath");
        this.settingsData.profileImagePath = this.settings.getValue("keyProfileImagePath") || DEFAULT_PROFILE_IMAGE_PATH;
        this.settingsData.profileImageSize = this.settings.getValue("keyProfileImageSize") || 48;
        this.settingsData.language = this.settings.getValue("keyLanguage") || "fr";
        this.settingsData.panelDisplayMode = this.settings.getValue("keyPanelDisplayMode") || "sprite";
        this.settingsData.embeddedAppletUuid = this.settings.getValue("keyEmbeddedAppletUuid") || "c-eyes@anaximeno";
        this.settingsData.embeddedSlotWidth = this.settings.getValue("keyEmbeddedSlotWidth") || 48;
        this.settingsData.embeddedClickPriority = this.settings.getValue("keyEmbeddedClickPriority");
        if (this.settingsData.embeddedClickPriority === undefined || this.settingsData.embeddedClickPriority === null) this.settingsData.embeddedClickPriority = true;
        this.lastSeenClipboardText = "";
        this.embeddedApplet = null;
        this.embeddedPlaceholder = null;
        this.embeddedRetryId = 0;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new CreaturePopupMenu(this, orientation, this);
        this.menuManager.addMenu(this.menu);

        this._loadState();
        this._syncCreatureIdentity();
        this._ensureFirstEncounterMemory();
        this._checkMemoryDateEvents();
        this._scheduleBuildAnimation();
        this._startClipboardWatcher();
        this._startSystemWatcher();
        this._refreshUi();
    }

    on_applet_clicked() {
        this._refreshUi();
        this.menu.toggle();
    }

    on_panel_height_changed() {
        this.panelHeight = this._panelHeight;
        this._scheduleBuildAnimation();
    }

    on_applet_removed_from_panel() {
        if (this.animationBuildIdleId > 0) {
            Mainloop.source_remove(this.animationBuildIdleId);
            this.animationBuildIdleId = 0;
        }
        this._restoreEmbeddedApplet();
        if (this.embeddedRetryId > 0) {
            Mainloop.source_remove(this.embeddedRetryId);
            this.embeddedRetryId = 0;
        }
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
        this._stopClipboardWatcher();
        this._stopSystemWatcher();

        if (this.menu) {
            this.menu.destroy();
            this.menu = null;
        }
    }

    resetFriendshipState() {
        let currentSlug = this._currentCreature().slug;
        this.state = {
            friendshipLevel: 0,
            feedCount: 0,
            usedQuoteIds: [],
            fallbackRepeatsLeft: LOVE_MESSAGE_REPEATS,
            lastMessage: "",
            lastCreatureSlug: currentSlug,
            clipboardHistory: this.state && this.state.clipboardHistory ? this.state.clipboardHistory : [],
            totalCopies: this.state && this.state.totalCopies ? this.state.totalCopies : 0,
            xp: 0,
            unlockedAchievements: [],
            lastInteractionAt: nowSeconds(),
            lastSystemEvent: "",
            lastFedAt: 0,
            lastFedDay: "",
            firstEncounterAt: this.state && this.state.firstEncounterAt ? this.state.firstEncounterAt : nowSeconds(),
            memoryJournal: this.state && this.state.memoryJournal ? this.state.memoryJournal : [],
            lastHolidayKey: this.state && this.state.lastHolidayKey ? this.state.lastHolidayKey : "",
            hunger: 100,
            cleanliness: 100,
            lastCareDecayAt: nowSeconds(),
            treasures: this.state && this.state.treasures ? this.state.treasures : [],
            playlists: this.state && this.state.playlists ? this.state.playlists : []
        };
        this._saveState();
        this._refreshUi();
    }

    feedCreature() {
        this._syncCreatureIdentity();
        this._checkMemoryDateEvents();
        if (this.menu) {
            this.menu.feedChoicesVisible = true;
            this.menu.cleanChoicesVisible = false;
            this.menu._refreshCareChoices();
        }
    }

    feedCreatureWithItem(item) {
        this._syncCreatureIdentity();
        this._decayCareStats();
        item = item || {};
        let profile = this._currentProfile();

        if (!item.compatible) {
            let bad = (item.emoji || "❓") + " " + (item.name || "objet");
            let message = _formatTemplate(this._t("badFood", "{item} ne nourrit pas {name}."), { item: this._translateItem({name: bad}).name || bad, name: profile.name });
            this.state.lastMessage = message;
            this.state.lastInteractionAt = nowSeconds();
            if (this._systemNotificationsEnabled()) this._notify(this._t("refusedTitle", "Repas refusé"), message);
            this._saveState();
            this._refreshUi();
            return;
        }

        if (!this._canFeedNow()) {
            let message = this._feedWaitText();
            this.state.lastMessage = message;
            this.state.lastInteractionAt = nowSeconds();
            if (this._systemNotificationsEnabled()) this._notify(this._t("notHungryTitle", "Je n’ai pas faim"), message);
            this._saveState();
            this._refreshUi();
            return;
        }

        this.state.feedCount += 1;
        this.state.friendshipLevel += 1;
        this.state.xp = (this.state.xp || 0) + XP_PER_FEED;
        this.state.hunger = 100;
        this.state.lastInteractionAt = nowSeconds();
        this.state.lastFedAt = nowSeconds();
        this.state.lastFedDay = dayKey(new Date());

        let reactionText = this._reactionVariant(FOOD_REACTION_VARIANTS, item, item.reaction || "Merci pour le repas !");
        let reaction = (item.emoji || "🍽") + " " + reactionText;
        let quote = this._nextQuote(profile);
        this.state.lastMessage = reaction + "\n\n" + quote;
        if (this._systemNotificationsEnabled()) this._notify(this._t("feedTitle", "Repas"), reaction);
        if (this._memoryJournalEnabled() && this.state.feedCount === 1) {
            addMemoryEvent(this.state, "first-food", "Première nourriture", "Je me rappelle de ta première nourriture : " + (item.emoji || "") + " " + (item.name || "repas") + ".");
        }
        this._checkAchievements();
        this._saveState();
        this._refreshUi();
    }

    cleanCreatureWithItem(item) {
        this._syncCreatureIdentity();
        this._decayCareStats();
        item = item || {};
        let delta = parseInt(item.clean, 10);
        if (isNaN(delta)) delta = 0;
        this.state.cleanliness = clampPercent((this.state.cleanliness === undefined ? 100 : this.state.cleanliness) + delta);
        this.state.lastInteractionAt = nowSeconds();
        if (delta > 0) this.state.friendshipLevel += 1;
        let title = delta > 0 ? "Nettoyage" : (delta < 0 ? "Aïe…" : "Nettoyage inutile");
        let reactionText = this._reactionVariant(CLEANING_REACTION_VARIANTS, item, item.reaction || "Je ne sais pas quoi en penser.");
        let reaction = (item.emoji || "🧽") + " " + reactionText;
        this.state.lastMessage = reaction;
        if (this._systemNotificationsEnabled()) this._notify(title, reaction);
        this._checkAchievements();
        this._saveState();
        this._refreshUi();
    }

    showAchievements() {
        if (this.menu && this.menu.showAchievements) {
            this.menu.showAchievements();
        }
    }

    _loadState() {
        this.state = {
            friendshipLevel: this.settings.getValue("keyFriendshipLevel") || 0,
            feedCount: this.settings.getValue("keyFeedCount") || 0,
            usedQuoteIds: safeParseJSON(this.settings.getValue("keyUsedQuoteIds") || "[]", []),
            fallbackRepeatsLeft: this.settings.getValue("keyFallbackRepeatsLeft"),
            lastMessage: this.settings.getValue("keyLastMessage") || "",
            lastCreatureSlug: this.settings.getValue("keyLastCreatureSlug") || this.library.default_slug,
            clipboardHistory: safeParseJSON(this.settings.getValue("keyClipboardHistory") || "[]", []),
            totalCopies: this.settings.getValue("keyTotalCopies") || 0,
            xp: this.settings.getValue("keyXp") || 0,
            unlockedAchievements: safeParseJSON(this.settings.getValue("keyUnlockedAchievements") || "[]", []),
            lastInteractionAt: this.settings.getValue("keyLastInteractionAt") || nowSeconds(),
            lastSystemEvent: this.settings.getValue("keyLastSystemEvent") || "",
            lastFedAt: this.settings.getValue("keyLastFedAt") || 0,
            lastFedDay: this.settings.getValue("keyLastFedDay") || "",
            firstEncounterAt: this.settings.getValue("keyFirstEncounterAt") || 0,
            memoryJournal: safeParseJSON(this.settings.getValue("keyMemoryJournal") || "[]", []),
            lastHolidayKey: this.settings.getValue("keyLastHolidayKey") || "",
            hunger: this.settings.getValue("keyHunger"),
            cleanliness: this.settings.getValue("keyCleanliness"),
            lastCareDecayAt: this.settings.getValue("keyLastCareDecayAt") || nowSeconds(),
            treasures: safeParseJSON(this.settings.getValue("keyTreasures") || "[]", []),
            playlists: safeParseJSON(this.settings.getValue("keyPlaylists") || "[]", [])
        };

        if (typeof this.state.fallbackRepeatsLeft !== "number") {
            this.state.fallbackRepeatsLeft = LOVE_MESSAGE_REPEATS;
        }
        let migrated = [];
        for (let i = 0; i < (this.state.clipboardHistory || []).length; i++) {
            let item = this.state.clipboardHistory[i];
            migrated.push(typeof item === "string" ? makeClipboardEntry(item) : item);
        }
        this.state.clipboardHistory = migrated;
        this.state.hunger = clampPercent(this.state.hunger === undefined || this.state.hunger === null ? 100 : this.state.hunger);
        this.state.cleanliness = clampPercent(this.state.cleanliness === undefined || this.state.cleanliness === null ? 100 : this.state.cleanliness);
        this._decayCareStats();
    }

    _saveState() {
        this.settings.setValue("keyFriendshipLevel", this.state.friendshipLevel);
        this.settings.setValue("keyFeedCount", this.state.feedCount);
        this.settings.setValue("keyUsedQuoteIds", JSON.stringify(this.state.usedQuoteIds));
        this.settings.setValue("keyFallbackRepeatsLeft", this.state.fallbackRepeatsLeft);
        this.settings.setValue("keyLastMessage", this.state.lastMessage);
        this.settings.setValue("keyLastCreatureSlug", this.state.lastCreatureSlug);
        this.settings.setValue("keyClipboardHistory", JSON.stringify(this.state.clipboardHistory || []));
        this.settings.setValue("keyTotalCopies", this.state.totalCopies || 0);
        this.settings.setValue("keyXp", this.state.xp || 0);
        this.settings.setValue("keyUnlockedAchievements", JSON.stringify(this.state.unlockedAchievements || []));
        this.settings.setValue("keyLastInteractionAt", this.state.lastInteractionAt || nowSeconds());
        this.settings.setValue("keyLastSystemEvent", this.state.lastSystemEvent || "");
        this.settings.setValue("keyLastFedAt", this.state.lastFedAt || 0);
        this.settings.setValue("keyLastFedDay", this.state.lastFedDay || "");
        this.settings.setValue("keyFirstEncounterAt", this.state.firstEncounterAt || 0);
        this.settings.setValue("keyMemoryJournal", JSON.stringify(this.state.memoryJournal || []));
        this.settings.setValue("keyLastHolidayKey", this.state.lastHolidayKey || "");
        this.settings.setValue("keyHunger", this.state.hunger === undefined ? 100 : this.state.hunger);
        this.settings.setValue("keyCleanliness", this.state.cleanliness === undefined ? 100 : this.state.cleanliness);
        this.settings.setValue("keyLastCareDecayAt", this.state.lastCareDecayAt || nowSeconds());
        this.settings.setValue("keyTreasures", JSON.stringify(this.state.treasures || []));
        this.settings.setValue("keyPlaylists", JSON.stringify(this.state.playlists || []));
    }

    _syncCreatureIdentity() {
        let currentSlug = this._currentCreature().slug;
        if (this.state.lastCreatureSlug !== currentSlug) {
            this.state.friendshipLevel = 0;
            this.state.feedCount = 0;
            this.state.usedQuoteIds = [];
            this.state.fallbackRepeatsLeft = LOVE_MESSAGE_REPEATS;
            this.state.lastMessage = "";
            this.state.lastCreatureSlug = currentSlug;
            this._saveState();
        }
    }

    _currentCreature() {
        let slug = this.settingsData.creatureSlug || this.library.default_slug;
        return this.creatureIndex[slug] || this.creatureIndex[this.library.default_slug];
    }

    _currentProfile() {
        let creature = this._currentCreature();
        let name = (this.settingsData.creatureName || "").trim();
        if (name === "") {
            name = creature.label;
        }

        return {
            slug: creature.slug,
            label: creature.label,
            name: name,
            categoryKey: creature.categoryKey,
            categoryLabel: creature.categoryLabel,
            typeKey: creature.typeKey,
            typeLabel: creature.typeLabel,
            habitatKey: creature.habitatKey,
            habitatLabel: creature.habitatLabel,
            familyKey: creature.familyKey,
            familyLabel: creature.familyLabel,
            birthday: this._birthdayText(),
            favoriteColor: this._favoriteColorText(),
            country: (this.settingsData.country || (this._languageCode() === "en" ? "Italy" : "Italie")).trim()
        };
    }


    _birthdayText() {
        let day = parseInt(this.settingsData.birthdayDay, 10) || 21;
        let month = parseInt(this.settingsData.birthdayMonth, 10) || 4;
        let fr = ["", "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
        let en = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        let names = this._languageCode && this._languageCode() === "en" ? en : fr;
        return day + " " + (names[month] || names[4]);
    }

    _favoriteColorText() {
        let value = this.settingsData.favoriteColor || "vert";
        if (this._languageCode && this._languageCode() === "en") {
            let colors = {
                "vert": "green", "bleu": "blue", "rouge": "red", "jaune": "yellow",
                "violet": "purple", "rose": "pink", "orange": "orange", "turquoise": "turquoise",
                "blanc": "white", "noir": "black", "gris": "gray", "marron": "brown"
            };
            return colors[value] || value;
        }
        return value;
    }

    _friendshipTitleText(level) {
        if (this._languageCode && this._languageCode() === "en") {
            if (level >= 50) return "linked soul";
            if (level >= 30) return "partner";
            if (level >= 15) return "companion";
            if (level >= 5) return "buddy";
            return "curious";
        }
        return friendshipTitle(level);
    }

    _evolutionStageText(level, slug) {
        let stage = getEvolutionStage(level, slug);
        if (this._languageCode && this._languageCode() === "en") {
            let map = {
                "pigeon sage cosmique": "cosmic wise pigeon",
                "pigeon": "pigeon",
                "bébé pigeon": "baby pigeon",
                "forme cosmique": "cosmic form",
                "forme adulte": "adult form",
                "bébé créature": "baby creature"
            };
            return map[stage] || stage;
        }
        return stage;
    }

    _careFoodGroup(profile) {
        if (profile.slug === "oeil") return "digital_eye";
        if (profile.slug === "chat" || profile.familyKey === "felin") return "cat";
        if (profile.familyKey === "oiseau" || profile.familyKey === "oiseau-coureur" || profile.slug === "pigeon") return "bird";
        if (profile.categoryKey === "vegetal" || profile.categoryKey === "champignon") return "plant";
        if (profile.categoryKey === "esprit") return "spirit";
        if (profile.categoryKey === "non_vivant") return "object";
        return "generic";
    }

    _feedChoices(profile) {
        let group = this._careFoodGroup(profile);
        let good = shuffledCopy(FOOD_ITEMS[group] || FOOD_ITEMS.generic).slice(0, 3);
        let bad;
        if (profile && profile.slug === "oeil") {
            bad = shuffledCopy([
                { emoji: "💧", name: "eau" },
                { emoji: "🧼", name: "savon" },
                { emoji: "🪨", name: "caillou" },
                { emoji: "💩", name: "caca" },
                { emoji: "🧦", name: "chaussette" }
            ]).slice(0, 5 - good.length);
        } else {
            bad = shuffledCopy(BAD_FOOD_ITEMS).slice(0, 5 - good.length);
        }
        for (let i = 0; i < good.length; i++) good[i].compatible = true;
        for (let j = 0; j < bad.length; j++) bad[j].compatible = false;
        return shuffledCopy(uniqueCareItems(good.concat(bad))).slice(0, 5);
    }

    _cleanChoices() {
        return shuffledCopy(CLEANING_ITEMS).slice(0, 5);
    }

    _decayCareStats() {
        let now = nowSeconds();
        let last = this.state.lastCareDecayAt || now;
        let hours = Math.max(0, (now - last) / 3600);
        if (hours <= 0) return;

        let hungerLoss = Math.floor(hours * HUNGER_DECAY_PER_HOUR);
        let cleanLoss = Math.floor(hours * CLEAN_DECAY_PER_HOUR);
        if (hungerLoss <= 0 && cleanLoss <= 0) {
            // Ne pas remettre l'horloge à zéro tant qu'aucune perte réelle n'a eu lieu.
            // Sinon des refresh fréquents empêchent la faim/propreté de diminuer normalement.
            return;
        }

        this.state.hunger = clampPercent((this.state.hunger === undefined ? 100 : this.state.hunger) - hungerLoss);
        this.state.cleanliness = clampPercent((this.state.cleanliness === undefined ? 100 : this.state.cleanliness) - cleanLoss);
        this.state.lastCareDecayAt = now;
    }

    _maybeFindTreasure(profile) {
        if (Math.random() > 0.18) return false;
        let treasure = randomChoice(TREASURE_BANK);
        if (!treasure) return false;
        let found = { emoji: treasure.emoji, text: treasure.text, createdAt: nowSeconds() };
        if (!this.state.treasures) this.state.treasures = [];
        this.state.treasures.unshift(found);
        this.state.treasures = this.state.treasures.slice(0, 30);
        let translatedTreasure = this._translateItem(treasure).text || treasure.text;
        let message = _formatTemplate(this._t("foundTreasure", "{name} a trouvé une {treasure} !"), { name: profile.name, treasure: translatedTreasure });
        if (this._systemNotificationsEnabled()) this._notify("Trésor", message);
        return true;
    }

    _feedCooldownEnabled() {
        return this._featureEnabled("feedCooldownEnabled", true);
    }

    _dailyCareMoodEnabled() {
        return this._featureEnabled("dailyCareMoodEnabled", true);
    }

    _memoryJournalEnabled() {
        return this._featureEnabled("memoryJournalEnabled", true);
    }

    _holidayMessagesEnabled() {
        return this._featureEnabled("holidayMessagesEnabled", true);
    }

    _feedCooldownSeconds() {
        let hours = parseInt(this.settingsData.feedCooldownHours, 10);
        if (isNaN(hours) || hours < 0) hours = 2;
        if (hours > 24) hours = 24;
        return hours * 3600;
    }

    _canFeedNow() {
        if (!this._feedCooldownEnabled()) return true;
        let cooldown = this._feedCooldownSeconds();
        if (cooldown <= 0) return true;
        return nowSeconds() - (this.state.lastFedAt || 0) >= cooldown;
    }

    _feedWaitText() {
        let remaining = this._feedCooldownSeconds() - (nowSeconds() - (this.state.lastFedAt || 0));
        if (remaining < 0) remaining = 0;
        let minutes = Math.ceil(remaining / 60);
        if (minutes <= 1) return "Je n’ai pas faim pour le moment. Reviens dans environ 1 minute.";
        if (minutes < 60) return "Je n’ai pas faim pour le moment. Reviens dans environ " + minutes + " minutes.";
        let hours = Math.floor(minutes / 60);
        let rest = minutes % 60;
        return "Je n’ai pas faim pour le moment. Reviens dans environ " + hours + " h" + (rest ? " " + rest + " min" : "") + ".";
    }

    _ensureFirstEncounterMemory() {
        if (!this.state.firstEncounterAt) {
            this.state.firstEncounterAt = nowSeconds();
        }
        if (this._memoryJournalEnabled()) {
            let profile = this._currentProfile();
            addMemoryEvent(this.state, "first", this._t("firstMeetingTitle", "Première rencontre"), _formatTemplate(this._t("firstMeetingText", "Tu as rencontré {name} le {date}."), { name: profile.name, date: formatDateTime(this.state.firstEncounterAt) }));
        }
        this._saveState();
    }

    _checkMemoryDateEvents() {
        if (!this._memoryJournalEnabled() || !this._holidayMessagesEnabled()) return;
        let d = new Date();
        let day = d.getDate();
        let month = d.getMonth() + 1;
        let today = dayKey(d);
        let profile = this._currentProfile();
        let bDay = parseInt(this.settingsData.birthdayDay, 10) || 21;
        let bMonth = parseInt(this.settingsData.birthdayMonth, 10) || 4;
        let title = "";
        let text = "";
        if (day === bDay && month === bMonth) {
            title = "Anniversaire de " + profile.name;
            text = "Joyeux anniversaire à " + profile.name + " 🎂";
        } else if (day === 25 && month === 12) {
            title = "Noël";
            text = "Joyeux Noël 🎄 " + profile.name + " te souhaite une journée douce.";
        } else if (day === 1 && month === 1) {
            title = "Nouvel An";
            text = "Bonne année ✨ " + profile.name + " commence une nouvelle aventure avec toi.";
        } else if (day === 14 && month === 2) {
            title = "Saint-Valentin";
            text = "Bonne Saint-Valentin 💝 " + profile.name + " garde une pensée tendre pour toi.";
        }
        if (!title) return;
        let key = today + ":" + title;
        if (this.state.lastHolidayKey === key) return;
        this.state.lastHolidayKey = key;
        this.state.lastMessage = text;
        addMemoryEvent(this.state, "holiday", title, text);
        if (this._systemNotificationsEnabled()) this._notify(title, text);
        this._saveState();
    }

    _nextQuote(profile) {
        profile = profile || this._currentProfile();
        if (!this.state.usedQuoteIds || !Array.isArray(this.state.usedQuoteIds)) {
            this.state.usedQuoteIds = [];
        }
        let pool = this._buildQuotePool(profile);
        let usedMap = {};
        for (let i = 0; i < this.state.usedQuoteIds.length; i++) {
            usedMap[this.state.usedQuoteIds[i]] = true;
        }

        let available = [];
        for (let i = 0; i < pool.length; i++) {
            if (!usedMap[pool[i].id]) {
                available.push(pool[i]);
            }
        }

        if (available.length > 0) {
            let index = Math.floor(Math.random() * available.length);
            let quote = available[index];
            this.state.usedQuoteIds.push(quote.id);
            return quote.text;
        }

        if (typeof this.state.fallbackRepeatsLeft !== "number") {
            this.state.fallbackRepeatsLeft = LOVE_MESSAGE_REPEATS;
        }
        if (this.state.fallbackRepeatsLeft > 0) {
            this.state.fallbackRepeatsLeft -= 1;
            return this._t("loveMessage", LOVE_MESSAGE);
        }

        return this._t("noQuoteReserve", "Je n’ai plus de citation en réserve pour le moment, mais je suis toujours là.");
    }

   _buildQuotePool(profile) {
        let level = this.state.friendshipLevel;
        let quotes = [];

        // Global quote pool. In English mode, use a dedicated English pool so the spoken quote is not French.
        if (this._languageCode && this._languageCode() === "en") {
            let enQuotes = _tr("en", "englishQuotes", []);
            quotes = quotes.concat(makeQuoteObjects("english", enQuotes, profile, level));
        } else {
            quotes = quotes.concat(makeQuoteObjects("fish", FISH_QUOTES, profile, level));
        }

        quotes = quotes.concat(makeQuoteObjects("personal", PERSONAL_QUOTES, profile, level));
        quotes = quotes.concat(makeQuoteObjects("category-" + profile.categoryKey, CATEGORY_QUOTES[profile.categoryKey], profile, level));
        quotes = quotes.concat(makeQuoteObjects("type-" + profile.typeKey, TYPE_QUOTES[profile.typeKey], profile, level));
        quotes = quotes.concat(makeQuoteObjects("habitat-" + profile.habitatKey, HABITAT_QUOTES[profile.habitatKey], profile, level));
        quotes = quotes.concat(makeQuoteObjects("family-" + profile.familyKey, FAMILY_QUOTES[profile.familyKey], profile, level));
        quotes = quotes.concat(makeQuoteObjects("specific-" + profile.slug, SPECIFIC_QUOTES[profile.slug], profile, level));

        return uniqueQuotes(quotes);
    }
    _remainingQuoteCount(profile) {
        let pool = this._buildQuotePool(profile);
        let usedMap = {};
        for (let i = 0; i < this.state.usedQuoteIds.length; i++) {
            usedMap[this.state.usedQuoteIds[i]] = true;
        }

        let remaining = 0;
        for (let i = 0; i < pool.length; i++) {
            if (!usedMap[pool[i].id]) {
                remaining += 1;
            }
        }
        return remaining;
    }

    _careStatusText() {
        this._decayCareStats();
        let labels = this._uiLabels();
        let hunger = this.state.hunger === undefined ? 100 : this.state.hunger;
        let cleanliness = this.state.cleanliness === undefined ? 100 : this.state.cleanliness;
        let hungry = this._canFeedNow() ? labels.readyToEat : labels.notHungryShort;
        return "🍽 " + labels.hunger + " : " + hunger + "% — " + hungry + "\n🧼 " + labels.cleanliness + " : " + cleanliness + "%";
    }

    _statusText(profile) {
        let labels = this._uiLabels();
        let remainingQuotes = this._remainingQuoteCount(profile);

        if (remainingQuotes > 0) {
            return labels.remainingQuotes + " : " + remainingQuotes + " • " + labels.mealsGiven + " : " + this.state.feedCount;
        }

        if (this.state.fallbackRepeatsLeft > 0) {
            return labels.quoteStockEmpty + " • " + labels.affectionLinesLeft + " : " + this.state.fallbackRepeatsLeft + " • " + labels.mealsGiven + " : " + this.state.feedCount;
        }

        return labels.noQuoteLeft + " • " + labels.feedings + " : " + this.state.feedCount;
    }


    _languageCode() {
        let lang = this.settingsData.language || "fr";
        if (lang === "auto") {
            return _detectSystemLanguageCode();
        }
        return lang === "en" ? "en" : "fr";
    }

    _t(key, fallback) {
        return _tr(this._languageCode(), key, fallback);
    }

    _uiLabels() {
        return {
            inventory: this._t("inventory", "Inventaire"),
            feed: this._t("feed", "Nourrir"),
            clean: this._t("clean", "Nettoyer"),
            reset: this._t("reset", "Réinitialiser"),
            achievements: this._t("achievements", "Voir mes succès"),
            chooseFood: this._t("chooseFood", "Choisis une nourriture :"),
            chooseClean: this._t("chooseClean", "Choisis avec quoi nettoyer :"),
            noAchievements: this._t("noAchievements", "Aucun succès débloqué pour l’instant."),
            journalEmpty: this._t("journalEmpty", "🕮 Le journal est encore vide."),
            visualTitle: this._t("visualTitle", "🎨 Visuel"),
            emojiBank: this._t("emojiBank", "☺︎ Banque d’émojis"),
            mathSymbols: this._t("mathSymbols", "Σ Symboles grecs/math"),
            noTreasure: this._t("noTreasure", "💎 Aucun trésor pour l’instant."),
            treasureFallback: this._t("treasureFallback", "trésor"),
            copy: this._t("copy", "Copier"),
            studyPlaylist: this._t("studyPlaylist", "♬ Playlist pour étudier"),
            clipboardEmpty: this._t("clipboardEmpty", "Rien copié pour l’instant."),
            clearClipboard: this._t("clearClipboard", "💣 Vider le presse-papier"),
            readyToEat: this._t("readyToEat", "Prêt à manger"),
            notHungryShort: this._t("notHungryShort", "Pas faim"),
            hunger: this._t("hunger", "Faim"),
            cleanliness: this._t("cleanliness", "Propreté"),
            remainingQuotes: this._t("remainingQuotes", "Citations restantes"),
            mealsGiven: this._t("mealsGiven", "Repas donnés"),
            quoteStockEmpty: this._t("quoteStockEmpty", "Stock de citations vidé"),
            affectionLinesLeft: this._t("affectionLinesLeft", "phrases d'affection restantes"),
            noQuoteLeft: this._t("noQuoteLeft", "Plus de citation en réserve"),
            feedings: this._t("feedings", "Nourrissages")
        };
    }

    _translateItem(item) {
        if (!item || this._languageCode() !== "en") return item;
        _ensureI18nLoaded();
        let names = (I18N_EN && I18N_EN.foodNames) || {};
        let reactions = (I18N_EN && I18N_EN.foodReactions) || {};
        let out = {};
        for (let k in item) out[k] = item[k];
        if (out.name && names[out.name]) out.name = names[out.name];
        if (out.text && names[out.text]) out.text = names[out.text];
        if (out.reaction && reactions[out.reaction]) out.reaction = reactions[out.reaction];
        return out;
    }

    _translateItems(items) {
        let out = [];
        for (let i = 0; i < (items || []).length; i++) out.push(this._translateItem(items[i]));
        return out;
    }


    _emojiBankItems() {
        return _settingsBank(this.settingsData || {}, "emojiBank", DEFAULT_CUSTOM_EMOJI_BANK, this.settingsData ? this.settingsData.emojiBankCount : 10);
    }

    _symbolBankItems() {
        return _settingsBank(this.settingsData || {}, "symbolBank", DEFAULT_CUSTOM_SYMBOL_BANK, this.settingsData ? this.settingsData.symbolBankCount : 10);
    }

    _friendshipIcons(level) {
        let icon = _sanitizeOneGlyph(this.settingsData ? this.settingsData.friendshipIcon : "❤", "❤");
        let count = 1 + Math.floor(level / 5);
        if (count > 10) count = 10;
        let out = [];
        for (let i = 0; i < count; i++) out.push(icon);
        return out.join(" ");
    }

    _reactionVariant(map, item, fallback) {
        let key = item && item.name ? item.name : "";
        if (map && key && map[key]) return randomChoice(map[key]) || fallback;
        return fallback;
    }

    _refreshUi() {
        if (!this.menu || !this.state) {
            return;
        }
        let profile = this._currentProfile();
        let title = profile.name + " • " + profile.label;
        let subtitle = profile.categoryLabel + " → " + profile.typeLabel + " → " + profile.habitatLabel + " → " + profile.familyLabel;
        let friendship = this._t("friendshipPrefix", "Niveau d'amitié") + " : " + this.state.friendshipLevel + " (" + this._friendshipTitleText(this.state.friendshipLevel) + ")";
        let hearts = this._friendshipIcons(this.state.friendshipLevel);
        let bio = this._t("birthday", "Anniversaire") + " : " + profile.birthday + " • " + this._t("favoriteColor", "Couleur préférée") + " : " + profile.favoriteColor + " • " + this._t("origin", "Origine") + " : " + profile.country;
        let quote = this.state.lastMessage && this.state.lastMessage !== "" ? this.state.lastMessage : this._t("emptyMessage", DEFAULT_EMPTY_MESSAGE);
        let careStatus = this._careStatusText();
        let status = this._statusText(profile);
        let rpg = this._rpgEnabled() ? this._rpgText(profile) : "";
        let mood = this._moodEnabled() ? this._moodText() : "";

        this.menu.updateView({
            title: title,
            subtitle: subtitle,
            profileImagePath: this.settingsData.profileImagePath || DEFAULT_PROFILE_IMAGE_PATH,
            profileImageSize: this.settingsData.profileImageSize || 48,
            labels: this._uiLabels(),
            friendship: friendship,
            hearts: hearts,
            bio: bio,
            quote: quote,
            careStatus: careStatus,
            status: status,
            rpg: rpg,
            mood: mood,
            achievementsEnabled: this._achievementsEnabled(),
            achievements: this._achievementListTranslated(),
            clipboardSmartDetection: this._smartClipboardDetection(),
            clipboardImagePreview: this._clipboardImagePreview(),
            clipboardEnabled: this._clipboardEnabled(),
            clipboardItems: this.state.clipboardHistory || [],
            memoryJournalEnabled: this._memoryJournalEnabled(),
            memoryItems: this.state.memoryJournal || [],
            playlistItems: this.state.playlists || [],
            emojiBank: this._emojiBankItems(),
            symbolBank: this._symbolBankItems(),
            feedChoices: this._translateItems(this._feedChoices(profile)),
            cleanChoices: this._translateItems(this._cleanChoices())
        });

        this.set_applet_tooltip(profile.name + " • " + profile.label + " • " + this._t("tooltipFriendship", "amitié") + " " + this.state.friendshipLevel);
    }

    _achievementListTranslated() {
        let items = achievementList(this.state);
        if (this._languageCode && this._languageCode() === "en") {
            let t = {
                first_quote: ["First quote", "Read your first quote"],
                ten_quotes: ["Collector", "Read 10 quotes"],
                fifty_quotes: ["Living library", "Read 50 quotes"],
                first_copy: ["First memory", "Copy your first item"],
                copy_25: ["Faithful clipboard", "Copy 25 items"],
                copy_100: ["Archivist", "Copy 100 items"],
                friend_5: ["Buddy", "Reach 5 friendship"],
                friend_25: ["True companion", "Reach 25 friendship"],
                friend_50: ["Linked soul", "Reach 50 friendship"],
                level_5: ["Evolution", "Reach RPG level 5"],
                level_10: ["Cosmic creature", "Reach RPG level 10"]
            };
            for (let i = 0; i < items.length; i++) {
                if (t[items[i].id]) {
                    items[i].title = t[items[i].id][0];
                    items[i].description = t[items[i].id][1];
                }
            }
        }
        return items;
    }

    _featureEnabled(name, defaultValue) {
        if (this.settingsData[name] === undefined || this.settingsData[name] === null) {
            return defaultValue;
        }
        return this.settingsData[name] === true;
    }

    _achievementsEnabled() {
        return this._featureEnabled("achievementsEnabled", true);
    }

    _moodEnabled() {
        return this._featureEnabled("moodEnabled", true);
    }

    _smartClipboardDetection() {
        return this._featureEnabled("smartClipboardDetection", true);
    }

    /**
     * Returns whether clipboard image previews are enabled.  This feature has been
     * permanently disabled to avoid loading local images from the clipboard.
     * Always returns false.
     */
    _clipboardImagePreview() {
        return false;
    }

    _contextualClipboardQuotes() {
        return this._featureEnabled("contextualClipboardQuotes", true);
    }

    _rpgEnabled() {
        return this._featureEnabled("rpgEnabled", true);
    }

    _systemReactionsEnabled() {
        return this._featureEnabled("systemReactionsEnabled", false);
    }

    _systemNotificationsEnabled() {
        return this._featureEnabled("systemNotificationsEnabled", true);
    }

    _rpgText(profile) {
        let level = getXpLevel(this.state.xp || 0);
        let stage = this._evolutionStageText(level, profile.slug);
        return this._t("rpgLevel", "Niveau RPG") + " : " + level + " • " + this._t("xp", "XP") + " : " + (this.state.xp || 0) + " • " + this._t("evolution", "Évolution") + " : " + stage;
    }

    _moodText() {
        let hour = new Date().getHours();
        let idle = nowSeconds() - (this.state.lastInteractionAt || nowSeconds());
        let fedToday = this.state.lastFedDay === dayKey(new Date());
        if (this.state.lastSystemEvent) {
            return this.state.lastSystemEvent;
        }
        if (hour >= 23 || hour < 6) {
            return _stableVariant(MOOD_VARIANTS.late, "late");
        }
        if ((this.state.cleanliness || 100) < 35) {
            return _stableVariant(MOOD_VARIANTS.dirty, "dirty");
        }
        if ((this.state.hunger || 100) < 35) {
            return _stableVariant(MOOD_VARIANTS.hungry, "hungry");
        }
        if (this._dailyCareMoodEnabled() && !fedToday) {
            return _stableVariant(MOOD_VARIANTS.daily, "daily");
        }
        if (idle > 3600) {
            return _stableVariant(MOOD_VARIANTS.idle, "idle");
        }
        if (fedToday) {
            return _stableVariant(MOOD_VARIANTS.fed, "fed");
        }
        return _stableVariant(MOOD_VARIANTS.calm, "calm");
    }

    _contextualClipboardReaction(item) {
        let text = clipboardItemText(item).trim();
        let kind = detectClipboardKind(text);
        if (isYoutubeUrl(text)) {
            return "🔗 YouTube ? Tu procrastines ou tu fais de la recherche très sérieuse ?";
        }
        if (kind.type === "code") {
            return "💻 Encore du JavaScript ? Je sens l’odeur du debug.";
        }
        if (kind.type === "image") {
            return "📷 Image repérée. Je garde ça dans mon petit nid.";
        }
        if (kind.type === "path") {
            return "📁 Chemin de fichier mémorisé. Je ne me perds presque jamais.";
        }
        if (text.length > 800) {
            return "📄 Tu écris un roman ? J’ai tout mis dans le presse-papier.";
        }
        if (kind.type === "url") {
            return "🔗 Lien capturé. Je le garde sous mon aile.";
        }
        return "📋 Nouveau souvenir copié.";
    }

    _clipboardEnabled() {
        return this.settingsData.clipboardEnabled === true;
    }

    _clipboardLimit() {
        let limit = parseInt(this.settingsData.clipboardLimit, 10);
        if (!limit || limit < 1) {
            limit = 1;
        }
        if (limit > 10) {
            limit = 10;
        }
        return limit;
    }

    _startClipboardWatcher() {
        this._stopClipboardWatcher();

        if (!this._clipboardEnabled()) {
            return;
        }

        this.clipboard = St.Clipboard.get_default();
        this.clipboardTimeoutId = Mainloop.timeout_add(CLIPBOARD_POLL_INTERVAL_MS, () => {
            this._checkClipboard();
            return true;
        });
        this._checkClipboard();
    }

    _stopClipboardWatcher() {
        if (this.clipboardTimeoutId > 0) {
            Mainloop.source_remove(this.clipboardTimeoutId);
            this.clipboardTimeoutId = 0;
        }
    }

    _checkClipboard() {
        if (!this._clipboardEnabled() || !this.clipboard) {
            return;
        }

        this.clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            text = normalizeClipboardText(text);
            if (!text || text.trim() === "") {
                return;
            }
            if (text === this.lastSeenClipboardText) {
                return;
            }
            this.lastSeenClipboardText = text;
            this._addClipboardHistoryItem(text);
        });
    }

    _addClipboardHistoryItem(text) {
        text = normalizeClipboardText(text);
        if (!text) {
            return;
        }

        let entry = makeClipboardEntry(text);
        let history = this.state.clipboardHistory || [];
        let filtered = [];
        for (let i = 0; i < history.length; i++) {
            if (clipboardItemText(history[i]) !== text) {
                filtered.push(history[i]);
            }
        }

        filtered.unshift(entry);
        this.state.clipboardHistory = filtered.slice(0, this._clipboardLimit());
        this.state.totalCopies = (this.state.totalCopies || 0) + 1;
        if (this._rpgEnabled()) {
            this.state.xp = (this.state.xp || 0) + XP_PER_COPY;
        }
        this.state.lastInteractionAt = nowSeconds();
        if (this._contextualClipboardQuotes()) {
            this.state.lastMessage = this._contextualClipboardReaction(entry);
        }
        this._checkAchievements();
        this._saveState();
        this._refreshUi();
    }

    copyClipboardItem(text) {
        let clipboardText = clipboardItemText(text);
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.CLIPBOARD, clipboardText);
        // Évite que le watcher du presse-papier recompte immédiatement notre propre copie.
        this.lastSeenClipboardText = normalizeClipboardText(clipboardText);
        this._addClipboardHistoryItem(clipboardText);
    }

    clearClipboardHistory() {
        try {
            this.state.clipboardHistory = [];
            this.settings.setValue("keyClipboardHistory", "[]");

            // Vide aussi le presse-papier système quand Cinnamon l'autorise.
            try {
                let clipboard = St.Clipboard.get_default();
                clipboard.set_text(St.ClipboardType.CLIPBOARD, "");
                this.lastSeenClipboardText = "";
            } catch (clipboardError) {
                global.logError(clipboardError);
            }

            this.state.lastInteractionAt = nowSeconds();
            this.state.lastMessage = "💣 Presse-papier vidé.";
            this._saveState();
            this._refreshUi();
        } catch (e) {
            global.logError(e);
        }
    }

    _onClipboardSettingsChanged() {
        this.state.clipboardHistory = (this.state.clipboardHistory || []).slice(0, this._clipboardLimit());
        this._saveState();
        this._startClipboardWatcher();
        this._startSystemWatcher();
        this._refreshUi();
    }

    _checkAchievements() {
        if (!this._achievementsEnabled()) {
            return;
        }
        let previous = {};
        let oldList = this.state.unlockedAchievements || [];
        for (let i = 0; i < oldList.length; i++) {
            previous[oldList[i]] = true;
        }
        let unlocked = achievementUnlockedIds(this.state);
        let newIds = [];
        let keys = Object.keys(unlocked);
        for (let k = 0; k < keys.length; k++) {
            if (!previous[keys[k]]) {
                newIds.push(keys[k]);
            }
        }
        this.state.unlockedAchievements = Object.keys(unlocked);
        if (newIds.length > 0 && this._systemNotificationsEnabled()) {
            for (let i = 0; i < newIds.length; i++) {
                this._notify("Succès débloqué : " + achievementTitleById(newIds[i]), "Nouveau succès ajouté à ta collection.");
            }
        }
    }

    _notify(title, message) {
        try {
            Main.notify("Créature — " + title, message);
        } catch (e) {
            global.log(UUID + " notification error: " + e.message);
        }
    }

    _startSystemWatcher() {
        this._stopSystemWatcher();
        if (!this._systemReactionsEnabled()) {
            return;
        }
        this.systemTimeoutId = Mainloop.timeout_add(SYSTEM_POLL_INTERVAL_MS, () => {
            this._checkSystemEvents();
            return true;
        });
        this._checkSystemEvents();
    }

    _stopSystemWatcher() {
        if (this.systemTimeoutId > 0) {
            Mainloop.source_remove(this.systemTimeoutId);
            this.systemTimeoutId = 0;
        }
    }

    _checkSystemEvents() {
        if (!this._systemReactionsEnabled()) {
            return;
        }
        let event = "";
        try {
            let [ok, out] = GLib.spawn_command_line_sync("sh -c 'upower -i $(upower -e | grep BAT | head -n1) 2>/dev/null | awk \\\'/percentage/ {gsub(\"%\",\"\",$2); print $2}\\\''");
            if (ok) {
                let percent = parseInt(ByteArray.toString(out).trim(), 10);
                if (!isNaN(percent) && percent <= 20) {
                    event = randomChoice(SYSTEM_EVENT_VARIANTS.battery) || "🔋 Batterie faible… je vais économiser mes plumes.";
                }
            }
        } catch (e) {}

        if (!event) {
            try {
                let [ok2, out2] = GLib.spawn_command_line_sync("sh -c 'nmcli -t -f STATE general 2>/dev/null'");
                if (ok2 && ByteArray.toString(out2).trim() !== "connected") {
                    event = randomChoice(SYSTEM_EVENT_VARIANTS.network) || "📡 Wi‑Fi perdu… je capte seulement ton affection.";
                }
            } catch (e2) {}
        }

        if (event && this.state.lastSystemEvent !== event) {
            this.state.lastSystemEvent = event;
            this.state.lastMessage = event;
            if (this._systemNotificationsEnabled()) {
                this._notify("Réaction système", event);
            }
            this._saveState();
            this._refreshUi();
        } else if (!event && this.state.lastSystemEvent) {
            this.state.lastSystemEvent = "";
            this._saveState();
            this._refreshUi();
        }
    }

    _onFeatureSettingsChanged() {
        this._startSystemWatcher();
        this._refreshUi();
    }

    _targetAnimationHeight() {
        let panelBased = (this.panelHeight || 36) - 4;
        if (panelBased < 16) panelBased = 16;
        if (panelBased > 96) panelBased = 96;
        return panelBased;
    }

    _scheduleBuildAnimation() {
        if (this.animationBuildIdleId > 0) {
            Mainloop.source_remove(this.animationBuildIdleId);
            this.animationBuildIdleId = 0;
        }

        this.animationBuildIdleId = Mainloop.idle_add(() => {
            this.animationBuildIdleId = 0;

            // Cinnamon peut construire l'applet avant que son actor soit réellement
            // attaché au stage. Construire le sprite trop tôt provoque :
            // "st_widget_get_theme_node called on the widget ... which is not in the stage".
            if (!this.actor || !this.actor.get_stage || !this.actor.get_stage()) {
                this.animationBuildIdleId = Mainloop.timeout_add(100, () => {
                    this.animationBuildIdleId = 0;
                    this._scheduleBuildAnimation();
                    return false;
                });
                return false;
            }

            this._buildAnimation();
            return false;
        });
    }

    _buildAnimation() {
        this._restoreEmbeddedApplet();

        if (this.embeddedRetryId > 0) {
            Mainloop.source_remove(this.embeddedRetryId);
            this.embeddedRetryId = 0;
        }

        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }

        this.actor.remove_all_children();

        let mode = this.settingsData.panelDisplayMode || "sprite";

        if (mode === "empty") {
            this._buildEmptySlot();
            return;
        }

        if (mode === "embed-previous" || mode === "embed-next" || mode === "embed-uuid") {
            this._buildEmbeddedAppletSlot(mode);
            return;
        }

        try {
            let imagePath = expandHome(this.settingsData.imagePath || "~/.local/share/cinnamon/applets/creature@AIapplet/animations/roberto.png");
            let frames = parseInt(this.settingsData.frames, 10) || 9;
            let speed = Math.floor((parseFloat(this.settingsData.pausePerFrameInSeconds) || 0.2) * 1000);
            if (speed < 100) {
                speed = 100;
            }

            this.sprite = new AnimatedSprite({
                filePath: imagePath,
                frames: frames,
                speed: speed,
                height: this._targetAnimationHeight()
            });

            this.actor.add_child(this.sprite);
        } catch (e) {
            let errorLabel = new St.Label({
                text: "⚠",
                style_class: "creature-animation-error"
            });
            this.actor.add_child(errorLabel);
            global.logError(UUID + " animation error: " + e.message);
        }
    }

    _buildEmptySlot() {
        let width = parseInt(this.settingsData.embeddedSlotWidth, 10) || 48;
        if (width < 8) width = 8;
        if (width > 300) width = 300;
        let height = this._targetAnimationHeight();
        let box = new St.Bin({ style_class: "creature-embedded-empty-slot", reactive: true });
        box.set_size(width, height);
        box.connect("button-release-event", () => {
            this._refreshUi();
            this.menu.toggle();
            return true;
        });
        this.actor.add_child(box);
    }

    _panelBoxes() {
        let boxes = [];
        try {
            if (this.panel) {
                if (this.panel._leftBox) boxes.push(this.panel._leftBox);
                if (this.panel._centerBox) boxes.push(this.panel._centerBox);
                if (this.panel._rightBox) boxes.push(this.panel._rightBox);
            }
        } catch (e) {}

        try {
            if (Main && Main.panel) {
                if (Main.panel._leftBox && boxes.indexOf(Main.panel._leftBox) < 0) boxes.push(Main.panel._leftBox);
                if (Main.panel._centerBox && boxes.indexOf(Main.panel._centerBox) < 0) boxes.push(Main.panel._centerBox);
                if (Main.panel._rightBox && boxes.indexOf(Main.panel._rightBox) < 0) boxes.push(Main.panel._rightBox);
            }
        } catch (e2) {}

        return boxes;
    }

    _findOwnPanelBox() {
        let boxes = this._panelBoxes();
        for (let b = 0; b < boxes.length; b++) {
            let children = boxes[b].get_children ? boxes[b].get_children() : [];
            if (children.indexOf(this.actor) >= 0) return boxes[b];
        }
        return null;
    }

    _findAppletActorToEmbed(mode) {
        let ownBox = this._findOwnPanelBox();
        if (ownBox) {
            let children = ownBox.get_children ? ownBox.get_children() : [];
            let ownIndex = children.indexOf(this.actor);
            if (mode === "embed-previous" && ownIndex > 0) {
                for (let i = ownIndex - 1; i >= 0; i--) {
                    if (children[i] && children[i] !== this.actor && children[i]._applet) return { actor: children[i], parent: ownBox, index: i };
                }
            }
            if (mode === "embed-next" && ownIndex >= 0) {
                for (let i = ownIndex + 1; i < children.length; i++) {
                    if (children[i] && children[i] !== this.actor && children[i]._applet) return { actor: children[i], parent: ownBox, index: i };
                }
            }
        }

        if (mode === "embed-uuid") {
            let targetUuid = String(this.settingsData.embeddedAppletUuid || "").trim();
            if (!targetUuid) return null;
            let boxes = this._panelBoxes();
            for (let b = 0; b < boxes.length; b++) {
                let children = boxes[b].get_children ? boxes[b].get_children() : [];
                for (let i = 0; i < children.length; i++) {
                    let actor = children[i];
                    if (!actor || actor === this.actor || !actor._applet) continue;
                    if (actor._applet._uuid === targetUuid || actor._applet.uuid === targetUuid) {
                        return { actor: actor, parent: boxes[b], index: i };
                    }
                }
            }
        }

        return null;
    }

    _removeActorFromParent(parent, actor) {
        if (!parent || !actor) return;
        try {
            if (parent.remove_actor) parent.remove_actor(actor);
            else if (parent.remove_child) parent.remove_child(actor);
        } catch (e) {
            global.logError(UUID + " remove embedded actor error: " + e.message);
        }
    }

    _insertActorIntoParent(parent, actor, index) {
        if (!parent || !actor) return;
        try {
            if (parent.insert_actor) parent.insert_actor(actor, index);
            else if (parent.insert_child_at_index) parent.insert_child_at_index(actor, index);
            else parent.add_child(actor);
        } catch (e) {
            try { parent.add_child(actor); } catch (e2) {
                global.logError(UUID + " restore embedded actor error: " + e2.message);
            }
        }
    }

    _captureAndSetActorTreeReactive(actor, reactive) {
        let states = [];
        function walk(a) {
            if (!a) return;
            let oldValue = null;
            try {
                if (a.get_reactive) oldValue = a.get_reactive();
                else if (a.reactive !== undefined) oldValue = a.reactive;
            } catch (e) {
                oldValue = null;
            }
            states.push({ actor: a, reactive: oldValue });
            try {
                if (a.set_reactive) a.set_reactive(reactive);
                else if (a.reactive !== undefined) a.reactive = reactive;
            } catch (e2) {}
            try {
                let children = a.get_children ? a.get_children() : [];
                for (let i = 0; i < children.length; i++) walk(children[i]);
            } catch (e3) {}
        }
        walk(actor);
        return states;
    }

    _restoreActorTreeReactive(states) {
        if (!states) return;
        for (let i = 0; i < states.length; i++) {
            let item = states[i];
            if (!item || !item.actor || item.reactive === null || item.reactive === undefined) continue;
            try {
                if (item.actor.set_reactive) item.actor.set_reactive(item.reactive);
                else if (item.actor.reactive !== undefined) item.actor.reactive = item.reactive;
            } catch (e) {}
        }
    }

    _openCreatureMenuFromOverlay() {
        this._refreshUi();
        if (this.menu) this.menu.toggle();
    }

    _buildEmbeddedAppletSlot(mode) {
        let width = parseInt(this.settingsData.embeddedSlotWidth, 10) || 48;
        if (width < 16) width = 16;
        if (width > 300) width = 300;
        let height = this._targetAnimationHeight();

        let host = new St.Widget({
            style_class: "creature-embedded-applet-slot",
            reactive: true,
            x_expand: false,
            y_expand: false,
            layout_manager: new Clutter.BinLayout()
        });
        host.set_size(width, height);
        this.actor.add_child(host);

        let found = this._findAppletActorToEmbed(mode);
        if (!found || !found.actor || !found.parent) {
            let label = new St.Label({
                text: "⧉",
                style_class: "creature-embedded-placeholder"
            });
            host.add_child(label);
            this.embeddedPlaceholder = label;

            // L'applet cible peut être créé juste après Créature au démarrage.
            // On réessaie une fois sans boucler à l'infini.
            this.embeddedRetryId = Mainloop.timeout_add(700, () => {
                this.embeddedRetryId = 0;
                if ((this.settingsData.panelDisplayMode || "sprite") === mode) this._scheduleBuildAnimation();
                return false;
            });
            return;
        }

        let actor = found.actor;
        let originalParent = found.parent;
        let originalIndex = found.index;

        try {
            this._removeActorFromParent(originalParent, actor);
            host.add_child(actor);
            actor.show();

            let reactiveStates = null;
            let clickOverlay = null;
            if (this.settingsData.embeddedClickPriority !== false) {
                reactiveStates = this._captureAndSetActorTreeReactive(actor, false);
                clickOverlay = new St.Button({
                    style_class: "creature-embedded-click-overlay",
                    reactive: true,
                    x_expand: true,
                    y_expand: true
                });
                clickOverlay.set_size(width, height);
                clickOverlay.connect("button-press-event", () => {
                    return true;
                });
                clickOverlay.connect("button-release-event", () => {
                    this._openCreatureMenuFromOverlay();
                    return true;
                });
                host.add_child(clickOverlay);
                if (clickOverlay.raise_top) clickOverlay.raise_top();
            }

            this.embeddedApplet = {
                actor: actor,
                originalParent: originalParent,
                originalIndex: originalIndex,
                host: host,
                reactiveStates: reactiveStates,
                clickOverlay: clickOverlay
            };
        } catch (e) {
            global.logError(UUID + " embed applet error: " + e.message);
            try {
                this._insertActorIntoParent(originalParent, actor, originalIndex);
            } catch (e2) {}
            host.remove_all_children();
            host.add_child(new St.Label({ text: "⚠", style_class: "creature-animation-error" }));
        }
    }

    _restoreEmbeddedApplet() {
        if (!this.embeddedApplet || !this.embeddedApplet.actor) return;

        let data = this.embeddedApplet;
        this.embeddedApplet = null;

        try {
            this._restoreActorTreeReactive(data.reactiveStates);
            let currentParent = data.actor.get_parent ? data.actor.get_parent() : null;
            if (currentParent) this._removeActorFromParent(currentParent, data.actor);
            this._insertActorIntoParent(data.originalParent, data.actor, data.originalIndex);
            data.actor.show();
        } catch (e) {
            global.logError(UUID + " restore embedded applet failed: " + e.message);
        }
    }

    _onCreatureSettingsChanged() {
        this._syncCreatureIdentity();
        this._refreshUi();
    }

    _onAnimationSettingsChanged() {
        this._scheduleBuildAnimation();
        this._refreshUi();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CreatureApplet(metadata, orientation, panel_height, instance_id);
}

