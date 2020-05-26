#!/bin/bash
set -e

dir=`dirname $0`
. ${dir}/recorder.sh

record_audio
record_screen
execute