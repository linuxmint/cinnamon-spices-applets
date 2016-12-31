This version of "places" came about initially simply because NONE of the
cinnamon places menus I found would open a web-dav share bookmark, such as one
I made and added to the nemo sidebar from my ownCloud server.  It was most
strange that while all the applets I tried seemed able to show the webdav
bookmark in the bookmark list, none could actually launch one.  In fact,
xdg-open could not launch dev:// url bookmarks, either!  I only could get them
to launch by calling nemo directly.  And so I stripped out the url's from
the bookmark id's, and call nemo directly in this applet.

In the meantime I decided I also wanted a places applet that combined
functionality with the mounted volumes applet, too, thereby saving some panel
space.  So while I originally was thinking of something that would be like the
simple places-bookmarks applet, this grew to add functionality I thought
would be most useful for a (hopefully still simple) general use places applet,
including offering customization thru settings.

A couple of oddities came up in developing this applet that I generally had
hated about bookmarks and mounted handling in GNOME.  First, oddly enough,
while the dav: "bookmark" would never launch except through running the file
manager directly, as noted, the "mount" entry when the owncloud dav share was
active actually would do so.  Worse, I had "two" entries when a bookmark
"mounts"; the mounted device entry, which has a "long file name" for a share,
and the bookmark entry.  This clearly would not do!  So I went the extra step
of cross-referencing the bookmark of a mounted entry, and offering the eject
button on the bookmark, rather than in the duplicated mount/device entry...

