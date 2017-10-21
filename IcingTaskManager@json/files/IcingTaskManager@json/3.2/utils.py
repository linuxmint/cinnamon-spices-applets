import subprocess
import os
import json
import sys
import random

cli = sys.argv

"""
Utility script that creates GDesktop files for Wine and other window backed applications.
"""
def handleCli():

    if cli[1] == 'get_process':
        try:
            process = subprocess.check_output('cat /proc/{}/cmdline'.format(cli[2]), shell=True)
        except OSError:
            print('')
            return

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

        try:
            procArray = process.split('/')
            paLen = len(procArray)
            processName = procArray[paLen - 1].title()

            # Since this is a window backed app, make sure it has an icon association.

            iconsDir = '{}/.local/share/icons/hicolor/48x48/apps/'.format(os.getenv('HOME'))

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
                    subprocess.check_output('gnome-exe-thumbnailer {} {}'.format(process.split('wine ')[1], icon), shell=True)
                except IndexError:
                    subprocess.check_output('gnome-exe-thumbnailer {} {}'.format(process, icon), shell=True)
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
                gMenu += 'Icon={}\n'.format(icon)


            if '.exe' in process:
                gMenu += 'GenericName=Wine application\n' \
                         'Categories=Wine;\n' \
                         'MimeType=application/x-ms-dos-executable;application/x-msi;application/x-ms-shortcut; \n' \

            desktopFile = 'icing_{}.desktop'.format(str(random.random()).split('.')[1])
            desktopPath = '{}/.local/share/applications/{}'.format(os.getenv('HOME'), desktopFile)

            with open(desktopPath, 'w') as desktop:
                desktop.write(gMenu)
                subprocess.check_output('chmod +x {}'.format(desktopPath), shell=True)
                print(desktopFile)

        except KeyError as e:
            print('')
            return

    else:
        subprocess.call('gnome-terminal', shell=True)

handleCli()

