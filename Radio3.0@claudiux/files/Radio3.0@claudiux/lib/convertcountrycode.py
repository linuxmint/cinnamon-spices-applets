#!/usr/bin/python3
# -*- coding:Utf-8 -*-

# Author : Claude CLERC <cc@claudeclerc.fr> <claude.clerc@gmail.com>
with open("countrycode.csv", "rt") as i_file:
  lines = i_file.readlines()
  i_file.close()

lines.pop(0)

with open("countrycode.json", "wt") as o_file:
  o_file.write('     "(Undefined)": "",\n')
  for line in lines:
    name, code = line.strip().split(";")
    name = name.title()
    if name.count(",") > 0 :
      name = name[0:name.index(",")] + " (" + name[name.index(",")+1:].strip() + ")"
    o_file.write('      "%s - %s": "%s",\n' % (name, code, code))
  o_file.close()
