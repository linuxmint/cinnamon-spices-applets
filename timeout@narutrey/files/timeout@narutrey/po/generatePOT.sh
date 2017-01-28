#!/bin/sh

COPYRIGHT='NaruTrey'
UUID='timeout@narutrey'
NAME=$UUID
VERSION=1.0
EMAIL='contact@libnaru.so'

OUTPUT_POT="$PWD/$UUID.pot"

SCRIPT_DIR=$PWD
GETTEXT_CLASSIC_ARGUMENTS="--language=JavaScript --from-code=utf-8 --indent --foreign-user --output=$OUTPUT_POT --copyright-holder=$COPYRIGHT --package-name=$NAME --package-version=$VERSION --msgid-bugs-address=$EMAIL"

cd $SCRIPT_DIR/..
xgettext $GETTEXT_CLASSIC_ARGUMENTS *.js 

gettext_json() {
	cd $SCRIPT_DIR/..
	awk -F "\n" -f $SCRIPT_DIR/generatePOT.awk $1 >> /tmp/$1
	cd /tmp
	xgettext $GETTEXT_CLASSIC_ARGUMENTS --join-existing $1
	rm $1
}

gettext_json settings-schema.json
gettext_json metadata.json
