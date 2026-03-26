# Hijri Date Applet for Cinnamon

A Cinnamon desktop panel applet that displays the current Hijri (Islamic) date using
the [Aladhan API](https://aladhan.com/prayer-times-api). The date updates at a configurable interval and supports both
Arabic and English display options.

## Features

* Displays current Hijri date on the Cinnamon panel
* Configurable:

    * Language (Arabic or English)
    * Date format (`DD-MM-YYYY`, `YYYY-MM-DD`, `Month Day, Year`)
    * Show numeric month or month name
    * Separator character (e.g., `-`, `/`, ` `)
    * Refresh interval
* Converts numbers to Arabic numerals when Arabic language is selected

## Requirements

* Internet connection (to fetch Hijri date from Aladhan API)

## Settings

You can access settings via the applet's right-click menu.

* **Language:** Display date in English or Arabic
* **Date Format:** Choose between different formats
* **Month Display:** Show month as a name or number
* **Separator:** Customize the separator character
* **Refresh Interval:** Set how often the date should update (in seconds)

## API Used

[Aladhan](https://aladhan.com/islamic-calendar-api#get-/gToH/-date-)

## Feedback

You can leave a comment on [cinnamon-spices.linuxmint.com](https://cinnamon-spices.linuxmint.com/) or create an issue on
my [Hijri Applet](https://github.com/mubashirzamir/hijri-applet) development GitHub repository.

This is where I develop new features and test ideas before submitting updates to the official Cinnamon Spices
repository.

If you find this applet useful, please let me know by liking it both on the Cinnamon Spices site and on GitHub. Your
feedback and support help motivate continued development and improvements.