# Nerd Dictation Applet

A Cinnamon desktop environment panel applet front-end for the offline voice dictation utility `nerd-dictation`.

## Features
*   **Offline speech recognition**: Uses the Vosk API speech models through `nerd-dictation`.
*   **Simple controls**: Toggle dictation on/off with a single click, or select active speech input/locale from settings.
*   **Cross-window input injection**: Integrates with `xdotool` (X11) or `dotool` (Wayland) to automatically type spoken words into the currently active text input field.
*   **Visual feedback**: Microphone color indicators on the panel displaying current recording/dictation status.

## Requirements
*   `nerd-dictation` command-line utility.
*   A compatible Vosk voice recognition language model.
*   `xdotool` (for X11 sessions) or `dotool` (for Wayland sessions) to inject text.
