#!/usr/bin/env bash
xinput disable $(xinput | grep Mouse | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2)