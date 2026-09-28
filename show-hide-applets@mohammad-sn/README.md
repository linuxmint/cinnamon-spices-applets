This applet hides applets to the left of it, within the same zone. (Or on top with vertical panels.)

If Cinnamon adds this applet on the very left of the right zone, **it is essential** to enter the panel edit mode and move it to the right of what you want to hide!

Unlike past versions of this applet, you have to go into the right click menu and toggle _off_ icons that you want to hide. (This is so that icons that have never been in the tray before don't immediately disappear.)

### Troubleshooting

- Tray icons for notifications are shockingly fragile. If you do something with this applet that makes them disappear, just make sure to turn their toggles on and they should reappear within a minute or two.
- Many tray icons result in the toggle menu getting cut off instead of being scrollable. This bug [has already been reported](https://github.com/linuxmint/cinnamon/issues/13908).

### Specific contributions wanted

- Getting icon data (icon name or path) out of `systray@cinnamon.org`, so that we can show that icon in the popup menu.
- Somehow getting nicer names for Xapp Status Applet icons would be great, particuarly for apps like Deezer that somehow don't provide anything readable. The associated process name would probably be best.

### Thanks to

- [@Gr3q](https://github.com/Gr3q) for publishing [@ci-types/cjs](https://www.npmjs.com/package/@ci-types/cjs) which made it possible to use TypeScript for applets.
- [@kriegcc](https://github.com/kriegcc) for [this applet](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/fish%40kriegcc) that first made me aware of the just mentioned types in the first place.
