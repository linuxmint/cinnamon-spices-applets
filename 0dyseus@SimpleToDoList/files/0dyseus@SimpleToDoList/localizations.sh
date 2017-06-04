#!/bin/bash

prompt="Pick an option and press Enter:"
options+=("Install translations" "Uninstall translations" "Restart Cinnamon")


echo "$(tput bold)$(tput setaf 11)"
echo "This script has to be executed from inside this xlet folder and after this xlet is installed."
echo "If you installed this xlet via Cinnamon Settings, translations where already installed automatically by Cinnamon."
echo "If you installed this xlet manually, you need to install the translations."
echo "$(tput sgr0)$(tput bold)"

PS3="$prompt "
select opt in "${options[@]}" "Abort"; do
    case "$REPLY" in
        1 ) # Install translations
            echo "$(tput setaf 10)"
            ( set -xv ; cinnamon-json-makepot -i )
            echo "$(tput setaf 9)Remember to restart Cinnamon!!!$(tput sgr0)"
            echo "$(tput bold)"
            ;;
        2 ) # Uninstall translations
            echo "$(tput setaf 9)"
            ( set -xv ; cinnamon-json-makepot -r )
            echo "Remember to restart Cinnamon!!!$(tput sgr0)"
            echo "$(tput bold)"
            ;;
        3 ) # Restart Cinnamon
            echo "$(tput sgr0)"
            ( set -xv ; nohup cinnamon --replace > /dev/null 2>&1 & )
            break
            ;;
        $(( ${#options[@]}+1 )) )
            echo "$(tput setaf 11)Operation cancelled.$(tput sgr0)"
            break
            ;;
        * )
            echo "$(tput setaf 11)Invalid option. Try another one.$(tput sgr0)"
            echo "$(tput bold)"
            continue
            ;;
    esac
done
