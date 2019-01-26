#!/usr/bin/python3
# SUMainWindow class, which heritate of the MainWindow class of
# /usr/share/cinnamon/cinnamon-settings/cinnamon-settings.py (Cinnamon 4.0.9)
# made to open the Download tab with spices sorted by date.
# Usage:
# ~/.local/share/cinnamon/applets/SpicesUpdate@claudiux/scripts/open_download_tab.py applets|desklets|extensions|themes

import sys
import urllib.request as urllib
#sys.path.append("/usr/share/cinnamon/cinnamon-settings")
#import config
from cinnamon_settings import *

class SUMainWindow(MainWindow):
    def go_to_sidepage(self, cat, path, user_action=True):
        iterator = self.store[cat].get_iter(path)
        sidePage = self.store[cat].get_value(iterator,2)
        if not sidePage.is_standalone:
            if not user_action:
                self.window.set_title(sidePage.name)
                self.window.set_icon_name(sidePage.icon)
            sidePage.build()
            if sidePage.stack:
                #current_page = sidePage.stack.get_visible_child_name()
                self.stack_switcher.set_stack(sidePage.stack)
                l = sidePage.stack.get_children()
                if len(l) > 0:
                    if len(l) > 1: # claudiux
                        sidePage.stack.set_visible_child(l[1]) # claudiux
                        sidePage.stack.get_visible_child().sort_combo.set_active(2)
                        sidePage.stack.get_visible_child().sort_changed()
                    else: # claudiux
                        sidePage.stack.set_visible_child(l[0])
                    if sidePage.stack.get_visible():
                        self.stack_switcher.set_opacity(1)
                    else:
                        self.stack_switcher.set_opacity(0)
                    if hasattr(sidePage, "connect_proxy"):
                        sidePage.connect_proxy("hide_stack", self._on_sidepage_hide_stack)
                        sidePage.connect_proxy("show_stack", self._on_sidepage_show_stack)
                else:
                    self.stack_switcher.set_opacity(0)
            else:
                self.stack_switcher.set_opacity(0)
            if user_action:
                self.main_stack.set_visible_child_name("content_box_page")
                self.header_stack.set_visible_child_name("content_box")

            else:
                self.main_stack.set_visible_child_full("content_box_page", Gtk.StackTransitionType.NONE)
                self.header_stack.set_visible_child_full("content_box", Gtk.StackTransitionType.NONE)

            self.current_sidepage = sidePage
            width = 0
            for widget in self.top_bar:
                #m, n = widget.get_preferred_width()
                n = widget.get_preferred_width()[1]
                width += n
            self.top_bar.set_size_request(width + 20, -1)
            self.maybe_resize(sidePage)
        else:
            sidePage.build()

if __name__ == "__main__":
    import signal

    ps = proxygsettings.get_proxy_settings()
    if ps:
        proxy = urllib.ProxyHandler(ps)
    else:
        proxy = urllib.ProxyHandler()
    urllib.install_opener(urllib.build_opener(proxy))

    window = SUMainWindow()
    signal.signal(signal.SIGINT, window.quit)
    Gtk.main()
