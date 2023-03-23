#!/bin/bash
set -e

dir="${0%/*}"
. "${dir:-.}/recorder.sh"

record_audio
record_window
execute
