#!/usr/bin/python3
import sys
sys.path.append("/usr/share/cinnamon/cinnamon-settings")
tmp = __import__('cinnamon-settings')
globals().update(vars(tmp))

