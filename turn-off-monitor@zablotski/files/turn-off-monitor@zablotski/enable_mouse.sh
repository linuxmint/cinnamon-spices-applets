#!/usr/bin/env bash
xinput enable $(xinput | grep Mouse | tr -d " " | tr "\t" " " | cut -d" " -f2 | cut -d"=" -f2)