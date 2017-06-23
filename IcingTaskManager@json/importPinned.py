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
                        orderedConfig = OrderedDict([
                            ('ITM', config['ITM']), 
                            ('seperator0', config['seperator0']), 
                            ('autoUpdate', config['autoUpdate']),
                            ('WindowList', config['WindowList']), 
                            ('seperator1', config['seperator1']), 
                            ('number-display', config['number-display']), 
                            ('title-display', config['title-display']),
                            ('pinned-apps', config['pinned-apps']),
                            ('group-apps', config['group-apps']),                
                            ('show-alerts', config['show-alerts']),
                            ('show-pinned', config['show-pinned']),
                            ('arrange-pinnedApps', config['arrange-pinnedApps']),
                            ('pinOnDrag', config['pinOnDrag']),
                            ('middle-click-action', config['middle-click-action']),
                            ('cycleMenusHotkey', config['cycleMenusHotkey']),
                            ('show-apps-order-hotkey', config['show-apps-order-hotkey']),
                            ('show-apps-order-timeout', config['show-apps-order-timeout']),
                            ('Thumbnails', config['Thumbnails']),
                            ('seperator4', config['seperator3']),
                            ('thumbnail-timeout', config['thumbnail-timeout']),
                            ('thumbnail-size', config['thumbnail-size']),
                            ('show-thumbnails', config['show-thumbnails']),
                            ('animate-thumbnails', config['animate-thumbnails']),
                            ('vertical-thumbnails', config['vertical-thumbnails']),
                            ('sort-thumbnails', config['sort-thumbnails']),
                            ('onclick-thumbnails', config['onclick-thumbnails']),
                            ('include-all-windows', config['include-all-windows']),
                            ('AppMenu', config['AppMenu']),
                            ('seperator5', config['seperator4']),
                            ('show-recent', config['show-recent']),
                            ('menuItemType', config['menuItemType']),
                            ('firefox-menu', config['firefox-menu']),
                            ('autostart-menu-item', config['autostart-menu-item']),
                            ('monitor-move-all-windows', config['monitor-move-all-windows']),
                            ('HoverPeek', config['HoverPeek']),
                            ('seperator3', config['seperator2']),
                            ('enable-hover-peek', config['enable-hover-peek']),
                            ('hover-peek-time', config['hover-peek-time']),
                            ('hover-peek-opacity', config['hover-peek-opacity']),
                            ('ThemeSettings', config['ThemeSettings']),
                            ('seperator2', config['seperator2']),
                            ('show-active', config['show-active']),
                            ('icon-spacing', config['icon-spacing']),
                            ('icon-padding', config['icon-padding']),
                            ('themePadding', config['themePadding']),
                            ('enable-iconSize', config['enable-iconSize']),
                            ('icon-size', config['icon-size']),
                            ('hoverPseudoClass', config['hoverPseudoClass']),
                            ('focusPseudoClass', config['focusPseudoClass']),
                            ('activePseudoClass', config['activePseudoClass']),
                            ('panelLauncherClass', config['panelLauncherClass']),
                            ('close-button-style', config['close-button-style']),
                            ('useSystemTooltips', config['useSystemTooltips']),
                            ('__md5__', config['__md5__']),
                            ])

                        orderedConfig['pinned-apps'] = oldPinned
                        orderedConfig['pinned-apps']['default'] = []

                        with open(configPath, 'wb') as data: 
                            data.write(json.dumps(orderedConfig))

                except KeyError:
                    print('Old configuration file is corrupt.'+helpMessage)
                    return
        except OSError:
            print('There was an issue importing your pinned apps.'+helpMessage)
            return

    print('Pinned apps imported successfully. Please restart Cinnamon for the changes to come into effect.')

importConfig()