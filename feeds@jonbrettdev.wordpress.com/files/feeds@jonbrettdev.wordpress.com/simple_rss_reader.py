import urllib2
import xmltodict


class Parser(object):
    def __init__(self, rss_url):
        self.status = 200
        self.href = rss_url
        self.feed = dict({
            'title': '',
            'description': '',
            'subtitle': '',
            'link': rss_url
        })
        self['entries'] = list()

    def __setitem__(self, key, item):
        self.__dict__[key] = item

    def __getitem__(self, key):
        return self.__dict__[key]

    def __repr__(self):
        return repr(self.__dict__)

    def __len__(self):
        return len(self.__dict__)

    def __delitem__(self, key):
        del self.__dict__[key]

    def clear(self):
        return self.__dict__.clear()

    def copy(self):
        return self.__dict__.copy()

    def has_key(self, k):
        return k in self.__dict__

    def update(self, *args, **kwargs):
        return self.__dict__.update(*args, **kwargs)

    def keys(self):
        return self.__dict__.keys()

    def values(self):
        return self.__dict__.values()

    def items(self):
        return self.__dict__.items()

    def pop(self, *args):
        return self.__dict__.pop(*args)

    def __contains__(self, item):
        return item in self.__dict__

    def __iter__(self):
        return iter(self.__dict__)


def parse(rss):
    parser = Parser(rss)

    handler = urllib2.urlopen(rss)
    parser.status = handler.code
    element = xmltodict.parse(handler.read())

    channel = element["rss"]["channel"]

    if "title" in channel:
        parser.feed['title'] = channel["title"]

    if "description" in channel:
        parser.feed['description'] = channel["description"]

    if "link" in channel:
        parser.feed['link'] = channel["link"]

    if "subtitle" in channel:
        parser.feed['subtitle'] = channel["subtitle"]

    if "image" in channel:
        image = channel["image"]
        parser.feed['image']["url"] = image["url"]
        if "width" in image:
            parser.feed["image"]["width"] = image["width"]
        if "height" in image:
            parser.feed["image"]["height"] = image["height"]

    if "item" in channel:
        for entry in channel["item"]:
            parser['entries'].append({
                'description': entry['description'],
                'link': entry['link'],
                'id': entry['link'],
                'pubDate': entry['pubDate'],
                'title': entry['title']
            })

    parser['entries'].sort(key=lambda x: x['pubDate'], reverse=True)

    return parser
