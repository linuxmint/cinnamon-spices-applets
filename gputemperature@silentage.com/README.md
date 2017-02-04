GPUTemperature displays the Temperature of your ATI (one only) or NVIDIA GPUs (one or more).

GPUTemperature requires the nvidia-settings command which is installed with the binary-blob
drivers downloaded directly from NVidia (http://www.geforce.com/drivers) or with a distro-
package usually called "nvidia-settings" (Ubuntu/Mint/Fedora, others may vary).

GPUTemperature requires the lm_sensors packages be installed and configured 
along with the opensource ATI drivers with ATI RADEON GPUs.

Version 2.0.0
Version History

	1.0		Initial release
	1.0.1	Fixed bug if no fan present (or if any other fields in pop-up either
			are missing or formatted in a way which deviates from the current
			form such that the matching expression will miss them).
	1.0.2	Fixed issue cause pop-up menu to disappear when mousing over the
			"GPU x" line.
	1.1.0	Added preliminary support for ATI GPUs using the opensource driver
			and lm_sensors.
	1.1.1	Show GPU memory usage for NVIDIA GPUs.
	2.0.0	Gutted usage of nvidia-smi and replaced with nvidia-settings for
			NVidia cards. This allows for more detailed information and support
			for more NVidia cards (nvidia-smi was not the best choice).
	2.0.1	Changed permissions on files so that installation globally will work.

Installation:
	Decompress the zip file to ~/.local/share/cinnamon/applets or /usr/share/cinnamon/applets.

	Restart Cinnamon (alt+f2 then r)

	Open the Cinnamon applets control panel.

	Enable the applet.
