#!/bin/bash

#time message in xml format with the icon and the border

message=$(date '+%H:%M:%S')

xml=`cat <<EOF
<xml>
  <appsettings>
    <tooltip>A clock with an icon</tooltip>
    <clickaction></clickaction>
  </appsettings>
  <item>
   <type>box</type>
    <attr>
      <vertical>0</vertical>
      <yfill>0</yfill>
      <style>border: 2px;border-color: brown;padding: 1px</style> 
    </attr>
    <item>
      <type>icon</type>
      <value>/usr/share/icons/Mint-X/apps/48/clock.png</value> 
      <attr>
        <style>icon-size: 0.50em;</style> 
      </attr>
    </item>
    <item>
      <type>text</type>
      <value>$message</value> 
      <attr>
        <style>font-size: 8pt;font-weight: bold;color:yellow</style> 
      </attr>
    </item>
  </item>
</xml>

EOF
`

echo "$xml"
