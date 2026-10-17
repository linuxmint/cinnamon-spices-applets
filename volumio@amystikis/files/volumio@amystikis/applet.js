const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const UUID = "volumio@amystikis";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    return translated !== str ? translated : Gettext.gettext(str);
}

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

// ---------- artwork lookup: MusicBrainz + Cover Art Archive (open), iTunes (optional) ----------
const ART_UA = "VolumioRemoteCinnamon/1.0 (https://github.com/amystikis)";

function artNorm(x) {
    return (x || "").toLowerCase().replace(/\(.*?\)|\[.*?\]/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Possible (artist, song) readings of the playing text. Web radio often sends "Artist - Song" as the title.
function artCandidates(artist, title, badArtist) {
    if (!badArtist) return [{ artist: artist, song: title }];
    let parts = title.split(/\s+[-\u2013\u2014]\s+/);
    let out = [];
    if (parts.length < 2) return out;
    let n = parts.length;
    let add = (a, s) => { if (a && s && !out.some(o => o.artist === a && o.song === s)) out.push({ artist: a, song: s }); };
    add(parts[0], parts.slice(1).join(" - "));
    if (n > 2) {
        add(parts[n - 2], parts[n - 1]);
        add(parts.slice(0, n - 1).join(" - "), parts[n - 1]);
    }
    return out.slice(0, 3);
}

// Returns the first cover-art-archive URL (of up to 5 release groups) that really has a front cover.
function artFirstCover(ids, alive, cb) {
    if (!ids.length || !alive()) { cb(""); return; }
    let url = "https://coverartarchive.org/release-group/" + ids[0] + "/front-500";
    Util.spawn_async(["curl", "-s", "-m", "8", "-L", "-r", "0-0", "-A", ART_UA, "-o", "/dev/null", "-w", "%{http_code}", url], (out) => {
        if (!alive()) return;
        if (/^20[06]/.test((out || "").trim())) cb(url); else artFirstCover(ids.slice(1), alive, cb);
    });
}

function artMusicBrainz(cands, alive, cb) {
    let i = 0;
    let next = () => {
        if (!alive()) return;
        if (i >= cands.length) { cb(""); return; }
        let c = cands[i++];
        let q = 'artist:"' + c.artist.replace(/["\\]/g, " ") + '" AND recording:"' + c.song.replace(/["\\]/g, " ") + '"';
        Util.spawn_async(["curl", "-s", "-m", "8", "-A", ART_UA, "-G", "https://musicbrainz.org/ws/2/recording",
                          "--data-urlencode", "query=" + q, "--data-urlencode", "fmt=json", "--data-urlencode", "limit=25"], (out) => {
            if (!alive()) return;
            let groups = [];
            try {
                let nA = artNorm(c.artist), nS = artNorm(c.song);
                for (let r of JSON.parse(out).recordings || []) {
                    if (r.score < 85) continue;
                    let credit = r["artist-credit"] && r["artist-credit"][0];
                    let rt = artNorm(r.title), ra = artNorm(credit && credit.name);
                    if (!rt || !ra) continue;
                    if (!(rt === nS || nS.indexOf(rt + " ") === 0 || rt.indexOf(nS + " ") === 0)) continue;
                    if (nA.indexOf(ra) < 0 && ra.indexOf(nA) < 0) continue;
                    for (let rel of r.releases || []) {
                        let g = rel["release-group"];
                        if (!g) continue;
                        let sec = g["secondary-types"] || [];
                        let rank = (rel.status === "Official" ? 0 : 4) + (sec.length === 0 ? 0 : (sec.length === 1 && sec[0] === "Compilation" ? 1 : 2));
                        groups.push({ id: g.id, rank: rank });
                    }
                }
            } catch (e) {}
            groups.sort((a, b) => a.rank - b.rank);
            let ids = [];
            groups.forEach(g => { if (ids.indexOf(g.id) < 0) ids.push(g.id); });
            artFirstCover(ids.slice(0, 5), alive, (url) => {
                if (url) cb(url);
                else Mainloop.timeout_add(1100, () => { next(); return false; });   // MusicBrainz allows 1 request/second
            });
        });
    };
    next();
}

function artItunes(term, alive, cb) {
    let nterm = " " + artNorm(term) + " ";
    Util.spawn_async(["curl", "-s", "-m", "6", "-G", "--data-urlencode", "term=" + term,
                      "https://itunes.apple.com/search?entity=song&limit=10"], (out) => {
        if (!alive()) return;
        let url = "";
        try {
            // accept a result only if both its song name and its artist appear in the track text
            for (let r of JSON.parse(out).results) {
                let track = artNorm(r.trackName);
                let who = artNorm(String(r.artistName).split(/,|&| feat\.? /i)[0]);
                if (track && who && nterm.indexOf(" " + track + " ") >= 0 && nterm.indexOf(" " + who + " ") >= 0 && r.artworkUrl100) {
                    url = r.artworkUrl100.replace("100x100", "600x600");
                    break;
                }
            }
        } catch (e) {}
        cb(url);
    });
}

class VolumioApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        this.state = {};
        this.volTimer = null;
        this.holdUntil = 0;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("host", "host", () => this.poll());
        this.settings.bind("interval", "interval");
        this.settings.bind("show-title", "showTitle", () => this.render());
        this.settings.bind("title-width", "titleWidth", () => this.render());
        this.settings.bind("art-source", "artSource", () => { this.lookupTerm = null; this.render(); });
        this.settings.bind("radio-uri", "radioUri", () => { this.browseUri = null; });

        this.set_applet_icon_symbolic_name("audio-x-generic-symbolic");
        this.set_applet_tooltip(_("Volumio"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.cacheDir = GLib.get_user_cache_dir() + "/volumio-applet";
        GLib.mkdir_with_parents(this.cacheDir, 0o755);
        this.artN = 0;
        this.artUrl = "";
        let artRow = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.art = new St.Bin({ width: 180, height: 180, x_align: St.Align.MIDDLE, style: "border-radius: 8px; background-color: rgba(128,128,128,0.15);" });
        this.artIcon = new St.Icon({ icon_name: "audio-x-generic-symbolic", icon_type: St.IconType.SYMBOLIC, icon_size: 64 });
        this.art.set_child(this.artIcon);
        let artBox = new St.BoxLayout({ x_align: St.Align.MIDDLE, x_expand: true });
        artBox.add_actor(this.art);
        artRow.addActor(artBox, { span: -1, expand: true });
        this.menu.addMenuItem(artRow);

        this.titleItem = new PopupMenu.PopupMenuItem(_("Volumio"), { reactive: false });
        this.artistItem = new PopupMenu.PopupMenuItem("", { reactive: false });
        this.menu.addMenuItem(this.titleItem);
        this.menu.addMenuItem(this.artistItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let row = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let box = new St.BoxLayout({ x_align: St.Align.MIDDLE, x_expand: true });
        let btn = (icon, cmd) => {
            let b = new St.Button({ style_class: "button", style: "padding: 6px 14px; margin: 0 3px;", reactive: true, can_focus: true });
            b.set_child(new St.Icon({ icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 20 }));
            b.connect("clicked", () => this.cmd(cmd));
            box.add_actor(b);
            return b;
        };
        btn("media-skip-backward-symbolic", "prev");
        this.playBtn = btn("media-playback-start-symbolic", "toggle");
        btn("media-playback-stop-symbolic", "stop");
        btn("media-skip-forward-symbolic", "next");
        row.addActor(box, { span: -1, expand: true });
        this.menu.addMenuItem(row);

        let vrow = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        let vbox = new St.BoxLayout({ x_align: St.Align.MIDDLE, x_expand: true });
        let vbtn = (icon, cmd) => {
            let b = new St.Button({ style_class: "button", style: "padding: 4px 10px; margin: 0 3px;", reactive: true, can_focus: true });
            b.set_child(new St.Icon({ icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16 }));
            if (cmd) b.connect("clicked", () => this.cmd(cmd));
            vbox.add_actor(b);
            return b;
        };
        vbtn("audio-volume-low-symbolic", "volume&volume=minus");
        this.volLbl = new St.Label({ text: "--%", style: "min-width: 48px; text-align: center;", y_align: St.Align.MIDDLE });
        vbox.add_actor(this.volLbl);
        vbtn("audio-volume-high-symbolic", "volume&volume=plus");
        this.muteBtn = vbtn("audio-volume-medium-symbolic", "");
        this.muteBtn.connect("clicked", () => this.cmd("volume&volume=" + (this.muted ? "unmute" : "mute")));
        vrow.addActor(vbox, { span: -1, expand: true });
        this.menu.addMenuItem(vrow);

        let sRow = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        this.searchEntry = new St.Entry({ hint_text: _("Search songs, artists…"), can_focus: true, x_expand: true });
        this.searchEntry.clutter_text.connect("activate", () => this.search(this.searchEntry.get_text()));
        sRow.addActor(this.searchEntry, { span: -1, expand: true });
        this.menu.addMenuItem(sRow);
        this.searchMenu = new PopupMenu.PopupSubMenuMenuItem(_("Search results"));
        this.searchMenu.actor.hide();
        this.menu.addMenuItem(this.searchMenu);

        this.radioMenu = new PopupMenu.PopupSubMenuMenuItem(_("Radio stations"));
        this.radioMenu.menu.connect("open-state-changed", (m, open) => { if (open) this.loadRadios(this.browseUri || this.radioUri); });
        this.menu.addMenuItem(this.radioMenu);

        this.volSlider = new PopupMenu.PopupSliderMenuItem(0);
        this.volSlider.connect("value-changed", (s, v) => this.setVolume(Math.round(v * 100)));
        this.menu.addMenuItem(this.volSlider);

        this.actor.connect("scroll-event", (a, ev) => {
            let dir = ev.get_scroll_direction();
            this.cmd("volume&volume=" + (dir === 0 ? "plus" : "minus"));
            return true;
        });

        this.poll();
    }

    url(path) { return "http://" + this.host + path; }

    cmd(c) {
        Util.spawn_async(["curl", "-s", "-m", "3", this.url("/api/v1/commands/?cmd=" + c)], () => {
            Mainloop.timeout_add(250, () => { this.poll(true); return false; });
        });
    }

    setVolume(v) {
        this.volLbl.set_text(v + "%");
        this.holdUntil = Date.now() + 1500;
        if (this.volTimer) Mainloop.source_remove(this.volTimer);
        this.volTimer = Mainloop.timeout_add(150, () => {
            this.volTimer = null;
            Util.spawn_async(["curl", "-s", "-m", "3", this.url("/api/v1/commands/?cmd=volume&volume=" + v)], () => {});
            return false;
        });
    }

    loadRadios(uri) {
        this.browseUri = uri;
        Util.spawn_async(["curl", "-s", "-m", "5", this.url("/api/v1/browse?uri=" + encodeURIComponent(uri).replace(/%2F/g, "/"))], (out) => {
            let items = [];
            try {
                let lists = JSON.parse(out).navigation.lists || [];
                lists.forEach(l => (l.items || []).forEach(i => items.push(i)));
            } catch (e) {}
            this.radioMenu.menu.removeAll();
            if (uri !== this.radioUri) {
                let back = new PopupMenu.PopupMenuItem(_("← Back"));
                back.connect("activate", () => { this.loadRadios(this.radioUri); this.radioMenu.menu.open(false); });
                this.radioMenu.menu.addMenuItem(back);
            }
            if (!items.length) {
                this.radioMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No stations found"), { reactive: false }));
                return;
            }
            items.forEach(i => {
                let isStation = i.type === "webradio" || i.service === "webradio";
                let mi = new PopupMenu.PopupMenuItem((isStation ? "" : "📁 ") + (i.title || i.uri));
                if (isStation && this.state && this.state.uri === i.uri) mi.setShowDot(true);
                mi.connect("activate", () => {
                    if (isStation) this.playRadio(i);
                    else { this.loadRadios(i.uri); Mainloop.idle_add(() => { this.radioMenu.menu.open(false); return false; }); }
                });
                this.radioMenu.menu.addMenuItem(mi);
            });
        });
    }

    search(q) {
        q = (q || "").trim();
        if (!q) return;
        this.searchMenu.menu.removeAll();
        this.searchMenu.actor.show();
        this.searchMenu.label.set_text(_("Searching…"));
        Util.spawn_async(["curl", "-s", "-m", "10", "-G", "--data-urlencode", "query=" + q, this.url("/api/v1/search")], (out) => {
            let items = [];
            try {
                let lists = JSON.parse(out).navigation.lists || [];
                lists.forEach(l => (l.items || []).forEach(i => {
                    if ((i.type === "song" || i.type === "webradio") && i.uri) items.push(i);
                }));
            } catch (e) {}
            this.searchMenu.label.set_text(_("Search results") + " (" + items.length + ")");
            if (!items.length) {
                this.searchMenu.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Nothing found"), { reactive: false }));
            }
            items.slice(0, 25).forEach(i => {
                let mi = new PopupMenu.PopupMenuItem(i.title + (i.artist ? " — " + i.artist : ""));
                mi.connect("activate", () => this.playItem(i));
                this.searchMenu.menu.addMenuItem(mi);
            });
            this.searchMenu.menu.open(false);
        });
    }

    playItem(i) {
        let body = JSON.stringify({ service: i.service, type: i.type, title: i.title, artist: i.artist, album: i.album, uri: i.uri, albumart: i.albumart });
        Util.spawn_async(["curl", "-s", "-m", "5", "-X", "POST", "-H", "Content-Type: application/json", "-d", body, this.url("/api/v1/replaceAndPlay")], () => {
            Mainloop.timeout_add(800, () => { this.poll(true); return false; });
        });
    }

    resolveArt(s) {
        let a = s.albumart || "";
        let real = a && a !== "/albumart" && !(s.service === "webradio" && a.indexOf("/albumart") === 0);
        if (real) { this.lookupTerm = null; this.updateArt(a); return; }
        let title = (s.title || "").trim();
        let artist = (s.artist || "").trim();
        let badArtist = !artist || /^(no ?name|net ?cast|unknown|null|undefined|n\/a)$/i.test(artist);
        // Volumio builds its own cover from the artist; for "no name" that is a wrong picture, so never use it.
        let fallback = badArtist ? "" : a;
        if (!title || s.status === "stop") { this.lookupTerm = null; this.updateArt(fallback); return; }
        let term = badArtist ? title : artist + " " + title;
        if (term === this.lookupTerm) return;
        this.lookupTerm = term;
        let src = this.artSource || "mb-itunes";
        let sources = src === "off" ? [] : src === "mb" ? ["mb"] : src === "itunes" ? ["itunes"] : ["mb", "itunes"];
        let alive = () => !this.destroyed && term === this.lookupTerm;
        let cands = artCandidates(artist, title, badArtist);
        let run = (k) => {
            if (!alive()) return;
            if (k >= sources.length) { this.updateArt(fallback); return; }
            let done = (url) => { if (!alive()) return; if (url) this.updateArt(url); else run(k + 1); };
            if (sources[k] === "mb") artMusicBrainz(cands, alive, done); else artItunes(term, alive, done);
        };
        run(0);
    }

    updateArt(path) {
        let url = !path ? "" : (path.indexOf("http") === 0 ? path : this.url(path));
        if (url === this.artUrl) return;
        this.artUrl = url;
        if (!url) {
            this.art.set_child(this.artIcon);
            this.art.set_style("border-radius: 8px; background-color: rgba(128,128,128,0.15);");
            return;
        }
        let file = this.cacheDir + "/art-" + Date.now() + "-" + (++this.artN);
        Util.spawn_async(["curl", "-s", "-m", "8", "-L", "-o", file, url], () => {
            if (this.destroyed || url !== this.artUrl) return;
            this.art.set_child(null);
            this.art.set_style("border-radius: 8px; background-image: url('" + file + "'); background-size: cover;");
            this.artFiles = (this.artFiles || []).concat(file);
            while (this.artFiles.length > 2) {
                try { Gio.File.new_for_path(this.artFiles.shift()).delete(null); } catch (e) {}
            }
        });
    }

    playRadio(item) {
        let body = JSON.stringify({ service: item.service || "webradio", type: "webradio", title: item.title, uri: item.uri, albumart: item.albumart });
        Util.spawn_async(["curl", "-s", "-m", "5", "-X", "POST", "-H", "Content-Type: application/json", "-d", body, this.url("/api/v1/replaceAndPlay")], () => {
            Mainloop.timeout_add(800, () => { this.poll(true); return false; });
        });
    }

    poll(once) {
        if (this.destroyed) return;
        if (this.pollTimer && !once) { Mainloop.source_remove(this.pollTimer); this.pollTimer = null; }
        Util.spawn_async(["curl", "-s", "-m", "3", this.url("/api/v1/getState")], (out) => {
            try { this.state = JSON.parse(out); } catch (e) { this.state = null; }
            this.render();
        });
        if (!once) {
            this.pollTimer = Mainloop.timeout_add_seconds(this.interval, () => { this.pollTimer = null; this.poll(); return false; });
        }
    }

    render() {
        let s = this.state;
        if (!s) {
            this.set_applet_icon_symbolic_name("network-offline-symbolic");
            this.set_applet_label("");
            this.set_applet_tooltip(_("Volumio unreachable") + " (" + this.host + ")");
            this.titleItem.label.set_text(_("Volumio unreachable"));
            this.artistItem.label.set_text(this.host);
            return;
        }
        let playing = s.status === "play";
        this.set_applet_icon_symbolic_name(playing ? "media-playback-start-symbolic" : "media-playback-pause-symbolic");
        this.playBtn.get_child().icon_name = playing ? "media-playback-pause-symbolic" : "media-playback-start-symbolic";
        let title = s.title || "";
        let label = "";
        if (this.showTitle && title) {
            label = title.length > this.titleWidth ? title.substring(0, this.titleWidth - 1) + "…" : title;
        }
        this.set_applet_label(label);
        this.set_applet_tooltip((title || _("Nothing playing")) + (s.artist ? "\n" + s.artist : ""));
        this.titleItem.label.set_text(title || _("Nothing playing"));
        this.artistItem.label.set_text([s.artist, s.album].filter(x => x).join(" — "));
        if (Date.now() > this.holdUntil && typeof s.volume === "number") {
            this.volSlider.setValue(s.volume / 100);
            this.volLbl.set_text(s.volume + "%");
        }
        this.resolveArt(s);
        this.muted = !!s.mute;
        this.muteBtn.get_child().icon_name = this.muted ? "audio-volume-muted-symbolic" : "audio-volume-medium-symbolic";
    }

    on_applet_clicked() { this.menu.toggle(); }

    on_applet_middle_clicked() { this.cmd("toggle"); }

    on_applet_removed_from_panel() {
        this.destroyed = true;
        if (this.pollTimer) Mainloop.source_remove(this.pollTimer);
        if (this.volTimer) Mainloop.source_remove(this.volTimer);
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new VolumioApplet(metadata, orientation, panelHeight, instanceId);
}
