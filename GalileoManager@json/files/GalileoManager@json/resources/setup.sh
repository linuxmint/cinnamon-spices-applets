apt-get install python-pip || echo ""
pip install setuptools
pip install galileo
bash -c 'echo "SUBSYSTEM=="usb", ATTR{idVendor}=="2687", ATTR{idProduct}=="fb01", SYMLINK+="fitbit", MODE="0666"" >> /etc/udev/rules.d/99-fitbit.rules'
wait 1
service udev restart
echo "Setup is complete. You must re-insert your Fitbit dongle to be able to use it as a non-root user."