#!/bin/sh
# run minecraft


# set path to your Java, Sun is recommended over openjdk
export LD_LIBRARY_PATH="/usr/lib/jvm/java-7-oracle/jre/lib/amd64/"

# magic launcher run command download and add your path
java -jar /home/mark/MagicLauncher_0.9.8.jar

# plain Java run command
#java -Xmx2000M -Xms1024M -cp minecraft.jar net.minecraft.LauncherFrame

