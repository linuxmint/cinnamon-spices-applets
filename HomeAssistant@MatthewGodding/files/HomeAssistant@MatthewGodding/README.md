# Home Assistant Cinnamon Applet

A simple Cinnamon applet that allows you to toggle a Home Assistant entity directly from your panel.

## Features

- Toggle a Home Assistant entity state (on/off) with a single click
- Visual feedback of entity state through panel icon
- Tooltip showing current entity state
- Direct integration with Home Assistant's REST API

## Installation

1. Clone or download this repository to your local machine
2. Copy the `HomeAssistant@MatthewGodding` folder to `~/.local/share/cinnamon/applets/`
3. Configure the applet (see Configuration section)
4. Enable the applet through Cinnamon's panel settings

## Configuration

Configuration is stored in `metadata.json`. You'll need to edit this file to add your Home Assistant details:

```json
{
    "config": {
        "ha-url": "http://homeassistant.local:8123",
        "token": "your_long_lived_access_token",
        "entity-id": "light.example_light"
    }
}
```

### Required Settings

- `ha-url`: The URL of your Home Assistant instance (including port if needed)
- `token`: A long-lived access token from Home Assistant
- `entity-id`: The entity ID you want to control

### Getting a Long-Lived Access Token

1. Log in to your Home Assistant instance
2. Click on your profile name (bottom left)
3. Scroll down to "Long-Lived Access Tokens"
4. Click "Create Token"
5. Give it a name (e.g., "Cinnamon Applet")
6. Copy the token immediately (it won't be shown again)

## Usage

Once configured, the applet will appear in your panel with an icon indicating the current state of your chosen entity. 

- Click the icon to toggle the entity state
- Hover over the icon to see the current state
- The icon will update automatically when the state changes

## Troubleshooting

- If the icon doesn't appear or update, check your Home Assistant URL and token
- Ensure your entity ID is correct and the entity exists in Home Assistant
- Check Cinnamon's log for any error messages (`journalctl /usr/bin/cinnamon -f`)

## Contributing

Feel free to submit issues and enhancement requests!