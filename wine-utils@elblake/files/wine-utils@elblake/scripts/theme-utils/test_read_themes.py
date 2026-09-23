
##
## Test reading themes
##

import read_theme_gtk2
import read_theme

import os
import sys
import math

class TestThemes(read_theme.ReadSystemTheme):
    def __init__(self):
        return

    def test_theme_file(self, filename):
        b = read_theme_gtk2.ThemeFile()
        self.color1 = b.load(filename)


def test_all_themes():
    themedirs = []
    themes_to_fix = [
        ## Add theme names to fix here
        #"ThemeName"
    ]
    if os.getenv("XDG_DATA_HOME") != None:
        for f1 in os.getenv("XDG_DATA_HOME").split(":"):
            filename = os.path.join(f1, "themes")
            if os.path.isdir(filename):
                themedirs.append(filename)
    if os.getenv("HOME") != None:
        for f1 in os.getenv("HOME").split(":"):
            filename = os.path.join(f1, ".themes")
            if os.path.isdir(filename):
                themedirs.append(filename)
    for f1 in os.getenv("XDG_DATA_DIRS").split(":"):
        filename = os.path.join(f1, "themes")
        if os.path.isdir(filename):
            themedirs.append(filename)

    for themedir in themedirs:
        #if os.path.isdir(themedir):
        if len(themes_to_fix) > 0:
            dir_list = themes_to_fix
        else:
            dir_list = os.listdir(themedir)
        for theme in dir_list:
            if theme == '.' or theme == '..':
                continue
            print("----")
            print("Theme: " + theme)
            filename = os.path.join(themedir, theme, "gtk-2.0/gtkrc")
            if os.path.isfile(filename):
                #try:
                    t = TestThemes()
                    t.test_theme_file(filename)
                    c = t.get_colors(1.5, 0.5)
                    print(c)
                #except ValueError:
                #    print(theme + ": ValueError")
                #except KeyError:
                #    print(theme + ": KeyError")
                
            else:
                print(theme + ": no GTK2 theme")

if __name__ == '__main__':
    test_all_themes()


