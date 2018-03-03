#!/bin/bash
lsof -p $PPID | grep -m 1 NetworkManager 2>&1 1>/dev/null
