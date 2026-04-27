# 📈 Crypto Tracker Applet for Cinnamon

**UUID:** `crypto-tracker@danipin`

The **Crypto Tracker** is a highly configurable Cinnamon panel applet that displays real-time price and 24-hour change percentage for up to three different cryptocurrencies, fetched directly from the CoinGecko API.

## ✨ Features

* **Multi-Metric Display:** Track up to **three** individual cryptocurrencies simultaneously on the panel.
* **Real-Time Data:** Prices and 24H changes are fetched from the reliable CoinGecko API.
* **Portfolio Tracker:** Manage your holdings, track total balance, and monitor profit/loss in real-time.
* **Alarm Manager:** Centralized management for price and volatility alerts with a history log.
* **API Statistics:** Detailed breakdown of API usage (Basic vs. Key calls) to help manage monthly quotas.
* **Customizable Interval:** Configure the update frequency (from a minimum of 15 seconds) to manage API requests and data freshness.
* **Localization (L10N):** Supports multiple languages for settings and display (German, English, Spanish, French, Russian, Italian, Portuguese, Polish, Dutch, and Simplified Chinese).
* **High Customization:** Configure display symbol, comparison currency, and colors for each metric.

## ⚙️ Configuration & Settings

The applet provides individual settings pages for **Metric 1 (Primary)**, **Metric 2**, **Metric 3**, and **General** settings.

### 1. General Settings

| Setting Name | Description | Default |
| :--- | :--- | :--- |
| **Update Interval** | Defines how often the applet queries the CoinGecko API for new price data. | 30 Seconds |

### 2. Metric Settings (Metric 1, 2, & 3)

Each metric has identical, highly detailed configuration options:

| Section | Setting Name | Description | Details |
| :--- | :--- | :--- | :--- |
| **Display & Activation** | **Enabled** | Toggles the display of this specific metric on the panel. | If disabled, the metric is hidden from the panel and the menu. |
| | **Display Symbol** | The short ticker symbol shown on the panel. | e.g., `BTC`, `ETH`, `ADA`. |
| | **Show Currency Symbol** | Replaces the currency code (e.g., USD) with its symbol (e.g., $). | If disabled, the price is shown as `BTC 45000 USD`. If enabled, it shows `BTC $ 45,000`. |
| **Data Source (API)** | **Currency ID (CoinGecko)** | Select a cryptocurrency from the popular list (BTC, ETH, ADA, SOL, DOT). | This is the CoinGecko ID. |
| | **Custom Currency ID** | Allows entering any other CoinGecko ID (e.g., `litecoin`). | **Overrides** the selection in the dropdown list above. |
| | **Comparison Currency** | Select the fiat currency for price comparison. | Options include USD, EUR, CAD, GBP, JPY, CHF, AUD. The corresponding symbol will be used. |
| **Color Settings** | **Color for Rising Price (▲)** | Sets the color for positive price movement. | Default: Green (`#00FF00`). |
| | **Color for Falling Price (▼)** | Sets the color for negative price movement. | Default: Red (`#FF0000`). |
| | **Color the Arrow Only** | Toggles whether the color applies to the price text or just the arrow. | **If active (default):** Only the arrow (▲/▼) is colored; the price text remains white. |

## 📊 Pop-up Menu Display

When you click the applet on the panel, a pop-up menu opens:

* **Header:** Shows the title **"24H Price Change (%)"**.
* **Metric Rows:** For every **Enabled** metric, a row is displayed showing:
    * The **Display Symbol** (e.g., **BTC**) in bold.
    * The **Comparison Currency** (e.g., (USD)).
    * The calculated **24-hour percentage change** (e.g., `+ 2.45%`) colored according to the configured **Rising/Falling Price** color.

## 📁 Data Storage & Backup

The applet stores your data in the standard user configuration directory.

*   **Persistent Data:** `~/.config/crypto-tracker@danipin/`
    *   `portfolio.json`: Contains your portfolio holdings and transactions.
    *   `alarms.json`: Contains your active and archived alarms.
    *   `call_stats.json`: Tracks your API usage history.

*   **Cache & Logs:** `~/.cache/crypto-tracker@danipin/`
    *   `error_log.txt`: Error log for debugging.

## �️ Development & Localization

The applet uses the standard `gettext` system for translations.

### Adding New Text / Updating Translations

If new strings are added to the code (`applet.js` or `settings-schema.json`), follow these steps to efficiently update all existing translations:

1.  **Re-generate the POT file:**
    ```bash
    xgettext -o po/crypto-tracker@danipin.pot --from-code=UTF-8 $(find . -name "*.js" -o -name "*.json" -o -name "*.desktop")
    ```
2.  **Merge the changes into all existing PO files:**
    ```bash
    # Update German PO file
    msgmerge --update po/de.po po/crypto-tracker@danipin.pot
    # Repeat for all other language files (es.po, fr.po, ru.po, etc.)
    ```
    This process will add new strings and mark any outdated/changed strings with the `# fuzzy` flag, requiring minimal work from the translators.

### Compiling for Local Testing

To test a local translation (e.g., German `de`) on your system, you must compile the `.po` file into a binary `.mo` file and place it in the correct directory:

```bash
mkdir -p ~/.local/share/locale/de/LC_MESSAGES
msgfmt -o ~/.local/share/locale/de/LC_MESSAGES/crypto-tracker@danipin.mo po/de.po
```
