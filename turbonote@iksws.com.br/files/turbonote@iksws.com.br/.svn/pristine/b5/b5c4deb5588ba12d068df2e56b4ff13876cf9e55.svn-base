#!/usr/bin/env python
#by ikswss@gmail.com

import socket, struct, fcntl
import getpass
import sqlite3

path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"

sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sockfd = sock.fileno()
SIOCGIFADDR = 0x8915
owner = getpass.getuser()


connb = sqlite3.connect(path + 'turbo.db')
a = connb.cursor()
a.execute("SELECT ping,protocolo,color,color_revert,multithread FROM config")
data =  a.fetchone()

ping = data[0]
protocolo  = data[1]
color = data[2]
color_revert = data[3]
multithread = data[4]
connb.close()

def to_bool(v):
	if v == "True":
		return True
	else:
		return False

def get_ip(iface = protocolo):
	s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
	s.connect((ping,80))
	ip =  (s.getsockname()[0])
	s.close()
	return ip	

ip = get_ip(protocolo)
image_color = color # _b for black
image_color_title_revert =  to_bool(color_revert)
multiThread =  to_bool(multithread) #multi note or not

class Config():
	def __init__(self):
		owner = getpass.getuser()
		image_color = color
		image_color_title_revert = to_bool(color_revert)
		ip = get_ip(protocolo)
		multiThread = to_bool(multithread)

	def getOwner(self):
		return owner;

	def getNotify(self):
		return multiThread;

	def getColorRevertTitle(self):	
		return image_color_title_revert;

	def getColor(self):
		return image_color;

	def getColorOver(self):
		if image_color == "_b":
			return ""
		else:
			return "_b"		

	def getIp(self):
		return ip;	


