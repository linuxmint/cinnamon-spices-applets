import subprocess
import os
import json
import sys
import random
from collections import OrderedDict
import threading
from functools import wraps

cli = sys.argv

# Work in progress (experimental) transient window handler.

def delay(delay=0.):
    """
    Decorator delaying the execution of a function for a while.
    """
    def wrap(f):
        @wraps(f)
        def delayed(*args, **kwargs):
            timer = threading.Timer(delay, f, args=args, kwargs=kwargs)
            timer.start()
        return delayed
    return wrap

def __reload(_delay):
    @delay(_delay)
    def reloadApp():
        try:
            subprocess.check_output("dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'IcingMenu@json' string:'APPLET'", shell=True)
        except subprocess.CalledProcessError:
            pass
    
    reloadApp()

def handleCli():

    if cli[1] == 'reload':
        __reload(0)
        return

    else:
        subprocess.call('gnome-terminal', shell=True)

handleCli()

