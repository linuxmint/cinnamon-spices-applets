import { BasePopupMenu } from "./BasePopupMenu"
import { ErrorPopupMenu, ErrorPopupMenuProps } from "./ErrorPopupMenu"
import { FishMessagePopupMenu, FishMessagePopupMenuProps } from "./FishMessagePopupMenu"
import { FoolsDayPopupMenu, FoolsDayPopupMenuProps } from "./FoolsDayPopupMenu"

export type PopupMenuType = "FishMessage" | "FoolsDay" | "Error"
export type PopupMenuPropsMap = {
  FishMessage: FishMessagePopupMenuProps
  FoolsDay: FoolsDayPopupMenuProps
  Error: ErrorPopupMenuProps
}
export type PopupMenuOptions = {
  styleClassName: string
}
export type PopupMenuProps = {
  [key in PopupMenuType]: {
    popupMenuType: key
    popupMenuProps: PopupMenuPropsMap[key]
    popupMenuOptions?: PopupMenuOptions
  }
}[PopupMenuType]

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class PopupMenuFactory {
  static createPopupMenu(props: PopupMenuProps): BasePopupMenu {
    const { popupMenuType, popupMenuProps, popupMenuOptions } = props
    let popupMenu: BasePopupMenu

    switch (popupMenuType) {
      case "FishMessage":
        popupMenu = new FishMessagePopupMenu(popupMenuProps)
        break
      case "FoolsDay":
        popupMenu = new FoolsDayPopupMenu(popupMenuProps)
        break
      case "Error":
        popupMenu = new ErrorPopupMenu(popupMenuProps)
        break
      default:
        throw new Error("Unknown popup menu type")
    }

    if (popupMenuOptions?.styleClassName) {
      popupMenu.addStyleClassName(popupMenuOptions.styleClassName)
    }

    return popupMenu
  }
}
