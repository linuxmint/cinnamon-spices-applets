#!/usr/bin/env python
#by ikswss@gmail.com

from gi.repository import Gtk
from config_note import Config
from subprocess import call
import sys,os
import signal

config_note = Config()        
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
import sys

def stringToDate(dt):
    data  = dt[:-12] + "/" + dt[2:-10] + "/" + dt[4:-6] + " "  + dt[8:-4] + ":"  + dt[10:-2] + ":"  + dt[12:]
    return data

class MyApp(Gtk.Window):
    def __init__(self, argv,nome,conteudo,ipsender,img_atach,new_img):     
        Gtk.Window.__init__(self, title="")
        config_note = Config()        
        path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"
        path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
    	path_attached = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/attacheds/"
    	#convert
    	lista_anexos = [] 
    	lista_nome = os.listdir(path_attached)

	for l in range(len(lista_nome)):
	    lista_dir = os.listdir(path_attached+lista_nome[l] + "/")
	    if lista_dir:
		for d in range(len(lista_dir)):
		    lista_dir_files = os.listdir(path_attached+lista_nome[l] + "/" + lista_dir[d] + "/")
		    if lista_dir_files:
		        files = ""
		        for f in range(len(lista_dir_files)):
		            if f == 0:    
		                if(lista_dir_files[f].split(".")[1] == 'wmf'):
		                    command1 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; convert " +  lista_dir_files[f] + " " + lista_dir_files[f][:-4]+".png"                            
		                    os.system(command1)     
		                    command2 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; rm -f " +  lista_dir_files[f]
		                    os.system(command2)  
		                    files =  lista_dir_files[f][:-4]+".png"
		                else:
		                    files = (lista_dir_files[f])
		            else:
		                if(lista_dir_files[f].split(".")[1] == 'wmf'):
		                    command1 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; convert " +  lista_dir_files[f] + " " + lista_dir_files[f][:-4]+".png"                            
		                    os.system(command1)     
		                    command2 = "cd  " +  path_attached+lista_nome[l] + "/" + lista_dir[d] + "/; rm -f " +  lista_dir_files[f]
		                    os.system(command2)                              
		                    files = files + (" | " +  lista_dir_files[f][:-4]+".png" )
		                else:
		                    files = files + (" | " + lista_dir_files[f])
		        lista_anexos.append([lista_nome[l],stringToDate(lista_dir[d]),files])

        
        fullconteudo = conteudo
        tipo = ""
        if nome.find("=") == 1:
            nome = nome[2:]

            if img_atach != "None":
                lista_nome = os.listdir(img_atach)
                if lista_nome[0].find("png") != -1 or lista_nome[0].find("jpg")  != -1 or lista_nome[0].find("jpeg")  != -1  or  lista_nome[0].find("wmf")  != -1 or lista_nome[0].find("gif")  != -1 or lista_nome[0].find("bmp")  != -1:                 
                    tipo = "img"
                else:
                    tipo = "att"     

            data = [nome,fullconteudo,ipsender,tipo,img_atach + lista_nome[0]]
    
            call(["python", path + "caixa.py",""+ data[0] +"","" + data[2] + "","" + data[1] + "","" + data[2] + "","" + data[3] + "","" + data[4] + "","" + new_img + ""]) 
            os.kill(os.getpid() , signal.SIGQUIT)

        else:     
            if img_atach != "None":
                lista_nome = os.listdir(img_atach)
                if lista_nome[0].find("png") != -1 or lista_nome[0].find("jpg")  != -1 or lista_nome[0].find("jpeg")  != -1  or  lista_nome[0].find("wmf")  != -1 or lista_nome[0].find("gif")  != -1 or lista_nome[0].find("bmp")  != -1:                    
                    tipo = "img"
                else:
                    tipo = "att"                            
            data = [nome,fullconteudo,ipsender,tipo,img_atach + lista_nome[0]]

            call(["python", path + "caixa.py",""+ data[0] +"","" + data[2] + "","" + data[1] + "" + "","" + data[2] + "","" + data[3] + "","" + data[4] + "","" + new_img + ""]) 
            os.kill(os.getpid() , signal.SIGQUIT)  

if __name__ == "__main__":
    args = sys.argv[1:]
    MyApp(sys.argv, args[0], args[1], args[2],args[3],args[4]).exec_()
