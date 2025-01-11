declare namespace imports.gi.Clutter {
  interface Actor extends Atk.ImplementorIface, Animatable {
    // used in Animation.ts (sliced-image), loadFile method to set x,y align
    // instead we could use the already available methods:
    // this.animations.set_x_align(Clutter.ActorAlign.CENTER)
    // this.animations.set_y_align(Clutter.ActorAlign.CENTER)
    // ?
    set(obj: {}): void
  }
}
