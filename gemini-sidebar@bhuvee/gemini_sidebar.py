#!/usr/bin/env python3
import os
import sys
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, Gdk, GLib

class GeminiSidebar(Gtk.Window):
    def __init__(self):
        super().__init__(title="Gemini Sidebar")
        
        # NORMAL WINDOW LAYER: Tana-shahi khatam karne ke liye NORMAL aur keep_above hata diya
        self.set_type_hint(Gdk.WindowTypeHint.NORMAL)
        self.set_decorated(False)  
        self.set_skip_taskbar_hint(True)

        display = Gdk.Display.get_default()
        monitor = display.get_primary_monitor()
        geometry = monitor.get_geometry()
        
        self.screen_width = geometry.width
        self.screen_height = geometry.height
        self.sidebar_width = int(self.screen_width * 0.20)

        self.set_default_size(self.sidebar_width, self.screen_height)
        self.move(self.screen_width - self.sidebar_width, 0) 

        gtk_settings = Gtk.Settings.get_default()
        gtk_settings.set_property("gtk-application-prefer-dark-theme", True)

        data_dir = os.path.expanduser("~/.local/share/gemini-sidebar")
        os.makedirs(data_dir, exist_ok=True)
        
        context = WebKit2.WebContext.get_default()
        cookie_manager = context.get_cookie_manager()
        cookie_manager.set_persistent_storage(
            os.path.join(data_dir, "cookies.txt"), 
            WebKit2.CookiePersistentStorage.TEXT
        )
        
        self.webview = WebKit2.WebView.new_with_context(context)
        settings = self.webview.get_settings()
        settings.set_enable_javascript(True)
        settings.set_enable_html5_local_storage(True)
        settings.set_user_agent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        self.webview.connect("load-changed", self.on_load_changed)
        self.webview.load_uri("https://gemini.google.com/app?hl=en-IN")
        
        self.add(self.webview)

        # File based toggle state checker
        self.state_file = os.path.expanduser("~/.local/share/gemini-sidebar/command.txt")
        GLib.timeout_add(200, self.check_toggle_command)

    def on_load_changed(self, webview, event):
        if event == WebKit2.LoadEvent.FINISHED:
            js_code = "const meta = document.createElement('meta'); meta.name = 'viewport'; meta.content = 'color-scheme: dark light'; document.getElementsByTagName('head')[0].appendChild(meta);"
            webview.run_javascript(js_code, None, None, None)

    def check_toggle_command(self):
        if os.path.exists(self.state_file):
            try:
                with open(self.state_file, "r") as f:
                    cmd = f.read().strip()
                os.remove(self.state_file)
                if cmd == "toggle":
                    if self.is_visible():
                        self.hide()
                    else:
                        self.move(self.screen_width - self.sidebar_width, 0)
                        self.show_all()
                        self.present() # Dikhne par focus samne layega
            except:
                pass
        return True

if __name__ == "__main__":
    import subprocess
    try:
        procs = subprocess.check_output(["pgrep", "-f", "gemini_sidebar.py"]).decode().strip().split("\n")
        if len(procs) > 1:
            state_file = os.path.expanduser("~/.local/share/gemini-sidebar/command.txt")
            with open(state_file, "w") as f:
                f.write("toggle")
            sys.exit(0)
    except subprocess.CalledProcessError:
        pass
        
    win = GeminiSidebar()
    win.show_all()
    Gtk.main()
