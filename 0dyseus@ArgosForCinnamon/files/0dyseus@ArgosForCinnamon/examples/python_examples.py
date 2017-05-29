#!/usr/bin/python3

import gettext
import os

APPLET_UUID = "0dyseus@ArgosForCinnamon"
HOME = os.path.expanduser("~")
TRANSLATIONS = {}


def _(string):
    # check for a translation for this xlet
    if APPLET_UUID not in TRANSLATIONS:
        try:
            TRANSLATIONS[APPLET_UUID] = gettext.translation(
                APPLET_UUID, HOME + "/.local/share/locale").gettext
        except IOError:
            try:
                TRANSLATIONS[APPLET_UUID] = gettext.translation(
                    APPLET_UUID, "/usr/share/locale").gettext
            except IOError:
                TRANSLATIONS[APPLET_UUID] = None

    # do not translate white spaces
    if not string.strip():
        return string

    if TRANSLATIONS[APPLET_UUID]:
        result = TRANSLATIONS[APPLET_UUID](string)

        try:
            result = result.decode("utf-8")
        except:
            result = result

        if result != string:
            return result

    return gettext.gettext(string)


print("""
{e_1} | iconName=folder dropdown=false
{e_2} | iconName=folder iconIsSymbolic=true dropdown=false
---
<b>{e_3}</b> | iconName=folder iconSize=24 size=12
--<i><b>{e_3_0}</b></i>
--{e_3_1} | iconName=folder tooltip='{e_3_2}' eval='imports.ui.main.notify("{e_3_3}", "{e_3_4}");'
--{e_3_5} | iconName=folder iconIsSymbolic=true tooltip='{e_3_6}' eval='imports.ui.main.notify("{e_3_7}", "{e_3_8}");' alternate=true
--{e_3_9} | iconName=folder href='https://lazka.github.io/pgi-docs/'
--{e_3_10} | iconName=folder iconIsSymbolic=true href='http://distrowatch.com/' alternate=true
--{e_3_11} | iconName=folder href='~/.cinnamon/glass.log'
--{e_3_12} | iconName=folder iconIsSymbolic=true href='~/.xsession-errors' alternate=true
---
<b>{e_4}</b> | iconName=folder iconSize=24 size=12
--{e_4_1}
----{e_4_2}
----{e_4_3}
------{e_4_4}
------{e_4_5}
--------{e_4_6}
---
<b>{e_5}</b> | iconName=folder iconSize=24 size=12
--<b><i>{e_5_1}</i></b>
--{e_5_2} | iconName=folder iconSize=12 iconIsSymbolic=true
--{e_5_3} | iconName=folder iconSize=14
--{e_5_4} | iconName=folder iconSize=16 iconIsSymbolic=true
--{e_5_5} | iconName=folder iconSize=18
--{e_5_6} | iconName=folder iconSize=20 iconIsSymbolic=true
---
<b>{e_6}</b> | iconName=folder iconSize=24 size=12
--\033[34m{e_6_0} :smile:\033[0m | ansi=true size=20
--\033[30m:smiley_cat: \033[31m:smile_cat: \033[32m:joy_cat: \033[33m:heart_eyes_cat: \033[34m:smirk_cat: \033[35m:kissing_cat: \033[36m:scream_cat: | ansi=true size=20
--\033[30m:smiley: \033[31m:smile: \033[32m:joy: \033[33m:heart_eyes: \033[34m:smirk: \033[35m:kissing: \033[36m:scream: | ansi=true size=20
---
<b>{e_7}</b> | iconName=folder iconSize=24 size=12
--<b>{e_7_1}</b> | size=12
--<b>{e_7_2}</b> - <i>{e_7_3}</i> - <s>{e_7_4}</s> - <u>{e_7_5}</u> | size=12
--{e_7_6}<sub>{e_7_6}</sub> - {e_7_7}<sup>{e_7_7}</sup> | size=12
--<big>{e_7_8}</big> - <small>{e_7_9}</small> - <tt>{e_7_10}</tt> | size=12
--<b>{e_8}</b> | size=12
--<span font_weight='bold' bgcolor='#FF0000' fgcolor='#FFFF00'>{e_8_1}</span> | size=12
--<span underline='single' underline_color='#FF0000'>{e_8_2}</span> | size=12
--<span underline='double' underline_color='#00FF00'>{e_8_3}</span> | size=12
--<span underline='low' underline_color='#FF00FF'>{e_8_4}</span> | size=12
--<span underline='error' underline_color='#00FFFF'>{e_8_5}</span> | size=12
""".format(
    e_1=_("Argos line 1"),
    e_2=_("Argos line 2"),
    # TO TRANSLATORS:
    # The words "eval", "tooltip" and "alternate" are attributes
    # and aren't meant to be translated.
    e_3=_("eval, tooltip and alternate examples"),
    # TO TRANSLATORS:
    # The word "eval" is an attribute and isn't meant to be translated.
    e_3_0=_("Press Alt key to see effect"),
    e_3_1=_("Default item - eval example"),
    e_3_2=_("Default item tooltip - Press Alt key to display alternate item"),
    e_3_3=_("Default item"),
    e_3_4=_("Notification activated by default item."),
    e_3_5=_("Alternate item - eval example"),
    e_3_6=_("Alternate item tooltip"),
    e_3_7=_("Alternate item"),
    e_3_8=_("Notification activated by alternate item."),
    e_3_9=_("Default - PyGObject API Reference - URL example"),
    e_3_10=_("Alternate - DistroWatch - URL example"),
    e_3_11=_("Default - Looking Glass log - URI to file example"),
    e_3_12=_("Alternate - xsession-errors log - URI to file example"),
    e_4=_("Menu and submenu examples"),
    e_4_1=_("Sub menu level 2"),
    e_4_2=_("Sub menu item level 2"),
    e_4_3=_("Sub menu level 3"),
    e_4_4=_("Sub menu item level 3"),
    e_4_5=_("Sub menu level 4"),
    e_4_6=_("Sub menu item level 4"),
    e_5=_("Menu items with icons examples"),
    e_5_1=_("A default icon size can be set on the applet settings window"),
    e_5_2=_("Item with a 12 pixels symbolic icon"),
    e_5_3=_("Item with a 14 pixels icon"),
    e_5_4=_("Item with a 16 pixels symbolic icon"),
    e_5_5=_("Item with a 18 pixels icon"),
    e_5_6=_("Item with a 20 pixels symbolic icon"),
    e_6=_("ANSI colors and emojis examples"),
    e_6_0=_("ANSI colors example"),
    e_7=_("Pango markup examples"),
    e_7_1=_("Convenience tags"),
    e_7_2=_("Bold text"),
    e_7_3=_("Italic text"),
    e_7_4=_("Strikethrough text"),
    e_7_5=_("Underline text"),
    e_7_6=_("Subscript text"),
    e_7_7=_("Superscript text"),
    e_7_8=_("Big text"),
    e_7_9=_("Small text"),
    e_7_10=_("Monospace font"),
    # TO TRANSLATORS: Full sentence:
    # "<span> attributes", which means "attributes that can be used on
    # the Pango tag called span"
    e_8=_("%s attributes") % "&lt;span&gt;",
    e_8_1=_("Background and foreground colors"),
    e_8_2=_("Single underline"),
    e_8_3=_("Double underline"),
    e_8_4=_("Low underline"),
    e_8_5=_("Error underline")
))
