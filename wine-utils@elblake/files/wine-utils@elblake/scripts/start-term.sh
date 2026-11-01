#!/bin/sh

folder=$1; shift
terminal=$1; shift

cd "${folder}" && exec "${terminal}" "$@"
