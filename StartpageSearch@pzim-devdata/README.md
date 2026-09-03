# Startpage Search

A Cinnamon panel applet providing a Startpage search field. Click the
magnifier icon, type your query, press Enter: your default browser opens
on the Startpage results page.

![screenshot](screenshot.png)

## Features

- Panel applet with a search popup (field on top, buttons below)
- **Search**: submits the field content to Startpage (Enter or magnifier button)
- **Paste clipboard**: fills the field with the clipboard content
- **Paste & Search**: reads the clipboard and searches it directly
- **Smart URL detection**: if the clipboard (or the field) contains a web
  address (`https://…`, `http://…`, `www.…`, or a bare domain like
  `example.com`), it is opened directly instead of searching it
- Automatic browser focus: raises and activates the browser window,
  whether minimized, backgrounded, or freshly started
- Tooltips on every button
- Zero dependencies. Pure Cinnamon API (cjs, St toolkit)
- Translated (gettext): fr, de, es, it, nl, pt

## Dependencies

None. Pure Cinnamon API (cjs, St toolkit).

## Installation

From Cinnamon System Settings -> Applets -> Download tab (once accepted
in the official spices), or manually:

```bash
mkdir -p ~/.local/share/cinnamon/applets/StartpageSearch@pzim-devdata
cp -r files/StartpageSearch@pzim-devdata/* \
      ~/.local/share/cinnamon/applets/StartpageSearch@pzim-devdata/
```

Then right-click the panel -> Applets -> add "Startpage Search".

## Usage

| Action                   | Result                                        |
|--------------------------|-----------------------------------------------|
| Left click on icon       | Opens the popup, focuses the field            |
| Type query + Enter       | Browser opens on Startpage results             |
| Click the magnifier      | Same as Enter                                 |
| Click the paste icon     | Fills the field with the clipboard             |
| Click "Paste & Search"   | Searches the clipboard content immediately     |
| Clipboard contains a URL | The URL opens directly (no search performed)   |
| Esc                      | Closes the popup                               |

## Configuration

No configuration needed. Two behaviors can be tuned at the top of
`applet.js`:

- `SEARCH_URL`: the search engine (see below)
- `DETECT_URLS_IN_ENTRY`: set to `false` to always treat typed text as a
  search query, even if it looks like a URL

## Using another search engine

Edit the `SEARCH_URL` constant at the top of `applet.js`. The URL must
contain the full query prefix; the applet appends the URL-encoded query.

Default:

```javascript
const SEARCH_URL = "https://www.startpage.com/sp/search?query=";
```

Privacy-first engines (no profiling, no search history):

| Engine        | URL                                               | Notes                              |
|---------------|---------------------------------------------------|------------------------------------|
| Startpage     | `https://www.startpage.com/sp/search?query=`      | Google results, anonymized         |
| DuckDuckGo    | `https://duckduckgo.com/?q=`                     | Own index, no tracking             |
| Qwant         | `https://www.qwant.com/?q=`                       | EU (France), no tracking           |
| Brave Search  | `https://search.brave.com/search?q=`             | Own index, no tracking             |
| Mojeek        | `https://www.mojeek.com/search?q=`               | Own crawler, UK                    |
| Ecosia        | `https://www.ecosia.org/search?q=`                | Plants trees, Bing proxy anonymized|
| Lilo          | `https://search.lilo.org/?q=`                     | EU, funds social projects           |
| MetaGer      | `https://metager.de/meta/meta.ger3?eingabe=`       | German meta-engine                  |
| SearXNG       | `https://searx.be/search?q=`                      | Open-source meta-engine, many instances |
| Whoogle       | *(self-hosted)* `https://YOUR_INSTANCE/search?q=` | Self-hosted Google proxy           |

Mainstream engines:

| Engine    | URL                                              |
|-----------|--------------------------------------------------|
| Google    | `https://www.google.com/search?q=`               |
| Bing      | `https://www.bing.com/search?q=`                 |
| Yahoo     | `https://search.yahoo.com/search?p=`             |
| Yandex    | `https://yandex.com/search/?text=`               |
| Wikipedia | `https://en.wikipedia.org/w/index.php?search=`    |
| YouTube   | `https://www.youtube.com/results?search_query=`   |
| Amazon    | `https://www.amazon.fr/s?k=`                     |

Examples:

```javascript
// DuckDuckGo
const SEARCH_URL = "https://duckduckgo.com/?q=";

// Qwant
const SEARCH_URL = "https://www.qwant.com/?q=";

// Your own SearXNG instance
const SEARCH_URL = "https://searx.example.org/search?q=";
```

After editing, reload the applet (right-click -> Reload, or restart
Cinnamon with Ctrl+Alt+Esc).

## Source code

Latest source in the
[Cinnamon Spices repository](https://github.com/linuxmint/cinnamon-spices-applets/tree/master/StartpageSearch@pzim-devdata).
