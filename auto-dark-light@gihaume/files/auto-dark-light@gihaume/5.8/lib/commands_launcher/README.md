# Example usage of `launch_command.js`

```js
const launch_command = require('lib/commands_launcher/launch_command.js');

async function main() {
    console.error("start");
    try {
        await launch_command('./test');
    } catch (error) {
        if (error instanceof GLib.ShellError)
            console.error("command format: " + error.message);
        else
        if (error instanceof Gio.IOErrorEnum) {
            if (error.code === Gio.IOErrorEnum.TIMED_OUT)
                console.error("command aborted due to time out");
            else
            if (error.code === Gio.IOErrorEnum.FAILED)
                console.error("command failed: " + error.message);
        } else
            console.error(error); // full object so we can see the stack trace
    }
}

main();

new GLib.MainLoop(null, false).run();
```
