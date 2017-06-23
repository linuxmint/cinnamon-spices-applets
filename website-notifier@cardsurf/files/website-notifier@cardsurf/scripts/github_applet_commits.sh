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
    webpage=$(wget -qO- --timeout=5 --tries=1 "--header=accept-encoding: gzip" https://github.com/linuxmint/cinnamon-spices-applets/commits/master | gunzip -c)

    # Parse webpage
    last_commit=$(echo $webpage | gawk '{split($0, substrings, /"table-list-cell"/); print substrings[2]}' )  # Get 2nd "table-list-cell" substring
    url=$(echo $last_commit | gawk '{match($0, /href="([^"]*)/, matches); print matches[1]}' )                # Get value of 1st "href" attribute
    title=$(echo $last_commit | gawk '{match($0, /title="([^"]*)/, matches); print matches[1]}' )             # Get value of 1st "title" attribute
    time=$(echo $last_commit | gawk '{match($0, /datetime="([^"]*)/, matches); print matches[1]}' )           # Get value of 1st "datetime" attribute
    contributor=$(echo $last_commit | gawk '{match($0, /contributor">([^<]*)/, matches); print matches[1]}' ) # Get contributor name

    # Set output variables
    next_url="https://github.com/$url"
    next_title="Github cinnamon applet commits"
    next_message="Commit: $title\nContributor: $contributor\nTime: $time\nUrl: $next_url"
    show_notification="true"
}

refresh
return_values

