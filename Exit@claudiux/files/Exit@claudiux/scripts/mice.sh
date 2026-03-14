#!/usr/bin/env bash

setto=$1

for m in $(xinput | grep -i Mouse | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2); do {
        xinput $setto $m
}; done

exit 0
