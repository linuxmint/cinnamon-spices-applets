#! /bin/bash

APPLETDIR="$1"
SHELLTOOLS_DT=$2

TOOLSFILE_IN="${APPLETDIR}/tools.json.in"
TOOLSFILE_OUT="${APPLETDIR}/tools.json"
TOOLSDIR="${APPLETDIR}/tools/"
STATEFILE="${APPLETDIR}/state.sh"

# client scripts in tools folder take priority
PATH=$TOOLSDIR:$PATH

# state storage for client scripts
# This provides an easy way for a client script to persist state between calls. 
declare -A state
declare -A notifystate

#load states from previous run
if [ -e $STATEFILE ]
then
    source $STATEFILE
fi

# read in the tools file, split into fields seperated by ~
while IFS='~' read -a cmds
do
    # if the current line being requires processing
    if [ ${#cmds[@]} -gt 1 ]
    then
        # make sure the IFS is set right
        IFS=$'\n'

        # extract fields
        state_name=${cmds[1]}
        notifycmd=${cmds[2]}
        shellcmd=${cmds[3]}

        # build command line: set the old state and the update period as environment vars
        cmdoutput=($(export SHELLTOOLS_STATE=${state[${state_name}]} ; export SHELLTOOLS_DT=${SHELLTOOLS_DT} ;  eval ${shellcmd}))

        # if the client script only generates *exactly* one line of output, use its output as state and notify_state
        if [ ${#cmdoutput[@]} -eq 1 ]
        then
            new_notifystate="${cmdoutput[0]}"
            new_state="${cmdoutput[0]}"
            new_text=${cmdoutput[0]}
        # if the client script generates exactly two lines of output, use first line as state and notify state, and the second as output 
        elif [ ${#cmdoutput[@]} -eq 2 ]
        then
            new_notifystate="${cmdoutput[0]}"
            new_state="${cmdoutput[0]}"
            new_text=${cmdoutput[1]}
        else 
            # the client script generates more than two line of output.
            # the first line is notify state, the second line is internal state, third is replacement text, rest is ignored
            new_notifystate="${cmdoutput[0]}"
            new_state="${cmdoutput[1]}"
            new_text=${cmdoutput[2]}
        fi

        # if client script uses notify functionality
        if [ "$notifycmd" != "" ]
        then
            # if notify_state has changed
            if [ "${notifystate[${state_name}]}" != "${new_notifystate}" ]
            then
                # run the notify command
                (export SHELLTOOLS_NOTIFYSTATE_OLD=${notifystate[${state_name}]} ; export SHELLTOOLS_NOTIFYSTATE=${new_notifystate} ; eval ${notifycmd} )
            fi
        fi

        # save new context
        state[${state_name}]=${new_state}
        notifystate[${state_name}]=${new_notifystate}
        
        # update the popup contents
        cmds[1]=""
        cmds[2]=""
        cmds[3]=${new_text}

    fi

    # output the popup contents        
    echo $(printf "%s" "${cmds[@]}")
done < "$TOOLSFILE_IN" > "${TOOLSFILE_OUT}.tmp"

mv "${TOOLSFILE_OUT}.tmp" "${TOOLSFILE_OUT}"

#save states

for i in "${!state[@]}"
do
  echo "state[$i]=\"${state[$i]}\""
done > $STATEFILE

for i in "${!notifystate[@]}"
do
  echo "notifystate[$i]=\"${notifystate[$i]}\""
done >> $STATEFILE

