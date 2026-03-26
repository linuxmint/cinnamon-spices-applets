# Bps: Instant Network Speed

## Introducing

**Bps: Instant Network Speed** is a simple network monitor.

*Bps* means *Bytes per second*.

This applet displays on the panel, every second, the sum of data (in bytes) received and transmitted during that second by all network interfaces present and active on the computer.

**The panel must be horizontal.** This applet will not work on a vertical panel.

## Settings

The settings are accessible by right-clicking on this applet, then choosing *Configure...*.

You can set:

  * *Unit*: Bytes (**B**) or bits (**b**). 1 Byte = 8 bits.
  * *Decimal* or *binary*:
    * Choosing **decimal**, the available prefixes are: k, M, G, T (kilo=thousand; Mega=million; Giga=billion; Tera=1000 billions).
    * Choosing **binary**, the available prefixes are: ki, Mi, Gi, Ti (kibi = 2<sup>10</sup> = 1024; Mebi = 2<sup>20</sup> =  1048576; Gibi = 2<sup>30</sup>; Tebi = 2<sup>40</sup>).

  * *Value order*: **Download first** or **Upload first**. An order of values shown in the panel.
  * *Minimum displayed value*: 
    * **Value**: A minimum value to display in the panel. Min = 0, Max = 999 (for decimal values) or 1023 (for binary values). Default: 0.
    * **Multiple**: Can be "1", "k", "M", "G" or "T". Default: "1".
    * A value set to 1 and a multiple set to “k” are a comfortable combination, avoiding display changes due to small data transfers.

## Translations

[Status of translations](https://github.com/linuxmint/cinnamon-spices-applets/blob/translation-status-tables/.translation-tables/tables/Bps@claudiux.md)

Many thanks to all the translators!

## Links

For your information:

  * [Data-rate units](https://en.wikipedia.org/wiki/Data-rate_units)
  * [Binary prefix](https://en.wikipedia.org/wiki/Binary_prefix)
