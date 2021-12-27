const { panelManager } = imports.ui.main
const { getAppletDefinition } = imports.ui.appletManager;
const { Icon, IconType } = imports.gi.St
const { Point } = imports.gi.Clutter


export function createAppletIcon(props?: ConstructorParameters<typeof Icon>[0]) {

    const icon_type = props?.icon_type || IconType.SYMBOLIC

    const appletDefinition = getAppletDefinition({
        applet_id: __meta.instanceId,
    })

    const panel = panelManager.panels.find(panel =>
        panel?.panelId === appletDefinition.panelId
    ) as imports.ui.panel.Panel


    const locationLabel = appletDefinition.location_label

    function getIconSize() {
        return panel.getPanelZoneIconSize(locationLabel, icon_type)
    }

    function getStyleClass() {
        return icon_type === IconType.SYMBOLIC ? 'system-status-icon' : 'applet-icon'
    }

    const icon = new Icon({
        icon_type,
        style_class: getStyleClass(),
        icon_size: getIconSize(),
        pivot_point: new Point({ x: 0.5, y: 0.5 }), 
        ...props
    })

    panel.connect('icon-size-changed', () => {
        icon.set_icon_size(getIconSize())
    })

    icon.connect('notify::icon-type', () => {
        icon.style_class = getStyleClass()
    })

    return icon

}