# cinnamon-printers
## printers@linux-man
Cinnamon applet - Manage Jobs and Printers

Czech translation by Radek71(<https://github.com/Radek71>), tweaked by p-bo(<https://github.com/p-bo>)

German translation by NikoKrause(<https://github.com/NikoKrause>)

Russian translation by Andreevlex(<https://github.com/Andreevlex>)

Swedish translation by [eson57](https://github.com/eson57)

Chinese translation by [giwhub](https://github.com/giwhub)

Croatian translation by [muzena](https://github.com/muzena)

French corrections by Christophe Hortemel

Danish translation by [Alan01](https://github.com/Alan01)

### Changelog

### 1.0
    Implement Scrollbars on cancel jobs list
    Wait for update to finish to display the menu

### 0.9.1
    Use pkexec to "Restart CUPS"

### 0.9
    Configuration: "Reload Applet" and "Restart CUPS" buttons

### 0.8
    Applet also updates when closing menu

### 0.7
    Applet only updates when receives a Cups signal - faster Menu toggle
    3s timeout between updates
    More error conditions
    Code cleanup

### 0.6
    Get rid of the loop - applet updates when clicked or receive a Cups signal

### 0.5
    Compatibility with Cinnamon 3.2
    Vertical panels (setAllowedLayout)
    Allow multiple instances

### 0.4
    Using async calls (spawn_async)

### 0.3
    Correctly show unicode chars

### 0.2
    Minor changes

### 0.1
    Initial release
