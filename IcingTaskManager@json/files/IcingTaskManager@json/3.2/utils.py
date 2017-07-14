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
            subprocess.check_output("dbus-send --session --dest=org.Cinnamon.LookingGlass --type=method_call /org/Cinnamon/LookingGlass org.Cinnamon.LookingGlass.ReloadExtension string:'IcingTaskManager@json' string:'APPLET'", shell=True)
        except subprocess.CalledProcessError:
            pass

    reloadApp()

def handleCli():

    if cli[1] == 'reload':
        __reload(0)
        return

    if cli[1] == 'get_process':
        try:
            process = subprocess.check_output('cat /proc/'+cli[2]+'/cmdline', shell=True)

            if '.exe' in process:
                if 'Z:' in process:
                    process = process.split('Z:')[1]

                process = process.replace('\\', '/')
                process = process.split('.exe')[0] + '.exe'
                process = 'wine '+process.replace(' ', '\ ')

            process = json.dumps(process)

            if '\u0000' in process:
                process = process.replace('\u0000', ' ')

            process = json.loads(process)

            if not '.exe' in process:

                process = process[:-1]

            if process == 'python mainwindow.py':
                process = 'playonlinux'

            path = os.getenv('HOME')+'/.cinnamon/configs/IcingTaskManager@json'

            try:
                configName = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]
                configPath = path+'/'+configName[0]

                with open(configPath) as data:
                    config = json.load(data)

                    try:
                        procArray = process.split('/')
                        paLen = len(procArray)
                        processName = procArray[paLen - 1].title()

                        # Since this is a window backed app, make sure it has an icon association.

                        iconsDir = os.getenv('HOME')+'/.local/share/icons/hicolor/48x48/apps/'

                        if '\ ' in processName:
                            processName = processName.replace('\ ', ' ')

                        if '.Exe' in processName:
                            processName = processName.replace('.Exe', '')

                        iconFile = processName+'.png'

                        if ' ' in iconFile:
                            iconFile = iconFile.replace(' ', '')

                        icon = iconsDir+iconFile

                        try:
                            try:
                                subprocess.check_output('gnome-exe-thumbnailer '+process.split('wine ')[1]+' '+icon, shell=True)
                            except IndexError:
                                subprocess.check_output('gnome-exe-thumbnailer '+process+' '+icon, shell=True)
                        except subprocess.CalledProcessError:
                            icon = None

                        gMenu = '[Desktop Entry]\n' \
                                'Type=Application\n' \
                                'Encoding=UTF-8\n' \
                                'Name='+processName+'\n' \
                                'Comment='+processName+'\n' \
                                'Exec='+process+'\n' \
                                'Terminal=false\n' \
                                'StartupNotify=true\n' \

                        if icon:
                            gMenu += 'Icon='+icon+'\n'


                        if '.exe' in process:
                            gMenu += 'GenericName=Wine application\n' \
                                     'Categories=Wine;\n' \
                                     'MimeType=application/x-ms-dos-executable;application/x-msi;application/x-ms-shortcut; \n' \


                        desktopFile = 'icing-'+str(random.random()).split('.')[1]+'.desktop'
                        desktopPath = os.getenv('HOME')+'/.local/share/applications/'+desktopFile

                        with open(desktopPath, 'w') as desktop:
                            desktop.write(gMenu)

                            config['pinned-apps']['value'].append(desktopFile)

                            subprocess.check_output('chmod +x '+desktopPath, shell=True)

                            with open(configPath, 'w') as data:
                                data.write(json.dumps(config))
                                __reload(1.0)

                    except KeyError as e:
                        print('KeyError', e)
                        return
            except OSError:
                print('OSError')
                return

        except KeyError as e:
            print('KeyError', e)
            return

    else:
        subprocess.call('gnome-terminal', shell=True)

handleCli()

