# Stevedore #

Add, remove and control Docker images from a Cinnamon applet menu

### What is Docker? ###

Docker is a file system virtualization application that differs from other VM products like 
Virtualbox or VMWare in that instead of virtualizing a whole computer it only sandboxes the
underlying file system. It uses a clever combination of kernel namespaces and cgroups to
present a filesystem root inside of a virtual copy of the host operating system.

### Hmm, go on ###

Docker instances consist of two distinct pieces:

## Docker Images ##

Images can be created from scratch or downloaded from repositories. There is a repository of
Docker images available online at the [Docker store](https://store.docker.com)

There are plenty of available images to choose from or even customize from the store, for example
there are images for base installs of the Nginx web server, or there's an image of the fantastic
media server library Plex. Installing the software is then just a case of running the pre-configured
image within Docker and everything just works!

## Docker Containers ##

Once and image has been created or downloaded to your computer, you can then run an instance of
the image by creating a Container. There are a multitude of ways to perform this on each image
by sending configuration options to the image downloaded. Once the Container is running, it'll
act just like the application has been installed. Then, if you don't need the Container anymore
you can just stop the container and the resources are freed up.

### Nice, what does this Applet do? ###

This applet is added to a panel and provides access to search, install and run images from the 
Docker store directly. You can have as many images or containers installed and running at the
same time. It'll show the current running status and some configuration options for the images
so you can quickly see what they do. It'll show the allocated IP addresses, or even allow you
to open a direct SSH/Browser session straight from the menu itself.

### Thanks! ###

No problems, happy computing!

### Wait, what does Stevedore mean? ###

[A Stevedore is a person who loads and unloads ships.](https://en.wikipedia.org/wiki/Stevedore)
