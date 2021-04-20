import { PopupMenuItem } from './PopupMenuItem'
import { PopupSubMenuMenuItem } from './PopupSubMenuMenuItem'
import { Button } from './Button'
import { Tooltip } from './Tooltip'
import { Icon } from './Icon'

enum IconType {
    SYMBOLIC,
    FULLCOLOR
}

export function setGlobal() {
    (global as any).imports = {
        ui: {
            popupMenu: {
                PopupMenuItem,
                PopupSubMenuMenuItem
            },
            tooltips: {
                Tooltip
            }
        },
        gi: {
            St: {
                Button,
                Icon,
                IconType
            }
        }
    }

}

