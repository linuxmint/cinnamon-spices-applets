#!/bin/bash

langs=( bg de es fr he ru zh_CN )

for l in "${langs[@]}"
do
  msgfmt -cv -o $HOME/.local/share/locale/$l/LC_MESSAGES/IcingTaskManager@json.mo $HOME/.local/share/cinnamon/applets/IcingTaskManager@json/po/$l.po
done