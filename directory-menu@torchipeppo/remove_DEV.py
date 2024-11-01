from pathlib import Path
import shutil

directory = Path("files/directory-menu@torchipeppo")

# be very restrictive here to avoid accidents
po = list(directory.glob("po/*.po"))
for fname in po + [directory/"applet.js", directory/"popup_menu.py"]:
    with open(fname, "r") as f:
        content = f.read()
    content = content.replace("directory-menu-DEV", "directory-menu")
    content = content.replace("torchipeppo-DEV", "torchipeppo")
    with open(fname, "w") as f:
        f.write(content)

# here too, but rename also
potfile = directory/"po"/"directory-menu-DEV@torchipeppo-DEV.pot"
with open(potfile, "r") as f:
    content = f.read()
content = content.replace("directory-menu-DEV", "directory-menu")
content = content.replace("torchipeppo-DEV", "torchipeppo")
with open(directory/"po"/"directory-menu@torchipeppo.pot", "w") as f:
    f.write(content)
potfile.unlink()

# this is a small known file, let's get aggressive
with open(directory/"metadata.json", "r") as f:
    content = f.read()
content = content.replace("-DEV", "")
content = content.replace(" DEV", "")
content = content.replace(" (DEVELOPMENT)", "")
with open(directory/"metadata.json", "w") as f:
    f.write(content)

# reset icon
shutil.copy("icon-standard.png", directory/"icon.png")
