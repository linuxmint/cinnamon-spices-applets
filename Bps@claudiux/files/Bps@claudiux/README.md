# Bps: Instant Network Speed

## Introducing

**Bps: Instant Network Speed** is a simple network monitor.

*Bps* means *Bytes per second*.

This applet displays on the panel, every second, the sum of data (in bytes) received and transmitted during that second by all network interfaces present and active on the computer.

**The panel must be horizontal.** This applet will not work on a vertical panel.

## Settings

The settings are accessible by right-clicking on this applet, then choosing *Configure*.

You can set:

  * *Unit*: Bytes (**B**) or bits (**b**). 1 Byte = 8 bits.
  * *Decimal* or *binary*:
    * Choosing **decimal**, the available prefixes are: k, M, G, T (kilo=thousand; Mega=million; Giga=billion; Tera=1000 billions).
    * Choosing **binary**, the available prefixes are: ki, Mi, Gi, Ti (kibi = 2<sup>10</sup> = 1024; Mebi = 2<sup>20</sup> =  1048576; Gibi = 2<sup>30</sup>; Tebi = 2<sup>40</sup>).

  * *Value order*: **Download first** or **Upload first**. An order of values shown in the panel.
  * *Minimum displayed value*: A minimum value (in bytes) to display in the panel. Min = 0, Max = 100000000, step = 64. Default: 0. A value between 256 and 1024 is comfortable, avoiding display changes due to small data transfers.
