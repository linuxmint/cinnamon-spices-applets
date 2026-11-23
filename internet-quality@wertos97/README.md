# Internet Quality

A compact Cinnamon applet that displays real Internet connection quality as
five vertical dots. It measures latency, jitter, packet loss and DNS response;
it does not use Wi-Fi signal strength or bandwidth tests.

The default schedule sends one ICMP probe every three seconds, checks DNS every
30 seconds and attempts a TCP connection only when ICMP fails. NetworkManager
events trigger an immediate measurement.

Probes target public endpoints by default (Google DNS for ping, Cloudflare for
TCP fallback, example.com for DNS) and are fully configurable. A single probe
is about 150-250 bytes; there are no bandwidth or speed tests, so the traffic
is negligible and will not disturb downloads or online gaming.

## Appearance

- Four organized settings tabs: Connection, Indicator, Colors and Popup
- Switchable five-dot or continuous-bar indicator
- Vertical or horizontal layout with configurable fill direction
- Circle, ellipse, rounded rectangle, capsule, square and diamond shapes
- Independent dot width, height, gap, inner/outer margins and position offsets
- Filled, outlined or hidden inactive dots and three offline styles
- Optional borders, glow, opacity and a background behind the indicator
- Current-quality, per-level or single-color rendering
- Seven color presets and fully custom panel/popup colors
- Configurable popup content, dimensions, spacing, typography and colors
