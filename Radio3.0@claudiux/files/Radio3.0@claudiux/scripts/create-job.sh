#!/bin/bash
echo $(at -M -f "$1" -t "$2" 2>&1 | tail -1 | cut -f2 -d" ")
exit 0
