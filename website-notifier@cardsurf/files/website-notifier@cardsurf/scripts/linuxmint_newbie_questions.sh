#!/bin/bash

# Declare input variables
separator=$1
current_url=$2
current_title=$3
current_message=$4
current_others=$5

# Declare output variables
next_url=$current_url
next_title=$current_title
next_message=$current_message
next_others=$current_others
show_notification="false"

# Return result
function return_values {
    output=$next_url$separator
    output=$output$next_title$separator
    output=$output$next_message$separator
    output=$output$next_others$separator
    output=$output$show_notification
    echo $output
}

# Check website for updates
function refresh {
    # Download webpage
    if [ ! -f $cookies ]; then
        wget -qO- --timeout=5 --tries=1 "--header=accept-encoding: gzip" --save-cookies "/tmp/LinuxMintNewbieQuestionsCookies.txt" https://forums.linuxmint.com/ | gunzip -c
    fi
    webpage=$(wget -qO- --timeout=5 --tries=1 "--header=accept-encoding: gzip" --load-cookies "/tmp/LinuxMintNewbieQuestionsCookies.txt" https://forums.linuxmint.com/ | gunzip -c)

    # Parse webpage
    newbie_questions=$(echo $webpage | gawk '{split($0, substrings, /list-inner/); print substrings[6]}' )        # Get 6th "list-inner" substring
    last_post=$(echo $newbie_questions | gawk '{split($0, substrings, /Last post/); print substrings[2]}' )       # Get 2nd "Last post" substring
    url=$(echo $last_post | gawk '{match($0, /href="([^"]*)/, matches); print substr(matches[1], 3);}' )          # Get value of 1st "href" attribute
    post=$(echo $last_post | gawk '{match($0, /title="([^"]*)/, matches); print matches[1]}' )                    # Get value of 1st "title" attribute
    time=$(echo $last_post | gawk '{match($0, /latest post(.*)br([^>]*)>([^<]*)/, matches); print matches[3]}' )  # Get post time

    # Set output variables
    next_url="https://forums.linuxmint.com/$url"
    next_title="Linux Mint newbie questions"
    next_message="Post: $post\nTime: $time\nUrl: $next_url"
    show_notification="true"
}

refresh
return_values

