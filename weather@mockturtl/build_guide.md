# Build Guide

The Source code is in typescript, You must compile it into js if you change it.
the Build script helps to get them where they need to be in the correct
format.

Building requires Typescript installed (obviously).
To install typescript run: "sudo npm install -g typescript"  (requires node...) or find it in your package manager

Visual Studio Code has the best Typescript support, although you can use other Text editors.

## Build for 3.8

Run `build.sh`, it will build for 3.8.

## Build for 3.0

Note that 3.0 was deprecated in April 2021, but the src is kept for that version. can build it with `./build3_0.sh`.