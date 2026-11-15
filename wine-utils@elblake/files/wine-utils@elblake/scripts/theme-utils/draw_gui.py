
##
## Draw an approximate mockup of a GUI given the colors
## and fonts set, for the user to see a preview of their
## changes.
##

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk
from gi.repository import Gdk
from gi.repository import Gio
from gi.repository import GLib
from gi.repository import GObject

import locale
import cairo

UUID = 'wine-utils@elblake'

locale.setlocale(locale.LC_MESSAGES, "")
locale.textdomain(UUID)
locale.bindtextdomain(UUID, GLib.get_user_data_dir() + "/locale")

def _(str0):
    str1 = locale.dgettext(UUID, str0)
    if str1 == '':
        return str0
    return str1

class DrawGUI():
    def __init__(self, width, height):
        self.width = width
        self.height = height
        self.surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, width, height)
        self.text_tooltip = _("Tooltip")
        self.text_menu_item_greyed = _("Menu Item Grayed")
        self.text_file = _("File")
        self.text_menu = _("Menu")
        self.text_menu_item = _("Menu Item")
        self.text_menu_button = _("Button")

        self.defaults()

    def defaults(self):
        c = {}
        c["MenuHeight"]=-450
        c["ScrollHeight"]=-240
        for w in ["ActiveBorder","ButtonAlternateFace","ButtonDkShadow","ButtonFace","ButtonHilight",
                  "ButtonLight","ButtonShadow","ButtonText","GrayText","Hilight","InactiveTitleText",
                  "InfoText","InfoWindow","Menu","MenuBar","MenuHilight","MenuText","Scrollbar",
                  "Window","WindowFrame","WindowText"]:
            c[w] = [0,0,0]
        for w in ["CaptionFont","MenuFont","MessageFont","SmCaptionFont","StatusFont"]:
            c[w]=["Liberation Sans", 500, 10, 0]

        self.colors = c

    def to_px(self, v):
        return round((-v) / 15)

    def update_from(self, colors):
        for name in colors:
            self.colors[name] = colors[name]

    def update(self, name, value):
        self.colors[name] = value
    
    def redraw(self):
        c = cairo.Context(self.surface)

        c.set_line_width(1.4)

        menu_h = self.to_px(self.colors["MenuHeight"])
        
        color=self.colors["ButtonFace"]
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        c.move_to(0,menu_h)
        c.line_to(self.width,menu_h)
        c.line_to(self.width,self.height)
        c.line_to(0,self.height)
        c.line_to(0,menu_h)
        c.fill()

        color=self.colors["Menu"]
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        c.move_to(0,0)
        c.line_to(self.width,0)
        c.line_to(self.width,menu_h)
        c.line_to(0,menu_h)
        c.line_to(0,0)
        c.fill()

        self.corners(c, self.colors["WindowFrame"], self.colors["WindowFrame"], self.width-100-100-1, self.height-31, 92, 22)

        self.draw1(c, 5, menu_h+5, self.width-10, self.height-40-menu_h-30, True, self.colors["Window"])
        self.draw1(c, 5, self.height-40-20, self.width-10, 24, True, self.colors["Window"])
        self.draw1(c, self.width-100, self.height-30, 90, 20, False, self.colors["ButtonFace"])
        self.draw1(c, self.width-100-100, self.height-30, 90, 20, False, self.colors["ButtonFace"])
        self.draw1(c, 60, menu_h, 150, 56, False, self.colors["Menu"])

        self.drawtext(c, "Text", 5+3, menu_h+5+3, 0, 20, self.colors["WindowText"], self.colors["MessageFont"])
        self.drawtext(c, "Grayed Text", 5+3, self.height-40-20+3, 0, 20, self.colors["GrayText"], self.colors["MessageFont"])

        color=self.colors["Hilight"]
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        c.move_to(63,menu_h+5)
        c.line_to(63+150-2-4,menu_h+5)
        c.line_to(63+150-2-4,menu_h+25)
        c.line_to(63,menu_h+25)
        c.line_to(63,menu_h+5)
        c.fill()

        self.drawtext(c, self.text_file, 10, 0, 40, menu_h, self.colors["MenuText"], self.colors["MenuFont"])
        self.drawtext(c, self.text_menu, 10+40+10+10, 0, 40, menu_h, self.colors["MenuText"], self.colors["MenuFont"])
        self.drawtext(c, self.text_menu_item, 60+10, menu_h, 0, 30, self.colors["MenuText"], self.colors["MenuFont"])
        self.drawtext_grayed(c, self.text_menu_item_greyed, 60+10, menu_h+24, 0, 30, self.colors["MenuFont"])
        self.drawtext(c, self.text_menu_button, self.width-100, self.height-30, 90, 20, self.colors["ButtonText"], self.colors["MessageFont"])
        self.drawtext(c, self.text_menu_button, self.width-100-100, self.height-30, 90, 20, self.colors["ButtonText"], self.colors["MessageFont"])

        self.drawf(c, self.width-100+20, self.height-30-20, 70, 25, self.colors["InfoWindow"], [0,0,0])
        self.drawtext(c, self.text_tooltip, self.width-100+20+8, self.height-30-30+1+10, 0, 25-1, self.colors["InfoText"], self.colors["StatusFont"])

    def drawtext_grayed(self,c,text,x,y,w,h,font):
        self.drawtext(c, text, x+1, y+1, w, h, [255,255,255], font)
        self.drawtext(c, text, x, y, w, h, [0,0,0], font)

    def drawtext(self,c,text,x,y,w,h,color,font):
        if font[3] == 0:
            italic = cairo.FontSlant.NORMAL  # FONT_SLANT_NORMAL
        else:
            italic = cairo.FontSlant.ITALIC  # FONT_SLANT_ITALIC
        if font[1] < 600:
            weight = cairo.FontWeight.NORMAL # FONT_WEIGHT_NORMAL
        else:
            weight = cairo.FontWeight.BOLD   # FONT_WEIGHT_BOLD
        c.select_font_face(font[0], italic, weight)
        c.set_font_size(font[2]*1.25)
        f = cairo.ScaledFont(c.get_font_face(),c.get_font_matrix(),cairo.Matrix(1.0,0.0,0.0,1.0,0.0,0.0),c.get_font_options())
        ext = f.text_extents(text)
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        if (w != 0):
            x = x + (w / 2.0) - (ext.width / 2.0)
        else:
            x = x
        c.move_to(x, y + (h / 2.0) - ((ext.height) / 2.0) - ext.y_bearing)
        c.show_text(text)

    def drawf(self, c, x, y, w, h, color, color1):
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        c.move_to(x+1,y+1)
        c.line_to(x+w-1,y+1)
        c.line_to(x+w-1,y+h-1)
        c.line_to(x+1,y+h-1)
        c.line_to(x+1,y+1)
        c.fill()
        self.corners(c, color1, color1, x, y, w, h)
    
    def draw1(self, c, x, y, w, h, inward, color):
        if inward:
            color1 = self.colors["ButtonShadow"]
            color2 = self.colors["ButtonDkShadow"]
            color3 = self.colors["ButtonHilight"]
            color4 = self.colors["ButtonLight"]
        else:
            color1 = self.colors["ButtonHilight"]
            color2 = self.colors["ButtonLight"]
            color3 = self.colors["ButtonShadow"]
            color4 = self.colors["ButtonDkShadow"]
        
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        c.move_to(x+2,y+2)
        c.line_to(x+w-2,y+2)
        c.line_to(x+w-2,y+h-2)
        c.line_to(x+2,y+h-2)
        c.line_to(x+2,y+2)
        c.fill()

        if inward and (h > 30):
            # draw scrollbar
            scw = self.to_px(self.colors["ScrollHeight"])
            color = self.colors["Scrollbar"]
            c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
            c.move_to(x+w-2-scw,y+2)
            c.line_to(x+w-2,y+2)
            c.line_to(x+w-2,y+h-2)
            c.line_to(x+w-2-scw,y+h-2)
            c.line_to(x+w-2-scw,y+2)
            c.fill()

            self.draw1(c, x+w-2-scw+1,y+2, scw-2, scw-2, False, self.colors["ButtonFace"])
            self.draw1(c, x+w-2-scw+1,y+2+scw+6, scw-2, 30, False, self.colors["ButtonFace"])
            self.draw1(c, x+w-2-scw+1,y+h-2-scw, scw-2, scw-2, False, self.colors["ButtonFace"])

        self.corners(c, color1, color3, x, y, w, h)
        self.corners(c, color2, color4, x+1, y+1, w-2, h-2)
    
    def corners(self, c, color1, color2, x, y, w, h):
        self.line1(c, color1, x, y, x+w, y)
        self.line1(c, color1, x, y, x, y+h)
        self.line1(c, color2, x, y+h, x+w, y+h)
        self.line1(c, color2, x+w, y, x+w, y+h)
    
    def line1(self, c, color, x1, y1, x2, y2):
        c.set_source_rgb(color[0] / 255.0, color[1] / 255.0, color[2] / 255.0)
        c.move_to(x1,y1)
        c.line_to(x2,y2)
        c.stroke()


class TestDrawGUI(Gtk.Window):
    def __init__(self):
        super().__init__()
        self.gui = DrawGUI(300, 200)
        self.gui.redraw()
        self.preview = Gtk.Image.new_from_surface(self.gui.surface)
        self.add(self.preview)
        self.connect("destroy", Gtk.main_quit)


## For testing the widget
if __name__ == '__main__':
    m = TestDrawGUI()
    m.show_all()
    Gtk.main()



