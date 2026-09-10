#!/usr/bin/python3
# Zen Pomodoro: one-time setup for passwordless distraction blocking.
#
# Run as root (the applet invokes it via a single pkexec prompt). It installs a
# ROOT-OWNED copy of the hosts helper at a fixed path and a small polkit action
# so that later block/unblock calls do not prompt every time. Granting this only
# to a root-owned, tightly-scoped helper (it edits ONLY its own marked section of
# /etc/hosts and validates hostnames) is why the helper is copied out of the
# user-writable applet directory first.
#
#   setup-passwordless.py install {keep|yes} <source-helper-path>
#   setup-passwordless.py uninstall
#
# keep -> auth_admin_keep (authenticate once per login session)
# yes  -> no password prompt at all
import os
import sys
import shutil

DEST = "/usr/local/sbin/zen-pomodoro-hosts-helper"
POLICY = "/usr/share/polkit-1/actions/org.cinnamon.zenpomodoro.hosts.policy"
ACTION_ID = "org.cinnamon.zenpomodoro.hosts"

POLICY_TMPL = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE policyconfig PUBLIC "-//freedesktop//DTD PolicyKit Policy Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/PolicyKit/1.0/policyconfig.dtd">
<policyconfig>
  <action id="%(action)s">
    <description>Update Zen Pomodoro distraction blocking</description>
    <message>Authentication is required to update Zen Pomodoro site blocking</message>
    <defaults>
      <allow_any>auth_admin</allow_any>
      <allow_inactive>auth_admin</allow_inactive>
      <allow_active>%(mode)s</allow_active>
    </defaults>
    <annotate key="org.freedesktop.policykit.exec.path">%(dest)s</annotate>
    <annotate key="org.freedesktop.policykit.exec.allow_gui">true</annotate>
  </action>
</policyconfig>
"""


def install(mode, src):
    if mode not in ("keep", "yes"):
        sys.stderr.write("bad mode\n")
        return 2
    if not src or not os.path.isfile(src):
        sys.stderr.write("source helper not found\n")
        return 2
    allow = "yes" if mode == "yes" else "auth_admin_keep"
    # Copy the helper to a root-owned location (not user-writable).
    tmp = DEST + ".tmp"
    shutil.copyfile(src, tmp)
    os.chmod(tmp, 0o755)
    os.chown(tmp, 0, 0)
    os.replace(tmp, DEST)
    # Install the polkit action that grants the chosen auth to that exact path.
    os.makedirs(os.path.dirname(POLICY), exist_ok=True)
    with open(POLICY, "w", encoding="utf-8") as f:
        f.write(POLICY_TMPL % {"action": ACTION_ID, "mode": allow, "dest": DEST})
    os.chmod(POLICY, 0o644)
    return 0


def uninstall():
    for path in (POLICY, DEST):
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as exc:
            sys.stderr.write("%s\n" % exc)
    return 0


def main():
    if os.geteuid() != 0:
        sys.stderr.write("setup-passwordless must run as root\n")
        return 2
    if len(sys.argv) < 2:
        return 2
    cmd = sys.argv[1]
    if cmd == "install":
        if len(sys.argv) < 4:
            return 2
        return install(sys.argv[2], sys.argv[3])
    if cmd == "uninstall":
        return uninstall()
    return 2


if __name__ == "__main__":
    sys.exit(main())
