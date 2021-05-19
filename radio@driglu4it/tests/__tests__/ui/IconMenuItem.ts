import { limitString } from "functions/limitString"
import { createIconMenuItem } from "ui/IconMenuItem"

const text1 = 'TextWithMoreThan10Chars'
const text2 = "dummy2"

const iconName1 = 'media-playback-start'
const iconName2 = 'media-playback-pause'

const maxCharNumber = 10

afterEach(() => {
    jest.clearAllMocks();
})

function getChildren(iconMenuItem: ReturnType<typeof createIconMenuItem>) {
    //@ts-ignore
    return iconMenuItem.actor._children
}

describe('correctly initialized', () => {
    it('normal text is set correctly', () => {

        const iconMenuItem = createIconMenuItem({
            text: text1, maxCharNumber
        })

        const [{ actor: label }] = getChildren(iconMenuItem)

        const limitedTextString = limitString(text1, maxCharNumber)
        expect(label.text).toBe(limitedTextString)
    })

    it('empty string is handled correclty', () => {
        const iconMenuItem = createIconMenuItem({
            text: '', maxCharNumber
        })

        const [{ actor: label }] = getChildren(iconMenuItem)
        expect(label.text).toBe(' ')
    })


    it('icon is set correctly', () => {

        const iconMenuItem = createIconMenuItem({
            text: text1,
            iconName: iconName1,
            maxCharNumber
        })

        const [
            { actor: icon, ...iconParams },
            { actor: label }
        ] = getChildren(iconMenuItem)

        const limitedTextString = limitString(text1, maxCharNumber)

        expect(icon.icon_name).toBe(iconName1)
        expect(iconParams.span).toBe(0)
        expect(label.text).toBe(limitedTextString)
    })

    it('reactive params passed correclty', () => {

        // a random sample. Expecting that when this passed all others props are also passed
        const reactive = false
        const params = {
            reactive
        }

        const iconMenuItem = createIconMenuItem({
            text: text1,
            iconName: iconName1,
            params,
            maxCharNumber
        })

        // @ts-ignore
        expect(iconMenuItem.actor.actor.track_hover).toBe(reactive)
    })
})

describe('changing iconName is working', () => {
    it('new Icon is added when initially no icon is set', () => {
        const iconMenuItem = createIconMenuItem({
            text: text1, maxCharNumber
        })

        iconMenuItem.setIconName(iconName1)

        const [
            { actor: icon, ...iconParams },
            { actor: label }
        ] = getChildren(iconMenuItem)

        const limitedTextString = limitString(text1, maxCharNumber)

        expect(icon.icon_name).toBe(iconName1)
        expect(iconParams.span).toBe(0)
        expect(label.text).toBe(limitedTextString)
    })

    it('icon name is changed when icon initially set', () => {
        const iconMenuItem = createIconMenuItem({
            iconName: iconName1,
            text: text1,
            maxCharNumber
        })

        const [
            { actor: icon, },
        ] = getChildren(iconMenuItem)

        iconMenuItem.setIconName(iconName2)
        expect(icon.icon_name).toBe(iconName2)
    })

    it('icon gets removed when icon name set to null', () => {
        const iconMenuItem = createIconMenuItem({
            iconName: iconName1,
            text: text1,
            maxCharNumber
        })
        iconMenuItem.setIconName(null)

        const [
            { actor: label }
        ] = getChildren(iconMenuItem)

        const limitedTextString = limitString(text1, maxCharNumber)

        expect(label.text).toBe(limitedTextString)
    })

    it('icon can be added again after removing', () => {
        const iconMenuItem = createIconMenuItem({
            iconName: iconName1,
            text: text1,
            maxCharNumber
        })
        iconMenuItem.setIconName(null)
        iconMenuItem.setIconName(iconName2)

        const [
            { actor: icon, ...iconParams },
        ] = getChildren(iconMenuItem)

        expect(icon.icon_name).toBe(iconName2)
        expect(iconParams.span).toBe(0)
    })
})

describe('changing text is working', () => {
    it('changing to normal text is working', () => {
        const iconMenuItem = createIconMenuItem({
            text: text1,
            maxCharNumber
        })
        iconMenuItem.setText(text2)

        const [
            { actor: label }
        ] = getChildren(iconMenuItem)

        const limitedTextString = limitString(text2, maxCharNumber)
        expect(label.text).toBe(limitedTextString)
    })

    it('changing to empty string is working', () => {
        const iconMenuItem = createIconMenuItem({
            text: text1,
            maxCharNumber
        })
        iconMenuItem.setText('')
        const [
            { actor: label }
        ] = getChildren(iconMenuItem)
        expect(label.text).toBe(' ')
    })

})

