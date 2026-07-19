Gemini Sidebar Applet

# Gemini Sidebar Applet

An elegant and highly responsive sidebar applet for the Cinnamon Desktop that seamlessly integrates Google Gemini into your workspace.

## 1. System Dependencies

Before using this applet, you must install the required Python 3 and WebKit libraries so the sidebar can render correctly. Open your terminal and run the following command:

```bash
sudo apt update && sudo apt install -y python3-gi python3-gi-cairo gir1.2-webkit2-4.1


## 2. Manual Installation (Using File Manager - No Terminal)

If you are installing this manually from the downloaded folder:

1. Open your **File Manager** (Nemo) and go to your **Home** folder.
2. Press **Ctrl + H** on your keyboard to reveal hidden folders (you will see folders starting with a dot, like `.config`, `.local`).
3. Open the **`.local`** folder -> then open **`share`** -> then open **`cinnamon`** -> then open **`applets`**.
   *(Path: Home -> .local -> share -> cinnamon -> applets)*
4. Copy your extracted **`gemini-sidebar@bhuvee`** folder and **Paste** it directly inside this `applets` folder.

---

## 3. How to Enable and Add to the Desktop Panel

Once the folder is pasted inside the directory:

1. **Right-click** anywhere on an empty space on your desktop panel (taskbar).
2. Click on **Applets** from the menu. This will open the Applets management window.
3. In the "Manage" tab, scroll down and look for **Gemini Sidebar Applet**.
4. Click on it to highlight it, then click the **"+" (Add to panel)** button located at the bottom of the window.
5. The Gemini icon will now appear on your panel! 
6. *(Optional)* To move it, right-click the panel, turn on **Panel edit mode**, drag the icon to your preferred spot, and then right-click again to turn off edit mode.

## Features
* **20% Sidebar Layout:** Formatted perfectly to sit on the right side of your primary monitor.
* **Instant Toggle:** Fast loading visibility state that hides/shows the panel with a single click.
* **System Dark Theme Integration:** Synchronizes flawlessly with your desktop's dark mode.
