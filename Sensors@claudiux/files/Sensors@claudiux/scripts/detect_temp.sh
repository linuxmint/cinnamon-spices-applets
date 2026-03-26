#!/usr/bin/env bash
OF="sensors_detected.json"
echo "{" > $OF
LHWMON=( $(ls -1 /sys/class/hwmon) )
HMAX=${#LHWMON[@]}
HCPT=0
#LSENSORS=( )
for f in ${LHWMON[@]}; do {
        if [ -f /sys/class/hwmon/$f/name ]; then {
                HCPT=$((HCPT + 1))
                NAME=$(cat /sys/class/hwmon/$f/name)
                echo '  "'$NAME'": {' >> $OF
                LTINPUT=$(ls -1 /sys/class/hwmon/$f/temp*_input)
                LNUMS=( )
                for f_input in $LTINPUT; do {
                        NUM=$(echo -n $(basename $f_input) | sed 's/[^0-9]//g')
                        if [ $(echo -n $(cat $f_input)) != "0" ]; then {
                                LNUMS=( "${LNUMS[@]}" "$NUM" )
                        }; fi
                }; done
                NCPT=0
                NMAX=${#LNUMS[@]}
                for num in ${LNUMS[@]}; do {
                        temp="temp${num}"
                        echo '    "'${temp}'": {' >> $OF
                        NCPT=$((NCPT + 1))
                        echo '      "path": "/sys/class/hwmon/'$f'",' >> $OF;
                        echo '      "input": '$(cat /sys/class/hwmon/$f/${temp}_input)',' >> $OF;
                        if [ -f /sys/class/hwmon/$f/${temp}_crit ]; then {
                                echo '      "crit": '$(cat /sys/class/hwmon/$f/${temp}_crit)',' >> $OF;
                        }; fi

                        if [ -f /sys/class/hwmon/$f/${temp}_max ]; then {
                                echo '      "max": '$(cat /sys/class/hwmon/$f/${temp}_max)',' >> $OF;
                        }; fi

                        if [ -f /sys/class/hwmon/$f/${temp}_type ]; then {
                                echo '      "type": '$(cat /sys/class/hwmon/$f/${temp}_type)',' >> $OF;
                        }; fi

                        if [ -f /sys/class/hwmon/$f/${temp}_label ]; then {
                                echo '      "label": "'$(cat /sys/class/hwmon/$f/${temp}_label)'"' >> $OF;
                        }; else {
                                echo '      "label": ""' >> $OF;
                        }; fi
                        if [ "$NCPT" != "$NMAX" ]; then {
                                echo '    },' >> $OF
                        }; else {
                                echo '    }' >> $OF
                        }; fi
                }; done
                if [ "$HCPT" != "$HMAX" ]; then {
                        echo '  },' >> $OF
                }; else {
                        echo '  }' >> $OF
                }; fi

        }; else HMAX=$((HMAX - 1));
        fi
}
done
echo '}' >> $OF
exit 0
