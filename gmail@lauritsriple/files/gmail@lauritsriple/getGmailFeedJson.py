#!/usr/bin/env python

from urllib.request import FancyURLopener
import feedparser
#import usersettings
import json
import sys
import keyring
import time

def feedToJson(feed):
    if feed==None:
        return "null"

    result={}
    result["unreadCount"]=str(feed["feed"]["fullcount"])
    result["entries"]=[]
    for elem in feed["entries"]:
        tmp={}
        tmp["author"]=elem["author_detail"]["name"]
        tmp["email"]=elem["author_detail"]["email"]
        #Shorten title
        if len(elem["title"])>60:
            tmp["title"]=elem["title"][0:57]
            tmp["title"]+="..."
        else:
            tmp["title"]=elem["title"]
        #Split summary over multiple lines
        if len(elem["summary"])>50:
            tmpSummary=elem["summary"].split()
            charCount=0
            summary=""
            for word in tmpSummary:
                summary+=word+" "
                charCount+=len(word)
                if charCount>40:
                    summary+="\n"
                    charCount=0
            summary=summary.rstrip()
            summary+="..."
            tmp["summary"]=summary
        else:
            tmp["summary"]=elem["summary"]
        tmp["link"]=elem["link"]
        tmp["time"]=elem["published"]
        result["entries"].append(tmp)
    #Reverse result so that newest mail is last.
    result["entries"].reverse()

    return json.dumps(result)

def getFeed(url):
    try:
        opener = FancyURLopener()
        page = opener.open(url)
        contents = page.read().decode('utf-8')
        feed=feedparser.parse(contents)
        return feed
    except:
        return None

def printElemInFeed(feed):
    for elem in feed["entries"]:
        print(elem)
        break

def main():
    username=sys.argv[1]
    try:
        password=keyring.get_password("mailnotifier",username)
        url = 'https://%s:%s@mail.google.com/mail/feed/atom' % (username, password)
        print(feedToJson(getFeed(url)))
    except:
        print("null")
main()
