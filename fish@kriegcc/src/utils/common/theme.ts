export type ThemeAppearance = "Dark" | "Light"

export function getThemeAppearance(className: string): ThemeAppearance {
  const theme = getThemeNodeOfClass(className)
  // using the foreground color is more reliable than background color (more themes has it)
  const color = theme.get_foreground_color()
  // invert color since foreground is used
  const invertedColor = invertColor(color)

  return inferThemeAppearanceFromColor(invertedColor)
}

export function inferThemeAppearanceFromColor(color: imports.gi.Clutter.Color): ThemeAppearance {
  // // "average method":
  // const isDarkTheme = (color.red + color.green + color.blue) / 3 < 0.5

  // determine color mode with "luminance method" (more accurate than average method):
  const red = color.red / 255
  const green = color.green / 255
  const blue = color.blue / 255

  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const isDarkTheme = luminance < 0.5

  return isDarkTheme ? "Dark" : "Light"
}

// Get theme node of a CSS class from active stylesheet.
export function getThemeNodeOfClass(className: string): imports.gi.St.ThemeNode {
  const themeContext = imports.gi.St.ThemeContext.get_for_stage(global.stage)
  const themeNode = imports.gi.St.ThemeNode.new(
    themeContext,
    null,
    themeContext.get_theme(),
    imports.gi.St.Widget,
    "",
    className,
    "",
    // "inline_style": undocumented argument.
    // Bug: Using empty string here causes an error in console. See: https://gitlab.gnome.org/GNOME/gnome-shell/-/issues/4634
    " ",
    // "important": undocumented argument.
    // Fallback lookup in default Cinnamon theme, I guess. Seems to be something CJS specific (argument is not in GJS).
    true,
  )
  return themeNode
}

export function getThemeNodeOfWidget(widget: imports.gi.St.Widget): imports.gi.St.ThemeNode {
  if (!isWidgetOnStage(widget)) {
    throw new Error("Actor is not on the stage.")
  }
  return widget.get_theme_node()
}

// An Widget (actor) which has a parent indicates that it is on the stage.
export function isWidgetOnStage(widget: imports.gi.St.Widget): boolean {
  return !!widget.get_parent()
}

export function invertColor(color: imports.gi.Clutter.Color): imports.gi.Clutter.Color {
  const invertedColor = new imports.gi.Clutter.Color({
    red: 255 - color.red,
    green: 255 - color.green,
    blue: 255 - color.blue,
    alpha: color.alpha,
  })
  return invertedColor
}

// reads and calculate margin of provided element in active CSS stylesheet
export function getMargin(className: string): number {
  const themeNode = getThemeNodeOfClass(className)
  const margin =
    themeNode.get_horizontal_padding() +
    themeNode.get_border_width(imports.gi.St.Side.TOP) +
    themeNode.get_border_width(imports.gi.St.Side.BOTTOM)
  return margin
}
