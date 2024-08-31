#!/usr/bin/perl

use strict;
use warnings;

use Encode qw/decode/;

my $current_c = '';

sub each_file_item ($$$) {
    my ($dir, $basedir, $hier) = @_;
    my $dir2 = $basedir.'/'.$dir;

    ## Ignore if this is a symbolic link
    return if -l $dir2;

    ## Traverse further if a directory.
    if (-d $dir2) {
        my @hier2 = @{$hier};
        push @hier2, $dir;
        traverse($dir2, \@hier2);
        return;
    }

    ## Ignore if not a file.
    return if ! -f $dir2;

    ## Ignore if the file is empty.
    return if -z $dir2;
    
    ## This should not be possible but ignore if the file somehow
    ## have lesser/greater-than characters.
    return if $dir2 =~ /[<>]/;

    my $ext = '';
    my $name = '';
    if ($dir =~ /^(.+)\.(\w+)$/) {
        $ext = lc $2;
        $name = $1;
    } else {
        return;
    }

    if (($ext eq 'lnk') || ($ext eq 'url')) {
        my $len = @{$hier};
        my $c;
        if ($len < 1) {
            $c = 'Wine';
        } else {
            $c = @{$hier}[$len-1];
        }

        if ($current_c ne $c) {
            print "\\" . $c . "\n";
            $current_c = $c;
        }

        print "<$name> <$dir2>\n";
    }
}

sub traverse ($$) {
    my ($dir, $hier) = @_;
    if (opendir my $dh, $dir) {
        while (readdir $dh) {
            ## Skip if it is a dot or double dot directory
            next if ($_ eq '.' || $_ eq '..');
            
            each_file_item($_, $dir, $hier);
        }
        closedir $dh
    }
}

sub try_prefix_start_menu ($$) {
    my ($prefix, $start_menu) = @_;

    return if $start_menu eq '';
    
    $start_menu =~ s/\\+/\//g;
    if ($start_menu =~ /^(\w):\/+(.+)$/) {
        my $drive = 'drive_' . lc $1;
        my $start_menu_path = $2;

        my $dir = $prefix . "/" . $drive . "/" . $start_menu_path;
        return if ! -d $dir;
        traverse($dir, []);
    }
}

sub try_prefix ($) {
    my ($prefix) = @_;

    if (open my $reg, '<', $prefix . '/system.reg') {
        my $start_menu = '';
        my $shellfolders = 0;
        while (<$reg>) {
            if (/^\[([^]]+)\] [0-9]+/) {
                $shellfolders = 0;
                my @key = split /\\+/, $1;
                if ((@key == 6) && ($key[5] eq 'Shell Folders')) {
                    $shellfolders = 1;
                }
            } elsif (($shellfolders == 1) && (/^"Common Start Menu"="(.+)"/)) {
                $start_menu = $1;
                last;
            }
        }
        close $reg;
        
        try_prefix_start_menu($prefix, $start_menu);
    }

    if (open my $reg, '<', $prefix . '/user.reg') {
        my $start_menu = '';
        my $shellfolders = 0;
        while (<$reg>) {
            if (/^\[([^]]+)\] [0-9]+/) {
                $shellfolders = 0;
                my @key = split /\\+/, $1;
                if ((@key == 6) && ($key[5] eq 'Shell Folders')) {
                    $shellfolders = 1;
                }
            } elsif (($shellfolders == 1) && (/^"Start Menu"="(.+)"/)) {
                $start_menu = $1;
                last;
            }
        }
        close $reg;
        
        try_prefix_start_menu($prefix, $start_menu);
    }
}

my $prefix;
my $wine_cmd;
$wine_cmd = 'wine';
if (@ARGV < 1) {
    if (! defined $ENV{'HOME'}) {
        exit(1);
    }

    $prefix = $ENV{'HOME'} . "/.wine";
} else {
    $prefix = $ARGV[0];
    if (@ARGV > 1) {
        $wine_cmd = $ARGV[1];
    }
}

try_prefix($prefix);


