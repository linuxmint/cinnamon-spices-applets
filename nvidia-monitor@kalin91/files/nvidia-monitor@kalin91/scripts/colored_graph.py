"""
This module defines the core classes for rendering a colored graph using Cairo in a GTK application. It includes:
- `Dimensions`: A dataclass to manage graph dimensions and coordinates.
- `ColoredGraph`: An abstract base class for drawable graph elements with color and name properties.
- `DataSeries`: Represents a series of data points to be plotted, with associated controls for visibility
    and formatting.
- `DataCairoAxis`: Represents an axis on the graph, responsible for drawing itself and its labels based on
    its properties.
"""

import sys
from enum import Enum, auto
from dataclasses import dataclass, field
from abc import ABC, abstractmethod
from typing import Any, cast, Callable, ClassVar, TypedDict, Iterable, Self, TypeVar, Optional
from cairo import Context as CairoContext
from gi import require_version

require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk  # type: ignore  # noqa: E402

T = TypeVar("T")


@dataclass
class Dimensions:
    """
    Represents the dimensions and coordinates for the graph.
    """

    class Cords(TypedDict):
        """
        Represents a single coordinate point on the graph, including its X position, associated data series values,
            raw data, step size, and timestamp.
        """

        x: float
        data_series: dict[str, float]
        raw: dict[str, Any]
        step_x: float
        ts: str

    margin_left: int
    margin_right: int
    margin_bottom: int
    margin_top: int

    width: int = field(init=False)
    height: int = field(init=False)
    graph_width: int = field(init=False)
    graph_height: int = field(init=False)
    coords: list["Dimensions.Cords"] = field(default_factory=list)

    def update_size(self, widget: Gtk.Widget) -> Self:
        """
        Updates the size attributes based on the allocated size of the given GTK widget.

        Args:
            widget (Gtk.Widget): The GTK widget whose size is used to update the dimensions.

        Returns:
            Self: The updated Dimensions instance with new size attributes.
        """
        self.width = widget.get_allocated_width()
        self.height = widget.get_allocated_height()
        self.graph_width = self.width - self.margin_left - self.margin_right
        self.graph_height = self.height - self.margin_top - self.margin_bottom
        return self


class ColoredGraph(ABC):
    """
    Abstract base class for graph elements that have a color and a name. It provides common properties and methods
    for handling color and name, as well as an abstract draw method that must be implemented by subclasses.

    Properties:
        _color (tuple[float, float, float, float]): The RGBA color of the graph element, stored as a tuple of
            floats in the range [0, 1].
        _name (str): The name of the graph element, which can be used for identification or labeling purposes.
    """

    _color: tuple[float, float, float, float]
    _name: str

    @abstractmethod
    def draw(self: Self, cr: CairoContext, d: Dimensions) -> None:
        """
        Abstract method to draw the graph element using the provided Cairo context and dimensions. Subclasses must
        implement this method to define how the element is rendered on the graph.

        Args:
            self (Self): The instance of the graph element being drawn, which contains the properties such as color
                and name that may be used during drawing.
            cr (CairoContext): The Cairo context used for drawing.
            d (Dimensions): The dimensions and coordinates for the graph.
        """
        pass

    @property
    def color(self) -> tuple:
        """Gets the color of the graph element as an RGBA tuple."""
        return self._color

    @color.setter
    def color(self, value: tuple) -> None:
        """Sets the color of the graph element. The value should be an RGBA tuple with values in the range [0, 1]."""
        self._color = value

    @property
    def name(self) -> str:
        """Gets the name of the graph element."""
        return self._name

    def __init__(self, name: str, color: str) -> None:
        """
        Initializes the ColoredGraph with a name and a color. The color is parsed from a string
        format (e.g., hex or rgb) into an RGBA tuple.

        Args:
            name (str): The name of the graph element.
            color (str): The color of the graph element in string format (e.g., hex or rgb).
        """
        self._color = self._hex_to_rgb(color)
        self._name = name

    def _hex_to_rgb(self, color_str: str) -> tuple[float, float, float, float]:
        """
        Converts a color string in hex or rgb format to an RGBA tuple with values in the range [0, 1].
        Args:
            color_str (str): The color string to be parsed (e.g., hex or rgb format).

        Returns:
            tuple[float, float, float, float]: The parsed color as an RGBA tuple with values in the range [0, 1].
        """
        try:
            c = color_str.strip("'\" ")
            # Handle hex
            if c.startswith("#"):
                hex_s = c.lstrip("#")
                if len(hex_s) == 3:
                    hex_s = "".join(x * 2 for x in hex_s)
                if len(hex_s) >= 6:
                    r = int(hex_s[0:2], 16) / 255.0
                    g = int(hex_s[2:4], 16) / 255.0
                    b = int(hex_s[4:6], 16) / 255.0
                    a = 1.0
                    if len(hex_s) == 8:
                        a = int(hex_s[6:8], 16) / 255.0
                    return (r, g, b, a)

            # Handle rgb/rgba
            elif c.startswith("rgb"):
                content = c.split("(")[1].split(")")[0]
                parts = [x.strip() for x in content.split(",")]
                if len(parts) >= 3:
                    vals = [float(x) for x in parts]
                    r, g, b = vals[0], vals[1], vals[2]
                    a = vals[3] if len(vals) > 3 else 1.0
                    # Normalize if 0-255 range
                    if r > 1.0 or g > 1.0 or b > 1.0:
                        r /= 255.0
                        g /= 255.0
                        b /= 255.0
                    return (r, g, b, a)
        except Exception as e:
            print(f"Error parsing color '{color_str}': {e}", file=sys.stderr)
            return (1.0, 0.0, 1.0, 1.0)  # Error magenta

        return (1.0, 1.0, 1.0, 1.0)  # Fallback white


class DataSeries(ColoredGraph):
    """
    Represents a series of data points to be plotted on the graph. It includes properties for visibility,
    label management, and formatting. It also provides methods to add controls for toggling visibility
    and updating labels based on new data.

    Class-level properties:
        __ctrl_box (Gtk.Box): A GTK box that serves as a container for the visibility toggle controls for all
            data series.

    Properties:
        __show (bool): Indicates whether the data series is currently visible on the graph.
        __label (Gtk.Label): The GTK label widget associated with this data series, used for displaying the series name
            and value.
        __check (Gtk.CheckButton): The GTK check button used to toggle the visibility of this data series on the graph.
        __format (Callable[[dict[str, Any], int], str]): A function that formats the label text for this data series
            based on the current data values and an optional precision parameter.
    """

    # class properties
    __ctrl_box: ClassVar[Gtk.Box] = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
    __ctrl_box.set_halign(Gtk.Align.CENTER)

    # Instance properties
    __show: bool
    __label: Gtk.Label
    __check: Gtk.CheckButton
    __format: Callable[[dict[str, Any], int], str]

    @classmethod
    def get_ctrl_box(cls) -> Gtk.Box:
        """Gets the class-level control box used for adding visibility toggle controls for all data series."""
        return cls.__ctrl_box

    @property
    def show(self) -> bool:
        """Gets the visibility status of the data series."""
        return self.__show

    @show.setter
    def show(self, value: bool) -> None:
        """Sets the visibility status of the data series."""
        self.__show = value

    @property
    def format(self) -> Callable[[dict[str, Any], int], str]:
        """Gets the formatting function used to generate the label text for the data series based on the
        current data values."""
        return self.__format

    def __init__(
        self, name: str, color: str, builder: Gtk.Builder, format: Callable[[float, int], str], check_str: str
    ) -> None:
        """
        Initializes the DataSeries with a name, color, GTK builder for UI elements, a formatting function for labels,
        and a string for the visibility toggle check button.
        Args:
            name (str): The name of the data series.
            color (str): The color of the data series in string format (e.g., hex or rgb).
            builder (Gtk.Builder): The GTK builder used to retrieve UI elements for the data series.
            format (Callable[[float, int], str]): A function that formats the label text based on the data value
            and an optional precision parameter.
            check_str (str): The label text for the visibility toggle check button.
        """
        super().__init__(name, color)
        self.__show = True

        lbl_name = f"label_{name}"
        lbl: Gtk.Label = cast(Gtk.Label, builder.get_object(lbl_name))
        # setattr(self, lbl_name, lbl)
        lbl.set_name(lbl_name)  # For CSS targeting
        lbl.set_attributes(None)  # Clear Glade attributes to allow markup updates
        self.__label = lbl
        self.__format = lambda dict_data, x: format(dict_data.get(self._name, 0), x)
        chk: Gtk.CheckButton = Gtk.CheckButton.new_with_label(check_str)
        chk.set_active(True)
        self.__check = chk

    def add_control(self, parent_draw: Gtk.DrawingArea) -> None:
        """
        Adds a visibility toggle control (check button) for this data series to the class-level control box. The toggle
        is connected to an event handler that updates the visibility status and triggers a redraw
        of the graph when toggled.
        Args:
            parent_draw (Gtk.DrawingArea): The drawing area widget that will be redrawn when the
            visibility toggle is changed.
        """
        self.__check.connect("toggled", self._on_toggle, parent_draw)
        self.get_ctrl_box().pack_start(self.__check, False, False, 0)

    def _on_toggle(self, button: Gtk.CheckButton, parent_draw: Gtk.DrawingArea) -> None:
        """
        Event handler for the visibility toggle check button. It updates the visibility status of the data series
        based on the toggle state and queues a redraw of the parent drawing area to reflect the change in visibility.
        Args:
            button (Gtk.CheckButton): The check button that was toggled, used to determine the new visibility state.
            parent_draw (Gtk.DrawingArea): The drawing area widget that will be redrawn when the
            visibility toggle is changed.
        """
        self.show = button.get_active()
        parent_draw.queue_draw()

    def parse_to_pango_hex(self, color_str) -> str:
        """
        Converts rgba/rgb string to Pango hex color #RRGGBBAA using consistent parser as _hex_to_rgb to ensure
        color consistency between drawing and label markup. This is necessary because Pango expects hex color
        format for markup, while the internal representation uses RGBA tuples for drawing with Cairo.

        Args:
            color_str (_type_): The color string to be parsed, expected to be in the same format as accepted
            by _hex_to_rgb (e.g., hex or rgb).

        Returns:
            str: The Pango hex color string in the format #RRGGBBAA.
        """
        r, g, b, a = color_str
        return "#%02x%02x%02x%02x" % (int(r * 255), int(g * 255), int(b * 255), int(a * 255))

    # Update labels with dynamic colors
    def update_label(self, dict_data: dict[str, Any]) -> None:
        """
        Updates the label markup (text and color) for this data series.

        Uses the configured formatting function to generate the text from `dict_data`
        and applies the current series color for visual consistency.

        Args:
            dict_data (dict[str, Any]): The current data dictionary containing values
                needed to format the label.
        """
        text = self.format(dict_data, 0)
        color_hex = self.parse_to_pango_hex(self.color)  # originally was with string color
        self.__label.set_markup(f"<span color='{color_hex}'>{text}</span>")

    def draw(self: Self, cr: CairoContext, d: Dimensions) -> None:
        """
        Draws the data series on the graph using the provided Cairo context and dimensions. It iterates through the
        coordinates in the dimensions and draws lines connecting the points for this data series, using the series
        color for the stroke.

        Args:
            self (Self): The instance of the DataSeries being drawn,
                which contains the properties and formatting for the series.
            cr (CairoContext): The Cairo context used for drawing.
            d (Dimensions): The dimensions and coordinates for drawing.
        """
        cr.set_source_rgba(*self.color)
        cr.set_line_width(2)
        first = True
        for pt in d.coords:
            if first:
                cr.move_to(pt["x"], pt["data_series"][self.name])
                first = False
            else:
                cr.line_to(pt["x"], pt["data_series"][self.name])
        cr.stroke()


class DataCairoAxis(ColoredGraph):
    """
    Represents an axis on the graph, responsible for drawing itself and its labels based on its properties.
    It includesproperties for the axis direction, steps, and associated data series. The draw method handles
    rendering the axis lines and labels according to the specified properties and the current graph dimensions.

    Properties:
        __series (set[DataSeries]): A set of DataSeries instances that are associated with this axis and will be
            drawn according to the axis properties.
        __props (AxisProps): The properties of the axis, including its direction, value range, and steps for grid lines.


    """

    class AxisDirection(Enum):
        """Defines the possible directions for the axis, which can be either left-to-right (horizontal)
        or up-to-down (vertical)."""

        LEFT_TO_RIGHT = "leftToRight"
        UP_TO_DOWN = "upToDown"

    class AxisProps(TypedDict):
        """Defines the properties for the axis, including its direction, value range,
        and the number of steps for grid lines."""

        direction: "DataCairoAxis.AxisDirection"
        # values: tuple[float, float]
        steps: int

    class Edge(Enum):
        """Defines the edge types for labeling the axis, which can be the start, inner steps, or end of the axis."""

        START = auto()
        INNER = auto()
        END = auto()

    __series: set[DataSeries]
    __props: AxisProps

    @property
    def series(self) -> set[DataSeries]:
        """Gets the set of data series associated with this axis."""
        return self.__series

    @property
    def props(self) -> AxisProps:
        """Gets the properties of the axis, including its direction, value range, and steps."""
        return self.__props

    @property
    def range(self) -> tuple[float, float]:
        """Gets the value range for the axis, which is typically defined as a tuple of (min, max) values.
        This range is used for scaling the data points appropriately when drawing the graph."""
        return self.__range

    def __init__(
        self,
        name: str,
        color: str,
        range: tuple[float, float],
        series: set[DataSeries],
        props: AxisProps,
        lbl_text_fn: Callable[[Self, CairoContext, Dimensions, float, Edge], None],
    ) -> None:
        """
        Initializes the DataCairoAxis with a name, color, value range, associated data series, axis properties,
        and a label text function that defines how to draw the labels for the axis based on its properties
        and the current graph dimensions.
        Args:
            name (str): The name of the axis.
            color (str): The color of the axis in string format (e.g., hex or rgb).
            range (tuple[float, float]): The value range for the axis, defined as a tuple of (min, max) values.
            series (set[DataSeries]): The set of data series associated with this axis, which will be
                drawn according to the axis properties.
            props (AxisProps): The properties of the axis, including its direction, value range, and steps.
            lbl_text_fn (Callable[[Self, CairoContext, Dimensions, float, Edge], None]): A function that defines
                how to draw the labels for the axis. It takes the axis instance, Cairo context, graph dimensions,
                a ratio (0 to 1) representing the position along the axis, and an edge type (start, inner, end)
                to determine the label content and position.
        """
        super().__init__(name, color)
        self.__series = series
        self.__props = props
        self.__lbl_text_fn = lbl_text_fn
        self.__range = range

    def draw_text(self, cr: CairoContext, text: str, x: float, y: float, align_right: bool) -> None:
        """
        Draws the text for the axis labels at the specified coordinates, with an option to align the text to the right
        of the given coordinates. The text is drawn using the axis color for visual consistency.
        Args:
            cr (CairoContext): The Cairo context used for drawing the text.
            text (str): The text to be drawn as the label for the axis.
            x (float): The X coordinate for the text position on the graph.
            y (float): The Y coordinate for the text position on the graph.
            align_right (bool): A boolean flag indicating whether the text should be aligned to the right of
                the specified coordinates.
        """
        cr.set_source_rgba(*self.color)
        extents = cr.text_extents(text)
        text_x = x - extents.width - 2 if align_right else x + 2
        text_y = y + extents.height / 2
        cr.move_to(text_x, text_y)
        cr.show_text(text)

    def draw(self: Self, cr: CairoContext, d: Dimensions) -> None:
        """
        Draws the axis on the graph using the provided Cairo context and dimensions. It iterates
            through the steps defined in the axis properties to draw the grid lines and labels at the
            appropriate positions along the axis. It also draws the associated data series for this axis
            if they are set to be shown.

        Args:
            self (Self): The instance of the DataCairoAxis being drawn, which contains the properties and
                associated data series for the axis.
            cr (CairoContext): The Cairo context used for drawing the axis.
            d (Dimensions): The dimensions of the graph area where the axis is being drawn.
        """
        for i in range(self.props["steps"] + 1):
            e: DataCairoAxis.Edge
            if i == 0:
                e = DataCairoAxis.Edge.START
            elif i == self.props["steps"]:
                e = DataCairoAxis.Edge.END
            else:
                e = DataCairoAxis.Edge.INNER
            r = i / float(self.props["steps"])
            self.__lbl_text_fn(self, cr, d, r, e)
        for s in [s for s in self.series if s.show]:
            s.draw(cr, d)


axis_direction = DataCairoAxis.AxisDirection


class DataCairoGrid(ColoredGraph):
    """
    Represents the grid of the graph, responsible for drawing the grid lines and delegating the
    drawing of axes and their labels.

    It includes a set of DataCairoAxis instances that define the axes to be drawn on the graph. The draw method
    handles rendering the grid lines based on the active axes and their properties, and then calls the draw
    method of each active axis to render the axes and their labels.

    Properties:
        __cairo (set[DataCairoAxis]): A set of DataCairoAxis instances that define the axes to be drawn on the graph.
            Each axis includes
    """

    __cairo: set[DataCairoAxis]

    @property
    def cairo(self) -> set[DataCairoAxis]:
        """Gets the set of DataCairoAxis instances that define the axes to be drawn on the graph."""
        return self.__cairo

    def __init__(self, name: str, color: str, cairo: set[DataCairoAxis]) -> None:
        """
        Initializes the DataCairoGrid with a name, color, and a set of DataCairoAxis instances that define
        the axes to be drawn on the graph.
        Args:
            name (str): The name of the grid, which can be used for identification or labeling purposes.
            color (str): The color of the grid lines.
            cairo (set[DataCairoAxis]): A set of DataCairoAxis instances that define the axes to be drawn on the graph.
        """
        super().__init__(name, color)
        self.__cairo = cairo

    def _all_identical(self, iterable: Iterable[T]) -> Optional[T]:
        iterator = iter(iterable)
        try:
            first = next(iterator)
        except StopIteration:
            return None
        for item in iterator:
            if item != first:
                raise ValueError("Not all values are identical")
        return first

    def draw(self, cr: CairoContext, d: Dimensions) -> None:
        """
        Draws the grid on the graph using the provided Cairo context and dimensions. It determines the active axes
        based on their visibility and properties, and then draws the grid lines accordingly. It also calls the draw
        method of each active axis to render the axes and their labels on the graph.

        Args:
            cr (CairoContext): The Cairo context used for drawing the grid and axes.
            d (Dimensions): The dimensions of the graph area where the grid and axes are being drawn.

        Raises:
            RuntimeError: If the graph dimensions are too small to draw the grid.
            RuntimeError: If no upToDown axes are found when expected.
            RuntimeError: If no leftToRight axes are found when expected.
        """
        graph_w = d.graph_width
        graph_h = d.graph_height

        if graph_w <= 0 or graph_h <= 0:
            print("Graph dimensions too small to draw grid.", file=sys.stderr)
            raise RuntimeError(f"Graph dimensions too small to draw grid. width={graph_w}, height={graph_h}")

        cr.set_font_size(10)
        active_axis: dict[axis_direction, list[DataCairoAxis]] = {
            axis_direction.LEFT_TO_RIGHT: list(
                axis
                for axis in self.__cairo
                if axis.props["direction"] == axis_direction.LEFT_TO_RIGHT and any(s.show for s in axis.series)
            ),
            axis_direction.UP_TO_DOWN: list(
                axis
                for axis in self.__cairo
                if axis.props["direction"] == axis_direction.UP_TO_DOWN and any(s.show for s in axis.series)
            ),
        }
        if active_axis[axis_direction.UP_TO_DOWN]:
            ud_steps = self._all_identical(axis.props["steps"] for axis in active_axis[axis_direction.UP_TO_DOWN])
            if ud_steps is None:
                print("No upToDown axes found, skipping grid drawing.", file=sys.stderr)
                raise RuntimeError("No upToDown axes found, skipping grid drawing.")
            for i in range(ud_steps + 1):
                ratio = i / float(ud_steps)
                y = d.margin_top + graph_h * (1 - ratio)  # 0 at bottom

                # Grid Line (Horizontal)
                cr.set_source_rgba(*self.color)
                cr.move_to(d.margin_left, y)
                cr.line_to(d.width - d.margin_right, y)
                cr.stroke()
            for axis in active_axis[axis_direction.UP_TO_DOWN]:
                axis.draw(cr, d)
        if active_axis[axis_direction.LEFT_TO_RIGHT]:
            lr_steps = self._all_identical(axis.props["steps"] for axis in active_axis[axis_direction.LEFT_TO_RIGHT])
            if lr_steps is None:
                print("No leftToRight axes found, skipping grid drawing.", file=sys.stderr)
                raise RuntimeError("No leftToRight axes found, skipping grid drawing.")
            for i in range(lr_steps + 1):
                ratio = i / float(lr_steps)
                x = d.margin_left + graph_w * ratio

                if 0 < i < lr_steps:
                    # Grid Line (Vertical)
                    cr.set_source_rgba(*self.color)
                    cr.move_to(x, d.margin_top)
                    cr.line_to(x, d.height - d.margin_bottom)
                    cr.stroke()
            for axis in active_axis[axis_direction.LEFT_TO_RIGHT]:
                axis.draw(cr, d)


class DataCanvas(ColoredGraph):
    """
    Represents the main data canvas for rendering the graph, including handling mouse events for interactivity
    and managing the historical data points to be displayed.

    Properties:
        __graph (Gtk.DrawingArea): The GTK drawing area where the graph is rendered.
        __history (list[dict[str, Any]]): A list of historical data points, each represented as a dictionary
            of key-value pairs.
        __max_history (int): The maximum number of historical data points to retain and display on the graph.
        __grid (DataCairoGrid): The DataCairoGrid instance that defines the grid and axes for the graph.
        __mouse_x (float): The current X coordinate of the mouse cursor within the graph area, used for
            displaying tooltips and interactive elements.
    """

    __graph: Gtk.DrawingArea
    __history: list[dict[str, Any]]
    __max_history: int
    __grid: DataCairoGrid
    __mouse_x: float

    @property
    def graph(self) -> Gtk.DrawingArea:
        """Gets the GTK drawing area where the graph is rendered."""
        return self.__graph

    @property
    def history(self) -> list[dict[str, Any]]:
        """Gets the list of historical data points to be displayed on the graph."""
        return self.__history

    @property
    def max_history(self) -> int:
        """Gets the maximum number of historical data points to retain and display on the graph."""
        return self.__max_history

    @max_history.setter
    def max_history(self, value: int) -> None:
        """Sets the maximum number of historical data points to retain and display on the graph."""
        self.__max_history = value

    @property
    def grid(self) -> DataCairoGrid:
        """Gets the DataCairoGrid instance that defines the grid and axes for the graph."""
        return self.__grid

    @property
    def mouse_x(self) -> float:
        """Gets the current X coordinate of the mouse cursor within the graph area."""
        return self.__mouse_x

    def _on_mouse_leave(self, widget: Gtk.Widget, _event: Gdk.Event) -> None:
        """
        Handles the mouse leave event for the graph area.

        Args:
            widget (Gtk.Widget): The widget that received the event.
            _event (Gdk.Event): The event object containing details about the mouse leave event.
        """
        self.tooltip_idx = -1
        widget.queue_draw()

    def _on_mouse_move(self, _widget: Gtk.Widget, event: Gdk.EventMotion) -> None:
        """
        Handles the mouse move event for the graph area, updating the mouse X coordinate and queuing a redraw
        of the graph to reflect any interactive elements such as tooltips.

        Args:
            _widget (Gtk.Widget): The widget that received the event.
            event (Gdk.EventMotion): The event object containing details about the mouse move event.
        """
        x = event.x

        if len(self.history) < 2:
            return

        # Determine index corresponding to X
        # Width per data point
        points_to_show = min(len(self.history), self.max_history)
        if points_to_show < 2:
            return

        self.__mouse_x = x
        self.graph.queue_draw()

    def _calculate_coords(self, d: Dimensions) -> None:
        """
        Calculates the coordinates for each data point in the history based on the current graph dimensions.
        It populates the `coords` attribute of the `Dimensions` instance with the calculated coordinates
        for rendering the graph.

        Args:
            d (Dimensions): The dimensions of the graph area where the coordinates are being calculated.
        """
        d.coords.clear()

        if not self.history:
            return

        y_axis: set[DataCairoAxis] = {
            axis for axis in self.grid.cairo if axis.props["direction"] == axis_direction.UP_TO_DOWN
        }

        step_x = float(d.graph_width) / (self.max_history - 1) if self.max_history > 1 else d.graph_width
        points_to_draw = min(len(self.history), self.max_history)
        coords = d.coords
        for i in range(points_to_draw):
            data_idx = len(self.history) - 1 - i
            data = self.history[data_idx]

            x = (d.width - d.margin_right) - (i * step_x)

            ts = data.get("ts", "")
            if ts:
                try:
                    ts = ts.split("_")[1].split(".")[0]  # Extract HH:MM:SS
                except Exception:
                    pass  # Keep original if format unexpected
            else:
                ts = "N/A"

            body: "Dimensions.Cords" = {
                "x": x,
                "ts": ts,
                "raw": data,
                "step_x": step_x,
                "data_series": {},
            }

            def get_y(val: float, max_val=100.0) -> float:
                """
                Converts a data value to a Y coordinate on the graph based on the graph dimensions and the specified
                maximum value for scaling.

                Args:
                    val (float): The value to be converted to a Y coordinate.
                    max_val (float, optional): The maximum value for scaling. Defaults to 100.0.

                Returns:
                    float: The calculated Y coordinate.
                """
                return d.margin_top + d.graph_height * (1 - (val / max_val))

            for axis in y_axis:
                for series in axis.series:
                    body["data_series"][series.name] = get_y(data.get(series.name, 0), axis.range[1])

            coords.append(body)

    def _draw_tooltip(self, cr: CairoContext, d: Dimensions) -> None:
        """
        Draws a tooltip on the graph at the current mouse X coordinate, displaying information about the closest
        data point and the associated data series values.

        Args:
            cr (CairoContext): The Cairo context used for drawing.
            d (Dimensions): The dimensions of the graph area where the tooltip is being drawn.

        Raises:
            RuntimeError: If the tooltip logic encounters an unsupported configuration.
        """
        if self.mouse_x and d.coords:
            min_x = d.coords[-1]["x"]
            max_x = d.coords[0]["x"]

            if min_x <= self.mouse_x <= max_x:
                y_series_set = set(
                    series
                    for x in self.grid.cairo
                    if x.props["direction"] == axis_direction.UP_TO_DOWN
                    for series in x.series
                    if series.show
                )
                x_axis_set = set(x for x in self.grid.cairo if x.props["direction"] == axis_direction.LEFT_TO_RIGHT)
                if len(x_axis_set) != 1:
                    print("Tooltip logic currently only supports exactly 1 leftToRight axis.", file=sys.stderr)
                    raise RuntimeError("Tooltip logic currently only supports exactly 1 leftToRight axis.")
                x_axis = next(iter(x_axis_set))

                # Find closest point
                # Simple distance check or index calc
                # We can reuse the index calc logic but coords are inverted order in list vs screen X
                # Let's just search closest X
                closest_pt = min(d.coords, key=lambda pt: abs(pt["x"] - self.mouse_x))

                # Draw vertical line
                cr.set_source_rgba(1, 1, 1, 0.5)
                cr.set_line_width(1)
                cr.move_to(closest_pt["x"], d.margin_top)
                cr.line_to(closest_pt["x"], d.height - d.margin_bottom)
                cr.stroke()

                # Draw Info Box
                lines = []
                data = closest_pt["raw"]

                # Time
                ts = closest_pt["ts"]
                lines.append((f"Time: {ts}", x_axis.color))

                for series in y_series_set:
                    lines.append((series.format(data, 1), series.color))

                # Box dims
                box_w = 100
                box_h = len(lines) * 15 + 10
                box_x = closest_pt["x"] + 10
                box_y = d.margin_top + 10

                # Flip if too close to edge
                if box_x + box_w > d.width:
                    box_x = closest_pt["x"] - box_w - 10

                # Box BG
                cr.set_source_rgba(0, 0, 0, 0.8)
                cr.rectangle(box_x, box_y, box_w, box_h)
                cr.fill()
                cr.set_source_rgb(1, 1, 1)
                cr.rectangle(box_x, box_y, box_w, box_h)
                cr.stroke()

                # Text
                ty = box_y + 12
                for text, col in lines:
                    cr.set_source_rgba(*col)
                    cr.move_to(box_x + 5, ty)
                    cr.show_text(text)
                    ty += 15

    def __init__(
        self, name: str, color: str, graph: Gtk.DrawingArea, grid: DataCairoGrid, d: Dimensions, max_history: int
    ) -> None:
        """
        Initializes the DataCanvas with a name, color, GTK drawing area, grid, dimensions, and maximum history size.
        It sets up the drawing area to handle draw events and mouse interactions for tooltips.

        Args:
            name (str): The name of the data canvas.
            color (str): The color used for drawing the data canvas.
            graph (Gtk.DrawingArea): The GTK drawing area widget where the graph is rendered.
            grid (DataCairoGrid): The grid layout for the data canvas.
            d (Dimensions): The dimensions of the graph area.
            max_history (int): The maximum number of data points to retain in history.
        """
        super().__init__(name, color)
        self.__mouse_x = 0.0
        self.tooltip_idx = -1
        self.__history = []
        self.__max_history = max_history
        self.__graph = graph
        self.__grid = grid
        self.__graph.connect("draw", lambda w, cr: self.draw(cr, d.update_size(w)))

        # Tooltip interactions
        self.__graph.add_events(Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.LEAVE_NOTIFY_MASK)
        self.__graph.connect("motion-notify-event", self._on_mouse_move)
        self.__graph.connect("leave-notify-event", self._on_mouse_leave)

    def draw(self: Self, cr: CairoContext, d: Dimensions) -> None:
        """
        Draws the data canvas on the graph using the provided Cairo context and dimensions. It calculates
        the coordinates for the data points, fills the background with the canvas color, draws the grid
        and axes, and renders the tooltip if the mouse is over the graph area.

        Args:
            self (Self): The instance of the DataCanvas.
            cr (CairoContext): The Cairo context used for drawing.
            d (Dimensions): The dimensions of the graph area.

        Raises:
            RuntimeError: If an error occurs during drawing.
        """
        try:
            self._calculate_coords(d)
            cr.set_source_rgba(*self.color)
            cr.rectangle(0, 0, self.__graph.get_allocated_width(), self.__graph.get_allocated_height())
            cr.fill()
            self.__grid.draw(cr, d)
            if d.coords:
                self._draw_tooltip(cr, d)
        except Exception as e:
            print(f"Error during draw: {e}", file=sys.stderr)
            raise RuntimeError(f"Error during draw: {e}")

    def draw_data(self, new_data: dict[str, Any]) -> None:
        """
        Adds a new data point to the history and updates the graph accordingly. It appends the new data
        point to the history, removes the oldest data point if the history exceeds the maximum size,
        updates the labels for each data series, and queues a redraw of the graph.

        Args:
            new_data (dict[str, Any]): The new data point to be added to the history.
        """
        self.history.append(new_data)
        if len(self.history) > self.max_history:
            self.history.pop(0)
        for series in set().union(*(c.series for c in self.grid.cairo)):
            series.update_label(new_data)
        self.graph.queue_draw()

    def add_controls(self) -> None:
        """
        Adds visibility toggle controls for each data series to the parent container of the graph. It iterates through
        all the data series associated with the axes in the grid and adds a check button for each series to toggle
        its visibility on the graph. The controls are added to a class-level control box, which is then packed
        into the parent container of the graph.

        Raises:
            RuntimeError: If the graph does not have a parent container that is a Gtk.Box, which is required
            for adding the controls.
        """
        for series in set().union(*(c.series for c in self.grid.cairo)):
            series.add_control(self.graph)
        parent = self.graph.get_parent()
        if not parent or not isinstance(parent, Gtk.Box):
            raise RuntimeError("Graph has no parent Box to add controls to.")
        parent.pack_start(DataSeries.get_ctrl_box(), False, False, 0)
