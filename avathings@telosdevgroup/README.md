# Avathings Cinnamon Applet

Unified panel monitor and control center for:
- [changestate](https://github.com/telosdevgroup/changestate): Prime-indexed CPU/GPU compute capacity governor.
- [avabatt](https://github.com/telosdevgroup/avabatt): Native Linux kernel battery charge threshold manager.

## Prerequisites

This applet controls `changestate` and `avabatt`. To install these backend tools:

### Install `avabatt`
```bash
curl -sSL https://raw.githubusercontent.com/telosdevgroup/avabatt/main/install.sh | bash
```

### Install `changestate`
Visit [github.com/telosdevgroup/changestate](https://github.com/telosdevgroup/changestate) for installation instructions.

### Sudo Privileges
To change power profiles and battery thresholds without repeated Polkit password prompts, configure passwordless sudo permissions for the CLI binaries.
