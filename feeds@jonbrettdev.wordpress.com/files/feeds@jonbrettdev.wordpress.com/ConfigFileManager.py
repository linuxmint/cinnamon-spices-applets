#!/usr/bin/env python3
'''
 * Cinnamon RSS feed reader (python backend)
 *
 * Author: jake1164@hotmail.com
 * Date: 2017
 *
 * Cinnamon RSS feed reader is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Cinnamon RSS feed reader is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General
 * Public License for more details.  You should have received a copy of the GNU
 * General Public License along with Cinnamon RSS feed reader.  If not, see
 * <http://www.gnu.org/licenses/>.
'''
from __future__ import unicode_literals
import sys
import os
import uuid
import json
import csv
import argparse
import xml.etree.ElementTree as et
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk

DEFAULT_FEEDS = '''
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
'''

class ConfigFileManager:
    '''
        Class used to manage the new json multi-instance config file.
    '''
    def __init__(self, filename, instance_name):
        '''
            This requires the filename that is being read along
            with the instance name to bind to the feed array
        '''
        self.feeds = Gtk.ListStore(str, bool, str, str, bool, int, bool, bool)
        self.instances = Gtk.ListStore(str, str)
        self.__filename = filename
        self.__json = ConfigFileManager.read(filename)
        self.set_instance(instance_name)


    def set_instance(self, instance_name):
        '''
            Method used to change which instance list is being bound to the feeds array
        '''
        self.__instance_selected = instance_name
        self.__load_feeds()
        for iid, row in enumerate(self.instances):
            if row[0] == instance_name:
                return iid
        # Not found (might indicate bigger issues?)
        return -1

    def get_instance(self):
        '''
            Returns the current selected instance name
        '''
        return self.__instance_selected

    def get_instance_id(self):
        '''
            Returns the curent selected instance ID
        '''
        for iid, row in enumerate(self.instances):
            if row[0] == self.__instance_selected:
                return iid
        # Not found (might indicate bigger issues?)
        return -1


    def save(self):
        '''
            Convert the array back into feeds instance in the config file and then save / export it
        '''
        for instance in self.__json['instances']:
            if instance['name'] == self.__instance_selected:
                # Remove the feed
                instance.pop('feeds')
                # add a new empty section
                instance['feeds'] = []

                # Add all the feeds back in
                for feed in self.feeds:
                    url = feed[2]
                    title = feed[3]

                    instance['feeds'].append({
                        'id': feed[0],
                        'enabled': feed[1],
                        'url': url,
                        'title': title,
                        'notify': feed[4],
                        'interval': feed[5],
                        'showreaditems': feed[6],
                        'showimage': feed[7]})

        ConfigFileManager.write(self.__filename, self.__json)


    def add_instance(self, new_name):
        '''
            Add a new instance (if doesnt exist) and switch the instance to it
        '''
        ## Check if name is already in list of instances
        if not self.__instance_exists(new_name):
            #Add new instance
            self.__json['instances'].append({
                'name': new_name,
                'interval': 5,
                'feeds': []})

        return self.set_instance(new_name)


    def get_instance_name(self, index):
        '''
            Get the name of an instance by index in instance array
        '''
        return self.instances[index][0]


    def __instance_exists(self, name):
        '''
            Check if the instance already exists
        '''
        for instance in self.__json['instances']:
            if instance['name'] == name:
                return True
        return False


    def __load_feeds(self):
        '''
            This will parse the loaded json file and populate the instances and feeds arrays
        '''
        # reset the lists
        self.feeds = Gtk.ListStore(str, bool, str, str, bool, int, bool, bool)
        self.instances = Gtk.ListStore(str, str)

        # Populate the lists.
        for instance in self.__json['instances']:
            self.instances.append([instance['name'], instance['name']])
            if instance['name'] == self.__instance_selected:
                for feed in instance['feeds']:
                    self.feeds.append([
                        feed['id'],
                        feed['enabled'],
                        feed['url'],
                        feed['title'],
                        feed['notify'],
                        feed['interval'],
                        feed['showreaditems'],
                        feed['showimage']])


    def import_opml_file(self, file_name):
        '''
            Reads feeds list from an OPML file
        '''
        cnt = 0
        tree = et.parse(file_name)
        root = tree.getroot()
        for outline in root.findall(".//outline[@type='rss']"):
            url = outline.attrib.get('xmlUrl', '')
            try:
                title = outline.attrib.get('text', '')
            except Exception:
                title = ""

            self.feeds.append([
                ConfigFileManager.get_new_id(),
                False,
                url,
                title,
                True,
                5,
                False,
                False])

            cnt += 1
        return cnt


    def export_feeds(self, output_name):
        '''
            Writes the selected feeds array to a file.
            Note that the ID is not exported, it is created on import.
        '''
        if len(self.feeds) > 0:
            mode = 'w'
            if sys.version_info.major < 3:
                mode += 'b'

            with open(output_name, mode=mode) as file:
                file.write("### feeds export v=1.0\n")
                if sys.version_info.major < 3:
                    filewriter = UnicodeCSVWriter(file, quoting=csv.QUOTE_NONNUMERIC)
                else:
                    filewriter = csv.writer(file, quoting=csv.QUOTE_NONNUMERIC)

                for feed in self.feeds:
                    filewriter.writerow(feed[1:])


    def import_feeds(self, input_name):
        '''
            Import a file in the feeds csv format.
        '''
        cnt = 0
        mode = 'rb' if sys.version_info.major < 3 else 'r'

        with open(input_name, mode=mode) as file:
            header = file.readline()
            if header != '### feeds export v=1.0\n':
                raise Exception("Invalid file, must have a first line matching: ### feeds export v=1.0")

            filereader = csv.reader(file)

            for line in filereader:
                url = line[1]
                title = line[2]

                self.feeds.append(
                    [ConfigFileManager.get_new_id()] + [self.__to_bool(line[0]),
                    url,
                    title,
                    self.__to_bool(line[3]),
                    int(line[4]),
                    self.__to_bool(line[5]),
                    self.__to_bool(line[6])])
                cnt += 1
        return cnt


    @classmethod
    def __to_bool(cls, val):
        return val.lower() == "true"


    @staticmethod
    def read(file_name):
        '''
            Returns the config.json file or creates a new one with
            default values if it does not exist
        '''
        try:
            with open(file_name, mode="r") as json_file:
                json_obj = json.load(json_file)

        except FileNotFoundError:
            # No file found, return default values # everything else throws.
            json_obj = json.loads(DEFAULT_FEEDS)
            # Populate the UUIDs
            for instance in json_obj['instances']:
                if instance['name'] == 'default':
                    for feed in instance['feeds']:
                        # This unique ID is the identifier for this feed for life
                        feed['id'] = ConfigFileManager.get_new_id()
            # Create the UUID folder if it does not exist.
            path = os.path.dirname(file_name)
            if not os.path.exists(path):
                os.makedirs(path)
                
            ConfigFileManager.write(file_name, json_obj)

        return json_obj


    @staticmethod
    def write(jsonfile, json_obj):
        '''
            Takes a passed in json object and writes the file to disk
        '''
        mode = 'w'

        with open(jsonfile, mode=mode, encoding='utf-8') as file:
            content = json.dumps(json_obj, ensure_ascii=False)
            file.write(content)


    @staticmethod
    def get_new_id():
        '''
            Common method used to return a unique id in a string format.
        '''
        return str(uuid.uuid4())


    @staticmethod
    def update_redirected_feed(config_file, instance_name, current_url, redirected_url):
        '''
            This static method will change a feed to an new updated current_url
        '''
        feeds = ConfigFileManager.read(config_file)
        # Find the url to update
        for instance in feeds['instances']:
            if instance['name'] == instance_name:
                for feed in instance['feeds']:
                    if feed['url'] == current_url:
                        feed['url'] = redirected_url
        # Save the changes back out.
        ConfigFileManager.write(filename, feeds)


if __name__ == '__main__':
    # pragma pylint: disable=C0103
    parser = argparse.ArgumentParser()
    parser.add_argument('filename', help='settings filename including path')
    parser.add_argument('--instance', help='instance name to update the redirected url')
    parser.add_argument('--oldurl', help='url to be updated')
    parser.add_argument('--newurl', help='new url to be used')

    args = parser.parse_args()

    filename = args.filename

    if args.instance and args.oldurl and args.newurl:
        oldurl = args.oldurl
        newurl = args.newurl
        inst = args.instance
        try:
            ConfigFileManager.update_redirected_feed(filename, inst, oldurl, newurl)
        except Exception as e:
            sys.stderr.write("Error updating feed\n" + e + "\n")

    elif args.instance or args.oldurl or args.newurl:
        raise "--instance, --oldurl AND --newurl are required to redirect to a new url."
    else:
        jsonfile = ConfigFileManager.read(filename)
        print(json.dumps(jsonfile))
