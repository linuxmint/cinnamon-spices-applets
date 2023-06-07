#!/usr/bin/env python3
# -*- coding:Utf-8 -*-

# Author : Claude CLERC <claude.clerc@gmail.com>

"""
Description:
This script generates the VPN-Sentinel@claudiux.pot file from the contents
of the metadata.json file, and settings-schema.json and applet.js files
which are in version sub-directories (2.8, 3.8 and so on); all these
files are supposedly well-formed.
"""
from os import popen
from os.path import *
from time import strftime

applet_name = "VPN-Sentinel@claudiux"
author_mail = "Claudiux <claude.clerc@gmail.com>"

subdirs = ['2.8', '3.8', '4.2'] ### Adapt it to development !!! ###

home_path = expanduser("~")
share_path = home_path + "/.local/share"
applet_path = share_path + "/cinnamon/applets/" + applet_name

pot_path = applet_path + "/po/" + applet_name + ".pot"
metadata_json = applet_path + "/metadata.json"

pot_file = open(pot_path, 'wt')

# metadata.json file:
mj_file = open(metadata_json, 'rt')
lines = mj_file.readlines()
mj_file.close()

metadata = eval("""\n""".join(lines).replace("true", "True").replace("false","False"))
version = metadata["version"]
applet_version = input("Version of %s (default: %s)? " % (applet_name, version))
if applet_version.strip()=="":
    applet_version = version


# Intro:
pot_file.write(r'''# %s Applet POT File.
# Copyright (C) 2017-2019 %s
# This file is distributed under the same license as the Cinnamon package.
# FIRST AUTHOR %s, 2017.
#
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: %s v%s\n"
"Report-Msgid-Bugs-To: %s\n"
"POT-Creation-Date: %s\n"
"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\n"
"Language-Team: LANGUAGE <LL@li.org>\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"

''' % (applet_name, author_mail, author_mail, applet_name, applet_version, author_mail, strftime("%Y-%m-%d %H:%M%z")) )

def isfloat(s):
    try:
        float(s)
    except ValueError:
        return False
    return True
# // End of isfloat

ids = []

l=""
i=0
for line in lines:
    i+=1
    li=line.strip()
    if li.startswith('"name"') or li.startswith('"description"'):
        #print(li)
        l = li.split(":",1)[1].strip()
        l = l[:l.rfind('"')+1]
        if not l in ids:
            ids.append(l)
            pot_file.write(r'#: metadata.json:'+str(i)+'\n')
            pot_file.write(r'msgid '+ l + '\n')
            pot_file.write('msgstr ""\n\n')

pot_file.flush()

for subdir in subdirs:
    settings_schema_json = applet_path + '/' + subdir + "/settings-schema.json"
    applet_js = applet_path  + '/' + subdir + "/applet.js"

    # settings-schema.json file:

    sc_file = open(settings_schema_json, 'rt')
    lines = sc_file.readlines()
    sc_file.close()


    i=0
    while i < len(lines):
        line = lines[i]
        i+=1
        li=line.strip()
        if li.startswith('"description"') or li.startswith('"tooltip"') or li.startswith('"units"') or li.startswith('"title"'):
            l = li.split(":",1)[1].strip()
            l = l[:l.rfind('"')+1]
            if not l in ids:
                ids.append(l)
                pot_file.write(r'#: ' + subdir + '/settings-schema.json:'+str(i)+'\n')
                pot_file.write(r'msgid '+ l + '\n')
                pot_file.write('msgstr ""\n\n')
        elif li.startswith('"options"'):
            while lines[i].strip().startswith('"'):
                li = lines[i].strip()
                i+=1
                l = li.split(":",1)[0].strip()
                l = l[:l.rfind('"')+1]
                if not l in ids and not isfloat(l[1:-1]):
                    ids.append(l)
                    pot_file.write(r'#: ' + subdir + '/settings-schema.json:'+str(i)+'\n')
                    pot_file.write(r'msgid '+ l + '\n')
                    pot_file.write('msgstr ""\n\n')

    pot_file.flush()

    # applet.js file

    ap_file = open(applet_js, 'rt')
    lines = ap_file.readlines()
    ap_file.close()

    i=0
    while i < len(lines):
        line = lines[i].strip()
        i+=1
        while line.count('_("')>0:
            debut = line.index('_("') + 2
            fin = line.find('")', debut) + 1
            l = line[debut:fin]
            if not l in ids:
                ids.append(l)
                pot_file.write(r'#: ' + subdir + r'/applet.js:'+str(i)+'\n')
                pot_file.write(r'msgid '+ l + '\n')
                pot_file.write('msgstr ""\n\n')
            line = line[fin:]

pot_file.close()

if exists(pot_path):
    print("The file %s has been successfully created.\nYou can use it with poedit to create .po files." % pot_path)
    if exists("/usr/bin/poedit"):
        poedit_it = input("Do you want to run poedit with this file? (Y/n)")
        if poedit_it.lower() in ["y", "yes", "o", "oui", ""]:
            popen("/usr/bin/poedit %s" % pot_path)

else:
    print("Something wrong append ! %s does'n exist." % pot_path)
