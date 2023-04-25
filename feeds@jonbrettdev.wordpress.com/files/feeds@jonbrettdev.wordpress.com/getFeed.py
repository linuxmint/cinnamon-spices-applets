'''
 * Cinnamon RSS feed reader (python backend)
 *
 * Author: jonbrett.dev@gmail.com
 * Date: 2013-2016
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

''' feedparser documentation:
 https://pypi.python.org/pypi/feedparser
 https://pythonhosted.org/feedparser/
'''
import feedparser
import sys
import json

if __name__ == "__main__":
    rss = sys.argv[1]

    info = {}

    try:
        parser = feedparser.parse(rss)
        # check for permanent redirect
        if parser.status == 301:
            info['redirected_url'] = parser.href
        elif parser.status == 401:
            raise Exception('Feed is password protected and not supported at this time.')
        elif parser.status == 410:
            raise Exception('Feed marked Gone, please remove and stop trying.')

        feed = parser.feed

        if 'title' in feed:
            info['title'] = feed['title']
        else:
            info['title'] = rss

        if 'description' in feed:
            info['description'] = feed['description']
        else:
            info['description'] = feed.get('subtitle', info['title'])

        info['link'] = feed.get('link', rss)

        # image is optional in the rss spec
        if 'image' in feed:
            image_info = {}
            try:
                image_info['url'] = feed['image']['url']
                image_info['width'] = feed['image']['width']
                image_info['height'] = feed['image']['height']
                info['image'] = image_info
            except Exception as e:
                sys.stderr.write(str(e.args))

        info['entries'] = []
        for item in parser['entries']:
            item_info = {}
            # Invalid feeds will be excluded
            try:
                # guid is optional, so use link if it's not given
                if 'guid' in item:
                    item_info['id'] = item['guid']
                else:
                    item_info['id'] = item['link']

                item_info['title'] = item['title']
                item_info['link'] = item['link']
                item_info['description'] = item.get('description', item_info['title'])

                if 'pubDate' in item:
                    item_info['pubDate'] = item['pubDate']
                elif "published" in item:
                    item_info['pubDate'] = item['published']
                elif "date" in item:
                    item_info['pubDate'] = item['date']
                else:
                    item_info['pubDate'] = None

                info['entries'].append(item_info)
            except Exception as e:
                sys.stderr.write(str(e))
    except Exception as e:
        info['exception'] = e

    # This print statement is the return value to the javascript.
    print(json.dumps(info))
