#!/usr/bin/python3.2
# -*-coding:UTF-8 -*
# Program that get the diaspora*'s  notifications of a user and fill a JSON file with them
# This program need 3 parameters to work : 
#	1- URL of the diaspora's POD
#	2- Login of the user
#	3- Password of the user
#
# @author douze12
# @date 17/11/2014

#imports
import urllib
import urllib.request
import http.cookiejar
import json
import sys
import os
from lxml import html


# Constants
loginUrl="/users/sign_in"
notificationsUrl = "/notifications"
resultFileName = "notifs.json"


#Méthodes
def writeError(errorMessage):
	error = {'error' : errorMessage}
	with open(resultFileName, 'w') as outfile:
		json.dump(error, outfile)
	print("Error : "+errorMessage)


def install_opener():
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(cj))
    # Avoid looking suspicious.
    opener.addheaders = [('User-agent', 'Mozilla/5.0 (compatible; MSIE 9.0; '
                          'Windows NT 6.1; Trident/5.0')]
    urllib.request.install_opener(opener)

def logUser(url, login, password):
	print("Try to connect to URL : "+url)

	#first request in order to get the token ID
	try:
		response=urllib.request.urlopen(url)
	except Exception as error:
		print("Exception on URL {0}".format(url),error)
		writeError("Error when trying to login on "+url)
		sys.exit(-1)
		
	content = response.read()
	#parse the response to get the token ID
	parser = html.HTMLParser()
	root = html.document_fromstring(content, parser=parser)
	token = root.find(".//input[@name='authenticity_token']").get("value")

	print("TOKEN  : "+token)


	# second request to log the user
	try:
		data = urllib.parse.urlencode({'utf-8':'âœ“', 'authenticity_token' : token, 'user[username]' : login, 'user[password]' : password, 'user[remember_me]' : '1', 'commit' : 'Connexion'})
		request = urllib.request.Request(url,data.encode("UTF-8"))
		response = urllib.request.urlopen(request)
	except Exception as error:
		print("Exception dans la récupération de l'URL {0}".format(url),error)
		sys.exit(-1)

	content = response.read()
	root = html.document_fromstring(content, parser=parser)

	#parse the response and try to find the input used to connect
	inputNode = root.find(".//input[@id='user_username']")
	if inputNode != None : 
		messageNode = root.find(".//div[@class='message']")
		errorMsg = messageNode.text
		writeError("Error when trying to login : "+errorMsg)
		sys.exit(-1)


def getNotifications(url):
	print("Try to get notifs on : "+url)

	#request on the notification URL
	try:
		response=urllib.request.urlopen(url)
	except Exception as error:
		print("Exception on URL {0}".format(url),error)
		writeError("Error when trying to get notifications on "+url)
		sys.exit(-1)
	
	content = response.read()
	parser = html.HTMLParser()
	root = html.document_fromstring(content, parser=parser)

	#parse the response and try to find a message that indicates an error occured
	notifNodes = root.xpath("//div[@class='media stream_element unread']//div[@class='media-body']")

	result = list()
	if notifNodes != None:
		for node in notifNodes:
			#get the time node
			timeNode = node.find(".//time")
			time = timeNode.get("datetime")
			print("Time : "+time)
			
			#remove the next to not have it in the text nodes
			timeNode.text=""
			
			#get only the text nodes content
			textNodes = node.xpath(".//text()")

			#join all the text and remove the useless \n & \t
			text = " ".join(textNodes).replace("\n","").replace("\t","")
			
			#remove doubled white spaces
			text = " ".join(text.split())

			result.append({"time" : time, "text" : text})
			print(text)

	return result


def writeNotifsInFile(notifs):
	with open(resultFileName, 'w') as outfile:
		json.dump(notifs, outfile)

	

# check we have the right number of parameters
if len(sys.argv) != 4:
	writeError("Bad Parameters")
	sys.exit(-1);

podUrl=sys.argv[1]
login=sys.argv[2]
password=sys.argv[3]

# set the opener in order to save the cookies for the multiple request
install_opener()

url = podUrl + loginUrl
# log the user on diaspora*
logUser(url, login, password)


url = podUrl + notificationsUrl
#get the notifications
notifs = getNotifications(url)

#write the notifications in the JSON result file
writeNotifsInFile(notifs)

sys.exit(0)




