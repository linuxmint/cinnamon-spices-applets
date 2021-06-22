const createActivWidget = jest.fn(() => { })
import { Arguments as ActivWidgetArgs } from 'lib/ActivWidget'

jest.mock('lib/ActivWidget', () => ({
    createActivWidget
}))

import { limitString } from "functions/limitString";
import { createIconMenuItem } from "lib/IconMenuItem";
const maxCharNumber = 10

const text1 = 'TextWithMoreThan10Chars'
const text1Limited = limitString(text1, maxCharNumber)
const text2 = 'dummy'

const iconName1 = 'media-playback-start'
const iconName2 = 'media-playback-pause'


describe('correctly initialized', () => {
    it('setting only text is working', () => {
        const iconMenuItem = createIconMenuItem({
            text: text1,
            maxCharNumber
        })

        const childen = iconMenuItem.actor.get_children()
        const expectedLabel = childen[0] as imports.gi.St.Label

        expect(childen.length).toBe(1)
        expect(expectedLabel.text).toBe(text1Limited)
    });

    it('setting only icon is working', () => {
        const iconMenuItem = createIconMenuItem({
            iconName: iconName1,
            maxCharNumber
        })

        const childen = iconMenuItem.actor.get_children()
        const expectedIcon = childen[0] as imports.gi.St.Icon
        const expectedLabel = childen[1] as imports.gi.St.Label

        expect(expectedIcon.icon_name).toBe(iconName1)
        expect(expectedLabel.text).toBe(' ')
    })

    it('createActivWidget is called when providing onActivated function', () => {

        const onActivated = function () { }

        const iconMenuItem = createIconMenuItem({
            iconName: iconName1,
            maxCharNumber,
            onActivated
        })

        const expectedActivatedWidgetArgs: ActivWidgetArgs = {
            widget: iconMenuItem.actor,
            onActivated
        }

        expect(createActivWidget).toHaveBeenCalledWith(expectedActivatedWidgetArgs)
    })

});

describe('IconName setter working', () => {
    it('setting iconName when not set before', () => {
        const iconMenuItem = createIconMenuItem({
            maxCharNumber
        })

        iconMenuItem.setIconName(iconName1)

        const children = iconMenuItem.actor.get_children()
        const icon = children[0] as imports.gi.St.Icon

        expect(icon.icon_name).toBe(iconName1)
    })

    it('setting iconName twice', () => {
        const iconMenuItem = createIconMenuItem({
            maxCharNumber
        })

        iconMenuItem.setIconName(iconName1)
        iconMenuItem.setIconName(iconName2)

        const children = iconMenuItem.actor.get_children()
        const icon = children[0] as imports.gi.St.Icon

        expect(icon.icon_name).toBe(iconName2)
    })

    it('setting iconName to null removes the icon', () => {
        const iconMenuItem = createIconMenuItem({
            maxCharNumber,
            iconName: iconName1
        })

        iconMenuItem.setIconName(null)

        const children = iconMenuItem.actor.get_children()
        const label = children[0] as imports.gi.St.Label

        expect(label.text).toBe(' ')
        expect(children.length).toBe(1)
    })

});

describe('Text setter working', () => {
    it('setting text when not set before', () => {
        const iconMenuItem = createIconMenuItem({
            maxCharNumber
        })

        iconMenuItem.setText(text1)

        const children = iconMenuItem.actor.get_children()
        const label = children[0] as imports.gi.St.Label

        expect(label.text).toBe(text1Limited)
    });

    it('setting text twice', () => {
        const iconMenuItem = createIconMenuItem({
            maxCharNumber
        })

        iconMenuItem.setText(text1)
        iconMenuItem.setText(text2)

        const children = iconMenuItem.actor.get_children()
        const label = children[0] as imports.gi.St.Label

        expect(label.text).toBe(text2)
    })

    it('setting text to null', () => {
        const iconMenuItem = createIconMenuItem({
            maxCharNumber,
            text: text1
        })

        iconMenuItem.setText(null)

        const children = iconMenuItem.actor.get_children()
        const label = children[0] as imports.gi.St.Label

        expect(label.text).toBe(' ')
    })
});