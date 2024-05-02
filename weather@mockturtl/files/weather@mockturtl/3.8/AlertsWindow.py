#!/usr/bin/python3

from re import T
from typing import Optional, cast, Callable, List, Dict, TypedDict, Literal
import os
import argparse
from pathlib import Path
from json import JSONDecodeError
import json
from gi import require_version
require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, cairo, Gdk, Pango

class Alert(TypedDict):
	sender_name: str
	event: str
	start: int
	end: int
	description: str
	level: Literal["yellow", "orange", "red"]
	icon: Optional[str]


APPLET_DIR = Path(os.path.abspath(__file__)).parent.parent
print(f"Running from {APPLET_DIR}")
#from gettext import gettext as _
import gettext
home = os.path.expanduser("~")
gettext.install("weather@mockturtl", home + "/.local/share/locale")
# just to remove python warning
_ = cast(Callable[[str], str], _)# type: ignore[reportUndefinedVariable]

Gtk.IconTheme.get_default().append_search_path(str(APPLET_DIR.joinpath("icons")))
Gtk.IconTheme.get_default().append_search_path(str(APPLET_DIR.joinpath("arrow-icons")))

class AlertsWindow(Gtk.Window):
	alerts: List[Alert]

	def __init__(self, alerts: List[Alert]):
		self.alerts = alerts
		Gtk.Window.__init__(self, title=_("Weather Applet Alerts"))
		self.set_default_size(600, 300)
		self.set_position(Gtk.WindowPosition.CENTER)
		self.set_border_width(10)
		self.set_resizable(True)
		self.set_icon_from_file(str(APPLET_DIR.joinpath("icon.png")))

		self.connect("destroy", Gtk.main_quit)
		self.connect('delete-event', Gtk.main_quit)

		Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)

		self.add(self.create_alerts_box())
		self.show_all()

	def create_alerts_box(self) -> Gtk.Box:
		box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
		for alert in self.alerts:
			box.add(self.create_alert_box(alert))
		return box

	def create_alert_box(self, alert: Alert) -> Gtk.Box:
		columns = Gtk.Box(
      		orientation=Gtk.Orientation.HORIZONTAL,
        	spacing=6,
         	valign=Gtk.Align.START,
          	halign=Gtk.Align.START,
		)
		columns.add(self.create_alert_icon(alert))
		columns.add(self.create_alert_text(alert))
		return columns

	def create_alert_text(self, alert: Alert) -> Gtk.Box:
		box = Gtk.Box(
      		orientation=Gtk.Orientation.VERTICAL,
			spacing=6,
			expand=False,
			halign=Gtk.Align.START,
			valign=Gtk.Align.START
		)
		description = Gtk.Label(
			justify=Gtk.Justification.LEFT,
      		label=self.sanitize_text(alert['description']),
        	wrap=True
		)
		description.set_size_request(400, -1)

		title = Gtk.Label(
      		label=f"{alert['event']}",
			wrap=True,
   			expand=False,
			justify=Gtk.Justification.LEFT,
			halign=Gtk.Align.START,
      	)
		# title.modify_bg(Gtk.StateType.NORMAL, Gdk.Color.parse("red")[1])
		bigger_font = Pango.FontDescription.new()
		bigger_font.set_size(15000)
		bigger_font.set_weight(Pango.Weight.BOLD)
		title.modify_font(bigger_font)

		box.add(title)
		box.add(description)
		box.add(Gtk.Label(
      		label=f"{alert['sender_name']}",
			halign=Gtk.Align.START,
        ))
		return box

	def create_alert_icon(self, alert: Alert) -> Gtk.Image:
		image = Gtk.Image(valign=Gtk.Align.START, halign=Gtk.Align.START)
		image.set_from_icon_name(alert.get("icon", None) or "dialog-warning-symbolic", Gtk.IconSize.LARGE_TOOLBAR)
		image.modify_fg(Gtk.StateType.NORMAL, Gdk.Color.parse("yellow")[1])

		return image

	def sanitize_text(self, text: str) -> str:
		split_text = text.split("\n")
		# Replace empty lines with double newline
		split_text = [line if line else "\n\n" for line in split_text]
		return "".join(split_text)


def main():
	parser = argparse.ArgumentParser(description='Weather Applet Alerts Dialog')

	parser.add_argument(
		'alerts', default=None,
		help='alerts')

	args = parser.parse_args()
	try:
		alerts: List[Alert] = json.loads(args.alerts) # type: ignore[reportAny]
	except JSONDecodeError as e:
		print(e)
		return


	AlertsWindow(alerts)
	Gtk.main()



if __name__ == "__main__":
    main()