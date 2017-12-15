#!/usr/bin/env python3
# -*- coding:Utf-8 -*-

# Author : Claude CLERC <claude.clerc@gmail.com>

"""
Description:
This script generate the vpnLookOut@claudiux.pol about files 
metadata.json, settings-schema.json and applet.js
"""

from os.path import *
import time

applet_name = "vpnLookOut@claudiux"
applet_version = input("Version de %s ? " % applet_name)
author_mail = "Claudiux <claude.clerc@gmail.com>"

home_path = expanduser("~")
share_path = home_path + "/.local/share"
applet_path = share_path + "/cinnamon/applets/" + applet_name

pot_path = applet_path + "/po/" + applet_name + ".pot"
metadata_json = applet_path + "/metadata.json"
settings_schema_json = applet_path + "/settings-schema.json"
applet_js = applet_path + "/applet.js"

pot_file = open(pot_path, 'wt')

# Intro:
pot_file.write(r'''# SOME DESCRIPTIVE TITLE.
# Copyright (C) YEAR THE PACKAGE'S COPYRIGHT HOLDER
# This file is distributed under the same license as the PACKAGE package.
# FIRST AUTHOR <EMAIL@ADDRESS>, YEAR.
#
#, fuzzy
msgid ""
msgstr ""
"Project-Id-Version: %s v%s\n"
"Report-Msgid-Bugs-To: %s\n"
"POT-Creation-Date: 2017-12-02 19:59+0100\n"
"PO-Revision-Date: %s\n"
"Last-Translator: FULL NAME <EMAIL@ADDRESS>\n"
"Language-Team: LANGUAGE <LL@li.org>\n"
"MIME-Version: 1.0\n"
"Content-Type: text/plain; charset=UTF-8\n"
"Content-Transfer-Encoding: 8bit\n"
"X-Generator: Poedit 1.8.7.1\n"

''' % (applet_name, applet_version, author_mail, time.strftime("%Y-%m-%d %H:%M%z")) )

# metadata.json file:
mj_file = open(metadata_json, 'rt')
lines = mj_file.readlines()
mj_file.close()


l=""
i=0
for line in lines:
    i+=1
    li=line.strip()
    if li.startswith('"description"'):
        #print(li)
        l = li.split(":",1)[1].strip()
        l = l[:l.rfind('"')+1]
        pot_file.write(r'#: metadata.json:'+str(i)+'\n')
        pot_file.write('msgid '+ l + '\n')
        pot_file.write('msgstr ""\n\n')

pot_file.flush()

# settings-schema.json file:

sc_file = open(settings_schema_json, 'rt')
lines = sc_file.readlines()
sc_file.close()

ids = []

i=0
while i < len(lines):
    line = lines[i]
    i+=1
    li=line.strip()
    if li.startswith('"description"') or li.startswith('"tooltip"') or li.startswith('"units"'):
        #print(li)
        l = li.split(":",1)[1].strip()
        l = l[:l.rfind('"')+1]
        if not l in ids:
            ids.append(l)
            pot_file.write(r'#: settings-schema.json:'+str(i)+'\n')
            pot_file.write('msgid '+ l + '\n')
            pot_file.write('msgstr ""\n\n')
    elif li.startswith('"options"'):
        while lines[i].strip().startswith('"'):
            li = lines[i].strip()
            i+=1
            l = li.split(":",1)[0].strip()
            l = l[:l.rfind('"')+1]
            if not l in ids:
                ids.append(l)
                pot_file.write(r'#: settings-schema.json:'+str(i)+'\n')
                pot_file.write('msgid '+ l + '\n')
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
            pot_file.write(r'#: applet.js:'+str(i)+'\n')
            pot_file.write('msgid '+ l + '\n')
            pot_file.write('msgstr ""\n\n')
        line = line[fin:]
  
pot_file.close()

