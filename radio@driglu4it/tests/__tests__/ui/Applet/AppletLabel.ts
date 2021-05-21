import { createAppletLabel } from "ui/Applet/AppletLabel";
const { EllipsizeMode } = imports.gi.Pango


const text1 = "dummy"
const text2 = "text2"


it('initialization is working', () => {
    const label = createAppletLabel()

    // @ts-ignore
    expect(label.actor.reactive).toBe(true)
    // @ts-ignore
    expect(label.actor.track_hover).toBe(true)
    expect(label.actor.style_class).toBe('applet-label')
    // @ts-ignore
    expect(label.actor.clutter_text.ellipsize).toBe(EllipsizeMode.NONE)
})


describe('setting text and visibility is working', () => {

    it('text is applied when visibility has been set before', () => {
        const label = createAppletLabel()

        label.setVisibility(true)
        label.setText(text1)
        expect(label.actor.text).toBe(` ${text1}`)
    })

    it('text is saved internally and applied when visibility is set', () => {
        const label = createAppletLabel()
        label.setText(text1)

        expect(label.actor.text).toBeUndefined()

        label.setVisibility(true)

        expect(label.actor.text).toBe(` ${text1}`)

    })

    it('text can be changed once set', () => {
        const label = createAppletLabel()
        label.setVisibility(true)
        label.setText(text1)
        label.setText(text2)

        expect(label.actor.text).toBe(` ${text2}`)
    })

    it('text is not applied when visibility is false', () => {
        const label = createAppletLabel()
        label.setVisibility(false)
        label.setText(text1)

        expect(label.actor.text).toBeUndefined()
    })

    it('setting text to null is working', () => {
        const label = createAppletLabel()
        label.setVisibility(true)
        label.setText(null)

        // @ts-ignore
        expect(label.actor.visible).toBe(false)

        label.setText(text1)

        // @ts-ignore
        expect(label.actor.visible).toBe(true)
        expect(label.actor.text).toBe(` ${text1}`)
    })

    it('text is saved internally while visibility is false', () => {
        const label = createAppletLabel()

        label.setVisibility(false)
        label.setText(text1)
        label.setVisibility(true)

        expect(label.actor.text).toBe(` ${text1}`)
    })
})

