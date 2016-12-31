#!/usr/bin/env python
#by ikswss@gmail.com

import logging
import sys,os
import SocketServer
from array import array
import sqlite3
from datetime import datetime
import re
import time
import cStringIO
from subprocess import call
import threading
from config_note import Config
import base64


OVERRIDE_NO_ACTIONS = True

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
path_tmp = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/tmp/"
path_attached = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"

caixa = 1
titulo = ""
ipsender = ""
msg_rec = ""
imganexada = "1"   
hoje = ""
hojefile = ""
datanameanexo = ""

logging.basicConfig(level=logging.DEBUG, format='%(name)s: %(message)s',)

class EchoRequestHandler(SocketServer.BaseRequestHandler):
    
    def __init__(self, request, client_address, server):
        self.logger = logging.getLogger('EchoRequestHandler')
        #self.logger.debug('__init__')
        SocketServer.BaseRequestHandler.__init__(self, request, client_address, server)        
        return

    def setup(self):
        #self.logger.debug('setup')
        return SocketServer.BaseRequestHandler.setup(self)

    def handle(self):
        self.logger.debug('handle')
                   
        assignNewValueToHoje(unicode(datetime.now().strftime("%d/%m/%Y %H:%M:%S")))
        assignNewValueToHojeF(unicode(datetime.now().strftime('%d%m%Y%H%M%S')))

        data = ""
        while 1:
            longmax = self.request.recv(1024)     
            
            if not longmax:
                break
            else:
                data += longmax 

        if data:    
            turbodata = data.split('End of TCPIP text')        
            
            nometemp = ""
            nomex = data.split('#')
            
            for i in range(len(nomex)):     
               if 'From' in nomex[i]:
                    nometemp = nomex[i]
                    break

            nomesplit = nometemp.split('=')   
            nome = nomesplit[1].upper()      

            conteudo = turbodata[0].decode('iso-8859-1').encode('utf8')
            conna = sqlite3.connect(path + 'turbo.db')
            c = conna.cursor()               
            c.execute("INSERT INTO history (nome,conteudo,data,tipo,ip) VALUES (?,?,?,?,?)",(nome,turbodata[0].decode('iso-8859-1'),hoje,'R',ipsender))
            conna.commit()
            conna.close()
           
            
            connb = sqlite3.connect(path + 'turbo.db')
            a = connb.cursor()
            a.execute("SELECT nome,ip FROM contacts WHERE upper(nome) = '" + nome + "'")
            try:
            	dataContact =  a.fetchone()
            	contactsName = dataContact[0]
            	ipData  = dataContact[1]
            except Exception, e:
            	dataContact =  ""
            	contactsName = ""
            	ipData  = ""
            connb.close()

            if not contactsName:
                addcontacts(nome,ipsender)
                command = "mkdir " + path_attached + nome
                os.system(command)  
            else:
                if ipsender != ipData:
                    updateContacts(nome,ipsender)


            self.request.send(data)                 
            
            #verifica se existe anexo  
            if data.find("Attachment") != -1:            
                datanameanexo = data.split("#")            
                datanameanexo = datanameanexo[43][17:]

                if datanameanexo.find("=") != -1:
                       datanameanexo = datanameanexo[2:]  


                output = cStringIO.StringIO()
                assignNewValueToAnexoName(datanameanexo)
                dataAnexo = data
                dataAnexo = dataAnexo.split('Attachment')
                dataAnexo = dataAnexo[1]
                i = dataAnexo.index('\n')          
                output.write(dataAnexo[i+1:])   

                command = "mkdir " +  path_attached +  nome + "/" + hojefile
                os.system(command)   
                time.sleep(1)
                f = open(path_attached +  nome + "/" + hojefile  + "/" + datanameanexo, 'w')         
                f.write(output.getvalue())
                f.close()  
                time.sleep(3)

                assignNewValueToAnexo("4")    
            #verificando se exite images  
            else:                          
                while (data.find('<<') != -1) or data.find('>>') != -1:            
                    data = data.strip('<<')
                    data = data.strip('>>') 
                        
                data = data.split("\r\n")  

                rtf = ""
                checker = "1"

                for i in range(len(data)): 
                    if data[i].find("wmetafile8") != -1:
                        assignNewValueToAnexo("2")

                    if data[i].find("=U") != -1:  
                        assignNewValueToAnexo("3") 

                    if checker == "2":
                        if data[i].find("ENDOF") == -1:
                            rtf = rtf + data[i]  

                       

                    if data[i].find("RTF_V60=") != -1:                  
                        checker = "2" 
                        rtf = data[i]  

            if imganexada == "2":
                f1 = open(path_tmp + hojefile + nome + ".rtf", 'w')         
                f1.write(rtf[8:])
                f1.close() 

            if imganexada == "3":
                imagedata = rtf[8:]
                imagedata = imagedata.split("#")
                imagedata =  imagedata[0][:-1]           

                f2 = open(path_tmp + hojefile + nome +  ".zip", 'w')
                f2.write(base64.b64decode(imagedata))
                f2.close()                        

            
            if config_note.getNotify():
                t = threading.Thread(target=notificar,args=[nome,conteudo,ipsender])
                t.start()
            else:
                notificar(nome,conteudo,ipsender)
        

        return

    def finish(self):
        self.logger.debug('finish')
        return SocketServer.BaseRequestHandler.finish(self)

def notificar(nome,conteudo,ipsender):
    if imganexada == "3":
        assignNewValueToAnexo("1")       
        command0 = "mkdir " +  path_tmp +  hojefile + nome
        command1 = "unzip " +  path_tmp +  hojefile + nome + ".zip -d " + path_tmp + hojefile + nome
        command2 = "soffice --invisible --convert-to odt " +  path_tmp +  hojefile + nome + "/" +  "fullscreen.rtf  --outdir " +  path_tmp +  hojefile + nome
	command21 = "mv " +  path_tmp +  hojefile + nome + "/fullscreen.odt " +  path_tmp +  hojefile + nome + "/fullscreen.zip"
	command22 = "unzip " +  path_tmp +  hojefile + nome + "/fullscreen.zip -d " + path_tmp + hojefile + nome + "/odt"   
        command3 = "mkdir " +  path_attached +  nome + "/" + hojefile 
        command4 = "cd " +  path_tmp + hojefile +  nome +  "/odt/Pictures/; cp *.gif *.png *.jpg *.jpeg *.bmp *.wmf "  + path_attached + nome + "/" + hojefile  + "/"
        command5 = "rm -Rf " +  path_tmp + "*" 
        os.system(command0)   
        os.system(command1)   
        time.sleep(3)
        os.system(command2)  
        time.sleep(2)    
	os.system(command21)
	os.system(command22)
	time.sleep(1)               
        os.system(command3)  
        os.system(command4)  
        time.sleep(2)
        os.system(command5)  
        assignNewValueToAnexo("1")        
        call(["python", path + "notificar.py",""+ nome + " at " + hoje + "","" + conteudo + "","" + ipsender + "", "" +  path_attached + nome + "/" + hojefile  + "/","N"])    
    elif imganexada == "2":
        assignNewValueToAnexo("1")
        command0 = "mkdir " +  path_tmp +  hojefile + nome
        command1 = "soffice --invisible --convert-to html " +  path_tmp +  hojefile + nome + ".rtf  --outdir " +  path_tmp +  hojefile + nome	
	command21 = "mv " +  path_tmp +  hojefile + nome + "/fullscreen.odt " +  path_tmp +  hojefile + nome + "/fullscreen.zip"
	command22 = "unzip " +  path_tmp +  hojefile + nome + "/fullscreen.zip -d " + path_tmp + hojefile + nome + "/odt"      
	command2 = "mkdir " +  path_attached +  nome + "/" + hojefile
        command3 = "cd " +  path_tmp + hojefile +  nome +  "; cp *.gif *.png *.jpg *.jpeg *.bmp *.wmf"  + path_attached + nome + "/" + hojefile  + "/"
        command4 = "rm -Rf " +  path_tmp + "*"        
        os.system(command0)   
        os.system(command1)   
        time.sleep(3)
        os.system(command2)    
	os.system(command21)
	os.system(command22)
	time.sleep(1)            
        os.system(command3)  
        time.sleep(2)
        os.system(command4)  
        assignNewValueToAnexo("1")  
        call(["python", path + "notificar.py",""+ nome + " at " + hoje + "","" + conteudo + "","" + ipsender + "", "" +  path_attached + nome + "/" + hojefile  + "/","N"])    
    elif imganexada == "4":
        assignNewValueToAnexo("1")  
        call(["python", path + "notificar.py",""+ nome + " at " + hoje + "","" + conteudo + "","" + ipsender + "", "" +  path_attached + nome + "/" + hojefile  + "/","N"])    
    else:
        assignNewValueToAnexo("1")  
        call(["python", path + "notificar.py",""+ nome  + " at " + hoje + "","" + conteudo + "","" + ipsender + "","None","N"])        


class EchoServer(SocketServer.TCPServer):
    
    def __init__(self, server_address, handler_class=EchoRequestHandler):
        #self.logger = logging.getLogger('EchoServer')
        #self.logger.debug('__init__')
        SocketServer.TCPServer.__init__(self, server_address, handler_class)
        return

    def server_activate(self):
        #self.logger.debug('server_activate')
        SocketServer.TCPServer.server_activate(self)
        return

    def serve_forever(self):
        #self.logger.debug('waiting for request')
        #self.logger.info('Handling requests, press <Ctrl-C> to quit')
        while True:
            self.handle_request()
        return

    def handle_request(self):
        #self.logger.debug('handle_request')
        return SocketServer.TCPServer.handle_request(self)

    def verify_request(self, request, client_address):
       # self.logger.debug('verify_request(%s, %s)', request, client_address)
        assignNewValueToIpSender(client_address[0])
        return SocketServer.TCPServer.verify_request(self, request, client_address)

    def process_request(self, request, client_address):
        #self.logger.debug('process_request(%s, %s)', request, client_address)
        return SocketServer.TCPServer.process_request(self, request, client_address)

    def server_close(self):
       # self.logger.debug('server_close')
        return SocketServer.TCPServer.server_close(self)

    def finish_request(self, request, client_address):
        #self.logger.debug('finish_request(%s, %s)', request, client_address)
        return SocketServer.TCPServer.finish_request(self, request, client_address)

    def close_request(self, request_address):
        #self.logger.debug('close_request(%s)', request_address)
        return SocketServer.TCPServer.close_request(self, request_address)    


def updateContacts(contactnome,addressip):
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("UPDATE contacts set ip = (?) where nome = (?)",(addressip,contactnome))#s.getsockname()'')
    connc.commit()
    connc.close()

def addcontacts(contactnome,addressip):
    connc = sqlite3.connect(path + 'turbo.db')
    c = connc.cursor()
    c.execute("INSERT INTO contacts (nome,ip) VALUES (?,?)",(contactnome,addressip))#s.getsockname()'')
    connc.commit()
    connc.close()
    command = "mkdir " + path_attached + contactnome.upper()
    os.system(command)


def assignNewValueToHojeF(hj):
    global hojefile
    hojefile = hj

def assignNewValueToAnexoName(a):
    global datanameanexo
    datanameanexo = a

def assignNewValueToHoje(h):
    global hoje
    hoje = h

def assignNewValueToAnexo(b):
    global imganexada
    imganexada = b

def assignNewValueToX(v):
    global caixa
    caixa = v

def assignNewValueTomsgrec(m):
    global msg_rec
    msg_rec = m

def assignNewValueToTitulo(t):
    global titulo
    titulo = t

def assignNewValueToIpSender(i):
    global ipsender
    ipsender = i

address = (config_note.getIp(), 39681) # let the kernel give us a port
server = EchoServer(address, EchoRequestHandler)

t = threading.Thread(target=server.serve_forever)
#t.setDaemon(True) # don't hang on exit
t.start()
