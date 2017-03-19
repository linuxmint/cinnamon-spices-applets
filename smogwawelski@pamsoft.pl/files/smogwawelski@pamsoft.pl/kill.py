#!/usr/bin/env python

import os

os.system("ps aux | grep krakowsmog@pamsoft.pl | awk '{print $2}' | xargs kill -9")