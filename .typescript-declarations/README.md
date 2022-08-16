# Typescript declaration files

These are Typescript declaration files (.d.ts) describing libraries usually present in a system which is using Cinnamon. They only help Typescript's static type checking and autocomplete functions, they are never transpiled into JS and they should never end up in the "files" folder.

These alone are a big help but it's still recommended to refer to [GJS docs](https://gjs-docs.gnome.org/) and reading the files in `/usr/share/cinnamon/js/` folder because they have complete implementations/documentation.

## Purpose

The declaration files are created to make development with Cinnamon libraries and GObject bindings (most things under `imports`) less painful by making them not completely unknown (especially if you just started out).

## Files

Everything in the folder root is generated with [GIR2TS](https://github.com/Gr3q/GIR2TS) from ```.gir``` files usually located in ```/usr/share/gir-1.0/```, usually part of the ```gobject-introspection``` package.

The declaration files are not complete, there are other libraries which can exist on a system.

Please refer to the documentation if you want to use the tool and generate more declarations.

**DISCALIMER**: The tool is not complete nor is it producing 100% correct results due to the fact that GIR files (and C language in general) has features which are not present in Typescript or impossible to implement like overloaded functions, class inheritance from multiple classes. Some of them can be worked around and some of them cannot. Nevertheless, it produces usable declarations and is a good starting point which can be fixed up when it see usage.

Files in the ```cinnamon``` folder are written by hand and should match existing files in `/usr/share/cinnamon/js/` folder (for version 3.8 and above, except cinnamon.d.ts file, which is the remnant of the old declaration structure and is being replaced by separate files). Currently not all files have declarations, only for the essentials. Contributions are welcome.

## Bootstrap an applet with Typescript

**Note: This guide only works above Cinnamon version 3.8!** Typescript can be used below 3.8 as well, but its a lot more work and not as intuitive.

### Folder structure

I use applet name `test@user` to demonstrate the folder structure for a Typescript applet.

```bash
test@user/
├── files
│   └── test@user
│       ├── 3.8
│       │   ├── applet.js
│       │   └── main.js
│       ├── metadata.json
│       └── po/
├── info.json
├── README.md
├── src
│   └── 3_8
│       ├── applet.ts
│       ├── main.ts
│       ├── tsconfig.json
│       └── types.ts
```

The structure is mostly identical to a regular applet, except for the `src` folder.

The `src` folder should contain the typescript files with a numbered folder matching the version on the files folder for multiversion support.

### tsconfig.json

The contents of `tsconfig.json` contents should be identical to the code snippet below. It contains reasoning for every line.

```json
{
    "compilerOptions": {
        "lib": ["es2017"],           // ES2017 is supported starting from Cinnamon 3.8
        "module": "CommonJS",        // CommonJS module resolution is the only one that works with GJS
        "target": "es2017",          // Again, Cinnamon 3.8+ supports ES2017, no need to transpile further down.
        "noImplicitAny": true,       // Optional, just forces you to declare types.
        "removeComments": true,      // Optional
        "preserveConstEnums": false, // Const enums will be substituted to its values in transpiled code, in some cases nurmal enums doesn't work properly in GJS
        "sourceMap": false,          // SourceMaps break the JS engine, never include them
        "noImplicitThis": true,      // This warns you for callbacks using this which might be not bound to the correct context.
        "baseUrl": "./",             // specifies that absolute module resolution happens from the current folder (where applet.js will reside)
        "outDir": "../../files/test@user/3.8/" // Should match the folder path in your files folder, transpiled files will be placed there
    },
    "include": [
        "./**/*",                    // include every file in the current folder, even from subfolders
        "../../../.typescript-declarations/**/*",  // include every file in the declarations folder, even from subfolders.
    ],
}
```

With this config file the files will be transpiled correctly and imports will be resolved properly,.

### Imports

* Imports will be transpiled into `require` statements. 

* Exports will be appended to the `exports` variable which isn't actually used by the JS engine in Cinnamon.

* **You must use absolute imports `subfolder/file` instead of relative imports `./subfolder/file`, because relative imports can't traverse up the folder structure!** *For example using `../utils` from a subfolder will **break** your applet.*

#### Avoiding Circular imports

Because the files are only transpiled and not bundled, you have to make sure you don't introduce circular imports into the code. My recommendations on how to avoid them:

* Keep in mind that virtual implementations (classes, interfaces, types) can be imported from anywhere, but actual implementations (functions, variables, instantiated classes) must not refer back to it's importer's actual implementations.

* If code is used in multiple places it should be in a separate file - utilities for example.

## Developing

While developing read the docs *(occasionally reading code)* for GJS as mentioned above while using the declarations and you will be OK. If the declarations are wrong, try to debug with the methods explained below and feel free to open a Pull Request.

If you run `tsc` in the `src/` folder the transpiled piles will be placed in the correct output folder.

Here is the script I deploy my code for testing *(with applet name switched out to `test@user`)* :

```bash
#!/bin/bash
cd src/3_8
tsc -p tsconfig.json
cd ../..
# Comment out these lines if you don't want to wipe the applet folder
rm -rf ~/.local/share/cinnamon/applets/test@user/
mkdir ~/.local/share/cinnamon/applets/test@user/
# --------------------------------------------------
cp -rf files/test@user/* ~/.local/share/cinnamon/applets/test@user/
export DISPLAY=:0; cinnamon --replace &
```

This snippet will build your files, place those updated files in the correct folder and restarts Cinnamon.

#### Reason for using `export DISPLAY=:0; cinnamon --replace &`

Looking Glass logs lack a actual cinnamon output and can only display strings. Because of that, stack traces, warnings extra debugging info are missing from there.

With this command you pipe the log output of cinnamon into your terminal after restarting *(try not to close it, you will shut down cinnamon and you will have to restart it from the tty, although "&" should prevent this most of the time)* having easy access all of that plus is handy and you can use `global.log` to actually print object contents and more.