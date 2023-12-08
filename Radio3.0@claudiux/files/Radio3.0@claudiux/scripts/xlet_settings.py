#!/usr/bin/python3
import sys
#from os import environ
import os

#cinnamon_version = ".".join(environ["CINNAMON_VERSION"].split(".")[:-1])
#user_home = environ["HOME"]
xs_path = os.path.expanduser("~/.local/share/cinnamon/applets/Radio3.0@claudiux/xs")
sys.path.append(xs_path)
tmp = __import__('xlet-settings')
globals().update(vars(tmp))
