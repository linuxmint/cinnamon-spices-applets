import subprocess

try:
    print subprocess.check_output(['/usr/bin/lpstat', '-a'])
except subprocess.CalledProcessError, e:
    print ""

