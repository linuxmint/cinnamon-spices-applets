#!/bin/bash
processname=$1
echo -n $(ps -C ${processname} -o pid=)

exit 0
