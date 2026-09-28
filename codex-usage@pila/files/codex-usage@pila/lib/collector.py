#!/usr/bin/env python3
"""Read-only, incremental Codex statistical collector. No conversation data is cached."""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import selectors
import sqlite3
import subprocess
import time

FIELDS = ('input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens')
# Codex writes the discriminant before payload. Unknown/reordered formats are ignored,
# rather than decoding messages/tool results containing private conversation content.
TYPE = re.compile(rb'^\s*\{\s*"timestamp"\s*:\s*"[^"\r\n]+"\s*,\s*(?:"ordinal"\s*:\s*\d+\s*,\s*)?"type"\s*:\s*"(session_meta|turn_context|token_usage_record|event_msg)"\s*,\s*"payload"\s*:')
TOKEN = re.compile(rb'^\s*\{\s*"type"\s*:\s*"token_count"\s*[,}]')
MAX_LINE = 16 * 1024 * 1024
MAX_RPC_BUFFER = 1024 * 1024
RPC_TIMEOUT = 4

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()

def number(value):
    return value if type(value) in (int, float) and math.isfinite(value) and value >= 0 else None

def usage(value):
    if not isinstance(value, dict):
        return None
    if any(number(value.get(k)) is None for k in ('input_tokens', 'output_tokens', 'total_tokens')):
        return None
    return {k: int(number(value.get(k)) or 0) for k in FIELDS}

def timestamp(value):
    try:
        return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError, OverflowError):
        return None

def safe_label(value):
    return value if isinstance(value, str) and re.fullmatch(r'[a-zA-Z0-9_.:+-]{1,80}', value) else None

def limits(value, observed):
    if not isinstance(value, dict) or value.get('limit_id', 'codex') not in ('codex', None):
        return None
    result = {'observed_at': observed}
    for key, minutes in (('primary', 300), ('secondary', 10080)):
        item = value.get(key)
        if not isinstance(item, dict):
            continue
        percent, reset = number(item.get('used_percent')), number(item.get('resets_at'))
        if percent is not None and percent <= 100 and reset is not None and item.get('window_minutes') == minutes:
            result[key] = {'used_percent': percent, 'resets_at': reset, 'window_minutes': minutes}
    return result if len(result) > 1 else None

def live_limits(response, observed):
    if not isinstance(response, dict) or response.get('id') != 2 or 'error' in response:
        return None
    result = response.get('result')
    value = result.get('rateLimits') if isinstance(result, dict) else None
    if not isinstance(value, dict) or value.get('limitId', 'codex') not in ('codex', None):
        return None
    parsed = {'observed_at': observed}
    for key, minutes in (('primary', 300), ('secondary', 10080)):
        item = value.get(key)
        if not isinstance(item, dict):
            continue
        percent = number(item.get('usedPercent'))
        reset = number(item.get('resetsAt'))
        if percent is not None and percent <= 100 and reset is not None and item.get('windowDurationMins') == minutes:
            parsed[key] = {'used_percent': percent, 'resets_at': reset, 'window_minutes': minutes}
    return parsed if len(parsed) > 1 else None

def rpc_response(process, request_id, deadline, pending=b''):
    selector = selectors.DefaultSelector()
    try:
        selector.register(process.stdout, selectors.EVENT_READ)
        while time.monotonic() < deadline:
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                try:
                    message = json.loads(line)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                if isinstance(message, dict) and message.get('id') == request_id:
                    return message, pending
            if len(pending) > MAX_RPC_BUFFER:
                return None, b''
            ready = selector.select(max(0, deadline - time.monotonic()))
            if not ready:
                break
            chunk = os.read(process.stdout.fileno(), 65536)
            if not chunk:
                break
            pending += chunk
    except (OSError, ValueError):
        pass
    finally:
        selector.close()
    return None, b''

def query_live_limits(timeout=RPC_TIMEOUT):
    process = None
    try:
        process = subprocess.Popen(
            ['codex', 'app-server', '--stdio'], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + timeout
        initialize = {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {
            'clientInfo': {'name': 'codex-usage-applet', 'version': '1.0.0'},
            'capabilities': {'experimentalApi': True},
        }}
        process.stdin.write(json.dumps(initialize).encode() + b'\n')
        process.stdin.flush()
        response, pending = rpc_response(process, 1, deadline)
        if not response or 'error' in response or 'result' not in response:
            return None
        messages = (
            {'jsonrpc': '2.0', 'method': 'initialized', 'params': {}},
            {'jsonrpc': '2.0', 'id': 2, 'method': 'account/rateLimits/read', 'params': {'excludeResetCreditDetails': True}},
        )
        process.stdin.write(b''.join(json.dumps(message).encode() + b'\n' for message in messages))
        process.stdin.flush()
        response, _ = rpc_response(process, 2, deadline, pending)
        return live_limits(response, time.time())
    except (OSError, ValueError, TypeError, subprocess.SubprocessError):
        return None
    finally:
        if process is not None:
            try:
                process.stdin.close()
            except (OSError, AttributeError):
                pass
            if process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=0.5)
                except (OSError, subprocess.TimeoutExpired):
                    try:
                        process.kill()
                        process.wait(timeout=0.5)
                    except (OSError, subprocess.TimeoutExpired):
                        pass

def refresh_live_limits(collector, fetch=query_live_limits):
    try:
        value = fetch()
        if not value:
            return False
        collector.observation('limits', value['observed_at'], value)
        collector.db.commit()
        return True
    except (KeyError, TypeError, ValueError, OSError, sqlite3.Error):
        return False

class Collector:
    def __init__(self, home, cache):
        self.home = Path(home)
        cache = Path(cache)
        cache.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(cache, 0o700)
        self.db = sqlite3.connect(cache / 'usage.sqlite3', timeout=5)
        os.chmod(cache / 'usage.sqlite3', 0o600)
        self.db.executescript('''
          CREATE TABLE IF NOT EXISTS files (key TEXT PRIMARY KEY, inode TEXT, size INTEGER, mtime INTEGER, offset INTEGER, state TEXT);
          CREATE TABLE IF NOT EXISTS events (key TEXT PRIMARY KEY, session TEXT, stamp REAL, source TEXT, data TEXT);
          CREATE INDEX IF NOT EXISTS events_stamp ON events(stamp);
          CREATE TABLE IF NOT EXISTS observations (key TEXT PRIMARY KEY, stamp REAL, data TEXT);
          CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT);
        ''')
        namespace = digest(str(self.home.resolve()))
        old = self.db.execute("SELECT value FROM metadata WHERE key='home'").fetchone()
        if old and old[0] != namespace:
            raise ValueError('cache belongs to another data source')
        self.db.execute("INSERT OR IGNORE INTO metadata VALUES ('home', ?)", (namespace,))
        self.warnings = 0
        self.bytes_read = 0

    def observation(self, key, stamp, data):
        self.db.execute('INSERT INTO observations VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET stamp=excluded.stamp,data=excluded.data WHERE excluded.stamp >= observations.stamp', (key, stamp, json.dumps(data)))

    def record(self, data, state, file_key):
        typ, payload = data.get('type'), data.get('payload')
        stamp = timestamp(data.get('timestamp'))
        if not isinstance(payload, dict) or stamp is None:
            return
        if typ == 'session_meta':
            identifier = payload.get('id') or payload.get('session_id')
            if isinstance(identifier, str):
                state['session'] = digest(identifier)
            return
        session = state.get('session', file_key)
        if typ == 'turn_context':
            model, effort = safe_label(payload.get('model')), safe_label(payload.get('effort') or payload.get('reasoning_effort'))
            if effort not in ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'):
                effort = None
            if model or effort:
                self.observation('context', stamp, {'model': model, 'effort': effort})
        elif typ in ('token_usage_record', 'event_msg'):
            record = typ == 'token_usage_record'
            if not record and payload.get('type') != 'token_count':
                return
            if not record:
                limit = limits(payload.get('rate_limits'), stamp)
                if limit:
                    self.observation('limits', stamp, limit)
            info = payload.get('info')
            counts = usage(payload.get('thread_token_usage')) if record else usage(info.get('total_token_usage')) if isinstance(info, dict) else None
            previous = state.get('total', {k: 0 for k in FIELDS})
            rid = payload.get('response_id') if record else None
            thread = payload.get('thread_id') if record else None
            if isinstance(thread, str):
                session = digest(thread)
            if counts is not None:
                reset = counts['total_tokens'] < previous['total_tokens']
                delta = {k: max(0, counts[k] - (0 if reset else previous[k])) for k in FIELDS}
                state['total'] = counts
            elif record and isinstance(rid, str):
                delta = usage(payload.get('usage'))
                if delta is None:
                    return
                # Without cumulative counters, a response ID is mandatory. Keep
                # the shared baseline in sync for a subsequent token snapshot.
                state['total'] = {k: previous[k] + delta[k] for k in FIELDS}
            else:
                return
            if delta['total_tokens']:
                key = digest('response:' + rid) if isinstance(rid, str) and rid else digest('snapshot:' + str(stamp) + ':' + json.dumps(counts, sort_keys=True))
                self.db.execute('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?)', (key, session, stamp, 'record' if record else 'snapshot', json.dumps(delta)))

    def scan(self):
        # Directory/stat scan only: unchanged historical files are never reopened.
        for folder in ('sessions', 'archived_sessions'):
            root = self.home / folder
            if not root.exists():
                continue
            for path in root.rglob('*.jsonl'):
                try:
                    self.process(path)
                except (OSError, ValueError, OverflowError):
                    self.warnings += 1
        self.db.commit()

    def process(self, path):
        stat = path.stat()
        key, inode = digest(str(path.relative_to(self.home))), str(stat.st_dev) + ':' + str(stat.st_ino)
        row = self.db.execute('SELECT inode,size,mtime,offset,state FROM files WHERE key=?', (key,)).fetchone()
        if row and row[:3] == (inode, stat.st_size, stat.st_mtime_ns):
            return
        offset, state = (row[3], json.loads(row[4])) if row and row[0] == inode and stat.st_size >= row[1] else (0, {})
        # Same-size edits or truncation/replacement require replay; event IDs dedupe.
        if row and stat.st_size == row[1] and stat.st_mtime_ns != row[2]:
            offset, state = 0, {}
        with path.open('rb') as stream:
            stream.seek(offset)
            while True:
                start = stream.tell()
                line = stream.readline(MAX_LINE + 1)
                self.bytes_read += len(line)
                if not line:
                    break
                if len(line) > MAX_LINE:
                    # Drain oversized records without constructing a huge object.
                    while line and not line.endswith(b'\n'):
                        line = stream.readline(MAX_LINE + 1)
                        self.bytes_read += len(line)
                    if not line.endswith(b'\n'):
                        stream.seek(start)
                        break
                    self.warnings += 1
                    continue
                if not line.endswith(b'\n'):
                    stream.seek(start)
                    break
                match = TYPE.match(line)
                if not match:
                    continue
                if match.group(1) == b'event_msg' and not TOKEN.match(line[match.end():]):
                    continue
                try:
                    self.record(json.loads(line), state, key)
                except (ValueError, TypeError, AttributeError, OverflowError):
                    self.warnings += 1
            offset = stream.tell()
        self.db.execute('INSERT OR REPLACE INTO files VALUES (?,?,?,?,?,?)', (key, inode, stat.st_size, stat.st_mtime_ns, offset, json.dumps(state)))

    def result(self, now=None, stale_seconds=300):
        now = time.time() if now is None else now
        today = dt.datetime.fromtimestamp(now).date()
        boundaries = {'today': today, 'week': today - dt.timedelta(days=today.weekday()), 'month': today.replace(day=1)}
        output = {'schema_version': 1, 'updated_at': now, 'available': self.home.is_dir(), 'warnings': self.warnings, 'bytes_read': self.bytes_read}
        for name, date in boundaries.items():
            start = dt.datetime.combine(date, dt.time()).timestamp()
            totals, sessions = {k: 0 for k in FIELDS}, set()
            rows = self.db.execute('SELECT session,data FROM events WHERE stamp >= ? AND stamp <= ?', (start, now))
            for session, raw in rows:
                counts = json.loads(raw)
                for k in FIELDS:
                    totals[k] += counts[k]
                sessions.add(session)
            totals['sessions'] = len(sessions)
            totals['cache_percent'] = 100 * totals['cached_input_tokens'] / totals['input_tokens'] if totals['input_tokens'] else None
            output[name] = totals
        for key in ('limits', 'context'):
            row = self.db.execute('SELECT stamp,data FROM observations WHERE key=?', (key,)).fetchone()
            output[key] = json.loads(row[1]) if row else None
            if row:
                output[key]['observed_at'] = row[0]
        if output['limits']:
            for key in ('primary', 'secondary'):
                item = output['limits'].get(key)
                if item:
                    item['stale'] = not self.home.is_dir() or now - output['limits']['observed_at'] > stale_seconds or now >= item['resets_at'] or output['limits']['observed_at'] > now + 60
        return output

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex-home', type=Path, default=Path.home() / '.codex')
    parser.add_argument('--cache-dir', type=Path, default=Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'codex-usage@pila')
    parser.add_argument('--stale-seconds', type=int, default=300)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        collector = Collector(args.codex_home, args.cache_dir)
        collector.scan()
        refresh_live_limits(collector)
        print(json.dumps(collector.result(stale_seconds=max(60, args.stale_seconds))))
        collector.db.close()
    except (OSError, sqlite3.Error, ValueError):
        # Never print exception details: paths or corrupt source contents may leak.
        print(json.dumps({'schema_version': 1, 'error': 'Usage collector unavailable; check cache permissions.'}))
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
