import os
import json
from collections import OrderedDict

def importConfig():
    helpMessage = ' Please go to the Github page for manual instructions: https://github.com/jaszhix/icingtaskmanager'

    applets = ['WindowListGroup@jake.phy@gmail.com', 'IcingTaskManager@json']

    oldPinned = None

    for applet in applets:

        path = os.getenv('HOME')+'/.cinnamon/configs/'+applet

        try:
            configName = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f))]
            configPath = path+'/'+configName[0]
            with open(configPath) as data:
                config = json.load(data)

                try:
                    if 'WindowListGroup' in applet:
                        oldPinned = config['pinned-apps']
                    else:
                        config['pinned-apps'] = oldPinned
                        config['pinned-apps']['default'] = []

                        with open(configPath, 'wb') as data:
                            data.write(json.dumps(config))

                except KeyError:
                    print('Old configuration file is corrupt.'+helpMessage)
                    return
        except OSError:
            print('There was an issue importing your pinned apps.'+helpMessage)
            return

    print('Pinned apps imported successfully. Please restart Cinnamon for the changes to come into effect.')

importConfig()