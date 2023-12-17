#!/bin/bash

type_list="PNG@png JPEG@jpg SVG@svg Web/P@webp"
suffix=""

input="$1"
save_path="$2"
echo ${input}
echo ${save_path}

md5=$(md5sum ${input} | awk '{print $1}')
echo ${md5}

file_type=$(file ${input})

for type in ${type_list}; do
    echo "${type}"
    if [ "" != "$(echo ${file_type} | grep ${type%@*})" ]; then
        echo "get type ${type}"
        suffix="${type#*@}"
    fi
done

if [ "" != "${save_path}" ] && [ "" != "ls ${save_path}" ]; then
    cp ${input} ${save_path}/${md5}"."${suffix}
fi
