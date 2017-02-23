#!/usr/bin/python
# -*- encoding: utf-8 -*-
from __future__ import unicode_literals
import gi
import sys
import os
import uuid
import json
from io import open
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk

# If python2 then FileNotFoundError is not defined, so define it.
try:
    FileNotFoundError
except NameError:
    FileNotFoundError = IOError

DEFAULT_FEEDS="""
{
    "instances" : [ 
        {
            "name": "default",        
            "interval": 5,    
            "feeds": [
                {
                    "id": "",
                    "title": "",
                    "url": "http://fxfeeds.mozilla.com/en-US/firefox/headlines.xml",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,                    
                    "showreaditems": false,
                    "showimage": false
                },                {
                    "id": "",
                    "title": "",
                    "url": "http://www.linuxmint.com/planet/rss20.xml",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showreaditems": false,
                    "showimage": false
                },                {
                    "id": "",
                    "title": "",
                    "url": "http://segfault.linuxmint.com/feed/",
                    "enabled": true,
                    "notify": true,
                    "interval": 5,
                    "showreaditems": false,
                    "showimage": false
                }
            ]
        }
    ]
}
"""

class ConfigFileManager:
    def __init__(self, filename, instance_name):
        """ 
            This requires the filename that is being read along with the instance name to bind to the feed array 
        """
        self.feeds = Gtk.ListStore(str, bool, str, str, bool, int, bool, bool)
        self.instances = Gtk.ListStore(str, str)
        self.__filename = filename
        self.__json = ConfigFileManager.read(filename)
        self.set_instance(instance_name)
        

    def set_instance(self, instance_name):
        """ 
            Method used to change which instance list is being bound to the feeds array 
        """
        self.__instance_selected = instance_name
        self.__load_feeds()
        for id, row in enumerate(self.instances):
            if row[0] == instance_name:
                return id        
        # Not found (might indicate bigger issues?)
        return -1


    def save(self):        
        """ 
            Convert the array back into feeds instance in the config file and then save / export it
        """
        for instance in self.__json['instances']:
            if instance['name'] == self.__instance_selected:                
                # Remove the feed
                instance.pop('feeds')
                # add a new empty section
                instance['feeds'] = []

                # Add all the feeds back in
                for feed in self.feeds:
                    instance['feeds'].append({'id': feed[0], 'enabled': feed[1], 'url': feed[2], 'title': feed[3], 'notify': feed[4], 'interval': feed[5], 'showreaditems': feed[6], 'showimage': feed[7]})

        # Save the file back out
        with open(self.__filename, mode='w', encoding='utf-8') as f:
            f.write(json.dumps(self.__json, ensure_ascii=False))
    

    def add_instance(self, new_name):
        """ 
            Add a new instance (if doesnt exist) and switch the instance to it 
        """
        ## Check if name is already in list of instances
        if not self.__instance_exists(new_name):
            #Add new instance
            self.__json['instances'].append({'name': new_name, 'interval': 5, 'feeds': [] })
                
        return self.set_instance(new_name)


    def get_instance_name(self, index):
        """ 
            Get the name of an instance by index in instance array 
        """
        return self.instances[index][0]


    def __instance_exists(self, name):
        """ 
            Check if the instance already exists 
        """
        for instance in self.__json['instances']:
            if instance['name'] == name:
                return True
        return False


    def __load_feeds(self):
        """ 
            This will parse the loaded json file and populate the instances and feeds arrays 
        """
        # reset the lists
        self.feeds = Gtk.ListStore(str, bool, str, str, bool, int, bool, bool)
        self.instances = Gtk.ListStore(str, str)

        # Populate the lists.
        for instance in self.__json['instances']:
            self.instances.append([instance['name'], instance['name']])            
            if instance['name'] == self.__instance_selected:
                for feed in instance['feeds']:
                    self.feeds.append([feed['id'], feed['enabled'], feed['url'], feed['title'], feed['notify'], feed['interval'], feed['showreaditems'], feed['showimage']])


    @staticmethod
    def read(filename):
        """ 
            Returns the config.json file or creates a new one with default values if it does not exist 
        """
        try:
            with open(filename, mode="r") as json_data:
                feeds = json.load(json_data)

        except FileNotFoundError:
            # No file found, return default values # everything else throws.
            feeds = json.loads(DEFAULT_FEEDS)
            # Populate the UUIDs
            for instance in feeds['instances']:
                if instance['name'] == 'default':
                    for feed in instance['feeds']:
                        # This unique ID is the identifier for this feed for life
                        feed['id'] = ConfigFileManager.get_new_id()
            with open(filename, mode='w', encoding='utf-8') as f:
                f.write(json.dumps(feeds, ensure_ascii=False))

        return feeds        


    @staticmethod
    def get_new_id():
        """ 
            Common method used to return a unique id in a string format. 
        """
        return str(uuid.uuid4())





class ConfigManager:    
    @staticmethod
    def write(filename=None):
        """
            Writes the feeds list to the file/stdout
        """
        #if filename is None:
        #    filename = self.filename

        if filename is None:
            f = sys.stdout
        else:
            f = open(filename, mode="w", encoding="utf-8")

        # Need to check if all feeds have been removed
        if len(feeds) == 0:
            f.write(u'#')
            f.write('')
            f.write(u'\n')

        for feed in feeds:
            if not feed[2]:
                f.write(u'#')
            f.write(feed[0].decode('utf8'))
            if feed[1] is not None:
                f.write(u' ')
                f.write(feed[1].decode('utf8'))
            f.write(u'\n')

    @staticmethod
    def read(filename = None):
        """
            Reads content of the feed file/stdin and returns a list of lists
        """
        content = []
        
        if filename is None:
            f = sys.stdin
        else:
            f = open(filename, "r")

        for line in f:
            try:
                # If input is coming from the command line, convert to utf8
                if filename is None:
                    line = line.decode('utf8')

                if line[0] == "#":
                    # cut out the comment and define this item as disabled
                    line = line[1:]
                    enable = False
                else:
                    enable = True
                temp = line.split()
                url = temp[0]
                custom_title = None
                if len(temp) > 1:
                    custom_title = " ".join(temp[1:])
                content.append([url, custom_title, enable])
            except IndexError:
                # empty lines are ignored
                pass
        
        return content

    @staticmethod
    def update_redirected_feed(current_url, redirected_url):
        feeds = ConfigManager.read()
        for feed in feeds:
            if feed[0] == current_url:
                feed[0] = redirected_url                
        ConfigManager.write(feeds)


    @staticmethod
    def import_opml_file(filename):
        """
            Reads feeds list from an OPML file
        """
        new_feeds = []

        tree = et.parse(filename)
        root = tree.getroot()
        for outline in root.findall(".//outline[@type='rss']"):
            url = outline.attrib.get('xmlUrl', '').decode('utf-8')
            # for now just ignore feed title decoding issues.
            try:
                title = outline.attrib.get('text', '').decode('utf-8').encode('ascii', 'ignore')
            except:
                title = ""
            new_feeds.append([
                    url,
                    title,
                    False])
        return new_feeds        



if __name__ == '__main__':
    instance_name = sys.argv[1]
    data_path = sys.argv[2]

    filename = data_path + "/feeds.json"

    if len(sys.argv) == 5:
        current_url = sys.argv[3]
        redirect_url = sys.argv[4]
        try:            
            ConfigManager.update_redirected_feed(current_url, redirect_url)
            #Need to add a new method to provide this functionality.
        except Exception as e:
            sys.stderr.write("Error updating feed\n" + e + "\n")
    else:
        jsonfile = ConfigFileManager.read(filename)
        print(json.dumps(jsonfile))
