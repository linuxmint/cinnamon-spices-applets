pip uninstall galileo
rm /etc/udev/rules.d/99-fitbit.rules
wait 3
service udev restart