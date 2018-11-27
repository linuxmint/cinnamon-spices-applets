import urllib2
import xml.etree.ElementTree as ET


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


def get_element(element, xpath, default=''):
    subs = element.findall(xpath)

    if len(subs) > 0:
        return subs[0].text

    return default


def parse(rss):
    parser = Parser(rss)

    handler = urllib2.urlopen(rss)
    parser.status = handler.code
    element = ET.fromstring(handler.read())

    parser.feed['title'] = get_element(element, './channel/title')
    parser.feed['description'] = get_element(element, './channel/description')
    parser.feed['link'] = get_element(element, './channel/link')
    parser.feed['subtitle'] = get_element(element, './channel/subtitle')

    subs = element.findall('./channel/image')
    if len(subs) > 0:
        image = subs[0]
        parser.feed['image'] = {
            'url': get_element(image, './url'),
            'width': get_element(image, './width'),
            'height': get_element(image, './height')
        }

    entries = element.findall('./channel/item')

    for entry in entries:
        parser['entries'].append({
            'description': get_element(entry, './description'),
            'link': get_element(entry, './link'),
            'id': get_element(entry, './link'),
            'pubDate': get_element(entry, './pubDate'),
            'title': get_element(entry, './title')
        })

    parser['entries'].sort(key=lambda x: x['pubDate'], reverse=True)

    return parser
