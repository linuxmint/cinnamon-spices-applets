#!/usr/bin/python3

import os
import argparse
from pathlib import Path
from json import JSONDecodeError
import json
from gi import require_version
require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib, cairo, Gdk, Pango
from typing import TYPE_CHECKING, Optional, cast, Callable, List, Any


#region Utility types

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

# Support Older versions of python up until 3.6
if TYPE_CHECKING:
	from typing_extensions import ParamSpec, TypeVar, Literal
	from typing import TypedDict
else:
	# Fake ParamSpec
	class ParamSpec:
		def __init__(self, _):
			self.args = None
			self.kwargs = None

	class TypeVar:
		def __init__(self, _):
			self.args = None
			self.kwargs = None

	# Base class to be used instead Generic
	class Empty:
		pass
	# Thing what returns Empty when called like Generic[P]
	class _Generic:
		def __getitem__(self, _):
			return Empty
	# Callable[anything] will return None
	class _Callable:
		def __getitem__(self, _):
			return None
	# Make instances
	Callable = _Callable()
	Generic = _Generic()

	class _Literal:
		def __getitem__(self, _):
			return None

	Literal = _Literal()

	class TypedDict:
		def __getitem__(self, _):
			return None


_P = ParamSpec("_P")
_T = TypeVar("_T")

def inherit_signature_from(
	_to: Callable[_P, _T]
) -> Callable[[Callable[..., _T]], Callable[_P, _T]]:
	"""Set the signature checked by pyright/vscode to the signature of another function."""
	return lambda x: x  # type: ignore[reportReturnType]

LabelParamSpec = ParamSpec('LabelParamSpec')

class Alert(TypedDict):
	sender_name: str
	title: str
	description: str
	level: Literal["minor", "moderate", "severe", "extreme", "unknown"]
	color: str
	icon: Optional[str]

#endregion

class NotStupidLabel(Gtk.Label):
	''' A label that doesn't have retarded defaults. '''
	@inherit_signature_from(Gtk.Label.__init__)
	def __init__(self, *args, **kwargs):
		wrap: bool = kwargs.pop("wrap", True)
		wrap_mode: Pango.WrapMode = kwargs.pop("wrap_mode", Pango.WrapMode.WORD_CHAR)
		justify: Gtk.Justification = kwargs.pop("justify", Gtk.Justification.LEFT)
		halign: Gtk.Align = kwargs.pop("halign", Gtk.Align.START)
		valign: Gtk.Align = kwargs.pop("valign", Gtk.Align.START)
		xalign: int = kwargs.pop("xalign", 0)
		yalign: int = kwargs.pop("yalign", 0)
		super().__init__(
	  		*args,
			wrap=wrap,
			wrap_mode=wrap_mode,
			justify=justify,
			halign=halign,
			valign=valign,
			xalign=xalign,
			yalign=yalign,
			**kwargs
		)

class AlertsWindow(Gtk.Window):
	alerts: List[Alert]

	def __init__(self, alerts: List[Alert]):
		self.alerts = alerts
		Gtk.Window.__init__(self, title=_("Weather Applet Alerts"))
		self.set_default_size(600, 500)
		self.set_position(Gtk.WindowPosition.CENTER)
		self.set_border_width(10)
		self.set_resizable(True)
		self.set_icon_from_file(str(APPLET_DIR.joinpath("icon.png")))

		self.connect("destroy", Gtk.main_quit)
		self.connect('delete-event', Gtk.main_quit)

		Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)

		self.add(self.create_alerts_box())
		self.show_all()

	def create_alerts_box(self) -> Gtk.ScrolledWindow:
		box = Gtk.VBox( orientation=Gtk.Orientation.VERTICAL, spacing=20)
		for alert in self.alerts:
			box.add(self.create_alert_box(alert))
		return Gtk.ScrolledWindow(child=Gtk.Viewport(child=box))

	def create_alert_box(self, alert: Alert) -> Gtk.Box:
		columns = Gtk.Box(
	  		orientation=Gtk.Orientation.HORIZONTAL,
			spacing=15,
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
			expand=True,
			halign=Gtk.Align.START,
			valign=Gtk.Align.START
		)
		description = NotStupidLabel(
	  		label=alert['description'],
		)
		description.set_size_request(400, -1)

		title = NotStupidLabel(
	  		label=f"{alert['title']}",
	  	)
		bigger_font = Pango.FontDescription.new()
		bigger_font.set_size(15000)
		bigger_font.set_weight(Pango.Weight.BOLD)
		title.modify_font(bigger_font)

		box.add(title)
		box.add(description)
		box.add(NotStupidLabel(
	  		label=f"{alert['sender_name']}",
		))
		return box

	def create_alert_icon(self, alert: Alert) -> Gtk.Image:
		image = Gtk.Image(valign=Gtk.Align.START, halign=Gtk.Align.START)
		image.set_from_icon_name(alert.get("icon", None) or "dialog-warning-symbolic", Gtk.IconSize.LARGE_TOOLBAR)
		image.modify_fg(Gtk.StateType.NORMAL, Gdk.Color.parse(alert["color"])[1])

		return image

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