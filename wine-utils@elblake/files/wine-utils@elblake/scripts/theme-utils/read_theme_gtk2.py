
##
## Read the current desktop theme's GTK2 stylesheet
## to determine the colors.
##

import os
import re

class ThemeFile:
    def tstr(self, val):
        if val[0:1] == "\"":
            str1 = val[1:].split("\"",1)[0]
            arr = re.split("\\\\n|;", str1)
            for a in arr:
                arr1 = a.split(":",1)
                self.thm[arr1[0]] = arr1[1]
        else:
            return

    def color_shade(self, a, b1):
        [r,g,b] = b1
        r = a * r
        g = a * g
        b = a * b
        if r > 255.0:
            r = 255.0
        if g > 255.0:
            g = 255.0
        if b > 255.0:
            b = 255.0
        return [int(r),int(g),int(b)]

    def color_mix(self, a, color1, color2):
        if color1 == "?":
            return color2
        if color2 == "?":
            return color1
        [r1,g1,b1] = color1
        [r2,g2,b2] = color2
        a0 = 1.0 - a
        r = a * r2 + a0 * r1
        g = a * g2 + a0 * g1
        b = a * b2 + a0 * b1
        return [int(r),int(g),int(b)]

    def color_parse(self, a):
        if isinstance(a, str):
            a0 = a.strip()
            if a0[0:1] == "#":
                a2 = a0[1:]
                if len(a2) == 3:
                    r = int(a2[0:1], 16) << 4
                    g = int(a2[1:2], 16) << 4
                    b = int(a2[2:3], 16) << 4
                    return [r,g,b]
                else:
                    r = int(a2[0:2], 16)
                    g = int(a2[2:4], 16)
                    b = int(a2[4:6], 16)
                    return [r,g,b]
        return a

    def remove_comment(self, a):
        a = re.sub("#.+$", "", a)
        return a.rstrip()

    def tget_val(self, val):
        val = val.strip()
        if val[0:1] == "@":
            m = re.split("[ ,)#]+", val[1:], 1)
            if len(m) > 1:
                self.after = m[1]
            return self.color_parse(self.thm[m[0]])
        if val[0:1] == "\"":
            m = val[1:].split("\"",1)
            self.after = m[1]
            return self.color_parse(m[0])
        m = re.match("^\\{\\s*([0-9., ]+)\\s*\\}$", val)
        if m != None:
            [r,g,b] = m[1].split(",")
            return self.color_parse([
                int(float(r.strip())*255),
                int(float(g.strip())*255),
                int(float(b.strip())*255)])
        m = re.match("^(mix|shade)\\s*\\((.+)$", val)
        if m != None:
            if m[1] == "shade":
                a1 = m[2]
                a2_r = a1.split(",",1)
                color1 = self.color_parse(self.tget_val(a2_r[1]))
                return self.color_shade(float(a2_r[0].strip()), color1)
            if m[1] == "mix":
                a1 = m[2]
                a2_r = a1.split(",",1)
                color1 = self.color_parse(self.tget_val(a2_r[1]))
                color2 = self.color_parse(self.tget_val(self.after))
                return self.color_mix(float(a2_r[0].strip()), color1, color2)
        return "?"

    def tget(self, m1, m2, val):
        if not self.style_for in self.color0:
            self.color0[self.style_for] = {}
        self.color0[self.style_for][m1 + "." + m2] = self.tget_val(val)

    def load_theme(self, src, fdir, filename):
        with open(os.path.join(fdir, filename),"r") as d:
            for l in d:
                l1 = l.strip()
                if l1[0:8] == "include ":
                    l1 = l1[8:len(l)].strip()
                    self.load_theme(src, fdir, l1[1:len(l1)-1])
                else:
                    src.append(l)

    def load(self, filename):
        self.color0 = {}
        self.color1 = {}
        self.thm = {}
        src = []
        self.load_theme(src, os.path.dirname(filename), os.path.basename(filename))
        next_string = False
        self.style_for = "?"
        for a in src:
            a = a.strip()
            if a[0:1] == "#":
                continue            
            if a == "":
                continue
            if next_string:
                a = a.strip()
                if a[0:1] == "\"":
                    self.tstr(a)
                    next_string = False
            else:
                m = re.match("^widget_class[ \t]+\"\*<([^>]+)>[.*]<([^>]+)>[.*]<([^>]+)[^\"]+\"[ \t]+style[ \t]+\"([^\"]+)\"", a)
                if m != None:
                    if m[4] in self.color0:
                        for k in self.color0[m[4]].keys():
                            self.color1[m[1] + "." + m[2] + "." + m[3] + "." + k] = self.color0[m[4]][k]
                    continue
                m = re.match("^widget_class[ \t]+\"\*<([^>]+)>[.*]<([^>]+)[^\"]+\"[ \t]+style[ \t]+\"([^\"]+)\"", a)
                if m != None:
                    if m[3] in self.color0:
                        for k in self.color0[m[3]].keys():
                            self.color1[m[1] + "." + m[2] + "." + k] = self.color0[m[3]][k]
                    continue
                m = re.match("^widget_class[ \t]+\"\*<([^>]+)[^\"]+\"[ \t]+style[ \t]+\"([^\"]+)\"", a)
                if m != None:
                    if m[2] in self.color0:
                        for k in self.color0[m[2]].keys():
                            self.color1[m[1] + "." + k] = self.color0[m[2]][k]
                    continue
                m = re.match("^class[ \t]+\"([^\"]+)\"[ \t]+style[ \t]+\"([^\"]+)\"", a)
                if m != None:
                    if m[2] in self.color0:
                        for k in self.color0[m[2]].keys():
                            self.color1[m[1] + "." + k] = self.color0[m[2]][k]
                    continue

                m = re.match("^widget[ \t]+\"([^\"]+)\"[ \t]+style[ \t]+\"([^\"]+)\"", a)
                if m != None:
                    if m[2] in self.color0:
                        for k in self.color0[m[2]].keys():
                            self.color1[m[1] + "." + k] = self.color0[m[2]][k]
                    continue

                m = re.match("^style[ \t]+\"([^\"]+)\"[ \t]*=[ \t]*\"([^\"]+)\"", a)
                if m != None:
                    self.style_for = m[1]
                    continue
                m = re.match("^style[ \t]+\"([^\"]+)\"", a)
                if m != None:
                    self.style_for = m[1]
                    continue
                
                a2 = a.split("=",1)
                if len(a2) > 1:
                    a2_0 = a2[0].strip()
                    a2_1 = a2[1].strip()
                    if (a2_0 == "gtk-color-scheme") or (a2_0 == "gtk_color_scheme"):
                        if a2_1 == "":
                            next_string = True
                        else:
                            self.tstr(a2_1)
                    else:
                        m = re.match("^([a-z]+)\\[([A-Z]+)\\]", a2_0)
                        if m != None:
                            w1 = m[1]
                            w2 = m[2]
                            if w1 in ["bg","fg","text","base"]:
                                if w2 in ["NORMAL","PRELIGHT","SELECTED","INSENSITIVE","ACTIVE"]:
                                    self.tget(w1, w2.lower(), a2_1)
        return self.color1


