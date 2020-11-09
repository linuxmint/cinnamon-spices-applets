
//This list is taken from https://unicode.org/emoji/charts/emoji-list.html
const EMOJI = [
{
"code": "😀",
"name": "grinning face",
"keywords": "face | grin | grinning face"
},
{
"code": "😃",
"name": "grinning face with big eyes",
"keywords": "face | grinning face with big eyes | mouth | open | smile"
},
{
"code": "😄",
"name": "grinning face with smiling eyes",
"keywords": "eye | face | grinning face with smiling eyes | mouth | open | smile"
},
{
"code": "😁",
"name": "beaming face with smiling eyes",
"keywords": "beaming face with smiling eyes | eye | face | grin | smile"
},
{
"code": "😆",
"name": "grinning squinting face",
"keywords": "face | grinning squinting face | laugh | mouth | satisfied | smile"
},
{
"code": "😅",
"name": "grinning face with sweat",
"keywords": "cold | face | grinning face with sweat | open | smile | sweat"
},
{
"code": "🤣",
"name": "rolling on the floor laughing",
"keywords": "face | floor | laugh | rofl | rolling | rolling on the floor laughing | rotfl"
},
{
"code": "😂",
"name": "face with tears of joy",
"keywords": "face | face with tears of joy | joy | laugh | tear"
},
{
"code": "🙂",
"name": "slightly smiling face",
"keywords": "face | slightly smiling face | smile"
},
{
"code": "🙃",
"name": "upside-down face",
"keywords": "face | upside-down"
},
{
"code": "😉",
"name": "winking face",
"keywords": "face | wink | winking face"
},
{
"code": "😊",
"name": "smiling face with smiling eyes",
"keywords": "blush | eye | face | smile | smiling face with smiling eyes"
},
{
"code": "😇",
"name": "smiling face with halo",
"keywords": "angel | face | fantasy | halo | innocent | smiling face with halo"
},
{
"code": "🥰",
"name": "smiling face with hearts",
"keywords": "adore | crush | hearts | in love | smiling face with hearts"
},
{
"code": "😍",
"name": "smiling face with heart-eyes",
"keywords": "eye | face | love | smile | smiling face with heart-eyes"
},
{
"code": "🤩",
"name": "star-struck",
"keywords": "eyes | face | grinning | star | star-struck | starry-eyed"
},
{
"code": "😘",
"name": "face blowing a kiss",
"keywords": "face | face blowing a kiss | kiss"
},
{
"code": "😗",
"name": "kissing face",
"keywords": "face | kiss | kissing face"
},
{
"code": "☺",
"name": "smiling face",
"keywords": "face | outlined | relaxed | smile | smiling face"
},
{
"code": "😚",
"name": "kissing face with closed eyes",
"keywords": "closed | eye | face | kiss | kissing face with closed eyes"
},
{
"code": "😙",
"name": "kissing face with smiling eyes",
"keywords": "eye | face | kiss | kissing face with smiling eyes | smile"
},
{
"code": "🥲",
"name": "smiling face with tear",
"keywords": "grateful | proud | relieved | smiling | smiling face with tear | tear | touched"
},
{
"code": "😋",
"name": "face savoring food",
"keywords": "delicious | face | face savoring food | savouring | smile | yum"
},
{
"code": "😛",
"name": "face with tongue",
"keywords": "face | face with tongue | tongue"
},
{
"code": "😜",
"name": "winking face with tongue",
"keywords": "eye | face | joke | tongue | wink | winking face with tongue"
},
{
"code": "🤪",
"name": "zany face",
"keywords": "eye | goofy | large | small | zany face"
},
{
"code": "😝",
"name": "squinting face with tongue",
"keywords": "eye | face | horrible | squinting face with tongue | taste | tongue"
},
{
"code": "🤑",
"name": "money-mouth face",
"keywords": "face | money | money-mouth face | mouth"
},
{
"code": "🤗",
"name": "hugging face",
"keywords": "face | hug | hugging"
},
{
"code": "🤭",
"name": "face with hand over mouth",
"keywords": "face with hand over mouth | whoops | shock | sudden realization | surprise"
},
{
"code": "🤫",
"name": "shushing face",
"keywords": "quiet | shush | shushing face"
},
{
"code": "🤔",
"name": "thinking face",
"keywords": "face | thinking"
},
{
"code": "🤐",
"name": "zipper-mouth face",
"keywords": "face | mouth | zipper | zipper-mouth face"
},
{
"code": "🤨",
"name": "face with raised eyebrow",
"keywords": "distrust | face with raised eyebrow | skeptic | disapproval | disbelief | mild surprise | scepticism"
},
{
"code": "😐",
"name": "neutral face",
"keywords": "deadpan | face | meh | neutral"
},
{
"code": "😑",
"name": "expressionless face",
"keywords": "expressionless | face | inexpressive | meh | unexpressive"
},
{
"code": "😶",
"name": "face without mouth",
"keywords": "face | face without mouth | mouth | quiet | silent"
},
{
"code": "😶‍🌫️",
"name": "face in clouds",
"keywords": "absentminded | face in clouds | face in the fog | head in clouds"
},
{
"code": "😏",
"name": "smirking face",
"keywords": "face | smirk | smirking face"
},
{
"code": "😒",
"name": "unamused face",
"keywords": "face | unamused | unhappy"
},
{
"code": "🙄",
"name": "face with rolling eyes",
"keywords": "eyeroll | eyes | face | face with rolling eyes | rolling"
},
{
"code": "😬",
"name": "grimacing face",
"keywords": "face | grimace | grimacing face"
},
{
"code": "😮‍💨",
"name": "face exhaling",
"keywords": "exhale | face exhaling | gasp | groan | relief | whisper | whistle"
},
{
"code": "🤥",
"name": "lying face",
"keywords": "face | lie | lying face | pinocchio"
},
{
"code": "😌",
"name": "relieved face",
"keywords": "face | relieved"
},
{
"code": "😔",
"name": "pensive face",
"keywords": "dejected | face | pensive"
},
{
"code": "😪",
"name": "sleepy face",
"keywords": "face | sleep | sleepy face"
},
{
"code": "🤤",
"name": "drooling face",
"keywords": "drooling | face"
},
{
"code": "😴",
"name": "sleeping face",
"keywords": "face | sleep | sleeping face | zzz"
},
{
"code": "😷",
"name": "face with medical mask",
"keywords": "cold | doctor | face | face with medical mask | mask | sick"
},
{
"code": "🤒",
"name": "face with thermometer",
"keywords": "face | face with thermometer | ill | sick | thermometer"
},
{
"code": "🤕",
"name": "face with head-bandage",
"keywords": "bandage | face | face with head-bandage | hurt | injury"
},
{
"code": "🤢",
"name": "nauseated face",
"keywords": "face | nauseated | vomit"
},
{
"code": "🤮",
"name": "face vomiting",
"keywords": "face vomiting | sick | vomit"
},
{
"code": "🤧",
"name": "sneezing face",
"keywords": "face | gesundheit | sneeze | sneezing face"
},
{
"code": "🥵",
"name": "hot face",
"keywords": "feverish | heat stroke | hot | hot face | red-faced | sweating"
},
{
"code": "🥶",
"name": "cold face",
"keywords": "blue-faced | cold | cold face | freezing | frostbite | icicles"
},
{
"code": "🥴",
"name": "woozy face",
"keywords": "dizzy | intoxicated | tipsy | uneven eyes | wavy mouth | woozy face"
},
{
"code": "😵",
"name": "knocked-out face",
"keywords": "dead | face | knocked out | knocked-out face"
},
{
"code": "😵‍💫",
"name": "face with spiral eyes",
"keywords": "dizzy | face with spiral eyes | hypnotized | spiral | trouble | whoa"
},
{
"code": "🤯",
"name": "exploding head",
"keywords": "exploding head | mind blown | shocked"
},
{
"code": "🤠",
"name": "cowboy hat face",
"keywords": "cowboy | cowgirl | face | hat"
},
{
"code": "🥳",
"name": "partying face",
"keywords": "celebration | hat | horn | party | partying face"
},
{
"code": "🥸",
"name": "disguised face",
"keywords": "disguise | disguised face | face | glasses | incognito | nose"
},
{
"code": "😎",
"name": "smiling face with sunglasses",
"keywords": "bright | cool | face | smiling face with sunglasses | sun | sunglasses"
},
{
"code": "🤓",
"name": "nerd face",
"keywords": "face | geek | nerd"
},
{
"code": "🧐",
"name": "face with monocle",
"keywords": "face with monocle | stuffy | wealthy"
},
{
"code": "😕",
"name": "confused face",
"keywords": "confused | face | meh"
},
{
"code": "😟",
"name": "worried face",
"keywords": "face | worried"
},
{
"code": "🙁",
"name": "slightly frowning face",
"keywords": "face | frown | slightly frowning face"
},
{
"code": "☹",
"name": "frowning face",
"keywords": "face | frown | frowning face"
},
{
"code": "😮",
"name": "face with open mouth",
"keywords": "face | face with open mouth | mouth | open | sympathy"
},
{
"code": "😯",
"name": "hushed face",
"keywords": "face | hushed | stunned | surprised"
},
{
"code": "😲",
"name": "astonished face",
"keywords": "astonished | face | shocked | totally"
},
{
"code": "😳",
"name": "flushed face",
"keywords": "dazed | face | flushed"
},
{
"code": "🥺",
"name": "pleading face",
"keywords": "begging | mercy | pleading face | puppy eyes"
},
{
"code": "😦",
"name": "frowning face with open mouth",
"keywords": "face | frown | frowning face with open mouth | mouth | open"
},
{
"code": "😧",
"name": "anguished face",
"keywords": "anguished | face"
},
{
"code": "😨",
"name": "fearful face",
"keywords": "face | fear | fearful | scared"
},
{
"code": "😰",
"name": "anxious face with sweat",
"keywords": "anxious face with sweat | blue | cold | face | rushed | sweat"
},
{
"code": "😥",
"name": "sad but relieved face",
"keywords": "disappointed | face | relieved | sad but relieved face | whew"
},
{
"code": "😢",
"name": "crying face",
"keywords": "cry | crying face | face | sad | tear"
},
{
"code": "😭",
"name": "loudly crying face",
"keywords": "cry | face | loudly crying face | sad | sob | tear"
},
{
"code": "😱",
"name": "face screaming in fear",
"keywords": "face | face screaming in fear | fear | munch | scared | scream"
},
{
"code": "😖",
"name": "confounded face",
"keywords": "confounded | face"
},
{
"code": "😣",
"name": "persevering face",
"keywords": "face | persevere | persevering face"
},
{
"code": "😞",
"name": "disappointed face",
"keywords": "disappointed | face"
},
{
"code": "😓",
"name": "downcast face with sweat",
"keywords": "cold | downcast face with sweat | face | sweat"
},
{
"code": "😩",
"name": "weary face",
"keywords": "face | tired | weary"
},
{
"code": "😫",
"name": "tired face",
"keywords": "face | tired"
},
{
"code": "🥱",
"name": "yawning face",
"keywords": "bored | tired | yawn | yawning face"
},
{
"code": "😤",
"name": "face with steam from nose",
"keywords": "face | face with steam from nose | triumph | won"
},
{
"code": "😡",
"name": "pouting face",
"keywords": "angry | face | mad | pouting | rage | red"
},
{
"code": "😠",
"name": "angry face",
"keywords": "angry | face | mad"
},
{
"code": "🤬",
"name": "face with symbols on mouth",
"keywords": "face with symbols on mouth | swearing | cursing"
},
{
"code": "😈",
"name": "smiling face with horns",
"keywords": "face | fairy tale | fantasy | horns | smile | smiling face with horns"
},
{
"code": "👿",
"name": "angry face with horns",
"keywords": "angry face with horns | demon | devil | face | fantasy | imp"
},
{
"code": "💀",
"name": "skull",
"keywords": "death | face | fairy tale | monster | skull"
},
{
"code": "☠",
"name": "skull and crossbones",
"keywords": "crossbones | death | face | monster | skull | skull and crossbones"
},
{
"code": "💩",
"name": "pile of poo",
"keywords": "dung | face | monster | pile of poo | poo | poop"
},
{
"code": "🤡",
"name": "clown face",
"keywords": "clown | face"
},
{
"code": "👹",
"name": "ogre",
"keywords": "creature | face | fairy tale | fantasy | monster | ogre | troll"
},
{
"code": "👺",
"name": "goblin",
"keywords": "creature | face | fairy tale | fantasy | goblin | monster"
},
{
"code": "👻",
"name": "ghost",
"keywords": "creature | face | fairy tale | fantasy | ghost | monster"
},
{
"code": "👽",
"name": "alien",
"keywords": "alien | creature | extraterrestrial | face | fantasy | ufo"
},
{
"code": "👾",
"name": "alien monster",
"keywords": "alien | creature | extraterrestrial | face | monster | ufo"
},
{
"code": "🤖",
"name": "robot",
"keywords": "face | monster | robot"
},
{
"code": "😺",
"name": "grinning cat",
"keywords": "cat | face | grinning | mouth | open | smile"
},
{
"code": "😸",
"name": "grinning cat with smiling eyes",
"keywords": "cat | eye | face | grin | grinning cat with smiling eyes | smile"
},
{
"code": "😹",
"name": "cat with tears of joy",
"keywords": "cat | cat with tears of joy | face | joy | tear"
},
{
"code": "😻",
"name": "smiling cat with heart-eyes",
"keywords": "cat | eye | face | heart | love | smile | smiling cat with heart-eyes"
},
{
"code": "😼",
"name": "cat with wry smile",
"keywords": "cat | cat with wry smile | face | ironic | smile | wry"
},
{
"code": "😽",
"name": "kissing cat",
"keywords": "cat | eye | face | kiss | kissing cat"
},
{
"code": "🙀",
"name": "weary cat",
"keywords": "cat | face | oh | surprised | weary"
},
{
"code": "😿",
"name": "crying cat",
"keywords": "cat | cry | crying cat | face | sad | tear"
},
{
"code": "😾",
"name": "pouting cat",
"keywords": "cat | face | pouting"
},
{
"code": "🙈",
"name": "see-no-evil monkey",
"keywords": "evil | face | forbidden | monkey | see | see-no-evil monkey"
},
{
"code": "🙉",
"name": "hear-no-evil monkey",
"keywords": "evil | face | forbidden | hear | hear-no-evil monkey | monkey"
},
{
"code": "🙊",
"name": "speak-no-evil monkey",
"keywords": "evil | face | forbidden | monkey | speak | speak-no-evil monkey"
},
{
"code": "💋",
"name": "kiss mark",
"keywords": "kiss | kiss mark | lips"
},
{
"code": "💌",
"name": "love letter",
"keywords": "heart | letter | love | mail"
},
{
"code": "💘",
"name": "heart with arrow",
"keywords": "arrow | cupid | heart with arrow"
},
{
"code": "💝",
"name": "heart with ribbon",
"keywords": "heart with ribbon | ribbon | valentine"
},
{
"code": "💖",
"name": "sparkling heart",
"keywords": "excited | sparkle | sparkling heart"
},
{
"code": "💗",
"name": "growing heart",
"keywords": "excited | growing | growing heart | nervous | pulse"
},
{
"code": "💓",
"name": "beating heart",
"keywords": "beating | beating heart | heartbeat | pulsating"
},
{
"code": "💞",
"name": "revolving hearts",
"keywords": "revolving | revolving hearts"
},
{
"code": "💕",
"name": "two hearts",
"keywords": "love | two hearts"
},
{
"code": "💟",
"name": "heart decoration",
"keywords": "heart | heart decoration"
},
{
"code": "❣",
"name": "heart exclamation",
"keywords": "exclamation | heart exclamation | mark | punctuation"
},
{
"code": "💔",
"name": "broken heart",
"keywords": "break | broken | broken heart"
},
{
"code": "❤️‍🔥",
"name": "heart on fire",
"keywords": "burn | heart | heart on fire | love | lust | sacred heart"
},
{
"code": "❤️‍🩹",
"name": "mending heart",
"keywords": "healthier | improving | mending | mending heart | recovering | recuperating | well"
},
{
"code": "❤",
"name": "red heart",
"keywords": "heart | red heart"
},
{
"code": "🧡",
"name": "orange heart",
"keywords": "orange | orange heart"
},
{
"code": "💛",
"name": "yellow heart",
"keywords": "yellow | yellow heart"
},
{
"code": "💚",
"name": "green heart",
"keywords": "green | green heart"
},
{
"code": "💙",
"name": "blue heart",
"keywords": "blue | blue heart"
},
{
"code": "💜",
"name": "purple heart",
"keywords": "purple | purple heart"
},
{
"code": "🤎",
"name": "brown heart",
"keywords": "brown | heart"
},
{
"code": "🖤",
"name": "black heart",
"keywords": "black | black heart | evil | wicked"
},
{
"code": "🤍",
"name": "white heart",
"keywords": "heart | white"
},
{
"code": "💯",
"name": "hundred points",
"keywords": "100 | full | hundred | hundred points | score"
},
{
"code": "💢",
"name": "anger symbol",
"keywords": "anger symbol | angry | comic | mad"
},
{
"code": "💥",
"name": "collision",
"keywords": "boom | collision | comic"
},
{
"code": "💫",
"name": "dizzy",
"keywords": "comic | dizzy | star"
},
{
"code": "💦",
"name": "sweat droplets",
"keywords": "comic | splashing | sweat | sweat droplets"
},
{
"code": "💨",
"name": "dashing away",
"keywords": "comic | dash | dashing away | running"
},
{
"code": "🕳",
"name": "hole",
"keywords": "hole"
},
{
"code": "💣",
"name": "bomb",
"keywords": "bomb | comic"
},
{
"code": "💬",
"name": "speech balloon",
"keywords": "balloon | bubble | comic | dialog | speech"
},
{
"code": "👁️‍🗨️",
"name": "eye in speech bubble",
"keywords": "eye | eye in speech bubble | speech bubble | witness"
},
{
"code": "🗨",
"name": "left speech bubble",
"keywords": "dialog | left speech bubble | speech"
},
{
"code": "🗯",
"name": "right anger bubble",
"keywords": "angry | balloon | bubble | mad | right anger bubble"
},
{
"code": "💭",
"name": "thought balloon",
"keywords": "balloon | bubble | comic | thought"
},
{
"code": "💤",
"name": "zzz",
"keywords": "comic | sleep | zzz"
},
{
"code": "👋",
"name": "waving hand",
"keywords": "hand | wave | waving"
},
{
"code": "🤚",
"name": "raised back of hand",
"keywords": "backhand | raised | raised back of hand"
},
{
"code": "🖐",
"name": "hand with fingers splayed",
"keywords": "finger | hand | hand with fingers splayed | splayed"
},
{
"code": "✋",
"name": "raised hand",
"keywords": "hand | high 5 | high five | raised hand"
},
{
"code": "🖖",
"name": "vulcan salute",
"keywords": "finger | hand | spock | vulcan | vulcan salute"
},
{
"code": "👌",
"name": "OK hand",
"keywords": "hand | OK"
},
{
"code": "🤌",
"name": "pinched fingers",
"keywords": "fingers | hand gesture | interrogation | pinched | sarcastic"
},
{
"code": "🤏",
"name": "pinching hand",
"keywords": "pinching hand | small amount"
},
{
"code": "✌",
"name": "victory hand",
"keywords": "hand | v | victory"
},
{
"code": "🤞",
"name": "crossed fingers",
"keywords": "cross | crossed fingers | finger | hand | luck"
},
{
"code": "🤟",
"name": "love-you gesture",
"keywords": "hand | ILY | love-you gesture"
},
{
"code": "🤘",
"name": "sign of the horns",
"keywords": "finger | hand | horns | rock-on | sign of the horns"
},
{
"code": "🤙",
"name": "call me hand",
"keywords": "call | call me hand | hand"
},
{
"code": "👈",
"name": "backhand index pointing left",
"keywords": "backhand | backhand index pointing left | finger | hand | index | point"
},
{
"code": "👉",
"name": "backhand index pointing right",
"keywords": "backhand | backhand index pointing right | finger | hand | index | point"
},
{
"code": "👆",
"name": "backhand index pointing up",
"keywords": "backhand | backhand index pointing up | finger | hand | point | up"
},
{
"code": "🖕",
"name": "middle finger",
"keywords": "finger | hand | middle finger"
},
{
"code": "👇",
"name": "backhand index pointing down",
"keywords": "backhand | backhand index pointing down | down | finger | hand | point"
},
{
"code": "☝",
"name": "index pointing up",
"keywords": "finger | hand | index | index pointing up | point | up"
},
{
"code": "👍",
"name": "thumbs up",
"keywords": "+1 | hand | thumb | thumbs up | up"
},
{
"code": "👎",
"name": "thumbs down",
"keywords": "-1 | down | hand | thumb | thumbs down"
},
{
"code": "✊",
"name": "raised fist",
"keywords": "clenched | fist | hand | punch | raised fist"
},
{
"code": "👊",
"name": "oncoming fist",
"keywords": "clenched | fist | hand | oncoming fist | punch"
},
{
"code": "🤛",
"name": "left-facing fist",
"keywords": "fist | left-facing fist | leftwards"
},
{
"code": "🤜",
"name": "right-facing fist",
"keywords": "fist | right-facing fist | rightwards"
},
{
"code": "👏",
"name": "clapping hands",
"keywords": "clap | clapping hands | hand"
},
{
"code": "🙌",
"name": "raising hands",
"keywords": "celebration | gesture | hand | hooray | raised | raising hands"
},
{
"code": "👐",
"name": "open hands",
"keywords": "hand | open | open hands"
},
{
"code": "🤲",
"name": "palms up together",
"keywords": "palms up together | prayer | cupped hands"
},
{
"code": "🤝",
"name": "handshake",
"keywords": "agreement | hand | handshake | meeting | shake"
},
{
"code": "🙏",
"name": "folded hands",
"keywords": "ask | folded hands | hand | high 5 | high five | please | pray | thanks"
},
{
"code": "✍",
"name": "writing hand",
"keywords": "hand | write | writing hand"
},
{
"code": "💅",
"name": "nail polish",
"keywords": "care | cosmetics | manicure | nail | polish"
},
{
"code": "🤳",
"name": "selfie",
"keywords": "camera | phone | selfie"
},
{
"code": "💪",
"name": "flexed biceps",
"keywords": "biceps | comic | flex | flexed biceps | muscle"
},
{
"code": "🦾",
"name": "mechanical arm",
"keywords": "accessibility | mechanical arm | prosthetic"
},
{
"code": "🦿",
"name": "mechanical leg",
"keywords": "accessibility | mechanical leg | prosthetic"
},
{
"code": "🦵",
"name": "leg",
"keywords": "kick | leg | limb"
},
{
"code": "🦶",
"name": "foot",
"keywords": "foot | kick | stomp"
},
{
"code": "👂",
"name": "ear",
"keywords": "body | ear"
},
{
"code": "🦻",
"name": "ear with hearing aid",
"keywords": "accessibility | ear with hearing aid | hard of hearing"
},
{
"code": "👃",
"name": "nose",
"keywords": "body | nose"
},
{
"code": "🧠",
"name": "brain",
"keywords": "brain | intelligent"
},
{
"code": "🫀",
"name": "anatomical heart",
"keywords": "anatomical | cardiology | heart | organ | pulse"
},
{
"code": "🫁",
"name": "lungs",
"keywords": "breath | exhalation | inhalation | lungs | organ | respiration"
},
{
"code": "🦷",
"name": "tooth",
"keywords": "dentist | tooth"
},
{
"code": "🦴",
"name": "bone",
"keywords": "bone | skeleton"
},
{
"code": "👀",
"name": "eyes",
"keywords": "eye | eyes | face"
},
{
"code": "👁",
"name": "eye",
"keywords": "body | eye"
},
{
"code": "👅",
"name": "tongue",
"keywords": "body | tongue"
},
{
"code": "👄",
"name": "mouth",
"keywords": "lips | mouth"
},
{
"code": "👶",
"name": "baby",
"keywords": "baby | young"
},
{
"code": "🧒",
"name": "child",
"keywords": "child | gender-neutral | unspecified gender | young"
},
{
"code": "👦",
"name": "boy",
"keywords": "boy | young"
},
{
"code": "👧",
"name": "girl",
"keywords": "girl | Virgo | young | zodiac"
},
{
"code": "🧑",
"name": "person",
"keywords": "adult | gender-neutral | person | unspecified gender"
},
{
"code": "👱",
"name": "person: blond hair",
"keywords": "blond | blond-haired person | hair | person: blond hair"
},
{
"code": "👨",
"name": "man",
"keywords": "adult | man"
},
{
"code": "🧔",
"name": "person: beard",
"keywords": "beard | person | person: beard | bewhiskered"
},
{
"code": "🧔‍♂️",
"name": "man: beard",
"keywords": "beard | man | man: beard"
},
{
"code": "🧔‍♀️",
"name": "woman: beard",
"keywords": "beard | woman | woman: beard"
},
{
"code": "👨‍🦰",
"name": "man: red hair",
"keywords": "adult | man | red hair"
},
{
"code": "👨‍🦱",
"name": "man: curly hair",
"keywords": "adult | curly hair | man"
},
{
"code": "👨‍🦳",
"name": "man: white hair",
"keywords": "adult | man | white hair"
},
{
"code": "👨‍🦲",
"name": "man: bald",
"keywords": "adult | bald | man"
},
{
"code": "👩",
"name": "woman",
"keywords": "adult | woman"
},
{
"code": "👩‍🦰",
"name": "woman: red hair",
"keywords": "adult | red hair | woman"
},
{
"code": "🧑‍🦰",
"name": "person: red hair",
"keywords": "adult | gender-neutral | person | red hair | unspecified gender"
},
{
"code": "👩‍🦱",
"name": "woman: curly hair",
"keywords": "adult | curly hair | woman"
},
{
"code": "🧑‍🦱",
"name": "person: curly hair",
"keywords": "adult | curly hair | gender-neutral | person | unspecified gender"
},
{
"code": "👩‍🦳",
"name": "woman: white hair",
"keywords": "adult | white hair | woman"
},
{
"code": "🧑‍🦳",
"name": "person: white hair",
"keywords": "adult | gender-neutral | person | unspecified gender | white hair"
},
{
"code": "👩‍🦲",
"name": "woman: bald",
"keywords": "adult | bald | woman"
},
{
"code": "🧑‍🦲",
"name": "person: bald",
"keywords": "adult | bald | gender-neutral | person | unspecified gender"
},
{
"code": "👱‍♀️",
"name": "woman: blond hair",
"keywords": "blond-haired woman | blonde | hair | woman | woman: blond hair"
},
{
"code": "👱‍♂️",
"name": "man: blond hair",
"keywords": "blond | blond-haired man | hair | man | man: blond hair"
},
{
"code": "🧓",
"name": "older person",
"keywords": "adult | gender-neutral | old | older person | unspecified gender"
},
{
"code": "👴",
"name": "old man",
"keywords": "adult | man | old"
},
{
"code": "👵",
"name": "old woman",
"keywords": "adult | old | woman"
},
{
"code": "🙍",
"name": "person frowning",
"keywords": "frown | gesture | person frowning"
},
{
"code": "🙍‍♂️",
"name": "man frowning",
"keywords": "frowning | gesture | man"
},
{
"code": "🙍‍♀️",
"name": "woman frowning",
"keywords": "frowning | gesture | woman"
},
{
"code": "🙎",
"name": "person pouting",
"keywords": "gesture | person pouting | pouting"
},
{
"code": "🙎‍♂️",
"name": "man pouting",
"keywords": "gesture | man | pouting"
},
{
"code": "🙎‍♀️",
"name": "woman pouting",
"keywords": "gesture | pouting | woman"
},
{
"code": "🙅",
"name": "person gesturing NO",
"keywords": "forbidden | gesture | hand | person gesturing NO | prohibited"
},
{
"code": "🙅‍♂️",
"name": "man gesturing NO",
"keywords": "forbidden | gesture | hand | man | man gesturing NO | prohibited"
},
{
"code": "🙅‍♀️",
"name": "woman gesturing NO",
"keywords": "forbidden | gesture | hand | prohibited | woman | woman gesturing NO"
},
{
"code": "🙆",
"name": "person gesturing OK",
"keywords": "gesture | hand | OK | person gesturing OK"
},
{
"code": "🙆‍♂️",
"name": "man gesturing OK",
"keywords": "gesture | hand | man | man gesturing OK | OK"
},
{
"code": "🙆‍♀️",
"name": "woman gesturing OK",
"keywords": "gesture | hand | OK | woman | woman gesturing OK"
},
{
"code": "💁",
"name": "person tipping hand",
"keywords": "hand | help | information | person tipping hand | sassy | tipping"
},
{
"code": "💁‍♂️",
"name": "man tipping hand",
"keywords": "man | man tipping hand | sassy | tipping hand"
},
{
"code": "💁‍♀️",
"name": "woman tipping hand",
"keywords": "sassy | tipping hand | woman | woman tipping hand"
},
{
"code": "🙋",
"name": "person raising hand",
"keywords": "gesture | hand | happy | person raising hand | raised"
},
{
"code": "🙋‍♂️",
"name": "man raising hand",
"keywords": "gesture | man | man raising hand | raising hand"
},
{
"code": "🙋‍♀️",
"name": "woman raising hand",
"keywords": "gesture | raising hand | woman | woman raising hand"
},
{
"code": "🧏",
"name": "deaf person",
"keywords": "accessibility | deaf | deaf person | ear | hear"
},
{
"code": "🧏‍♂️",
"name": "deaf man",
"keywords": "deaf | man"
},
{
"code": "🧏‍♀️",
"name": "deaf woman",
"keywords": "deaf | woman"
},
{
"code": "🙇",
"name": "person bowing",
"keywords": "apology | bow | gesture | person bowing | sorry"
},
{
"code": "🙇‍♂️",
"name": "man bowing",
"keywords": "apology | bowing | favor | gesture | man | sorry"
},
{
"code": "🙇‍♀️",
"name": "woman bowing",
"keywords": "apology | bowing | favor | gesture | sorry | woman"
},
{
"code": "🤦",
"name": "person facepalming",
"keywords": "disbelief | exasperation | face | palm | person facepalming"
},
{
"code": "🤦‍♂️",
"name": "man facepalming",
"keywords": "disbelief | exasperation | facepalm | man | man facepalming"
},
{
"code": "🤦‍♀️",
"name": "woman facepalming",
"keywords": "disbelief | exasperation | facepalm | woman | woman facepalming"
},
{
"code": "🤷",
"name": "person shrugging",
"keywords": "doubt | ignorance | indifference | person shrugging | shrug"
},
{
"code": "🤷‍♂️",
"name": "man shrugging",
"keywords": "doubt | ignorance | indifference | man | man shrugging | shrug"
},
{
"code": "🤷‍♀️",
"name": "woman shrugging",
"keywords": "doubt | ignorance | indifference | shrug | woman | woman shrugging"
},
{
"code": "🧑‍⚕️",
"name": "health worker",
"keywords": "doctor | health worker | healthcare | nurse | therapist"
},
{
"code": "👨‍⚕️",
"name": "man health worker",
"keywords": "doctor | healthcare | man | man health worker | nurse | therapist"
},
{
"code": "👩‍⚕️",
"name": "woman health worker",
"keywords": "doctor | healthcare | nurse | therapist | woman | woman health worker"
},
{
"code": "🧑‍🎓",
"name": "student",
"keywords": "graduate | student"
},
{
"code": "👨‍🎓",
"name": "man student",
"keywords": "graduate | man | student"
},
{
"code": "👩‍🎓",
"name": "woman student",
"keywords": "graduate | student | woman"
},
{
"code": "🧑‍🏫",
"name": "teacher",
"keywords": "instructor | professor | teacher"
},
{
"code": "👨‍🏫",
"name": "man teacher",
"keywords": "instructor | man | professor | teacher"
},
{
"code": "👩‍🏫",
"name": "woman teacher",
"keywords": "instructor | professor | teacher | woman"
},
{
"code": "🧑‍⚖️",
"name": "judge",
"keywords": "judge | justice | scales"
},
{
"code": "👨‍⚖️",
"name": "man judge",
"keywords": "judge | justice | man | scales"
},
{
"code": "👩‍⚖️",
"name": "woman judge",
"keywords": "judge | justice | scales | woman"
},
{
"code": "🧑‍🌾",
"name": "farmer",
"keywords": "farmer | gardener | rancher"
},
{
"code": "👨‍🌾",
"name": "man farmer",
"keywords": "farmer | gardener | man | rancher"
},
{
"code": "👩‍🌾",
"name": "woman farmer",
"keywords": "farmer | gardener | rancher | woman"
},
{
"code": "🧑‍🍳",
"name": "cook",
"keywords": "chef | cook"
},
{
"code": "👨‍🍳",
"name": "man cook",
"keywords": "chef | cook | man"
},
{
"code": "👩‍🍳",
"name": "woman cook",
"keywords": "chef | cook | woman"
},
{
"code": "🧑‍🔧",
"name": "mechanic",
"keywords": "electrician | mechanic | plumber | tradesperson"
},
{
"code": "👨‍🔧",
"name": "man mechanic",
"keywords": "electrician | man | mechanic | plumber | tradesperson"
},
{
"code": "👩‍🔧",
"name": "woman mechanic",
"keywords": "electrician | mechanic | plumber | tradesperson | woman"
},
{
"code": "🧑‍🏭",
"name": "factory worker",
"keywords": "assembly | factory | industrial | worker"
},
{
"code": "👨‍🏭",
"name": "man factory worker",
"keywords": "assembly | factory | industrial | man | worker"
},
{
"code": "👩‍🏭",
"name": "woman factory worker",
"keywords": "assembly | factory | industrial | woman | worker"
},
{
"code": "🧑‍💼",
"name": "office worker",
"keywords": "architect | business | manager | office worker | white-collar"
},
{
"code": "👨‍💼",
"name": "man office worker",
"keywords": "architect | business | man | man office worker | manager | white-collar"
},
{
"code": "👩‍💼",
"name": "woman office worker",
"keywords": "architect | business | manager | white-collar | woman | woman office worker"
},
{
"code": "🧑‍🔬",
"name": "scientist",
"keywords": "biologist | chemist | engineer | physicist | scientist"
},
{
"code": "👨‍🔬",
"name": "man scientist",
"keywords": "biologist | chemist | engineer | man | physicist | scientist"
},
{
"code": "👩‍🔬",
"name": "woman scientist",
"keywords": "biologist | chemist | engineer | physicist | scientist | woman"
},
{
"code": "🧑‍💻",
"name": "technologist",
"keywords": "coder | developer | inventor | software | technologist"
},
{
"code": "👨‍💻",
"name": "man technologist",
"keywords": "coder | developer | inventor | man | software | technologist"
},
{
"code": "👩‍💻",
"name": "woman technologist",
"keywords": "coder | developer | inventor | software | technologist | woman"
},
{
"code": "🧑‍🎤",
"name": "singer",
"keywords": "actor | entertainer | rock | singer | star"
},
{
"code": "👨‍🎤",
"name": "man singer",
"keywords": "actor | entertainer | man | rock | singer | star"
},
{
"code": "👩‍🎤",
"name": "woman singer",
"keywords": "actor | entertainer | rock | singer | star | woman"
},
{
"code": "🧑‍🎨",
"name": "artist",
"keywords": "artist | palette"
},
{
"code": "👨‍🎨",
"name": "man artist",
"keywords": "artist | man | palette"
},
{
"code": "👩‍🎨",
"name": "woman artist",
"keywords": "artist | palette | woman"
},
{
"code": "🧑‍✈️",
"name": "pilot",
"keywords": "pilot | plane"
},
{
"code": "👨‍✈️",
"name": "man pilot",
"keywords": "man | pilot | plane"
},
{
"code": "👩‍✈️",
"name": "woman pilot",
"keywords": "pilot | plane | woman"
},
{
"code": "🧑‍🚀",
"name": "astronaut",
"keywords": "astronaut | rocket"
},
{
"code": "👨‍🚀",
"name": "man astronaut",
"keywords": "astronaut | man | rocket"
},
{
"code": "👩‍🚀",
"name": "woman astronaut",
"keywords": "astronaut | rocket | woman"
},
{
"code": "🧑‍🚒",
"name": "firefighter",
"keywords": "firefighter | firetruck"
},
{
"code": "👨‍🚒",
"name": "man firefighter",
"keywords": "firefighter | firetruck | man"
},
{
"code": "👩‍🚒",
"name": "woman firefighter",
"keywords": "firefighter | firetruck | woman"
},
{
"code": "👮",
"name": "police officer",
"keywords": "cop | officer | police"
},
{
"code": "👮‍♂️",
"name": "man police officer",
"keywords": "cop | man | officer | police"
},
{
"code": "👮‍♀️",
"name": "woman police officer",
"keywords": "cop | officer | police | woman"
},
{
"code": "🕵",
"name": "detective",
"keywords": "detective | sleuth | spy"
},
{
"code": "🕵️‍♂️",
"name": "man detective",
"keywords": "detective | man | sleuth | spy"
},
{
"code": "🕵️‍♀️",
"name": "woman detective",
"keywords": "detective | sleuth | spy | woman"
},
{
"code": "💂",
"name": "guard",
"keywords": "guard"
},
{
"code": "💂‍♂️",
"name": "man guard",
"keywords": "guard | man"
},
{
"code": "💂‍♀️",
"name": "woman guard",
"keywords": "guard | woman"
},
{
"code": "🥷",
"name": "ninja",
"keywords": "fighter | hidden | ninja | stealth"
},
{
"code": "👷",
"name": "construction worker",
"keywords": "construction | hat | worker"
},
{
"code": "👷‍♂️",
"name": "man construction worker",
"keywords": "construction | man | worker"
},
{
"code": "👷‍♀️",
"name": "woman construction worker",
"keywords": "construction | woman | worker"
},
{
"code": "🤴",
"name": "prince",
"keywords": "prince"
},
{
"code": "👸",
"name": "princess",
"keywords": "fairy tale | fantasy | princess"
},
{
"code": "👳",
"name": "person wearing turban",
"keywords": "person wearing turban | turban"
},
{
"code": "👳‍♂️",
"name": "man wearing turban",
"keywords": "man | man wearing turban | turban"
},
{
"code": "👳‍♀️",
"name": "woman wearing turban",
"keywords": "turban | woman | woman wearing turban"
},
{
"code": "👲",
"name": "person with skullcap",
"keywords": "cap | gua pi mao | hat | person | person with skullcap | skullcap"
},
{
"code": "🧕",
"name": "woman with headscarf",
"keywords": "headscarf | hijab | mantilla | tichel | woman with headscarf | bandana | head kerchief"
},
{
"code": "🤵",
"name": "person in tuxedo",
"keywords": "groom | person | person in tuxedo | tuxedo"
},
{
"code": "🤵‍♂️",
"name": "man in tuxedo",
"keywords": "man | man in tuxedo | tuxedo"
},
{
"code": "🤵‍♀️",
"name": "woman in tuxedo",
"keywords": "tuxedo | woman | woman in tuxedo"
},
{
"code": "👰",
"name": "person with veil",
"keywords": "bride | person | person with veil | veil | wedding"
},
{
"code": "👰‍♂️",
"name": "man with veil",
"keywords": "man | man with veil | veil"
},
{
"code": "👰‍♀️",
"name": "woman with veil",
"keywords": "veil | woman | woman with veil"
},
{
"code": "🤰",
"name": "pregnant woman",
"keywords": "pregnant | woman"
},
{
"code": "🤱",
"name": "breast-feeding",
"keywords": "baby | breast | breast-feeding | nursing"
},
{
"code": "👩‍🍼",
"name": "woman feeding baby",
"keywords": "baby | feeding | nursing | woman"
},
{
"code": "👨‍🍼",
"name": "man feeding baby",
"keywords": "baby | feeding | man | nursing"
},
{
"code": "🧑‍🍼",
"name": "person feeding baby",
"keywords": "baby | feeding | nursing | person"
},
{
"code": "👼",
"name": "baby angel",
"keywords": "angel | baby | face | fairy tale | fantasy"
},
{
"code": "🎅",
"name": "Santa Claus",
"keywords": "celebration | Christmas | claus | father | santa | Santa Claus"
},
{
"code": "🤶",
"name": "Mrs. Claus",
"keywords": "celebration | Christmas | claus | mother | Mrs. | Mrs. Claus"
},
{
"code": "🧑‍🎄",
"name": "mx claus",
"keywords": "Claus, christmas | mx claus"
},
{
"code": "🦸",
"name": "superhero",
"keywords": "good | hero | heroine | superhero | superpower"
},
{
"code": "🦸‍♂️",
"name": "man superhero",
"keywords": "good | hero | man | man superhero | superpower"
},
{
"code": "🦸‍♀️",
"name": "woman superhero",
"keywords": "good | hero | heroine | superpower | woman | woman superhero"
},
{
"code": "🦹",
"name": "supervillain",
"keywords": "criminal | evil | superpower | supervillain | villain"
},
{
"code": "🦹‍♂️",
"name": "man supervillain",
"keywords": "criminal | evil | man | man supervillain | superpower | villain"
},
{
"code": "🦹‍♀️",
"name": "woman supervillain",
"keywords": "criminal | evil | superpower | villain | woman | woman supervillain"
},
{
"code": "🧙",
"name": "mage",
"keywords": "mage | sorcerer | sorceress | witch | wizard"
},
{
"code": "🧙‍♂️",
"name": "man mage",
"keywords": "man mage | sorcerer | wizard"
},
{
"code": "🧙‍♀️",
"name": "woman mage",
"keywords": "sorceress | witch | woman mage"
},
{
"code": "🧚",
"name": "fairy",
"keywords": "fairy | Oberon | Puck | Titania"
},
{
"code": "🧚‍♂️",
"name": "man fairy",
"keywords": "man fairy | Oberon | Puck"
},
{
"code": "🧚‍♀️",
"name": "woman fairy",
"keywords": "Titania | woman fairy"
},
{
"code": "🧛",
"name": "vampire",
"keywords": "Dracula | undead | vampire"
},
{
"code": "🧛‍♂️",
"name": "man vampire",
"keywords": "Dracula | man vampire | undead"
},
{
"code": "🧛‍♀️",
"name": "woman vampire",
"keywords": "undead | woman vampire"
},
{
"code": "🧜",
"name": "merperson",
"keywords": "mermaid | merman | merperson | merwoman"
},
{
"code": "🧜‍♂️",
"name": "merman",
"keywords": "merman | Triton"
},
{
"code": "🧜‍♀️",
"name": "mermaid",
"keywords": "mermaid | merwoman"
},
{
"code": "🧝",
"name": "elf",
"keywords": "elf | magical | LOTR style"
},
{
"code": "🧝‍♂️",
"name": "man elf",
"keywords": "magical | man elf"
},
{
"code": "🧝‍♀️",
"name": "woman elf",
"keywords": "magical | woman elf"
},
{
"code": "🧞",
"name": "genie",
"keywords": "djinn | genie | (non-human color)"
},
{
"code": "🧞‍♂️",
"name": "man genie",
"keywords": "djinn | man genie"
},
{
"code": "🧞‍♀️",
"name": "woman genie",
"keywords": "djinn | woman genie"
},
{
"code": "🧟",
"name": "zombie",
"keywords": "undead | walking dead | zombie | (non-human color)"
},
{
"code": "🧟‍♂️",
"name": "man zombie",
"keywords": "man zombie | undead | walking dead"
},
{
"code": "🧟‍♀️",
"name": "woman zombie",
"keywords": "undead | walking dead | woman zombie"
},
{
"code": "💆",
"name": "person getting massage",
"keywords": "face | massage | person getting massage | salon"
},
{
"code": "💆‍♂️",
"name": "man getting massage",
"keywords": "face | man | man getting massage | massage"
},
{
"code": "💆‍♀️",
"name": "woman getting massage",
"keywords": "face | massage | woman | woman getting massage"
},
{
"code": "💇",
"name": "person getting haircut",
"keywords": "barber | beauty | haircut | parlor | person getting haircut"
},
{
"code": "💇‍♂️",
"name": "man getting haircut",
"keywords": "haircut | man | man getting haircut"
},
{
"code": "💇‍♀️",
"name": "woman getting haircut",
"keywords": "haircut | woman | woman getting haircut"
},
{
"code": "🚶",
"name": "person walking",
"keywords": "hike | person walking | walk | walking"
},
{
"code": "🚶‍♂️",
"name": "man walking",
"keywords": "hike | man | man walking | walk"
},
{
"code": "🚶‍♀️",
"name": "woman walking",
"keywords": "hike | walk | woman | woman walking"
},
{
"code": "🧍",
"name": "person standing",
"keywords": "person standing | stand | standing"
},
{
"code": "🧍‍♂️",
"name": "man standing",
"keywords": "man | standing"
},
{
"code": "🧍‍♀️",
"name": "woman standing",
"keywords": "standing | woman"
},
{
"code": "🧎",
"name": "person kneeling",
"keywords": "kneel | kneeling | person kneeling"
},
{
"code": "🧎‍♂️",
"name": "man kneeling",
"keywords": "kneeling | man"
},
{
"code": "🧎‍♀️",
"name": "woman kneeling",
"keywords": "kneeling | woman"
},
{
"code": "🧑‍🦯",
"name": "person with white cane",
"keywords": "accessibility | blind | person with white cane"
},
{
"code": "👨‍🦯",
"name": "man with white cane",
"keywords": "accessibility | blind | man | man with white cane"
},
{
"code": "👩‍🦯",
"name": "woman with white cane",
"keywords": "accessibility | blind | woman | woman with white cane"
},
{
"code": "🧑‍🦼",
"name": "person in motorized wheelchair",
"keywords": "accessibility | person in motorized wheelchair | wheelchair"
},
{
"code": "👨‍🦼",
"name": "man in motorized wheelchair",
"keywords": "accessibility | man | man in motorized wheelchair | wheelchair"
},
{
"code": "👩‍🦼",
"name": "woman in motorized wheelchair",
"keywords": "accessibility | wheelchair | woman | woman in motorized wheelchair"
},
{
"code": "🧑‍🦽",
"name": "person in manual wheelchair",
"keywords": "accessibility | person in manual wheelchair | wheelchair"
},
{
"code": "👨‍🦽",
"name": "man in manual wheelchair",
"keywords": "accessibility | man | man in manual wheelchair | wheelchair"
},
{
"code": "👩‍🦽",
"name": "woman in manual wheelchair",
"keywords": "accessibility | wheelchair | woman | woman in manual wheelchair"
},
{
"code": "🏃",
"name": "person running",
"keywords": "marathon | person running | running"
},
{
"code": "🏃‍♂️",
"name": "man running",
"keywords": "man | marathon | racing | running"
},
{
"code": "🏃‍♀️",
"name": "woman running",
"keywords": "marathon | racing | running | woman"
},
{
"code": "💃",
"name": "woman dancing",
"keywords": "dance | dancing | woman"
},
{
"code": "🕺",
"name": "man dancing",
"keywords": "dance | dancing | man"
},
{
"code": "🕴",
"name": "person in suit levitating",
"keywords": "business | person | person in suit levitating | suit"
},
{
"code": "👯",
"name": "people with bunny ears",
"keywords": "bunny ear | dancer | partying | people with bunny ears"
},
{
"code": "👯‍♂️",
"name": "men with bunny ears",
"keywords": "bunny ear | dancer | men | men with bunny ears | partying"
},
{
"code": "👯‍♀️",
"name": "women with bunny ears",
"keywords": "bunny ear | dancer | partying | women | women with bunny ears"
},
{
"code": "🧖",
"name": "person in steamy room",
"keywords": "person in steamy room | sauna | steam room | hamam | steambath"
},
{
"code": "🧖‍♂️",
"name": "man in steamy room",
"keywords": "man in steamy room | sauna | steam room"
},
{
"code": "🧖‍♀️",
"name": "woman in steamy room",
"keywords": "sauna | steam room | woman in steamy room"
},
{
"code": "🧗",
"name": "person climbing",
"keywords": "climber | person climbing"
},
{
"code": "🧗‍♂️",
"name": "man climbing",
"keywords": "climber | man climbing"
},
{
"code": "🧗‍♀️",
"name": "woman climbing",
"keywords": "climber | woman climbing"
},
{
"code": "🤺",
"name": "person fencing",
"keywords": "fencer | fencing | person fencing | sword"
},
{
"code": "🏇",
"name": "horse racing",
"keywords": "horse | jockey | racehorse | racing"
},
{
"code": "⛷",
"name": "skier",
"keywords": "ski | skier | snow"
},
{
"code": "🏂",
"name": "snowboarder",
"keywords": "ski | snow | snowboard | snowboarder"
},
{
"code": "🏌",
"name": "person golfing",
"keywords": "ball | golf | person golfing"
},
{
"code": "🏌️‍♂️",
"name": "man golfing",
"keywords": "golf | man | man golfing"
},
{
"code": "🏌️‍♀️",
"name": "woman golfing",
"keywords": "golf | woman | woman golfing"
},
{
"code": "🏄",
"name": "person surfing",
"keywords": "person surfing | surfing"
},
{
"code": "🏄‍♂️",
"name": "man surfing",
"keywords": "man | surfing"
},
{
"code": "🏄‍♀️",
"name": "woman surfing",
"keywords": "surfing | woman"
},
{
"code": "🚣",
"name": "person rowing boat",
"keywords": "boat | person rowing boat | rowboat"
},
{
"code": "🚣‍♂️",
"name": "man rowing boat",
"keywords": "boat | man | man rowing boat | rowboat"
},
{
"code": "🚣‍♀️",
"name": "woman rowing boat",
"keywords": "boat | rowboat | woman | woman rowing boat"
},
{
"code": "🏊",
"name": "person swimming",
"keywords": "person swimming | swim"
},
{
"code": "🏊‍♂️",
"name": "man swimming",
"keywords": "man | man swimming | swim"
},
{
"code": "🏊‍♀️",
"name": "woman swimming",
"keywords": "swim | woman | woman swimming"
},
{
"code": "⛹",
"name": "person bouncing ball",
"keywords": "ball | person bouncing ball"
},
{
"code": "⛹️‍♂️",
"name": "man bouncing ball",
"keywords": "ball | man | man bouncing ball"
},
{
"code": "⛹️‍♀️",
"name": "woman bouncing ball",
"keywords": "ball | woman | woman bouncing ball"
},
{
"code": "🏋",
"name": "person lifting weights",
"keywords": "lifter | person lifting weights | weight"
},
{
"code": "🏋️‍♂️",
"name": "man lifting weights",
"keywords": "man | man lifting weights | weight lifter"
},
{
"code": "🏋️‍♀️",
"name": "woman lifting weights",
"keywords": "weight lifter | woman | woman lifting weights"
},
{
"code": "🚴",
"name": "person biking",
"keywords": "bicycle | biking | cyclist | person biking"
},
{
"code": "🚴‍♂️",
"name": "man biking",
"keywords": "bicycle | biking | cyclist | man"
},
{
"code": "🚴‍♀️",
"name": "woman biking",
"keywords": "bicycle | biking | cyclist | woman"
},
{
"code": "🚵",
"name": "person mountain biking",
"keywords": "bicycle | bicyclist | bike | cyclist | mountain | person mountain biking"
},
{
"code": "🚵‍♂️",
"name": "man mountain biking",
"keywords": "bicycle | bike | cyclist | man | man mountain biking | mountain"
},
{
"code": "🚵‍♀️",
"name": "woman mountain biking",
"keywords": "bicycle | bike | biking | cyclist | mountain | woman"
},
{
"code": "🤸",
"name": "person cartwheeling",
"keywords": "cartwheel | gymnastics | person cartwheeling"
},
{
"code": "🤸‍♂️",
"name": "man cartwheeling",
"keywords": "cartwheel | gymnastics | man | man cartwheeling"
},
{
"code": "🤸‍♀️",
"name": "woman cartwheeling",
"keywords": "cartwheel | gymnastics | woman | woman cartwheeling"
},
{
"code": "🤼",
"name": "people wrestling",
"keywords": "people wrestling | wrestle | wrestler"
},
{
"code": "🤼‍♂️",
"name": "men wrestling",
"keywords": "men | men wrestling | wrestle"
},
{
"code": "🤼‍♀️",
"name": "women wrestling",
"keywords": "women | women wrestling | wrestle"
},
{
"code": "🤽",
"name": "person playing water polo",
"keywords": "person playing water polo | polo | water"
},
{
"code": "🤽‍♂️",
"name": "man playing water polo",
"keywords": "man | man playing water polo | water polo"
},
{
"code": "🤽‍♀️",
"name": "woman playing water polo",
"keywords": "water polo | woman | woman playing water polo"
},
{
"code": "🤾",
"name": "person playing handball",
"keywords": "ball | handball | person playing handball"
},
{
"code": "🤾‍♂️",
"name": "man playing handball",
"keywords": "handball | man | man playing handball"
},
{
"code": "🤾‍♀️",
"name": "woman playing handball",
"keywords": "handball | woman | woman playing handball"
},
{
"code": "🤹",
"name": "person juggling",
"keywords": "balance | juggle | multitask | person juggling | skill"
},
{
"code": "🤹‍♂️",
"name": "man juggling",
"keywords": "juggling | man | multitask"
},
{
"code": "🤹‍♀️",
"name": "woman juggling",
"keywords": "juggling | multitask | woman"
},
{
"code": "🧘",
"name": "person in lotus position",
"keywords": "meditation | person in lotus position | yoga | serenity"
},
{
"code": "🧘‍♂️",
"name": "man in lotus position",
"keywords": "man in lotus position | meditation | yoga"
},
{
"code": "🧘‍♀️",
"name": "woman in lotus position",
"keywords": "meditation | woman in lotus position | yoga"
},
{
"code": "🛀",
"name": "person taking bath",
"keywords": "bath | bathtub | person taking bath"
},
{
"code": "🛌",
"name": "person in bed",
"keywords": "hotel | person in bed | sleep"
},
{
"code": "🧑‍🤝‍🧑",
"name": "people holding hands",
"keywords": "couple | hand | hold | holding hands | people holding hands | person"
},
{
"code": "👭",
"name": "women holding hands",
"keywords": "couple | hand | holding hands | women | women holding hands"
},
{
"code": "👫",
"name": "woman and man holding hands",
"keywords": "couple | hand | hold | holding hands | man | woman | woman and man holding hands"
},
{
"code": "👬",
"name": "men holding hands",
"keywords": "couple | Gemini | holding hands | man | men | men holding hands | twins | zodiac"
},
{
"code": "💏",
"name": "kiss",
"keywords": "couple | kiss"
},
{
"code": "👩‍❤️‍💋‍👨",
"name": "kiss: woman, man",
"keywords": "couple | kiss | man | woman"
},
{
"code": "👨‍❤️‍💋‍👨",
"name": "kiss: man, man",
"keywords": "couple | kiss | man"
},
{
"code": "👩‍❤️‍💋‍👩",
"name": "kiss: woman, woman",
"keywords": "couple | kiss | woman"
},
{
"code": "💑",
"name": "couple with heart",
"keywords": "couple | couple with heart | love"
},
{
"code": "👩‍❤️‍👨",
"name": "couple with heart: woman, man",
"keywords": "couple | couple with heart | love | man | woman"
},
{
"code": "👨‍❤️‍👨",
"name": "couple with heart: man, man",
"keywords": "couple | couple with heart | love | man"
},
{
"code": "👩‍❤️‍👩",
"name": "couple with heart: woman, woman",
"keywords": "couple | couple with heart | love | woman"
},
{
"code": "👪",
"name": "family",
"keywords": "family"
},
{
"code": "👨‍👩‍👦",
"name": "family: man, woman, boy",
"keywords": "boy | family | man | woman"
},
{
"code": "👨‍👩‍👧",
"name": "family: man, woman, girl",
"keywords": "family | girl | man | woman"
},
{
"code": "👨‍👩‍👧‍👦",
"name": "family: man, woman, girl, boy",
"keywords": "boy | family | girl | man | woman"
},
{
"code": "👨‍👩‍👦‍👦",
"name": "family: man, woman, boy, boy",
"keywords": "boy | family | man | woman"
},
{
"code": "👨‍👩‍👧‍👧",
"name": "family: man, woman, girl, girl",
"keywords": "family | girl | man | woman"
},
{
"code": "👨‍👨‍👦",
"name": "family: man, man, boy",
"keywords": "boy | family | man"
},
{
"code": "👨‍👨‍👧",
"name": "family: man, man, girl",
"keywords": "family | girl | man"
},
{
"code": "👨‍👨‍👧‍👦",
"name": "family: man, man, girl, boy",
"keywords": "boy | family | girl | man"
},
{
"code": "👨‍👨‍👦‍👦",
"name": "family: man, man, boy, boy",
"keywords": "boy | family | man"
},
{
"code": "👨‍👨‍👧‍👧",
"name": "family: man, man, girl, girl",
"keywords": "family | girl | man"
},
{
"code": "👩‍👩‍👦",
"name": "family: woman, woman, boy",
"keywords": "boy | family | woman"
},
{
"code": "👩‍👩‍👧",
"name": "family: woman, woman, girl",
"keywords": "family | girl | woman"
},
{
"code": "👩‍👩‍👧‍👦",
"name": "family: woman, woman, girl, boy",
"keywords": "boy | family | girl | woman"
},
{
"code": "👩‍👩‍👦‍👦",
"name": "family: woman, woman, boy, boy",
"keywords": "boy | family | woman"
},
{
"code": "👩‍👩‍👧‍👧",
"name": "family: woman, woman, girl, girl",
"keywords": "family | girl | woman"
},
{
"code": "👨‍👦",
"name": "family: man, boy",
"keywords": "boy | family | man"
},
{
"code": "👨‍👦‍👦",
"name": "family: man, boy, boy",
"keywords": "boy | family | man"
},
{
"code": "👨‍👧",
"name": "family: man, girl",
"keywords": "family | girl | man"
},
{
"code": "👨‍👧‍👦",
"name": "family: man, girl, boy",
"keywords": "boy | family | girl | man"
},
{
"code": "👨‍👧‍👧",
"name": "family: man, girl, girl",
"keywords": "family | girl | man"
},
{
"code": "👩‍👦",
"name": "family: woman, boy",
"keywords": "boy | family | woman"
},
{
"code": "👩‍👦‍👦",
"name": "family: woman, boy, boy",
"keywords": "boy | family | woman"
},
{
"code": "👩‍👧",
"name": "family: woman, girl",
"keywords": "family | girl | woman"
},
{
"code": "👩‍👧‍👦",
"name": "family: woman, girl, boy",
"keywords": "boy | family | girl | woman"
},
{
"code": "👩‍👧‍👧",
"name": "family: woman, girl, girl",
"keywords": "family | girl | woman"
},
{
"code": "🗣",
"name": "speaking head",
"keywords": "face | head | silhouette | speak | speaking"
},
{
"code": "👤",
"name": "bust in silhouette",
"keywords": "bust | bust in silhouette | silhouette"
},
{
"code": "👥",
"name": "busts in silhouette",
"keywords": "bust | busts in silhouette | silhouette"
},
{
"code": "🫂",
"name": "people hugging",
"keywords": "goodbye | hello | hug | people hugging | thanks"
},
{
"code": "👣",
"name": "footprints",
"keywords": "clothing | footprint | footprints | print"
},
{
"code": "🦰",
"name": "red hair",
"keywords": "ginger | red hair | redhead"
},
{
"code": "🦱",
"name": "curly hair",
"keywords": "afro | curly | curly hair | ringlets"
},
{
"code": "🦳",
"name": "white hair",
"keywords": "gray | hair | old | white"
},
{
"code": "🦲",
"name": "bald",
"keywords": "bald | chemotherapy | hairless | no hair | shaven"
},
{
"code": "🐵",
"name": "monkey face",
"keywords": "face | monkey"
},
{
"code": "🐒",
"name": "monkey",
"keywords": "monkey"
},
{
"code": "🦍",
"name": "gorilla",
"keywords": "gorilla"
},
{
"code": "🦧",
"name": "orangutan",
"keywords": "ape | orangutan"
},
{
"code": "🐶",
"name": "dog face",
"keywords": "dog | face | pet"
},
{
"code": "🐕",
"name": "dog",
"keywords": "dog | pet"
},
{
"code": "🦮",
"name": "guide dog",
"keywords": "accessibility | blind | guide | guide dog"
},
{
"code": "🐕‍🦺",
"name": "service dog",
"keywords": "accessibility | assistance | dog | service"
},
{
"code": "🐩",
"name": "poodle",
"keywords": "dog | poodle"
},
{
"code": "🐺",
"name": "wolf",
"keywords": "face | wolf"
},
{
"code": "🦊",
"name": "fox",
"keywords": "face | fox"
},
{
"code": "🦝",
"name": "raccoon",
"keywords": "curious | raccoon | sly"
},
{
"code": "🐱",
"name": "cat face",
"keywords": "cat | face | pet"
},
{
"code": "🐈",
"name": "cat",
"keywords": "cat | pet"
},
{
"code": "🐈‍⬛",
"name": "black cat",
"keywords": "black | cat | unlucky"
},
{
"code": "🦁",
"name": "lion",
"keywords": "face | Leo | lion | zodiac"
},
{
"code": "🐯",
"name": "tiger face",
"keywords": "face | tiger"
},
{
"code": "🐅",
"name": "tiger",
"keywords": "tiger"
},
{
"code": "🐆",
"name": "leopard",
"keywords": "leopard"
},
{
"code": "🐴",
"name": "horse face",
"keywords": "face | horse"
},
{
"code": "🐎",
"name": "horse",
"keywords": "equestrian | horse | racehorse | racing"
},
{
"code": "🦄",
"name": "unicorn",
"keywords": "face | unicorn"
},
{
"code": "🦓",
"name": "zebra",
"keywords": "stripe | zebra"
},
{
"code": "🦌",
"name": "deer",
"keywords": "deer"
},
{
"code": "🦬",
"name": "bison",
"keywords": "bison | buffalo | herd | wisent"
},
{
"code": "🐮",
"name": "cow face",
"keywords": "cow | face"
},
{
"code": "🐂",
"name": "ox",
"keywords": "bull | ox | Taurus | zodiac"
},
{
"code": "🐃",
"name": "water buffalo",
"keywords": "buffalo | water"
},
{
"code": "🐄",
"name": "cow",
"keywords": "cow"
},
{
"code": "🐷",
"name": "pig face",
"keywords": "face | pig"
},
{
"code": "🐖",
"name": "pig",
"keywords": "pig | sow"
},
{
"code": "🐗",
"name": "boar",
"keywords": "boar | pig"
},
{
"code": "🐽",
"name": "pig nose",
"keywords": "face | nose | pig"
},
{
"code": "🐏",
"name": "ram",
"keywords": "Aries | male | ram | sheep | zodiac"
},
{
"code": "🐑",
"name": "ewe",
"keywords": "ewe | female | sheep"
},
{
"code": "🐐",
"name": "goat",
"keywords": "Capricorn | goat | zodiac"
},
{
"code": "🐪",
"name": "camel",
"keywords": "camel | dromedary | hump"
},
{
"code": "🐫",
"name": "two-hump camel",
"keywords": "bactrian | camel | hump | two-hump camel"
},
{
"code": "🦙",
"name": "llama",
"keywords": "alpaca | guanaco | llama | vicuña | wool"
},
{
"code": "🦒",
"name": "giraffe",
"keywords": "giraffe | spots"
},
{
"code": "🐘",
"name": "elephant",
"keywords": "elephant"
},
{
"code": "🦣",
"name": "mammoth",
"keywords": "extinction | large | mammoth | tusk | woolly"
},
{
"code": "🦏",
"name": "rhinoceros",
"keywords": "rhinoceros"
},
{
"code": "🦛",
"name": "hippopotamus",
"keywords": "hippo | hippopotamus"
},
{
"code": "🐭",
"name": "mouse face",
"keywords": "face | mouse"
},
{
"code": "🐁",
"name": "mouse",
"keywords": "mouse"
},
{
"code": "🐀",
"name": "rat",
"keywords": "rat"
},
{
"code": "🐹",
"name": "hamster",
"keywords": "face | hamster | pet"
},
{
"code": "🐰",
"name": "rabbit face",
"keywords": "bunny | face | pet | rabbit"
},
{
"code": "🐇",
"name": "rabbit",
"keywords": "bunny | pet | rabbit"
},
{
"code": "🐿",
"name": "chipmunk",
"keywords": "chipmunk | squirrel"
},
{
"code": "🦫",
"name": "beaver",
"keywords": "beaver | dam"
},
{
"code": "🦔",
"name": "hedgehog",
"keywords": "hedgehog | spiny"
},
{
"code": "🦇",
"name": "bat",
"keywords": "bat | vampire"
},
{
"code": "🐻",
"name": "bear",
"keywords": "bear | face"
},
{
"code": "🐻‍❄️",
"name": "polar bear",
"keywords": "arctic | bear | polar bear | white"
},
{
"code": "🐨",
"name": "koala",
"keywords": "bear | koala"
},
{
"code": "🐼",
"name": "panda",
"keywords": "face | panda"
},
{
"code": "🦥",
"name": "sloth",
"keywords": "lazy | sloth | slow"
},
{
"code": "🦦",
"name": "otter",
"keywords": "fishing | otter | playful"
},
{
"code": "🦨",
"name": "skunk",
"keywords": "skunk | stink"
},
{
"code": "🦘",
"name": "kangaroo",
"keywords": "Australia | joey | jump | kangaroo | marsupial"
},
{
"code": "🦡",
"name": "badger",
"keywords": "badger | honey badger | pester"
},
{
"code": "🐾",
"name": "paw prints",
"keywords": "feet | paw | paw prints | print"
},
{
"code": "🦃",
"name": "turkey",
"keywords": "bird | turkey"
},
{
"code": "🐔",
"name": "chicken",
"keywords": "bird | chicken"
},
{
"code": "🐓",
"name": "rooster",
"keywords": "bird | rooster"
},
{
"code": "🐣",
"name": "hatching chick",
"keywords": "baby | bird | chick | hatching"
},
{
"code": "🐤",
"name": "baby chick",
"keywords": "baby | bird | chick"
},
{
"code": "🐥",
"name": "front-facing baby chick",
"keywords": "baby | bird | chick | front-facing baby chick"
},
{
"code": "🐦",
"name": "bird",
"keywords": "bird"
},
{
"code": "🐧",
"name": "penguin",
"keywords": "bird | penguin"
},
{
"code": "🕊",
"name": "dove",
"keywords": "bird | dove | fly | peace"
},
{
"code": "🦅",
"name": "eagle",
"keywords": "bird | eagle"
},
{
"code": "🦆",
"name": "duck",
"keywords": "bird | duck"
},
{
"code": "🦢",
"name": "swan",
"keywords": "bird | cygnet | swan | ugly duckling"
},
{
"code": "🦉",
"name": "owl",
"keywords": "bird | owl | wise"
},
{
"code": "🦤",
"name": "dodo",
"keywords": "dodo | extinction | large | Mauritius"
},
{
"code": "🪶",
"name": "feather",
"keywords": "bird | feather | flight | light | plumage"
},
{
"code": "🦩",
"name": "flamingo",
"keywords": "flamboyant | flamingo | tropical"
},
{
"code": "🦚",
"name": "peacock",
"keywords": "bird | ostentatious | peacock | peahen | proud"
},
{
"code": "🦜",
"name": "parrot",
"keywords": "bird | parrot | pirate | talk"
},
{
"code": "🐸",
"name": "frog",
"keywords": "face | frog"
},
{
"code": "🐊",
"name": "crocodile",
"keywords": "crocodile"
},
{
"code": "🐢",
"name": "turtle",
"keywords": "terrapin | tortoise | turtle"
},
{
"code": "🦎",
"name": "lizard",
"keywords": "lizard | reptile"
},
{
"code": "🐍",
"name": "snake",
"keywords": "bearer | Ophiuchus | serpent | snake | zodiac"
},
{
"code": "🐲",
"name": "dragon face",
"keywords": "dragon | face | fairy tale"
},
{
"code": "🐉",
"name": "dragon",
"keywords": "dragon | fairy tale"
},
{
"code": "🦕",
"name": "sauropod",
"keywords": "brachiosaurus | brontosaurus | diplodocus | sauropod"
},
{
"code": "🦖",
"name": "T-Rex",
"keywords": "T-Rex | Tyrannosaurus Rex"
},
{
"code": "🐳",
"name": "spouting whale",
"keywords": "face | spouting | whale"
},
{
"code": "🐋",
"name": "whale",
"keywords": "whale"
},
{
"code": "🐬",
"name": "dolphin",
"keywords": "dolphin | flipper"
},
{
"code": "🦭",
"name": "seal",
"keywords": "sea Lion | seal"
},
{
"code": "🐟",
"name": "fish",
"keywords": "fish | Pisces | zodiac"
},
{
"code": "🐠",
"name": "tropical fish",
"keywords": "fish | tropical"
},
{
"code": "🐡",
"name": "blowfish",
"keywords": "blowfish | fish"
},
{
"code": "🦈",
"name": "shark",
"keywords": "fish | shark"
},
{
"code": "🐙",
"name": "octopus",
"keywords": "octopus"
},
{
"code": "🐚",
"name": "spiral shell",
"keywords": "shell | spiral"
},
{
"code": "🐌",
"name": "snail",
"keywords": "snail"
},
{
"code": "🦋",
"name": "butterfly",
"keywords": "butterfly | insect | pretty"
},
{
"code": "🐛",
"name": "bug",
"keywords": "bug | insect"
},
{
"code": "🐜",
"name": "ant",
"keywords": "ant | insect"
},
{
"code": "🐝",
"name": "honeybee",
"keywords": "bee | honeybee | insect"
},
{
"code": "🪲",
"name": "beetle",
"keywords": "beetle | bug | insect"
},
{
"code": "🐞",
"name": "lady beetle",
"keywords": "beetle | insect | lady beetle | ladybird | ladybug"
},
{
"code": "🦗",
"name": "cricket",
"keywords": "cricket | grasshopper | Orthoptera"
},
{
"code": "🪳",
"name": "cockroach",
"keywords": "cockroach | insect | pest | roach"
},
{
"code": "🕷",
"name": "spider",
"keywords": "insect | spider"
},
{
"code": "🕸",
"name": "spider web",
"keywords": "spider | web"
},
{
"code": "🦂",
"name": "scorpion",
"keywords": "scorpio | Scorpio | scorpion | zodiac"
},
{
"code": "🦟",
"name": "mosquito",
"keywords": "disease | fever | malaria | mosquito | pest | virus"
},
{
"code": "🪰",
"name": "fly",
"keywords": "disease | fly | maggot | pest | rotting"
},
{
"code": "🪱",
"name": "worm",
"keywords": "annelid | earthworm | parasite | worm"
},
{
"code": "🦠",
"name": "microbe",
"keywords": "amoeba | bacteria | microbe | virus"
},
{
"code": "💐",
"name": "bouquet",
"keywords": "bouquet | flower"
},
{
"code": "🌸",
"name": "cherry blossom",
"keywords": "blossom | cherry | flower"
},
{
"code": "💮",
"name": "white flower",
"keywords": "flower | white flower"
},
{
"code": "🏵",
"name": "rosette",
"keywords": "plant | rosette"
},
{
"code": "🌹",
"name": "rose",
"keywords": "flower | rose"
},
{
"code": "🥀",
"name": "wilted flower",
"keywords": "flower | wilted"
},
{
"code": "🌺",
"name": "hibiscus",
"keywords": "flower | hibiscus"
},
{
"code": "🌻",
"name": "sunflower",
"keywords": "flower | sun | sunflower"
},
{
"code": "🌼",
"name": "blossom",
"keywords": "blossom | flower"
},
{
"code": "🌷",
"name": "tulip",
"keywords": "flower | tulip"
},
{
"code": "🌱",
"name": "seedling",
"keywords": "seedling | young"
},
{
"code": "🪴",
"name": "potted plant",
"keywords": "boring | grow | house | nurturing | plant | potted plant | useless"
},
{
"code": "🌲",
"name": "evergreen tree",
"keywords": "evergreen tree | tree"
},
{
"code": "🌳",
"name": "deciduous tree",
"keywords": "deciduous | shedding | tree"
},
{
"code": "🌴",
"name": "palm tree",
"keywords": "palm | tree"
},
{
"code": "🌵",
"name": "cactus",
"keywords": "cactus | plant"
},
{
"code": "🌾",
"name": "sheaf of rice",
"keywords": "ear | grain | rice | sheaf of rice"
},
{
"code": "🌿",
"name": "herb",
"keywords": "herb | leaf"
},
{
"code": "☘",
"name": "shamrock",
"keywords": "plant | shamrock"
},
{
"code": "🍀",
"name": "four leaf clover",
"keywords": "4 | clover | four | four-leaf clover | leaf"
},
{
"code": "🍁",
"name": "maple leaf",
"keywords": "falling | leaf | maple"
},
{
"code": "🍂",
"name": "fallen leaf",
"keywords": "fallen leaf | falling | leaf"
},
{
"code": "🍃",
"name": "leaf fluttering in wind",
"keywords": "blow | flutter | leaf | leaf fluttering in wind | wind"
},
{
"code": "🍇",
"name": "grapes",
"keywords": "fruit | grape | grapes"
},
{
"code": "🍈",
"name": "melon",
"keywords": "fruit | melon"
},
{
"code": "🍉",
"name": "watermelon",
"keywords": "fruit | watermelon"
},
{
"code": "🍊",
"name": "tangerine",
"keywords": "fruit | orange | tangerine"
},
{
"code": "🍋",
"name": "lemon",
"keywords": "citrus | fruit | lemon"
},
{
"code": "🍌",
"name": "banana",
"keywords": "banana | fruit"
},
{
"code": "🍍",
"name": "pineapple",
"keywords": "fruit | pineapple"
},
{
"code": "🥭",
"name": "mango",
"keywords": "fruit | mango | tropical"
},
{
"code": "🍎",
"name": "red apple",
"keywords": "apple | fruit | red"
},
{
"code": "🍏",
"name": "green apple",
"keywords": "apple | fruit | green"
},
{
"code": "🍐",
"name": "pear",
"keywords": "fruit | pear"
},
{
"code": "🍑",
"name": "peach",
"keywords": "fruit | peach"
},
{
"code": "🍒",
"name": "cherries",
"keywords": "berries | cherries | cherry | fruit | red"
},
{
"code": "🍓",
"name": "strawberry",
"keywords": "berry | fruit | strawberry"
},
{
"code": "🫐",
"name": "blueberries",
"keywords": "berry | bilberry | blue | blueberries | blueberry"
},
{
"code": "🥝",
"name": "kiwi fruit",
"keywords": "food | fruit | kiwi"
},
{
"code": "🍅",
"name": "tomato",
"keywords": "fruit | tomato | vegetable"
},
{
"code": "🫒",
"name": "olive",
"keywords": "food | olive"
},
{
"code": "🥥",
"name": "coconut",
"keywords": "coconut | palm | piña colada"
},
{
"code": "🥑",
"name": "avocado",
"keywords": "avocado | food | fruit"
},
{
"code": "🍆",
"name": "eggplant",
"keywords": "aubergine | eggplant | vegetable"
},
{
"code": "🥔",
"name": "potato",
"keywords": "food | potato | vegetable"
},
{
"code": "🥕",
"name": "carrot",
"keywords": "carrot | food | vegetable"
},
{
"code": "🌽",
"name": "ear of corn",
"keywords": "corn | ear | ear of corn | maize | maze"
},
{
"code": "🌶",
"name": "hot pepper",
"keywords": "hot | pepper"
},
{
"code": "🫑",
"name": "bell pepper",
"keywords": "bell pepper | capsicum | pepper | vegetable"
},
{
"code": "🥒",
"name": "cucumber",
"keywords": "cucumber | food | pickle | vegetable"
},
{
"code": "🥬",
"name": "leafy green",
"keywords": "bok choy | cabbage | kale | leafy green | lettuce"
},
{
"code": "🥦",
"name": "broccoli",
"keywords": "broccoli | wild cabbage"
},
{
"code": "🧄",
"name": "garlic",
"keywords": "flavoring | garlic"
},
{
"code": "🧅",
"name": "onion",
"keywords": "flavoring | onion"
},
{
"code": "🍄",
"name": "mushroom",
"keywords": "mushroom | toadstool"
},
{
"code": "🥜",
"name": "peanuts",
"keywords": "food | nut | peanut | peanuts | vegetable"
},
{
"code": "🌰",
"name": "chestnut",
"keywords": "chestnut | plant"
},
{
"code": "🍞",
"name": "bread",
"keywords": "bread | loaf"
},
{
"code": "🥐",
"name": "croissant",
"keywords": "bread | breakfast | croissant | food | french | roll"
},
{
"code": "🥖",
"name": "baguette bread",
"keywords": "baguette | bread | food | french"
},
{
"code": "🫓",
"name": "flatbread",
"keywords": "arepa | flatbread | lavash | naan | pita"
},
{
"code": "🥨",
"name": "pretzel",
"keywords": "pretzel | twisted | convoluted"
},
{
"code": "🥯",
"name": "bagel",
"keywords": "bagel | bakery | breakfast | schmear"
},
{
"code": "🥞",
"name": "pancakes",
"keywords": "breakfast | crêpe | food | hotcake | pancake | pancakes"
},
{
"code": "🧇",
"name": "waffle",
"keywords": "breakfast | indecisive | iron | waffle"
},
{
"code": "🧀",
"name": "cheese wedge",
"keywords": "cheese | cheese wedge"
},
{
"code": "🍖",
"name": "meat on bone",
"keywords": "bone | meat | meat on bone"
},
{
"code": "🍗",
"name": "poultry leg",
"keywords": "bone | chicken | drumstick | leg | poultry"
},
{
"code": "🥩",
"name": "cut of meat",
"keywords": "chop | cut of meat | lambchop | porkchop | steak"
},
{
"code": "🥓",
"name": "bacon",
"keywords": "bacon | breakfast | food | meat"
},
{
"code": "🍔",
"name": "hamburger",
"keywords": "burger | hamburger"
},
{
"code": "🍟",
"name": "french fries",
"keywords": "french | fries"
},
{
"code": "🍕",
"name": "pizza",
"keywords": "cheese | pizza | slice"
},
{
"code": "🌭",
"name": "hot dog",
"keywords": "frankfurter | hot dog | hotdog | sausage"
},
{
"code": "🥪",
"name": "sandwich",
"keywords": "bread | sandwich"
},
{
"code": "🌮",
"name": "taco",
"keywords": "mexican | taco"
},
{
"code": "🌯",
"name": "burrito",
"keywords": "burrito | mexican | wrap"
},
{
"code": "🫔",
"name": "tamale",
"keywords": "mexican | tamale | wrapped"
},
{
"code": "🥙",
"name": "stuffed flatbread",
"keywords": "falafel | flatbread | food | gyro | kebab | stuffed"
},
{
"code": "🧆",
"name": "falafel",
"keywords": "chickpea | falafel | meatball"
},
{
"code": "🥚",
"name": "egg",
"keywords": "breakfast | egg | food"
},
{
"code": "🍳",
"name": "cooking",
"keywords": "breakfast | cooking | egg | frying | pan"
},
{
"code": "🥘",
"name": "shallow pan of food",
"keywords": "casserole | food | paella | pan | shallow | shallow pan of food"
},
{
"code": "🍲",
"name": "pot of food",
"keywords": "pot | pot of food | stew"
},
{
"code": "🫕",
"name": "fondue",
"keywords": "cheese | chocolate | fondue | melted | pot | Swiss"
},
{
"code": "🥣",
"name": "bowl with spoon",
"keywords": "bowl with spoon | breakfast | cereal | congee | oatmeal | porridge"
},
{
"code": "🥗",
"name": "green salad",
"keywords": "food | green | salad"
},
{
"code": "🍿",
"name": "popcorn",
"keywords": "popcorn"
},
{
"code": "🧈",
"name": "butter",
"keywords": "butter | dairy"
},
{
"code": "🧂",
"name": "salt",
"keywords": "condiment | salt | shaker"
},
{
"code": "🥫",
"name": "canned food",
"keywords": "can | canned food"
},
{
"code": "🍱",
"name": "bento box",
"keywords": "bento | box"
},
{
"code": "🍘",
"name": "rice cracker",
"keywords": "cracker | rice"
},
{
"code": "🍙",
"name": "rice ball",
"keywords": "ball | Japanese | rice"
},
{
"code": "🍚",
"name": "cooked rice",
"keywords": "cooked | rice"
},
{
"code": "🍛",
"name": "curry rice",
"keywords": "curry | rice"
},
{
"code": "🍜",
"name": "steaming bowl",
"keywords": "bowl | noodle | ramen | steaming"
},
{
"code": "🍝",
"name": "spaghetti",
"keywords": "pasta | spaghetti"
},
{
"code": "🍠",
"name": "roasted sweet potato",
"keywords": "potato | roasted | sweet"
},
{
"code": "🍢",
"name": "oden",
"keywords": "kebab | oden | seafood | skewer | stick"
},
{
"code": "🍣",
"name": "sushi",
"keywords": "sushi"
},
{
"code": "🍤",
"name": "fried shrimp",
"keywords": "fried | prawn | shrimp | tempura"
},
{
"code": "🍥",
"name": "fish cake with swirl",
"keywords": "cake | fish | fish cake with swirl | pastry | swirl"
},
{
"code": "🥮",
"name": "moon cake",
"keywords": "autumn | festival | moon cake | yuèbǐng"
},
{
"code": "🍡",
"name": "dango",
"keywords": "dango | dessert | Japanese | skewer | stick | sweet"
},
{
"code": "🥟",
"name": "dumpling",
"keywords": "dumpling | empanada | gyōza | jiaozi | pierogi | potsticker"
},
{
"code": "🥠",
"name": "fortune cookie",
"keywords": "fortune cookie | prophecy"
},
{
"code": "🥡",
"name": "takeout box",
"keywords": "oyster pail | takeout box"
},
{
"code": "🦀",
"name": "crab",
"keywords": "Cancer | crab | zodiac"
},
{
"code": "🦞",
"name": "lobster",
"keywords": "bisque | claws | lobster | seafood"
},
{
"code": "🦐",
"name": "shrimp",
"keywords": "food | shellfish | shrimp | small"
},
{
"code": "🦑",
"name": "squid",
"keywords": "food | molusc | squid"
},
{
"code": "🦪",
"name": "oyster",
"keywords": "diving | oyster | pearl"
},
{
"code": "🍦",
"name": "soft ice cream",
"keywords": "cream | dessert | ice | icecream | soft | sweet"
},
{
"code": "🍧",
"name": "shaved ice",
"keywords": "dessert | ice | shaved | sweet"
},
{
"code": "🍨",
"name": "ice cream",
"keywords": "cream | dessert | ice | sweet"
},
{
"code": "🍩",
"name": "doughnut",
"keywords": "breakfast | dessert | donut | doughnut | sweet"
},
{
"code": "🍪",
"name": "cookie",
"keywords": "cookie | dessert | sweet"
},
{
"code": "🎂",
"name": "birthday cake",
"keywords": "birthday | cake | celebration | dessert | pastry | sweet"
},
{
"code": "🍰",
"name": "shortcake",
"keywords": "cake | dessert | pastry | shortcake | slice | sweet"
},
{
"code": "🧁",
"name": "cupcake",
"keywords": "bakery | cupcake | sweet"
},
{
"code": "🥧",
"name": "pie",
"keywords": "filling | pastry | pie | fruit | meat"
},
{
"code": "🍫",
"name": "chocolate bar",
"keywords": "bar | chocolate | dessert | sweet"
},
{
"code": "🍬",
"name": "candy",
"keywords": "candy | dessert | sweet"
},
{
"code": "🍭",
"name": "lollipop",
"keywords": "candy | dessert | lollipop | sweet"
},
{
"code": "🍮",
"name": "custard",
"keywords": "custard | dessert | pudding | sweet"
},
{
"code": "🍯",
"name": "honey pot",
"keywords": "honey | honeypot | pot | sweet"
},
{
"code": "🍼",
"name": "baby bottle",
"keywords": "baby | bottle | drink | milk"
},
{
"code": "🥛",
"name": "glass of milk",
"keywords": "drink | glass | glass of milk | milk"
},
{
"code": "☕",
"name": "hot beverage",
"keywords": "beverage | coffee | drink | hot | steaming | tea"
},
{
"code": "🫖",
"name": "teapot",
"keywords": "drink | pot | tea | teapot"
},
{
"code": "🍵",
"name": "teacup without handle",
"keywords": "beverage | cup | drink | tea | teacup | teacup without handle"
},
{
"code": "🍶",
"name": "sake",
"keywords": "bar | beverage | bottle | cup | drink | sake"
},
{
"code": "🍾",
"name": "bottle with popping cork",
"keywords": "bar | bottle | bottle with popping cork | cork | drink | popping"
},
{
"code": "🍷",
"name": "wine glass",
"keywords": "bar | beverage | drink | glass | wine"
},
{
"code": "🍸",
"name": "cocktail glass",
"keywords": "bar | cocktail | drink | glass"
},
{
"code": "🍹",
"name": "tropical drink",
"keywords": "bar | drink | tropical"
},
{
"code": "🍺",
"name": "beer mug",
"keywords": "bar | beer | drink | mug"
},
{
"code": "🍻",
"name": "clinking beer mugs",
"keywords": "bar | beer | clink | clinking beer mugs | drink | mug"
},
{
"code": "🥂",
"name": "clinking glasses",
"keywords": "celebrate | clink | clinking glasses | drink | glass"
},
{
"code": "🥃",
"name": "tumbler glass",
"keywords": "glass | liquor | shot | tumbler | whisky"
},
{
"code": "🥤",
"name": "cup with straw",
"keywords": "cup with straw | juice | soda | malt | soft drink | water"
},
{
"code": "🧋",
"name": "bubble tea",
"keywords": "bubble | milk | pearl | tea"
},
{
"code": "🧃",
"name": "beverage box",
"keywords": "beverage | box | juice | straw | sweet"
},
{
"code": "🧉",
"name": "mate",
"keywords": "drink | mate"
},
{
"code": "🧊",
"name": "ice",
"keywords": "cold | ice | ice cube | iceberg"
},
{
"code": "🥢",
"name": "chopsticks",
"keywords": "chopsticks | hashi | jeotgarak | kuaizi"
},
{
"code": "🍽",
"name": "fork and knife with plate",
"keywords": "cooking | fork | fork and knife with plate | knife | plate"
},
{
"code": "🍴",
"name": "fork and knife",
"keywords": "cooking | cutlery | fork | fork and knife | knife"
},
{
"code": "🥄",
"name": "spoon",
"keywords": "spoon | tableware"
},
{
"code": "🔪",
"name": "kitchen knife",
"keywords": "cooking | hocho | kitchen knife | knife | tool | weapon"
},
{
"code": "🏺",
"name": "amphora",
"keywords": "amphora | Aquarius | cooking | drink | jug | zodiac"
},
{
"code": "🌍",
"name": "globe showing Europe-Africa",
"keywords": "Africa | earth | Europe | globe | globe showing Europe-Africa | world"
},
{
"code": "🌎",
"name": "globe showing Americas",
"keywords": "Americas | earth | globe | globe showing Americas | world"
},
{
"code": "🌏",
"name": "globe showing Asia-Australia",
"keywords": "Asia | Australia | earth | globe | globe showing Asia-Australia | world"
},
{
"code": "🌐",
"name": "globe with meridians",
"keywords": "earth | globe | globe with meridians | meridians | world"
},
{
"code": "🗺",
"name": "world map",
"keywords": "map | world"
},
{
"code": "🗾",
"name": "map of Japan",
"keywords": "Japan | map | map of Japan"
},
{
"code": "🧭",
"name": "compass",
"keywords": "compass | magnetic | navigation | orienteering"
},
{
"code": "🏔",
"name": "snow-capped mountain",
"keywords": "cold | mountain | snow | snow-capped mountain"
},
{
"code": "⛰",
"name": "mountain",
"keywords": "mountain"
},
{
"code": "🌋",
"name": "volcano",
"keywords": "eruption | mountain | volcano"
},
{
"code": "🗻",
"name": "mount fuji",
"keywords": "fuji | mount fuji | mountain"
},
{
"code": "🏕",
"name": "camping",
"keywords": "camping"
},
{
"code": "🏖",
"name": "beach with umbrella",
"keywords": "beach | beach with umbrella | umbrella"
},
{
"code": "🏜",
"name": "desert",
"keywords": "desert"
},
{
"code": "🏝",
"name": "desert island",
"keywords": "desert | island"
},
{
"code": "🏞",
"name": "national park",
"keywords": "national park | park"
},
{
"code": "🏟",
"name": "stadium",
"keywords": "stadium"
},
{
"code": "🏛",
"name": "classical building",
"keywords": "classical | classical building"
},
{
"code": "🏗",
"name": "building construction",
"keywords": "building construction | construction"
},
{
"code": "🧱",
"name": "brick",
"keywords": "brick | bricks | clay | mortar | wall"
},
{
"code": "🪨",
"name": "rock",
"keywords": "boulder | heavy | rock | solid | stone"
},
{
"code": "🪵",
"name": "wood",
"keywords": "log | lumber | timber | wood"
},
{
"code": "🛖",
"name": "hut",
"keywords": "house | hut | roundhouse | yurt"
},
{
"code": "🏘",
"name": "houses",
"keywords": "houses"
},
{
"code": "🏚",
"name": "derelict house",
"keywords": "derelict | house"
},
{
"code": "🏠",
"name": "house",
"keywords": "home | house"
},
{
"code": "🏡",
"name": "house with garden",
"keywords": "garden | home | house | house with garden"
},
{
"code": "🏢",
"name": "office building",
"keywords": "building | office building"
},
{
"code": "🏣",
"name": "Japanese post office",
"keywords": "Japanese | Japanese post office | post"
},
{
"code": "🏤",
"name": "post office",
"keywords": "European | post | post office"
},
{
"code": "🏥",
"name": "hospital",
"keywords": "doctor | hospital | medicine"
},
{
"code": "🏦",
"name": "bank",
"keywords": "bank | building"
},
{
"code": "🏨",
"name": "hotel",
"keywords": "building | hotel"
},
{
"code": "🏩",
"name": "love hotel",
"keywords": "hotel | love"
},
{
"code": "🏪",
"name": "convenience store",
"keywords": "convenience | store"
},
{
"code": "🏫",
"name": "school",
"keywords": "building | school"
},
{
"code": "🏬",
"name": "department store",
"keywords": "department | store"
},
{
"code": "🏭",
"name": "factory",
"keywords": "building | factory"
},
{
"code": "🏯",
"name": "Japanese castle",
"keywords": "castle | Japanese"
},
{
"code": "🏰",
"name": "castle",
"keywords": "castle | European"
},
{
"code": "💒",
"name": "wedding",
"keywords": "chapel | romance | wedding"
},
{
"code": "🗼",
"name": "Tokyo tower",
"keywords": "Tokyo | tower"
},
{
"code": "🗽",
"name": "Statue of Liberty",
"keywords": "liberty | statue | Statue of Liberty"
},
{
"code": "⛪",
"name": "church",
"keywords": "Christian | church | cross | religion"
},
{
"code": "🕌",
"name": "mosque",
"keywords": "islam | mosque | Muslim | religion"
},
{
"code": "🛕",
"name": "hindu temple",
"keywords": "hindu | temple"
},
{
"code": "🕍",
"name": "synagogue",
"keywords": "Jew | Jewish | religion | synagogue | temple"
},
{
"code": "⛩",
"name": "shinto shrine",
"keywords": "religion | shinto | shrine"
},
{
"code": "🕋",
"name": "kaaba",
"keywords": "islam | kaaba | Muslim | religion"
},
{
"code": "⛲",
"name": "fountain",
"keywords": "fountain"
},
{
"code": "⛺",
"name": "tent",
"keywords": "camping | tent"
},
{
"code": "🌁",
"name": "foggy",
"keywords": "fog | foggy"
},
{
"code": "🌃",
"name": "night with stars",
"keywords": "night | night with stars | star"
},
{
"code": "🏙",
"name": "cityscape",
"keywords": "city | cityscape"
},
{
"code": "🌄",
"name": "sunrise over mountains",
"keywords": "morning | mountain | sun | sunrise | sunrise over mountains"
},
{
"code": "🌅",
"name": "sunrise",
"keywords": "morning | sun | sunrise"
},
{
"code": "🌆",
"name": "cityscape at dusk",
"keywords": "city | cityscape at dusk | dusk | evening | landscape | sunset"
},
{
"code": "🌇",
"name": "sunset",
"keywords": "dusk | sun | sunset"
},
{
"code": "🌉",
"name": "bridge at night",
"keywords": "bridge | bridge at night | night"
},
{
"code": "♨",
"name": "hot springs",
"keywords": "hot | hotsprings | springs | steaming"
},
{
"code": "🎠",
"name": "carousel horse",
"keywords": "carousel | horse"
},
{
"code": "🎡",
"name": "ferris wheel",
"keywords": "amusement park | ferris | wheel"
},
{
"code": "🎢",
"name": "roller coaster",
"keywords": "amusement park | coaster | roller"
},
{
"code": "💈",
"name": "barber pole",
"keywords": "barber | haircut | pole"
},
{
"code": "🎪",
"name": "circus tent",
"keywords": "circus | tent"
},
{
"code": "🚂",
"name": "locomotive",
"keywords": "engine | locomotive | railway | steam | train"
},
{
"code": "🚃",
"name": "railway car",
"keywords": "car | electric | railway | train | tram | trolleybus"
},
{
"code": "🚄",
"name": "high-speed train",
"keywords": "high-speed train | railway | shinkansen | speed | train"
},
{
"code": "🚅",
"name": "bullet train",
"keywords": "bullet | railway | shinkansen | speed | train"
},
{
"code": "🚆",
"name": "train",
"keywords": "railway | train"
},
{
"code": "🚇",
"name": "metro",
"keywords": "metro | subway"
},
{
"code": "🚈",
"name": "light rail",
"keywords": "light rail | railway"
},
{
"code": "🚉",
"name": "station",
"keywords": "railway | station | train"
},
{
"code": "🚊",
"name": "tram",
"keywords": "tram | trolleybus"
},
{
"code": "🚝",
"name": "monorail",
"keywords": "monorail | vehicle"
},
{
"code": "🚞",
"name": "mountain railway",
"keywords": "car | mountain | railway"
},
{
"code": "🚋",
"name": "tram car",
"keywords": "car | tram | trolleybus"
},
{
"code": "🚌",
"name": "bus",
"keywords": "bus | vehicle"
},
{
"code": "🚍",
"name": "oncoming bus",
"keywords": "bus | oncoming"
},
{
"code": "🚎",
"name": "trolleybus",
"keywords": "bus | tram | trolley | trolleybus"
},
{
"code": "🚐",
"name": "minibus",
"keywords": "bus | minibus"
},
{
"code": "🚑",
"name": "ambulance",
"keywords": "ambulance | vehicle"
},
{
"code": "🚒",
"name": "fire engine",
"keywords": "engine | fire | truck"
},
{
"code": "🚓",
"name": "police car",
"keywords": "car | patrol | police"
},
{
"code": "🚔",
"name": "oncoming police car",
"keywords": "car | oncoming | police"
},
{
"code": "🚕",
"name": "taxi",
"keywords": "taxi | vehicle"
},
{
"code": "🚖",
"name": "oncoming taxi",
"keywords": "oncoming | taxi"
},
{
"code": "🚗",
"name": "automobile",
"keywords": "automobile | car"
},
{
"code": "🚘",
"name": "oncoming automobile",
"keywords": "automobile | car | oncoming"
},
{
"code": "🚙",
"name": "sport utility vehicle",
"keywords": "recreational | sport utility | sport utility vehicle"
},
{
"code": "🛻",
"name": "pickup truck",
"keywords": "pick-up | pickup | truck"
},
{
"code": "🚚",
"name": "delivery truck",
"keywords": "delivery | truck"
},
{
"code": "🚛",
"name": "articulated lorry",
"keywords": "articulated lorry | lorry | semi | truck"
},
{
"code": "🚜",
"name": "tractor",
"keywords": "tractor | vehicle"
},
{
"code": "🏎",
"name": "racing car",
"keywords": "car | racing"
},
{
"code": "🏍",
"name": "motorcycle",
"keywords": "motorcycle | racing"
},
{
"code": "🛵",
"name": "motor scooter",
"keywords": "motor | scooter"
},
{
"code": "🦽",
"name": "manual wheelchair",
"keywords": "accessibility | manual wheelchair"
},
{
"code": "🦼",
"name": "motorized wheelchair",
"keywords": "accessibility | motorized wheelchair"
},
{
"code": "🛺",
"name": "auto rickshaw",
"keywords": "auto rickshaw | tuk tuk"
},
{
"code": "🚲",
"name": "bicycle",
"keywords": "bicycle | bike"
},
{
"code": "🛴",
"name": "kick scooter",
"keywords": "kick | scooter"
},
{
"code": "🛹",
"name": "skateboard",
"keywords": "board | skateboard"
},
{
"code": "🛼",
"name": "roller skate",
"keywords": "roller | skate"
},
{
"code": "🚏",
"name": "bus stop",
"keywords": "bus | busstop | stop"
},
{
"code": "🛣",
"name": "motorway",
"keywords": "highway | motorway | road"
},
{
"code": "🛤",
"name": "railway track",
"keywords": "railway | railway track | train"
},
{
"code": "🛢",
"name": "oil drum",
"keywords": "drum | oil"
},
{
"code": "⛽",
"name": "fuel pump",
"keywords": "diesel | fuel | fuelpump | gas | pump | station"
},
{
"code": "🚨",
"name": "police car light",
"keywords": "beacon | car | light | police | revolving"
},
{
"code": "🚥",
"name": "horizontal traffic light",
"keywords": "horizontal traffic light | light | signal | traffic"
},
{
"code": "🚦",
"name": "vertical traffic light",
"keywords": "light | signal | traffic | vertical traffic light"
},
{
"code": "🛑",
"name": "stop sign",
"keywords": "octagonal | sign | stop"
},
{
"code": "🚧",
"name": "construction",
"keywords": "barrier | construction"
},
{
"code": "⚓",
"name": "anchor",
"keywords": "anchor | ship | tool"
},
{
"code": "⛵",
"name": "sailboat",
"keywords": "boat | resort | sailboat | sea | yacht"
},
{
"code": "🛶",
"name": "canoe",
"keywords": "boat | canoe"
},
{
"code": "🚤",
"name": "speedboat",
"keywords": "boat | speedboat"
},
{
"code": "🛳",
"name": "passenger ship",
"keywords": "passenger | ship"
},
{
"code": "⛴",
"name": "ferry",
"keywords": "boat | ferry | passenger"
},
{
"code": "🛥",
"name": "motor boat",
"keywords": "boat | motor boat | motorboat"
},
{
"code": "🚢",
"name": "ship",
"keywords": "boat | passenger | ship"
},
{
"code": "✈",
"name": "airplane",
"keywords": "aeroplane | airplane"
},
{
"code": "🛩",
"name": "small airplane",
"keywords": "aeroplane | airplane | small airplane"
},
{
"code": "🛫",
"name": "airplane departure",
"keywords": "aeroplane | airplane | check-in | departure | departures"
},
{
"code": "🛬",
"name": "airplane arrival",
"keywords": "aeroplane | airplane | airplane arrival | arrivals | arriving | landing"
},
{
"code": "🪂",
"name": "parachute",
"keywords": "hang-glide | parachute | parasail | skydive"
},
{
"code": "💺",
"name": "seat",
"keywords": "chair | seat"
},
{
"code": "🚁",
"name": "helicopter",
"keywords": "helicopter | vehicle"
},
{
"code": "🚟",
"name": "suspension railway",
"keywords": "railway | suspension"
},
{
"code": "🚠",
"name": "mountain cableway",
"keywords": "cable | gondola | mountain | mountain cableway"
},
{
"code": "🚡",
"name": "aerial tramway",
"keywords": "aerial | cable | car | gondola | tramway"
},
{
"code": "🛰",
"name": "satellite",
"keywords": "satellite | space"
},
{
"code": "🚀",
"name": "rocket",
"keywords": "rocket | space"
},
{
"code": "🛸",
"name": "flying saucer",
"keywords": "flying saucer | UFO"
},
{
"code": "🛎",
"name": "bellhop bell",
"keywords": "bell | bellhop | hotel"
},
{
"code": "🧳",
"name": "luggage",
"keywords": "luggage | packing | travel"
},
{
"code": "⌛",
"name": "hourglass done",
"keywords": "hourglass done | sand | timer"
},
{
"code": "⏳",
"name": "hourglass not done",
"keywords": "hourglass | hourglass not done | sand | timer"
},
{
"code": "⌚",
"name": "watch",
"keywords": "clock | watch"
},
{
"code": "⏰",
"name": "alarm clock",
"keywords": "alarm | clock"
},
{
"code": "⏱",
"name": "stopwatch",
"keywords": "clock | stopwatch"
},
{
"code": "⏲",
"name": "timer clock",
"keywords": "clock | timer"
},
{
"code": "🕰",
"name": "mantelpiece clock",
"keywords": "clock | mantelpiece clock"
},
{
"code": "🕛",
"name": "twelve o’clock",
"keywords": "00 | 12 | 12:00 | clock | o’clock | twelve"
},
{
"code": "🕧",
"name": "twelve-thirty",
"keywords": "12 | 12:30 | clock | thirty | twelve | twelve-thirty"
},
{
"code": "🕐",
"name": "one o’clock",
"keywords": "00 | 1 | 1:00 | clock | o’clock | one"
},
{
"code": "🕜",
"name": "one-thirty",
"keywords": "1 | 1:30 | clock | one | one-thirty | thirty"
},
{
"code": "🕑",
"name": "two o’clock",
"keywords": "00 | 2 | 2:00 | clock | o’clock | two"
},
{
"code": "🕝",
"name": "two-thirty",
"keywords": "2 | 2:30 | clock | thirty | two | two-thirty"
},
{
"code": "🕒",
"name": "three o’clock",
"keywords": "00 | 3 | 3:00 | clock | o’clock | three"
},
{
"code": "🕞",
"name": "three-thirty",
"keywords": "3 | 3:30 | clock | thirty | three | three-thirty"
},
{
"code": "🕓",
"name": "four o’clock",
"keywords": "00 | 4 | 4:00 | clock | four | o’clock"
},
{
"code": "🕟",
"name": "four-thirty",
"keywords": "4 | 4:30 | clock | four | four-thirty | thirty"
},
{
"code": "🕔",
"name": "five o’clock",
"keywords": "00 | 5 | 5:00 | clock | five | o’clock"
},
{
"code": "🕠",
"name": "five-thirty",
"keywords": "5 | 5:30 | clock | five | five-thirty | thirty"
},
{
"code": "🕕",
"name": "six o’clock",
"keywords": "00 | 6 | 6:00 | clock | o’clock | six"
},
{
"code": "🕡",
"name": "six-thirty",
"keywords": "6 | 6:30 | clock | six | six-thirty | thirty"
},
{
"code": "🕖",
"name": "seven o’clock",
"keywords": "00 | 7 | 7:00 | clock | o’clock | seven"
},
{
"code": "🕢",
"name": "seven-thirty",
"keywords": "7 | 7:30 | clock | seven | seven-thirty | thirty"
},
{
"code": "🕗",
"name": "eight o’clock",
"keywords": "00 | 8 | 8:00 | clock | eight | o’clock"
},
{
"code": "🕣",
"name": "eight-thirty",
"keywords": "8 | 8:30 | clock | eight | eight-thirty | thirty"
},
{
"code": "🕘",
"name": "nine o’clock",
"keywords": "00 | 9 | 9:00 | clock | nine | o’clock"
},
{
"code": "🕤",
"name": "nine-thirty",
"keywords": "9 | 9:30 | clock | nine | nine-thirty | thirty"
},
{
"code": "🕙",
"name": "ten o’clock",
"keywords": "00 | 10 | 10:00 | clock | o’clock | ten"
},
{
"code": "🕥",
"name": "ten-thirty",
"keywords": "10 | 10:30 | clock | ten | ten-thirty | thirty"
},
{
"code": "🕚",
"name": "eleven o’clock",
"keywords": "00 | 11 | 11:00 | clock | eleven | o’clock"
},
{
"code": "🕦",
"name": "eleven-thirty",
"keywords": "11 | 11:30 | clock | eleven | eleven-thirty | thirty"
},
{
"code": "🌑",
"name": "new moon",
"keywords": "dark | moon | new moon"
},
{
"code": "🌒",
"name": "waxing crescent moon",
"keywords": "crescent | moon | waxing"
},
{
"code": "🌓",
"name": "first quarter moon",
"keywords": "first quarter moon | moon | quarter"
},
{
"code": "🌔",
"name": "waxing gibbous moon",
"keywords": "gibbous | moon | waxing"
},
{
"code": "🌕",
"name": "full moon",
"keywords": "full | moon"
},
{
"code": "🌖",
"name": "waning gibbous moon",
"keywords": "gibbous | moon | waning"
},
{
"code": "🌗",
"name": "last quarter moon",
"keywords": "last quarter moon | moon | quarter"
},
{
"code": "🌘",
"name": "waning crescent moon",
"keywords": "crescent | moon | waning"
},
{
"code": "🌙",
"name": "crescent moon",
"keywords": "crescent | moon"
},
{
"code": "🌚",
"name": "new moon face",
"keywords": "face | moon | new moon face"
},
{
"code": "🌛",
"name": "first quarter moon face",
"keywords": "face | first quarter moon face | moon | quarter"
},
{
"code": "🌜",
"name": "last quarter moon face",
"keywords": "face | last quarter moon face | moon | quarter"
},
{
"code": "🌡",
"name": "thermometer",
"keywords": "thermometer | weather"
},
{
"code": "☀",
"name": "sun",
"keywords": "bright | rays | sun | sunny"
},
{
"code": "🌝",
"name": "full moon face",
"keywords": "bright | face | full | moon"
},
{
"code": "🌞",
"name": "sun with face",
"keywords": "bright | face | sun | sun with face"
},
{
"code": "🪐",
"name": "ringed planet",
"keywords": "ringed planet | saturn | saturnine"
},
{
"code": "⭐",
"name": "star",
"keywords": "star"
},
{
"code": "🌟",
"name": "glowing star",
"keywords": "glittery | glow | glowing star | shining | sparkle | star"
},
{
"code": "🌠",
"name": "shooting star",
"keywords": "falling | shooting | star"
},
{
"code": "🌌",
"name": "milky way",
"keywords": "milky way | space"
},
{
"code": "☁",
"name": "cloud",
"keywords": "cloud | weather"
},
{
"code": "⛅",
"name": "sun behind cloud",
"keywords": "cloud | sun | sun behind cloud"
},
{
"code": "⛈",
"name": "cloud with lightning and rain",
"keywords": "cloud | cloud with lightning and rain | rain | thunder"
},
{
"code": "🌤",
"name": "sun behind small cloud",
"keywords": "cloud | sun | sun behind small cloud"
},
{
"code": "🌥",
"name": "sun behind large cloud",
"keywords": "cloud | sun | sun behind large cloud"
},
{
"code": "🌦",
"name": "sun behind rain cloud",
"keywords": "cloud | rain | sun | sun behind rain cloud"
},
{
"code": "🌧",
"name": "cloud with rain",
"keywords": "cloud | cloud with rain | rain"
},
{
"code": "🌨",
"name": "cloud with snow",
"keywords": "cloud | cloud with snow | cold | snow"
},
{
"code": "🌩",
"name": "cloud with lightning",
"keywords": "cloud | cloud with lightning | lightning"
},
{
"code": "🌪",
"name": "tornado",
"keywords": "cloud | tornado | whirlwind"
},
{
"code": "🌫",
"name": "fog",
"keywords": "cloud | fog"
},
{
"code": "🌬",
"name": "wind face",
"keywords": "blow | cloud | face | wind"
},
{
"code": "🌀",
"name": "cyclone",
"keywords": "cyclone | dizzy | hurricane | twister | typhoon"
},
{
"code": "🌈",
"name": "rainbow",
"keywords": "rain | rainbow"
},
{
"code": "🌂",
"name": "closed umbrella",
"keywords": "closed umbrella | clothing | rain | umbrella"
},
{
"code": "☂",
"name": "umbrella",
"keywords": "clothing | rain | umbrella"
},
{
"code": "☔",
"name": "umbrella with rain drops",
"keywords": "clothing | drop | rain | umbrella | umbrella with rain drops"
},
{
"code": "⛱",
"name": "umbrella on ground",
"keywords": "rain | sun | umbrella | umbrella on ground"
},
{
"code": "⚡",
"name": "high voltage",
"keywords": "danger | electric | high voltage | lightning | voltage | zap"
},
{
"code": "❄",
"name": "snowflake",
"keywords": "cold | snow | snowflake"
},
{
"code": "☃",
"name": "snowman",
"keywords": "cold | snow | snowman"
},
{
"code": "⛄",
"name": "snowman without snow",
"keywords": "cold | snow | snowman | snowman without snow"
},
{
"code": "☄",
"name": "comet",
"keywords": "comet | space"
},
{
"code": "🔥",
"name": "fire",
"keywords": "fire | flame | tool"
},
{
"code": "💧",
"name": "droplet",
"keywords": "cold | comic | drop | droplet | sweat"
},
{
"code": "🌊",
"name": "water wave",
"keywords": "ocean | water | wave"
},
{
"code": "🎃",
"name": "jack-o-lantern",
"keywords": "celebration | halloween | jack | jack-o-lantern | lantern"
},
{
"code": "🎄",
"name": "Christmas tree",
"keywords": "celebration | Christmas | tree"
},
{
"code": "🎆",
"name": "fireworks",
"keywords": "celebration | fireworks"
},
{
"code": "🎇",
"name": "sparkler",
"keywords": "celebration | fireworks | sparkle | sparkler"
},
{
"code": "🧨",
"name": "firecracker",
"keywords": "dynamite | explosive | firecracker | fireworks"
},
{
"code": "✨",
"name": "sparkles",
"keywords": "* | sparkle | sparkles | star"
},
{
"code": "🎈",
"name": "balloon",
"keywords": "balloon | celebration"
},
{
"code": "🎉",
"name": "party popper",
"keywords": "celebration | party | popper | tada"
},
{
"code": "🎊",
"name": "confetti ball",
"keywords": "ball | celebration | confetti"
},
{
"code": "🎋",
"name": "tanabata tree",
"keywords": "banner | celebration | Japanese | tanabata tree | tree"
},
{
"code": "🎍",
"name": "pine decoration",
"keywords": "bamboo | celebration | Japanese | pine | pine decoration"
},
{
"code": "🎎",
"name": "Japanese dolls",
"keywords": "celebration | doll | festival | Japanese | Japanese dolls"
},
{
"code": "🎏",
"name": "carp streamer",
"keywords": "carp | celebration | streamer"
},
{
"code": "🎐",
"name": "wind chime",
"keywords": "bell | celebration | chime | wind"
},
{
"code": "🎑",
"name": "moon viewing ceremony",
"keywords": "celebration | ceremony | moon | moon viewing ceremony"
},
{
"code": "🧧",
"name": "red envelope",
"keywords": "gift | good luck | hóngbāo | lai see | money | red envelope"
},
{
"code": "🎀",
"name": "ribbon",
"keywords": "celebration | ribbon"
},
{
"code": "🎁",
"name": "wrapped gift",
"keywords": "box | celebration | gift | present | wrapped"
},
{
"code": "🎗",
"name": "reminder ribbon",
"keywords": "celebration | reminder | ribbon"
},
{
"code": "🎟",
"name": "admission tickets",
"keywords": "admission | admission tickets | ticket"
},
{
"code": "🎫",
"name": "ticket",
"keywords": "admission | ticket"
},
{
"code": "🎖",
"name": "military medal",
"keywords": "celebration | medal | military"
},
{
"code": "🏆",
"name": "trophy",
"keywords": "prize | trophy"
},
{
"code": "🏅",
"name": "sports medal",
"keywords": "medal | sports medal"
},
{
"code": "🥇",
"name": "1st place medal",
"keywords": "1st place medal | first | gold | medal"
},
{
"code": "🥈",
"name": "2nd place medal",
"keywords": "2nd place medal | medal | second | silver"
},
{
"code": "🥉",
"name": "3rd place medal",
"keywords": "3rd place medal | bronze | medal | third"
},
{
"code": "⚽",
"name": "soccer ball",
"keywords": "ball | football | soccer"
},
{
"code": "⚾",
"name": "baseball",
"keywords": "ball | baseball"
},
{
"code": "🥎",
"name": "softball",
"keywords": "ball | glove | softball | underarm"
},
{
"code": "🏀",
"name": "basketball",
"keywords": "ball | basketball | hoop"
},
{
"code": "🏐",
"name": "volleyball",
"keywords": "ball | game | volleyball"
},
{
"code": "🏈",
"name": "american football",
"keywords": "american | ball | football"
},
{
"code": "🏉",
"name": "rugby football",
"keywords": "ball | football | rugby"
},
{
"code": "🎾",
"name": "tennis",
"keywords": "ball | racquet | tennis"
},
{
"code": "🥏",
"name": "flying disc",
"keywords": "flying disc | ultimate"
},
{
"code": "🎳",
"name": "bowling",
"keywords": "ball | bowling | game"
},
{
"code": "🏏",
"name": "cricket game",
"keywords": "ball | bat | cricket game | game"
},
{
"code": "🏑",
"name": "field hockey",
"keywords": "ball | field | game | hockey | stick"
},
{
"code": "🏒",
"name": "ice hockey",
"keywords": "game | hockey | ice | puck | stick"
},
{
"code": "🥍",
"name": "lacrosse",
"keywords": "ball | goal | lacrosse | stick"
},
{
"code": "🏓",
"name": "ping pong",
"keywords": "ball | bat | game | paddle | ping pong | table tennis"
},
{
"code": "🏸",
"name": "badminton",
"keywords": "badminton | birdie | game | racquet | shuttlecock"
},
{
"code": "🥊",
"name": "boxing glove",
"keywords": "boxing | glove"
},
{
"code": "🥋",
"name": "martial arts uniform",
"keywords": "judo | karate | martial arts | martial arts uniform | taekwondo | uniform"
},
{
"code": "🥅",
"name": "goal net",
"keywords": "goal | net"
},
{
"code": "⛳",
"name": "flag in hole",
"keywords": "flag in hole | golf | hole"
},
{
"code": "⛸",
"name": "ice skate",
"keywords": "ice | skate"
},
{
"code": "🎣",
"name": "fishing pole",
"keywords": "fish | fishing pole | pole"
},
{
"code": "🤿",
"name": "diving mask",
"keywords": "diving | diving mask | scuba | snorkeling"
},
{
"code": "🎽",
"name": "running shirt",
"keywords": "athletics | running | sash | shirt"
},
{
"code": "🎿",
"name": "skis",
"keywords": "ski | skis | snow"
},
{
"code": "🛷",
"name": "sled",
"keywords": "sled | sledge | sleigh | luge | toboggan"
},
{
"code": "🥌",
"name": "curling stone",
"keywords": "curling stone | game | rock"
},
{
"code": "🎯",
"name": "bullseye",
"keywords": "bullseye | dart | direct hit | game | hit | target"
},
{
"code": "🪀",
"name": "yo-yo",
"keywords": "fluctuate | toy | yo-yo"
},
{
"code": "🪁",
"name": "kite",
"keywords": "fly | kite | soar"
},
{
"code": "🎱",
"name": "pool 8 ball",
"keywords": "8 | ball | billiard | eight | game | pool 8 ball"
},
{
"code": "🔮",
"name": "crystal ball",
"keywords": "ball | crystal | fairy tale | fantasy | fortune | tool"
},
{
"code": "🪄",
"name": "magic wand",
"keywords": "magic | magic wand | witch | wizard"
},
{
"code": "🧿",
"name": "nazar amulet",
"keywords": "bead | charm | evil-eye | nazar | nazar amulet | talisman"
},
{
"code": "🎮",
"name": "video game",
"keywords": "controller | game | video game"
},
{
"code": "🕹",
"name": "joystick",
"keywords": "game | joystick | video game"
},
{
"code": "🎰",
"name": "slot machine",
"keywords": "game | slot | slot machine"
},
{
"code": "🎲",
"name": "game die",
"keywords": "dice | die | game"
},
{
"code": "🧩",
"name": "puzzle piece",
"keywords": "clue | interlocking | jigsaw | piece | puzzle"
},
{
"code": "🧸",
"name": "teddy bear",
"keywords": "plaything | plush | stuffed | teddy bear | toy"
},
{
"code": "🪅",
"name": "piñata",
"keywords": "celebration | party | piñata"
},
{
"code": "🪆",
"name": "nesting dolls",
"keywords": "doll | nesting | nesting dolls | russia"
},
{
"code": "♠",
"name": "spade suit",
"keywords": "card | game | spade suit"
},
{
"code": "♥",
"name": "heart suit",
"keywords": "card | game | heart suit"
},
{
"code": "♦",
"name": "diamond suit",
"keywords": "card | diamond suit | game"
},
{
"code": "♣",
"name": "club suit",
"keywords": "card | club suit | game"
},
{
"code": "♟",
"name": "chess pawn",
"keywords": "chess | chess pawn | dupe | expendable"
},
{
"code": "🃏",
"name": "joker",
"keywords": "card | game | joker | wildcard"
},
{
"code": "🀄",
"name": "mahjong red dragon",
"keywords": "game | mahjong | mahjong red dragon | red"
},
{
"code": "🎴",
"name": "flower playing cards",
"keywords": "card | flower | flower playing cards | game | Japanese | playing"
},
{
"code": "🎭",
"name": "performing arts",
"keywords": "art | mask | performing | performing arts | theater | theatre"
},
{
"code": "🖼",
"name": "framed picture",
"keywords": "art | frame | framed picture | museum | painting | picture"
},
{
"code": "🎨",
"name": "artist palette",
"keywords": "art | artist palette | museum | painting | palette"
},
{
"code": "🧵",
"name": "thread",
"keywords": "needle | sewing | spool | string | thread"
},
{
"code": "🪡",
"name": "sewing needle",
"keywords": "embroidery | needle | sewing | stitches | sutures | tailoring"
},
{
"code": "🧶",
"name": "yarn",
"keywords": "ball | crochet | knit | yarn"
},
{
"code": "🪢",
"name": "knot",
"keywords": "knot | rope | tangled | tie | twine | twist"
},
{
"code": "👓",
"name": "glasses",
"keywords": "clothing | eye | eyeglasses | eyewear | glasses"
},
{
"code": "🕶",
"name": "sunglasses",
"keywords": "dark | eye | eyewear | glasses | sunglasses"
},
{
"code": "🥽",
"name": "goggles",
"keywords": "eye protection | goggles | swimming | welding"
},
{
"code": "🥼",
"name": "lab coat",
"keywords": "doctor | experiment | lab coat | scientist"
},
{
"code": "🦺",
"name": "safety vest",
"keywords": "emergency | safety | vest"
},
{
"code": "👔",
"name": "necktie",
"keywords": "clothing | necktie | tie"
},
{
"code": "👕",
"name": "t-shirt",
"keywords": "clothing | shirt | t-shirt | tshirt"
},
{
"code": "👖",
"name": "jeans",
"keywords": "clothing | jeans | pants | trousers"
},
{
"code": "🧣",
"name": "scarf",
"keywords": "neck | scarf"
},
{
"code": "🧤",
"name": "gloves",
"keywords": "gloves | hand"
},
{
"code": "🧥",
"name": "coat",
"keywords": "coat | jacket"
},
{
"code": "🧦",
"name": "socks",
"keywords": "socks | stocking"
},
{
"code": "👗",
"name": "dress",
"keywords": "clothing | dress"
},
{
"code": "👘",
"name": "kimono",
"keywords": "clothing | kimono"
},
{
"code": "🥻",
"name": "sari",
"keywords": "clothing | dress | sari"
},
{
"code": "🩱",
"name": "one-piece swimsuit",
"keywords": "bathing suit | one-piece swimsuit"
},
{
"code": "🩲",
"name": "briefs",
"keywords": "bathing suit | briefs | one-piece | swimsuit | underwear"
},
{
"code": "🩳",
"name": "shorts",
"keywords": "bathing suit | pants | shorts | underwear"
},
{
"code": "👙",
"name": "bikini",
"keywords": "bikini | clothing | swim"
},
{
"code": "👚",
"name": "woman’s clothes",
"keywords": "clothing | woman | woman’s clothes"
},
{
"code": "👛",
"name": "purse",
"keywords": "clothing | coin | purse"
},
{
"code": "👜",
"name": "handbag",
"keywords": "bag | clothing | handbag | purse"
},
{
"code": "👝",
"name": "clutch bag",
"keywords": "bag | clothing | clutch bag | pouch"
},
{
"code": "🛍",
"name": "shopping bags",
"keywords": "bag | hotel | shopping | shopping bags"
},
{
"code": "🎒",
"name": "backpack",
"keywords": "backpack | bag | rucksack | satchel | school"
},
{
"code": "🩴",
"name": "thong sandal",
"keywords": "beach sandals | sandals | thong sandal | thong sandals | thongs | zōri"
},
{
"code": "👞",
"name": "man’s shoe",
"keywords": "clothing | man | man’s shoe | shoe"
},
{
"code": "👟",
"name": "running shoe",
"keywords": "athletic | clothing | running shoe | shoe | sneaker"
},
{
"code": "🥾",
"name": "hiking boot",
"keywords": "backpacking | boot | camping | hiking"
},
{
"code": "🥿",
"name": "flat shoe",
"keywords": "ballet flat | flat shoe | slip-on | slipper"
},
{
"code": "👠",
"name": "high-heeled shoe",
"keywords": "clothing | heel | high-heeled shoe | shoe | woman"
},
{
"code": "👡",
"name": "woman’s sandal",
"keywords": "clothing | sandal | shoe | woman | woman’s sandal"
},
{
"code": "🩰",
"name": "ballet shoes",
"keywords": "ballet | ballet shoes | dance"
},
{
"code": "👢",
"name": "woman’s boot",
"keywords": "boot | clothing | shoe | woman | woman’s boot"
},
{
"code": "👑",
"name": "crown",
"keywords": "clothing | crown | king | queen"
},
{
"code": "👒",
"name": "woman’s hat",
"keywords": "clothing | hat | woman | woman’s hat"
},
{
"code": "🎩",
"name": "top hat",
"keywords": "clothing | hat | top | tophat"
},
{
"code": "🎓",
"name": "graduation cap",
"keywords": "cap | celebration | clothing | graduation | hat"
},
{
"code": "🧢",
"name": "billed cap",
"keywords": "baseball cap | billed cap"
},
{
"code": "🪖",
"name": "military helmet",
"keywords": "army | helmet | military | soldier | warrior"
},
{
"code": "⛑",
"name": "rescue worker’s helmet",
"keywords": "aid | cross | face | hat | helmet | rescue worker’s helmet"
},
{
"code": "📿",
"name": "prayer beads",
"keywords": "beads | clothing | necklace | prayer | religion"
},
{
"code": "💄",
"name": "lipstick",
"keywords": "cosmetics | lipstick | makeup"
},
{
"code": "💍",
"name": "ring",
"keywords": "diamond | ring"
},
{
"code": "💎",
"name": "gem stone",
"keywords": "diamond | gem | gem stone | jewel"
},
{
"code": "🔇",
"name": "muted speaker",
"keywords": "mute | muted speaker | quiet | silent | speaker"
},
{
"code": "🔈",
"name": "speaker low volume",
"keywords": "soft | speaker low volume"
},
{
"code": "🔉",
"name": "speaker medium volume",
"keywords": "medium | speaker medium volume"
},
{
"code": "🔊",
"name": "speaker high volume",
"keywords": "loud | speaker high volume"
},
{
"code": "📢",
"name": "loudspeaker",
"keywords": "loud | loudspeaker | public address"
},
{
"code": "📣",
"name": "megaphone",
"keywords": "cheering | megaphone"
},
{
"code": "📯",
"name": "postal horn",
"keywords": "horn | post | postal"
},
{
"code": "🔔",
"name": "bell",
"keywords": "bell"
},
{
"code": "🔕",
"name": "bell with slash",
"keywords": "bell | bell with slash | forbidden | mute | quiet | silent"
},
{
"code": "🎼",
"name": "musical score",
"keywords": "music | musical score | score"
},
{
"code": "🎵",
"name": "musical note",
"keywords": "music | musical note | note"
},
{
"code": "🎶",
"name": "musical notes",
"keywords": "music | musical notes | note | notes"
},
{
"code": "🎙",
"name": "studio microphone",
"keywords": "mic | microphone | music | studio"
},
{
"code": "🎚",
"name": "level slider",
"keywords": "level | music | slider"
},
{
"code": "🎛",
"name": "control knobs",
"keywords": "control | knobs | music"
},
{
"code": "🎤",
"name": "microphone",
"keywords": "karaoke | mic | microphone"
},
{
"code": "🎧",
"name": "headphone",
"keywords": "earbud | headphone"
},
{
"code": "📻",
"name": "radio",
"keywords": "radio | video"
},
{
"code": "🎷",
"name": "saxophone",
"keywords": "instrument | music | sax | saxophone"
},
{
"code": "🪗",
"name": "accordion",
"keywords": "accordian | accordion | concertina | squeeze box"
},
{
"code": "🎸",
"name": "guitar",
"keywords": "guitar | instrument | music"
},
{
"code": "🎹",
"name": "musical keyboard",
"keywords": "instrument | keyboard | music | musical keyboard | piano"
},
{
"code": "🎺",
"name": "trumpet",
"keywords": "instrument | music | trumpet"
},
{
"code": "🎻",
"name": "violin",
"keywords": "instrument | music | violin"
},
{
"code": "🪕",
"name": "banjo",
"keywords": "banjo | music | stringed"
},
{
"code": "🥁",
"name": "drum",
"keywords": "drum | drumsticks | music"
},
{
"code": "🪘",
"name": "long drum",
"keywords": "beat | conga | drum | long drum | rhythm"
},
{
"code": "📱",
"name": "mobile phone",
"keywords": "cell | mobile | phone | telephone"
},
{
"code": "📲",
"name": "mobile phone with arrow",
"keywords": "arrow | cell | mobile | mobile phone with arrow | phone | receive"
},
{
"code": "☎",
"name": "telephone",
"keywords": "phone | telephone"
},
{
"code": "📞",
"name": "telephone receiver",
"keywords": "phone | receiver | telephone"
},
{
"code": "📟",
"name": "pager",
"keywords": "pager"
},
{
"code": "📠",
"name": "fax machine",
"keywords": "fax | fax machine"
},
{
"code": "🔋",
"name": "battery",
"keywords": "battery"
},
{
"code": "🔌",
"name": "electric plug",
"keywords": "electric | electricity | plug"
},
{
"code": "💻",
"name": "laptop",
"keywords": "computer | laptop | pc | personal"
},
{
"code": "🖥",
"name": "desktop computer",
"keywords": "computer | desktop"
},
{
"code": "🖨",
"name": "printer",
"keywords": "computer | printer"
},
{
"code": "⌨",
"name": "keyboard",
"keywords": "computer | keyboard"
},
{
"code": "🖱",
"name": "computer mouse",
"keywords": "computer | computer mouse"
},
{
"code": "🖲",
"name": "trackball",
"keywords": "computer | trackball"
},
{
"code": "💽",
"name": "computer disk",
"keywords": "computer | disk | minidisk | optical"
},
{
"code": "💾",
"name": "floppy disk",
"keywords": "computer | disk | floppy"
},
{
"code": "💿",
"name": "optical disk",
"keywords": "cd | computer | disk | optical"
},
{
"code": "📀",
"name": "dvd",
"keywords": "blu-ray | computer | disk | dvd | optical"
},
{
"code": "🧮",
"name": "abacus",
"keywords": "abacus | calculation"
},
{
"code": "🎥",
"name": "movie camera",
"keywords": "camera | cinema | movie"
},
{
"code": "🎞",
"name": "film frames",
"keywords": "cinema | film | frames | movie"
},
{
"code": "📽",
"name": "film projector",
"keywords": "cinema | film | movie | projector | video"
},
{
"code": "🎬",
"name": "clapper board",
"keywords": "clapper | clapper board | movie"
},
{
"code": "📺",
"name": "television",
"keywords": "television | tv | video"
},
{
"code": "📷",
"name": "camera",
"keywords": "camera | video"
},
{
"code": "📸",
"name": "camera with flash",
"keywords": "camera | camera with flash | flash | video"
},
{
"code": "📹",
"name": "video camera",
"keywords": "camera | video"
},
{
"code": "📼",
"name": "videocassette",
"keywords": "tape | vhs | video | videocassette"
},
{
"code": "🔍",
"name": "magnifying glass tilted left",
"keywords": "glass | magnifying | magnifying glass tilted left | search | tool"
},
{
"code": "🔎",
"name": "magnifying glass tilted right",
"keywords": "glass | magnifying | magnifying glass tilted right | search | tool"
},
{
"code": "🕯",
"name": "candle",
"keywords": "candle | light"
},
{
"code": "💡",
"name": "light bulb",
"keywords": "bulb | comic | electric | idea | light"
},
{
"code": "🔦",
"name": "flashlight",
"keywords": "electric | flashlight | light | tool | torch"
},
{
"code": "🏮",
"name": "red paper lantern",
"keywords": "bar | lantern | light | red | red paper lantern"
},
{
"code": "🪔",
"name": "diya lamp",
"keywords": "diya | lamp | oil"
},
{
"code": "📔",
"name": "notebook with decorative cover",
"keywords": "book | cover | decorated | notebook | notebook with decorative cover"
},
{
"code": "📕",
"name": "closed book",
"keywords": "book | closed"
},
{
"code": "📖",
"name": "open book",
"keywords": "book | open"
},
{
"code": "📗",
"name": "green book",
"keywords": "book | green"
},
{
"code": "📘",
"name": "blue book",
"keywords": "blue | book"
},
{
"code": "📙",
"name": "orange book",
"keywords": "book | orange"
},
{
"code": "📚",
"name": "books",
"keywords": "book | books"
},
{
"code": "📓",
"name": "notebook",
"keywords": "notebook"
},
{
"code": "📒",
"name": "ledger",
"keywords": "ledger | notebook"
},
{
"code": "📃",
"name": "page with curl",
"keywords": "curl | document | page | page with curl"
},
{
"code": "📜",
"name": "scroll",
"keywords": "paper | scroll"
},
{
"code": "📄",
"name": "page facing up",
"keywords": "document | page | page facing up"
},
{
"code": "📰",
"name": "newspaper",
"keywords": "news | newspaper | paper"
},
{
"code": "🗞",
"name": "rolled-up newspaper",
"keywords": "news | newspaper | paper | rolled | rolled-up newspaper"
},
{
"code": "📑",
"name": "bookmark tabs",
"keywords": "bookmark | mark | marker | tabs"
},
{
"code": "🔖",
"name": "bookmark",
"keywords": "bookmark | mark"
},
{
"code": "🏷",
"name": "label",
"keywords": "label"
},
{
"code": "💰",
"name": "money bag",
"keywords": "bag | dollar | money | moneybag"
},
{
"code": "🪙",
"name": "coin",
"keywords": "coin | gold | metal | money | silver | treasure"
},
{
"code": "💴",
"name": "yen banknote",
"keywords": "banknote | bill | currency | money | note | yen"
},
{
"code": "💵",
"name": "dollar banknote",
"keywords": "banknote | bill | currency | dollar | money | note"
},
{
"code": "💶",
"name": "euro banknote",
"keywords": "banknote | bill | currency | euro | money | note"
},
{
"code": "💷",
"name": "pound banknote",
"keywords": "banknote | bill | currency | money | note | pound"
},
{
"code": "💸",
"name": "money with wings",
"keywords": "banknote | bill | fly | money | money with wings | wings"
},
{
"code": "💳",
"name": "credit card",
"keywords": "card | credit | money"
},
{
"code": "🧾",
"name": "receipt",
"keywords": "accounting | bookkeeping | evidence | proof | receipt"
},
{
"code": "💹",
"name": "chart increasing with yen",
"keywords": "chart | chart increasing with yen | graph | growth | money | yen"
},
{
"code": "✉",
"name": "envelope",
"keywords": "email | envelope | letter"
},
{
"code": "📧",
"name": "e-mail",
"keywords": "e-mail | email | letter | mail"
},
{
"code": "📨",
"name": "incoming envelope",
"keywords": "e-mail | email | envelope | incoming | letter | receive"
},
{
"code": "📩",
"name": "envelope with arrow",
"keywords": "arrow | e-mail | email | envelope | envelope with arrow | outgoing"
},
{
"code": "📤",
"name": "outbox tray",
"keywords": "box | letter | mail | outbox | sent | tray"
},
{
"code": "📥",
"name": "inbox tray",
"keywords": "box | inbox | letter | mail | receive | tray"
},
{
"code": "📦",
"name": "package",
"keywords": "box | package | parcel"
},
{
"code": "📫",
"name": "closed mailbox with raised flag",
"keywords": "closed | closed mailbox with raised flag | mail | mailbox | postbox"
},
{
"code": "📪",
"name": "closed mailbox with lowered flag",
"keywords": "closed | closed mailbox with lowered flag | lowered | mail | mailbox | postbox"
},
{
"code": "📬",
"name": "open mailbox with raised flag",
"keywords": "mail | mailbox | open | open mailbox with raised flag | postbox"
},
{
"code": "📭",
"name": "open mailbox with lowered flag",
"keywords": "lowered | mail | mailbox | open | open mailbox with lowered flag | postbox"
},
{
"code": "📮",
"name": "postbox",
"keywords": "mail | mailbox | postbox"
},
{
"code": "🗳",
"name": "ballot box with ballot",
"keywords": "ballot | ballot box with ballot | box"
},
{
"code": "✏",
"name": "pencil",
"keywords": "pencil"
},
{
"code": "✒",
"name": "black nib",
"keywords": "black nib | nib | pen"
},
{
"code": "🖋",
"name": "fountain pen",
"keywords": "fountain | pen"
},
{
"code": "🖊",
"name": "pen",
"keywords": "ballpoint | pen"
},
{
"code": "🖌",
"name": "paintbrush",
"keywords": "paintbrush | painting"
},
{
"code": "🖍",
"name": "crayon",
"keywords": "crayon"
},
{
"code": "📝",
"name": "memo",
"keywords": "memo | pencil"
},
{
"code": "💼",
"name": "briefcase",
"keywords": "briefcase"
},
{
"code": "📁",
"name": "file folder",
"keywords": "file | folder"
},
{
"code": "📂",
"name": "open file folder",
"keywords": "file | folder | open"
},
{
"code": "🗂",
"name": "card index dividers",
"keywords": "card | dividers | index"
},
{
"code": "📅",
"name": "calendar",
"keywords": "calendar | date"
},
{
"code": "📆",
"name": "tear-off calendar",
"keywords": "calendar | tear-off calendar"
},
{
"code": "🗒",
"name": "spiral notepad",
"keywords": "note | pad | spiral | spiral notepad"
},
{
"code": "🗓",
"name": "spiral calendar",
"keywords": "calendar | pad | spiral"
},
{
"code": "📇",
"name": "card index",
"keywords": "card | index | rolodex"
},
{
"code": "📈",
"name": "chart increasing",
"keywords": "chart | chart increasing | graph | growth | trend | upward"
},
{
"code": "📉",
"name": "chart decreasing",
"keywords": "chart | chart decreasing | down | graph | trend"
},
{
"code": "📊",
"name": "bar chart",
"keywords": "bar | chart | graph"
},
{
"code": "📋",
"name": "clipboard",
"keywords": "clipboard"
},
{
"code": "📌",
"name": "pushpin",
"keywords": "pin | pushpin"
},
{
"code": "📍",
"name": "round pushpin",
"keywords": "pin | pushpin | round pushpin"
},
{
"code": "📎",
"name": "paperclip",
"keywords": "paperclip"
},
{
"code": "🖇",
"name": "linked paperclips",
"keywords": "link | linked paperclips | paperclip"
},
{
"code": "📏",
"name": "straight ruler",
"keywords": "ruler | straight edge | straight ruler"
},
{
"code": "📐",
"name": "triangular ruler",
"keywords": "ruler | set | triangle | triangular ruler"
},
{
"code": "✂",
"name": "scissors",
"keywords": "cutting | scissors | tool"
},
{
"code": "🗃",
"name": "card file box",
"keywords": "box | card | file"
},
{
"code": "🗄",
"name": "file cabinet",
"keywords": "cabinet | file | filing"
},
{
"code": "🗑",
"name": "wastebasket",
"keywords": "wastebasket"
},
{
"code": "🔒",
"name": "locked",
"keywords": "closed | locked"
},
{
"code": "🔓",
"name": "unlocked",
"keywords": "lock | open | unlock | unlocked"
},
{
"code": "🔏",
"name": "locked with pen",
"keywords": "ink | lock | locked with pen | nib | pen | privacy"
},
{
"code": "🔐",
"name": "locked with key",
"keywords": "closed | key | lock | locked with key | secure"
},
{
"code": "🔑",
"name": "key",
"keywords": "key | lock | password"
},
{
"code": "🗝",
"name": "old key",
"keywords": "clue | key | lock | old"
},
{
"code": "🔨",
"name": "hammer",
"keywords": "hammer | tool"
},
{
"code": "🪓",
"name": "axe",
"keywords": "axe | chop | hatchet | split | wood"
},
{
"code": "⛏",
"name": "pick",
"keywords": "mining | pick | tool"
},
{
"code": "⚒",
"name": "hammer and pick",
"keywords": "hammer | hammer and pick | pick | tool"
},
{
"code": "🛠",
"name": "hammer and wrench",
"keywords": "hammer | hammer and wrench | spanner | tool | wrench"
},
{
"code": "🗡",
"name": "dagger",
"keywords": "dagger | knife | weapon"
},
{
"code": "⚔",
"name": "crossed swords",
"keywords": "crossed | swords | weapon"
},
{
"code": "🔫",
"name": "water pistol",
"keywords": "gun | handgun | pistol | revolver | tool | water | weapon"
},
{
"code": "🪃",
"name": "boomerang",
"keywords": "australia | boomerang | rebound | repercussion"
},
{
"code": "🏹",
"name": "bow and arrow",
"keywords": "archer | arrow | bow | bow and arrow | Sagittarius | zodiac"
},
{
"code": "🛡",
"name": "shield",
"keywords": "shield | weapon"
},
{
"code": "🪚",
"name": "carpentry saw",
"keywords": "carpenter | carpentry saw | lumber | saw | tool"
},
{
"code": "🔧",
"name": "wrench",
"keywords": "spanner | tool | wrench"
},
{
"code": "🪛",
"name": "screwdriver",
"keywords": "screw | screwdriver | tool"
},
{
"code": "🔩",
"name": "nut and bolt",
"keywords": "bolt | nut | nut and bolt | tool"
},
{
"code": "⚙",
"name": "gear",
"keywords": "cog | cogwheel | gear | tool"
},
{
"code": "🗜",
"name": "clamp",
"keywords": "clamp | compress | tool | vice"
},
{
"code": "⚖",
"name": "balance scale",
"keywords": "balance | justice | Libra | scale | zodiac"
},
{
"code": "🦯",
"name": "white cane",
"keywords": "accessibility | blind | white cane"
},
{
"code": "🔗",
"name": "link",
"keywords": "link"
},
{
"code": "⛓",
"name": "chains",
"keywords": "chain | chains"
},
{
"code": "🪝",
"name": "hook",
"keywords": "catch | crook | curve | ensnare | hook | selling point"
},
{
"code": "🧰",
"name": "toolbox",
"keywords": "chest | mechanic | tool | toolbox"
},
{
"code": "🧲",
"name": "magnet",
"keywords": "attraction | horseshoe | magnet | magnetic"
},
{
"code": "🪜",
"name": "ladder",
"keywords": "climb | ladder | rung | step"
},
{
"code": "⚗",
"name": "alembic",
"keywords": "alembic | chemistry | tool"
},
{
"code": "🧪",
"name": "test tube",
"keywords": "chemist | chemistry | experiment | lab | science | test tube"
},
{
"code": "🧫",
"name": "petri dish",
"keywords": "bacteria | biologist | biology | culture | lab | petri dish"
},
{
"code": "🧬",
"name": "dna",
"keywords": "biologist | dna | evolution | gene | genetics | life"
},
{
"code": "🔬",
"name": "microscope",
"keywords": "microscope | science | tool"
},
{
"code": "🔭",
"name": "telescope",
"keywords": "science | telescope | tool"
},
{
"code": "📡",
"name": "satellite antenna",
"keywords": "antenna | dish | satellite"
},
{
"code": "💉",
"name": "syringe",
"keywords": "medicine | needle | shot | sick | syringe"
},
{
"code": "🩸",
"name": "drop of blood",
"keywords": "bleed | blood donation | drop of blood | injury | medicine | menstruation"
},
{
"code": "💊",
"name": "pill",
"keywords": "doctor | medicine | pill | sick"
},
{
"code": "🩹",
"name": "adhesive bandage",
"keywords": "adhesive bandage | bandage"
},
{
"code": "🩺",
"name": "stethoscope",
"keywords": "doctor | heart | medicine | stethoscope"
},
{
"code": "🚪",
"name": "door",
"keywords": "door"
},
{
"code": "🛗",
"name": "elevator",
"keywords": "accessibility | elevator | hoist | lift"
},
{
"code": "🪞",
"name": "mirror",
"keywords": "mirror | reflection | reflector | speculum"
},
{
"code": "🪟",
"name": "window",
"keywords": "frame | fresh air | opening | transparent | view | window"
},
{
"code": "🛏",
"name": "bed",
"keywords": "bed | hotel | sleep"
},
{
"code": "🛋",
"name": "couch and lamp",
"keywords": "couch | couch and lamp | hotel | lamp"
},
{
"code": "🪑",
"name": "chair",
"keywords": "chair | seat | sit"
},
{
"code": "🚽",
"name": "toilet",
"keywords": "toilet"
},
{
"code": "🪠",
"name": "plunger",
"keywords": "force cup | plumber | plunger | suction | toilet"
},
{
"code": "🚿",
"name": "shower",
"keywords": "shower | water"
},
{
"code": "🛁",
"name": "bathtub",
"keywords": "bath | bathtub"
},
{
"code": "🪤",
"name": "mouse trap",
"keywords": "bait | mouse trap | mousetrap | snare | trap"
},
{
"code": "🪒",
"name": "razor",
"keywords": "razor | sharp | shave"
},
{
"code": "🧴",
"name": "lotion bottle",
"keywords": "lotion | lotion bottle | moisturizer | shampoo | sunscreen"
},
{
"code": "🧷",
"name": "safety pin",
"keywords": "diaper | punk rock | safety pin"
},
{
"code": "🧹",
"name": "broom",
"keywords": "broom | cleaning | sweeping | witch"
},
{
"code": "🧺",
"name": "basket",
"keywords": "basket | farming | laundry | picnic"
},
{
"code": "🧻",
"name": "roll of paper",
"keywords": "paper towels | roll of paper | toilet paper"
},
{
"code": "🪣",
"name": "bucket",
"keywords": "bucket | cask | pail | vat"
},
{
"code": "🧼",
"name": "soap",
"keywords": "bar | bathing | cleaning | lather | soap | soapdish"
},
{
"code": "🪥",
"name": "toothbrush",
"keywords": "bathroom | brush | clean | dental | hygiene | teeth | toothbrush"
},
{
"code": "🧽",
"name": "sponge",
"keywords": "absorbing | cleaning | porous | sponge"
},
{
"code": "🧯",
"name": "fire extinguisher",
"keywords": "extinguish | fire | fire extinguisher | quench"
},
{
"code": "🛒",
"name": "shopping cart",
"keywords": "cart | shopping | trolley"
},
{
"code": "🚬",
"name": "cigarette",
"keywords": "cigarette | smoking"
},
{
"code": "⚰",
"name": "coffin",
"keywords": "coffin | death"
},
{
"code": "🪦",
"name": "headstone",
"keywords": "cemetery | grave | graveyard | headstone | tombstone"
},
{
"code": "⚱",
"name": "funeral urn",
"keywords": "ashes | death | funeral | urn"
},
{
"code": "🗿",
"name": "moai",
"keywords": "face | moai | moyai | statue"
},
{
"code": "🪧",
"name": "placard",
"keywords": "demonstration | picket | placard | protest | sign"
},
{
"code": "🏧",
"name": "ATM sign",
"keywords": "atm | ATM sign | automated | bank | teller"
},
{
"code": "🚮",
"name": "litter in bin sign",
"keywords": "litter | litter bin | litter in bin sign"
},
{
"code": "🚰",
"name": "potable water",
"keywords": "drinking | potable | water"
},
{
"code": "♿",
"name": "wheelchair symbol",
"keywords": "access | wheelchair symbol"
},
{
"code": "🚹",
"name": "men’s room",
"keywords": "lavatory | man | men’s room | restroom | wc"
},
{
"code": "🚺",
"name": "women’s room",
"keywords": "lavatory | restroom | wc | woman | women’s room"
},
{
"code": "🚻",
"name": "restroom",
"keywords": "lavatory | restroom | WC"
},
{
"code": "🚼",
"name": "baby symbol",
"keywords": "baby | baby symbol | changing"
},
{
"code": "🚾",
"name": "water closet",
"keywords": "closet | lavatory | restroom | water | wc"
},
{
"code": "🛂",
"name": "passport control",
"keywords": "control | passport"
},
{
"code": "🛃",
"name": "customs",
"keywords": "customs"
},
{
"code": "🛄",
"name": "baggage claim",
"keywords": "baggage | claim"
},
{
"code": "🛅",
"name": "left luggage",
"keywords": "baggage | left luggage | locker | luggage"
},
{
"code": "⚠",
"name": "warning",
"keywords": "warning"
},
{
"code": "🚸",
"name": "children crossing",
"keywords": "child | children crossing | crossing | pedestrian | traffic"
},
{
"code": "⛔",
"name": "no entry",
"keywords": "entry | forbidden | no | not | prohibited | traffic"
},
{
"code": "🚫",
"name": "prohibited",
"keywords": "entry | forbidden | no | not | prohibited"
},
{
"code": "🚳",
"name": "no bicycles",
"keywords": "bicycle | bike | forbidden | no | no bicycles | prohibited"
},
{
"code": "🚭",
"name": "no smoking",
"keywords": "forbidden | no | not | prohibited | smoking"
},
{
"code": "🚯",
"name": "no littering",
"keywords": "forbidden | litter | no | no littering | not | prohibited"
},
{
"code": "🚱",
"name": "non-potable water",
"keywords": "non-drinking | non-potable | water"
},
{
"code": "🚷",
"name": "no pedestrians",
"keywords": "forbidden | no | no pedestrians | not | pedestrian | prohibited"
},
{
"code": "📵",
"name": "no mobile phones",
"keywords": "cell | forbidden | mobile | no | no mobile phones | phone"
},
{
"code": "🔞",
"name": "no one under eighteen",
"keywords": "18 | age restriction | eighteen | no one under eighteen | prohibited | underage"
},
{
"code": "☢",
"name": "radioactive",
"keywords": "radioactive | sign"
},
{
"code": "☣",
"name": "biohazard",
"keywords": "biohazard | sign"
},
{
"code": "⬆",
"name": "up arrow",
"keywords": "arrow | cardinal | direction | north | up arrow"
},
{
"code": "↗",
"name": "up-right arrow",
"keywords": "arrow | direction | intercardinal | northeast | up-right arrow"
},
{
"code": "➡",
"name": "right arrow",
"keywords": "arrow | cardinal | direction | east | right arrow"
},
{
"code": "↘",
"name": "down-right arrow",
"keywords": "arrow | direction | down-right arrow | intercardinal | southeast"
},
{
"code": "⬇",
"name": "down arrow",
"keywords": "arrow | cardinal | direction | down | south"
},
{
"code": "↙",
"name": "down-left arrow",
"keywords": "arrow | direction | down-left arrow | intercardinal | southwest"
},
{
"code": "⬅",
"name": "left arrow",
"keywords": "arrow | cardinal | direction | left arrow | west"
},
{
"code": "↖",
"name": "up-left arrow",
"keywords": "arrow | direction | intercardinal | northwest | up-left arrow"
},
{
"code": "↕",
"name": "up-down arrow",
"keywords": "arrow | up-down arrow"
},
{
"code": "↔",
"name": "left-right arrow",
"keywords": "arrow | left-right arrow"
},
{
"code": "↩",
"name": "right arrow curving left",
"keywords": "arrow | right arrow curving left"
},
{
"code": "↪",
"name": "left arrow curving right",
"keywords": "arrow | left arrow curving right"
},
{
"code": "⤴",
"name": "right arrow curving up",
"keywords": "arrow | right arrow curving up"
},
{
"code": "⤵",
"name": "right arrow curving down",
"keywords": "arrow | down | right arrow curving down"
},
{
"code": "🔃",
"name": "clockwise vertical arrows",
"keywords": "arrow | clockwise | clockwise vertical arrows | reload"
},
{
"code": "🔄",
"name": "counterclockwise arrows button",
"keywords": "anticlockwise | arrow | counterclockwise | counterclockwise arrows button | withershins"
},
{
"code": "🔙",
"name": "BACK arrow",
"keywords": "arrow | back | BACK arrow"
},
{
"code": "🔚",
"name": "END arrow",
"keywords": "arrow | end | END arrow"
},
{
"code": "🔛",
"name": "ON! arrow",
"keywords": "arrow | mark | on | ON! arrow"
},
{
"code": "🔜",
"name": "SOON arrow",
"keywords": "arrow | soon | SOON arrow"
},
{
"code": "🔝",
"name": "TOP arrow",
"keywords": "arrow | top | TOP arrow | up"
},
{
"code": "🛐",
"name": "place of worship",
"keywords": "place of worship | religion | worship"
},
{
"code": "⚛",
"name": "atom symbol",
"keywords": "atheist | atom | atom symbol"
},
{
"code": "🕉",
"name": "om",
"keywords": "Hindu | om | religion"
},
{
"code": "✡",
"name": "star of David",
"keywords": "David | Jew | Jewish | religion | star | star of David"
},
{
"code": "☸",
"name": "wheel of dharma",
"keywords": "Buddhist | dharma | religion | wheel | wheel of dharma"
},
{
"code": "☯",
"name": "yin yang",
"keywords": "religion | tao | taoist | yang | yin"
},
{
"code": "✝",
"name": "latin cross",
"keywords": "Christian | cross | latin cross | religion"
},
{
"code": "☦",
"name": "orthodox cross",
"keywords": "Christian | cross | orthodox cross | religion"
},
{
"code": "☪",
"name": "star and crescent",
"keywords": "islam | Muslim | religion | star and crescent"
},
{
"code": "☮",
"name": "peace symbol",
"keywords": "peace | peace symbol"
},
{
"code": "🕎",
"name": "menorah",
"keywords": "candelabrum | candlestick | menorah | religion"
},
{
"code": "🔯",
"name": "dotted six-pointed star",
"keywords": "dotted six-pointed star | fortune | star"
},
{
"code": "♈",
"name": "Aries",
"keywords": "Aries | ram | zodiac"
},
{
"code": "♉",
"name": "Taurus",
"keywords": "bull | ox | Taurus | zodiac"
},
{
"code": "♊",
"name": "Gemini",
"keywords": "Gemini | twins | zodiac"
},
{
"code": "♋",
"name": "Cancer",
"keywords": "Cancer | crab | zodiac"
},
{
"code": "♌",
"name": "Leo",
"keywords": "Leo | lion | zodiac"
},
{
"code": "♍",
"name": "Virgo",
"keywords": "Virgo | zodiac"
},
{
"code": "♎",
"name": "Libra",
"keywords": "balance | justice | Libra | scales | zodiac"
},
{
"code": "♏",
"name": "Scorpio",
"keywords": "Scorpio | scorpion | scorpius | zodiac"
},
{
"code": "♐",
"name": "Sagittarius",
"keywords": "archer | Sagittarius | zodiac"
},
{
"code": "♑",
"name": "Capricorn",
"keywords": "Capricorn | goat | zodiac"
},
{
"code": "♒",
"name": "Aquarius",
"keywords": "Aquarius | bearer | water | zodiac"
},
{
"code": "♓",
"name": "Pisces",
"keywords": "fish | Pisces | zodiac"
},
{
"code": "⛎",
"name": "Ophiuchus",
"keywords": "bearer | Ophiuchus | serpent | snake | zodiac"
},
{
"code": "🔀",
"name": "shuffle tracks button",
"keywords": "arrow | crossed | shuffle tracks button"
},
{
"code": "🔁",
"name": "repeat button",
"keywords": "arrow | clockwise | repeat | repeat button"
},
{
"code": "🔂",
"name": "repeat single button",
"keywords": "arrow | clockwise | once | repeat single button"
},
{
"code": "▶",
"name": "play button",
"keywords": "arrow | play | play button | right | triangle"
},
{
"code": "⏩",
"name": "fast-forward button",
"keywords": "arrow | double | fast | fast-forward button | forward"
},
{
"code": "⏭",
"name": "next track button",
"keywords": "arrow | next scene | next track | next track button | triangle"
},
{
"code": "⏯",
"name": "play or pause button",
"keywords": "arrow | pause | play | play or pause button | right | triangle"
},
{
"code": "◀",
"name": "reverse button",
"keywords": "arrow | left | reverse | reverse button | triangle"
},
{
"code": "⏪",
"name": "fast reverse button",
"keywords": "arrow | double | fast reverse button | rewind"
},
{
"code": "⏮",
"name": "last track button",
"keywords": "arrow | last track button | previous scene | previous track | triangle"
},
{
"code": "🔼",
"name": "upwards button",
"keywords": "arrow | button | red | upwards button"
},
{
"code": "⏫",
"name": "fast up button",
"keywords": "arrow | double | fast up button"
},
{
"code": "🔽",
"name": "downwards button",
"keywords": "arrow | button | down | downwards button | red"
},
{
"code": "⏬",
"name": "fast down button",
"keywords": "arrow | double | down | fast down button"
},
{
"code": "⏸",
"name": "pause button",
"keywords": "bar | double | pause | pause button | vertical"
},
{
"code": "⏹",
"name": "stop button",
"keywords": "square | stop | stop button"
},
{
"code": "⏺",
"name": "record button",
"keywords": "circle | record | record button"
},
{
"code": "⏏",
"name": "eject button",
"keywords": "eject | eject button"
},
{
"code": "🎦",
"name": "cinema",
"keywords": "camera | cinema | film | movie"
},
{
"code": "🔅",
"name": "dim button",
"keywords": "brightness | dim | dim button | low"
},
{
"code": "🔆",
"name": "bright button",
"keywords": "bright | bright button | brightness"
},
{
"code": "📶",
"name": "antenna bars",
"keywords": "antenna | antenna bars | bar | cell | mobile | phone"
},
{
"code": "📳",
"name": "vibration mode",
"keywords": "cell | mobile | mode | phone | telephone | vibration"
},
{
"code": "📴",
"name": "mobile phone off",
"keywords": "cell | mobile | off | phone | telephone"
},
{
"code": "♀",
"name": "female sign",
"keywords": "female sign | woman"
},
{
"code": "♂",
"name": "male sign",
"keywords": "male sign | man"
},
{
"code": "⚧",
"name": "transgender symbol",
"keywords": "transgender | transgender symbol"
},
{
"code": "✖",
"name": "multiply",
"keywords": "× | cancel | multiplication | multiply | sign | x"
},
{
"code": "➕",
"name": "plus",
"keywords": "+ | math | plus | sign"
},
{
"code": "➖",
"name": "minus",
"keywords": "- | − | math | minus | sign"
},
{
"code": "➗",
"name": "divide",
"keywords": "÷ | divide | division | math | sign"
},
{
"code": "♾",
"name": "infinity",
"keywords": "forever | infinity | unbounded | universal"
},
{
"code": "‼",
"name": "double exclamation mark",
"keywords": "! | !! | bangbang | double exclamation mark | exclamation | mark"
},
{
"code": "⁉",
"name": "exclamation question mark",
"keywords": "! | !? | ? | exclamation | interrobang | mark | punctuation | question"
},
{
"code": "❓",
"name": "red question mark",
"keywords": "? | mark | punctuation | question | red question mark"
},
{
"code": "❔",
"name": "white question mark",
"keywords": "? | mark | outlined | punctuation | question | white question mark"
},
{
"code": "❕",
"name": "white exclamation mark",
"keywords": "! | exclamation | mark | outlined | punctuation | white exclamation mark"
},
{
"code": "❗",
"name": "red exclamation mark",
"keywords": "! | exclamation | mark | punctuation | red exclamation mark"
},
{
"code": "〰",
"name": "wavy dash",
"keywords": "dash | punctuation | wavy"
},
{
"code": "💱",
"name": "currency exchange",
"keywords": "bank | currency | exchange | money"
},
{
"code": "💲",
"name": "heavy dollar sign",
"keywords": "currency | dollar | heavy dollar sign | money"
},
{
"code": "⚕",
"name": "medical symbol",
"keywords": "aesculapius | medical symbol | medicine | staff"
},
{
"code": "♻",
"name": "recycling symbol",
"keywords": "recycle | recycling symbol"
},
{
"code": "⚜",
"name": "fleur-de-lis",
"keywords": "fleur-de-lis"
},
{
"code": "🔱",
"name": "trident emblem",
"keywords": "anchor | emblem | ship | tool | trident"
},
{
"code": "📛",
"name": "name badge",
"keywords": "badge | name"
},
{
"code": "🔰",
"name": "Japanese symbol for beginner",
"keywords": "beginner | chevron | Japanese | Japanese symbol for beginner | leaf"
},
{
"code": "⭕",
"name": "hollow red circle",
"keywords": "circle | hollow red circle | large | o | red"
},
{
"code": "✅",
"name": "check mark button",
"keywords": "✓ | button | check | mark"
},
{
"code": "☑",
"name": "check box with check",
"keywords": "✓ | box | check | check box with check"
},
{
"code": "✔",
"name": "check mark",
"keywords": "✓ | check | mark"
},
{
"code": "❌",
"name": "cross mark",
"keywords": "× | cancel | cross | mark | multiplication | multiply | x"
},
{
"code": "❎",
"name": "cross mark button",
"keywords": "× | cross mark button | mark | square | x"
},
{
"code": "➰",
"name": "curly loop",
"keywords": "curl | curly loop | loop"
},
{
"code": "➿",
"name": "double curly loop",
"keywords": "curl | double | double curly loop | loop"
},
{
"code": "〽",
"name": "part alternation mark",
"keywords": "mark | part | part alternation mark"
},
{
"code": "✳",
"name": "eight-spoked asterisk",
"keywords": "* | asterisk | eight-spoked asterisk"
},
{
"code": "✴",
"name": "eight-pointed star",
"keywords": "* | eight-pointed star | star"
},
{
"code": "❇",
"name": "sparkle",
"keywords": "* | sparkle"
},
{
"code": "©",
"name": "copyright",
"keywords": "c | copyright"
},
{
"code": "®",
"name": "registered",
"keywords": "r | registered"
},
{
"code": "™",
"name": "trade mark",
"keywords": "mark | tm | trade mark | trademark"
},
{
"code": "#️⃣",
"name": "keycap: #",
"keywords": "keycap"
},
{
"code": "*️⃣",
"name": "keycap: *",
"keywords": "keycap"
},
{
"code": "0️⃣",
"name": "keycap: 0",
"keywords": "keycap"
},
{
"code": "1️⃣",
"name": "keycap: 1",
"keywords": "keycap"
},
{
"code": "2️⃣",
"name": "keycap: 2",
"keywords": "keycap"
},
{
"code": "3️⃣",
"name": "keycap: 3",
"keywords": "keycap"
},
{
"code": "4️⃣",
"name": "keycap: 4",
"keywords": "keycap"
},
{
"code": "5️⃣",
"name": "keycap: 5",
"keywords": "keycap"
},
{
"code": "6️⃣",
"name": "keycap: 6",
"keywords": "keycap"
},
{
"code": "7️⃣",
"name": "keycap: 7",
"keywords": "keycap"
},
{
"code": "8️⃣",
"name": "keycap: 8",
"keywords": "keycap"
},
{
"code": "9️⃣",
"name": "keycap: 9",
"keywords": "keycap"
},
{
"code": "🔟",
"name": "keycap: 10",
"keywords": "keycap"
},
{
"code": "🔠",
"name": "input latin uppercase",
"keywords": "ABCD | input | latin | letters | uppercase"
},
{
"code": "🔡",
"name": "input latin lowercase",
"keywords": "abcd | input | latin | letters | lowercase"
},
{
"code": "🔢",
"name": "input numbers",
"keywords": "1234 | input | numbers"
},
{
"code": "🔣",
"name": "input symbols",
"keywords": "〒♪&% | input | input symbols"
},
{
"code": "🔤",
"name": "input latin letters",
"keywords": "abc | alphabet | input | latin | letters"
},
{
"code": "🅰",
"name": "A button (blood type)",
"keywords": "a | A button (blood type) | blood type"
},
{
"code": "🆎",
"name": "AB button (blood type)",
"keywords": "ab | AB button (blood type) | blood type"
},
{
"code": "🅱",
"name": "B button (blood type)",
"keywords": "b | B button (blood type) | blood type"
},
{
"code": "🆑",
"name": "CL button",
"keywords": "cl | CL button"
},
{
"code": "🆒",
"name": "COOL button",
"keywords": "cool | COOL button"
},
{
"code": "🆓",
"name": "FREE button",
"keywords": "free | FREE button"
},
{
"code": "ℹ",
"name": "information",
"keywords": "i | information"
},
{
"code": "🆔",
"name": "ID button",
"keywords": "id | ID button | identity"
},
{
"code": "Ⓜ",
"name": "circled M",
"keywords": "circle | circled M | m"
},
{
"code": "🆕",
"name": "NEW button",
"keywords": "new | NEW button"
},
{
"code": "🆖",
"name": "NG button",
"keywords": "ng | NG button"
},
{
"code": "🅾",
"name": "O button (blood type)",
"keywords": "blood type | o | O button (blood type)"
},
{
"code": "🆗",
"name": "OK button",
"keywords": "OK | OK button"
},
{
"code": "🅿",
"name": "P button",
"keywords": "P button | parking"
},
{
"code": "🆘",
"name": "SOS button",
"keywords": "help | sos | SOS button"
},
{
"code": "🆙",
"name": "UP! button",
"keywords": "mark | up | UP! button"
},
{
"code": "🆚",
"name": "VS button",
"keywords": "versus | vs | VS button"
},
{
"code": "🈁",
"name": "Japanese “here” button",
"keywords": "“here” | Japanese | Japanese “here” button | katakana | ココ"
},
{
"code": "🈂",
"name": "Japanese “service charge” button",
"keywords": "“service charge” | Japanese | Japanese “service charge” button | katakana | サ"
},
{
"code": "🈷",
"name": "Japanese “monthly amount” button",
"keywords": "“monthly amount” | ideograph | Japanese | Japanese “monthly amount” button | 月"
},
{
"code": "🈶",
"name": "Japanese “not free of charge” button",
"keywords": "“not free of charge” | ideograph | Japanese | Japanese “not free of charge” button | 有"
},
{
"code": "🈯",
"name": "Japanese “reserved” button",
"keywords": "“reserved” | ideograph | Japanese | Japanese “reserved” button | 指"
},
{
"code": "🉐",
"name": "Japanese “bargain” button",
"keywords": "“bargain” | ideograph | Japanese | Japanese “bargain” button | 得"
},
{
"code": "🈹",
"name": "Japanese “discount” button",
"keywords": "“discount” | ideograph | Japanese | Japanese “discount” button | 割"
},
{
"code": "🈚",
"name": "Japanese “free of charge” button",
"keywords": "“free of charge” | ideograph | Japanese | Japanese “free of charge” button | 無"
},
{
"code": "🈲",
"name": "Japanese “prohibited” button",
"keywords": "“prohibited” | ideograph | Japanese | Japanese “prohibited” button | 禁"
},
{
"code": "🉑",
"name": "Japanese “acceptable” button",
"keywords": "“acceptable” | ideograph | Japanese | Japanese “acceptable” button | 可"
},
{
"code": "🈸",
"name": "Japanese “application” button",
"keywords": "“application” | ideograph | Japanese | Japanese “application” button | 申"
},
{
"code": "🈴",
"name": "Japanese “passing grade” button",
"keywords": "“passing grade” | ideograph | Japanese | Japanese “passing grade” button | 合"
},
{
"code": "🈳",
"name": "Japanese “vacancy” button",
"keywords": "“vacancy” | ideograph | Japanese | Japanese “vacancy” button | 空"
},
{
"code": "㊗",
"name": "Japanese “congratulations” button",
"keywords": "“congratulations” | ideograph | Japanese | Japanese “congratulations” button | 祝"
},
{
"code": "㊙",
"name": "Japanese “secret” button",
"keywords": "“secret” | ideograph | Japanese | Japanese “secret” button | 秘"
},
{
"code": "🈺",
"name": "Japanese “open for business” button",
"keywords": "“open for business” | ideograph | Japanese | Japanese “open for business” button | 営"
},
{
"code": "🈵",
"name": "Japanese “no vacancy” button",
"keywords": "“no vacancy” | ideograph | Japanese | Japanese “no vacancy” button | 満"
},
{
"code": "🔴",
"name": "red circle",
"keywords": "circle | geometric | red"
},
{
"code": "🟠",
"name": "orange circle",
"keywords": "circle | orange"
},
{
"code": "🟡",
"name": "yellow circle",
"keywords": "circle | yellow"
},
{
"code": "🟢",
"name": "green circle",
"keywords": "circle | green"
},
{
"code": "🔵",
"name": "blue circle",
"keywords": "blue | circle | geometric"
},
{
"code": "🟣",
"name": "purple circle",
"keywords": "circle | purple"
},
{
"code": "🟤",
"name": "brown circle",
"keywords": "brown | circle"
},
{
"code": "⚫",
"name": "black circle",
"keywords": "black circle | circle | geometric"
},
{
"code": "⚪",
"name": "white circle",
"keywords": "circle | geometric | white circle"
},
{
"code": "🟥",
"name": "red square",
"keywords": "red | square"
},
{
"code": "🟧",
"name": "orange square",
"keywords": "orange | square"
},
{
"code": "🟨",
"name": "yellow square",
"keywords": "square | yellow"
},
{
"code": "🟩",
"name": "green square",
"keywords": "green | square"
},
{
"code": "🟦",
"name": "blue square",
"keywords": "blue | square"
},
{
"code": "🟪",
"name": "purple square",
"keywords": "purple | square"
},
{
"code": "🟫",
"name": "brown square",
"keywords": "brown | square"
},
{
"code": "⬛",
"name": "black large square",
"keywords": "black large square | geometric | square"
},
{
"code": "⬜",
"name": "white large square",
"keywords": "geometric | square | white large square"
},
{
"code": "◼",
"name": "black medium square",
"keywords": "black medium square | geometric | square"
},
{
"code": "◻",
"name": "white medium square",
"keywords": "geometric | square | white medium square"
},
{
"code": "◾",
"name": "black medium-small square",
"keywords": "black medium-small square | geometric | square"
},
{
"code": "◽",
"name": "white medium-small square",
"keywords": "geometric | square | white medium-small square"
},
{
"code": "▪",
"name": "black small square",
"keywords": "black small square | geometric | square"
},
{
"code": "▫",
"name": "white small square",
"keywords": "geometric | square | white small square"
},
{
"code": "🔶",
"name": "large orange diamond",
"keywords": "diamond | geometric | large orange diamond | orange"
},
{
"code": "🔷",
"name": "large blue diamond",
"keywords": "blue | diamond | geometric | large blue diamond"
},
{
"code": "🔸",
"name": "small orange diamond",
"keywords": "diamond | geometric | orange | small orange diamond"
},
{
"code": "🔹",
"name": "small blue diamond",
"keywords": "blue | diamond | geometric | small blue diamond"
},
{
"code": "🔺",
"name": "red triangle pointed up",
"keywords": "geometric | red | red triangle pointed up"
},
{
"code": "🔻",
"name": "red triangle pointed down",
"keywords": "down | geometric | red | red triangle pointed down"
},
{
"code": "💠",
"name": "diamond with a dot",
"keywords": "comic | diamond | diamond with a dot | geometric | inside"
},
{
"code": "🔘",
"name": "radio button",
"keywords": "button | geometric | radio"
},
{
"code": "🔳",
"name": "white square button",
"keywords": "button | geometric | outlined | square | white square button"
},
{
"code": "🔲",
"name": "black square button",
"keywords": "black square button | button | geometric | square"
},
{
"code": "🏁",
"name": "chequered flag",
"keywords": "checkered | chequered | chequered flag | racing"
},
{
"code": "🚩",
"name": "triangular flag",
"keywords": "post | triangular flag"
},
{
"code": "🎌",
"name": "crossed flags",
"keywords": "celebration | cross | crossed | crossed flags | Japanese"
},
{
"code": "🏴",
"name": "black flag",
"keywords": "black flag | waving"
},
{
"code": "🏳",
"name": "white flag",
"keywords": "waving | white flag"
},
{
"code": "🏳️‍🌈",
"name": "rainbow flag",
"keywords": "pride | rainbow | rainbow flag"
},
{
"code": "🏳️‍⚧️",
"name": "transgender flag",
"keywords": "flag | light blue | pink | transgender | white"
},
{
"code": "🏴‍☠️",
"name": "pirate flag",
"keywords": "Jolly Roger | pirate | pirate flag | plunder | treasure"
},
{
"code": "🇦🇨",
"name": "flag: Ascension Island",
"keywords": "flag"
},
{
"code": "🇦🇩",
"name": "flag: Andorra",
"keywords": "flag"
},
{
"code": "🇦🇪",
"name": "flag: United Arab Emirates",
"keywords": "flag"
},
{
"code": "🇦🇫",
"name": "flag: Afghanistan",
"keywords": "flag"
},
{
"code": "🇦🇬",
"name": "flag: Antigua & Barbuda",
"keywords": "flag"
},
{
"code": "🇦🇮",
"name": "flag: Anguilla",
"keywords": "flag"
},
{
"code": "🇦🇱",
"name": "flag: Albania",
"keywords": "flag"
},
{
"code": "🇦🇲",
"name": "flag: Armenia",
"keywords": "flag"
},
{
"code": "🇦🇴",
"name": "flag: Angola",
"keywords": "flag"
},
{
"code": "🇦🇶",
"name": "flag: Antarctica",
"keywords": "flag"
},
{
"code": "🇦🇷",
"name": "flag: Argentina",
"keywords": "flag"
},
{
"code": "🇦🇸",
"name": "flag: American Samoa",
"keywords": "flag"
},
{
"code": "🇦🇹",
"name": "flag: Austria",
"keywords": "flag"
},
{
"code": "🇦🇺",
"name": "flag: Australia",
"keywords": "flag"
},
{
"code": "🇦🇼",
"name": "flag: Aruba",
"keywords": "flag"
},
{
"code": "🇦🇽",
"name": "flag: Åland Islands",
"keywords": "flag"
},
{
"code": "🇦🇿",
"name": "flag: Azerbaijan",
"keywords": "flag"
},
{
"code": "🇧🇦",
"name": "flag: Bosnia & Herzegovina",
"keywords": "flag"
},
{
"code": "🇧🇧",
"name": "flag: Barbados",
"keywords": "flag"
},
{
"code": "🇧🇩",
"name": "flag: Bangladesh",
"keywords": "flag"
},
{
"code": "🇧🇪",
"name": "flag: Belgium",
"keywords": "flag"
},
{
"code": "🇧🇫",
"name": "flag: Burkina Faso",
"keywords": "flag"
},
{
"code": "🇧🇬",
"name": "flag: Bulgaria",
"keywords": "flag"
},
{
"code": "🇧🇭",
"name": "flag: Bahrain",
"keywords": "flag"
},
{
"code": "🇧🇮",
"name": "flag: Burundi",
"keywords": "flag"
},
{
"code": "🇧🇯",
"name": "flag: Benin",
"keywords": "flag"
},
{
"code": "🇧🇱",
"name": "flag: St. Barthélemy",
"keywords": "flag"
},
{
"code": "🇧🇲",
"name": "flag: Bermuda",
"keywords": "flag"
},
{
"code": "🇧🇳",
"name": "flag: Brunei",
"keywords": "flag"
},
{
"code": "🇧🇴",
"name": "flag: Bolivia",
"keywords": "flag"
},
{
"code": "🇧🇶",
"name": "flag: Caribbean Netherlands",
"keywords": "flag"
},
{
"code": "🇧🇷",
"name": "flag: Brazil",
"keywords": "flag"
},
{
"code": "🇧🇸",
"name": "flag: Bahamas",
"keywords": "flag"
},
{
"code": "🇧🇹",
"name": "flag: Bhutan",
"keywords": "flag"
},
{
"code": "🇧🇻",
"name": "flag: Bouvet Island",
"keywords": "flag"
},
{
"code": "🇧🇼",
"name": "flag: Botswana",
"keywords": "flag"
},
{
"code": "🇧🇾",
"name": "flag: Belarus",
"keywords": "flag"
},
{
"code": "🇧🇿",
"name": "flag: Belize",
"keywords": "flag"
},
{
"code": "🇨🇦",
"name": "flag: Canada",
"keywords": "flag"
},
{
"code": "🇨🇨",
"name": "flag: Cocos (Keeling) Islands",
"keywords": "flag"
},
{
"code": "🇨🇩",
"name": "flag: Congo - Kinshasa",
"keywords": "flag"
},
{
"code": "🇨🇫",
"name": "flag: Central African Republic",
"keywords": "flag"
},
{
"code": "🇨🇬",
"name": "flag: Congo - Brazzaville",
"keywords": "flag"
},
{
"code": "🇨🇭",
"name": "flag: Switzerland",
"keywords": "flag"
},
{
"code": "🇨🇮",
"name": "flag: Côte d’Ivoire",
"keywords": "flag"
},
{
"code": "🇨🇰",
"name": "flag: Cook Islands",
"keywords": "flag"
},
{
"code": "🇨🇱",
"name": "flag: Chile",
"keywords": "flag"
},
{
"code": "🇨🇲",
"name": "flag: Cameroon",
"keywords": "flag"
},
{
"code": "🇨🇳",
"name": "flag: China",
"keywords": "flag"
},
{
"code": "🇨🇴",
"name": "flag: Colombia",
"keywords": "flag"
},
{
"code": "🇨🇵",
"name": "flag: Clipperton Island",
"keywords": "flag"
},
{
"code": "🇨🇷",
"name": "flag: Costa Rica",
"keywords": "flag"
},
{
"code": "🇨🇺",
"name": "flag: Cuba",
"keywords": "flag"
},
{
"code": "🇨🇻",
"name": "flag: Cape Verde",
"keywords": "flag"
},
{
"code": "🇨🇼",
"name": "flag: Curaçao",
"keywords": "flag"
},
{
"code": "🇨🇽",
"name": "flag: Christmas Island",
"keywords": "flag"
},
{
"code": "🇨🇾",
"name": "flag: Cyprus",
"keywords": "flag"
},
{
"code": "🇨🇿",
"name": "flag: Czechia",
"keywords": "flag"
},
{
"code": "🇩🇪",
"name": "flag: Germany",
"keywords": "flag"
},
{
"code": "🇩🇬",
"name": "flag: Diego Garcia",
"keywords": "flag"
},
{
"code": "🇩🇯",
"name": "flag: Djibouti",
"keywords": "flag"
},
{
"code": "🇩🇰",
"name": "flag: Denmark",
"keywords": "flag"
},
{
"code": "🇩🇲",
"name": "flag: Dominica",
"keywords": "flag"
},
{
"code": "🇩🇴",
"name": "flag: Dominican Republic",
"keywords": "flag"
},
{
"code": "🇩🇿",
"name": "flag: Algeria",
"keywords": "flag"
},
{
"code": "🇪🇦",
"name": "flag: Ceuta & Melilla",
"keywords": "flag"
},
{
"code": "🇪🇨",
"name": "flag: Ecuador",
"keywords": "flag"
},
{
"code": "🇪🇪",
"name": "flag: Estonia",
"keywords": "flag"
},
{
"code": "🇪🇬",
"name": "flag: Egypt",
"keywords": "flag"
},
{
"code": "🇪🇭",
"name": "flag: Western Sahara",
"keywords": "flag"
},
{
"code": "🇪🇷",
"name": "flag: Eritrea",
"keywords": "flag"
},
{
"code": "🇪🇸",
"name": "flag: Spain",
"keywords": "flag"
},
{
"code": "🇪🇹",
"name": "flag: Ethiopia",
"keywords": "flag"
},
{
"code": "🇪🇺",
"name": "flag: European Union",
"keywords": "flag"
},
{
"code": "🇫🇮",
"name": "flag: Finland",
"keywords": "flag"
},
{
"code": "🇫🇯",
"name": "flag: Fiji",
"keywords": "flag"
},
{
"code": "🇫🇰",
"name": "flag: Falkland Islands",
"keywords": "flag"
},
{
"code": "🇫🇲",
"name": "flag: Micronesia",
"keywords": "flag"
},
{
"code": "🇫🇴",
"name": "flag: Faroe Islands",
"keywords": "flag"
},
{
"code": "🇫🇷",
"name": "flag: France",
"keywords": "flag"
},
{
"code": "🇬🇦",
"name": "flag: Gabon",
"keywords": "flag"
},
{
"code": "🇬🇧",
"name": "flag: United Kingdom",
"keywords": "flag"
},
{
"code": "🇬🇩",
"name": "flag: Grenada",
"keywords": "flag"
},
{
"code": "🇬🇪",
"name": "flag: Georgia",
"keywords": "flag"
},
{
"code": "🇬🇫",
"name": "flag: French Guiana",
"keywords": "flag"
},
{
"code": "🇬🇬",
"name": "flag: Guernsey",
"keywords": "flag"
},
{
"code": "🇬🇭",
"name": "flag: Ghana",
"keywords": "flag"
},
{
"code": "🇬🇮",
"name": "flag: Gibraltar",
"keywords": "flag"
},
{
"code": "🇬🇱",
"name": "flag: Greenland",
"keywords": "flag"
},
{
"code": "🇬🇲",
"name": "flag: Gambia",
"keywords": "flag"
},
{
"code": "🇬🇳",
"name": "flag: Guinea",
"keywords": "flag"
},
{
"code": "🇬🇵",
"name": "flag: Guadeloupe",
"keywords": "flag"
},
{
"code": "🇬🇶",
"name": "flag: Equatorial Guinea",
"keywords": "flag"
},
{
"code": "🇬🇷",
"name": "flag: Greece",
"keywords": "flag"
},
{
"code": "🇬🇸",
"name": "flag: South Georgia & South Sandwich Islands",
"keywords": "flag"
},
{
"code": "🇬🇹",
"name": "flag: Guatemala",
"keywords": "flag"
},
{
"code": "🇬🇺",
"name": "flag: Guam",
"keywords": "flag"
},
{
"code": "🇬🇼",
"name": "flag: Guinea-Bissau",
"keywords": "flag"
},
{
"code": "🇬🇾",
"name": "flag: Guyana",
"keywords": "flag"
},
{
"code": "🇭🇰",
"name": "flag: Hong Kong SAR China",
"keywords": "flag"
},
{
"code": "🇭🇲",
"name": "flag: Heard & McDonald Islands",
"keywords": "flag"
},
{
"code": "🇭🇳",
"name": "flag: Honduras",
"keywords": "flag"
},
{
"code": "🇭🇷",
"name": "flag: Croatia",
"keywords": "flag"
},
{
"code": "🇭🇹",
"name": "flag: Haiti",
"keywords": "flag"
},
{
"code": "🇭🇺",
"name": "flag: Hungary",
"keywords": "flag"
},
{
"code": "🇮🇨",
"name": "flag: Canary Islands",
"keywords": "flag"
},
{
"code": "🇮🇩",
"name": "flag: Indonesia",
"keywords": "flag"
},
{
"code": "🇮🇪",
"name": "flag: Ireland",
"keywords": "flag"
},
{
"code": "🇮🇱",
"name": "flag: Israel",
"keywords": "flag"
},
{
"code": "🇮🇲",
"name": "flag: Isle of Man",
"keywords": "flag"
},
{
"code": "🇮🇳",
"name": "flag: India",
"keywords": "flag"
},
{
"code": "🇮🇴",
"name": "flag: British Indian Ocean Territory",
"keywords": "flag"
},
{
"code": "🇮🇶",
"name": "flag: Iraq",
"keywords": "flag"
},
{
"code": "🇮🇷",
"name": "flag: Iran",
"keywords": "flag"
},
{
"code": "🇮🇸",
"name": "flag: Iceland",
"keywords": "flag"
},
{
"code": "🇮🇹",
"name": "flag: Italy",
"keywords": "flag"
},
{
"code": "🇯🇪",
"name": "flag: Jersey",
"keywords": "flag"
},
{
"code": "🇯🇲",
"name": "flag: Jamaica",
"keywords": "flag"
},
{
"code": "🇯🇴",
"name": "flag: Jordan",
"keywords": "flag"
},
{
"code": "🇯🇵",
"name": "flag: Japan",
"keywords": "flag"
},
{
"code": "🇰🇪",
"name": "flag: Kenya",
"keywords": "flag"
},
{
"code": "🇰🇬",
"name": "flag: Kyrgyzstan",
"keywords": "flag"
},
{
"code": "🇰🇭",
"name": "flag: Cambodia",
"keywords": "flag"
},
{
"code": "🇰🇮",
"name": "flag: Kiribati",
"keywords": "flag"
},
{
"code": "🇰🇲",
"name": "flag: Comoros",
"keywords": "flag"
},
{
"code": "🇰🇳",
"name": "flag: St. Kitts & Nevis",
"keywords": "flag"
},
{
"code": "🇰🇵",
"name": "flag: North Korea",
"keywords": "flag"
},
{
"code": "🇰🇷",
"name": "flag: South Korea",
"keywords": "flag"
},
{
"code": "🇰🇼",
"name": "flag: Kuwait",
"keywords": "flag"
},
{
"code": "🇰🇾",
"name": "flag: Cayman Islands",
"keywords": "flag"
},
{
"code": "🇰🇿",
"name": "flag: Kazakhstan",
"keywords": "flag"
},
{
"code": "🇱🇦",
"name": "flag: Laos",
"keywords": "flag"
},
{
"code": "🇱🇧",
"name": "flag: Lebanon",
"keywords": "flag"
},
{
"code": "🇱🇨",
"name": "flag: St. Lucia",
"keywords": "flag"
},
{
"code": "🇱🇮",
"name": "flag: Liechtenstein",
"keywords": "flag"
},
{
"code": "🇱🇰",
"name": "flag: Sri Lanka",
"keywords": "flag"
},
{
"code": "🇱🇷",
"name": "flag: Liberia",
"keywords": "flag"
},
{
"code": "🇱🇸",
"name": "flag: Lesotho",
"keywords": "flag"
},
{
"code": "🇱🇹",
"name": "flag: Lithuania",
"keywords": "flag"
},
{
"code": "🇱🇺",
"name": "flag: Luxembourg",
"keywords": "flag"
},
{
"code": "🇱🇻",
"name": "flag: Latvia",
"keywords": "flag"
},
{
"code": "🇱🇾",
"name": "flag: Libya",
"keywords": "flag"
},
{
"code": "🇲🇦",
"name": "flag: Morocco",
"keywords": "flag"
},
{
"code": "🇲🇨",
"name": "flag: Monaco",
"keywords": "flag"
},
{
"code": "🇲🇩",
"name": "flag: Moldova",
"keywords": "flag"
},
{
"code": "🇲🇪",
"name": "flag: Montenegro",
"keywords": "flag"
},
{
"code": "🇲🇫",
"name": "flag: St. Martin",
"keywords": "flag"
},
{
"code": "🇲🇬",
"name": "flag: Madagascar",
"keywords": "flag"
},
{
"code": "🇲🇭",
"name": "flag: Marshall Islands",
"keywords": "flag"
},
{
"code": "🇲🇰",
"name": "flag: North Macedonia",
"keywords": "flag"
},
{
"code": "🇲🇱",
"name": "flag: Mali",
"keywords": "flag"
},
{
"code": "🇲🇲",
"name": "flag: Myanmar (Burma)",
"keywords": "flag"
},
{
"code": "🇲🇳",
"name": "flag: Mongolia",
"keywords": "flag"
},
{
"code": "🇲🇴",
"name": "flag: Macao SAR China",
"keywords": "flag"
},
{
"code": "🇲🇵",
"name": "flag: Northern Mariana Islands",
"keywords": "flag"
},
{
"code": "🇲🇶",
"name": "flag: Martinique",
"keywords": "flag"
},
{
"code": "🇲🇷",
"name": "flag: Mauritania",
"keywords": "flag"
},
{
"code": "🇲🇸",
"name": "flag: Montserrat",
"keywords": "flag"
},
{
"code": "🇲🇹",
"name": "flag: Malta",
"keywords": "flag"
},
{
"code": "🇲🇺",
"name": "flag: Mauritius",
"keywords": "flag"
},
{
"code": "🇲🇻",
"name": "flag: Maldives",
"keywords": "flag"
},
{
"code": "🇲🇼",
"name": "flag: Malawi",
"keywords": "flag"
},
{
"code": "🇲🇽",
"name": "flag: Mexico",
"keywords": "flag"
},
{
"code": "🇲🇾",
"name": "flag: Malaysia",
"keywords": "flag"
},
{
"code": "🇲🇿",
"name": "flag: Mozambique",
"keywords": "flag"
},
{
"code": "🇳🇦",
"name": "flag: Namibia",
"keywords": "flag"
},
{
"code": "🇳🇨",
"name": "flag: New Caledonia",
"keywords": "flag"
},
{
"code": "🇳🇪",
"name": "flag: Niger",
"keywords": "flag"
},
{
"code": "🇳🇫",
"name": "flag: Norfolk Island",
"keywords": "flag"
},
{
"code": "🇳🇬",
"name": "flag: Nigeria",
"keywords": "flag"
},
{
"code": "🇳🇮",
"name": "flag: Nicaragua",
"keywords": "flag"
},
{
"code": "🇳🇱",
"name": "flag: Netherlands",
"keywords": "flag"
},
{
"code": "🇳🇴",
"name": "flag: Norway",
"keywords": "flag"
},
{
"code": "🇳🇵",
"name": "flag: Nepal",
"keywords": "flag"
},
{
"code": "🇳🇷",
"name": "flag: Nauru",
"keywords": "flag"
},
{
"code": "🇳🇺",
"name": "flag: Niue",
"keywords": "flag"
},
{
"code": "🇳🇿",
"name": "flag: New Zealand",
"keywords": "flag"
},
{
"code": "🇴🇲",
"name": "flag: Oman",
"keywords": "flag"
},
{
"code": "🇵🇦",
"name": "flag: Panama",
"keywords": "flag"
},
{
"code": "🇵🇪",
"name": "flag: Peru",
"keywords": "flag"
},
{
"code": "🇵🇫",
"name": "flag: French Polynesia",
"keywords": "flag"
},
{
"code": "🇵🇬",
"name": "flag: Papua New Guinea",
"keywords": "flag"
},
{
"code": "🇵🇭",
"name": "flag: Philippines",
"keywords": "flag"
},
{
"code": "🇵🇰",
"name": "flag: Pakistan",
"keywords": "flag"
},
{
"code": "🇵🇱",
"name": "flag: Poland",
"keywords": "flag"
},
{
"code": "🇵🇲",
"name": "flag: St. Pierre & Miquelon",
"keywords": "flag"
},
{
"code": "🇵🇳",
"name": "flag: Pitcairn Islands",
"keywords": "flag"
},
{
"code": "🇵🇷",
"name": "flag: Puerto Rico",
"keywords": "flag"
},
{
"code": "🇵🇸",
"name": "flag: Palestinian Territories",
"keywords": "flag"
},
{
"code": "🇵🇹",
"name": "flag: Portugal",
"keywords": "flag"
},
{
"code": "🇵🇼",
"name": "flag: Palau",
"keywords": "flag"
},
{
"code": "🇵🇾",
"name": "flag: Paraguay",
"keywords": "flag"
},
{
"code": "🇶🇦",
"name": "flag: Qatar",
"keywords": "flag"
},
{
"code": "🇷🇪",
"name": "flag: Réunion",
"keywords": "flag"
},
{
"code": "🇷🇴",
"name": "flag: Romania",
"keywords": "flag"
},
{
"code": "🇷🇸",
"name": "flag: Serbia",
"keywords": "flag"
},
{
"code": "🇷🇺",
"name": "flag: Russia",
"keywords": "flag"
},
{
"code": "🇷🇼",
"name": "flag: Rwanda",
"keywords": "flag"
},
{
"code": "🇸🇦",
"name": "flag: Saudi Arabia",
"keywords": "flag"
},
{
"code": "🇸🇧",
"name": "flag: Solomon Islands",
"keywords": "flag"
},
{
"code": "🇸🇨",
"name": "flag: Seychelles",
"keywords": "flag"
},
{
"code": "🇸🇩",
"name": "flag: Sudan",
"keywords": "flag"
},
{
"code": "🇸🇪",
"name": "flag: Sweden",
"keywords": "flag"
},
{
"code": "🇸🇬",
"name": "flag: Singapore",
"keywords": "flag"
},
{
"code": "🇸🇭",
"name": "flag: St. Helena",
"keywords": "flag"
},
{
"code": "🇸🇮",
"name": "flag: Slovenia",
"keywords": "flag"
},
{
"code": "🇸🇯",
"name": "flag: Svalbard & Jan Mayen",
"keywords": "flag"
},
{
"code": "🇸🇰",
"name": "flag: Slovakia",
"keywords": "flag"
},
{
"code": "🇸🇱",
"name": "flag: Sierra Leone",
"keywords": "flag"
},
{
"code": "🇸🇲",
"name": "flag: San Marino",
"keywords": "flag"
},
{
"code": "🇸🇳",
"name": "flag: Senegal",
"keywords": "flag"
},
{
"code": "🇸🇴",
"name": "flag: Somalia",
"keywords": "flag"
},
{
"code": "🇸🇷",
"name": "flag: Suriname",
"keywords": "flag"
},
{
"code": "🇸🇸",
"name": "flag: South Sudan",
"keywords": "flag"
},
{
"code": "🇸🇹",
"name": "flag: São Tomé & Príncipe",
"keywords": "flag"
},
{
"code": "🇸🇻",
"name": "flag: El Salvador",
"keywords": "flag"
},
{
"code": "🇸🇽",
"name": "flag: Sint Maarten",
"keywords": "flag"
},
{
"code": "🇸🇾",
"name": "flag: Syria",
"keywords": "flag"
},
{
"code": "🇸🇿",
"name": "flag: Eswatini",
"keywords": "flag"
},
{
"code": "🇹🇦",
"name": "flag: Tristan da Cunha",
"keywords": "flag"
},
{
"code": "🇹🇨",
"name": "flag: Turks & Caicos Islands",
"keywords": "flag"
},
{
"code": "🇹🇩",
"name": "flag: Chad",
"keywords": "flag"
},
{
"code": "🇹🇫",
"name": "flag: French Southern Territories",
"keywords": "flag"
},
{
"code": "🇹🇬",
"name": "flag: Togo",
"keywords": "flag"
},
{
"code": "🇹🇭",
"name": "flag: Thailand",
"keywords": "flag"
},
{
"code": "🇹🇯",
"name": "flag: Tajikistan",
"keywords": "flag"
},
{
"code": "🇹🇰",
"name": "flag: Tokelau",
"keywords": "flag"
},
{
"code": "🇹🇱",
"name": "flag: Timor-Leste",
"keywords": "flag"
},
{
"code": "🇹🇲",
"name": "flag: Turkmenistan",
"keywords": "flag"
},
{
"code": "🇹🇳",
"name": "flag: Tunisia",
"keywords": "flag"
},
{
"code": "🇹🇴",
"name": "flag: Tonga",
"keywords": "flag"
},
{
"code": "🇹🇷",
"name": "flag: Turkey",
"keywords": "flag"
},
{
"code": "🇹🇹",
"name": "flag: Trinidad & Tobago",
"keywords": "flag"
},
{
"code": "🇹🇻",
"name": "flag: Tuvalu",
"keywords": "flag"
},
{
"code": "🇹🇼",
"name": "flag: Taiwan",
"keywords": "flag"
},
{
"code": "🇹🇿",
"name": "flag: Tanzania",
"keywords": "flag"
},
{
"code": "🇺🇦",
"name": "flag: Ukraine",
"keywords": "flag"
},
{
"code": "🇺🇬",
"name": "flag: Uganda",
"keywords": "flag"
},
{
"code": "🇺🇲",
"name": "flag: U.S. Outlying Islands",
"keywords": "flag"
},
{
"code": "🇺🇳",
"name": "flag: United Nations",
"keywords": "flag"
},
{
"code": "🇺🇸",
"name": "flag: United States",
"keywords": "flag"
},
{
"code": "🇺🇾",
"name": "flag: Uruguay",
"keywords": "flag"
},
{
"code": "🇺🇿",
"name": "flag: Uzbekistan",
"keywords": "flag"
},
{
"code": "🇻🇦",
"name": "flag: Vatican City",
"keywords": "flag"
},
{
"code": "🇻🇨",
"name": "flag: St. Vincent & Grenadines",
"keywords": "flag"
},
{
"code": "🇻🇪",
"name": "flag: Venezuela",
"keywords": "flag"
},
{
"code": "🇻🇬",
"name": "flag: British Virgin Islands",
"keywords": "flag"
},
{
"code": "🇻🇮",
"name": "flag: U.S. Virgin Islands",
"keywords": "flag"
},
{
"code": "🇻🇳",
"name": "flag: Vietnam",
"keywords": "flag"
},
{
"code": "🇻🇺",
"name": "flag: Vanuatu",
"keywords": "flag"
},
{
"code": "🇼🇫",
"name": "flag: Wallis & Futuna",
"keywords": "flag"
},
{
"code": "🇼🇸",
"name": "flag: Samoa",
"keywords": "flag"
},
{
"code": "🇽🇰",
"name": "flag: Kosovo",
"keywords": "flag"
},
{
"code": "🇾🇪",
"name": "flag: Yemen",
"keywords": "flag"
},
{
"code": "🇾🇹",
"name": "flag: Mayotte",
"keywords": "flag"
},
{
"code": "🇿🇦",
"name": "flag: South Africa",
"keywords": "flag"
},
{
"code": "🇿🇲",
"name": "flag: Zambia",
"keywords": "flag"
},
{
"code": "🇿🇼",
"name": "flag: Zimbabwe",
"keywords": "flag"
},
{
"code": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
"name": "flag: England",
"keywords": "flag"
},
{
"code": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
"name": "flag: Scotland",
"keywords": "flag"
},
{
"code": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
"name": "flag: Wales",
"keywords": "flag"
}
    ];

//this list is taken from https://unicode.org/emoji/charts/full-emoji-modifiers.html
const MODED = [
'👋🏻',
'🤚🏻',
'🖐🏻',
'✋🏻',
'🖖🏻',
'👌🏻',
'🤌🏻',
'🤏🏻',
'✌🏻',
'🤞🏻',
'🤟🏻',
'🤘🏻',
'🤙🏻',
'👈🏻',
'👉🏻',
'👆🏻',
'🖕🏻',
'👇🏻',
'☝🏻',
'👍🏻',
'👎🏻',
'✊🏻',
'👊🏻',
'🤛🏻',
'🤜🏻',
'👏🏻',
'🙌🏻',
'👐🏻',
'🤲🏻',
'🙏🏻',
'✍🏻',
'💅🏻',
'🤳🏻',
'💪🏻',
'🦵🏻',
'🦶🏻',
'👂🏻',
'🦻🏻',
'👃🏻',
'👶🏻',
'🧒🏻',
'👦🏻',
'👧🏻',
'🧑🏻',
'👱🏻',
'👨🏻',
'🧔🏻',
'🧔🏻‍♂️',
'🧔🏻‍♀️',
'👨🏻‍🦰',
'👨🏻‍🦱',
'👨🏻‍🦳',
'👨🏻‍🦲',
'👩🏻',
'👩🏻‍🦰',
'🧑🏻‍🦰',
'👩🏻‍🦱',
'🧑🏻‍🦱',
'👩🏻‍🦳',
'🧑🏻‍🦳',
'👩🏻‍🦲',
'🧑🏻‍🦲',
'👱🏻‍♀️',
'👱🏻‍♂️',
'🧓🏻',
'👴🏻',
'👵🏻',
'🙍🏻',
'🙍🏻‍♂️',
'🙍🏻‍♀️',
'🙎🏻',
'🙎🏻‍♂️',
'🙎🏻‍♀️',
'🙅🏻',
'🙅🏻‍♂️',
'🙅🏻‍♀️',
'🙆🏻',
'🙆🏻‍♂️',
'🙆🏻‍♀️',
'💁🏻',
'💁🏻‍♂️',
'💁🏻‍♀️',
'🙋🏻',
'🙋🏻‍♂️',
'🙋🏻‍♀️',
'🧏🏻',
'🧏🏻‍♂️',
'🧏🏻‍♀️',
'🙇🏻',
'🙇🏻‍♂️',
'🙇🏻‍♀️',
'🤦🏻',
'🤦🏻‍♂️',
'🤦🏻‍♀️',
'🤷🏻',
'🤷🏻‍♂️',
'🤷🏻‍♀️',
'🧑🏻‍⚕️',
'👨🏻‍⚕️',
'👩🏻‍⚕️',
'🧑🏻‍🎓',
'👨🏻‍🎓',
'👩🏻‍🎓',
'🧑🏻‍🏫',
'👨🏻‍🏫',
'👩🏻‍🏫',
'🧑🏻‍⚖️',
'👨🏻‍⚖️',
'👩🏻‍⚖️',
'🧑🏻‍🌾',
'👨🏻‍🌾',
'👩🏻‍🌾',
'🧑🏻‍🍳',
'👨🏻‍🍳',
'👩🏻‍🍳',
'🧑🏻‍🔧',
'👨🏻‍🔧',
'👩🏻‍🔧',
'🧑🏻‍🏭',
'👨🏻‍🏭',
'👩🏻‍🏭',
'🧑🏻‍💼',
'👨🏻‍💼',
'👩🏻‍💼',
'🧑🏻‍🔬',
'👨🏻‍🔬',
'👩🏻‍🔬',
'🧑🏻‍💻',
'👨🏻‍💻',
'👩🏻‍💻',
'🧑🏻‍🎤',
'👨🏻‍🎤',
'👩🏻‍🎤',
'🧑🏻‍🎨',
'👨🏻‍🎨',
'👩🏻‍🎨',
'🧑🏻‍✈️',
'👨🏻‍✈️',
'👩🏻‍✈️',
'🧑🏻‍🚀',
'👨🏻‍🚀',
'👩🏻‍🚀',
'🧑🏻‍🚒',
'👨🏻‍🚒',
'👩🏻‍🚒',
'👮🏻',
'👮🏻‍♂️',
'👮🏻‍♀️',
'🕵🏻',
'🕵🏻‍♂️',
'🕵🏻‍♀️',
'💂🏻',
'💂🏻‍♂️',
'💂🏻‍♀️',
'🥷🏻',
'👷🏻',
'👷🏻‍♂️',
'👷🏻‍♀️',
'🤴🏻',
'👸🏻',
'👳🏻',
'👳🏻‍♂️',
'👳🏻‍♀️',
'👲🏻',
'🧕🏻',
'🤵🏻',
'🤵🏻‍♂️',
'🤵🏻‍♀️',
'👰🏻',
'👰🏻‍♂️',
'👰🏻‍♀️',
'🤰🏻',
'🤱🏻',
'👩🏻‍🍼',
'👨🏻‍🍼',
'🧑🏻‍🍼',
'👼🏻',
'🎅🏻',
'🤶🏻',
'🧑🏻‍🎄',
'🦸🏻',
'🦸🏻‍♂️',
'🦸🏻‍♀️',
'🦹🏻',
'🦹🏻‍♂️',
'🦹🏻‍♀️',
'🧙🏻',
'🧙🏻‍♂️',
'🧙🏻‍♀️',
'🧚🏻',
'🧚🏻‍♂️',
'🧚🏻‍♀️',
'🧛🏻',
'🧛🏻‍♂️',
'🧛🏻‍♀️',
'🧜🏻',
'🧜🏻‍♂️',
'🧜🏻‍♀️',
'🧝🏻',
'🧝🏻‍♂️',
'🧝🏻‍♀️',
'💆🏻',
'💆🏻‍♂️',
'💆🏻‍♀️',
'💇🏻',
'💇🏻‍♂️',
'💇🏻‍♀️',
'🚶🏻',
'🚶🏻‍♂️',
'🚶🏻‍♀️',
'🧍🏻',
'🧍🏻‍♂️',
'🧍🏻‍♀️',
'🧎🏻',
'🧎🏻‍♂️',
'🧎🏻‍♀️',
'🧑🏻‍🦯',
'👨🏻‍🦯',
'👩🏻‍🦯',
'🧑🏻‍🦼',
'👨🏻‍🦼',
'👩🏻‍🦼',
'🧑🏻‍🦽',
'👨🏻‍🦽',
'👩🏻‍🦽',
'🏃🏻',
'🏃🏻‍♂️',
'🏃🏻‍♀️',
'💃🏻',
'🕺🏻',
'🕴🏻',
'🧖🏻',
'🧖🏻‍♂️',
'🧖🏻‍♀️',
'🧗🏻',
'🧗🏻‍♂️',
'🧗🏻‍♀️',
'🏇🏻',
'🏂🏻',
'🏌🏻',
'🏌🏻‍♂️',
'🏌🏻‍♀️',
'🏄🏻',
'🏄🏻‍♂️',
'🏄🏻‍♀️',
'🚣🏻',
'🚣🏻‍♂️',
'🚣🏻‍♀️',
'🏊🏻',
'🏊🏻‍♂️',
'🏊🏻‍♀️',
'⛹🏻',
'⛹🏻‍♂️',
'⛹🏻‍♀️',
'🏋🏻',
'🏋🏻‍♂️',
'🏋🏻‍♀️',
'🚴🏻',
'🚴🏻‍♂️',
'🚴🏻‍♀️',
'🚵🏻',
'🚵🏻‍♂️',
'🚵🏻‍♀️',
'🤸🏻',
'🤸🏻‍♂️',
'🤸🏻‍♀️',
'🤽🏻',
'🤽🏻‍♂️',
'🤽🏻‍♀️',
'🤾🏻',
'🤾🏻‍♂️',
'🤾🏻‍♀️',
'🤹🏻',
'🤹🏻‍♂️',
'🤹🏻‍♀️',
'🧘🏻',
'🧘🏻‍♂️',
'🧘🏻‍♀️',
'🛀🏻',
'🛌🏻',
'🧑🏻‍🤝‍🧑🏻',
'👭🏻',
'👫🏻',
'👬🏻',
'💏🏻',
'👩🏻‍❤️‍💋‍👨🏻',
'👨🏻‍❤️‍💋‍👨🏻',
'👩🏻‍❤️‍💋‍👩🏻',
'💑🏻',
'👩🏻‍❤️‍👨🏻',
'👨🏻‍❤️‍👨🏻',
'👩🏻‍❤️‍👩🏻'

];

const MODABLE = []; //MODABLE is the same as MODED but with skin tone modifiers removed.
for (let i = 0; i < MODED.length; i++) {
    MODABLE[i] = MODED[i].replace('\u{1F3FB}', '');
    MODABLE[i] = MODABLE[i].replace('\u{1F3FB}', '');
}

module.exports = {EMOJI, MODED, MODABLE};
