
##
## Write changes to a registry file and use a WINE prefix's regedit to
## update the registry properly.
##

import os
from os import path
import tempfile
import subprocess

import font_struct

class WriteWineReg:

    def __init__(self, prefix, wine_cmd, colors, handle=None):
        if prefix[0:2] == "~/":
            prefix = path.join(os.getenv("HOME"), prefix[2:])
        ## Check that the prefix path is valid
        if (path.isdir(prefix) and
                path.isdir(path.join(prefix,"dosdevices")) and
                path.isfile(path.join(prefix,"user.reg"))):
            self.handle = handle
            self.colors = colors
            self.prefix = prefix
            self.wine_cmd = wine_cmd
        else:
            raise "not wine prefix"

    def write(self):
        if self.handle == None:
            with tempfile.NamedTemporaryFile(mode="w") as regfile:
                self.handle = regfile
                self.menu_color()
                regfile.flush()
                self.add_to_registry(regfile.file.name)


    def color(self, name, c):
        return "\"{:s}\"=\"{:d} {:d} {:d}\"".format(name,c[0],c[1],c[2])

    def add_to_registry(self, regfile):
        env = os.environ
        env["WINE_PREFIX"] = self.prefix
        ret = subprocess.call([self.wine_cmd, "reg", "import", regfile], env=env)
        if ret == 0:
            return True
        else:
            raise "write error"

    def print_color(self, name):
        if (name in self.colors) and (self.colors[name] != None):
            self.handle.write(self.color(name, self.colors[name]) + "\n")

    def print_font(self, name):
        if (name in self.colors) and (self.colors[name] != None):
            (fontname, weight, size, italic) = self.colors[name]
            f = font_struct.FontStruct(name, fontname, size, weight, italic)
            self.handle.write(f.enc() + "\n")

    def menu_color(self):
        self.handle.write("Windows Registry Editor Version 5.00\n")
        self.handle.write("\n")

        self.handle.write("[HKEY_CURRENT_USER\\Control Panel\\Colors]\n")
        for w in ["Menu", "MenuBar", "MenuHilight", "MenuText", "ActiveBorder",
                  "ButtonAlternateFace","ButtonDkShadow","ButtonFace","ButtonHilight",
                  "ButtonLight","ButtonShadow","ButtonText","GrayText","Hilight",
                  "InactiveTitleText","InfoText","InfoWindow","Scrollbar",
                  "Window","WindowFrame","WindowText"]:
            self.print_color(w)
        self.handle.write("\n")

        self.handle.write("[HKEY_CURRENT_USER\\Control Panel\\Desktop\\WindowMetrics]\n")
        for w in ["CaptionFont","MenuFont","MessageFont","StatusFont"]:
            self.print_font(w)
        self.handle.write("\n")



## Test writing to registry
if __name__ == '__main__':
    t = WriteWineReg("~/.wine", "wine", {"InactiveTitleText":[139, 128, 110]})
    t.write()




