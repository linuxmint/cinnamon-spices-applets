import shutil
import os

try:
	shutil.rmtree(os.environ["HOME"]+"/.local/share/cinnamon/applets/custom-network@example.com/")
except:
	pass
shutil.copytree("/usr/share/cinnamon/applets/network@cinnamon.org/", os.environ["HOME"]+"/.local/share/cinnamon/applets/custom-network@example.com/")
os.chdir(os.environ["HOME"]+"/.local/share/cinnamon/applets/custom-network@example.com/")

metadatafile = file("./metadata.json","r")
metadata = metadatafile.read().split("\n")
metadatafile.close()
metadata[1] = ' "uuid": "custom-network@example.com",'
metadata[2] = ' "name": "Custom Network Manager",'
metadata[3] = ' "description": "Network manager applet with Network Connections shortcut",'
newmetadata = ""
for data in metadata:
	newmetadata += data + "\n"
metadatafile = file("./metadata.json","w")
metadatafile.write(newmetadata)
metadatafile.close()

appletfile = file("./applet.js","r")
applet = appletfile.read().split("\n")
appletfile.close()
applet[1677] += '            this.menu.addAction(_("Network Connections"), function(event){Util.spawnCommandLine("nm-connection-editor")});\n'
newapplet = ""
for data in applet:
	newapplet += data + "\n"
appletfile = file("./applet.js","w")
appletfile.write(newapplet)
appletfile.close()