const { DrawingArea } = imports.gi.St;
const { cairo_set_source_color } = imports.gi.Clutter;

interface SliderArguments {
  /** The value initally applied. Should be between 0 and 1. If the value is below 0, the slider value is set to 0. If the value is above 1, the slider value is set to 1 */
  initialValue?: number;
  /**
   * @param newValue value between 0 and 1
   */
  onValueChanged?: (newValue: number) => void;
}

export function createSlider(args: SliderArguments) {
  const style_class = "popup-slider-menu-item";

  const { initialValue, onValueChanged } = args;

  let value: number;
  if (initialValue != null) value = limitToMinMax(initialValue);

  const drawing = new DrawingArea({
    style_class,
    reactive: true,
    x_expand: true,
  });

  drawing.connect("repaint", () => {
    const cr = drawing.get_context();
    const themeNode = drawing.get_theme_node();
    const [width, height] = drawing.get_surface_size();

    const handleRadius = themeNode.get_length("-slider-handle-radius");

    const sliderHeight = themeNode.get_length("-slider-height");

    const sliderBorderWidth = themeNode.get_length("-slider-border-width");
    const sliderBorderRadius = Math.min(width, sliderHeight) / 2;

    const sliderBorderColor = themeNode.get_color("-slider-border-color");
    const sliderColor = themeNode.get_color("-slider-background-color");

    const sliderActiveBorderColor = themeNode.get_color(
      "-slider-active-border-color"
    );
    const sliderActiveColor = themeNode.get_color(
      "-slider-active-background-color"
    );

    const TAU = Math.PI * 2;

    const handleX = handleRadius + (width - 2 * handleRadius) * value;

    cr.arc(
      sliderBorderRadius + sliderBorderWidth,
      height / 2,
      sliderBorderRadius,
      (TAU * 1) / 4,
      (TAU * 3) / 4
    );
    cr.lineTo(handleX, (height - sliderHeight) / 2);
    cr.lineTo(handleX, (height + sliderHeight) / 2);
    cr.lineTo(
      sliderBorderRadius + sliderBorderWidth,
      (height + sliderHeight) / 2
    );
    cairo_set_source_color(cr, sliderActiveColor);
    cr.fillPreserve();
    cairo_set_source_color(cr, sliderActiveBorderColor);
    cr.setLineWidth(sliderBorderWidth);
    cr.stroke();

    cr.arc(
      width - sliderBorderRadius - sliderBorderWidth,
      height / 2,
      sliderBorderRadius,
      (TAU * 3) / 4,
      (TAU * 1) / 4
    );
    cr.lineTo(handleX, (height + sliderHeight) / 2);
    cr.lineTo(handleX, (height - sliderHeight) / 2);
    cr.lineTo(
      width - sliderBorderRadius - sliderBorderWidth,
      (height - sliderHeight) / 2
    );
    cairo_set_source_color(cr, sliderColor);
    cr.fillPreserve();
    cairo_set_source_color(cr, sliderBorderColor);
    cr.setLineWidth(sliderBorderWidth);
    cr.stroke();

    const handleY = height / 2;

    const color = themeNode.get_foreground_color();
    cairo_set_source_color(cr, color);
    cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
    cr.fill();

    cr.$dispose();
  });

  drawing.connect("button-press-event", (actor, event) => {
    event.get_device().grab(drawing);

    const motionId = drawing.connect("motion-event", (actor, event) => {
      moveHandle(event);
      return false;
    });

    const buttonReleaseId = drawing.connect(
      "button-release-event",
      (actor, event) => {
        drawing.disconnect(buttonReleaseId);
        drawing.disconnect(motionId);
        event.get_device().ungrab();
        return false;
      }
    );

    moveHandle(event);

    return false;
  });

  function moveHandle(event: imports.gi.Clutter.Event) {
    const [absX, absY] = event.get_coords();

    const [sliderX, sliderY] = drawing.get_transformed_position();
    const relX = absX - (sliderX || 0);

    const width = drawing.width;
    const handleRadius = drawing
      .get_theme_node()
      .get_length("-slider-handle-radius");

    const newValue = (relX - handleRadius) / (width - 2 * handleRadius);
    const newValueLimitToMinMax = limitToMinMax(newValue);

    setValue(newValueLimitToMinMax);
  }

  function limitToMinMax(value: number) {
    return Math.max(Math.min(value, 1), 0);
  }

  function setValue(newValue: number, silent = false) {
    const correctedValue = limitToMinMax(newValue);

    if (correctedValue === value) return;

    value = correctedValue;
    if (!silent) onValueChanged?.(value);
    drawing.queue_repaint();
  }

  function getValue() {
    return value;
  }

  return {
    actor: drawing,
    setValue,
    getValue,
  };
}
