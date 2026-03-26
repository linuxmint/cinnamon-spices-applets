#!/usr/bin/env python

try:
    import json
except:
    print("Python can't import json. Should be builtin in python. Go search the web or create a issue on git")
    exit()

try:
    from urllib.request import FancyURLopener
except:
    print(json.dumps({"error":"Python can't import FancyURLopener from urllib.request","info":"Search the web or create issue on git"}))
    exit()

try:
    import feedparser
except:
    print(json.dumps({"error":"Python can't import feedparser libary","info":"'pip3 install feedparser' to fix"}))
    exit()

try:
    import keyring
except:
    print(json.dumps({"error":"Python can't import keyring libary","info":"'pip3 install keyring' and 'pip3 install keyrings-alt' to fix"}))
    exit()

import sys
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
    opener = FancyURLopener()
    page = opener.open(url)
    contents = page.read().decode('utf-8')
    feed=feedparser.parse(contents)
    return feed

def printElemInFeed(feed):
    for elem in feed["entries"]:
        print(elem)
        break

def main():
    try:
        username=sys.argv[1]
    except:
        print(json.dumps({"error":"Username has to be specified as parameter","info":"Try 'python3 getGamilFeedJson.py usernameongoogle'"}))
        exit()
    try:
        password=keyring.get_password("mailnotifier",username)
    except:
        print(json.dumps({"error":"Could not get password from keyring","info":"Check settings for applet"}))
        exit()
    url = 'https://%s:%s@mail.google.com/mail/feed/atom' % (username, password)
    feed=""
    try:
        feed=getFeed(url)
    except:
        print(json.dumps({"error":"Probably no internet connection. Or python feedparser not installed","info":"Check the readme on github"}))
        exit()
    try:
        print(feedToJson(feed))
    except:
        print(json.dumps({"error":"Feed could not be parsed correctly","info":"Check out the git repo"}))
        exit()
main()
