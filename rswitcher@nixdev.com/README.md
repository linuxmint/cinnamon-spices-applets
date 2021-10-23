# rswitcher
A applet created to be able to easy switch between resolutions of the display.
Especially made to be able to switch from a HiDPI mode with fractional scaling to a regular resolution, with one button-press.

The rswitcher software is also usable to run from shell.

# rswitcher usage

<code>Usage: rswitcher [OPTION]...
Set primary resolution with fractional scaling options
    -r --resolution [ARG]        Resolution of the display
                                 Set [ARG] 'max' to get maximum resolution possible.
  -s --scalingfactor [ARG]     The GTK scaling factor: 1 - 3
  -f --fractionalscaling [ARG] Fractional scaling in percent: 125, 150, 175 200
Example: rswitcher --resolution 3840x2160 --scalingfactor 2 --fractionalscaling 150
Will result in 150% factional scaling with a perceived resolution output at 2560x1440
</code>

# known issues

Right now it works with one display connected. Supporting multi-display is in the pipeline.
