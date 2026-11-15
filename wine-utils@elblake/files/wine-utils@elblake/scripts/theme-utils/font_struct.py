
##
## Read or generate a font struct for the registry
##

import re
import struct

class FontStruct:
    def __init__(self, name="", fontname="sans-serif", fontsize=10, weight=500, italic=0):
        self.name = name
        self.fontname = fontname
        self.fontsize = fontsize
        self.weight = weight
        self.italic = italic

    def add_u32(self, val):
        byt = struct.pack("<I", val)
        return "{:02x},{:02x},{:02x},{:02x},".format(byt[0],byt[1],byt[2],byt[3])

    def add_u8(self, i):
        return "{:02x},".format(i)

    def add_widestr(self, fontname, maxsize):
        s = ""
        i = 0
        while maxsize > 0:
            if i < len(fontname):
                char = ord(fontname[i])
                byt = struct.pack("<H", char)
            else:
                byt = b"\x00\x00"
            i += 1
            s += "{:02x},{:02x}".format(byt[0],byt[1])
            maxsize = maxsize - 1
            if maxsize == 0:
                break
            s += ","
        return s

    ## Encode to a hex encoded font struct
    def enc(self):
        s = ""
        s += self.add_u32(self.fontsize) # height
        s += self.add_u32(0) # width
        s += self.add_u32(0) # escapement
        s += self.add_u32(0) # orientation
        s += self.add_u32(self.weight) # weight
        s += self.add_u8(self.italic)  # italic
        s += self.add_u8(0)
        s += self.add_u8(0)
        s += self.add_u8(0)
        s += self.add_u8(0)
        s += self.add_u8(0)
        s += self.add_u8(0) # quality
        s += self.add_u8(34) # pitch and family
        ## Face name in unicode
        s += self.add_widestr(self.fontname, 32)
        return "\"" + self.name + "\"=hex:" + s

    def get_u32(self):
        r = self.vals[0:4]
        self.vals = self.vals[4:]
        return struct.unpack("<I", bytes([int(r[0],16), int(r[1],16), int(r[2],16), int(r[3],16)]))[0]
    
    def get_u8(self):
        r = self.vals[0:1]
        self.vals = self.vals[1:]
        return int(r[0],16)
    
    def read_widestr(self, size):
        r = []
        i = 0
        while i < len(self.vals):
            char = struct.unpack("<H", bytes([ int(self.vals[i],16), int(self.vals[i+1],16) ]))[0]
            r.append(char)
            i = i + 2
        self.vals = self.vals[size:]
        while r[len(r)-1] == 0:
            r = r[0:len(r)-1]
        wstring = ""
        for v in r:
            wstring += chr(v)
        return wstring
    
    ## Parse a hex encoded font struct
    def parse(self, name, regstring):
        if m:=re.match("hex:(.+)$",regstring):
            self.name = name
            self.vals = m[1].split(",")
            
            self.fontsize = self.get_u32() # height
            _ = self.get_u32() # width
            _ = self.get_u32() # escapement
            _ = self.get_u32() # orientation
            self.weight = self.get_u32() # weight
            self.italic = self.get_u8() # italic
            _ = self.get_u8()
            _ = self.get_u8()
            _ = self.get_u8()
            _ = self.get_u8()
            _ = self.get_u8()
            _ = self.get_u8() # quality
            _ = self.get_u8() # pitch andfamily
            self.fontname = self.read_widestr(32)


