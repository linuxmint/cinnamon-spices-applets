#!/usr/bin/gjs

const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;

Gtk.init(null);
Main.createLookingGlass().ReloadExtension("calc-js@ptandler", "applet");
Gtk.main_quit();
