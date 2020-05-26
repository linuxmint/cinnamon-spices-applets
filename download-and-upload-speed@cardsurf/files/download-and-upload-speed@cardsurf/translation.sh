#!/bin/bash

uuid="download-and-upload-speed@cardsurf"
po_directory="$HOME/.local/share/cinnamon/applets/$uuid/po"
mo_directory="$HOME/.local/share/locale"
local_messages_folder="LC_MESSAGES"
output_filename="$uuid.mo"
modification_threshold_seconds=0

function generate_translation_file {
    input_filepath=$1
    output_filepath=$2
    msgcat $input_filepath | msgfmt -o $output_filepath -
    echo "Created translation file: $output_filepath"
}

for filepath in "$po_directory"/*.po; do
    filename=$(basename "$filepath")
    filename="${filename%.*}"
    output_directory="$mo_directory/$filename/$local_messages_folder/"
    output_filepath="$output_directory/$output_filename"

    if [ ! -d $output_directory ]; then
        mkdir -p $output_directory
    fi

    if [ -f $output_filepath ]; then
        input_modification_time=$(date +%s -r $filepath)
        output_modification_time=$(date +%s -r $output_filepath)
        difference_seconds=$(( $input_modification_time - $output_modification_time ))
        if (( $difference_seconds > $modification_threshold_seconds )); then
            generate_translation_file $filepath $output_filepath
        fi
    else
        generate_translation_file $filepath $output_filepath
    fi
done

