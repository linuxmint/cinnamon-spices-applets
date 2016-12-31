
from gi.repository import Gtk, Gdk,GObject,Pango
import os
from subprocess import Popen, PIPE
import fcntl
from config_note import Config

config_note = Config()
path = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/turbonote-adds/"
path_icon = "/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/"

sub_proc = Popen("cd /usr/share/cinnamon/applets/turbonote@iksws.com.br; svn update;", stdout=PIPE, shell=True)
sub_outp = ""

restart = False

class ProgressBarWindow(Gtk.Window):

   def __init__(self):
      Gtk.Window.__init__(self, title="SVN UPDATE")
      self.set_default_size(800, 400)
      self.set_border_width(15)      
      self.set_position(Gtk.WindowPosition.CENTER)
      self.set_icon_from_file("/usr/share/cinnamon/applets/turbonote@iksws.com.br/icons/turbo.png")	
      hb = Gtk.HeaderBar()
      hb.props.show_close_button = True
      hb.props.title = "SVN UPDATE"        
      self.set_titlebar(hb)    

      self.progressbar = Gtk.ProgressBar()
      self.progressbar.set_text("Checking for updates in SVN")
      self.progressbar.set_show_text("Checking for updates in SVN")    

      self.textview = Gtk.TextView()
      fontdesc = Pango.FontDescription("monospace")
      self.textview.modify_font(fontdesc)
      scrolledwindow = Gtk.ScrolledWindow()
      scrolledwindow.set_hexpand(True)
      scrolledwindow.set_vexpand(True)
      scrolledwindow.set_shadow_type(2)
      scrolledwindow.set_border_width(border_width=1)
      scrolledwindow.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
      scrolledwindow.add(self.textview)
      self.textview.set_border_width(10)

      self.exp = Gtk.Expander()
      self.exp.set_label("Update Log")
      self.exp.add(scrolledwindow)

      self.grid = Gtk.Grid()
      self.add(self.grid)       

      self.grid.attach(self.progressbar, 0, 0, 1 , 1)
      
      self.label = Gtk.Label()
      self.label.set_text(" ") 
      self.grid.attach(self.label, 0, 1, 1 , 1)  

      self.grid.attach(self.exp, 0, 2, 1 , 1)

      self.show_all()    
      GObject.timeout_add(100, update_terminal,self.textview,self.progressbar,self)
      self.textview.get_buffer().insert_at_cursor("Connecting to https://github.com/iksws/GnomeTurboNoteExtension/branches/master!\n\n")



   def isFinish(self):
      self.progressbar.hide()
      self.label.hide()
      self.exp.set_expanded(True)
      self.textview.get_buffer().insert_at_cursor("\nUpdate Finish!")
      if restart:
         self.textview.get_buffer().insert_at_cursor("\n\nREQUIRE RESTART PRESS [ALT+F2] ENTER [r] IN INPUT BOX PRESS [ENTER]")   



def update_now(progressbar,win):
   win.activity_mode = True     
   progressbar.pulse()



def non_block_read(output):
   fd = output.fileno()
   fl = fcntl.fcntl(fd, fcntl.F_GETFL)
   fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)
   try:      
      return output.read()
   except:
      return ''


def update_terminal(textview,progressbar,win):
   txt = non_block_read(sub_proc.stdout)
   if "server.py" in txt or  "applet.js" in txt:
      restart = True

   textview.get_buffer().insert_at_cursor(txt)
   update_now(progressbar,win)
   #return sub_proc.poll() is None
   if sub_proc.poll() is None:
      return sub_proc.poll() is None
   else:
      win.isFinish()

def assignNewValueToRestart(a):
    global restart
    restart = a

win = ProgressBarWindow()
win.connect("delete-event", Gtk.main_quit)
win.show_all()
Gtk.main()
