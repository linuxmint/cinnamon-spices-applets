// timer-notifications@markbokil.com configuration config.js

// use 'true' or 'false' to enable/disable alert type
// change any text in between "quotes"

// restart Cinnamon after editing right-click Restart or use keys Alt + F2, then enter r
// if your restart is broken use Settings > Troubleshoot > Restart Cinnamon

 const Options = {
    ConfirmPromptOn : false, //window plastered across screen
    ConfirmMessage: "Time up!",
    SoundPrompOn: false, //play a sound file OGG,etc. using sox
    MessagePromptOn: true, //show an onscreen notification
    MessageStr: "Time up!",
    ShowMenuOn: true, //true pops open timer menu when time expired
    LabelOn: true, //true shows minutes in panel 
    SoundPath: "/usr/share/sounds/gnome/default/alerts/sonar.ogg",
    
    AppIcon: "Alarm_clock_symbolized16.svg", // stopped
    AppIconRunning: "Alarm_clock_symbolized_concentric16.svg", //timer running
    AppIconReversed: "Alarm_clock_symbolized_reversed16.svg", //time expired (alarm)
  
    // Time presets - an array of objects with 'minutes' and 'label' properties. If it is just a number, 
    // that number wil be the number of minutes and the label will be "<number> Minutes"
    Timers: [
        { minutes: 240, label: '240 Minutes - 4 hours'},
        { minutes: 180, label: '180 Minutes - 3 hours'},
        { minutes: 120, label: '120 Minutes - 2 hours'},
        90,
        { minutes: 60, label: '60 Minutes - 1 hour'},
        45,
        30,
        { minutes: 25, label: '25 Minutes - 1 Pomodoro'},
        20,
        15,
        10,
        5,
        3,
        1
    ]
}


