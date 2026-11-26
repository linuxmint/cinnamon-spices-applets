# Public IP

A Cinnamon panel applet that displays the current public IP address together with the approximate country flag. It is especially useful when switching between VPN connections.

## Features

- Gets the public IP address from [l2.io](https://l2.io/).
- Looks up the country and ISO country code using [ipwho.is](https://ipwho.is/), then displays the matching flag.
- Reacts to NetworkManager device, connection, and interface-state changes.
- Includes a 30-second interface scan as a fallback and safety net for VPN interfaces that NetworkManager does not report.
- Offers a manual **Refresh now** command in the applet menu.
- Runs network requests asynchronously without blocking Cinnamon.

## Requirements

- Cinnamon desktop.
- `curl` and `ip` (provided by the distribution's `iproute2` package).
- Internet access to l2.io and ipwho.is.
- NetworkManager GObject introspection bindings are optional; the periodic interface scan remains available without them.

On Debian, Ubuntu, and Linux Mint, the required command-line tools can be installed from the distribution repositories with:

```bash
sudo apt install curl iproute2
```

## Privacy and accuracy

The applet sends requests to l2.io to obtain the public IP address and to ipwho.is to look up its country. Both services receive the requester's public IP address. No account or API key is used.

Country detection is based on approximate IP geolocation. With a VPN, it normally represents the VPN exit location and may not match the user's physical location. If the country lookup fails, the IP address is still displayed.

## Installation

After the applet is accepted into Cinnamon Spices, install it through **System Settings → Applets → Download**. The applet can then be added to a panel.

## License

MIT. See [LICENSE](LICENSE).
