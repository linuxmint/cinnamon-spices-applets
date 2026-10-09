const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Util = imports.misc.util;
const ByteArray = imports.byteArray;

const REDIRECT_PORT = 43127;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;
const AUTH_SCOPES = "user-library-read user-library-modify";
const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";
const VERIFIER_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

const CALLBACK_PAGE =
    "<html><body style=\"font-family: sans-serif; text-align:center; margin-top: 15%;\">" +
    "<h2>Spotify connected</h2><p>You can close this page now.</p></body></html>";

/*
 * Handles the OAuth2 Authorization Code + PKCE flow against Spotify's
 * Accounts service, and the "Liked Songs" Web API calls that Spotify's
 * local MPRIS interface does not expose.
 *
 * `owner` is the applet instance: clientId/refreshToken are read from and
 * written to its AppletSettings-bound properties (spotifyClientId /
 * spotifyRefreshToken) so they persist across sessions.
 */
class SpotifyFavorites {
    constructor(owner) {
        this._owner = owner;
        this._accessToken = null;
        this._accessTokenExpiry = 0;
        this._authService = null;
        this._authTimeoutId = 0;
    }

    get clientId() {
        return (this._owner.spotifyClientId || "").trim();
    }

    get refreshToken() {
        return this._owner.spotifyRefreshToken || "";
    }

    set refreshToken(value) {
        this._owner.spotifyRefreshToken = value || "";
    }

    isConfigured() {
        return this.clientId.length > 0;
    }

    isConnected() {
        return this.refreshToken.length > 0;
    }

    get redirectUri() {
        return REDIRECT_URI;
    }

    // Kicks off the login flow: opens the system browser and listens
    // locally for the OAuth redirect. cb(ok, error) fires once, at the end.
    startAuth(cb) {
        if (!this.isConfigured()) {
            cb(false, "no-client-id");
            return;
        }

        let verifier = this._randomVerifier(64);
        this._pkceChallenge(verifier, (challenge) => {
            if (!challenge) {
                cb(false, "pkce-failed");
                return;
            }

            this._listenForCallback((code, err) => {
                if (!code) {
                    cb(false, err || "cancelled");
                    return;
                }
                this._exchangeCode(code, verifier, cb);
            });

            let url = `${AUTH_URL}?client_id=${encodeURIComponent(this.clientId)}` +
                `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
                `&code_challenge_method=S256&code_challenge=${challenge}` +
                `&scope=${encodeURIComponent(AUTH_SCOPES)}`;
            Util.spawn(['xdg-open', url]);
        });
    }

    // Aborts a pending login flow (e.g. the applet is being removed from
    // the panel) and releases the local listening socket.
    cancelAuth() {
        if (this._authTimeoutId) {
            GLib.source_remove(this._authTimeoutId);
            this._authTimeoutId = 0;
        }
        if (this._authService) {
            this._authService.stop();
            this._authService.close();
            this._authService = null;
        }
    }

    disconnect() {
        this.refreshToken = "";
        this._accessToken = null;
        this._accessTokenExpiry = 0;
    }

    // Ensures this._accessToken is valid, refreshing it if needed, then
    // calls cb(ok).
    ensureAccessToken(cb) {
        let now = GLib.get_monotonic_time() / 1000000;
        if (this._accessToken && now < this._accessTokenExpiry) {
            cb(true);
            return;
        }
        if (!this.isConnected() || !this.isConfigured()) {
            cb(false);
            return;
        }

        let args = ['curl', '-s', '-X', 'POST', TOKEN_URL,
            '--data-urlencode', 'grant_type=refresh_token',
            '--data-urlencode', `refresh_token=${this.refreshToken}`,
            '--data-urlencode', `client_id=${this.clientId}`];

        this._runCommand(args, (ok, text) => {
            let json = ok ? this._parseJson(text) : null;
            if (!json || json.error) {
                cb(false);
                return;
            }
            this._accessToken = json.access_token;
            this._accessTokenExpiry = now + (json.expires_in || 3600) - 30;
            if (json.refresh_token)
                this.refreshToken = json.refresh_token;
            cb(true);
        });
    }

    // cb(liked) with liked = true/false, or null on error / not connected.
    checkLiked(trackId, cb) {
        this.ensureAccessToken((ok) => {
            if (!ok) {
                cb(null);
                return;
            }
            let args = ['curl', '-s', '-H', `Authorization: Bearer ${this._accessToken}`,
                `${API_BASE}/me/tracks/contains?ids=${encodeURIComponent(trackId)}`];
            this._runCommand(args, (ok2, text) => {
                if (!ok2) {
                    cb(null);
                    return;
                }
                let json = this._parseJson(text);
                cb(Array.isArray(json) ? !!json[0] : null);
            });
        });
    }

    // cb(ok, errorCode)
    setLiked(trackId, liked, cb) {
        this.ensureAccessToken((ok) => {
            if (!ok) {
                cb(false, "auth");
                return;
            }
            let method = liked ? 'PUT' : 'DELETE';
            let args = ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-X', method,
                '-H', `Authorization: Bearer ${this._accessToken}`,
                '-H', 'Content-Length: 0',
                `${API_BASE}/me/tracks?ids=${encodeURIComponent(trackId)}`];
            this._runCommand(args, (ok2, text) => {
                let code = parseInt(text, 10);
                cb(ok2 && code >= 200 && code < 300, code);
            });
        });
    }

    _listenForCallback(cb) {
        let service = new Gio.SocketService();
        try {
            service.add_inet_port(REDIRECT_PORT, null);
        } catch (e) {
            cb(null, "port-busy");
            return;
        }

        let finish = (code, err) => {
            if (!this._authService) {
                // cancelAuth() already tore this down; don't call back twice.
                return;
            }
            if (this._authTimeoutId) {
                GLib.source_remove(this._authTimeoutId);
                this._authTimeoutId = 0;
            }
            service.stop();
            service.close();
            this._authService = null;
            cb(code, err);
        };

        this._authTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 120, () => {
            this._authTimeoutId = 0;
            finish(null, "timeout");
            return GLib.SOURCE_REMOVE;
        });

        service.connect('incoming', (srv, connection) => {
            this._handleCallbackConnection(connection, finish);
            return true;
        });

        service.start();
        this._authService = service;
    }

    _handleCallbackConnection(connection, done) {
        let input = new Gio.DataInputStream({ base_stream: connection.get_input_stream() });
        input.read_line_async(GLib.PRIORITY_DEFAULT, null, (stream, res) => {
            let line = null;
            try {
                [line] = stream.read_line_finish_utf8(res);
            } catch (e) {
                // ignore, handled below as bad-request
            }

            this._respondToCallback(connection);

            if (!line) {
                done(null, "empty-request");
                return;
            }
            let match = line.match(/^GET\s+\/callback\?(\S*)\s+HTTP/);
            if (!match) {
                done(null, "bad-request");
                return;
            }

            let code = null, error = null;
            for (let pair of match[1].split('&')) {
                let [k, v] = pair.split('=');
                if (k === 'code') code = decodeURIComponent(v || '');
                else if (k === 'error') error = decodeURIComponent(v || '');
            }

            if (error) {
                done(null, error);
            } else if (code) {
                done(code, null);
            } else {
                done(null, "no-code");
            }
        });
    }

    _respondToCallback(connection) {
        try {
            let bodyBytes = ByteArray.fromString(CALLBACK_PAGE);
            let header = `HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n` +
                `Content-Length: ${bodyBytes.length}\r\nConnection: close\r\n\r\n`;
            let headerBytes = ByteArray.fromString(header);
            let full = new Uint8Array(headerBytes.length + bodyBytes.length);
            full.set(headerBytes, 0);
            full.set(bodyBytes, headerBytes.length);
            connection.get_output_stream().write_all(full, null);
        } catch (e) {
            // best effort only, the browser tab staying open is harmless
        }
        try {
            connection.close(null);
        } catch (e) {
            // ignore
        }
    }

    _exchangeCode(code, verifier, cb) {
        let args = ['curl', '-s', '-X', 'POST', TOKEN_URL,
            '--data-urlencode', 'grant_type=authorization_code',
            '--data-urlencode', `code=${code}`,
            '--data-urlencode', `redirect_uri=${REDIRECT_URI}`,
            '--data-urlencode', `client_id=${this.clientId}`,
            '--data-urlencode', `code_verifier=${verifier}`];

        this._runCommand(args, (ok, text) => {
            let json = ok ? this._parseJson(text) : null;
            if (!json || json.error) {
                cb(false, (json && (json.error_description || json.error)) || "network-error");
                return;
            }
            let now = GLib.get_monotonic_time() / 1000000;
            this._accessToken = json.access_token;
            this._accessTokenExpiry = now + (json.expires_in || 3600) - 30;
            this.refreshToken = json.refresh_token || "";
            cb(true, null);
        });
    }

    _runCommand(args, cb) {
        try {
            let proc = Gio.Subprocess.new(args,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    let [, stdout] = p.communicate_utf8_finish(res);
                    cb(p.get_successful(), stdout);
                } catch (e) {
                    cb(false, "");
                }
            });
        } catch (e) {
            cb(false, "");
        }
    }

    _parseJson(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    _randomVerifier(length) {
        let out = "";
        for (let i = 0; i < length; i++)
            out += VERIFIER_CHARSET[Math.floor(Math.random() * VERIFIER_CHARSET.length)];
        return out;
    }

    // PKCE code_challenge = base64url(sha256(verifier)), computed by
    // shelling out to openssl asynchronously (no blocking I/O on the
    // main loop). cb(challenge) with challenge = null on failure.
    _pkceChallenge(verifier, cb) {
        try {
            let proc = Gio.Subprocess.new(['openssl', 'dgst', '-sha256', '-binary'],
                Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE);
            let stdinBytes = new GLib.Bytes(ByteArray.fromString(verifier));
            proc.communicate_async(stdinBytes, null, (p, res) => {
                try {
                    let [, stdout] = p.communicate_finish(res);
                    let b64 = GLib.base64_encode(stdout.get_data());
                    cb(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
                } catch (e) {
                    cb(null);
                }
            });
        } catch (e) {
            cb(null);
        }
    }
}
