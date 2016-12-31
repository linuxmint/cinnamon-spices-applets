#!/bin/sh

UUID="shutdown-timer@webum.by"
SCHEMA_DIR="/usr/share/glib-2.0/schemas/"
SCHEMA="org.cinnamon.applets.${UUID}.gschema.xml"
INSTALL_DIR="${HOME}/.local/share/cinnamon/applets/${UUID}"

	cat << EOF

	Creating applet settings...
EOF
	
	sudo cp -f ${SCHEMA} ${SCHEMA_DIR} &&
			glib-compile-schemas --dry-run ${SCHEMA_DIR} &&
		sudo glib-compile-schemas ${SCHEMA_DIR}
	
	cat << EOF

	Installing applet in ${INSTALL_DIR}...
EOF
	mkdir -p ${INSTALL_DIR}

	cp -f metadata.json applet.js  ${INSTALL_DIR}	

