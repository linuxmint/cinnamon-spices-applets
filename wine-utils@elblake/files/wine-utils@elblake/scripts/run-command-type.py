#!/usr/bin/env python3

##
## Check if the command is an executable and should be called with
## wine or wineconsole, or if it should be called with start.
##

import sys
import os
import re

import run_command_paths

def command_is_exe(wine_path_var, prefix, command):
    cmd = command.strip()
    
    return command_is_exe_quote(wine_path_var, prefix, cmd)

def command_is_exe_quote(wine_path_var, prefix, cmd):
    m = re.match("^\w{2,}:", cmd)
    if m != None:
        return False

    ## Not in prefix, might be an exe, but since it is outside prefix it
    ## is called with start
    if os.path.isfile(cmd):
        return 'not-exe-outside-prefix'

    m = re.match("^([A-Za-z]:)?(.+[\\\\/])?(.+\.(\\w{3}))$", cmd)
    if m != None:
        drive = m[1]
        edir = m[2]
        cmd0 = m[3]
        ext = m[4]
        if (drive == None) and (edir == None):
            return command_is_exe_ext(wine_path_var, prefix, cmd0, ext)
        else:
            return command_is_exe_path_ext(prefix, cmd0, run_command_paths.abs_path(drive, edir), ext)

    m = re.match("^([A-Za-z]:)?(.+[\\\\/])?([^.]+)$", cmd)
    if m != None:
        drive = m[1]
        edir = m[2]
        cmd0 = m[3]
        if (drive == None) and (edir == None):
            return command_is_exe_no_ext(wine_path_var, prefix, cmd0)
        else:
            return command_is_exe_path_no_ext(prefix, cmd0, run_command_paths.abs_path(drive, edir))

    m = re.match("^([^.]+)$", cmd)
    if m != None:
        cmd0 = m[1]
        return command_is_exe_no_ext(wine_path_var, prefix, cmd0)

    return False

def command_is_exe_ext(wine_path_var, prefix, cmd0, ext):
    ext = ext.lower()
    if (ext in ["bat", "cmd", "exe", "com"]):
        return True
    elif (ext in ["lnk"]):
        return False
    else:
        return False

def command_is_exe_no_ext(wine_path_var, prefix, cmd0):
    for winedir in run_command_paths.split_path_var(wine_path_var):
        cmd_dir = os.path.join(prefix, "dosdevices", winedir)
        for ext in [".bat", ".cmd", ".exe", ".com"]:
            file = os.path.join(cmd_dir, cmd0 + ext)
            if run_command_paths.isfile_ci(file):
                return True
    return False

def command_is_exe_path_ext(prefix, cmd0, path, ext):
    ext = ext.lower()
    if ext in ["bat", "cmd", "exe", "com"]:
        cmd_dir = os.path.join(prefix, "dosdevices", path)
        file = os.path.join(cmd_dir, cmd0)
        if run_command_paths.isfile_ci(file):
            return True
    if ext in ["lnk"]:
        cmd_dir = os.path.join(prefix, "dosdevices", path)
        file = os.path.join(cmd_dir, cmd0)
        if run_command_paths.isfile_ci(file):
            return False
    return False

def command_is_exe_path_no_ext(prefix, cmd0, path):
    cmd_dir = os.path.join(prefix, "dosdevices", path)
    for ext in [".bat", ".cmd", ".exe", ".com"]:
        file = os.path.join(cmd_dir, cmd0 + ext)
        if run_command_paths.isfile_ci(file):
            return True
    return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: <prefix> <command>",file=sys.stderr)
        sys.exit(1)
    
    wine_path_var = None
    if "WINEPATHVAR" in os.environ:
        wine_path_var = os.environ["WINEPATHVAR"].strip()
    if wine_path_var == None:
        wine_path_var = "C:\\windows\\system32;C:\\windows"
    t = command_is_exe(wine_path_var, sys.argv[1], sys.argv[2])
    if t == "not-exe-outside-prefix":
        print("not-exe-outside-prefix")
    elif t == True:
        print("exe")
    else:
        print("not-exe")


