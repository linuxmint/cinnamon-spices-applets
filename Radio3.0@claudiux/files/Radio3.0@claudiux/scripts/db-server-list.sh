#!/bin/bash
echo -n $(host -t SRV _api._tcp.radio-browser.info | awk '{print $8}' | sed -e "s/\.$//")
exit 0
