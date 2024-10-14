const { AppletPopupMenu } = imports.ui.applet

export abstract class BasePopupMenu extends AppletPopupMenu {
  constructor(launcher: imports.ui.applet.Applet, orientation: imports.gi.St.Side) {
    super(launcher, orientation)
    this.actor.add_style_class_name("fish-menu")
  }

  public addStyleClassName(className: string): void {
    this.actor.add_style_class_name(className)
  }

  public removeStyleClassName(className: string): void {
    this.actor.remove_style_class_name(className)
  }
}
