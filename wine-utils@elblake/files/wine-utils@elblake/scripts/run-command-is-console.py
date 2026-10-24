#!/usr/bin/env python3

##
## Check if console window should be used.
##

import sys
import os
import subprocess
import re

import run_command_paths

def run_in_console(wine_path_var, prefix, command):
    cmd = command.strip()
    
    return run_in_console_quote(wine_path_var, prefix, cmd)

def check_type(file):
    try:
        str1 = subprocess.check_output(["file","-p","-b","--extension",file]).decode().strip()
        if re.match("^exe/com/v", str1) != None:
            return False
        if re.match("^exe/scr", str1) != None:
            return False
        if re.match("^exe/com", str1) != None:
            return True
        return False
    except subprocess.CalledProcessError:
        return False

def run_in_console_quote(wine_path_var, prefix, cmd):
    ## Direct path
    if os.path.isfile(cmd):
        return check_type(cmd)

    m = re.match("^\w{2,}:", cmd)
    if m != None:
        return False

    m = re.match("^([A-Za-z]:)?(.+[\\\\/])?(.+\.(\\w{3}))$", cmd)
    if m != None:
        drive = m[1]
        edir = m[2]
        cmd0 = m[3]
        ext = m[4]
        if (drive == None) and (edir == None):
            return run_in_console_ext(wine_path_var, prefix, cmd0, ext)
        else:
            return run_in_console_path_ext(prefix, cmd0, run_command_paths.abs_path(drive, edir), ext)

    m = re.match("^([A-Za-z]:)?(.+[\\\\/])?([^.]+)$", cmd)
    if m != None:
        drive = m[1]
        edir = m[2]
        cmd0 = m[3]
        if (drive == None) and (edir == None):
            return run_in_console_no_ext(wine_path_var, prefix, cmd0)
        else:
            return run_in_console_path_no_ext(prefix, cmd0, run_command_paths.abs_path(drive, edir))

    m = re.match("^([^.]+)$", cmd)
    if m != None:
        cmd0 = m[1]
        return run_in_console_no_ext(wine_path_var, prefix, cmd0)

    return False

def run_in_console_ext(wine_path_var, prefix, cmd0, ext):
    ext = ext.lower()
    if ext == 'bat' or ext == 'cmd':
        return True
    for winedir in run_command_paths.split_path_var(wine_path_var):
        cmd_dir = os.path.join(prefix, "dosdevices", winedir)
        file = os.path.join(cmd_dir, cmd0)
        if run_command_paths.isfile_ci(file):
            return check_type(run_command_paths.fix_filename(file))
    return False

def run_in_console_no_ext(wine_path_var, prefix, cmd0):
    for winedir in run_command_paths.split_path_var(wine_path_var):
        cmd_dir = os.path.join(prefix, "dosdevices", winedir)
        for ext in [".bat", ".cmd"]:
            file = os.path.join(cmd_dir, cmd0 + ext)
            if run_command_paths.isfile_ci(file):
                return True
        for ext in [".exe", ".com"]:
            file = os.path.join(cmd_dir, cmd0 + ext)
            if run_command_paths.isfile_ci(file):
                return check_type(run_command_paths.fix_filename(file))
    return False

def run_in_console_path_ext(prefix, cmd0, path, ext):
    ext = ext.lower()
    if ext == 'bat' or ext == 'cmd':
        return True
    cmd_dir = os.path.join(prefix, "dosdevices", path)
    file = os.path.join(cmd_dir, cmd0)
    if run_command_paths.isfile_ci(file):
        return check_type(run_command_paths.fix_filename(file))
    return False


def run_in_console_path_no_ext(prefix, cmd0, path):
    cmd_dir = os.path.join(prefix, "dosdevices", path)
    for ext in [".bat", ".cmd"]:
        file = os.path.join(cmd_dir, cmd0 + ext)
        if run_command_paths.isfile_ci(file):
            return True
    for ext in [".exe", ".com"]:
        file = os.path.join(cmd_dir, cmd0 + ext)
        if run_command_paths.isfile_ci(file):
            return check_type(run_command_paths.fix_filename(file))
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
    if run_in_console(wine_path_var, sys.argv[1], sys.argv[2]):
        print("console")
    else:
        print('-')

