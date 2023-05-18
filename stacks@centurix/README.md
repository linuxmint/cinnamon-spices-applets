Stacks Manager Applet
=====================

Manage docker-compose stacks from a panel menu. With this applet you can:

* List available stacks
* Bring stacks up and down
* Edit docker-compose files
* Show logs for each stack

Requirements
------------

An installed, configured and working docker and/or docker-compose.

The docker group has been added to the current user:

`sudo usermod -aG docker $USER`

Then re-login as the user for the group changes to take place.

By default, the applet will look for `docker-compose.yml` files in a directory 
called `docker_projects` in the users home directory. This can be changed in the 
applets configuration. The applet will scan through all sub-directories looking 
for `docker-compose.yml` files and then list them in the menu.

Usage
-----

When starting, this applet will:

* Check if docker is installed
* Look for the older docker-compose Python script
* Check if the default `~/docker_projects` folder to exist in your home directory

If any of these do not exist, the applet will notify you with instructions on
how to install Docker.
