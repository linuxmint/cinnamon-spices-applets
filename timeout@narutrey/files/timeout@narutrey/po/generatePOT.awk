{
    if (/"description"/ || /"name"/ || /"tooltip"/) {
        match($0, /:/);
        l = length($0) - (RSTART);
        r = substr($0, RSTART + 1, l);
        gsub(/^[ \t]+|[ \t]+$/, "", r);
        print "_("r")";
    } else {print "-"}
}
