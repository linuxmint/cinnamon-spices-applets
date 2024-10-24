# :waning_crescent_moon: What is Blue Light Blocker 
This applet is the Linux Mint equivalent of '**Night Light**' (on Windows), and '**Night Shift**' (on macOS).

<img alt="Night Light in Windows" src="https://github.com/user-attachments/assets/bc55a22c-b986-496c-b77e-b9e718308fd2" width="250" height="250">
<img alt="Night Shift in MacOS" src="https://github.com/user-attachments/assets/2d0a4e9c-1c55-476e-b2b4-29f133f49c56" width="500" height="250">

It acts as a blue light filter and makes your display use warmer colors, according to your likings. This applet, **Blue Light Blocker**, also allows you to control the brightness of your screen at will. 

# :sunglasses: YOU are in control!
Some applets are time-based, meaning they only block blue light at certain times of the day. The user has no control over the blue light filtering.

With Blue Light Blocker, however, you are in total control!

Is it still day time? Is it night time? Who cares! Don't let the clock dictate when your screen has to block blue light from entering your precious little eyes! 👁️ 👄 👁️

You want to block blue light *all day*? You got it!

You want to block blue light *only at night*? It's your call, boss!

You want to block blue light *only when you feel like it*? No problemo! 

You can enable and disable this applet anytime in merely 2 clicks! 
Adjusting the warmth tone of your screen or it's brightness has never been easier, thanks to simple sliders with real-time feedback!

What a time to be alive :relieved: :sparkles:

# :construction_worker: Usage
Click on the Blue Light Blocker Applet in the panel and use the sliders to modify the color temperature of your screen or its brightness.

 <img alt="Using Blue Light Blocker" src="https://github.com/user-attachments/assets/5300ee3f-28e9-4ad9-8547-edab8240591a" width="381" height="220">

# :wrench: Configuration

Right click on the Blue Light Blocker applet in your panel and click on 'Configure...'

<img alt="Opening the configuration window" src="https://github.com/user-attachments/assets/2c608c1c-71c6-41be-b5b3-8f21b34f9b95" width="253" height="167">
<img alt="Configuration window" src="https://github.com/user-attachments/assets/8d66fc1e-1d92-4d39-aa8a-03af1d648ab8" width="300" height="250">

# 🚧 Possible Future Features
- Allow the user to use a custom icon/image for the applet in the panel
- Allow the user to display a custom format for the color temperature in brightness info in the panel
- Translations for other languages


### What's `xsct` and why is it required?
`xsct` is a public domain (open-source, but better) UNIX tool that allows you to change the color temperature of your screen. However, it only functions via terminal commands, which is a total pain in the butt to use if you
frequently change the color temperature of your screen. 

Blue Light Blocker uses this UNIX tool at its core and provides a user-friendly interface to let the user block the blue light from their screen
using precise sliders while also adding a layer of security by making it impossible for the user to set the brightness of their screens to 0, which is possible with `xsct` via the terminal commands. 
Blue Light Blocker also adds a lot of Quality of Life features that simply don't exist with the `xsct` package alone. 

In short, Blue Light Blocker reduces the amount of tinkering necessary to change the brightness or the color temperature of your screen while also offering a simple yet very nice user experience.

For more information about `xsct` : https://github.com/faf0/sct


