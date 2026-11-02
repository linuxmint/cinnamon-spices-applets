# Live Tennis Scores

Live tennis scores on the Cinnamon panel. The applet cycles through the matches
currently in play and its drop-down lists the whole board, with set scores,
the game in progress, who is serving and whether it is a break point.

Panel line, reading left to right:

```
•Alcaraz - Sinner  6-4 3-4  40-30  BP
```

* `•` marks the player serving. It sits in front of that player's name.
* `6-4 3-4` are the completed and current sets, in display order.
* `40-30` is the game in progress, player 1 first.
* `TB` in front of the two numbers means they are a tiebreak count, not
  0/15/30/40.
* `BP` means break point: the receiver is one point from taking the server's
  game. It is never shown in a tiebreak, where there is no service game to
  break.

## Setup

1. Get a key from [livetennisapi.com](https://livetennisapi.com). The free plan
   needs no card and covers everything this applet does.
2. Right-click the applet, choose **Configure**, and paste the key into
   **API key**.

Until a key is entered the applet shows `Tennis: set API key` and makes no
network request at all.

## Data source

Scores come from the [Live Tennis API](https://livetennisapi.com), a
third-party commercial service, over one endpoint:

    GET https://api.livetennisapi.com/api/public/v1/matches?status=live

That endpoint is on the free plan, and the URL is fixed: no setting of yours is
interpolated into it. The applet calls nothing else and sends nothing but the
key, which travels in the `X-API-Key` request header rather than the query
string so it cannot end up in a logged URL. The key is stored by Cinnamon's own
settings mechanism and is never written to the Cinnamon log.

The tour and draw choices are applied to the answer locally rather than as
query parameters, so switching between ATP, WTA and the rest costs no requests
at all. They follow the API's own rule: a match the feed never assigned a tour
or a draw to - a Davis Cup rubber, say - matches neither `Singles only` nor
`Doubles only`, because a missing value is an answer and not a wildcard.

Disclosure: this applet is contributed by the operator of that API.

## Why 15 minutes is the fastest update

A free key allows 100 requests a day. Each update is exactly one request, so:

| Interval | Requests per day | Fits in 100/day |
|----------|------------------|-----------------|
| 5 min    | 288              | no              |
| 10 min   | 144              | no              |
| **15 min** | **96**         | yes, 4 spare    |
| 30 min   | 48               | yes             |

15 minutes is therefore the floor. The settings spinner will not go below it,
and the applet clamps the value in code as well, so a hand-edited settings
file cannot make it poll faster and quietly burn through someone's daily
allowance. A `429` (rate limited) backs the applet off for a full hour rather
than retrying into a budget that is already spent.

The panel rotation is separate and local: it re-displays scores that have
already been fetched, so setting it to three seconds costs nothing.

`max-instances` is 1 for the same reason - two copies would double the request
rate against the same key.

## Settings

| Setting | What it does |
|---------|--------------|
| API key | Your Live Tennis API key |
| Fetch new scores every | 15 to 240 minutes |
| Tour | All, ATP, WTA, Challenger or ITF |
| Draw | Singles and doubles, singles only, or doubles only |
| List at most | How many matches the drop-down shows |
| Show an icon on the panel | Panel icon on or off |
| Show the next match every | 3 to 60 seconds, local rotation only |

## Messages

Every failure is one short label rather than a stack trace:

| Label | Meaning |
|-------|---------|
| `Tennis: set API key` | No key entered yet |
| `Tennis: loading` | The first read of the session is in flight |
| `Tennis: key rejected` | The key was refused (401/403) |
| `Tennis: rate limited` | Quota or rate limit reached; backing off an hour |
| `Tennis: service error (n)` | The API answered with HTTP `n` |
| `Tennis: bad response` | The answer was not valid JSON |
| `Tennis: offline` | The request could not be made at all |
| `No live tennis` | Nothing is in play right now |
| `No live tennis in this selection` | Matches are in play, but none match your tour/draw choice |

## Icon

The tennis ball icon is drawn for this applet and released under the same
licence as the applet.
