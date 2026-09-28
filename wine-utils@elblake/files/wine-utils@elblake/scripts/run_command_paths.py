
##
## Functions in common with run-command-is-console.py and run-command-type.py
##

import sys
import os
import subprocess
import re

def split_path_var(paths):
    pathlist = []
    for path in paths.split(";"):
        path = re.sub("[\\\\]+", "/", path)
        m = re.match("^([A-Za-z]:)(/.+)$", path)
        if m != None:
            pathlist.append(m[1].lower() + m[2])
    return pathlist


memoized_dirs = {}
def fix_dir_case(filedir):
    global memoized_dirs
    if os.path.isdir(filedir):
        return filedir
    if filedir in memoized_dirs:
        return memoized_dirs[filedir]
    actualdir = fix_dir_case(os.path.dirname(filedir))
    base = os.path.basename(filedir).lower()
    for d in os.listdir(actualdir):
        if d.lower() == base:
            memoized_dirs[filedir] = os.path.join(actualdir, d)
            return os.path.join(actualdir, d)
    return None

## Case insensitive isfile
cached_listdir_for = None
cached_listdir = None
def isfile_ci(file):
    global cached_listdir_for
    global cached_listdir
    if os.path.isfile(file):
        return True
    filedir = os.path.dirname(file)
    base = os.path.basename(file)
    if not os.path.isdir(filedir):
        filedir = fix_dir_case(filedir)
    if filedir == None:
        return False
    if not os.path.isdir(filedir):
        return False
    if cached_listdir_for != filedir:
        cached_listdir_for = filedir
        cached_listdir = {}
        for d in os.listdir(filedir):
            cached_listdir[d.lower()] = d
    if base.lower() in cached_listdir:
        if os.path.isfile(os.path.join(filedir, cached_listdir[base.lower()])):
            return True
    return False

def fix_filename(file):
    global cached_listdir_for
    global cached_listdir
    filedir = os.path.dirname(file)
    base = os.path.basename(file)
    if cached_listdir_for != filedir:
        return file
    if base.lower() in cached_listdir:
        return os.path.join(filedir,cached_listdir[base.lower()])
    return file



def abs_path(drive, edir):
    if edir == None:
        edir = "/"
    if drive == None:
        if re.match("^\\\\{2}", edir) != None:
            edir = re.sub("[\\\\/]+", "/", re.sub("^[\\\\/]+", "", edir))
            return "unc/" + edir
        else:
            drive = "z:"
            if re.match("^[^\\\\/]", edir) != None:
                edir = "/" + edir
            edir = re.sub("[\\\\/]+", "/", edir)
            return drive + edir
    else:
        if re.match("^[^\\\\/]", edir) != None:
            edir = "/" + edir
        edir = re.sub("[\\\\/]+", "/", edir)
        return drive + edir

