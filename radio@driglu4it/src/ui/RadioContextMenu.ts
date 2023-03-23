import { createPopupMenu, PopupMenuProps } from "../lib/PopupMenu";
import { createSeparatorMenuItem } from "../lib/PopupSeperator";
import { createSimpleMenuItem, SimpleMenuItemArguments } from "../lib/SimpleMenuItem";
import { createUpdateStationsMenuItem } from "./RadioPopupMenu/UpdateStationsMenuItem";

const { spawnCommandLineAsyncIO } = imports.misc.util
const { ConfirmDialog } = imports.ui.modalDialog
const AppletManager = imports.ui.appletManager;

const showRemoveAppletDialog = () => {
    const dialog = new ConfirmDialog(`Are you sure you want to remove '${__meta.name}'`, () => AppletManager['_removeAppletFromPanel'](__meta.uuid, __meta.instanceId))

    dialog.open()
}

const spawnCommandLineWithErrorLogging = (command: string) => {
    spawnCommandLineAsyncIO(command, (stdout, stderr) => {
        if (stderr) {
            global.logError(`Failed executing: ${command}. The following error occured: ${stderr}`)
        }
    })
}

export function createRadioContextMenu(args: PopupMenuProps) {

    const contextMenu = createPopupMenu(args)

    const defaultMenuArgs: SimpleMenuItemArguments[] = [
        {
            iconName: 'dialog-question',
            text: 'About...',
            onActivated: () => {
                spawnCommandLineWithErrorLogging(`xlet-about-dialog applets ${__meta.uuid}`)
            }
        },
        {
            iconName: 'system-run',
            text: 'Configure...',
            onActivated: () => {
                spawnCommandLineWithErrorLogging(`xlet-settings applet ${__meta.uuid} ${__meta.instanceId} -t 0`)
            }
        }, {
            iconName: 'edit-delete',
            text: `Remove '${__meta.name}`,
            onActivated: showRemoveAppletDialog
        }
    ]


    contextMenu.add_child(createUpdateStationsMenuItem())
    contextMenu.add(createSeparatorMenuItem())

    defaultMenuArgs.forEach((menuArg) => {
        const menuItem = createSimpleMenuItem({
            ...menuArg, onActivated: (self) => {
                contextMenu.close()
                menuArg.onActivated && menuArg?.onActivated(self)
            }
        })
        contextMenu.add_child(menuItem.actor)
    })

    return contextMenu
}