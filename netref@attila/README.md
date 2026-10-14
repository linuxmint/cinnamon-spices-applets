# NetRef - Windows to Linux Command Reference Applet

A Cinnamon applet that provides quick access to a comprehensive Windows CMD to Linux Mint command reference.

## Features

- **965 commands** across 26 categories
- **Windows → Linux translation**: Look up any Windows command and see its Linux equivalent
- **Linux-only commands**: Many Linux commands that have no Windows equivalent
- **Click to copy**: Click any command to copy it to clipboard
- **Search**: Fast search across all commands
- **Categories**: Networking, File Operations, Process Management, System & Systemd, Package Management, and many more
- **sudo labeling**: Commands requiring sudo are clearly marked
- **Modern tools**: Prefers modern Linux tools (ip over ifconfig, ss over netstat, etc.)

## Installation

### From Cinnamon Spices

Install via Cinnamon System Settings > Applets > Available Applets

### Manual Installation

```bash
mkdir -p ~/.local/share/cinnamon/applets/netref@attila
cp -r files/netref@attila/* ~/.local/share/cinnamon/applets/netref@attila/
```

Then enable the applet in Cinnamon System Settings.

## Categories

- **Networking** (122 commands): ipconfig, ping, tracert, nslookup, netstat, etc.
- **File Operations** (66 commands): copy, move, del, rename, etc.
- **Process Management** (44 commands): tasklist, taskkill, etc.
- **System & Systemd** (25 commands): systemctl, journalctl, etc.
- **Package Management** (27 commands): apt, snap, flatpak, etc.
- **Text Processing** (56 commands): grep, sed, awk, etc.
- **Security & Encryption** (37 commands): ssh, gpg, openssl, etc.
- **Virtualization & Containers** (72 commands): docker, podman, lxc, etc.
- And 18 more categories!

## Author

AttilaHuns288452

## License

MIT
