# Simple Disk LED

**A small, no-frills disk activity indicator for the Cinnamon panel.**

Simple Disk LED displays a compact indicator in the Cinnamon panel. It is
normally dark and turns green when read or write activity is detected on a
supported disk.

## Features

- Small panel indicator (16 × 10 pixels)
- Green light when disk I/O activity is detected
- Checks activity every 200 milliseconds
- Monitors supported whole disks across the system
- No configuration dialog and no additional dependencies beyond Cinnamon
  and its normal GJS environment

## How it works

The applet reads `/proc/diskstats`, a Linux kernel-provided statistics file,
every 200 ms. It adds the cumulative sector-read and sector-written counters
for supported whole-disk devices. If the total changes between two samples,
the indicator is shown in green for that sampling interval.

The applet recognises these device-name patterns:

- `sd*` and `hd*`
- `vd*` and `xvd*`
- `nvme*n*`
- `mmcblk*`

Partition entries such as `sda1` are intentionally ignored. The indicator
reports activity for the supported disks as a group; it does not identify
which individual disk is busy.

The first successful read establishes the initial counter value and does not
light the indicator. If `/proc/diskstats` cannot be read, the current display
is left unchanged until a later successful sample.

## Installation

1. Copy the directory `simple-disk-led@pit` into:

   ```text
   ~/.local/share/cinnamon/applets/
   ```

2. If the `applets` directory does not yet exist, create it.
3. Restart Cinnamon or log out and back in.
4. Open **System Settings → Applets**, find **Simple Disk LED**, and add it
   to the panel.

The applet UUID is:

```text
simple-disk-led@pit
```

## Project files

- `applet.js` — applet implementation
- `metadata.json` — Cinnamon applet metadata
- `README.md` — this documentation
- `LICENSE` — MIT license

## Compatibility

The applet is intended for the Cinnamon desktop on Linux systems that provide
`/proc/diskstats`. It uses Cinnamon's GJS applet API. Compatibility with
specific Cinnamon releases should be verified by testing on those releases.

## Author

**Chat GPit**

## License

MIT. See [LICENSE](LICENSE).
