#!/bin/bash
#
# Hotspot Manager core. Wraps NetworkManager (nmcli) to run a Wi-Fi hotspot,
# the same command you type by hand:
#   nmcli device wifi hotspot ifname wlp2s0 ssid NAME password PASS
# Usage: hotspot-manager.sh <status|start|stop|restart|ifaces|show-password|
#                            set-ssid NAME|set-password PASS|generate-password|set-iface NAME>
set -uo pipefail
exec </dev/null

CONFIG_DIR="$HOME/.config/hotspot-manager"
CONFIG="$CONFIG_DIR/config.json"
STATE="$CONFIG_DIR/state.json"
CON_NAME="Hotspot"
LEASE_DIR="${HM_LEASE_DIR:-/var/lib/NetworkManager}"

fail() { jq -nc --arg e "$1" '{error: $e}'; exit 1; }

# ------------------------------------------------------------- config

cfg() { jq -r "$1 // empty" "$CONFIG" 2>/dev/null; }

gen_password() {
    # No look-alike characters (0/O, 1/l/I), so it is easy to read off a screen.
    tr -dc 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789' < /dev/urandom | head -c 12
}

ensure_config() {
    mkdir -p "$CONFIG_DIR"
    chmod 700 "$CONFIG_DIR"
    if [[ ! -f $CONFIG ]]; then
        local host
        host=$(hostname -s 2>/dev/null || echo laptop)
        jq -n --arg s "$host-hotspot" --arg p "$(gen_password)" \
            '{ssid: $s, password: $p, ifname: ""}' > "$CONFIG"
        chmod 600 "$CONFIG"
    fi
}

set_cfg() {
    local tmp="$CONFIG.tmp.$$"
    umask 077
    if jq "$@" "$CONFIG" > "$tmp" && [[ -s $tmp ]] && jq -e . "$tmp" >/dev/null 2>&1; then
        mv -f "$tmp" "$CONFIG"
        chmod 600 "$CONFIG"
        return 0
    fi
    rm -f "$tmp"
    fail "could not save settings"
}

valid_ssid() {
    local s="$1"
    (( ${#s} >= 1 && ${#s} <= 32 )) && [[ $s != *[[:cntrl:]]* ]]
}

valid_password() {
    local p="$1"
    (( ${#p} >= 8 && ${#p} <= 63 )) && [[ $p =~ ^[[:print:]]+$ ]]
}

# ------------------------------------------------------------ system

wifi_iface() {
    local ifc
    ifc=$(cfg '.ifname')
    if [[ -n $ifc ]]; then
        echo "$ifc"
        return
    fi
    nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2 == "wifi" { print $1; exit }'
}

# Read the whole list first. Piping straight into grep -q can end early, and with
# pipefail nmcli's broken pipe then looks like a failure, so a saved connection is missed.
is_active() {
    local list
    list=$(nmcli -t -f NAME connection show --active 2>/dev/null)
    grep -qx "$CON_NAME" <<<"$list"
}

exists() {
    local list
    list=$(nmcli -t -f NAME connection show 2>/dev/null)
    grep -qx "$CON_NAME" <<<"$list"
}

ip_addr() {
    ip -4 -o addr show dev "$1" 2>/dev/null | awk '{ print $4 }' | head -n1 | sed 's|/.*||'
}

# Devices on the hotspot subnet that are not failed. Shape: [{ip, mac, state}]
clients_json() {
    ip neigh show dev "$1" 2>/dev/null |
        awk '{ for (i = 1; i < NF; i++) if ($i == "lladdr") print $1, tolower($(i + 1)), $NF }' |
        awk '$3 != "FAILED"' |
        jq -R -s 'split("\n") | map(select(length > 0) | split(" ") | {ip: .[0], mac: .[1], state: .[2]})'
}

# Device names: NetworkManager's DHCP lease file keeps each device's hostname.
# Shape: {"mac": "name", ...}. A "*" hostname means the device sent no name.
lease_names_json() {
    local f="$LEASE_DIR/dnsmasq-$1.leases"
    [[ -r $f ]] || { echo '{}'; return; }
    awk '$2 != "" && $4 != "" && $4 != "*" { print tolower($2), $4 }' "$f" |
        jq -R -s 'split("\n") | map(select(length > 0) | split(" ") | {(.[0]): .[1]}) | add // {}'
}

# Escapes the characters that have a meaning inside a Wi-Fi QR code.
wifi_escape() {
    sed 's/[\\;,:"]/\\&/g' <<<"$1"
}

# ----------------------------------------------------------- commands

cmd_status() {
    local ifc active=false ip="" clients='[]' names started host
    ifc=$(wifi_iface)
    if is_active; then
        active=true
        if [[ -n $ifc ]]; then
            ip=$(ip_addr "$ifc")
            clients=$(clients_json "$ifc")
            names=$(lease_names_json "$ifc")
            clients=$(jq -c --argjson names "$names" 'map(. + {name: ($names[.mac] // "")})' <<<"$clients")
        fi
    fi
    started=$(jq -r '.startedAt // 0' "$STATE" 2>/dev/null || echo 0)
    host=$(hostname -s 2>/dev/null || echo laptop)
    jq -nc --argjson active "$active" --arg ssid "$(cfg '.ssid')" --arg ifc "$ifc" \
        --arg ip "$ip" --argjson clients "$clients" --argjson started "${started:-0}" \
        --arg host "$host" '{
        active: $active, ssid: $ssid, iface: $ifc, ip: $ip, security: "WPA2", host: $host,
        clients: $clients, clientCount: ($clients | length), startedAt: $started
    }'
}

# A QR code that a phone camera reads to join the hotspot. It contains the password,
# so the file is kept private and only ever written to your own cache folder.
cmd_qr() {
    command -v qrencode >/dev/null 2>&1 || fail "qrencode is not installed: sudo apt install qrencode"
    local ssid pass dir out content
    ssid=$(cfg '.ssid')
    pass=$(cfg '.password')
    [[ -n $ssid && -n $pass ]] || fail "set an SSID and password first"
    dir="$CONFIG_DIR/qr"
    mkdir -p "$dir"
    chmod 700 "$dir"
    out="$dir/join.png"
    content="WIFI:T:WPA;S:$(wifi_escape "$ssid");P:$(wifi_escape "$pass");;"
    rm -f "$out"
    qrencode -s 10 -o "$out" "$content" 2>/dev/null || fail "could not make the QR code"
    chmod 600 "$out"
    jq -nc --arg p "$out" '{path: $p}'
}

cmd_start() {
    local ifc ssid pass out
    ifc=$(wifi_iface)
    [[ -n $ifc ]] || fail "no Wi-Fi adapter found"
    ssid=$(cfg '.ssid')
    pass=$(cfg '.password')
    valid_ssid "$ssid" || fail "SSID must be 1 to 32 characters"
    valid_password "$pass" || fail "password must be 8 to 63 printable characters"

    if exists; then
        out=$(nmcli connection modify "$CON_NAME" 802-11-wireless.ssid "$ssid" wifi-sec.psk "$pass" 2>&1) ||
            fail "$(tail -n1 <<<"$out")"
        out=$(nmcli connection up "$CON_NAME" ifname "$ifc" 2>&1) || fail "$(tail -n1 <<<"$out")"
    else
        out=$(nmcli device wifi hotspot ifname "$ifc" con-name "$CON_NAME" ssid "$ssid" password "$pass" 2>&1) ||
            fail "$(tail -n1 <<<"$out")"
    fi
    # Do not come back by itself after a reboot; you start it when you need it.
    nmcli connection modify "$CON_NAME" connection.autoconnect no >/dev/null 2>&1 || true

    mkdir -p "$CONFIG_DIR"
    jq -nc --argjson t "$(date +%s)" '{startedAt: $t}' > "$STATE"
    cmd_status
}

cmd_stop() {
    nmcli connection down "$CON_NAME" >/dev/null 2>&1 || true
    rm -f "$STATE"
    cmd_status
}

cmd_restart() {
    nmcli connection down "$CON_NAME" >/dev/null 2>&1 || true
    rm -f "$STATE"
    cmd_start
}

cmd_ifaces() {
    nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: '$2 == "wifi" { print $1 }' |
        jq -R -s 'split("\n") | map(select(length > 0))'
}

cmd_set_ssid() {
    valid_ssid "$1" || fail "SSID must be 1 to 32 characters with no control characters"
    set_cfg --arg v "$1" '.ssid = $v'
    if is_active; then cmd_restart; else cmd_status; fi
}

cmd_set_password() {
    valid_password "$1" || fail "password must be 8 to 63 printable characters"
    set_cfg --arg v "$1" '.password = $v'
    if is_active; then cmd_restart; else cmd_status; fi
}

cmd_generate() {
    cmd_set_password "$(gen_password)"
}

cmd_set_iface() {
    local name="$1"
    [[ $name =~ ^[A-Za-z0-9._-]+$ ]] || fail "invalid interface name"
    cmd_ifaces | jq -e --arg n "$name" 'index($n) != null' >/dev/null ||
        fail "no Wi-Fi adapter named $name"
    set_cfg --arg v "$name" '.ifname = $v'
    if is_active; then cmd_restart; else cmd_status; fi
}

# ----------------------------------------------------------------- main

CMD="${1:-status}"
[[ $# -gt 0 ]] && shift
ensure_config

case "$CMD" in
    status)            cmd_status ;;
    start)             cmd_start ;;
    stop)              cmd_stop ;;
    restart)           cmd_restart ;;
    ifaces)            cmd_ifaces ;;
    show-password)     jq -nc --arg p "$(cfg '.password')" '{password: $p}' ;;
    set-ssid)          cmd_set_ssid "${1:-}" ;;
    set-password)      cmd_set_password "${1:-}" ;;
    generate-password) cmd_generate ;;
    set-iface)         cmd_set_iface "${1:-}" ;;
    qr)                cmd_qr ;;
    *)
        echo '{"error":"usage: hotspot-manager.sh <status|start|stop|restart|ifaces|show-password|set-ssid NAME|set-password PASS|generate-password|set-iface NAME|qr>"}'
        exit 2
        ;;
esac
