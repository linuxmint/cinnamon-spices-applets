Work in progress Cinnamon applet for hamster.

h1. Installing

Firstly ensure that you have a recent version of hamster installed by either:
* Building and installing from source from the "hamster git repository":https://github.com/projecthamster/hamster
* Installing from your distributions repositories or using "Dylan McCall's stable hamster PPA":https://launchpad.net/~dylanmccall/+archive/hamster-time-tracker-git-stable

To install the applet just symlink checkout directory into @~/.local/share/cinnamon/applets/@
as hamster@projecthamster.wordpress.com.
It looks something like this:

pre. cd ~/.local/share/cinnamon/applets/
ln -s /path/to/the/checkout hamster@projecthamster.wordpress.com

You can also clone git project exactly to applets folder

pre. git clone https://github.com/projecthamster/cinnamon-applet.git ~/.local/share/cinnamon/applets/hamster@projecthamster.wordpress.com
