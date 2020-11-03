
//
const EMOJI = [
{
code: '\u{1F600}',
name: 'grinning face',
keywords: 'face | grin | grinning face'
}, {
code: '\u{1F603}',
name: 'grinning face with big eyes',
keywords: 'face | grinning face with big eyes | mouth | open | smile'
}, {
code: '\u{1F604}',
name: 'grinning face with smiling eyes',
keywords: 'eye | face | grinning face with smiling eyes | mouth | open | smile'
}, {
code: '\u{1F601}',
name: 'beaming face with smiling eyes',
keywords: 'beaming face with smiling eyes | eye | face | grin | smile'
}, {
code: '\u{1F606}',
name: 'grinning squinting face',
keywords: 'face | grinning squinting face | laugh | mouth | satisfied | smile'
}, {
code: '\u{1F605}',
name: 'grinning face with sweat',
keywords: 'cold | face | grinning face with sweat | open | smile | sweat'
}, {
code: '\u{1F923}',
name: 'rolling on the floor laughing',
keywords: 'face | floor | laugh | rofl | rolling | rolling on the floor laughing | rotfl'
}, {
code: '\u{1F602}',
name: 'face with tears of joy',
keywords: 'face | face with tears of joy | joy | laugh | tear'
}, {
code: '\u{1F642}',
name: 'slightly smiling face',
keywords: 'face | slightly smiling face | smile'
}, {
code: '\u{1F643}',
name: 'upside-down face',
keywords: 'face | upside-down'
}, {
code: '\u{1F609}',
name: 'winking face',
keywords: 'face | wink | winking face'
}, {
code: '\u{1F60A}',
name: 'smiling face with smiling eyes',
keywords: 'blush | eye | face | smile | smiling face with smiling eyes'
}, {
code: '\u{1F607}',
name: 'smiling face with halo',
keywords: 'angel | face | fantasy | halo | innocent | smiling face with halo'
}, {
code: '\u{1F970}',
name: 'smiling face with hearts',
keywords: 'adore | crush | hearts | in love | smiling face with hearts'
}, {
code: '\u{1F60D}',
name: 'smiling face with heart-eyes',
keywords: 'eye | face | love | smile | smiling face with heart-eyes'
}, {
code: '\u{1F929}',
name: 'star-struck',
keywords: 'eyes | face | grinning | star | star-struck | starry-eyed'
}, {
code: '\u{1F618}',
name: 'face blowing a kiss',
keywords: 'face | face blowing a kiss | kiss'
}, {
code: '\u{1F617}',
name: 'kissing face',
keywords: 'face | kiss | kissing face'
}, {
code: '\u{263A}',
name: 'smiling face',
keywords: 'face | outlined | relaxed | smile | smiling face'
}, {
code: '\u{1F61A}',
name: 'kissing face with closed eyes',
keywords: 'closed | eye | face | kiss | kissing face with closed eyes'
}, {
code: '\u{1F619}',
name: 'kissing face with smiling eyes',
keywords: 'eye | face | kiss | kissing face with smiling eyes | smile'
}, {
code: '\u{1F972}',
name: 'smiling face with tear',
keywords: 'grateful | proud | relieved | smiling | smiling face with tear | tear | touched'
}, {
code: '\u{1F60B}',
name: 'face savoring food',
keywords: 'delicious | face | face savoring food | savouring | smile | yum'
}, {
code: '\u{1F61B}',
name: 'face with tongue',
keywords: 'face | face with tongue | tongue'
}, {
code: '\u{1F61C}',
name: 'winking face with tongue',
keywords: 'eye | face | joke | tongue | wink | winking face with tongue'
}, {
code: '\u{1F92A}',
name: 'zany face',
keywords: 'eye | goofy | large | small | zany face'
}, {
code: '\u{1F61D}',
name: 'squinting face with tongue',
keywords: 'eye | face | horrible | squinting face with tongue | taste | tongue'
}, {
code: '\u{1F911}',
name: 'money-mouth face',
keywords: 'face | money | money-mouth face | mouth'
}, {
code: '\u{1F917}',
name: 'hugging face',
keywords: 'face | hug | hugging'
}, {
code: '\u{1F92D}',
name: 'face with hand over mouth',
keywords: 'face with hand over mouth | whoops | shock | sudden realization | surprise'
}, {
code: '\u{1F92B}',
name: 'shushing face',
keywords: 'quiet | shush | shushing face'
}, {
code: '\u{1F914}',
name: 'thinking face',
keywords: 'face | thinking'
}, {
code: '\u{1F910}',
name: 'zipper-mouth face',
keywords: 'face | mouth | zipper | zipper-mouth face'
}, {
code: '\u{1F928}',
name: 'face with raised eyebrow',
keywords: 'distrust | face with raised eyebrow | skeptic | disapproval | disbelief | mild surprise | scepticism'
}, {
code: '\u{1F610}',
name: 'neutral face',
keywords: 'deadpan | face | meh | neutral'
}, {
code: '\u{1F611}',
name: 'expressionless face',
keywords: 'expressionless | face | inexpressive | meh | unexpressive'
}, {
code: '\u{1F636}',
name: 'face without mouth',
keywords: 'face | face without mouth | mouth | quiet | silent'
}, {
code: '\u{1F636}\u{200D}\u{1F32B}\u{FE0F}',
name: 'face in clouds',
keywords: 'absentminded | face in clouds | face in the fog | head in clouds'
}, {
code: '\u{1F60F}',
name: 'smirking face',
keywords: 'face | smirk | smirking face'
}, {
code: '\u{1F612}',
name: 'unamused face',
keywords: 'face | unamused | unhappy'
}, {
code: '\u{1F644}',
name: 'face with rolling eyes',
keywords: 'eyeroll | eyes | face | face with rolling eyes | rolling'
}, {
code: '\u{1F62C}',
name: 'grimacing face',
keywords: 'face | grimace | grimacing face'
}, {
code: '\u{1F62E}\u{200D}\u{1F4A8}',
name: 'face exhaling',
keywords: 'exhale | face exhaling | gasp | groan | relief | whisper | whistle'
}, {
code: '\u{1F925}',
name: 'lying face',
keywords: 'face | lie | lying face | pinocchio'
}, {
code: '\u{1F60C}',
name: 'relieved face',
keywords: 'face | relieved'
}, {
code: '\u{1F614}',
name: 'pensive face',
keywords: 'dejected | face | pensive'
}, {
code: '\u{1F62A}',
name: 'sleepy face',
keywords: 'face | sleep | sleepy face'
}, {
code: '\u{1F924}',
name: 'drooling face',
keywords: 'drooling | face'
}, {
code: '\u{1F634}',
name: 'sleeping face',
keywords: 'face | sleep | sleeping face | zzz'
}, {
code: '\u{1F637}',
name: 'face with medical mask',
keywords: 'cold | doctor | face | face with medical mask | mask | sick'
}, {
code: '\u{1F912}',
name: 'face with thermometer',
keywords: 'face | face with thermometer | ill | sick | thermometer'
}, {
code: '\u{1F915}',
name: 'face with head-bandage',
keywords: 'bandage | face | face with head-bandage | hurt | injury'
}, {
code: '\u{1F922}',
name: 'nauseated face',
keywords: 'face | nauseated | vomit'
}, {
code: '\u{1F92E}',
name: 'face vomiting',
keywords: 'face vomiting | sick | vomit'
}, {
code: '\u{1F927}',
name: 'sneezing face',
keywords: 'face | gesundheit | sneeze | sneezing face'
}, {
code: '\u{1F975}',
name: 'hot face',
keywords: 'feverish | heat stroke | hot | hot face | red-faced | sweating'
}, {
code: '\u{1F976}',
name: 'cold face',
keywords: 'blue-faced | cold | cold face | freezing | frostbite | icicles'
}, {
code: '\u{1F974}',
name: 'woozy face',
keywords: 'dizzy | intoxicated | tipsy | uneven eyes | wavy mouth | woozy face'
}, {
code: '\u{1F635}',
name: 'knocked-out face',
keywords: 'dead | face | knocked out | knocked-out face'
}, {
code: '\u{1F635}\u{200D}\u{1F4AB}',
name: 'face with spiral eyes',
keywords: 'dizzy | face with spiral eyes | hypnotized | spiral | trouble | whoa'
}, {
code: '\u{1F92F}',
name: 'exploding head',
keywords: 'exploding head | mind blown | shocked'
}, {
code: '\u{1F920}',
name: 'cowboy hat face',
keywords: 'cowboy | cowgirl | face | hat'
}, {
code: '\u{1F973}',
name: 'partying face',
keywords: 'celebration | hat | horn | party | partying face'
}, {
code: '\u{1F978}',
name: 'disguised face',
keywords: 'disguise | disguised face | face | glasses | incognito | nose'
}, {
code: '\u{1F60E}',
name: 'smiling face with sunglasses',
keywords: 'bright | cool | face | smiling face with sunglasses | sun | sunglasses'
}, {
code: '\u{1F913}',
name: 'nerd face',
keywords: 'face | geek | nerd'
}, {
code: '\u{1F9D0}',
name: 'face with monocle',
keywords: 'face with monocle | stuffy | wealthy'
}, {
code: '\u{1F615}',
name: 'confused face',
keywords: 'confused | face | meh'
}, {
code: '\u{1F61F}',
name: 'worried face',
keywords: 'face | worried'
}, {
code: '\u{1F641}',
name: 'slightly frowning face',
keywords: 'face | frown | slightly frowning face'
}, {
code: '\u{2639}',
name: 'frowning face',
keywords: 'face | frown | frowning face'
}, {
code: '\u{1F62E}',
name: 'face with open mouth',
keywords: 'face | face with open mouth | mouth | open | sympathy'
}, {
code: '\u{1F62F}',
name: 'hushed face',
keywords: 'face | hushed | stunned | surprised'
}, {
code: '\u{1F632}',
name: 'astonished face',
keywords: 'astonished | face | shocked | totally'
}, {
code: '\u{1F633}',
name: 'flushed face',
keywords: 'dazed | face | flushed'
}, {
code: '\u{1F97A}',
name: 'pleading face',
keywords: 'begging | mercy | pleading face | puppy eyes'
}, {
code: '\u{1F626}',
name: 'frowning face with open mouth',
keywords: 'face | frown | frowning face with open mouth | mouth | open'
}, {
code: '\u{1F627}',
name: 'anguished face',
keywords: 'anguished | face'
}, {
code: '\u{1F628}',
name: 'fearful face',
keywords: 'face | fear | fearful | scared'
}, {
code: '\u{1F630}',
name: 'anxious face with sweat',
keywords: 'anxious face with sweat | blue | cold | face | rushed | sweat'
}, {
code: '\u{1F625}',
name: 'sad but relieved face',
keywords: 'disappointed | face | relieved | sad but relieved face | whew'
}, {
code: '\u{1F622}',
name: 'crying face',
keywords: 'cry | crying face | face | sad | tear'
}, {
code: '\u{1F62D}',
name: 'loudly crying face',
keywords: 'cry | face | loudly crying face | sad | sob | tear'
}, {
code: '\u{1F631}',
name: 'face screaming in fear',
keywords: 'face | face screaming in fear | fear | munch | scared | scream'
}, {
code: '\u{1F616}',
name: 'confounded face',
keywords: 'confounded | face'
}, {
code: '\u{1F623}',
name: 'persevering face',
keywords: 'face | persevere | persevering face'
}, {
code: '\u{1F61E}',
name: 'disappointed face',
keywords: 'disappointed | face'
}, {
code: '\u{1F613}',
name: 'downcast face with sweat',
keywords: 'cold | downcast face with sweat | face | sweat'
}, {
code: '\u{1F629}',
name: 'weary face',
keywords: 'face | tired | weary'
}, {
code: '\u{1F62B}',
name: 'tired face',
keywords: 'face | tired'
}, {
code: '\u{1F971}',
name: 'yawning face',
keywords: 'bored | tired | yawn | yawning face'
}, {
code: '\u{1F624}',
name: 'face with steam from nose',
keywords: 'face | face with steam from nose | triumph | won'
}, {
code: '\u{1F621}',
name: 'pouting face',
keywords: 'angry | face | mad | pouting | rage | red'
}, {
code: '\u{1F620}',
name: 'angry face',
keywords: 'angry | face | mad'
}, {
code: '\u{1F92C}',
name: 'face with symbols on mouth',
keywords: 'face with symbols on mouth | swearing | cursing'
}, {
code: '\u{1F608}',
name: 'smiling face with horns',
keywords: 'face | fairy tale | fantasy | horns | smile | smiling face with horns'
}, {
code: '\u{1F47F}',
name: 'angry face with horns',
keywords: 'angry face with horns | demon | devil | face | fantasy | imp'
}, {
code: '\u{1F480}',
name: 'skull',
keywords: 'death | face | fairy tale | monster | skull'
}, {
code: '\u{2620}',
name: 'skull and crossbones',
keywords: 'crossbones | death | face | monster | skull | skull and crossbones'
}, {
code: '\u{1F4A9}',
name: 'pile of poo',
keywords: 'dung | face | monster | pile of poo | poo | poop'
}, {
code: '\u{1F921}',
name: 'clown face',
keywords: 'clown | face'
}, {
code: '\u{1F479}',
name: 'ogre',
keywords: 'creature | face | fairy tale | fantasy | monster | ogre | troll'
}, {
code: '\u{1F47A}',
name: 'goblin',
keywords: 'creature | face | fairy tale | fantasy | goblin | monster'
}, {
code: '\u{1F47B}',
name: 'ghost',
keywords: 'creature | face | fairy tale | fantasy | ghost | monster'
}, {
code: '\u{1F47D}',
name: 'alien',
keywords: 'alien | creature | extraterrestrial | face | fantasy | ufo'
}, {
code: '\u{1F47E}',
name: 'alien monster',
keywords: 'alien | creature | extraterrestrial | face | monster | ufo'
}, {
code: '\u{1F916}',
name: 'robot',
keywords: 'face | monster | robot'
}, {
code: '\u{1F63A}',
name: 'grinning cat',
keywords: 'cat | face | grinning | mouth | open | smile'
}, {
code: '\u{1F638}',
name: 'grinning cat with smiling eyes',
keywords: 'cat | eye | face | grin | grinning cat with smiling eyes | smile'
}, {
code: '\u{1F639}',
name: 'cat with tears of joy',
keywords: 'cat | cat with tears of joy | face | joy | tear'
}, {
code: '\u{1F63B}',
name: 'smiling cat with heart-eyes',
keywords: 'cat | eye | face | heart | love | smile | smiling cat with heart-eyes'
}, {
code: '\u{1F63C}',
name: 'cat with wry smile',
keywords: 'cat | cat with wry smile | face | ironic | smile | wry'
}, {
code: '\u{1F63D}',
name: 'kissing cat',
keywords: 'cat | eye | face | kiss | kissing cat'
}, {
code: '\u{1F640}',
name: 'weary cat',
keywords: 'cat | face | oh | surprised | weary'
}, {
code: '\u{1F63F}',
name: 'crying cat',
keywords: 'cat | cry | crying cat | face | sad | tear'
}, {
code: '\u{1F63E}',
name: 'pouting cat',
keywords: 'cat | face | pouting'
}, {
code: '\u{1F648}',
name: 'see-no-evil monkey',
keywords: 'evil | face | forbidden | monkey | see | see-no-evil monkey'
}, {
code: '\u{1F649}',
name: 'hear-no-evil monkey',
keywords: 'evil | face | forbidden | hear | hear-no-evil monkey | monkey'
}, {
code: '\u{1F64A}',
name: 'speak-no-evil monkey',
keywords: 'evil | face | forbidden | monkey | speak | speak-no-evil monkey'
}, {
code: '\u{1F48B}',
name: 'kiss mark',
keywords: 'kiss | kiss mark | lips'
}, {
code: '\u{1F48C}',
name: 'love letter',
keywords: 'heart | letter | love | mail'
}, {
code: '\u{1F498}',
name: 'heart with arrow',
keywords: 'arrow | cupid | heart with arrow'
}, {
code: '\u{1F49D}',
name: 'heart with ribbon',
keywords: 'heart with ribbon | ribbon | valentine'
}, {
code: '\u{1F496}',
name: 'sparkling heart',
keywords: 'excited | sparkle | sparkling heart'
}, {
code: '\u{1F497}',
name: 'growing heart',
keywords: 'excited | growing | growing heart | nervous | pulse'
}, {
code: '\u{1F493}',
name: 'beating heart',
keywords: 'beating | beating heart | heartbeat | pulsating'
}, {
code: '\u{1F49E}',
name: 'revolving hearts',
keywords: 'revolving | revolving hearts'
}, {
code: '\u{1F495}',
name: 'two hearts',
keywords: 'love | two hearts'
}, {
code: '\u{1F49F}',
name: 'heart decoration',
keywords: 'heart | heart decoration'
}, {
code: '\u{2763}',
name: 'heart exclamation',
keywords: 'exclamation | heart exclamation | mark | punctuation'
}, {
code: '\u{1F494}',
name: 'broken heart',
keywords: 'break | broken | broken heart'
}, {
code: '\u{2764}\u{FE0F}\u{200D}\u{1F525}',
name: 'heart on fire',
keywords: 'burn | heart | heart on fire | love | lust | sacred heart'
}, {
code: '\u{2764}\u{FE0F}\u{200D}\u{1FA79}',
name: 'mending heart',
keywords: 'healthier | improving | mending | mending heart | recovering | recuperating | well'
}, {
code: '\u{2764}',
name: 'red heart',
keywords: 'heart | red heart'
}, {
code: '\u{1F9E1}',
name: 'orange heart',
keywords: 'orange | orange heart'
}, {
code: '\u{1F49B}',
name: 'yellow heart',
keywords: 'yellow | yellow heart'
}, {
code: '\u{1F49A}',
name: 'green heart',
keywords: 'green | green heart'
}, {
code: '\u{1F499}',
name: 'blue heart',
keywords: 'blue | blue heart'
}, {
code: '\u{1F49C}',
name: 'purple heart',
keywords: 'purple | purple heart'
}, {
code: '\u{1F90E}',
name: 'brown heart',
keywords: 'brown | heart'
}, {
code: '\u{1F5A4}',
name: 'black heart',
keywords: 'black | black heart | evil | wicked'
}, {
code: '\u{1F90D}',
name: 'white heart',
keywords: 'heart | white'
}, {
code: '\u{1F4AF}',
name: 'hundred points',
keywords: '100 | full | hundred | hundred points | score'
}, {
code: '\u{1F4A2}',
name: 'anger symbol',
keywords: 'anger symbol | angry | comic | mad'
}, {
code: '\u{1F4A5}',
name: 'collision',
keywords: 'boom | collision | comic'
}, {
code: '\u{1F4AB}',
name: 'dizzy',
keywords: 'comic | dizzy | star'
}, {
code: '\u{1F4A6}',
name: 'sweat droplets',
keywords: 'comic | splashing | sweat | sweat droplets'
}, {
code: '\u{1F4A8}',
name: 'dashing away',
keywords: 'comic | dash | dashing away | running'
}, {
code: '\u{1F573}',
name: 'hole',
keywords: 'hole'
}, {
code: '\u{1F4A3}',
name: 'bomb',
keywords: 'bomb | comic'
}, {
code: '\u{1F4AC}',
name: 'speech balloon',
keywords: 'balloon | bubble | comic | dialog | speech'
}, {
code: '\u{1F441}\u{FE0F}\u{200D}\u{1F5E8}\u{FE0F}',
name: 'eye in speech bubble',
keywords: 'eye | eye in speech bubble | speech bubble | witness'
}, {
code: '\u{1F5E8}',
name: 'left speech bubble',
keywords: 'dialog | left speech bubble | speech'
}, {
code: '\u{1F5EF}',
name: 'right anger bubble',
keywords: 'angry | balloon | bubble | mad | right anger bubble'
}, {
code: '\u{1F4AD}',
name: 'thought balloon',
keywords: 'balloon | bubble | comic | thought'
}, {
code: '\u{1F4A4}',
name: 'zzz',
keywords: 'comic | sleep | zzz'
}, {
code: '\u{1F44B}',
name: 'waving hand',
keywords: 'hand | wave | waving'
}, {
code: '\u{1F91A}',
name: 'raised back of hand',
keywords: 'backhand | raised | raised back of hand'
}, {
code: '\u{1F590}',
name: 'hand with fingers splayed',
keywords: 'finger | hand | hand with fingers splayed | splayed'
}, {
code: '\u{270B}',
name: 'raised hand',
keywords: 'hand | high 5 | high five | raised hand'
}, {
code: '\u{1F596}',
name: 'vulcan salute',
keywords: 'finger | hand | spock | vulcan | vulcan salute'
}, {
code: '\u{1F44C}',
name: 'OK hand',
keywords: 'hand | OK'
}, {
code: '\u{1F90C}',
name: 'pinched fingers',
keywords: 'fingers | hand gesture | interrogation | pinched | sarcastic'
}, {
code: '\u{1F90F}',
name: 'pinching hand',
keywords: 'pinching hand | small amount'
}, {
code: '\u{270C}',
name: 'victory hand',
keywords: 'hand | v | victory'
}, {
code: '\u{1F91E}',
name: 'crossed fingers',
keywords: 'cross | crossed fingers | finger | hand | luck'
}, {
code: '\u{1F91F}',
name: 'love-you gesture',
keywords: 'hand | ILY | love-you gesture'
}, {
code: '\u{1F918}',
name: 'sign of the horns',
keywords: 'finger | hand | horns | rock-on | sign of the horns'
}, {
code: '\u{1F919}',
name: 'call me hand',
keywords: 'call | call me hand | hand'
}, {
code: '\u{1F448}',
name: 'backhand index pointing left',
keywords: 'backhand | backhand index pointing left | finger | hand | index | point'
}, {
code: '\u{1F449}',
name: 'backhand index pointing right',
keywords: 'backhand | backhand index pointing right | finger | hand | index | point'
}, {
code: '\u{1F446}',
name: 'backhand index pointing up',
keywords: 'backhand | backhand index pointing up | finger | hand | point | up'
}, {
code: '\u{1F595}',
name: 'middle finger',
keywords: 'finger | hand | middle finger'
}, {
code: '\u{1F447}',
name: 'backhand index pointing down',
keywords: 'backhand | backhand index pointing down | down | finger | hand | point'
}, {
code: '\u{261D}',
name: 'index pointing up',
keywords: 'finger | hand | index | index pointing up | point | up'
}, {
code: '\u{1F44D}',
name: 'thumbs up',
keywords: '+1 | hand | thumb | thumbs up | up'
}, {
code: '\u{1F44E}',
name: 'thumbs down',
keywords: '-1 | down | hand | thumb | thumbs down'
}, {
code: '\u{270A}',
name: 'raised fist',
keywords: 'clenched | fist | hand | punch | raised fist'
}, {
code: '\u{1F44A}',
name: 'oncoming fist',
keywords: 'clenched | fist | hand | oncoming fist | punch'
}, {
code: '\u{1F91B}',
name: 'left-facing fist',
keywords: 'fist | left-facing fist | leftwards'
}, {
code: '\u{1F91C}',
name: 'right-facing fist',
keywords: 'fist | right-facing fist | rightwards'
}, {
code: '\u{1F44F}',
name: 'clapping hands',
keywords: 'clap | clapping hands | hand'
}, {
code: '\u{1F64C}',
name: 'raising hands',
keywords: 'celebration | gesture | hand | hooray | raised | raising hands'
}, {
code: '\u{1F450}',
name: 'open hands',
keywords: 'hand | open | open hands'
}, {
code: '\u{1F932}',
name: 'palms up together',
keywords: 'palms up together | prayer | cupped hands'
}, {
code: '\u{1F91D}',
name: 'handshake',
keywords: 'agreement | hand | handshake | meeting | shake'
}, {
code: '\u{1F64F}',
name: 'folded hands',
keywords: 'ask | folded hands | hand | high 5 | high five | please | pray | thanks'
}, {
code: '\u{270D}',
name: 'writing hand',
keywords: 'hand | write | writing hand'
}, {
code: '\u{1F485}',
name: 'nail polish',
keywords: 'care | cosmetics | manicure | nail | polish'
}, {
code: '\u{1F933}',
name: 'selfie',
keywords: 'camera | phone | selfie'
}, {
code: '\u{1F4AA}',
name: 'flexed biceps',
keywords: 'biceps | comic | flex | flexed biceps | muscle'
}, {
code: '\u{1F9BE}',
name: 'mechanical arm',
keywords: 'accessibility | mechanical arm | prosthetic'
}, {
code: '\u{1F9BF}',
name: 'mechanical leg',
keywords: 'accessibility | mechanical leg | prosthetic'
}, {
code: '\u{1F9B5}',
name: 'leg',
keywords: 'kick | leg | limb'
}, {
code: '\u{1F9B6}',
name: 'foot',
keywords: 'foot | kick | stomp'
}, {
code: '\u{1F442}',
name: 'ear',
keywords: 'body | ear'
}, {
code: '\u{1F9BB}',
name: 'ear with hearing aid',
keywords: 'accessibility | ear with hearing aid | hard of hearing'
}, {
code: '\u{1F443}',
name: 'nose',
keywords: 'body | nose'
}, {
code: '\u{1F9E0}',
name: 'brain',
keywords: 'brain | intelligent'
}, {
code: '\u{1FAC0}',
name: 'anatomical heart',
keywords: 'anatomical | cardiology | heart | organ | pulse'
}, {
code: '\u{1FAC1}',
name: 'lungs',
keywords: 'breath | exhalation | inhalation | lungs | organ | respiration'
}, {
code: '\u{1F9B7}',
name: 'tooth',
keywords: 'dentist | tooth'
}, {
code: '\u{1F9B4}',
name: 'bone',
keywords: 'bone | skeleton'
}, {
code: '\u{1F440}',
name: 'eyes',
keywords: 'eye | eyes | face'
}, {
code: '\u{1F441}',
name: 'eye',
keywords: 'body | eye'
}, {
code: '\u{1F445}',
name: 'tongue',
keywords: 'body | tongue'
}, {
code: '\u{1F444}',
name: 'mouth',
keywords: 'lips | mouth'
}, {
code: '\u{1F476}',
name: 'baby',
keywords: 'baby | young'
}, {
code: '\u{1F9D2}',
name: 'child',
keywords: 'child | gender-neutral | unspecified gender | young'
}, {
code: '\u{1F466}',
name: 'boy',
keywords: 'boy | young'
}, {
code: '\u{1F467}',
name: 'girl',
keywords: 'girl | Virgo | young | zodiac'
}, {
code: '\u{1F9D1}',
name: 'person',
keywords: 'adult | gender-neutral | person | unspecified gender'
}, {
code: '\u{1F471}',
name: 'person: blond hair',
keywords: 'blond | blond-haired person | hair | person: blond hair'
}, {
code: '\u{1F468}',
name: 'man',
keywords: 'adult | man'
}, {
code: '\u{1F9D4}',
name: 'person: beard',
keywords: 'beard | person | person: beard | bewhiskered'
}, {
code: '\u{1F9D4}\u{200D}\u{2642}\u{FE0F}',
name: 'man: beard',
keywords: 'beard | man | man: beard'
}, {
code: '\u{1F9D4}\u{200D}\u{2640}\u{FE0F}',
name: 'woman: beard',
keywords: 'beard | woman | woman: beard'
}, {
code: '\u{1F468}\u{200D}\u{1F9B0}',
name: 'man: red hair',
keywords: 'adult | man | red hair'
}, {
code: '\u{1F468}\u{200D}\u{1F9B1}',
name: 'man: curly hair',
keywords: 'adult | curly hair | man'
}, {
code: '\u{1F468}\u{200D}\u{1F9B3}',
name: 'man: white hair',
keywords: 'adult | man | white hair'
}, {
code: '\u{1F468}\u{200D}\u{1F9B2}',
name: 'man: bald',
keywords: 'adult | bald | man'
}, {
code: '\u{1F469}',
name: 'woman',
keywords: 'adult | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F9B0}',
name: 'woman: red hair',
keywords: 'adult | red hair | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9B0}',
name: 'person: red hair',
keywords: 'adult | gender-neutral | person | red hair | unspecified gender'
}, {
code: '\u{1F469}\u{200D}\u{1F9B1}',
name: 'woman: curly hair',
keywords: 'adult | curly hair | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9B1}',
name: 'person: curly hair',
keywords: 'adult | curly hair | gender-neutral | person | unspecified gender'
}, {
code: '\u{1F469}\u{200D}\u{1F9B3}',
name: 'woman: white hair',
keywords: 'adult | white hair | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9B3}',
name: 'person: white hair',
keywords: 'adult | gender-neutral | person | unspecified gender | white hair'
}, {
code: '\u{1F469}\u{200D}\u{1F9B2}',
name: 'woman: bald',
keywords: 'adult | bald | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9B2}',
name: 'person: bald',
keywords: 'adult | bald | gender-neutral | person | unspecified gender'
}, {
code: '\u{1F471}\u{200D}\u{2640}\u{FE0F}',
name: 'woman: blond hair',
keywords: 'blond-haired woman | blonde | hair | woman | woman: blond hair'
}, {
code: '\u{1F471}\u{200D}\u{2642}\u{FE0F}',
name: 'man: blond hair',
keywords: 'blond | blond-haired man | hair | man | man: blond hair'
}, {
code: '\u{1F9D3}',
name: 'older person',
keywords: 'adult | gender-neutral | old | older person | unspecified gender'
}, {
code: '\u{1F474}',
name: 'old man',
keywords: 'adult | man | old'
}, {
code: '\u{1F475}',
name: 'old woman',
keywords: 'adult | old | woman'
}, {
code: '\u{1F64D}',
name: 'person frowning',
keywords: 'frown | gesture | person frowning'
}, {
code: '\u{1F64D}\u{200D}\u{2642}\u{FE0F}',
name: 'man frowning',
keywords: 'frowning | gesture | man'
}, {
code: '\u{1F64D}\u{200D}\u{2640}\u{FE0F}',
name: 'woman frowning',
keywords: 'frowning | gesture | woman'
}, {
code: '\u{1F64E}',
name: 'person pouting',
keywords: 'gesture | person pouting | pouting'
}, {
code: '\u{1F64E}\u{200D}\u{2642}\u{FE0F}',
name: 'man pouting',
keywords: 'gesture | man | pouting'
}, {
code: '\u{1F64E}\u{200D}\u{2640}\u{FE0F}',
name: 'woman pouting',
keywords: 'gesture | pouting | woman'
}, {
code: '\u{1F645}',
name: 'person gesturing NO',
keywords: 'forbidden | gesture | hand | person gesturing NO | prohibited'
}, {
code: '\u{1F645}\u{200D}\u{2642}\u{FE0F}',
name: 'man gesturing NO',
keywords: 'forbidden | gesture | hand | man | man gesturing NO | prohibited'
}, {
code: '\u{1F645}\u{200D}\u{2640}\u{FE0F}',
name: 'woman gesturing NO',
keywords: 'forbidden | gesture | hand | prohibited | woman | woman gesturing NO'
}, {
code: '\u{1F646}',
name: 'person gesturing OK',
keywords: 'gesture | hand | OK | person gesturing OK'
}, {
code: '\u{1F646}\u{200D}\u{2642}\u{FE0F}',
name: 'man gesturing OK',
keywords: 'gesture | hand | man | man gesturing OK | OK'
}, {
code: '\u{1F646}\u{200D}\u{2640}\u{FE0F}',
name: 'woman gesturing OK',
keywords: 'gesture | hand | OK | woman | woman gesturing OK'
}, {
code: '\u{1F481}',
name: 'person tipping hand',
keywords: 'hand | help | information | person tipping hand | sassy | tipping'
}, {
code: '\u{1F481}\u{200D}\u{2642}\u{FE0F}',
name: 'man tipping hand',
keywords: 'man | man tipping hand | sassy | tipping hand'
}, {
code: '\u{1F481}\u{200D}\u{2640}\u{FE0F}',
name: 'woman tipping hand',
keywords: 'sassy | tipping hand | woman | woman tipping hand'
}, {
code: '\u{1F64B}',
name: 'person raising hand',
keywords: 'gesture | hand | happy | person raising hand | raised'
}, {
code: '\u{1F64B}\u{200D}\u{2642}\u{FE0F}',
name: 'man raising hand',
keywords: 'gesture | man | man raising hand | raising hand'
}, {
code: '\u{1F64B}\u{200D}\u{2640}\u{FE0F}',
name: 'woman raising hand',
keywords: 'gesture | raising hand | woman | woman raising hand'
}, {
code: '\u{1F9CF}',
name: 'deaf person',
keywords: 'accessibility | deaf | deaf person | ear | hear'
}, {
code: '\u{1F9CF}\u{200D}\u{2642}\u{FE0F}',
name: 'deaf man',
keywords: 'deaf | man'
}, {
code: '\u{1F9CF}\u{200D}\u{2640}\u{FE0F}',
name: 'deaf woman',
keywords: 'deaf | woman'
}, {
code: '\u{1F647}',
name: 'person bowing',
keywords: 'apology | bow | gesture | person bowing | sorry'
}, {
code: '\u{1F647}\u{200D}\u{2642}\u{FE0F}',
name: 'man bowing',
keywords: 'apology | bowing | favor | gesture | man | sorry'
}, {
code: '\u{1F647}\u{200D}\u{2640}\u{FE0F}',
name: 'woman bowing',
keywords: 'apology | bowing | favor | gesture | sorry | woman'
}, {
code: '\u{1F926}',
name: 'person facepalming',
keywords: 'disbelief | exasperation | face | palm | person facepalming'
}, {
code: '\u{1F926}\u{200D}\u{2642}\u{FE0F}',
name: 'man facepalming',
keywords: 'disbelief | exasperation | facepalm | man | man facepalming'
}, {
code: '\u{1F926}\u{200D}\u{2640}\u{FE0F}',
name: 'woman facepalming',
keywords: 'disbelief | exasperation | facepalm | woman | woman facepalming'
}, {
code: '\u{1F937}',
name: 'person shrugging',
keywords: 'doubt | ignorance | indifference | person shrugging | shrug'
}, {
code: '\u{1F937}\u{200D}\u{2642}\u{FE0F}',
name: 'man shrugging',
keywords: 'doubt | ignorance | indifference | man | man shrugging | shrug'
}, {
code: '\u{1F937}\u{200D}\u{2640}\u{FE0F}',
name: 'woman shrugging',
keywords: 'doubt | ignorance | indifference | shrug | woman | woman shrugging'
}, {
code: '\u{1F9D1}\u{200D}\u{2695}\u{FE0F}',
name: 'health worker',
keywords: 'doctor | health worker | healthcare | nurse | therapist'
}, {
code: '\u{1F468}\u{200D}\u{2695}\u{FE0F}',
name: 'man health worker',
keywords: 'doctor | healthcare | man | man health worker | nurse | therapist'
}, {
code: '\u{1F469}\u{200D}\u{2695}\u{FE0F}',
name: 'woman health worker',
keywords: 'doctor | healthcare | nurse | therapist | woman | woman health worker'
}, {
code: '\u{1F9D1}\u{200D}\u{1F393}',
name: 'student',
keywords: 'graduate | student'
}, {
code: '\u{1F468}\u{200D}\u{1F393}',
name: 'man student',
keywords: 'graduate | man | student'
}, {
code: '\u{1F469}\u{200D}\u{1F393}',
name: 'woman student',
keywords: 'graduate | student | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F3EB}',
name: 'teacher',
keywords: 'instructor | professor | teacher'
}, {
code: '\u{1F468}\u{200D}\u{1F3EB}',
name: 'man teacher',
keywords: 'instructor | man | professor | teacher'
}, {
code: '\u{1F469}\u{200D}\u{1F3EB}',
name: 'woman teacher',
keywords: 'instructor | professor | teacher | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{2696}\u{FE0F}',
name: 'judge',
keywords: 'judge | justice | scales'
}, {
code: '\u{1F468}\u{200D}\u{2696}\u{FE0F}',
name: 'man judge',
keywords: 'judge | justice | man | scales'
}, {
code: '\u{1F469}\u{200D}\u{2696}\u{FE0F}',
name: 'woman judge',
keywords: 'judge | justice | scales | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F33E}',
name: 'farmer',
keywords: 'farmer | gardener | rancher'
}, {
code: '\u{1F468}\u{200D}\u{1F33E}',
name: 'man farmer',
keywords: 'farmer | gardener | man | rancher'
}, {
code: '\u{1F469}\u{200D}\u{1F33E}',
name: 'woman farmer',
keywords: 'farmer | gardener | rancher | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F373}',
name: 'cook',
keywords: 'chef | cook'
}, {
code: '\u{1F468}\u{200D}\u{1F373}',
name: 'man cook',
keywords: 'chef | cook | man'
}, {
code: '\u{1F469}\u{200D}\u{1F373}',
name: 'woman cook',
keywords: 'chef | cook | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F527}',
name: 'mechanic',
keywords: 'electrician | mechanic | plumber | tradesperson'
}, {
code: '\u{1F468}\u{200D}\u{1F527}',
name: 'man mechanic',
keywords: 'electrician | man | mechanic | plumber | tradesperson'
}, {
code: '\u{1F469}\u{200D}\u{1F527}',
name: 'woman mechanic',
keywords: 'electrician | mechanic | plumber | tradesperson | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F3ED}',
name: 'factory worker',
keywords: 'assembly | factory | industrial | worker'
}, {
code: '\u{1F468}\u{200D}\u{1F3ED}',
name: 'man factory worker',
keywords: 'assembly | factory | industrial | man | worker'
}, {
code: '\u{1F469}\u{200D}\u{1F3ED}',
name: 'woman factory worker',
keywords: 'assembly | factory | industrial | woman | worker'
}, {
code: '\u{1F9D1}\u{200D}\u{1F4BC}',
name: 'office worker',
keywords: 'architect | business | manager | office worker | white-collar'
}, {
code: '\u{1F468}\u{200D}\u{1F4BC}',
name: 'man office worker',
keywords: 'architect | business | man | man office worker | manager | white-collar'
}, {
code: '\u{1F469}\u{200D}\u{1F4BC}',
name: 'woman office worker',
keywords: 'architect | business | manager | white-collar | woman | woman office worker'
}, {
code: '\u{1F9D1}\u{200D}\u{1F52C}',
name: 'scientist',
keywords: 'biologist | chemist | engineer | physicist | scientist'
}, {
code: '\u{1F468}\u{200D}\u{1F52C}',
name: 'man scientist',
keywords: 'biologist | chemist | engineer | man | physicist | scientist'
}, {
code: '\u{1F469}\u{200D}\u{1F52C}',
name: 'woman scientist',
keywords: 'biologist | chemist | engineer | physicist | scientist | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F4BB}',
name: 'technologist',
keywords: 'coder | developer | inventor | software | technologist'
}, {
code: '\u{1F468}\u{200D}\u{1F4BB}',
name: 'man technologist',
keywords: 'coder | developer | inventor | man | software | technologist'
}, {
code: '\u{1F469}\u{200D}\u{1F4BB}',
name: 'woman technologist',
keywords: 'coder | developer | inventor | software | technologist | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F3A4}',
name: 'singer',
keywords: 'actor | entertainer | rock | singer | star'
}, {
code: '\u{1F468}\u{200D}\u{1F3A4}',
name: 'man singer',
keywords: 'actor | entertainer | man | rock | singer | star'
}, {
code: '\u{1F469}\u{200D}\u{1F3A4}',
name: 'woman singer',
keywords: 'actor | entertainer | rock | singer | star | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F3A8}',
name: 'artist',
keywords: 'artist | palette'
}, {
code: '\u{1F468}\u{200D}\u{1F3A8}',
name: 'man artist',
keywords: 'artist | man | palette'
}, {
code: '\u{1F469}\u{200D}\u{1F3A8}',
name: 'woman artist',
keywords: 'artist | palette | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{2708}\u{FE0F}',
name: 'pilot',
keywords: 'pilot | plane'
}, {
code: '\u{1F468}\u{200D}\u{2708}\u{FE0F}',
name: 'man pilot',
keywords: 'man | pilot | plane'
}, {
code: '\u{1F469}\u{200D}\u{2708}\u{FE0F}',
name: 'woman pilot',
keywords: 'pilot | plane | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F680}',
name: 'astronaut',
keywords: 'astronaut | rocket'
}, {
code: '\u{1F468}\u{200D}\u{1F680}',
name: 'man astronaut',
keywords: 'astronaut | man | rocket'
}, {
code: '\u{1F469}\u{200D}\u{1F680}',
name: 'woman astronaut',
keywords: 'astronaut | rocket | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F692}',
name: 'firefighter',
keywords: 'firefighter | firetruck'
}, {
code: '\u{1F468}\u{200D}\u{1F692}',
name: 'man firefighter',
keywords: 'firefighter | firetruck | man'
}, {
code: '\u{1F469}\u{200D}\u{1F692}',
name: 'woman firefighter',
keywords: 'firefighter | firetruck | woman'
}, {
code: '\u{1F46E}',
name: 'police officer',
keywords: 'cop | officer | police'
}, {
code: '\u{1F46E}\u{200D}\u{2642}\u{FE0F}',
name: 'man police officer',
keywords: 'cop | man | officer | police'
}, {
code: '\u{1F46E}\u{200D}\u{2640}\u{FE0F}',
name: 'woman police officer',
keywords: 'cop | officer | police | woman'
}, {
code: '\u{1F575}',
name: 'detective',
keywords: 'detective | sleuth | spy'
}, {
code: '\u{1F575}\u{FE0F}\u{200D}\u{2642}\u{FE0F}',
name: 'man detective',
keywords: 'detective | man | sleuth | spy'
}, {
code: '\u{1F575}\u{FE0F}\u{200D}\u{2640}\u{FE0F}',
name: 'woman detective',
keywords: 'detective | sleuth | spy | woman'
}, {
code: '\u{1F482}',
name: 'guard',
keywords: 'guard'
}, {
code: '\u{1F482}\u{200D}\u{2642}\u{FE0F}',
name: 'man guard',
keywords: 'guard | man'
}, {
code: '\u{1F482}\u{200D}\u{2640}\u{FE0F}',
name: 'woman guard',
keywords: 'guard | woman'
}, {
code: '\u{1F977}',
name: 'ninja',
keywords: 'fighter | hidden | ninja | stealth'
}, {
code: '\u{1F477}',
name: 'construction worker',
keywords: 'construction | hat | worker'
}, {
code: '\u{1F477}\u{200D}\u{2642}\u{FE0F}',
name: 'man construction worker',
keywords: 'construction | man | worker'
}, {
code: '\u{1F477}\u{200D}\u{2640}\u{FE0F}',
name: 'woman construction worker',
keywords: 'construction | woman | worker'
}, {
code: '\u{1F934}',
name: 'prince',
keywords: 'prince'
}, {
code: '\u{1F478}',
name: 'princess',
keywords: 'fairy tale | fantasy | princess'
}, {
code: '\u{1F473}',
name: 'person wearing turban',
keywords: 'person wearing turban | turban'
}, {
code: '\u{1F473}\u{200D}\u{2642}\u{FE0F}',
name: 'man wearing turban',
keywords: 'man | man wearing turban | turban'
}, {
code: '\u{1F473}\u{200D}\u{2640}\u{FE0F}',
name: 'woman wearing turban',
keywords: 'turban | woman | woman wearing turban'
}, {
code: '\u{1F472}',
name: 'person with skullcap',
keywords: 'cap | gua pi mao | hat | person | person with skullcap | skullcap'
}, {
code: '\u{1F9D5}',
name: 'woman with headscarf',
keywords: 'headscarf | hijab | mantilla | tichel | woman with headscarf | bandana | head kerchief'
}, {
code: '\u{1F935}',
name: 'person in tuxedo',
keywords: 'groom | person | person in tuxedo | tuxedo'
}, {
code: '\u{1F935}\u{200D}\u{2642}\u{FE0F}',
name: 'man in tuxedo',
keywords: 'man | man in tuxedo | tuxedo'
}, {
code: '\u{1F935}\u{200D}\u{2640}\u{FE0F}',
name: 'woman in tuxedo',
keywords: 'tuxedo | woman | woman in tuxedo'
}, {
code: '\u{1F470}',
name: 'person with veil',
keywords: 'bride | person | person with veil | veil | wedding'
}, {
code: '\u{1F470}\u{200D}\u{2642}\u{FE0F}',
name: 'man with veil',
keywords: 'man | man with veil | veil'
}, {
code: '\u{1F470}\u{200D}\u{2640}\u{FE0F}',
name: 'woman with veil',
keywords: 'veil | woman | woman with veil'
}, {
code: '\u{1F930}',
name: 'pregnant woman',
keywords: 'pregnant | woman'
}, {
code: '\u{1F931}',
name: 'breast-feeding',
keywords: 'baby | breast | breast-feeding | nursing'
}, {
code: '\u{1F469}\u{200D}\u{1F37C}',
name: 'woman feeding baby',
keywords: 'baby | feeding | nursing | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F37C}',
name: 'man feeding baby',
keywords: 'baby | feeding | man | nursing'
}, {
code: '\u{1F9D1}\u{200D}\u{1F37C}',
name: 'person feeding baby',
keywords: 'baby | feeding | nursing | person'
}, {
code: '\u{1F47C}',
name: 'baby angel',
keywords: 'angel | baby | face | fairy tale | fantasy'
}, {
code: '\u{1F385}',
name: 'Santa Claus',
keywords: 'celebration | Christmas | claus | father | santa | Santa Claus'
}, {
code: '\u{1F936}',
name: 'Mrs. Claus',
keywords: 'celebration | Christmas | claus | mother | Mrs. | Mrs. Claus'
}, {
code: '\u{1F9D1}\u{200D}\u{1F384}',
name: 'mx claus',
keywords: 'Claus, christmas | mx claus'
}, {
code: '\u{1F9B8}',
name: 'superhero',
keywords: 'good | hero | heroine | superhero | superpower'
}, {
code: '\u{1F9B8}\u{200D}\u{2642}\u{FE0F}',
name: 'man superhero',
keywords: 'good | hero | man | man superhero | superpower'
}, {
code: '\u{1F9B8}\u{200D}\u{2640}\u{FE0F}',
name: 'woman superhero',
keywords: 'good | hero | heroine | superpower | woman | woman superhero'
}, {
code: '\u{1F9B9}',
name: 'supervillain',
keywords: 'criminal | evil | superpower | supervillain | villain'
}, {
code: '\u{1F9B9}\u{200D}\u{2642}\u{FE0F}',
name: 'man supervillain',
keywords: 'criminal | evil | man | man supervillain | superpower | villain'
}, {
code: '\u{1F9B9}\u{200D}\u{2640}\u{FE0F}',
name: 'woman supervillain',
keywords: 'criminal | evil | superpower | villain | woman | woman supervillain'
}, {
code: '\u{1F9D9}',
name: 'mage',
keywords: 'mage | sorcerer | sorceress | witch | wizard'
}, {
code: '\u{1F9D9}\u{200D}\u{2642}\u{FE0F}',
name: 'man mage',
keywords: 'man mage | sorcerer | wizard'
}, {
code: '\u{1F9D9}\u{200D}\u{2640}\u{FE0F}',
name: 'woman mage',
keywords: 'sorceress | witch | woman mage'
}, {
code: '\u{1F9DA}',
name: 'fairy',
keywords: 'fairy | Oberon | Puck | Titania'
}, {
code: '\u{1F9DA}\u{200D}\u{2642}\u{FE0F}',
name: 'man fairy',
keywords: 'man fairy | Oberon | Puck'
}, {
code: '\u{1F9DA}\u{200D}\u{2640}\u{FE0F}',
name: 'woman fairy',
keywords: 'Titania | woman fairy'
}, {
code: '\u{1F9DB}',
name: 'vampire',
keywords: 'Dracula | undead | vampire'
}, {
code: '\u{1F9DB}\u{200D}\u{2642}\u{FE0F}',
name: 'man vampire',
keywords: 'Dracula | man vampire | undead'
}, {
code: '\u{1F9DB}\u{200D}\u{2640}\u{FE0F}',
name: 'woman vampire',
keywords: 'undead | woman vampire'
}, {
code: '\u{1F9DC}',
name: 'merperson',
keywords: 'mermaid | merman | merperson | merwoman'
}, {
code: '\u{1F9DC}\u{200D}\u{2642}\u{FE0F}',
name: 'merman',
keywords: 'merman | Triton'
}, {
code: '\u{1F9DC}\u{200D}\u{2640}\u{FE0F}',
name: 'mermaid',
keywords: 'mermaid | merwoman'
}, {
code: '\u{1F9DD}',
name: 'elf',
keywords: 'elf | magical | LOTR style'
}, {
code: '\u{1F9DD}\u{200D}\u{2642}\u{FE0F}',
name: 'man elf',
keywords: 'magical | man elf'
}, {
code: '\u{1F9DD}\u{200D}\u{2640}\u{FE0F}',
name: 'woman elf',
keywords: 'magical | woman elf'
}, {
code: '\u{1F9DE}',
name: 'genie',
keywords: 'djinn | genie | (non-human color)'
}, {
code: '\u{1F9DE}\u{200D}\u{2642}\u{FE0F}',
name: 'man genie',
keywords: 'djinn | man genie'
}, {
code: '\u{1F9DE}\u{200D}\u{2640}\u{FE0F}',
name: 'woman genie',
keywords: 'djinn | woman genie'
}, {
code: '\u{1F9DF}',
name: 'zombie',
keywords: 'undead | walking dead | zombie | (non-human color)'
}, {
code: '\u{1F9DF}\u{200D}\u{2642}\u{FE0F}',
name: 'man zombie',
keywords: 'man zombie | undead | walking dead'
}, {
code: '\u{1F9DF}\u{200D}\u{2640}\u{FE0F}',
name: 'woman zombie',
keywords: 'undead | walking dead | woman zombie'
}, {
code: '\u{1F486}',
name: 'person getting massage',
keywords: 'face | massage | person getting massage | salon'
}, {
code: '\u{1F486}\u{200D}\u{2642}\u{FE0F}',
name: 'man getting massage',
keywords: 'face | man | man getting massage | massage'
}, {
code: '\u{1F486}\u{200D}\u{2640}\u{FE0F}',
name: 'woman getting massage',
keywords: 'face | massage | woman | woman getting massage'
}, {
code: '\u{1F487}',
name: 'person getting haircut',
keywords: 'barber | beauty | haircut | parlor | person getting haircut'
}, {
code: '\u{1F487}\u{200D}\u{2642}\u{FE0F}',
name: 'man getting haircut',
keywords: 'haircut | man | man getting haircut'
}, {
code: '\u{1F487}\u{200D}\u{2640}\u{FE0F}',
name: 'woman getting haircut',
keywords: 'haircut | woman | woman getting haircut'
}, {
code: '\u{1F6B6}',
name: 'person walking',
keywords: 'hike | person walking | walk | walking'
}, {
code: '\u{1F6B6}\u{200D}\u{2642}\u{FE0F}',
name: 'man walking',
keywords: 'hike | man | man walking | walk'
}, {
code: '\u{1F6B6}\u{200D}\u{2640}\u{FE0F}',
name: 'woman walking',
keywords: 'hike | walk | woman | woman walking'
}, {
code: '\u{1F9CD}',
name: 'person standing',
keywords: 'person standing | stand | standing'
}, {
code: '\u{1F9CD}\u{200D}\u{2642}\u{FE0F}',
name: 'man standing',
keywords: 'man | standing'
}, {
code: '\u{1F9CD}\u{200D}\u{2640}\u{FE0F}',
name: 'woman standing',
keywords: 'standing | woman'
}, {
code: '\u{1F9CE}',
name: 'person kneeling',
keywords: 'kneel | kneeling | person kneeling'
}, {
code: '\u{1F9CE}\u{200D}\u{2642}\u{FE0F}',
name: 'man kneeling',
keywords: 'kneeling | man'
}, {
code: '\u{1F9CE}\u{200D}\u{2640}\u{FE0F}',
name: 'woman kneeling',
keywords: 'kneeling | woman'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9AF}',
name: 'person with white cane',
keywords: 'accessibility | blind | person with white cane'
}, {
code: '\u{1F468}\u{200D}\u{1F9AF}',
name: 'man with white cane',
keywords: 'accessibility | blind | man | man with white cane'
}, {
code: '\u{1F469}\u{200D}\u{1F9AF}',
name: 'woman with white cane',
keywords: 'accessibility | blind | woman | woman with white cane'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9BC}',
name: 'person in motorized wheelchair',
keywords: 'accessibility | person in motorized wheelchair | wheelchair'
}, {
code: '\u{1F468}\u{200D}\u{1F9BC}',
name: 'man in motorized wheelchair',
keywords: 'accessibility | man | man in motorized wheelchair | wheelchair'
}, {
code: '\u{1F469}\u{200D}\u{1F9BC}',
name: 'woman in motorized wheelchair',
keywords: 'accessibility | wheelchair | woman | woman in motorized wheelchair'
}, {
code: '\u{1F9D1}\u{200D}\u{1F9BD}',
name: 'person in manual wheelchair',
keywords: 'accessibility | person in manual wheelchair | wheelchair'
}, {
code: '\u{1F468}\u{200D}\u{1F9BD}',
name: 'man in manual wheelchair',
keywords: 'accessibility | man | man in manual wheelchair | wheelchair'
}, {
code: '\u{1F469}\u{200D}\u{1F9BD}',
name: 'woman in manual wheelchair',
keywords: 'accessibility | wheelchair | woman | woman in manual wheelchair'
}, {
code: '\u{1F3C3}',
name: 'person running',
keywords: 'marathon | person running | running'
}, {
code: '\u{1F3C3}\u{200D}\u{2642}\u{FE0F}',
name: 'man running',
keywords: 'man | marathon | racing | running'
}, {
code: '\u{1F3C3}\u{200D}\u{2640}\u{FE0F}',
name: 'woman running',
keywords: 'marathon | racing | running | woman'
}, {
code: '\u{1F483}',
name: 'woman dancing',
keywords: 'dance | dancing | woman'
}, {
code: '\u{1F57A}',
name: 'man dancing',
keywords: 'dance | dancing | man'
}, {
code: '\u{1F574}',
name: 'person in suit levitating',
keywords: 'business | person | person in suit levitating | suit'
}, {
code: '\u{1F46F}',
name: 'people with bunny ears',
keywords: 'bunny ear | dancer | partying | people with bunny ears'
}, {
code: '\u{1F46F}\u{200D}\u{2642}\u{FE0F}',
name: 'men with bunny ears',
keywords: 'bunny ear | dancer | men | men with bunny ears | partying'
}, {
code: '\u{1F46F}\u{200D}\u{2640}\u{FE0F}',
name: 'women with bunny ears',
keywords: 'bunny ear | dancer | partying | women | women with bunny ears'
}, {
code: '\u{1F9D6}',
name: 'person in steamy room',
keywords: 'person in steamy room | sauna | steam room | hamam | steambath'
}, {
code: '\u{1F9D6}\u{200D}\u{2642}\u{FE0F}',
name: 'man in steamy room',
keywords: 'man in steamy room | sauna | steam room'
}, {
code: '\u{1F9D6}\u{200D}\u{2640}\u{FE0F}',
name: 'woman in steamy room',
keywords: 'sauna | steam room | woman in steamy room'
}, {
code: '\u{1F9D7}',
name: 'person climbing',
keywords: 'climber | person climbing'
}, {
code: '\u{1F9D7}\u{200D}\u{2642}\u{FE0F}',
name: 'man climbing',
keywords: 'climber | man climbing'
}, {
code: '\u{1F9D7}\u{200D}\u{2640}\u{FE0F}',
name: 'woman climbing',
keywords: 'climber | woman climbing'
}, {
code: '\u{1F93A}',
name: 'person fencing',
keywords: 'fencer | fencing | person fencing | sword'
}, {
code: '\u{1F3C7}',
name: 'horse racing',
keywords: 'horse | jockey | racehorse | racing'
}, {
code: '\u{26F7}',
name: 'skier',
keywords: 'ski | skier | snow'
}, {
code: '\u{1F3C2}',
name: 'snowboarder',
keywords: 'ski | snow | snowboard | snowboarder'
}, {
code: '\u{1F3CC}',
name: 'person golfing',
keywords: 'ball | golf | person golfing'
}, {
code: '\u{1F3CC}\u{FE0F}\u{200D}\u{2642}\u{FE0F}',
name: 'man golfing',
keywords: 'golf | man | man golfing'
}, {
code: '\u{1F3CC}\u{FE0F}\u{200D}\u{2640}\u{FE0F}',
name: 'woman golfing',
keywords: 'golf | woman | woman golfing'
}, {
code: '\u{1F3C4}',
name: 'person surfing',
keywords: 'person surfing | surfing'
}, {
code: '\u{1F3C4}\u{200D}\u{2642}\u{FE0F}',
name: 'man surfing',
keywords: 'man | surfing'
}, {
code: '\u{1F3C4}\u{200D}\u{2640}\u{FE0F}',
name: 'woman surfing',
keywords: 'surfing | woman'
}, {
code: '\u{1F6A3}',
name: 'person rowing boat',
keywords: 'boat | person rowing boat | rowboat'
}, {
code: '\u{1F6A3}\u{200D}\u{2642}\u{FE0F}',
name: 'man rowing boat',
keywords: 'boat | man | man rowing boat | rowboat'
}, {
code: '\u{1F6A3}\u{200D}\u{2640}\u{FE0F}',
name: 'woman rowing boat',
keywords: 'boat | rowboat | woman | woman rowing boat'
}, {
code: '\u{1F3CA}',
name: 'person swimming',
keywords: 'person swimming | swim'
}, {
code: '\u{1F3CA}\u{200D}\u{2642}\u{FE0F}',
name: 'man swimming',
keywords: 'man | man swimming | swim'
}, {
code: '\u{1F3CA}\u{200D}\u{2640}\u{FE0F}',
name: 'woman swimming',
keywords: 'swim | woman | woman swimming'
}, {
code: '\u{26F9}',
name: 'person bouncing ball',
keywords: 'ball | person bouncing ball'
}, {
code: '\u{26F9}\u{FE0F}\u{200D}\u{2642}\u{FE0F}',
name: 'man bouncing ball',
keywords: 'ball | man | man bouncing ball'
}, {
code: '\u{26F9}\u{FE0F}\u{200D}\u{2640}\u{FE0F}',
name: 'woman bouncing ball',
keywords: 'ball | woman | woman bouncing ball'
}, {
code: '\u{1F3CB}',
name: 'person lifting weights',
keywords: 'lifter | person lifting weights | weight'
}, {
code: '\u{1F3CB}\u{FE0F}\u{200D}\u{2642}\u{FE0F}',
name: 'man lifting weights',
keywords: 'man | man lifting weights | weight lifter'
}, {
code: '\u{1F3CB}\u{FE0F}\u{200D}\u{2640}\u{FE0F}',
name: 'woman lifting weights',
keywords: 'weight lifter | woman | woman lifting weights'
}, {
code: '\u{1F6B4}',
name: 'person biking',
keywords: 'bicycle | biking | cyclist | person biking'
}, {
code: '\u{1F6B4}\u{200D}\u{2642}\u{FE0F}',
name: 'man biking',
keywords: 'bicycle | biking | cyclist | man'
}, {
code: '\u{1F6B4}\u{200D}\u{2640}\u{FE0F}',
name: 'woman biking',
keywords: 'bicycle | biking | cyclist | woman'
}, {
code: '\u{1F6B5}',
name: 'person mountain biking',
keywords: 'bicycle | bicyclist | bike | cyclist | mountain | person mountain biking'
}, {
code: '\u{1F6B5}\u{200D}\u{2642}\u{FE0F}',
name: 'man mountain biking',
keywords: 'bicycle | bike | cyclist | man | man mountain biking | mountain'
}, {
code: '\u{1F6B5}\u{200D}\u{2640}\u{FE0F}',
name: 'woman mountain biking',
keywords: 'bicycle | bike | biking | cyclist | mountain | woman'
}, {
code: '\u{1F938}',
name: 'person cartwheeling',
keywords: 'cartwheel | gymnastics | person cartwheeling'
}, {
code: '\u{1F938}\u{200D}\u{2642}\u{FE0F}',
name: 'man cartwheeling',
keywords: 'cartwheel | gymnastics | man | man cartwheeling'
}, {
code: '\u{1F938}\u{200D}\u{2640}\u{FE0F}',
name: 'woman cartwheeling',
keywords: 'cartwheel | gymnastics | woman | woman cartwheeling'
}, {
code: '\u{1F93C}',
name: 'people wrestling',
keywords: 'people wrestling | wrestle | wrestler'
}, {
code: '\u{1F93C}\u{200D}\u{2642}\u{FE0F}',
name: 'men wrestling',
keywords: 'men | men wrestling | wrestle'
}, {
code: '\u{1F93C}\u{200D}\u{2640}\u{FE0F}',
name: 'women wrestling',
keywords: 'women | women wrestling | wrestle'
}, {
code: '\u{1F93D}',
name: 'person playing water polo',
keywords: 'person playing water polo | polo | water'
}, {
code: '\u{1F93D}\u{200D}\u{2642}\u{FE0F}',
name: 'man playing water polo',
keywords: 'man | man playing water polo | water polo'
}, {
code: '\u{1F93D}\u{200D}\u{2640}\u{FE0F}',
name: 'woman playing water polo',
keywords: 'water polo | woman | woman playing water polo'
}, {
code: '\u{1F93E}',
name: 'person playing handball',
keywords: 'ball | handball | person playing handball'
}, {
code: '\u{1F93E}\u{200D}\u{2642}\u{FE0F}',
name: 'man playing handball',
keywords: 'handball | man | man playing handball'
}, {
code: '\u{1F93E}\u{200D}\u{2640}\u{FE0F}',
name: 'woman playing handball',
keywords: 'handball | woman | woman playing handball'
}, {
code: '\u{1F939}',
name: 'person juggling',
keywords: 'balance | juggle | multitask | person juggling | skill'
}, {
code: '\u{1F939}\u{200D}\u{2642}\u{FE0F}',
name: 'man juggling',
keywords: 'juggling | man | multitask'
}, {
code: '\u{1F939}\u{200D}\u{2640}\u{FE0F}',
name: 'woman juggling',
keywords: 'juggling | multitask | woman'
}, {
code: '\u{1F9D8}',
name: 'person in lotus position',
keywords: 'meditation | person in lotus position | yoga | serenity'
}, {
code: '\u{1F9D8}\u{200D}\u{2642}\u{FE0F}',
name: 'man in lotus position',
keywords: 'man in lotus position | meditation | yoga'
}, {
code: '\u{1F9D8}\u{200D}\u{2640}\u{FE0F}',
name: 'woman in lotus position',
keywords: 'meditation | woman in lotus position | yoga'
}, {
code: '\u{1F6C0}',
name: 'person taking bath',
keywords: 'bath | bathtub | person taking bath'
}, {
code: '\u{1F6CC}',
name: 'person in bed',
keywords: 'hotel | person in bed | sleep'
}, {
code: '\u{1F9D1}\u{200D}\u{1F91D}\u{200D}\u{1F9D1}',
name: 'people holding hands',
keywords: 'couple | hand | hold | holding hands | people holding hands | person'
}, {
code: '\u{1F46D}',
name: 'women holding hands',
keywords: 'couple | hand | holding hands | women | women holding hands'
}, {
code: '\u{1F46B}',
name: 'woman and man holding hands',
keywords: 'couple | hand | hold | holding hands | man | woman | woman and man holding hands'
}, {
code: '\u{1F46C}',
name: 'men holding hands',
keywords: 'couple | Gemini | holding hands | man | men | men holding hands | twins | zodiac'
}, {
code: '\u{1F48F}',
name: 'kiss',
keywords: 'couple | kiss'
}, {
code: '\u{1F469}\u{200D}\u{2764}\u{FE0F}\u{200D}\u{1F48B}\u{200D}\u{1F468}',
name: 'kiss: woman, man',
keywords: 'couple | kiss | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{2764}\u{FE0F}\u{200D}\u{1F48B}\u{200D}\u{1F468}',
name: 'kiss: man, man',
keywords: 'couple | kiss | man'
}, {
code: '\u{1F469}\u{200D}\u{2764}\u{FE0F}\u{200D}\u{1F48B}\u{200D}\u{1F469}',
name: 'kiss: woman, woman',
keywords: 'couple | kiss | woman'
}, {
code: '\u{1F491}',
name: 'couple with heart',
keywords: 'couple | couple with heart | love'
}, {
code: '\u{1F469}\u{200D}\u{2764}\u{FE0F}\u{200D}\u{1F468}',
name: 'couple with heart: woman, man',
keywords: 'couple | couple with heart | love | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{2764}\u{FE0F}\u{200D}\u{1F468}',
name: 'couple with heart: man, man',
keywords: 'couple | couple with heart | love | man'
}, {
code: '\u{1F469}\u{200D}\u{2764}\u{FE0F}\u{200D}\u{1F469}',
name: 'couple with heart: woman, woman',
keywords: 'couple | couple with heart | love | woman'
}, {
code: '\u{1F46A}',
name: 'family',
keywords: 'family'
}, {
code: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F466}',
name: 'family: man, woman, boy',
keywords: 'boy | family | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}',
name: 'family: man, woman, girl',
keywords: 'family | girl | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}',
name: 'family: man, woman, girl, boy',
keywords: 'boy | family | girl | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F466}\u{200D}\u{1F466}',
name: 'family: man, woman, boy, boy',
keywords: 'boy | family | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F467}',
name: 'family: man, woman, girl, girl',
keywords: 'family | girl | man | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F468}\u{200D}\u{1F466}',
name: 'family: man, man, boy',
keywords: 'boy | family | man'
}, {
code: '\u{1F468}\u{200D}\u{1F468}\u{200D}\u{1F467}',
name: 'family: man, man, girl',
keywords: 'family | girl | man'
}, {
code: '\u{1F468}\u{200D}\u{1F468}\u{200D}\u{1F467}\u{200D}\u{1F466}',
name: 'family: man, man, girl, boy',
keywords: 'boy | family | girl | man'
}, {
code: '\u{1F468}\u{200D}\u{1F468}\u{200D}\u{1F466}\u{200D}\u{1F466}',
name: 'family: man, man, boy, boy',
keywords: 'boy | family | man'
}, {
code: '\u{1F468}\u{200D}\u{1F468}\u{200D}\u{1F467}\u{200D}\u{1F467}',
name: 'family: man, man, girl, girl',
keywords: 'family | girl | man'
}, {
code: '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F466}',
name: 'family: woman, woman, boy',
keywords: 'boy | family | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}',
name: 'family: woman, woman, girl',
keywords: 'family | girl | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}',
name: 'family: woman, woman, girl, boy',
keywords: 'boy | family | girl | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F466}\u{200D}\u{1F466}',
name: 'family: woman, woman, boy, boy',
keywords: 'boy | family | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F467}',
name: 'family: woman, woman, girl, girl',
keywords: 'family | girl | woman'
}, {
code: '\u{1F468}\u{200D}\u{1F466}',
name: 'family: man, boy',
keywords: 'boy | family | man'
}, {
code: '\u{1F468}\u{200D}\u{1F466}\u{200D}\u{1F466}',
name: 'family: man, boy, boy',
keywords: 'boy | family | man'
}, {
code: '\u{1F468}\u{200D}\u{1F467}',
name: 'family: man, girl',
keywords: 'family | girl | man'
}, {
code: '\u{1F468}\u{200D}\u{1F467}\u{200D}\u{1F466}',
name: 'family: man, girl, boy',
keywords: 'boy | family | girl | man'
}, {
code: '\u{1F468}\u{200D}\u{1F467}\u{200D}\u{1F467}',
name: 'family: man, girl, girl',
keywords: 'family | girl | man'
}, {
code: '\u{1F469}\u{200D}\u{1F466}',
name: 'family: woman, boy',
keywords: 'boy | family | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F466}\u{200D}\u{1F466}',
name: 'family: woman, boy, boy',
keywords: 'boy | family | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F467}',
name: 'family: woman, girl',
keywords: 'family | girl | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F466}',
name: 'family: woman, girl, boy',
keywords: 'boy | family | girl | woman'
}, {
code: '\u{1F469}\u{200D}\u{1F467}\u{200D}\u{1F467}',
name: 'family: woman, girl, girl',
keywords: 'family | girl | woman'
}, {
code: '\u{1F5E3}',
name: 'speaking head',
keywords: 'face | head | silhouette | speak | speaking'
}, {
code: '\u{1F464}',
name: 'bust in silhouette',
keywords: 'bust | bust in silhouette | silhouette'
}, {
code: '\u{1F465}',
name: 'busts in silhouette',
keywords: 'bust | busts in silhouette | silhouette'
}, {
code: '\u{1FAC2}',
name: 'people hugging',
keywords: 'goodbye | hello | hug | people hugging | thanks'
}, {
code: '\u{1F463}',
name: 'footprints',
keywords: 'clothing | footprint | footprints | print'
}, {
code: '\u{1F9B0}',
name: 'red hair',
keywords: 'ginger | red hair | redhead'
}, {
code: '\u{1F9B1}',
name: 'curly hair',
keywords: 'afro | curly | curly hair | ringlets'
}, {
code: '\u{1F9B3}',
name: 'white hair',
keywords: 'gray | hair | old | white'
}, {
code: '\u{1F9B2}',
name: 'bald',
keywords: 'bald | chemotherapy | hairless | no hair | shaven'
}, {
code: '\u{1F435}',
name: 'monkey face',
keywords: 'face | monkey'
}, {
code: '\u{1F412}',
name: 'monkey',
keywords: 'monkey'
}, {
code: '\u{1F98D}',
name: 'gorilla',
keywords: 'gorilla'
}, {
code: '\u{1F9A7}',
name: 'orangutan',
keywords: 'ape | orangutan'
}, {
code: '\u{1F436}',
name: 'dog face',
keywords: 'dog | face | pet'
}, {
code: '\u{1F415}',
name: 'dog',
keywords: 'dog | pet'
}, {
code: '\u{1F9AE}',
name: 'guide dog',
keywords: 'accessibility | blind | guide | guide dog'
}, {
code: '\u{1F415}\u{200D}\u{1F9BA}',
name: 'service dog',
keywords: 'accessibility | assistance | dog | service'
}, {
code: '\u{1F429}',
name: 'poodle',
keywords: 'dog | poodle'
}, {
code: '\u{1F43A}',
name: 'wolf',
keywords: 'face | wolf'
}, {
code: '\u{1F98A}',
name: 'fox',
keywords: 'face | fox'
}, {
code: '\u{1F99D}',
name: 'raccoon',
keywords: 'curious | raccoon | sly'
}, {
code: '\u{1F431}',
name: 'cat face',
keywords: 'cat | face | pet'
}, {
code: '\u{1F408}',
name: 'cat',
keywords: 'cat | pet'
}, {
code: '\u{1F408}\u{200D}\u{2B1B}',
name: 'black cat',
keywords: 'black | cat | unlucky'
}, {
code: '\u{1F981}',
name: 'lion',
keywords: 'face | Leo | lion | zodiac'
}, {
code: '\u{1F42F}',
name: 'tiger face',
keywords: 'face | tiger'
}, {
code: '\u{1F405}',
name: 'tiger',
keywords: 'tiger'
}, {
code: '\u{1F406}',
name: 'leopard',
keywords: 'leopard'
}, {
code: '\u{1F434}',
name: 'horse face',
keywords: 'face | horse'
}, {
code: '\u{1F40E}',
name: 'horse',
keywords: 'equestrian | horse | racehorse | racing'
}, {
code: '\u{1F984}',
name: 'unicorn',
keywords: 'face | unicorn'
}, {
code: '\u{1F993}',
name: 'zebra',
keywords: 'stripe | zebra'
}, {
code: '\u{1F98C}',
name: 'deer',
keywords: 'deer'
}, {
code: '\u{1F9AC}',
name: 'bison',
keywords: 'bison | buffalo | herd | wisent'
}, {
code: '\u{1F42E}',
name: 'cow face',
keywords: 'cow | face'
}, {
code: '\u{1F402}',
name: 'ox',
keywords: 'bull | ox | Taurus | zodiac'
}, {
code: '\u{1F403}',
name: 'water buffalo',
keywords: 'buffalo | water'
}, {
code: '\u{1F404}',
name: 'cow',
keywords: 'cow'
}, {
code: '\u{1F437}',
name: 'pig face',
keywords: 'face | pig'
}, {
code: '\u{1F416}',
name: 'pig',
keywords: 'pig | sow'
}, {
code: '\u{1F417}',
name: 'boar',
keywords: 'boar | pig'
}, {
code: '\u{1F43D}',
name: 'pig nose',
keywords: 'face | nose | pig'
}, {
code: '\u{1F40F}',
name: 'ram',
keywords: 'Aries | male | ram | sheep | zodiac'
}, {
code: '\u{1F411}',
name: 'ewe',
keywords: 'ewe | female | sheep'
}, {
code: '\u{1F410}',
name: 'goat',
keywords: 'Capricorn | goat | zodiac'
}, {
code: '\u{1F42A}',
name: 'camel',
keywords: 'camel | dromedary | hump'
}, {
code: '\u{1F42B}',
name: 'two-hump camel',
keywords: 'bactrian | camel | hump | two-hump camel'
}, {
code: '\u{1F999}',
name: 'llama',
keywords: 'alpaca | guanaco | llama | vicuña | wool'
}, {
code: '\u{1F992}',
name: 'giraffe',
keywords: 'giraffe | spots'
}, {
code: '\u{1F418}',
name: 'elephant',
keywords: 'elephant'
}, {
code: '\u{1F9A3}',
name: 'mammoth',
keywords: 'extinction | large | mammoth | tusk | woolly'
}, {
code: '\u{1F98F}',
name: 'rhinoceros',
keywords: 'rhinoceros'
}, {
code: '\u{1F99B}',
name: 'hippopotamus',
keywords: 'hippo | hippopotamus'
}, {
code: '\u{1F42D}',
name: 'mouse face',
keywords: 'face | mouse'
}, {
code: '\u{1F401}',
name: 'mouse',
keywords: 'mouse'
}, {
code: '\u{1F400}',
name: 'rat',
keywords: 'rat'
}, {
code: '\u{1F439}',
name: 'hamster',
keywords: 'face | hamster | pet'
}, {
code: '\u{1F430}',
name: 'rabbit face',
keywords: 'bunny | face | pet | rabbit'
}, {
code: '\u{1F407}',
name: 'rabbit',
keywords: 'bunny | pet | rabbit'
}, {
code: '\u{1F43F}',
name: 'chipmunk',
keywords: 'chipmunk | squirrel'
}, {
code: '\u{1F9AB}',
name: 'beaver',
keywords: 'beaver | dam'
}, {
code: '\u{1F994}',
name: 'hedgehog',
keywords: 'hedgehog | spiny'
}, {
code: '\u{1F987}',
name: 'bat',
keywords: 'bat | vampire'
}, {
code: '\u{1F43B}',
name: 'bear',
keywords: 'bear | face'
}, {
code: '\u{1F43B}\u{200D}\u{2744}\u{FE0F}',
name: 'polar bear',
keywords: 'arctic | bear | polar bear | white'
}, {
code: '\u{1F428}',
name: 'koala',
keywords: 'bear | koala'
}, {
code: '\u{1F43C}',
name: 'panda',
keywords: 'face | panda'
}, {
code: '\u{1F9A5}',
name: 'sloth',
keywords: 'lazy | sloth | slow'
}, {
code: '\u{1F9A6}',
name: 'otter',
keywords: 'fishing | otter | playful'
}, {
code: '\u{1F9A8}',
name: 'skunk',
keywords: 'skunk | stink'
}, {
code: '\u{1F998}',
name: 'kangaroo',
keywords: 'Australia | joey | jump | kangaroo | marsupial'
}, {
code: '\u{1F9A1}',
name: 'badger',
keywords: 'badger | honey badger | pester'
}, {
code: '\u{1F43E}',
name: 'paw prints',
keywords: 'feet | paw | paw prints | print'
}, {
code: '\u{1F983}',
name: 'turkey',
keywords: 'bird | turkey'
}, {
code: '\u{1F414}',
name: 'chicken',
keywords: 'bird | chicken'
}, {
code: '\u{1F413}',
name: 'rooster',
keywords: 'bird | rooster'
}, {
code: '\u{1F423}',
name: 'hatching chick',
keywords: 'baby | bird | chick | hatching'
}, {
code: '\u{1F424}',
name: 'baby chick',
keywords: 'baby | bird | chick'
}, {
code: '\u{1F425}',
name: 'front-facing baby chick',
keywords: 'baby | bird | chick | front-facing baby chick'
}, {
code: '\u{1F426}',
name: 'bird',
keywords: 'bird'
}, {
code: '\u{1F427}',
name: 'penguin',
keywords: 'bird | penguin'
}, {
code: '\u{1F54A}',
name: 'dove',
keywords: 'bird | dove | fly | peace'
}, {
code: '\u{1F985}',
name: 'eagle',
keywords: 'bird | eagle'
}, {
code: '\u{1F986}',
name: 'duck',
keywords: 'bird | duck'
}, {
code: '\u{1F9A2}',
name: 'swan',
keywords: 'bird | cygnet | swan | ugly duckling'
}, {
code: '\u{1F989}',
name: 'owl',
keywords: 'bird | owl | wise'
}, {
code: '\u{1F9A4}',
name: 'dodo',
keywords: 'dodo | extinction | large | Mauritius'
}, {
code: '\u{1FAB6}',
name: 'feather',
keywords: 'bird | feather | flight | light | plumage'
}, {
code: '\u{1F9A9}',
name: 'flamingo',
keywords: 'flamboyant | flamingo | tropical'
}, {
code: '\u{1F99A}',
name: 'peacock',
keywords: 'bird | ostentatious | peacock | peahen | proud'
}, {
code: '\u{1F99C}',
name: 'parrot',
keywords: 'bird | parrot | pirate | talk'
}, {
code: '\u{1F438}',
name: 'frog',
keywords: 'face | frog'
}, {
code: '\u{1F40A}',
name: 'crocodile',
keywords: 'crocodile'
}, {
code: '\u{1F422}',
name: 'turtle',
keywords: 'terrapin | tortoise | turtle'
}, {
code: '\u{1F98E}',
name: 'lizard',
keywords: 'lizard | reptile'
}, {
code: '\u{1F40D}',
name: 'snake',
keywords: 'bearer | Ophiuchus | serpent | snake | zodiac'
}, {
code: '\u{1F432}',
name: 'dragon face',
keywords: 'dragon | face | fairy tale'
}, {
code: '\u{1F409}',
name: 'dragon',
keywords: 'dragon | fairy tale'
}, {
code: '\u{1F995}',
name: 'sauropod',
keywords: 'brachiosaurus | brontosaurus | diplodocus | sauropod'
}, {
code: '\u{1F996}',
name: 'T-Rex',
keywords: 'T-Rex | Tyrannosaurus Rex'
}, {
code: '\u{1F433}',
name: 'spouting whale',
keywords: 'face | spouting | whale'
}, {
code: '\u{1F40B}',
name: 'whale',
keywords: 'whale'
}, {
code: '\u{1F42C}',
name: 'dolphin',
keywords: 'dolphin | flipper'
}, {
code: '\u{1F9AD}',
name: 'seal',
keywords: 'sea Lion | seal'
}, {
code: '\u{1F41F}',
name: 'fish',
keywords: 'fish | Pisces | zodiac'
}, {
code: '\u{1F420}',
name: 'tropical fish',
keywords: 'fish | tropical'
}, {
code: '\u{1F421}',
name: 'blowfish',
keywords: 'blowfish | fish'
}, {
code: '\u{1F988}',
name: 'shark',
keywords: 'fish | shark'
}, {
code: '\u{1F419}',
name: 'octopus',
keywords: 'octopus'
}, {
code: '\u{1F41A}',
name: 'spiral shell',
keywords: 'shell | spiral'
}, {
code: '\u{1F40C}',
name: 'snail',
keywords: 'snail'
}, {
code: '\u{1F98B}',
name: 'butterfly',
keywords: 'butterfly | insect | pretty'
}, {
code: '\u{1F41B}',
name: 'bug',
keywords: 'bug | insect'
}, {
code: '\u{1F41C}',
name: 'ant',
keywords: 'ant | insect'
}, {
code: '\u{1F41D}',
name: 'honeybee',
keywords: 'bee | honeybee | insect'
}, {
code: '\u{1FAB2}',
name: 'beetle',
keywords: 'beetle | bug | insect'
}, {
code: '\u{1F41E}',
name: 'lady beetle',
keywords: 'beetle | insect | lady beetle | ladybird | ladybug'
}, {
code: '\u{1F997}',
name: 'cricket',
keywords: 'cricket | grasshopper | Orthoptera'
}, {
code: '\u{1FAB3}',
name: 'cockroach',
keywords: 'cockroach | insect | pest | roach'
}, {
code: '\u{1F577}',
name: 'spider',
keywords: 'insect | spider'
}, {
code: '\u{1F578}',
name: 'spider web',
keywords: 'spider | web'
}, {
code: '\u{1F982}',
name: 'scorpion',
keywords: 'scorpio | Scorpio | scorpion | zodiac'
}, {
code: '\u{1F99F}',
name: 'mosquito',
keywords: 'disease | fever | malaria | mosquito | pest | virus'
}, {
code: '\u{1FAB0}',
name: 'fly',
keywords: 'disease | fly | maggot | pest | rotting'
}, {
code: '\u{1FAB1}',
name: 'worm',
keywords: 'annelid | earthworm | parasite | worm'
}, {
code: '\u{1F9A0}',
name: 'microbe',
keywords: 'amoeba | bacteria | microbe | virus'
}, {
code: '\u{1F490}',
name: 'bouquet',
keywords: 'bouquet | flower'
}, {
code: '\u{1F338}',
name: 'cherry blossom',
keywords: 'blossom | cherry | flower'
}, {
code: '\u{1F4AE}',
name: 'white flower',
keywords: 'flower | white flower'
}, {
code: '\u{1F3F5}',
name: 'rosette',
keywords: 'plant | rosette'
}, {
code: '\u{1F339}',
name: 'rose',
keywords: 'flower | rose'
}, {
code: '\u{1F940}',
name: 'wilted flower',
keywords: 'flower | wilted'
}, {
code: '\u{1F33A}',
name: 'hibiscus',
keywords: 'flower | hibiscus'
}, {
code: '\u{1F33B}',
name: 'sunflower',
keywords: 'flower | sun | sunflower'
}, {
code: '\u{1F33C}',
name: 'blossom',
keywords: 'blossom | flower'
}, {
code: '\u{1F337}',
name: 'tulip',
keywords: 'flower | tulip'
}, {
code: '\u{1F331}',
name: 'seedling',
keywords: 'seedling | young'
}, {
code: '\u{1FAB4}',
name: 'potted plant',
keywords: 'boring | grow | house | nurturing | plant | potted plant | useless'
}, {
code: '\u{1F332}',
name: 'evergreen tree',
keywords: 'evergreen tree | tree'
}, {
code: '\u{1F333}',
name: 'deciduous tree',
keywords: 'deciduous | shedding | tree'
}, {
code: '\u{1F334}',
name: 'palm tree',
keywords: 'palm | tree'
}, {
code: '\u{1F335}',
name: 'cactus',
keywords: 'cactus | plant'
}, {
code: '\u{1F33E}',
name: 'sheaf of rice',
keywords: 'ear | grain | rice | sheaf of rice'
}, {
code: '\u{1F33F}',
name: 'herb',
keywords: 'herb | leaf'
}, {
code: '\u{2618}',
name: 'shamrock',
keywords: 'plant | shamrock'
}, {
code: '\u{1F340}',
name: 'four leaf clover',
keywords: '4 | clover | four | four-leaf clover | leaf'
}, {
code: '\u{1F341}',
name: 'maple leaf',
keywords: 'falling | leaf | maple'
}, {
code: '\u{1F342}',
name: 'fallen leaf',
keywords: 'fallen leaf | falling | leaf'
}, {
code: '\u{1F343}',
name: 'leaf fluttering in wind',
keywords: 'blow | flutter | leaf | leaf fluttering in wind | wind'
}, {
code: '\u{1F347}',
name: 'grapes',
keywords: 'fruit | grape | grapes'
}, {
code: '\u{1F348}',
name: 'melon',
keywords: 'fruit | melon'
}, {
code: '\u{1F349}',
name: 'watermelon',
keywords: 'fruit | watermelon'
}, {
code: '\u{1F34A}',
name: 'tangerine',
keywords: 'fruit | orange | tangerine'
}, {
code: '\u{1F34B}',
name: 'lemon',
keywords: 'citrus | fruit | lemon'
}, {
code: '\u{1F34C}',
name: 'banana',
keywords: 'banana | fruit'
}, {
code: '\u{1F34D}',
name: 'pineapple',
keywords: 'fruit | pineapple'
}, {
code: '\u{1F96D}',
name: 'mango',
keywords: 'fruit | mango | tropical'
}, {
code: '\u{1F34E}',
name: 'red apple',
keywords: 'apple | fruit | red'
}, {
code: '\u{1F34F}',
name: 'green apple',
keywords: 'apple | fruit | green'
}, {
code: '\u{1F350}',
name: 'pear',
keywords: 'fruit | pear'
}, {
code: '\u{1F351}',
name: 'peach',
keywords: 'fruit | peach'
}, {
code: '\u{1F352}',
name: 'cherries',
keywords: 'berries | cherries | cherry | fruit | red'
}, {
code: '\u{1F353}',
name: 'strawberry',
keywords: 'berry | fruit | strawberry'
}, {
code: '\u{1FAD0}',
name: 'blueberries',
keywords: 'berry | bilberry | blue | blueberries | blueberry'
}, {
code: '\u{1F95D}',
name: 'kiwi fruit',
keywords: 'food | fruit | kiwi'
}, {
code: '\u{1F345}',
name: 'tomato',
keywords: 'fruit | tomato | vegetable'
}, {
code: '\u{1FAD2}',
name: 'olive',
keywords: 'food | olive'
}, {
code: '\u{1F965}',
name: 'coconut',
keywords: 'coconut | palm | piña colada'
}, {
code: '\u{1F951}',
name: 'avocado',
keywords: 'avocado | food | fruit'
}, {
code: '\u{1F346}',
name: 'eggplant',
keywords: 'aubergine | eggplant | vegetable'
}, {
code: '\u{1F954}',
name: 'potato',
keywords: 'food | potato | vegetable'
}, {
code: '\u{1F955}',
name: 'carrot',
keywords: 'carrot | food | vegetable'
}, {
code: '\u{1F33D}',
name: 'ear of corn',
keywords: 'corn | ear | ear of corn | maize | maze'
}, {
code: '\u{1F336}',
name: 'hot pepper',
keywords: 'hot | pepper'
}, {
code: '\u{1FAD1}',
name: 'bell pepper',
keywords: 'bell pepper | capsicum | pepper | vegetable'
}, {
code: '\u{1F952}',
name: 'cucumber',
keywords: 'cucumber | food | pickle | vegetable'
}, {
code: '\u{1F96C}',
name: 'leafy green',
keywords: 'bok choy | cabbage | kale | leafy green | lettuce'
}, {
code: '\u{1F966}',
name: 'broccoli',
keywords: 'broccoli | wild cabbage'
}, {
code: '\u{1F9C4}',
name: 'garlic',
keywords: 'flavoring | garlic'
}, {
code: '\u{1F9C5}',
name: 'onion',
keywords: 'flavoring | onion'
}, {
code: '\u{1F344}',
name: 'mushroom',
keywords: 'mushroom | toadstool'
}, {
code: '\u{1F95C}',
name: 'peanuts',
keywords: 'food | nut | peanut | peanuts | vegetable'
}, {
code: '\u{1F330}',
name: 'chestnut',
keywords: 'chestnut | plant'
}, {
code: '\u{1F35E}',
name: 'bread',
keywords: 'bread | loaf'
}, {
code: '\u{1F950}',
name: 'croissant',
keywords: 'bread | breakfast | croissant | food | french | roll'
}, {
code: '\u{1F956}',
name: 'baguette bread',
keywords: 'baguette | bread | food | french'
}, {
code: '\u{1FAD3}',
name: 'flatbread',
keywords: 'arepa | flatbread | lavash | naan | pita'
}, {
code: '\u{1F968}',
name: 'pretzel',
keywords: 'pretzel | twisted | convoluted'
}, {
code: '\u{1F96F}',
name: 'bagel',
keywords: 'bagel | bakery | breakfast | schmear'
}, {
code: '\u{1F95E}',
name: 'pancakes',
keywords: 'breakfast | crêpe | food | hotcake | pancake | pancakes'
}, {
code: '\u{1F9C7}',
name: 'waffle',
keywords: 'breakfast | indecisive | iron | waffle'
}, {
code: '\u{1F9C0}',
name: 'cheese wedge',
keywords: 'cheese | cheese wedge'
}, {
code: '\u{1F356}',
name: 'meat on bone',
keywords: 'bone | meat | meat on bone'
}, {
code: '\u{1F357}',
name: 'poultry leg',
keywords: 'bone | chicken | drumstick | leg | poultry'
}, {
code: '\u{1F969}',
name: 'cut of meat',
keywords: 'chop | cut of meat | lambchop | porkchop | steak'
}, {
code: '\u{1F953}',
name: 'bacon',
keywords: 'bacon | breakfast | food | meat'
}, {
code: '\u{1F354}',
name: 'hamburger',
keywords: 'burger | hamburger'
}, {
code: '\u{1F35F}',
name: 'french fries',
keywords: 'french | fries'
}, {
code: '\u{1F355}',
name: 'pizza',
keywords: 'cheese | pizza | slice'
}, {
code: '\u{1F32D}',
name: 'hot dog',
keywords: 'frankfurter | hot dog | hotdog | sausage'
}, {
code: '\u{1F96A}',
name: 'sandwich',
keywords: 'bread | sandwich'
}, {
code: '\u{1F32E}',
name: 'taco',
keywords: 'mexican | taco'
}, {
code: '\u{1F32F}',
name: 'burrito',
keywords: 'burrito | mexican | wrap'
}, {
code: '\u{1FAD4}',
name: 'tamale',
keywords: 'mexican | tamale | wrapped'
}, {
code: '\u{1F959}',
name: 'stuffed flatbread',
keywords: 'falafel | flatbread | food | gyro | kebab | stuffed'
}, {
code: '\u{1F9C6}',
name: 'falafel',
keywords: 'chickpea | falafel | meatball'
}, {
code: '\u{1F95A}',
name: 'egg',
keywords: 'breakfast | egg | food'
}, {
code: '\u{1F373}',
name: 'cooking',
keywords: 'breakfast | cooking | egg | frying | pan'
}, {
code: '\u{1F958}',
name: 'shallow pan of food',
keywords: 'casserole | food | paella | pan | shallow | shallow pan of food'
}, {
code: '\u{1F372}',
name: 'pot of food',
keywords: 'pot | pot of food | stew'
}, {
code: '\u{1FAD5}',
name: 'fondue',
keywords: 'cheese | chocolate | fondue | melted | pot | Swiss'
}, {
code: '\u{1F963}',
name: 'bowl with spoon',
keywords: 'bowl with spoon | breakfast | cereal | congee | oatmeal | porridge'
}, {
code: '\u{1F957}',
name: 'green salad',
keywords: 'food | green | salad'
}, {
code: '\u{1F37F}',
name: 'popcorn',
keywords: 'popcorn'
}, {
code: '\u{1F9C8}',
name: 'butter',
keywords: 'butter | dairy'
}, {
code: '\u{1F9C2}',
name: 'salt',
keywords: 'condiment | salt | shaker'
}, {
code: '\u{1F96B}',
name: 'canned food',
keywords: 'can | canned food'
}, {
code: '\u{1F371}',
name: 'bento box',
keywords: 'bento | box'
}, {
code: '\u{1F358}',
name: 'rice cracker',
keywords: 'cracker | rice'
}, {
code: '\u{1F359}',
name: 'rice ball',
keywords: 'ball | Japanese | rice'
}, {
code: '\u{1F35A}',
name: 'cooked rice',
keywords: 'cooked | rice'
}, {
code: '\u{1F35B}',
name: 'curry rice',
keywords: 'curry | rice'
}, {
code: '\u{1F35C}',
name: 'steaming bowl',
keywords: 'bowl | noodle | ramen | steaming'
}, {
code: '\u{1F35D}',
name: 'spaghetti',
keywords: 'pasta | spaghetti'
}, {
code: '\u{1F360}',
name: 'roasted sweet potato',
keywords: 'potato | roasted | sweet'
}, {
code: '\u{1F362}',
name: 'oden',
keywords: 'kebab | oden | seafood | skewer | stick'
}, {
code: '\u{1F363}',
name: 'sushi',
keywords: 'sushi'
}, {
code: '\u{1F364}',
name: 'fried shrimp',
keywords: 'fried | prawn | shrimp | tempura'
}, {
code: '\u{1F365}',
name: 'fish cake with swirl',
keywords: 'cake | fish | fish cake with swirl | pastry | swirl'
}, {
code: '\u{1F96E}',
name: 'moon cake',
keywords: 'autumn | festival | moon cake | yuèbǐng'
}, {
code: '\u{1F361}',
name: 'dango',
keywords: 'dango | dessert | Japanese | skewer | stick | sweet'
}, {
code: '\u{1F95F}',
name: 'dumpling',
keywords: 'dumpling | empanada | gyōza | jiaozi | pierogi | potsticker'
}, {
code: '\u{1F960}',
name: 'fortune cookie',
keywords: 'fortune cookie | prophecy'
}, {
code: '\u{1F961}',
name: 'takeout box',
keywords: 'oyster pail | takeout box'
}, {
code: '\u{1F980}',
name: 'crab',
keywords: 'Cancer | crab | zodiac'
}, {
code: '\u{1F99E}',
name: 'lobster',
keywords: 'bisque | claws | lobster | seafood'
}, {
code: '\u{1F990}',
name: 'shrimp',
keywords: 'food | shellfish | shrimp | small'
}, {
code: '\u{1F991}',
name: 'squid',
keywords: 'food | molusc | squid'
}, {
code: '\u{1F9AA}',
name: 'oyster',
keywords: 'diving | oyster | pearl'
}, {
code: '\u{1F366}',
name: 'soft ice cream',
keywords: 'cream | dessert | ice | icecream | soft | sweet'
}, {
code: '\u{1F367}',
name: 'shaved ice',
keywords: 'dessert | ice | shaved | sweet'
}, {
code: '\u{1F368}',
name: 'ice cream',
keywords: 'cream | dessert | ice | sweet'
}, {
code: '\u{1F369}',
name: 'doughnut',
keywords: 'breakfast | dessert | donut | doughnut | sweet'
}, {
code: '\u{1F36A}',
name: 'cookie',
keywords: 'cookie | dessert | sweet'
}, {
code: '\u{1F382}',
name: 'birthday cake',
keywords: 'birthday | cake | celebration | dessert | pastry | sweet'
}, {
code: '\u{1F370}',
name: 'shortcake',
keywords: 'cake | dessert | pastry | shortcake | slice | sweet'
}, {
code: '\u{1F9C1}',
name: 'cupcake',
keywords: 'bakery | cupcake | sweet'
}, {
code: '\u{1F967}',
name: 'pie',
keywords: 'filling | pastry | pie | fruit | meat'
}, {
code: '\u{1F36B}',
name: 'chocolate bar',
keywords: 'bar | chocolate | dessert | sweet'
}, {
code: '\u{1F36C}',
name: 'candy',
keywords: 'candy | dessert | sweet'
}, {
code: '\u{1F36D}',
name: 'lollipop',
keywords: 'candy | dessert | lollipop | sweet'
}, {
code: '\u{1F36E}',
name: 'custard',
keywords: 'custard | dessert | pudding | sweet'
}, {
code: '\u{1F36F}',
name: 'honey pot',
keywords: 'honey | honeypot | pot | sweet'
}, {
code: '\u{1F37C}',
name: 'baby bottle',
keywords: 'baby | bottle | drink | milk'
}, {
code: '\u{1F95B}',
name: 'glass of milk',
keywords: 'drink | glass | glass of milk | milk'
}, {
code: '\u{2615}',
name: 'hot beverage',
keywords: 'beverage | coffee | drink | hot | steaming | tea'
}, {
code: '\u{1FAD6}',
name: 'teapot',
keywords: 'drink | pot | tea | teapot'
}, {
code: '\u{1F375}',
name: 'teacup without handle',
keywords: 'beverage | cup | drink | tea | teacup | teacup without handle'
}, {
code: '\u{1F376}',
name: 'sake',
keywords: 'bar | beverage | bottle | cup | drink | sake'
}, {
code: '\u{1F37E}',
name: 'bottle with popping cork',
keywords: 'bar | bottle | bottle with popping cork | cork | drink | popping'
}, {
code: '\u{1F377}',
name: 'wine glass',
keywords: 'bar | beverage | drink | glass | wine'
}, {
code: '\u{1F378}',
name: 'cocktail glass',
keywords: 'bar | cocktail | drink | glass'
}, {
code: '\u{1F379}',
name: 'tropical drink',
keywords: 'bar | drink | tropical'
}, {
code: '\u{1F37A}',
name: 'beer mug',
keywords: 'bar | beer | drink | mug'
}, {
code: '\u{1F37B}',
name: 'clinking beer mugs',
keywords: 'bar | beer | clink | clinking beer mugs | drink | mug'
}, {
code: '\u{1F942}',
name: 'clinking glasses',
keywords: 'celebrate | clink | clinking glasses | drink | glass'
}, {
code: '\u{1F943}',
name: 'tumbler glass',
keywords: 'glass | liquor | shot | tumbler | whisky'
}, {
code: '\u{1F964}',
name: 'cup with straw',
keywords: 'cup with straw | juice | soda | malt | soft drink | water'
}, {
code: '\u{1F9CB}',
name: 'bubble tea',
keywords: 'bubble | milk | pearl | tea'
}, {
code: '\u{1F9C3}',
name: 'beverage box',
keywords: 'beverage | box | juice | straw | sweet'
}, {
code: '\u{1F9C9}',
name: 'mate',
keywords: 'drink | mate'
}, {
code: '\u{1F9CA}',
name: 'ice',
keywords: 'cold | ice | ice cube | iceberg'
}, {
code: '\u{1F962}',
name: 'chopsticks',
keywords: 'chopsticks | hashi | jeotgarak | kuaizi'
}, {
code: '\u{1F37D}',
name: 'fork and knife with plate',
keywords: 'cooking | fork | fork and knife with plate | knife | plate'
}, {
code: '\u{1F374}',
name: 'fork and knife',
keywords: 'cooking | cutlery | fork | fork and knife | knife'
}, {
code: '\u{1F944}',
name: 'spoon',
keywords: 'spoon | tableware'
}, {
code: '\u{1F52A}',
name: 'kitchen knife',
keywords: 'cooking | hocho | kitchen knife | knife | tool | weapon'
}, {
code: '\u{1F3FA}',
name: 'amphora',
keywords: 'amphora | Aquarius | cooking | drink | jug | zodiac'
}, {
code: '\u{1F30D}',
name: 'globe showing Europe-Africa',
keywords: 'Africa | earth | Europe | globe | globe showing Europe-Africa | world'
}, {
code: '\u{1F30E}',
name: 'globe showing Americas',
keywords: 'Americas | earth | globe | globe showing Americas | world'
}, {
code: '\u{1F30F}',
name: 'globe showing Asia-Australia',
keywords: 'Asia | Australia | earth | globe | globe showing Asia-Australia | world'
}, {
code: '\u{1F310}',
name: 'globe with meridians',
keywords: 'earth | globe | globe with meridians | meridians | world'
}, {
code: '\u{1F5FA}',
name: 'world map',
keywords: 'map | world'
}, {
code: '\u{1F5FE}',
name: 'map of Japan',
keywords: 'Japan | map | map of Japan'
}, {
code: '\u{1F9ED}',
name: 'compass',
keywords: 'compass | magnetic | navigation | orienteering'
}, {
code: '\u{1F3D4}',
name: 'snow-capped mountain',
keywords: 'cold | mountain | snow | snow-capped mountain'
}, {
code: '\u{26F0}',
name: 'mountain',
keywords: 'mountain'
}, {
code: '\u{1F30B}',
name: 'volcano',
keywords: 'eruption | mountain | volcano'
}, {
code: '\u{1F5FB}',
name: 'mount fuji',
keywords: 'fuji | mount fuji | mountain'
}, {
code: '\u{1F3D5}',
name: 'camping',
keywords: 'camping'
}, {
code: '\u{1F3D6}',
name: 'beach with umbrella',
keywords: 'beach | beach with umbrella | umbrella'
}, {
code: '\u{1F3DC}',
name: 'desert',
keywords: 'desert'
}, {
code: '\u{1F3DD}',
name: 'desert island',
keywords: 'desert | island'
}, {
code: '\u{1F3DE}',
name: 'national park',
keywords: 'national park | park'
}, {
code: '\u{1F3DF}',
name: 'stadium',
keywords: 'stadium'
}, {
code: '\u{1F3DB}',
name: 'classical building',
keywords: 'classical | classical building'
}, {
code: '\u{1F3D7}',
name: 'building construction',
keywords: 'building construction | construction'
}, {
code: '\u{1F9F1}',
name: 'brick',
keywords: 'brick | bricks | clay | mortar | wall'
}, {
code: '\u{1FAA8}',
name: 'rock',
keywords: 'boulder | heavy | rock | solid | stone'
}, {
code: '\u{1FAB5}',
name: 'wood',
keywords: 'log | lumber | timber | wood'
}, {
code: '\u{1F6D6}',
name: 'hut',
keywords: 'house | hut | roundhouse | yurt'
}, {
code: '\u{1F3D8}',
name: 'houses',
keywords: 'houses'
}, {
code: '\u{1F3DA}',
name: 'derelict house',
keywords: 'derelict | house'
}, {
code: '\u{1F3E0}',
name: 'house',
keywords: 'home | house'
}, {
code: '\u{1F3E1}',
name: 'house with garden',
keywords: 'garden | home | house | house with garden'
}, {
code: '\u{1F3E2}',
name: 'office building',
keywords: 'building | office building'
}, {
code: '\u{1F3E3}',
name: 'Japanese post office',
keywords: 'Japanese | Japanese post office | post'
}, {
code: '\u{1F3E4}',
name: 'post office',
keywords: 'European | post | post office'
}, {
code: '\u{1F3E5}',
name: 'hospital',
keywords: 'doctor | hospital | medicine'
}, {
code: '\u{1F3E6}',
name: 'bank',
keywords: 'bank | building'
}, {
code: '\u{1F3E8}',
name: 'hotel',
keywords: 'building | hotel'
}, {
code: '\u{1F3E9}',
name: 'love hotel',
keywords: 'hotel | love'
}, {
code: '\u{1F3EA}',
name: 'convenience store',
keywords: 'convenience | store'
}, {
code: '\u{1F3EB}',
name: 'school',
keywords: 'building | school'
}, {
code: '\u{1F3EC}',
name: 'department store',
keywords: 'department | store'
}, {
code: '\u{1F3ED}',
name: 'factory',
keywords: 'building | factory'
}, {
code: '\u{1F3EF}',
name: 'Japanese castle',
keywords: 'castle | Japanese'
}, {
code: '\u{1F3F0}',
name: 'castle',
keywords: 'castle | European'
}, {
code: '\u{1F492}',
name: 'wedding',
keywords: 'chapel | romance | wedding'
}, {
code: '\u{1F5FC}',
name: 'Tokyo tower',
keywords: 'Tokyo | tower'
}, {
code: '\u{1F5FD}',
name: 'Statue of Liberty',
keywords: 'liberty | statue | Statue of Liberty'
}, {
code: '\u{26EA}',
name: 'church',
keywords: 'Christian | church | cross | religion'
}, {
code: '\u{1F54C}',
name: 'mosque',
keywords: 'islam | mosque | Muslim | religion'
}, {
code: '\u{1F6D5}',
name: 'hindu temple',
keywords: 'hindu | temple'
}, {
code: '\u{1F54D}',
name: 'synagogue',
keywords: 'Jew | Jewish | religion | synagogue | temple'
}, {
code: '\u{26E9}',
name: 'shinto shrine',
keywords: 'religion | shinto | shrine'
}, {
code: '\u{1F54B}',
name: 'kaaba',
keywords: 'islam | kaaba | Muslim | religion'
}, {
code: '\u{26F2}',
name: 'fountain',
keywords: 'fountain'
}, {
code: '\u{26FA}',
name: 'tent',
keywords: 'camping | tent'
}, {
code: '\u{1F301}',
name: 'foggy',
keywords: 'fog | foggy'
}, {
code: '\u{1F303}',
name: 'night with stars',
keywords: 'night | night with stars | star'
}, {
code: '\u{1F3D9}',
name: 'cityscape',
keywords: 'city | cityscape'
}, {
code: '\u{1F304}',
name: 'sunrise over mountains',
keywords: 'morning | mountain | sun | sunrise | sunrise over mountains'
}, {
code: '\u{1F305}',
name: 'sunrise',
keywords: 'morning | sun | sunrise'
}, {
code: '\u{1F306}',
name: 'cityscape at dusk',
keywords: 'city | cityscape at dusk | dusk | evening | landscape | sunset'
}, {
code: '\u{1F307}',
name: 'sunset',
keywords: 'dusk | sun | sunset'
}, {
code: '\u{1F309}',
name: 'bridge at night',
keywords: 'bridge | bridge at night | night'
}, {
code: '\u{2668}',
name: 'hot springs',
keywords: 'hot | hotsprings | springs | steaming'
}, {
code: '\u{1F3A0}',
name: 'carousel horse',
keywords: 'carousel | horse'
}, {
code: '\u{1F3A1}',
name: 'ferris wheel',
keywords: 'amusement park | ferris | wheel'
}, {
code: '\u{1F3A2}',
name: 'roller coaster',
keywords: 'amusement park | coaster | roller'
}, {
code: '\u{1F488}',
name: 'barber pole',
keywords: 'barber | haircut | pole'
}, {
code: '\u{1F3AA}',
name: 'circus tent',
keywords: 'circus | tent'
}, {
code: '\u{1F682}',
name: 'locomotive',
keywords: 'engine | locomotive | railway | steam | train'
}, {
code: '\u{1F683}',
name: 'railway car',
keywords: 'car | electric | railway | train | tram | trolleybus'
}, {
code: '\u{1F684}',
name: 'high-speed train',
keywords: 'high-speed train | railway | shinkansen | speed | train'
}, {
code: '\u{1F685}',
name: 'bullet train',
keywords: 'bullet | railway | shinkansen | speed | train'
}, {
code: '\u{1F686}',
name: 'train',
keywords: 'railway | train'
}, {
code: '\u{1F687}',
name: 'metro',
keywords: 'metro | subway'
}, {
code: '\u{1F688}',
name: 'light rail',
keywords: 'light rail | railway'
}, {
code: '\u{1F689}',
name: 'station',
keywords: 'railway | station | train'
}, {
code: '\u{1F68A}',
name: 'tram',
keywords: 'tram | trolleybus'
}, {
code: '\u{1F69D}',
name: 'monorail',
keywords: 'monorail | vehicle'
}, {
code: '\u{1F69E}',
name: 'mountain railway',
keywords: 'car | mountain | railway'
}, {
code: '\u{1F68B}',
name: 'tram car',
keywords: 'car | tram | trolleybus'
}, {
code: '\u{1F68C}',
name: 'bus',
keywords: 'bus | vehicle'
}, {
code: '\u{1F68D}',
name: 'oncoming bus',
keywords: 'bus | oncoming'
}, {
code: '\u{1F68E}',
name: 'trolleybus',
keywords: 'bus | tram | trolley | trolleybus'
}, {
code: '\u{1F690}',
name: 'minibus',
keywords: 'bus | minibus'
}, {
code: '\u{1F691}',
name: 'ambulance',
keywords: 'ambulance | vehicle'
}, {
code: '\u{1F692}',
name: 'fire engine',
keywords: 'engine | fire | truck'
}, {
code: '\u{1F693}',
name: 'police car',
keywords: 'car | patrol | police'
}, {
code: '\u{1F694}',
name: 'oncoming police car',
keywords: 'car | oncoming | police'
}, {
code: '\u{1F695}',
name: 'taxi',
keywords: 'taxi | vehicle'
}, {
code: '\u{1F696}',
name: 'oncoming taxi',
keywords: 'oncoming | taxi'
}, {
code: '\u{1F697}',
name: 'automobile',
keywords: 'automobile | car'
}, {
code: '\u{1F698}',
name: 'oncoming automobile',
keywords: 'automobile | car | oncoming'
}, {
code: '\u{1F699}',
name: 'sport utility vehicle',
keywords: 'recreational | sport utility | sport utility vehicle'
}, {
code: '\u{1F6FB}',
name: 'pickup truck',
keywords: 'pick-up | pickup | truck'
}, {
code: '\u{1F69A}',
name: 'delivery truck',
keywords: 'delivery | truck'
}, {
code: '\u{1F69B}',
name: 'articulated lorry',
keywords: 'articulated lorry | lorry | semi | truck'
}, {
code: '\u{1F69C}',
name: 'tractor',
keywords: 'tractor | vehicle'
}, {
code: '\u{1F3CE}',
name: 'racing car',
keywords: 'car | racing'
}, {
code: '\u{1F3CD}',
name: 'motorcycle',
keywords: 'motorcycle | racing'
}, {
code: '\u{1F6F5}',
name: 'motor scooter',
keywords: 'motor | scooter'
}, {
code: '\u{1F9BD}',
name: 'manual wheelchair',
keywords: 'accessibility | manual wheelchair'
}, {
code: '\u{1F9BC}',
name: 'motorized wheelchair',
keywords: 'accessibility | motorized wheelchair'
}, {
code: '\u{1F6FA}',
name: 'auto rickshaw',
keywords: 'auto rickshaw | tuk tuk'
}, {
code: '\u{1F6B2}',
name: 'bicycle',
keywords: 'bicycle | bike'
}, {
code: '\u{1F6F4}',
name: 'kick scooter',
keywords: 'kick | scooter'
}, {
code: '\u{1F6F9}',
name: 'skateboard',
keywords: 'board | skateboard'
}, {
code: '\u{1F6FC}',
name: 'roller skate',
keywords: 'roller | skate'
}, {
code: '\u{1F68F}',
name: 'bus stop',
keywords: 'bus | busstop | stop'
}, {
code: '\u{1F6E3}',
name: 'motorway',
keywords: 'highway | motorway | road'
}, {
code: '\u{1F6E4}',
name: 'railway track',
keywords: 'railway | railway track | train'
}, {
code: '\u{1F6E2}',
name: 'oil drum',
keywords: 'drum | oil'
}, {
code: '\u{26FD}',
name: 'fuel pump',
keywords: 'diesel | fuel | fuelpump | gas | pump | station'
}, {
code: '\u{1F6A8}',
name: 'police car light',
keywords: 'beacon | car | light | police | revolving'
}, {
code: '\u{1F6A5}',
name: 'horizontal traffic light',
keywords: 'horizontal traffic light | light | signal | traffic'
}, {
code: '\u{1F6A6}',
name: 'vertical traffic light',
keywords: 'light | signal | traffic | vertical traffic light'
}, {
code: '\u{1F6D1}',
name: 'stop sign',
keywords: 'octagonal | sign | stop'
}, {
code: '\u{1F6A7}',
name: 'construction',
keywords: 'barrier | construction'
}, {
code: '\u{2693}',
name: 'anchor',
keywords: 'anchor | ship | tool'
}, {
code: '\u{26F5}',
name: 'sailboat',
keywords: 'boat | resort | sailboat | sea | yacht'
}, {
code: '\u{1F6F6}',
name: 'canoe',
keywords: 'boat | canoe'
}, {
code: '\u{1F6A4}',
name: 'speedboat',
keywords: 'boat | speedboat'
}, {
code: '\u{1F6F3}',
name: 'passenger ship',
keywords: 'passenger | ship'
}, {
code: '\u{26F4}',
name: 'ferry',
keywords: 'boat | ferry | passenger'
}, {
code: '\u{1F6E5}',
name: 'motor boat',
keywords: 'boat | motor boat | motorboat'
}, {
code: '\u{1F6A2}',
name: 'ship',
keywords: 'boat | passenger | ship'
}, {
code: '\u{2708}',
name: 'airplane',
keywords: 'aeroplane | airplane'
}, {
code: '\u{1F6E9}',
name: 'small airplane',
keywords: 'aeroplane | airplane | small airplane'
}, {
code: '\u{1F6EB}',
name: 'airplane departure',
keywords: 'aeroplane | airplane | check-in | departure | departures'
}, {
code: '\u{1F6EC}',
name: 'airplane arrival',
keywords: 'aeroplane | airplane | airplane arrival | arrivals | arriving | landing'
}, {
code: '\u{1FA82}',
name: 'parachute',
keywords: 'hang-glide | parachute | parasail | skydive'
}, {
code: '\u{1F4BA}',
name: 'seat',
keywords: 'chair | seat'
}, {
code: '\u{1F681}',
name: 'helicopter',
keywords: 'helicopter | vehicle'
}, {
code: '\u{1F69F}',
name: 'suspension railway',
keywords: 'railway | suspension'
}, {
code: '\u{1F6A0}',
name: 'mountain cableway',
keywords: 'cable | gondola | mountain | mountain cableway'
}, {
code: '\u{1F6A1}',
name: 'aerial tramway',
keywords: 'aerial | cable | car | gondola | tramway'
}, {
code: '\u{1F6F0}',
name: 'satellite',
keywords: 'satellite | space'
}, {
code: '\u{1F680}',
name: 'rocket',
keywords: 'rocket | space'
}, {
code: '\u{1F6F8}',
name: 'flying saucer',
keywords: 'flying saucer | UFO'
}, {
code: '\u{1F6CE}',
name: 'bellhop bell',
keywords: 'bell | bellhop | hotel'
}, {
code: '\u{1F9F3}',
name: 'luggage',
keywords: 'luggage | packing | travel'
}, {
code: '\u{231B}',
name: 'hourglass done',
keywords: 'hourglass done | sand | timer'
}, {
code: '\u{23F3}',
name: 'hourglass not done',
keywords: 'hourglass | hourglass not done | sand | timer'
}, {
code: '\u{231A}',
name: 'watch',
keywords: 'clock | watch'
}, {
code: '\u{23F0}',
name: 'alarm clock',
keywords: 'alarm | clock'
}, {
code: '\u{23F1}',
name: 'stopwatch',
keywords: 'clock | stopwatch'
}, {
code: '\u{23F2}',
name: 'timer clock',
keywords: 'clock | timer'
}, {
code: '\u{1F570}',
name: 'mantelpiece clock',
keywords: 'clock | mantelpiece clock'
}, {
code: '\u{1F55B}',
name: 'twelve o’clock',
keywords: '00 | 12 | 12:00 | clock | o’clock | twelve'
}, {
code: '\u{1F567}',
name: 'twelve-thirty',
keywords: '12 | 12:30 | clock | thirty | twelve | twelve-thirty'
}, {
code: '\u{1F550}',
name: 'one o’clock',
keywords: '00 | 1 | 1:00 | clock | o’clock | one'
}, {
code: '\u{1F55C}',
name: 'one-thirty',
keywords: '1 | 1:30 | clock | one | one-thirty | thirty'
}, {
code: '\u{1F551}',
name: 'two o’clock',
keywords: '00 | 2 | 2:00 | clock | o’clock | two'
}, {
code: '\u{1F55D}',
name: 'two-thirty',
keywords: '2 | 2:30 | clock | thirty | two | two-thirty'
}, {
code: '\u{1F552}',
name: 'three o’clock',
keywords: '00 | 3 | 3:00 | clock | o’clock | three'
}, {
code: '\u{1F55E}',
name: 'three-thirty',
keywords: '3 | 3:30 | clock | thirty | three | three-thirty'
}, {
code: '\u{1F553}',
name: 'four o’clock',
keywords: '00 | 4 | 4:00 | clock | four | o’clock'
}, {
code: '\u{1F55F}',
name: 'four-thirty',
keywords: '4 | 4:30 | clock | four | four-thirty | thirty'
}, {
code: '\u{1F554}',
name: 'five o’clock',
keywords: '00 | 5 | 5:00 | clock | five | o’clock'
}, {
code: '\u{1F560}',
name: 'five-thirty',
keywords: '5 | 5:30 | clock | five | five-thirty | thirty'
}, {
code: '\u{1F555}',
name: 'six o’clock',
keywords: '00 | 6 | 6:00 | clock | o’clock | six'
}, {
code: '\u{1F561}',
name: 'six-thirty',
keywords: '6 | 6:30 | clock | six | six-thirty | thirty'
}, {
code: '\u{1F556}',
name: 'seven o’clock',
keywords: '00 | 7 | 7:00 | clock | o’clock | seven'
}, {
code: '\u{1F562}',
name: 'seven-thirty',
keywords: '7 | 7:30 | clock | seven | seven-thirty | thirty'
}, {
code: '\u{1F557}',
name: 'eight o’clock',
keywords: '00 | 8 | 8:00 | clock | eight | o’clock'
}, {
code: '\u{1F563}',
name: 'eight-thirty',
keywords: '8 | 8:30 | clock | eight | eight-thirty | thirty'
}, {
code: '\u{1F558}',
name: 'nine o’clock',
keywords: '00 | 9 | 9:00 | clock | nine | o’clock'
}, {
code: '\u{1F564}',
name: 'nine-thirty',
keywords: '9 | 9:30 | clock | nine | nine-thirty | thirty'
}, {
code: '\u{1F559}',
name: 'ten o’clock',
keywords: '00 | 10 | 10:00 | clock | o’clock | ten'
}, {
code: '\u{1F565}',
name: 'ten-thirty',
keywords: '10 | 10:30 | clock | ten | ten-thirty | thirty'
}, {
code: '\u{1F55A}',
name: 'eleven o’clock',
keywords: '00 | 11 | 11:00 | clock | eleven | o’clock'
}, {
code: '\u{1F566}',
name: 'eleven-thirty',
keywords: '11 | 11:30 | clock | eleven | eleven-thirty | thirty'
}, {
code: '\u{1F311}',
name: 'new moon',
keywords: 'dark | moon | new moon'
}, {
code: '\u{1F312}',
name: 'waxing crescent moon',
keywords: 'crescent | moon | waxing'
}, {
code: '\u{1F313}',
name: 'first quarter moon',
keywords: 'first quarter moon | moon | quarter'
}, {
code: '\u{1F314}',
name: 'waxing gibbous moon',
keywords: 'gibbous | moon | waxing'
}, {
code: '\u{1F315}',
name: 'full moon',
keywords: 'full | moon'
}, {
code: '\u{1F316}',
name: 'waning gibbous moon',
keywords: 'gibbous | moon | waning'
}, {
code: '\u{1F317}',
name: 'last quarter moon',
keywords: 'last quarter moon | moon | quarter'
}, {
code: '\u{1F318}',
name: 'waning crescent moon',
keywords: 'crescent | moon | waning'
}, {
code: '\u{1F319}',
name: 'crescent moon',
keywords: 'crescent | moon'
}, {
code: '\u{1F31A}',
name: 'new moon face',
keywords: 'face | moon | new moon face'
}, {
code: '\u{1F31B}',
name: 'first quarter moon face',
keywords: 'face | first quarter moon face | moon | quarter'
}, {
code: '\u{1F31C}',
name: 'last quarter moon face',
keywords: 'face | last quarter moon face | moon | quarter'
}, {
code: '\u{1F321}',
name: 'thermometer',
keywords: 'thermometer | weather'
}, {
code: '\u{2600}',
name: 'sun',
keywords: 'bright | rays | sun | sunny'
}, {
code: '\u{1F31D}',
name: 'full moon face',
keywords: 'bright | face | full | moon'
}, {
code: '\u{1F31E}',
name: 'sun with face',
keywords: 'bright | face | sun | sun with face'
}, {
code: '\u{1FA90}',
name: 'ringed planet',
keywords: 'ringed planet | saturn | saturnine'
}, {
code: '\u{2B50}',
name: 'star',
keywords: 'star'
}, {
code: '\u{1F31F}',
name: 'glowing star',
keywords: 'glittery | glow | glowing star | shining | sparkle | star'
}, {
code: '\u{1F320}',
name: 'shooting star',
keywords: 'falling | shooting | star'
}, {
code: '\u{1F30C}',
name: 'milky way',
keywords: 'milky way | space'
}, {
code: '\u{2601}',
name: 'cloud',
keywords: 'cloud | weather'
}, {
code: '\u{26C5}',
name: 'sun behind cloud',
keywords: 'cloud | sun | sun behind cloud'
}, {
code: '\u{26C8}',
name: 'cloud with lightning and rain',
keywords: 'cloud | cloud with lightning and rain | rain | thunder'
}, {
code: '\u{1F324}',
name: 'sun behind small cloud',
keywords: 'cloud | sun | sun behind small cloud'
}, {
code: '\u{1F325}',
name: 'sun behind large cloud',
keywords: 'cloud | sun | sun behind large cloud'
}, {
code: '\u{1F326}',
name: 'sun behind rain cloud',
keywords: 'cloud | rain | sun | sun behind rain cloud'
}, {
code: '\u{1F327}',
name: 'cloud with rain',
keywords: 'cloud | cloud with rain | rain'
}, {
code: '\u{1F328}',
name: 'cloud with snow',
keywords: 'cloud | cloud with snow | cold | snow'
}, {
code: '\u{1F329}',
name: 'cloud with lightning',
keywords: 'cloud | cloud with lightning | lightning'
}, {
code: '\u{1F32A}',
name: 'tornado',
keywords: 'cloud | tornado | whirlwind'
}, {
code: '\u{1F32B}',
name: 'fog',
keywords: 'cloud | fog'
}, {
code: '\u{1F32C}',
name: 'wind face',
keywords: 'blow | cloud | face | wind'
}, {
code: '\u{1F300}',
name: 'cyclone',
keywords: 'cyclone | dizzy | hurricane | twister | typhoon'
}, {
code: '\u{1F308}',
name: 'rainbow',
keywords: 'rain | rainbow'
}, {
code: '\u{1F302}',
name: 'closed umbrella',
keywords: 'closed umbrella | clothing | rain | umbrella'
}, {
code: '\u{2602}',
name: 'umbrella',
keywords: 'clothing | rain | umbrella'
}, {
code: '\u{2614}',
name: 'umbrella with rain drops',
keywords: 'clothing | drop | rain | umbrella | umbrella with rain drops'
}, {
code: '\u{26F1}',
name: 'umbrella on ground',
keywords: 'rain | sun | umbrella | umbrella on ground'
}, {
code: '\u{26A1}',
name: 'high voltage',
keywords: 'danger | electric | high voltage | lightning | voltage | zap'
}, {
code: '\u{2744}',
name: 'snowflake',
keywords: 'cold | snow | snowflake'
}, {
code: '\u{2603}',
name: 'snowman',
keywords: 'cold | snow | snowman'
}, {
code: '\u{26C4}',
name: 'snowman without snow',
keywords: 'cold | snow | snowman | snowman without snow'
}, {
code: '\u{2604}',
name: 'comet',
keywords: 'comet | space'
}, {
code: '\u{1F525}',
name: 'fire',
keywords: 'fire | flame | tool'
}, {
code: '\u{1F4A7}',
name: 'droplet',
keywords: 'cold | comic | drop | droplet | sweat'
}, {
code: '\u{1F30A}',
name: 'water wave',
keywords: 'ocean | water | wave'
}, {
code: '\u{1F383}',
name: 'jack-o-lantern',
keywords: 'celebration | halloween | jack | jack-o-lantern | lantern'
}, {
code: '\u{1F384}',
name: 'Christmas tree',
keywords: 'celebration | Christmas | tree'
}, {
code: '\u{1F386}',
name: 'fireworks',
keywords: 'celebration | fireworks'
}, {
code: '\u{1F387}',
name: 'sparkler',
keywords: 'celebration | fireworks | sparkle | sparkler'
}, {
code: '\u{1F9E8}',
name: 'firecracker',
keywords: 'dynamite | explosive | firecracker | fireworks'
}, {
code: '\u{2728}',
name: 'sparkles',
keywords: '* | sparkle | sparkles | star'
}, {
code: '\u{1F388}',
name: 'balloon',
keywords: 'balloon | celebration'
}, {
code: '\u{1F389}',
name: 'party popper',
keywords: 'celebration | party | popper | tada'
}, {
code: '\u{1F38A}',
name: 'confetti ball',
keywords: 'ball | celebration | confetti'
}, {
code: '\u{1F38B}',
name: 'tanabata tree',
keywords: 'banner | celebration | Japanese | tanabata tree | tree'
}, {
code: '\u{1F38D}',
name: 'pine decoration',
keywords: 'bamboo | celebration | Japanese | pine | pine decoration'
}, {
code: '\u{1F38E}',
name: 'Japanese dolls',
keywords: 'celebration | doll | festival | Japanese | Japanese dolls'
}, {
code: '\u{1F38F}',
name: 'carp streamer',
keywords: 'carp | celebration | streamer'
}, {
code: '\u{1F390}',
name: 'wind chime',
keywords: 'bell | celebration | chime | wind'
}, {
code: '\u{1F391}',
name: 'moon viewing ceremony',
keywords: 'celebration | ceremony | moon | moon viewing ceremony'
}, {
code: '\u{1F9E7}',
name: 'red envelope',
keywords: 'gift | good luck | hóngbāo | lai see | money | red envelope'
}, {
code: '\u{1F380}',
name: 'ribbon',
keywords: 'celebration | ribbon'
}, {
code: '\u{1F381}',
name: 'wrapped gift',
keywords: 'box | celebration | gift | present | wrapped'
}, {
code: '\u{1F397}',
name: 'reminder ribbon',
keywords: 'celebration | reminder | ribbon'
}, {
code: '\u{1F39F}',
name: 'admission tickets',
keywords: 'admission | admission tickets | ticket'
}, {
code: '\u{1F3AB}',
name: 'ticket',
keywords: 'admission | ticket'
}, {
code: '\u{1F396}',
name: 'military medal',
keywords: 'celebration | medal | military'
}, {
code: '\u{1F3C6}',
name: 'trophy',
keywords: 'prize | trophy'
}, {
code: '\u{1F3C5}',
name: 'sports medal',
keywords: 'medal | sports medal'
}, {
code: '\u{1F947}',
name: '1st place medal',
keywords: '1st place medal | first | gold | medal'
}, {
code: '\u{1F948}',
name: '2nd place medal',
keywords: '2nd place medal | medal | second | silver'
}, {
code: '\u{1F949}',
name: '3rd place medal',
keywords: '3rd place medal | bronze | medal | third'
}, {
code: '\u{26BD}',
name: 'soccer ball',
keywords: 'ball | football | soccer'
}, {
code: '\u{26BE}',
name: 'baseball',
keywords: 'ball | baseball'
}, {
code: '\u{1F94E}',
name: 'softball',
keywords: 'ball | glove | softball | underarm'
}, {
code: '\u{1F3C0}',
name: 'basketball',
keywords: 'ball | basketball | hoop'
}, {
code: '\u{1F3D0}',
name: 'volleyball',
keywords: 'ball | game | volleyball'
}, {
code: '\u{1F3C8}',
name: 'american football',
keywords: 'american | ball | football'
}, {
code: '\u{1F3C9}',
name: 'rugby football',
keywords: 'ball | football | rugby'
}, {
code: '\u{1F3BE}',
name: 'tennis',
keywords: 'ball | racquet | tennis'
}, {
code: '\u{1F94F}',
name: 'flying disc',
keywords: 'flying disc | ultimate'
}, {
code: '\u{1F3B3}',
name: 'bowling',
keywords: 'ball | bowling | game'
}, {
code: '\u{1F3CF}',
name: 'cricket game',
keywords: 'ball | bat | cricket game | game'
}, {
code: '\u{1F3D1}',
name: 'field hockey',
keywords: 'ball | field | game | hockey | stick'
}, {
code: '\u{1F3D2}',
name: 'ice hockey',
keywords: 'game | hockey | ice | puck | stick'
}, {
code: '\u{1F94D}',
name: 'lacrosse',
keywords: 'ball | goal | lacrosse | stick'
}, {
code: '\u{1F3D3}',
name: 'ping pong',
keywords: 'ball | bat | game | paddle | ping pong | table tennis'
}, {
code: '\u{1F3F8}',
name: 'badminton',
keywords: 'badminton | birdie | game | racquet | shuttlecock'
}, {
code: '\u{1F94A}',
name: 'boxing glove',
keywords: 'boxing | glove'
}, {
code: '\u{1F94B}',
name: 'martial arts uniform',
keywords: 'judo | karate | martial arts | martial arts uniform | taekwondo | uniform'
}, {
code: '\u{1F945}',
name: 'goal net',
keywords: 'goal | net'
}, {
code: '\u{26F3}',
name: 'flag in hole',
keywords: 'flag in hole | golf | hole'
}, {
code: '\u{26F8}',
name: 'ice skate',
keywords: 'ice | skate'
}, {
code: '\u{1F3A3}',
name: 'fishing pole',
keywords: 'fish | fishing pole | pole'
}, {
code: '\u{1F93F}',
name: 'diving mask',
keywords: 'diving | diving mask | scuba | snorkeling'
}, {
code: '\u{1F3BD}',
name: 'running shirt',
keywords: 'athletics | running | sash | shirt'
}, {
code: '\u{1F3BF}',
name: 'skis',
keywords: 'ski | skis | snow'
}, {
code: '\u{1F6F7}',
name: 'sled',
keywords: 'sled | sledge | sleigh | luge | toboggan'
}, {
code: '\u{1F94C}',
name: 'curling stone',
keywords: 'curling stone | game | rock'
}, {
code: '\u{1F3AF}',
name: 'bullseye',
keywords: 'bullseye | dart | direct hit | game | hit | target'
}, {
code: '\u{1FA80}',
name: 'yo-yo',
keywords: 'fluctuate | toy | yo-yo'
}, {
code: '\u{1FA81}',
name: 'kite',
keywords: 'fly | kite | soar'
}, {
code: '\u{1F3B1}',
name: 'pool 8 ball',
keywords: '8 | ball | billiard | eight | game | pool 8 ball'
}, {
code: '\u{1F52E}',
name: 'crystal ball',
keywords: 'ball | crystal | fairy tale | fantasy | fortune | tool'
}, {
code: '\u{1FA84}',
name: 'magic wand',
keywords: 'magic | magic wand | witch | wizard'
}, {
code: '\u{1F9FF}',
name: 'nazar amulet',
keywords: 'bead | charm | evil-eye | nazar | nazar amulet | talisman'
}, {
code: '\u{1F3AE}',
name: 'video game',
keywords: 'controller | game | video game'
}, {
code: '\u{1F579}',
name: 'joystick',
keywords: 'game | joystick | video game'
}, {
code: '\u{1F3B0}',
name: 'slot machine',
keywords: 'game | slot | slot machine'
}, {
code: '\u{1F3B2}',
name: 'game die',
keywords: 'dice | die | game'
}, {
code: '\u{1F9E9}',
name: 'puzzle piece',
keywords: 'clue | interlocking | jigsaw | piece | puzzle'
}, {
code: '\u{1F9F8}',
name: 'teddy bear',
keywords: 'plaything | plush | stuffed | teddy bear | toy'
}, {
code: '\u{1FA85}',
name: 'piñata',
keywords: 'celebration | party | piñata'
}, {
code: '\u{1FA86}',
name: 'nesting dolls',
keywords: 'doll | nesting | nesting dolls | russia'
}, {
code: '\u{2660}',
name: 'spade suit',
keywords: 'card | game | spade suit'
}, {
code: '\u{2665}',
name: 'heart suit',
keywords: 'card | game | heart suit'
}, {
code: '\u{2666}',
name: 'diamond suit',
keywords: 'card | diamond suit | game'
}, {
code: '\u{2663}',
name: 'club suit',
keywords: 'card | club suit | game'
}, {
code: '\u{265F}',
name: 'chess pawn',
keywords: 'chess | chess pawn | dupe | expendable'
}, {
code: '\u{1F0CF}',
name: 'joker',
keywords: 'card | game | joker | wildcard'
}, {
code: '\u{1F004}',
name: 'mahjong red dragon',
keywords: 'game | mahjong | mahjong red dragon | red'
}, {
code: '\u{1F3B4}',
name: 'flower playing cards',
keywords: 'card | flower | flower playing cards | game | Japanese | playing'
}, {
code: '\u{1F3AD}',
name: 'performing arts',
keywords: 'art | mask | performing | performing arts | theater | theatre'
}, {
code: '\u{1F5BC}',
name: 'framed picture',
keywords: 'art | frame | framed picture | museum | painting | picture'
}, {
code: '\u{1F3A8}',
name: 'artist palette',
keywords: 'art | artist palette | museum | painting | palette'
}, {
code: '\u{1F9F5}',
name: 'thread',
keywords: 'needle | sewing | spool | string | thread'
}, {
code: '\u{1FAA1}',
name: 'sewing needle',
keywords: 'embroidery | needle | sewing | stitches | sutures | tailoring'
}, {
code: '\u{1F9F6}',
name: 'yarn',
keywords: 'ball | crochet | knit | yarn'
}, {
code: '\u{1FAA2}',
name: 'knot',
keywords: 'knot | rope | tangled | tie | twine | twist'
}, {
code: '\u{1F453}',
name: 'glasses',
keywords: 'clothing | eye | eyeglasses | eyewear | glasses'
}, {
code: '\u{1F576}',
name: 'sunglasses',
keywords: 'dark | eye | eyewear | glasses | sunglasses'
}, {
code: '\u{1F97D}',
name: 'goggles',
keywords: 'eye protection | goggles | swimming | welding'
}, {
code: '\u{1F97C}',
name: 'lab coat',
keywords: 'doctor | experiment | lab coat | scientist'
}, {
code: '\u{1F9BA}',
name: 'safety vest',
keywords: 'emergency | safety | vest'
}, {
code: '\u{1F454}',
name: 'necktie',
keywords: 'clothing | necktie | tie'
}, {
code: '\u{1F455}',
name: 't-shirt',
keywords: 'clothing | shirt | t-shirt | tshirt'
}, {
code: '\u{1F456}',
name: 'jeans',
keywords: 'clothing | jeans | pants | trousers'
}, {
code: '\u{1F9E3}',
name: 'scarf',
keywords: 'neck | scarf'
}, {
code: '\u{1F9E4}',
name: 'gloves',
keywords: 'gloves | hand'
}, {
code: '\u{1F9E5}',
name: 'coat',
keywords: 'coat | jacket'
}, {
code: '\u{1F9E6}',
name: 'socks',
keywords: 'socks | stocking'
}, {
code: '\u{1F457}',
name: 'dress',
keywords: 'clothing | dress'
}, {
code: '\u{1F458}',
name: 'kimono',
keywords: 'clothing | kimono'
}, {
code: '\u{1F97B}',
name: 'sari',
keywords: 'clothing | dress | sari'
}, {
code: '\u{1FA71}',
name: 'one-piece swimsuit',
keywords: 'bathing suit | one-piece swimsuit'
}, {
code: '\u{1FA72}',
name: 'briefs',
keywords: 'bathing suit | briefs | one-piece | swimsuit | underwear'
}, {
code: '\u{1FA73}',
name: 'shorts',
keywords: 'bathing suit | pants | shorts | underwear'
}, {
code: '\u{1F459}',
name: 'bikini',
keywords: 'bikini | clothing | swim'
}, {
code: '\u{1F45A}',
name: 'woman’s clothes',
keywords: 'clothing | woman | woman’s clothes'
}, {
code: '\u{1F45B}',
name: 'purse',
keywords: 'clothing | coin | purse'
}, {
code: '\u{1F45C}',
name: 'handbag',
keywords: 'bag | clothing | handbag | purse'
}, {
code: '\u{1F45D}',
name: 'clutch bag',
keywords: 'bag | clothing | clutch bag | pouch'
}, {
code: '\u{1F6CD}',
name: 'shopping bags',
keywords: 'bag | hotel | shopping | shopping bags'
}, {
code: '\u{1F392}',
name: 'backpack',
keywords: 'backpack | bag | rucksack | satchel | school'
}, {
code: '\u{1FA74}',
name: 'thong sandal',
keywords: 'beach sandals | sandals | thong sandal | thong sandals | thongs | zōri'
}, {
code: '\u{1F45E}',
name: 'man’s shoe',
keywords: 'clothing | man | man’s shoe | shoe'
}, {
code: '\u{1F45F}',
name: 'running shoe',
keywords: 'athletic | clothing | running shoe | shoe | sneaker'
}, {
code: '\u{1F97E}',
name: 'hiking boot',
keywords: 'backpacking | boot | camping | hiking'
}, {
code: '\u{1F97F}',
name: 'flat shoe',
keywords: 'ballet flat | flat shoe | slip-on | slipper'
}, {
code: '\u{1F460}',
name: 'high-heeled shoe',
keywords: 'clothing | heel | high-heeled shoe | shoe | woman'
}, {
code: '\u{1F461}',
name: 'woman’s sandal',
keywords: 'clothing | sandal | shoe | woman | woman’s sandal'
}, {
code: '\u{1FA70}',
name: 'ballet shoes',
keywords: 'ballet | ballet shoes | dance'
}, {
code: '\u{1F462}',
name: 'woman’s boot',
keywords: 'boot | clothing | shoe | woman | woman’s boot'
}, {
code: '\u{1F451}',
name: 'crown',
keywords: 'clothing | crown | king | queen'
}, {
code: '\u{1F452}',
name: 'woman’s hat',
keywords: 'clothing | hat | woman | woman’s hat'
}, {
code: '\u{1F3A9}',
name: 'top hat',
keywords: 'clothing | hat | top | tophat'
}, {
code: '\u{1F393}',
name: 'graduation cap',
keywords: 'cap | celebration | clothing | graduation | hat'
}, {
code: '\u{1F9E2}',
name: 'billed cap',
keywords: 'baseball cap | billed cap'
}, {
code: '\u{1FA96}',
name: 'military helmet',
keywords: 'army | helmet | military | soldier | warrior'
}, {
code: '\u{26D1}',
name: 'rescue worker’s helmet',
keywords: 'aid | cross | face | hat | helmet | rescue worker’s helmet'
}, {
code: '\u{1F4FF}',
name: 'prayer beads',
keywords: 'beads | clothing | necklace | prayer | religion'
}, {
code: '\u{1F484}',
name: 'lipstick',
keywords: 'cosmetics | lipstick | makeup'
}, {
code: '\u{1F48D}',
name: 'ring',
keywords: 'diamond | ring'
}, {
code: '\u{1F48E}',
name: 'gem stone',
keywords: 'diamond | gem | gem stone | jewel'
}, {
code: '\u{1F507}',
name: 'muted speaker',
keywords: 'mute | muted speaker | quiet | silent | speaker'
}, {
code: '\u{1F508}',
name: 'speaker low volume',
keywords: 'soft | speaker low volume'
}, {
code: '\u{1F509}',
name: 'speaker medium volume',
keywords: 'medium | speaker medium volume'
}, {
code: '\u{1F50A}',
name: 'speaker high volume',
keywords: 'loud | speaker high volume'
}, {
code: '\u{1F4E2}',
name: 'loudspeaker',
keywords: 'loud | loudspeaker | public address'
}, {
code: '\u{1F4E3}',
name: 'megaphone',
keywords: 'cheering | megaphone'
}, {
code: '\u{1F4EF}',
name: 'postal horn',
keywords: 'horn | post | postal'
}, {
code: '\u{1F514}',
name: 'bell',
keywords: 'bell'
}, {
code: '\u{1F515}',
name: 'bell with slash',
keywords: 'bell | bell with slash | forbidden | mute | quiet | silent'
}, {
code: '\u{1F3BC}',
name: 'musical score',
keywords: 'music | musical score | score'
}, {
code: '\u{1F3B5}',
name: 'musical note',
keywords: 'music | musical note | note'
}, {
code: '\u{1F3B6}',
name: 'musical notes',
keywords: 'music | musical notes | note | notes'
}, {
code: '\u{1F399}',
name: 'studio microphone',
keywords: 'mic | microphone | music | studio'
}, {
code: '\u{1F39A}',
name: 'level slider',
keywords: 'level | music | slider'
}, {
code: '\u{1F39B}',
name: 'control knobs',
keywords: 'control | knobs | music'
}, {
code: '\u{1F3A4}',
name: 'microphone',
keywords: 'karaoke | mic | microphone'
}, {
code: '\u{1F3A7}',
name: 'headphone',
keywords: 'earbud | headphone'
}, {
code: '\u{1F4FB}',
name: 'radio',
keywords: 'radio | video'
}, {
code: '\u{1F3B7}',
name: 'saxophone',
keywords: 'instrument | music | sax | saxophone'
}, {
code: '\u{1FA97}',
name: 'accordion',
keywords: 'accordian | accordion | concertina | squeeze box'
}, {
code: '\u{1F3B8}',
name: 'guitar',
keywords: 'guitar | instrument | music'
}, {
code: '\u{1F3B9}',
name: 'musical keyboard',
keywords: 'instrument | keyboard | music | musical keyboard | piano'
}, {
code: '\u{1F3BA}',
name: 'trumpet',
keywords: 'instrument | music | trumpet'
}, {
code: '\u{1F3BB}',
name: 'violin',
keywords: 'instrument | music | violin'
}, {
code: '\u{1FA95}',
name: 'banjo',
keywords: 'banjo | music | stringed'
}, {
code: '\u{1F941}',
name: 'drum',
keywords: 'drum | drumsticks | music'
}, {
code: '\u{1FA98}',
name: 'long drum',
keywords: 'beat | conga | drum | long drum | rhythm'
}, {
code: '\u{1F4F1}',
name: 'mobile phone',
keywords: 'cell | mobile | phone | telephone'
}, {
code: '\u{1F4F2}',
name: 'mobile phone with arrow',
keywords: 'arrow | cell | mobile | mobile phone with arrow | phone | receive'
}, {
code: '\u{260E}',
name: 'telephone',
keywords: 'phone | telephone'
}, {
code: '\u{1F4DE}',
name: 'telephone receiver',
keywords: 'phone | receiver | telephone'
}, {
code: '\u{1F4DF}',
name: 'pager',
keywords: 'pager'
}, {
code: '\u{1F4E0}',
name: 'fax machine',
keywords: 'fax | fax machine'
}, {
code: '\u{1F50B}',
name: 'battery',
keywords: 'battery'
}, {
code: '\u{1F50C}',
name: 'electric plug',
keywords: 'electric | electricity | plug'
}, {
code: '\u{1F4BB}',
name: 'laptop',
keywords: 'computer | laptop | pc | personal'
}, {
code: '\u{1F5A5}',
name: 'desktop computer',
keywords: 'computer | desktop'
}, {
code: '\u{1F5A8}',
name: 'printer',
keywords: 'computer | printer'
}, {
code: '\u{2328}',
name: 'keyboard',
keywords: 'computer | keyboard'
}, {
code: '\u{1F5B1}',
name: 'computer mouse',
keywords: 'computer | computer mouse'
}, {
code: '\u{1F5B2}',
name: 'trackball',
keywords: 'computer | trackball'
}, {
code: '\u{1F4BD}',
name: 'computer disk',
keywords: 'computer | disk | minidisk | optical'
}, {
code: '\u{1F4BE}',
name: 'floppy disk',
keywords: 'computer | disk | floppy'
}, {
code: '\u{1F4BF}',
name: 'optical disk',
keywords: 'cd | computer | disk | optical'
}, {
code: '\u{1F4C0}',
name: 'dvd',
keywords: 'blu-ray | computer | disk | dvd | optical'
}, {
code: '\u{1F9EE}',
name: 'abacus',
keywords: 'abacus | calculation'
}, {
code: '\u{1F3A5}',
name: 'movie camera',
keywords: 'camera | cinema | movie'
}, {
code: '\u{1F39E}',
name: 'film frames',
keywords: 'cinema | film | frames | movie'
}, {
code: '\u{1F4FD}',
name: 'film projector',
keywords: 'cinema | film | movie | projector | video'
}, {
code: '\u{1F3AC}',
name: 'clapper board',
keywords: 'clapper | clapper board | movie'
}, {
code: '\u{1F4FA}',
name: 'television',
keywords: 'television | tv | video'
}, {
code: '\u{1F4F7}',
name: 'camera',
keywords: 'camera | video'
}, {
code: '\u{1F4F8}',
name: 'camera with flash',
keywords: 'camera | camera with flash | flash | video'
}, {
code: '\u{1F4F9}',
name: 'video camera',
keywords: 'camera | video'
}, {
code: '\u{1F4FC}',
name: 'videocassette',
keywords: 'tape | vhs | video | videocassette'
}, {
code: '\u{1F50D}',
name: 'magnifying glass tilted left',
keywords: 'glass | magnifying | magnifying glass tilted left | search | tool'
}, {
code: '\u{1F50E}',
name: 'magnifying glass tilted right',
keywords: 'glass | magnifying | magnifying glass tilted right | search | tool'
}, {
code: '\u{1F56F}',
name: 'candle',
keywords: 'candle | light'
}, {
code: '\u{1F4A1}',
name: 'light bulb',
keywords: 'bulb | comic | electric | idea | light'
}, {
code: '\u{1F526}',
name: 'flashlight',
keywords: 'electric | flashlight | light | tool | torch'
}, {
code: '\u{1F3EE}',
name: 'red paper lantern',
keywords: 'bar | lantern | light | red | red paper lantern'
}, {
code: '\u{1FA94}',
name: 'diya lamp',
keywords: 'diya | lamp | oil'
}, {
code: '\u{1F4D4}',
name: 'notebook with decorative cover',
keywords: 'book | cover | decorated | notebook | notebook with decorative cover'
}, {
code: '\u{1F4D5}',
name: 'closed book',
keywords: 'book | closed'
}, {
code: '\u{1F4D6}',
name: 'open book',
keywords: 'book | open'
}, {
code: '\u{1F4D7}',
name: 'green book',
keywords: 'book | green'
}, {
code: '\u{1F4D8}',
name: 'blue book',
keywords: 'blue | book'
}, {
code: '\u{1F4D9}',
name: 'orange book',
keywords: 'book | orange'
}, {
code: '\u{1F4DA}',
name: 'books',
keywords: 'book | books'
}, {
code: '\u{1F4D3}',
name: 'notebook',
keywords: 'notebook'
}, {
code: '\u{1F4D2}',
name: 'ledger',
keywords: 'ledger | notebook'
}, {
code: '\u{1F4C3}',
name: 'page with curl',
keywords: 'curl | document | page | page with curl'
}, {
code: '\u{1F4DC}',
name: 'scroll',
keywords: 'paper | scroll'
}, {
code: '\u{1F4C4}',
name: 'page facing up',
keywords: 'document | page | page facing up'
}, {
code: '\u{1F4F0}',
name: 'newspaper',
keywords: 'news | newspaper | paper'
}, {
code: '\u{1F5DE}',
name: 'rolled-up newspaper',
keywords: 'news | newspaper | paper | rolled | rolled-up newspaper'
}, {
code: '\u{1F4D1}',
name: 'bookmark tabs',
keywords: 'bookmark | mark | marker | tabs'
}, {
code: '\u{1F516}',
name: 'bookmark',
keywords: 'bookmark | mark'
}, {
code: '\u{1F3F7}',
name: 'label',
keywords: 'label'
}, {
code: '\u{1F4B0}',
name: 'money bag',
keywords: 'bag | dollar | money | moneybag'
}, {
code: '\u{1FA99}',
name: 'coin',
keywords: 'coin | gold | metal | money | silver | treasure'
}, {
code: '\u{1F4B4}',
name: 'yen banknote',
keywords: 'banknote | bill | currency | money | note | yen'
}, {
code: '\u{1F4B5}',
name: 'dollar banknote',
keywords: 'banknote | bill | currency | dollar | money | note'
}, {
code: '\u{1F4B6}',
name: 'euro banknote',
keywords: 'banknote | bill | currency | euro | money | note'
}, {
code: '\u{1F4B7}',
name: 'pound banknote',
keywords: 'banknote | bill | currency | money | note | pound'
}, {
code: '\u{1F4B8}',
name: 'money with wings',
keywords: 'banknote | bill | fly | money | money with wings | wings'
}, {
code: '\u{1F4B3}',
name: 'credit card',
keywords: 'card | credit | money'
}, {
code: '\u{1F9FE}',
name: 'receipt',
keywords: 'accounting | bookkeeping | evidence | proof | receipt'
}, {
code: '\u{1F4B9}',
name: 'chart increasing with yen',
keywords: 'chart | chart increasing with yen | graph | growth | money | yen'
}, {
code: '\u{2709}',
name: 'envelope',
keywords: 'email | envelope | letter'
}, {
code: '\u{1F4E7}',
name: 'e-mail',
keywords: 'e-mail | email | letter | mail'
}, {
code: '\u{1F4E8}',
name: 'incoming envelope',
keywords: 'e-mail | email | envelope | incoming | letter | receive'
}, {
code: '\u{1F4E9}',
name: 'envelope with arrow',
keywords: 'arrow | e-mail | email | envelope | envelope with arrow | outgoing'
}, {
code: '\u{1F4E4}',
name: 'outbox tray',
keywords: 'box | letter | mail | outbox | sent | tray'
}, {
code: '\u{1F4E5}',
name: 'inbox tray',
keywords: 'box | inbox | letter | mail | receive | tray'
}, {
code: '\u{1F4E6}',
name: 'package',
keywords: 'box | package | parcel'
}, {
code: '\u{1F4EB}',
name: 'closed mailbox with raised flag',
keywords: 'closed | closed mailbox with raised flag | mail | mailbox | postbox'
}, {
code: '\u{1F4EA}',
name: 'closed mailbox with lowered flag',
keywords: 'closed | closed mailbox with lowered flag | lowered | mail | mailbox | postbox'
}, {
code: '\u{1F4EC}',
name: 'open mailbox with raised flag',
keywords: 'mail | mailbox | open | open mailbox with raised flag | postbox'
}, {
code: '\u{1F4ED}',
name: 'open mailbox with lowered flag',
keywords: 'lowered | mail | mailbox | open | open mailbox with lowered flag | postbox'
}, {
code: '\u{1F4EE}',
name: 'postbox',
keywords: 'mail | mailbox | postbox'
}, {
code: '\u{1F5F3}',
name: 'ballot box with ballot',
keywords: 'ballot | ballot box with ballot | box'
}, {
code: '\u{270F}',
name: 'pencil',
keywords: 'pencil'
}, {
code: '\u{2712}',
name: 'black nib',
keywords: 'black nib | nib | pen'
}, {
code: '\u{1F58B}',
name: 'fountain pen',
keywords: 'fountain | pen'
}, {
code: '\u{1F58A}',
name: 'pen',
keywords: 'ballpoint | pen'
}, {
code: '\u{1F58C}',
name: 'paintbrush',
keywords: 'paintbrush | painting'
}, {
code: '\u{1F58D}',
name: 'crayon',
keywords: 'crayon'
}, {
code: '\u{1F4DD}',
name: 'memo',
keywords: 'memo | pencil'
}, {
code: '\u{1F4BC}',
name: 'briefcase',
keywords: 'briefcase'
}, {
code: '\u{1F4C1}',
name: 'file folder',
keywords: 'file | folder'
}, {
code: '\u{1F4C2}',
name: 'open file folder',
keywords: 'file | folder | open'
}, {
code: '\u{1F5C2}',
name: 'card index dividers',
keywords: 'card | dividers | index'
}, {
code: '\u{1F4C5}',
name: 'calendar',
keywords: 'calendar | date'
}, {
code: '\u{1F4C6}',
name: 'tear-off calendar',
keywords: 'calendar | tear-off calendar'
}, {
code: '\u{1F5D2}',
name: 'spiral notepad',
keywords: 'note | pad | spiral | spiral notepad'
}, {
code: '\u{1F5D3}',
name: 'spiral calendar',
keywords: 'calendar | pad | spiral'
}, {
code: '\u{1F4C7}',
name: 'card index',
keywords: 'card | index | rolodex'
}, {
code: '\u{1F4C8}',
name: 'chart increasing',
keywords: 'chart | chart increasing | graph | growth | trend | upward'
}, {
code: '\u{1F4C9}',
name: 'chart decreasing',
keywords: 'chart | chart decreasing | down | graph | trend'
}, {
code: '\u{1F4CA}',
name: 'bar chart',
keywords: 'bar | chart | graph'
}, {
code: '\u{1F4CB}',
name: 'clipboard',
keywords: 'clipboard'
}, {
code: '\u{1F4CC}',
name: 'pushpin',
keywords: 'pin | pushpin'
}, {
code: '\u{1F4CD}',
name: 'round pushpin',
keywords: 'pin | pushpin | round pushpin'
}, {
code: '\u{1F4CE}',
name: 'paperclip',
keywords: 'paperclip'
}, {
code: '\u{1F587}',
name: 'linked paperclips',
keywords: 'link | linked paperclips | paperclip'
}, {
code: '\u{1F4CF}',
name: 'straight ruler',
keywords: 'ruler | straight edge | straight ruler'
}, {
code: '\u{1F4D0}',
name: 'triangular ruler',
keywords: 'ruler | set | triangle | triangular ruler'
}, {
code: '\u{2702}',
name: 'scissors',
keywords: 'cutting | scissors | tool'
}, {
code: '\u{1F5C3}',
name: 'card file box',
keywords: 'box | card | file'
}, {
code: '\u{1F5C4}',
name: 'file cabinet',
keywords: 'cabinet | file | filing'
}, {
code: '\u{1F5D1}',
name: 'wastebasket',
keywords: 'wastebasket'
}, {
code: '\u{1F512}',
name: 'locked',
keywords: 'closed | locked'
}, {
code: '\u{1F513}',
name: 'unlocked',
keywords: 'lock | open | unlock | unlocked'
}, {
code: '\u{1F50F}',
name: 'locked with pen',
keywords: 'ink | lock | locked with pen | nib | pen | privacy'
}, {
code: '\u{1F510}',
name: 'locked with key',
keywords: 'closed | key | lock | locked with key | secure'
}, {
code: '\u{1F511}',
name: 'key',
keywords: 'key | lock | password'
}, {
code: '\u{1F5DD}',
name: 'old key',
keywords: 'clue | key | lock | old'
}, {
code: '\u{1F528}',
name: 'hammer',
keywords: 'hammer | tool'
}, {
code: '\u{1FA93}',
name: 'axe',
keywords: 'axe | chop | hatchet | split | wood'
}, {
code: '\u{26CF}',
name: 'pick',
keywords: 'mining | pick | tool'
}, {
code: '\u{2692}',
name: 'hammer and pick',
keywords: 'hammer | hammer and pick | pick | tool'
}, {
code: '\u{1F6E0}',
name: 'hammer and wrench',
keywords: 'hammer | hammer and wrench | spanner | tool | wrench'
}, {
code: '\u{1F5E1}',
name: 'dagger',
keywords: 'dagger | knife | weapon'
}, {
code: '\u{2694}',
name: 'crossed swords',
keywords: 'crossed | swords | weapon'
}, {
code: '\u{1F52B}',
name: 'water pistol',
keywords: 'gun | handgun | pistol | revolver | tool | water | weapon'
}, {
code: '\u{1FA83}',
name: 'boomerang',
keywords: 'australia | boomerang | rebound | repercussion'
}, {
code: '\u{1F3F9}',
name: 'bow and arrow',
keywords: 'archer | arrow | bow | bow and arrow | Sagittarius | zodiac'
}, {
code: '\u{1F6E1}',
name: 'shield',
keywords: 'shield | weapon'
}, {
code: '\u{1FA9A}',
name: 'carpentry saw',
keywords: 'carpenter | carpentry saw | lumber | saw | tool'
}, {
code: '\u{1F527}',
name: 'wrench',
keywords: 'spanner | tool | wrench'
}, {
code: '\u{1FA9B}',
name: 'screwdriver',
keywords: 'screw | screwdriver | tool'
}, {
code: '\u{1F529}',
name: 'nut and bolt',
keywords: 'bolt | nut | nut and bolt | tool'
}, {
code: '\u{2699}',
name: 'gear',
keywords: 'cog | cogwheel | gear | tool'
}, {
code: '\u{1F5DC}',
name: 'clamp',
keywords: 'clamp | compress | tool | vice'
}, {
code: '\u{2696}',
name: 'balance scale',
keywords: 'balance | justice | Libra | scale | zodiac'
}, {
code: '\u{1F9AF}',
name: 'white cane',
keywords: 'accessibility | blind | white cane'
}, {
code: '\u{1F517}',
name: 'link',
keywords: 'link'
}, {
code: '\u{26D3}',
name: 'chains',
keywords: 'chain | chains'
}, {
code: '\u{1FA9D}',
name: 'hook',
keywords: 'catch | crook | curve | ensnare | hook | selling point'
}, {
code: '\u{1F9F0}',
name: 'toolbox',
keywords: 'chest | mechanic | tool | toolbox'
}, {
code: '\u{1F9F2}',
name: 'magnet',
keywords: 'attraction | horseshoe | magnet | magnetic'
}, {
code: '\u{1FA9C}',
name: 'ladder',
keywords: 'climb | ladder | rung | step'
}, {
code: '\u{2697}',
name: 'alembic',
keywords: 'alembic | chemistry | tool'
}, {
code: '\u{1F9EA}',
name: 'test tube',
keywords: 'chemist | chemistry | experiment | lab | science | test tube'
}, {
code: '\u{1F9EB}',
name: 'petri dish',
keywords: 'bacteria | biologist | biology | culture | lab | petri dish'
}, {
code: '\u{1F9EC}',
name: 'dna',
keywords: 'biologist | dna | evolution | gene | genetics | life'
}, {
code: '\u{1F52C}',
name: 'microscope',
keywords: 'microscope | science | tool'
}, {
code: '\u{1F52D}',
name: 'telescope',
keywords: 'science | telescope | tool'
}, {
code: '\u{1F4E1}',
name: 'satellite antenna',
keywords: 'antenna | dish | satellite'
}, {
code: '\u{1F489}',
name: 'syringe',
keywords: 'medicine | needle | shot | sick | syringe'
}, {
code: '\u{1FA78}',
name: 'drop of blood',
keywords: 'bleed | blood donation | drop of blood | injury | medicine | menstruation'
}, {
code: '\u{1F48A}',
name: 'pill',
keywords: 'doctor | medicine | pill | sick'
}, {
code: '\u{1FA79}',
name: 'adhesive bandage',
keywords: 'adhesive bandage | bandage'
}, {
code: '\u{1FA7A}',
name: 'stethoscope',
keywords: 'doctor | heart | medicine | stethoscope'
}, {
code: '\u{1F6AA}',
name: 'door',
keywords: 'door'
}, {
code: '\u{1F6D7}',
name: 'elevator',
keywords: 'accessibility | elevator | hoist | lift'
}, {
code: '\u{1FA9E}',
name: 'mirror',
keywords: 'mirror | reflection | reflector | speculum'
}, {
code: '\u{1FA9F}',
name: 'window',
keywords: 'frame | fresh air | opening | transparent | view | window'
}, {
code: '\u{1F6CF}',
name: 'bed',
keywords: 'bed | hotel | sleep'
}, {
code: '\u{1F6CB}',
name: 'couch and lamp',
keywords: 'couch | couch and lamp | hotel | lamp'
}, {
code: '\u{1FA91}',
name: 'chair',
keywords: 'chair | seat | sit'
}, {
code: '\u{1F6BD}',
name: 'toilet',
keywords: 'toilet'
}, {
code: '\u{1FAA0}',
name: 'plunger',
keywords: 'force cup | plumber | plunger | suction | toilet'
}, {
code: '\u{1F6BF}',
name: 'shower',
keywords: 'shower | water'
}, {
code: '\u{1F6C1}',
name: 'bathtub',
keywords: 'bath | bathtub'
}, {
code: '\u{1FAA4}',
name: 'mouse trap',
keywords: 'bait | mouse trap | mousetrap | snare | trap'
}, {
code: '\u{1FA92}',
name: 'razor',
keywords: 'razor | sharp | shave'
}, {
code: '\u{1F9F4}',
name: 'lotion bottle',
keywords: 'lotion | lotion bottle | moisturizer | shampoo | sunscreen'
}, {
code: '\u{1F9F7}',
name: 'safety pin',
keywords: 'diaper | punk rock | safety pin'
}, {
code: '\u{1F9F9}',
name: 'broom',
keywords: 'broom | cleaning | sweeping | witch'
}, {
code: '\u{1F9FA}',
name: 'basket',
keywords: 'basket | farming | laundry | picnic'
}, {
code: '\u{1F9FB}',
name: 'roll of paper',
keywords: 'paper towels | roll of paper | toilet paper'
}, {
code: '\u{1FAA3}',
name: 'bucket',
keywords: 'bucket | cask | pail | vat'
}, {
code: '\u{1F9FC}',
name: 'soap',
keywords: 'bar | bathing | cleaning | lather | soap | soapdish'
}, {
code: '\u{1FAA5}',
name: 'toothbrush',
keywords: 'bathroom | brush | clean | dental | hygiene | teeth | toothbrush'
}, {
code: '\u{1F9FD}',
name: 'sponge',
keywords: 'absorbing | cleaning | porous | sponge'
}, {
code: '\u{1F9EF}',
name: 'fire extinguisher',
keywords: 'extinguish | fire | fire extinguisher | quench'
}, {
code: '\u{1F6D2}',
name: 'shopping cart',
keywords: 'cart | shopping | trolley'
}, {
code: '\u{1F6AC}',
name: 'cigarette',
keywords: 'cigarette | smoking'
}, {
code: '\u{26B0}',
name: 'coffin',
keywords: 'coffin | death'
}, {
code: '\u{1FAA6}',
name: 'headstone',
keywords: 'cemetery | grave | graveyard | headstone | tombstone'
}, {
code: '\u{26B1}',
name: 'funeral urn',
keywords: 'ashes | death | funeral | urn'
}, {
code: '\u{1F5FF}',
name: 'moai',
keywords: 'face | moai | moyai | statue'
}, {
code: '\u{1FAA7}',
name: 'placard',
keywords: 'demonstration | picket | placard | protest | sign'
}, {
code: '\u{1F3E7}',
name: 'ATM sign',
keywords: 'atm | ATM sign | automated | bank | teller'
}, {
code: '\u{1F6AE}',
name: 'litter in bin sign',
keywords: 'litter | litter bin | litter in bin sign'
}, {
code: '\u{1F6B0}',
name: 'potable water',
keywords: 'drinking | potable | water'
}, {
code: '\u{267F}',
name: 'wheelchair symbol',
keywords: 'access | wheelchair symbol'
}, {
code: '\u{1F6B9}',
name: 'men’s room',
keywords: 'lavatory | man | men’s room | restroom | wc'
}, {
code: '\u{1F6BA}',
name: 'women’s room',
keywords: 'lavatory | restroom | wc | woman | women’s room'
}, {
code: '\u{1F6BB}',
name: 'restroom',
keywords: 'lavatory | restroom | WC'
}, {
code: '\u{1F6BC}',
name: 'baby symbol',
keywords: 'baby | baby symbol | changing'
}, {
code: '\u{1F6BE}',
name: 'water closet',
keywords: 'closet | lavatory | restroom | water | wc'
}, {
code: '\u{1F6C2}',
name: 'passport control',
keywords: 'control | passport'
}, {
code: '\u{1F6C3}',
name: 'customs',
keywords: 'customs'
}, {
code: '\u{1F6C4}',
name: 'baggage claim',
keywords: 'baggage | claim'
}, {
code: '\u{1F6C5}',
name: 'left luggage',
keywords: 'baggage | left luggage | locker | luggage'
}, {
code: '\u{26A0}',
name: 'warning',
keywords: 'warning'
}, {
code: '\u{1F6B8}',
name: 'children crossing',
keywords: 'child | children crossing | crossing | pedestrian | traffic'
}, {
code: '\u{26D4}',
name: 'no entry',
keywords: 'entry | forbidden | no | not | prohibited | traffic'
}, {
code: '\u{1F6AB}',
name: 'prohibited',
keywords: 'entry | forbidden | no | not | prohibited'
}, {
code: '\u{1F6B3}',
name: 'no bicycles',
keywords: 'bicycle | bike | forbidden | no | no bicycles | prohibited'
}, {
code: '\u{1F6AD}',
name: 'no smoking',
keywords: 'forbidden | no | not | prohibited | smoking'
}, {
code: '\u{1F6AF}',
name: 'no littering',
keywords: 'forbidden | litter | no | no littering | not | prohibited'
}, {
code: '\u{1F6B1}',
name: 'non-potable water',
keywords: 'non-drinking | non-potable | water'
}, {
code: '\u{1F6B7}',
name: 'no pedestrians',
keywords: 'forbidden | no | no pedestrians | not | pedestrian | prohibited'
}, {
code: '\u{1F4F5}',
name: 'no mobile phones',
keywords: 'cell | forbidden | mobile | no | no mobile phones | phone'
}, {
code: '\u{1F51E}',
name: 'no one under eighteen',
keywords: '18 | age restriction | eighteen | no one under eighteen | prohibited | underage'
}, {
code: '\u{2622}',
name: 'radioactive',
keywords: 'radioactive | sign'
}, {
code: '\u{2623}',
name: 'biohazard',
keywords: 'biohazard | sign'
}, {
code: '\u{2B06}',
name: 'up arrow',
keywords: 'arrow | cardinal | direction | north | up arrow'
}, {
code: '\u{2197}',
name: 'up-right arrow',
keywords: 'arrow | direction | intercardinal | northeast | up-right arrow'
}, {
code: '\u{27A1}',
name: 'right arrow',
keywords: 'arrow | cardinal | direction | east | right arrow'
}, {
code: '\u{2198}',
name: 'down-right arrow',
keywords: 'arrow | direction | down-right arrow | intercardinal | southeast'
}, {
code: '\u{2B07}',
name: 'down arrow',
keywords: 'arrow | cardinal | direction | down | south'
}, {
code: '\u{2199}',
name: 'down-left arrow',
keywords: 'arrow | direction | down-left arrow | intercardinal | southwest'
}, {
code: '\u{2B05}',
name: 'left arrow',
keywords: 'arrow | cardinal | direction | left arrow | west'
}, {
code: '\u{2196}',
name: 'up-left arrow',
keywords: 'arrow | direction | intercardinal | northwest | up-left arrow'
}, {
code: '\u{2195}',
name: 'up-down arrow',
keywords: 'arrow | up-down arrow'
}, {
code: '\u{2194}',
name: 'left-right arrow',
keywords: 'arrow | left-right arrow'
}, {
code: '\u{21A9}',
name: 'right arrow curving left',
keywords: 'arrow | right arrow curving left'
}, {
code: '\u{21AA}',
name: 'left arrow curving right',
keywords: 'arrow | left arrow curving right'
}, {
code: '\u{2934}',
name: 'right arrow curving up',
keywords: 'arrow | right arrow curving up'
}, {
code: '\u{2935}',
name: 'right arrow curving down',
keywords: 'arrow | down | right arrow curving down'
}, {
code: '\u{1F503}',
name: 'clockwise vertical arrows',
keywords: 'arrow | clockwise | clockwise vertical arrows | reload'
}, {
code: '\u{1F504}',
name: 'counterclockwise arrows button',
keywords: 'anticlockwise | arrow | counterclockwise | counterclockwise arrows button | withershins'
}, {
code: '\u{1F519}',
name: 'BACK arrow',
keywords: 'arrow | back | BACK arrow'
}, {
code: '\u{1F51A}',
name: 'END arrow',
keywords: 'arrow | end | END arrow'
}, {
code: '\u{1F51B}',
name: 'ON! arrow',
keywords: 'arrow | mark | on | ON! arrow'
}, {
code: '\u{1F51C}',
name: 'SOON arrow',
keywords: 'arrow | soon | SOON arrow'
}, {
code: '\u{1F51D}',
name: 'TOP arrow',
keywords: 'arrow | top | TOP arrow | up'
}, {
code: '\u{1F6D0}',
name: 'place of worship',
keywords: 'place of worship | religion | worship'
}, {
code: '\u{269B}',
name: 'atom symbol',
keywords: 'atheist | atom | atom symbol'
}, {
code: '\u{1F549}',
name: 'om',
keywords: 'Hindu | om | religion'
}, {
code: '\u{2721}',
name: 'star of David',
keywords: 'David | Jew | Jewish | religion | star | star of David'
}, {
code: '\u{2638}',
name: 'wheel of dharma',
keywords: 'Buddhist | dharma | religion | wheel | wheel of dharma'
}, {
code: '\u{262F}',
name: 'yin yang',
keywords: 'religion | tao | taoist | yang | yin'
}, {
code: '\u{271D}',
name: 'latin cross',
keywords: 'Christian | cross | latin cross | religion'
}, {
code: '\u{2626}',
name: 'orthodox cross',
keywords: 'Christian | cross | orthodox cross | religion'
}, {
code: '\u{262A}',
name: 'star and crescent',
keywords: 'islam | Muslim | religion | star and crescent'
}, {
code: '\u{262E}',
name: 'peace symbol',
keywords: 'peace | peace symbol'
}, {
code: '\u{1F54E}',
name: 'menorah',
keywords: 'candelabrum | candlestick | menorah | religion'
}, {
code: '\u{1F52F}',
name: 'dotted six-pointed star',
keywords: 'dotted six-pointed star | fortune | star'
}, {
code: '\u{2648}',
name: 'Aries',
keywords: 'Aries | ram | zodiac'
}, {
code: '\u{2649}',
name: 'Taurus',
keywords: 'bull | ox | Taurus | zodiac'
}, {
code: '\u{264A}',
name: 'Gemini',
keywords: 'Gemini | twins | zodiac'
}, {
code: '\u{264B}',
name: 'Cancer',
keywords: 'Cancer | crab | zodiac'
}, {
code: '\u{264C}',
name: 'Leo',
keywords: 'Leo | lion | zodiac'
}, {
code: '\u{264D}',
name: 'Virgo',
keywords: 'Virgo | zodiac'
}, {
code: '\u{264E}',
name: 'Libra',
keywords: 'balance | justice | Libra | scales | zodiac'
}, {
code: '\u{264F}',
name: 'Scorpio',
keywords: 'Scorpio | scorpion | scorpius | zodiac'
}, {
code: '\u{2650}',
name: 'Sagittarius',
keywords: 'archer | Sagittarius | zodiac'
}, {
code: '\u{2651}',
name: 'Capricorn',
keywords: 'Capricorn | goat | zodiac'
}, {
code: '\u{2652}',
name: 'Aquarius',
keywords: 'Aquarius | bearer | water | zodiac'
}, {
code: '\u{2653}',
name: 'Pisces',
keywords: 'fish | Pisces | zodiac'
}, {
code: '\u{26CE}',
name: 'Ophiuchus',
keywords: 'bearer | Ophiuchus | serpent | snake | zodiac'
}, {
code: '\u{1F500}',
name: 'shuffle tracks button',
keywords: 'arrow | crossed | shuffle tracks button'
}, {
code: '\u{1F501}',
name: 'repeat button',
keywords: 'arrow | clockwise | repeat | repeat button'
}, {
code: '\u{1F502}',
name: 'repeat single button',
keywords: 'arrow | clockwise | once | repeat single button'
}, {
code: '\u{25B6}',
name: 'play button',
keywords: 'arrow | play | play button | right | triangle'
}, {
code: '\u{23E9}',
name: 'fast-forward button',
keywords: 'arrow | double | fast | fast-forward button | forward'
}, {
code: '\u{23ED}',
name: 'next track button',
keywords: 'arrow | next scene | next track | next track button | triangle'
}, {
code: '\u{23EF}',
name: 'play or pause button',
keywords: 'arrow | pause | play | play or pause button | right | triangle'
}, {
code: '\u{25C0}',
name: 'reverse button',
keywords: 'arrow | left | reverse | reverse button | triangle'
}, {
code: '\u{23EA}',
name: 'fast reverse button',
keywords: 'arrow | double | fast reverse button | rewind'
}, {
code: '\u{23EE}',
name: 'last track button',
keywords: 'arrow | last track button | previous scene | previous track | triangle'
}, {
code: '\u{1F53C}',
name: 'upwards button',
keywords: 'arrow | button | red | upwards button'
}, {
code: '\u{23EB}',
name: 'fast up button',
keywords: 'arrow | double | fast up button'
}, {
code: '\u{1F53D}',
name: 'downwards button',
keywords: 'arrow | button | down | downwards button | red'
}, {
code: '\u{23EC}',
name: 'fast down button',
keywords: 'arrow | double | down | fast down button'
}, {
code: '\u{23F8}',
name: 'pause button',
keywords: 'bar | double | pause | pause button | vertical'
}, {
code: '\u{23F9}',
name: 'stop button',
keywords: 'square | stop | stop button'
}, {
code: '\u{23FA}',
name: 'record button',
keywords: 'circle | record | record button'
}, {
code: '\u{23CF}',
name: 'eject button',
keywords: 'eject | eject button'
}, {
code: '\u{1F3A6}',
name: 'cinema',
keywords: 'camera | cinema | film | movie'
}, {
code: '\u{1F505}',
name: 'dim button',
keywords: 'brightness | dim | dim button | low'
}, {
code: '\u{1F506}',
name: 'bright button',
keywords: 'bright | bright button | brightness'
}, {
code: '\u{1F4F6}',
name: 'antenna bars',
keywords: 'antenna | antenna bars | bar | cell | mobile | phone'
}, {
code: '\u{1F4F3}',
name: 'vibration mode',
keywords: 'cell | mobile | mode | phone | telephone | vibration'
}, {
code: '\u{1F4F4}',
name: 'mobile phone off',
keywords: 'cell | mobile | off | phone | telephone'
}, {
code: '\u{2640}',
name: 'female sign',
keywords: 'female sign | woman'
}, {
code: '\u{2642}',
name: 'male sign',
keywords: 'male sign | man'
}, {
code: '\u{26A7}',
name: 'transgender symbol',
keywords: 'transgender | transgender symbol'
}, {
code: '\u{2716}',
name: 'multiply',
keywords: '× | cancel | multiplication | multiply | sign | x'
}, {
code: '\u{2795}',
name: 'plus',
keywords: '+ | math | plus | sign'
}, {
code: '\u{2796}',
name: 'minus',
keywords: '- | − | math | minus | sign'
}, {
code: '\u{2797}',
name: 'divide',
keywords: '÷ | divide | division | math | sign'
}, {
code: '\u{267E}',
name: 'infinity',
keywords: 'forever | infinity | unbounded | universal'
}, {
code: '\u{203C}',
name: 'double exclamation mark',
keywords: '! | !! | bangbang | double exclamation mark | exclamation | mark'
}, {
code: '\u{2049}',
name: 'exclamation question mark',
keywords: '! | !? | ? | exclamation | interrobang | mark | punctuation | question'
}, {
code: '\u{2753}',
name: 'red question mark',
keywords: '? | mark | punctuation | question | red question mark'
}, {
code: '\u{2754}',
name: 'white question mark',
keywords: '? | mark | outlined | punctuation | question | white question mark'
}, {
code: '\u{2755}',
name: 'white exclamation mark',
keywords: '! | exclamation | mark | outlined | punctuation | white exclamation mark'
}, {
code: '\u{2757}',
name: 'red exclamation mark',
keywords: '! | exclamation | mark | punctuation | red exclamation mark'
}, {
code: '\u{3030}',
name: 'wavy dash',
keywords: 'dash | punctuation | wavy'
}, {
code: '\u{1F4B1}',
name: 'currency exchange',
keywords: 'bank | currency | exchange | money'
}, {
code: '\u{1F4B2}',
name: 'heavy dollar sign',
keywords: 'currency | dollar | heavy dollar sign | money'
}, {
code: '\u{2695}',
name: 'medical symbol',
keywords: 'aesculapius | medical symbol | medicine | staff'
}, {
code: '\u{267B}',
name: 'recycling symbol',
keywords: 'recycle | recycling symbol'
}, {
code: '\u{269C}',
name: 'fleur-de-lis',
keywords: 'fleur-de-lis'
}, {
code: '\u{1F531}',
name: 'trident emblem',
keywords: 'anchor | emblem | ship | tool | trident'
}, {
code: '\u{1F4DB}',
name: 'name badge',
keywords: 'badge | name'
}, {
code: '\u{1F530}',
name: 'Japanese symbol for beginner',
keywords: 'beginner | chevron | Japanese | Japanese symbol for beginner | leaf'
}, {
code: '\u{2B55}',
name: 'hollow red circle',
keywords: 'circle | hollow red circle | large | o | red'
}, {
code: '\u{2705}',
name: 'check mark button',
keywords: '✓ | button | check | mark'
}, {
code: '\u{2611}',
name: 'check box with check',
keywords: '✓ | box | check | check box with check'
}, {
code: '\u{2714}',
name: 'check mark',
keywords: '✓ | check | mark'
}, {
code: '\u{274C}',
name: 'cross mark',
keywords: '× | cancel | cross | mark | multiplication | multiply | x'
}, {
code: '\u{274E}',
name: 'cross mark button',
keywords: '× | cross mark button | mark | square | x'
}, {
code: '\u{27B0}',
name: 'curly loop',
keywords: 'curl | curly loop | loop'
}, {
code: '\u{27BF}',
name: 'double curly loop',
keywords: 'curl | double | double curly loop | loop'
}, {
code: '\u{303D}',
name: 'part alternation mark',
keywords: 'mark | part | part alternation mark'
}, {
code: '\u{2733}',
name: 'eight-spoked asterisk',
keywords: '* | asterisk | eight-spoked asterisk'
}, {
code: '\u{2734}',
name: 'eight-pointed star',
keywords: '* | eight-pointed star | star'
}, {
code: '\u{2747}',
name: 'sparkle',
keywords: '* | sparkle'
}, {
code: '\u{00A9}',
name: 'copyright',
keywords: 'c | copyright'
}, {
code: '\u{00AE}',
name: 'registered',
keywords: 'r | registered'
}, {
code: '\u{2122}',
name: 'trade mark',
keywords: 'mark | tm | trade mark | trademark'
}, {
code: '\u{0023}\u{FE0F}\u{20E3}',
name: 'keycap: #',
keywords: 'keycap'
}, {
code: '\u{002A}\u{FE0F}\u{20E3}',
name: 'keycap: *',
keywords: 'keycap'
}, {
code: '\u{0030}\u{FE0F}\u{20E3}',
name: 'keycap: 0',
keywords: 'keycap'
}, {
code: '\u{0031}\u{FE0F}\u{20E3}',
name: 'keycap: 1',
keywords: 'keycap'
}, {
code: '\u{0032}\u{FE0F}\u{20E3}',
name: 'keycap: 2',
keywords: 'keycap'
}, {
code: '\u{0033}\u{FE0F}\u{20E3}',
name: 'keycap: 3',
keywords: 'keycap'
}, {
code: '\u{0034}\u{FE0F}\u{20E3}',
name: 'keycap: 4',
keywords: 'keycap'
}, {
code: '\u{0035}\u{FE0F}\u{20E3}',
name: 'keycap: 5',
keywords: 'keycap'
}, {
code: '\u{0036}\u{FE0F}\u{20E3}',
name: 'keycap: 6',
keywords: 'keycap'
}, {
code: '\u{0037}\u{FE0F}\u{20E3}',
name: 'keycap: 7',
keywords: 'keycap'
}, {
code: '\u{0038}\u{FE0F}\u{20E3}',
name: 'keycap: 8',
keywords: 'keycap'
}, {
code: '\u{0039}\u{FE0F}\u{20E3}',
name: 'keycap: 9',
keywords: 'keycap'
}, {
code: '\u{1F51F}',
name: 'keycap: 10',
keywords: 'keycap'
}, {
code: '\u{1F520}',
name: 'input latin uppercase',
keywords: 'ABCD | input | latin | letters | uppercase'
}, {
code: '\u{1F521}',
name: 'input latin lowercase',
keywords: 'abcd | input | latin | letters | lowercase'
}, {
code: '\u{1F522}',
name: 'input numbers',
keywords: '1234 | input | numbers'
}, {
code: '\u{1F523}',
name: 'input symbols',
keywords: '〒♪&% | input | input symbols'
}, {
code: '\u{1F524}',
name: 'input latin letters',
keywords: 'abc | alphabet | input | latin | letters'
}, {
code: '\u{1F170}',
name: 'A button (blood type)',
keywords: 'a | A button (blood type) | blood type'
}, {
code: '\u{1F18E}',
name: 'AB button (blood type)',
keywords: 'ab | AB button (blood type) | blood type'
}, {
code: '\u{1F171}',
name: 'B button (blood type)',
keywords: 'b | B button (blood type) | blood type'
}, {
code: '\u{1F191}',
name: 'CL button',
keywords: 'cl | CL button'
}, {
code: '\u{1F192}',
name: 'COOL button',
keywords: 'cool | COOL button'
}, {
code: '\u{1F193}',
name: 'FREE button',
keywords: 'free | FREE button'
}, {
code: '\u{2139}',
name: 'information',
keywords: 'i | information'
}, {
code: '\u{1F194}',
name: 'ID button',
keywords: 'id | ID button | identity'
}, {
code: '\u{24C2}',
name: 'circled M',
keywords: 'circle | circled M | m'
}, {
code: '\u{1F195}',
name: 'NEW button',
keywords: 'new | NEW button'
}, {
code: '\u{1F196}',
name: 'NG button',
keywords: 'ng | NG button'
}, {
code: '\u{1F17E}',
name: 'O button (blood type)',
keywords: 'blood type | o | O button (blood type)'
}, {
code: '\u{1F197}',
name: 'OK button',
keywords: 'OK | OK button'
}, {
code: '\u{1F17F}',
name: 'P button',
keywords: 'P button | parking'
}, {
code: '\u{1F198}',
name: 'SOS button',
keywords: 'help | sos | SOS button'
}, {
code: '\u{1F199}',
name: 'UP! button',
keywords: 'mark | up | UP! button'
}, {
code: '\u{1F19A}',
name: 'VS button',
keywords: 'versus | vs | VS button'
}, {
code: '\u{1F201}',
name: 'Japanese “here” button',
keywords: '“here” | Japanese | Japanese “here” button | katakana | ココ'
}, {
code: '\u{1F202}',
name: 'Japanese “service charge” button',
keywords: '“service charge” | Japanese | Japanese “service charge” button | katakana | サ'
}, {
code: '\u{1F237}',
name: 'Japanese “monthly amount” button',
keywords: '“monthly amount” | ideograph | Japanese | Japanese “monthly amount” button | 月'
}, {
code: '\u{1F236}',
name: 'Japanese “not free of charge” button',
keywords: '“not free of charge” | ideograph | Japanese | Japanese “not free of charge” button | 有'
}, {
code: '\u{1F22F}',
name: 'Japanese “reserved” button',
keywords: '“reserved” | ideograph | Japanese | Japanese “reserved” button | 指'
}, {
code: '\u{1F250}',
name: 'Japanese “bargain” button',
keywords: '“bargain” | ideograph | Japanese | Japanese “bargain” button | 得'
}, {
code: '\u{1F239}',
name: 'Japanese “discount” button',
keywords: '“discount” | ideograph | Japanese | Japanese “discount” button | 割'
}, {
code: '\u{1F21A}',
name: 'Japanese “free of charge” button',
keywords: '“free of charge” | ideograph | Japanese | Japanese “free of charge” button | 無'
}, {
code: '\u{1F232}',
name: 'Japanese “prohibited” button',
keywords: '“prohibited” | ideograph | Japanese | Japanese “prohibited” button | 禁'
}, {
code: '\u{1F251}',
name: 'Japanese “acceptable” button',
keywords: '“acceptable” | ideograph | Japanese | Japanese “acceptable” button | 可'
}, {
code: '\u{1F238}',
name: 'Japanese “application” button',
keywords: '“application” | ideograph | Japanese | Japanese “application” button | 申'
}, {
code: '\u{1F234}',
name: 'Japanese “passing grade” button',
keywords: '“passing grade” | ideograph | Japanese | Japanese “passing grade” button | 合'
}, {
code: '\u{1F233}',
name: 'Japanese “vacancy” button',
keywords: '“vacancy” | ideograph | Japanese | Japanese “vacancy” button | 空'
}, {
code: '\u{3297}',
name: 'Japanese “congratulations” button',
keywords: '“congratulations” | ideograph | Japanese | Japanese “congratulations” button | 祝'
}, {
code: '\u{3299}',
name: 'Japanese “secret” button',
keywords: '“secret” | ideograph | Japanese | Japanese “secret” button | 秘'
}, {
code: '\u{1F23A}',
name: 'Japanese “open for business” button',
keywords: '“open for business” | ideograph | Japanese | Japanese “open for business” button | 営'
}, {
code: '\u{1F235}',
name: 'Japanese “no vacancy” button',
keywords: '“no vacancy” | ideograph | Japanese | Japanese “no vacancy” button | 満'
}, {
code: '\u{1F534}',
name: 'red circle',
keywords: 'circle | geometric | red'
}, {
code: '\u{1F7E0}',
name: 'orange circle',
keywords: 'circle | orange'
}, {
code: '\u{1F7E1}',
name: 'yellow circle',
keywords: 'circle | yellow'
}, {
code: '\u{1F7E2}',
name: 'green circle',
keywords: 'circle | green'
}, {
code: '\u{1F535}',
name: 'blue circle',
keywords: 'blue | circle | geometric'
}, {
code: '\u{1F7E3}',
name: 'purple circle',
keywords: 'circle | purple'
}, {
code: '\u{1F7E4}',
name: 'brown circle',
keywords: 'brown | circle'
}, {
code: '\u{26AB}',
name: 'black circle',
keywords: 'black circle | circle | geometric'
}, {
code: '\u{26AA}',
name: 'white circle',
keywords: 'circle | geometric | white circle'
}, {
code: '\u{1F7E5}',
name: 'red square',
keywords: 'red | square'
}, {
code: '\u{1F7E7}',
name: 'orange square',
keywords: 'orange | square'
}, {
code: '\u{1F7E8}',
name: 'yellow square',
keywords: 'square | yellow'
}, {
code: '\u{1F7E9}',
name: 'green square',
keywords: 'green | square'
}, {
code: '\u{1F7E6}',
name: 'blue square',
keywords: 'blue | square'
}, {
code: '\u{1F7EA}',
name: 'purple square',
keywords: 'purple | square'
}, {
code: '\u{1F7EB}',
name: 'brown square',
keywords: 'brown | square'
}, {
code: '\u{2B1B}',
name: 'black large square',
keywords: 'black large square | geometric | square'
}, {
code: '\u{2B1C}',
name: 'white large square',
keywords: 'geometric | square | white large square'
}, {
code: '\u{25FC}',
name: 'black medium square',
keywords: 'black medium square | geometric | square'
}, {
code: '\u{25FB}',
name: 'white medium square',
keywords: 'geometric | square | white medium square'
}, {
code: '\u{25FE}',
name: 'black medium-small square',
keywords: 'black medium-small square | geometric | square'
}, {
code: '\u{25FD}',
name: 'white medium-small square',
keywords: 'geometric | square | white medium-small square'
}, {
code: '\u{25AA}',
name: 'black small square',
keywords: 'black small square | geometric | square'
}, {
code: '\u{25AB}',
name: 'white small square',
keywords: 'geometric | square | white small square'
}, {
code: '\u{1F536}',
name: 'large orange diamond',
keywords: 'diamond | geometric | large orange diamond | orange'
}, {
code: '\u{1F537}',
name: 'large blue diamond',
keywords: 'blue | diamond | geometric | large blue diamond'
}, {
code: '\u{1F538}',
name: 'small orange diamond',
keywords: 'diamond | geometric | orange | small orange diamond'
}, {
code: '\u{1F539}',
name: 'small blue diamond',
keywords: 'blue | diamond | geometric | small blue diamond'
}, {
code: '\u{1F53A}',
name: 'red triangle pointed up',
keywords: 'geometric | red | red triangle pointed up'
}, {
code: '\u{1F53B}',
name: 'red triangle pointed down',
keywords: 'down | geometric | red | red triangle pointed down'
}, {
code: '\u{1F4A0}',
name: 'diamond with a dot',
keywords: 'comic | diamond | diamond with a dot | geometric | inside'
}, {
code: '\u{1F518}',
name: 'radio button',
keywords: 'button | geometric | radio'
}, {
code: '\u{1F533}',
name: 'white square button',
keywords: 'button | geometric | outlined | square | white square button'
}, {
code: '\u{1F532}',
name: 'black square button',
keywords: 'black square button | button | geometric | square'
}, {
code: '\u{1F3C1}',
name: 'chequered flag',
keywords: 'checkered | chequered | chequered flag | racing'
}, {
code: '\u{1F6A9}',
name: 'triangular flag',
keywords: 'post | triangular flag'
}, {
code: '\u{1F38C}',
name: 'crossed flags',
keywords: 'celebration | cross | crossed | crossed flags | Japanese'
}, {
code: '\u{1F3F4}',
name: 'black flag',
keywords: 'black flag | waving'
}, {
code: '\u{1F3F3}',
name: 'white flag',
keywords: 'waving | white flag'
}, {
code: '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}',
name: 'rainbow flag',
keywords: 'pride | rainbow | rainbow flag'
}, {
code: '\u{1F3F3}\u{FE0F}\u{200D}\u{26A7}\u{FE0F}',
name: 'transgender flag',
keywords: 'flag | light blue | pink | transgender | white'
}, {
code: '\u{1F3F4}\u{200D}\u{2620}\u{FE0F}',
name: 'pirate flag',
keywords: 'Jolly Roger | pirate | pirate flag | plunder | treasure'
}, {
code: '\u{1F1E6}\u{1F1E8}',
name: 'flag: Ascension Island',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1E9}',
name: 'flag: Andorra',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1EA}',
name: 'flag: United Arab Emirates',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1EB}',
name: 'flag: Afghanistan',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1EC}',
name: 'flag: Antigua & Barbuda',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1EE}',
name: 'flag: Anguilla',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F1}',
name: 'flag: Albania',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F2}',
name: 'flag: Armenia',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F4}',
name: 'flag: Angola',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F6}',
name: 'flag: Antarctica',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F7}',
name: 'flag: Argentina',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F8}',
name: 'flag: American Samoa',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1F9}',
name: 'flag: Austria',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1FA}',
name: 'flag: Australia',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1FC}',
name: 'flag: Aruba',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1FD}',
name: 'flag: Åland Islands',
keywords: 'flag'
}, {
code: '\u{1F1E6}\u{1F1FF}',
name: 'flag: Azerbaijan',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1E6}',
name: 'flag: Bosnia & Herzegovina',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1E7}',
name: 'flag: Barbados',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1E9}',
name: 'flag: Bangladesh',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1EA}',
name: 'flag: Belgium',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1EB}',
name: 'flag: Burkina Faso',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1EC}',
name: 'flag: Bulgaria',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1ED}',
name: 'flag: Bahrain',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1EE}',
name: 'flag: Burundi',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1EF}',
name: 'flag: Benin',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F1}',
name: 'flag: St. Barthélemy',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F2}',
name: 'flag: Bermuda',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F3}',
name: 'flag: Brunei',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F4}',
name: 'flag: Bolivia',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F6}',
name: 'flag: Caribbean Netherlands',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F7}',
name: 'flag: Brazil',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F8}',
name: 'flag: Bahamas',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1F9}',
name: 'flag: Bhutan',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1FB}',
name: 'flag: Bouvet Island',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1FC}',
name: 'flag: Botswana',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1FE}',
name: 'flag: Belarus',
keywords: 'flag'
}, {
code: '\u{1F1E7}\u{1F1FF}',
name: 'flag: Belize',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1E6}',
name: 'flag: Canada',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1E8}',
name: 'flag: Cocos (Keeling) Islands',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1E9}',
name: 'flag: Congo - Kinshasa',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1EB}',
name: 'flag: Central African Republic',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1EC}',
name: 'flag: Congo - Brazzaville',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1ED}',
name: 'flag: Switzerland',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1EE}',
name: 'flag: Côte d’Ivoire',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F0}',
name: 'flag: Cook Islands',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F1}',
name: 'flag: Chile',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F2}',
name: 'flag: Cameroon',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F3}',
name: 'flag: China',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F4}',
name: 'flag: Colombia',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F5}',
name: 'flag: Clipperton Island',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1F7}',
name: 'flag: Costa Rica',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1FA}',
name: 'flag: Cuba',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1FB}',
name: 'flag: Cape Verde',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1FC}',
name: 'flag: Curaçao',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1FD}',
name: 'flag: Christmas Island',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1FE}',
name: 'flag: Cyprus',
keywords: 'flag'
}, {
code: '\u{1F1E8}\u{1F1FF}',
name: 'flag: Czechia',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1EA}',
name: 'flag: Germany',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1EC}',
name: 'flag: Diego Garcia',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1EF}',
name: 'flag: Djibouti',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1F0}',
name: 'flag: Denmark',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1F2}',
name: 'flag: Dominica',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1F4}',
name: 'flag: Dominican Republic',
keywords: 'flag'
}, {
code: '\u{1F1E9}\u{1F1FF}',
name: 'flag: Algeria',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1E6}',
name: 'flag: Ceuta & Melilla',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1E8}',
name: 'flag: Ecuador',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1EA}',
name: 'flag: Estonia',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1EC}',
name: 'flag: Egypt',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1ED}',
name: 'flag: Western Sahara',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1F7}',
name: 'flag: Eritrea',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1F8}',
name: 'flag: Spain',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1F9}',
name: 'flag: Ethiopia',
keywords: 'flag'
}, {
code: '\u{1F1EA}\u{1F1FA}',
name: 'flag: European Union',
keywords: 'flag'
}, {
code: '\u{1F1EB}\u{1F1EE}',
name: 'flag: Finland',
keywords: 'flag'
}, {
code: '\u{1F1EB}\u{1F1EF}',
name: 'flag: Fiji',
keywords: 'flag'
}, {
code: '\u{1F1EB}\u{1F1F0}',
name: 'flag: Falkland Islands',
keywords: 'flag'
}, {
code: '\u{1F1EB}\u{1F1F2}',
name: 'flag: Micronesia',
keywords: 'flag'
}, {
code: '\u{1F1EB}\u{1F1F4}',
name: 'flag: Faroe Islands',
keywords: 'flag'
}, {
code: '\u{1F1EB}\u{1F1F7}',
name: 'flag: France',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1E6}',
name: 'flag: Gabon',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1E7}',
name: 'flag: United Kingdom',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1E9}',
name: 'flag: Grenada',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1EA}',
name: 'flag: Georgia',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1EB}',
name: 'flag: French Guiana',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1EC}',
name: 'flag: Guernsey',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1ED}',
name: 'flag: Ghana',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1EE}',
name: 'flag: Gibraltar',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F1}',
name: 'flag: Greenland',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F2}',
name: 'flag: Gambia',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F3}',
name: 'flag: Guinea',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F5}',
name: 'flag: Guadeloupe',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F6}',
name: 'flag: Equatorial Guinea',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F7}',
name: 'flag: Greece',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F8}',
name: 'flag: South Georgia & South Sandwich Islands',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1F9}',
name: 'flag: Guatemala',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1FA}',
name: 'flag: Guam',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1FC}',
name: 'flag: Guinea-Bissau',
keywords: 'flag'
}, {
code: '\u{1F1EC}\u{1F1FE}',
name: 'flag: Guyana',
keywords: 'flag'
}, {
code: '\u{1F1ED}\u{1F1F0}',
name: 'flag: Hong Kong SAR China',
keywords: 'flag'
}, {
code: '\u{1F1ED}\u{1F1F2}',
name: 'flag: Heard & McDonald Islands',
keywords: 'flag'
}, {
code: '\u{1F1ED}\u{1F1F3}',
name: 'flag: Honduras',
keywords: 'flag'
}, {
code: '\u{1F1ED}\u{1F1F7}',
name: 'flag: Croatia',
keywords: 'flag'
}, {
code: '\u{1F1ED}\u{1F1F9}',
name: 'flag: Haiti',
keywords: 'flag'
}, {
code: '\u{1F1ED}\u{1F1FA}',
name: 'flag: Hungary',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1E8}',
name: 'flag: Canary Islands',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1E9}',
name: 'flag: Indonesia',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1EA}',
name: 'flag: Ireland',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F1}',
name: 'flag: Israel',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F2}',
name: 'flag: Isle of Man',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F3}',
name: 'flag: India',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F4}',
name: 'flag: British Indian Ocean Territory',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F6}',
name: 'flag: Iraq',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F7}',
name: 'flag: Iran',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F8}',
name: 'flag: Iceland',
keywords: 'flag'
}, {
code: '\u{1F1EE}\u{1F1F9}',
name: 'flag: Italy',
keywords: 'flag'
}, {
code: '\u{1F1EF}\u{1F1EA}',
name: 'flag: Jersey',
keywords: 'flag'
}, {
code: '\u{1F1EF}\u{1F1F2}',
name: 'flag: Jamaica',
keywords: 'flag'
}, {
code: '\u{1F1EF}\u{1F1F4}',
name: 'flag: Jordan',
keywords: 'flag'
}, {
code: '\u{1F1EF}\u{1F1F5}',
name: 'flag: Japan',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1EA}',
name: 'flag: Kenya',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1EC}',
name: 'flag: Kyrgyzstan',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1ED}',
name: 'flag: Cambodia',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1EE}',
name: 'flag: Kiribati',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1F2}',
name: 'flag: Comoros',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1F3}',
name: 'flag: St. Kitts & Nevis',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1F5}',
name: 'flag: North Korea',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1F7}',
name: 'flag: South Korea',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1FC}',
name: 'flag: Kuwait',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1FE}',
name: 'flag: Cayman Islands',
keywords: 'flag'
}, {
code: '\u{1F1F0}\u{1F1FF}',
name: 'flag: Kazakhstan',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1E6}',
name: 'flag: Laos',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1E7}',
name: 'flag: Lebanon',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1E8}',
name: 'flag: St. Lucia',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1EE}',
name: 'flag: Liechtenstein',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1F0}',
name: 'flag: Sri Lanka',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1F7}',
name: 'flag: Liberia',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1F8}',
name: 'flag: Lesotho',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1F9}',
name: 'flag: Lithuania',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1FA}',
name: 'flag: Luxembourg',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1FB}',
name: 'flag: Latvia',
keywords: 'flag'
}, {
code: '\u{1F1F1}\u{1F1FE}',
name: 'flag: Libya',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1E6}',
name: 'flag: Morocco',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1E8}',
name: 'flag: Monaco',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1E9}',
name: 'flag: Moldova',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1EA}',
name: 'flag: Montenegro',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1EB}',
name: 'flag: St. Martin',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1EC}',
name: 'flag: Madagascar',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1ED}',
name: 'flag: Marshall Islands',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F0}',
name: 'flag: North Macedonia',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F1}',
name: 'flag: Mali',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F2}',
name: 'flag: Myanmar (Burma)',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F3}',
name: 'flag: Mongolia',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F4}',
name: 'flag: Macao SAR China',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F5}',
name: 'flag: Northern Mariana Islands',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F6}',
name: 'flag: Martinique',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F7}',
name: 'flag: Mauritania',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F8}',
name: 'flag: Montserrat',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1F9}',
name: 'flag: Malta',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1FA}',
name: 'flag: Mauritius',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1FB}',
name: 'flag: Maldives',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1FC}',
name: 'flag: Malawi',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1FD}',
name: 'flag: Mexico',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1FE}',
name: 'flag: Malaysia',
keywords: 'flag'
}, {
code: '\u{1F1F2}\u{1F1FF}',
name: 'flag: Mozambique',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1E6}',
name: 'flag: Namibia',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1E8}',
name: 'flag: New Caledonia',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1EA}',
name: 'flag: Niger',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1EB}',
name: 'flag: Norfolk Island',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1EC}',
name: 'flag: Nigeria',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1EE}',
name: 'flag: Nicaragua',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1F1}',
name: 'flag: Netherlands',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1F4}',
name: 'flag: Norway',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1F5}',
name: 'flag: Nepal',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1F7}',
name: 'flag: Nauru',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1FA}',
name: 'flag: Niue',
keywords: 'flag'
}, {
code: '\u{1F1F3}\u{1F1FF}',
name: 'flag: New Zealand',
keywords: 'flag'
}, {
code: '\u{1F1F4}\u{1F1F2}',
name: 'flag: Oman',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1E6}',
name: 'flag: Panama',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1EA}',
name: 'flag: Peru',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1EB}',
name: 'flag: French Polynesia',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1EC}',
name: 'flag: Papua New Guinea',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1ED}',
name: 'flag: Philippines',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F0}',
name: 'flag: Pakistan',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F1}',
name: 'flag: Poland',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F2}',
name: 'flag: St. Pierre & Miquelon',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F3}',
name: 'flag: Pitcairn Islands',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F7}',
name: 'flag: Puerto Rico',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F8}',
name: 'flag: Palestinian Territories',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1F9}',
name: 'flag: Portugal',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1FC}',
name: 'flag: Palau',
keywords: 'flag'
}, {
code: '\u{1F1F5}\u{1F1FE}',
name: 'flag: Paraguay',
keywords: 'flag'
}, {
code: '\u{1F1F6}\u{1F1E6}',
name: 'flag: Qatar',
keywords: 'flag'
}, {
code: '\u{1F1F7}\u{1F1EA}',
name: 'flag: Réunion',
keywords: 'flag'
}, {
code: '\u{1F1F7}\u{1F1F4}',
name: 'flag: Romania',
keywords: 'flag'
}, {
code: '\u{1F1F7}\u{1F1F8}',
name: 'flag: Serbia',
keywords: 'flag'
}, {
code: '\u{1F1F7}\u{1F1FA}',
name: 'flag: Russia',
keywords: 'flag'
}, {
code: '\u{1F1F7}\u{1F1FC}',
name: 'flag: Rwanda',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1E6}',
name: 'flag: Saudi Arabia',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1E7}',
name: 'flag: Solomon Islands',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1E8}',
name: 'flag: Seychelles',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1E9}',
name: 'flag: Sudan',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1EA}',
name: 'flag: Sweden',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1EC}',
name: 'flag: Singapore',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1ED}',
name: 'flag: St. Helena',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1EE}',
name: 'flag: Slovenia',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1EF}',
name: 'flag: Svalbard & Jan Mayen',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F0}',
name: 'flag: Slovakia',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F1}',
name: 'flag: Sierra Leone',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F2}',
name: 'flag: San Marino',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F3}',
name: 'flag: Senegal',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F4}',
name: 'flag: Somalia',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F7}',
name: 'flag: Suriname',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F8}',
name: 'flag: South Sudan',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1F9}',
name: 'flag: São Tomé & Príncipe',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1FB}',
name: 'flag: El Salvador',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1FD}',
name: 'flag: Sint Maarten',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1FE}',
name: 'flag: Syria',
keywords: 'flag'
}, {
code: '\u{1F1F8}\u{1F1FF}',
name: 'flag: Eswatini',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1E6}',
name: 'flag: Tristan da Cunha',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1E8}',
name: 'flag: Turks & Caicos Islands',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1E9}',
name: 'flag: Chad',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1EB}',
name: 'flag: French Southern Territories',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1EC}',
name: 'flag: Togo',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1ED}',
name: 'flag: Thailand',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1EF}',
name: 'flag: Tajikistan',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F0}',
name: 'flag: Tokelau',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F1}',
name: 'flag: Timor-Leste',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F2}',
name: 'flag: Turkmenistan',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F3}',
name: 'flag: Tunisia',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F4}',
name: 'flag: Tonga',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F7}',
name: 'flag: Turkey',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1F9}',
name: 'flag: Trinidad & Tobago',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1FB}',
name: 'flag: Tuvalu',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1FC}',
name: 'flag: Taiwan',
keywords: 'flag'
}, {
code: '\u{1F1F9}\u{1F1FF}',
name: 'flag: Tanzania',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1E6}',
name: 'flag: Ukraine',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1EC}',
name: 'flag: Uganda',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1F2}',
name: 'flag: U.S. Outlying Islands',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1F3}',
name: 'flag: United Nations',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1F8}',
name: 'flag: United States',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1FE}',
name: 'flag: Uruguay',
keywords: 'flag'
}, {
code: '\u{1F1FA}\u{1F1FF}',
name: 'flag: Uzbekistan',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1E6}',
name: 'flag: Vatican City',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1E8}',
name: 'flag: St. Vincent & Grenadines',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1EA}',
name: 'flag: Venezuela',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1EC}',
name: 'flag: British Virgin Islands',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1EE}',
name: 'flag: U.S. Virgin Islands',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1F3}',
name: 'flag: Vietnam',
keywords: 'flag'
}, {
code: '\u{1F1FB}\u{1F1FA}',
name: 'flag: Vanuatu',
keywords: 'flag'
}, {
code: '\u{1F1FC}\u{1F1EB}',
name: 'flag: Wallis & Futuna',
keywords: 'flag'
}, {
code: '\u{1F1FC}\u{1F1F8}',
name: 'flag: Samoa',
keywords: 'flag'
}, {
code: '\u{1F1FD}\u{1F1F0}',
name: 'flag: Kosovo',
keywords: 'flag'
}, {
code: '\u{1F1FE}\u{1F1EA}',
name: 'flag: Yemen',
keywords: 'flag'
}, {
code: '\u{1F1FE}\u{1F1F9}',
name: 'flag: Mayotte',
keywords: 'flag'
}, {
code: '\u{1F1FF}\u{1F1E6}',
name: 'flag: South Africa',
keywords: 'flag'
}, {
code: '\u{1F1FF}\u{1F1F2}',
name: 'flag: Zambia',
keywords: 'flag'
}, {
code: '\u{1F1FF}\u{1F1FC}',
name: 'flag: Zimbabwe',
keywords: 'flag'
}, {
code: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
name: 'flag: England',
keywords: 'flag'
}, {
code: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
name: 'flag: Scotland',
keywords: 'flag'
}, {
code: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
name: 'flag: Wales',
keywords: 'flag'
}
    ];
