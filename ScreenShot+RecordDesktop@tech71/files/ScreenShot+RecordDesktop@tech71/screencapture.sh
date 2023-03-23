#!/bin/bash
set -e

dir="${0%/*}"
. "${dir:-.}/recorder.sh"

record_screen
execute
