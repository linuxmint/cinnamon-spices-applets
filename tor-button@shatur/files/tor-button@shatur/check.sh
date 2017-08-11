#!/bin/sh
if [ -z "$(pidof tor -s)" ]
then
   echo OFF > /tmp/.torAppletCheck
else
   echo ON > /tmp/.torAppletCheck
fi
exit 0
