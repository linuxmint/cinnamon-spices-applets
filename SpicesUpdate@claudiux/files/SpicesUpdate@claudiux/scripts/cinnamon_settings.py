#!/usr/bin/python3
import sys
from os import environ

cinnamon_version = ".".join(environ["CINNAMON_VERSION"].split(".")[:-1])
user_home = environ["HOME"]
cs_path = "%s/.local/share/cinnamon/applets/SpicesUpdate@claudiux/cs/%s" % (user_home, cinnamon_version, )
#sys.path.append("/usr/share/cinnamon/cinnamon-settings")
sys.path.append(cs_path)
tmp = __import__('cinnamon-settings')
globals().update(vars(tmp))
