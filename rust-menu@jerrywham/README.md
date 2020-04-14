This is a Cinnamon applet that give you shortcuts to many Rust documentations.

## Requirements
This applet requires at least Cinnamon 4.4.8 or newer.
This version assumes you’re using Rust 1.37.0 or later with edition="2018" in Cargo.toml of all projects to use Rust 2018 Edition idioms.

To install rustup, you have to run on a terminal :
```bash
curl https://sh.rustup.rs -sSf | sh
```
Then, restart your terminal.

## Installation
Download and enable via cinnamon settings.

## Features
The shortcuts are :
- main local documentation, edition 2018
- Rust local project directory. If you don't want to modify the applet, this directory must be nammed "RUST PROJECTS". If you want an other name, modify line 16 of file "~/.local/share/cinnamon/applets/rust-menu@jerrywham/applet.js". You should then restart cinnamon.
- local first edition on the book
- local Rust by example : learn Rust by the code
- local Cargo book : a manuel to learn Cargo in depth
- local Rustc book : learn the Rust programming language compiler
- local Rustdoc tool : to generate documentation
- Many local shortcuts to official creates : std, alloc, core, proc_macro and test (experimental API)
- local Rust edition guide : "Editions" are Rust's way of communicating large changes in the way that it feels to write Rust code.
- local Reference book : This book is the primary reference for the Rust programming language.
- local Embedded Rust Book: An introductory book about using the Rust Programming Language on "Bare Metal" embedded systems, such as Microcontrollers.
- local Rustonomicon : The Dark Arts of Unsafe Rust
- Nursery inline site
 
//## Contributors
