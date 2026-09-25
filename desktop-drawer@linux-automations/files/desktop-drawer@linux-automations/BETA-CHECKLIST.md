# Desktop Drawer beta check

Candidate: 1.2.1. Use a test folder with harmless demo files.

Record your Linux distribution, Cinnamon version, X11 or Wayland session,
display scale, and whether you use a keyboard, mouse or assistive technology.

## Install

1. Save any existing `desktop-drawer@linux-automations` directory before replacing it.
2. Extract the installation ZIP into `~/.local/share/cinnamon/applets/`.
   It contains one directory named `desktop-drawer@linux-automations`.
3. Add Desktop Drawer from Cinnamon's Applets settings.

## Try it without help

- [ ] Find Choose folder and select the test folder. Its name appears at the top.
- [ ] Open one text file and one folder with your normal desktop applications.
- [ ] Open a subfolder by mouse and keyboard. Test Right, Left, Enter and Escape.
- [ ] Turn hover off. Moving over the panel icon and subfolders should not open them.
- [ ] Turn hover on and change the panel delay. Reopen the drawer to check it.
- [ ] Add a folder named Private with a demo file inside. Only the folder action appears.
- [ ] Repeat with Private inside another subfolder.
- [ ] Select an empty folder. A clear empty message and Choose folder remain available.
- [ ] Rename the selected folder outside the applet, then reopen the drawer.
      The error should leave a way to choose another folder.
- [ ] Check a long filename, a filename in your language, and a folder with many files.
- [ ] Check your usual light or dark theme and display scale.
- [ ] Remove and re-add the applet. Your selected folder is remembered and files are unchanged.

Write down any step that was confusing, failed, or needed explanation.
Do not include private paths or filenames in a public report.

## Current evidence

Automated tests cover the native menu, settings window, folder states,
keyboard Right and Left, Escape, hover controls and removal/re-addition.
File and folder dispatch has been tested with an isolated desktop handler.
Testing with your normal file manager and document applications is still useful.

Passing this checklist does not replace maintainer review.
