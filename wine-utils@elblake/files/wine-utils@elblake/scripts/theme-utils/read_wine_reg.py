
##
## Read the Wine registry settings
##

import re
import os
from os import path

import subprocess
import font_struct

class ReadWineReg:

    def __init__(self, prefix):
        if prefix[0:2] == "~/":
            prefix = path.join(os.getenv("HOME"), prefix[2:])
        if (path.isdir(prefix) and
                path.isdir(path.join(prefix,"dosdevices")) and
                path.isfile(path.join(prefix,"user.reg"))):
            self.readkeys = [
                "Control Panel\\Colors",
                "Control Panel\\Desktop\\WindowMetrics"]
            self.values = {}
            self.prefix = prefix
        else:
            raise "not wine prefix"

    def read(self):
        self.read_direct()

    def read_direct(self):
        readkeys = []
        for key in self.readkeys:
            readkeys.append(key.replace("\\", "\\\\"))
        use_subkeys = False
        subkey_name = ""
        subkey = ""
        self.subkeys = {}
        next_append = False
        
        regfile = path.join(self.prefix, "user.reg")
        with open(regfile, "r") as d:
            for l in d:
                if l[0:1] == "[" and not next_append:
                    key = re.match("^\[([A-Za-z]+[ A-Za-z0-9\\\\]+)\] ", l)
                    if key != None:
                        key = key[1]
                        if subkey != "":
                            self.values[subkey_name] = self.parse_direct(subkey_name, subkey)
                            subkey = ""
                        if key in readkeys:
                            use_subkeys = True
                        else:
                            use_subkeys = False
                elif use_subkeys:
                    l = l.rstrip()
                    if next_append:
                        next_append = False
                        if l[len(l)-1:len(l)] == "\\":
                            next_append = True
                            subkey = subkey + l[0:len(l)-1].lstrip()
                        else:
                            subkey = subkey + l.lstrip()
                    else:
                        lsub = re.match("^\"([ A-Za-z0-9]+)\"=(.+)$", l)
                        if lsub != None:
                            if subkey != "":
                                self.values[subkey_name] = self.parse_direct(subkey_name, subkey)
                            subkey_name = lsub[1]
                            l = lsub[2]
                            if l[len(l)-1:len(l)] == "\\":
                                next_append = True
                                subkey = l[0:len(l)-1]
                            else:
                                subkey = l
            if subkey != "":
                self.values[subkey_name] = self.parse_direct(subkey_name, subkey)

    def parse_direct(self, name, val):
        if val[0:4] == "hex:":
            font = font_struct.FontStruct()
            font.parse(name, val)
            return [font.fontname, font.weight, font.fontsize, font.italic]
        else:
            lsub = re.match("^\"([0-9]+) ([0-9]+) ([0-9]+)\"$", val)
            if lsub != None:
                return [int(lsub[1]), int(lsub[2]), int(lsub[3])]
            lsub = re.match("^\"([-0-9]+)\"$", val)
            if lsub != None:
                return int(lsub[1])
            return val


