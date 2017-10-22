#!/bin/bash
set -e

dir=`/usr/bin/dirname $0`
. ${dir}/recorder.sh

record_screen
execute