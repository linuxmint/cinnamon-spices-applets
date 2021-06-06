import { createApplet } from "ui/Applet/Applet"
const { Icon, Label } = imports.gi.St
const { BoxLayout } = imports.gi.St
const { Event } = imports.gi.Clutter

const { AllowedLayout } = imports.ui.applet;

const panelHeight = 40
const orientation = imports.gi.St.Side.TOP
const instanceId = 96
const onClick = () => { }
const onMiddleClick = () => { }
const onAppletRemovedFromPanel = () => { }
const onScroll = jest.fn(() => { })

const icon = new Icon()
const label = new Label()

it('initialization is working', () => {

    // looks ugly but no idea how to better test this :-(
    jest
        .spyOn(BoxLayout.prototype, 'connect')
        // @ts-ignore
        .mockImplementation((signal: any, cb: (actor: any, event: any) => void) => {
            if (signal === 'scroll-event') {
                cb(null, new Event())
            }
        })

    const applet = createApplet({
        onClick,
        icon,
        instanceId,
        label,
        onAppletRemovedFromPanel,
        onMiddleClick,
        onScroll,
        orientation,
        panelHeight
    })


    expect(applet._panelHeight).toBe(panelHeight)
    expect(applet["_orientation"]).toBe(orientation)
    expect(applet.instance_id).toBe(instanceId)
    expect(applet.on_applet_clicked).toBe(onClick)
    expect(applet.on_applet_middle_clicked).toBe(onMiddleClick)
    expect(applet.on_applet_removed_from_panel).toBe(onAppletRemovedFromPanel)

    expect(onScroll).toHaveBeenCalled()

    expect(applet["_allowedLayout"]).toBe(AllowedLayout.BOTH)
    // @ts-ignore
    expect(applet.actor.get_child_at_index(0).child).toBe(icon)
    // @ts-ignore
    expect(applet.actor.get_child_at_index(1).child).toBe(label)

})