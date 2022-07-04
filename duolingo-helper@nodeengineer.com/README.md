**Duolingo Helper Cinnamon Spice**

This applet helps you track your Duolingo progress and boost your motivation.

Features:
- the icon is a red "D" if you haven't reached your daily goal and a green "D" if you have
- your daily XP is also displayed on the panel
- if you click on the icon you will see the number of your crowns, the streak lenght and the number of lingots - just like on the website
- the data is fetched every 30 seconds
- click on the "Practise" button to open duolingo.com in the default browser
- authentication via Cinnamon-native keyring

Authentication troubleshooting:
The Duolingo Helper will prompt you to enter your credentials (you may also be asked to unlock the keyring).
If the stored credentials are wrong they will be deleted from the keyring and you will be prompted again to enter them.

If you have issues with the authentication you can use `secret-tool` for troubleshooting:
- install secret-tool:
```
sudo apt-get install -y libsecret-tools
```
- lookup duolingo.com credentials:
```
secret-tool lookup site duolingo.com
```
- manually store credentials:
```
secret-tool store --label="Duolingo" site duolingo.com
```
- clear credentials:
```
secret-tool clear site duolingo.com
```

Last updated:
Mon 06 Jun 2022 10:36:12 AM CEST
