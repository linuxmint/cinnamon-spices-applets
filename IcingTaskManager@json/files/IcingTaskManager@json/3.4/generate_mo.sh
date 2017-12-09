#!/bin/bash

langs=( bg da de es fr he hr pl ru sv tr zh_CN )

for l in "${langs[@]}"
do
  msgfmt -cv -o $HOME/.local/share/locale/$l/LC_MESSAGES/IcingTaskManager@json.mo $HOME/.local/share/cinnamon/applets/IcingTaskManager@json/po/$l.po
done