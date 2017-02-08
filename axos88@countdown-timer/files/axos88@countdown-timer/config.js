// timer-notifications@markbokil.com configuration config.js

// use 'true' or 'false' to enable/disable alert type
// change any text in between "quotes"

// restart Cinnamon after editing right-click Restart or use keys Alt + F2, then enter r
// if your restart is broken use Settings > Troubleshoot > Restart Cinnamon

 const Options = {
    ConfirmPromptOn : true, //window plastered across screen
    ConfirmMessage: "Time up!",
    SoundPrompOn: true, //play a sound file OGG,etc. using sox
    MessagePromptOn: false, //show an onscreen notification
    MessageStr: "Time up!",
    ShowMenuOn: true, //true pops open timer menu when time expired
    LabelOn: true, //true shows minutes in panel 
    SoundPath: "phone-incoming-call.ogg",
    
    SliderIntervals: [
      { min: 0, max: 300, step: 15 },
      { min: 300, max: 1800, step: 60 },
      { min: 1800, max: 10800, step: 600 },
      { min: 10800, max: 86400, step: 3600 }
    ],

    Presets: [
        6 * 3600,
        4 * 3600,
        3 * 3600,
        2 * 3600,
        90 * 60,
        60 * 60,
        45 * 60,
        30 * 60,
        20 * 60,
        15 * 60,
        10 * 60,
        5 * 60,
        3 * 60,
        2 * 60,
        1 * 60,
        30,
        0
    ]
}


