# rwall
rwall is a Cinnamon Applet which selects a random wallpaper for your desktop based on the information you provide. A query is run against wallhaven.cc which returns images in a random order; the image at the top of the list is selected, downloaded, and applied as the desktop wallpaper.

## Supported Platforms
The only testing I've done with this program has been on Linux Mint 17.3 (Cinnamon). My assumption is that it should work on other versions of Mint as well. It might work with Ubuntu (and possibly other distros) if you just use the rwall script as a cron job, but I haven't tested this to know. 

## Installation
Download here: https://cinnamon-spices.linuxmint.com/applets/view/250

Extract the ZIP and move the extracted directory to `~/.local/share/cinnamon/applets/`

Alternatively, you may clone this repository into your applets directory by doing the following

```
cd ~/.local/share/cinnamon/applets
git clone https://github.com/TypicalFooBar/rwall.git rwall@typicalfoobar
```
