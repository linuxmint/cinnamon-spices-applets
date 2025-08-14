imports.gi.versions.Gtk = '3.0';
const { Gtk, GLib } = imports.gi;

function main() {
    Gtk.init(null);

    let messageText = ARGV[1].replace(/\\n/g, '\n');

    let dialog = new Gtk.MessageDialog({
        transient_for: null,
        modal: true,
        buttons: Gtk.ButtonsType.OK,
        message_type: Gtk.MessageType.INFO,
        title: ARGV[0],
        text: messageText
    });

    dialog.connect("response", () => {
        dialog.destroy();
        Gtk.main_quit();
    });

    dialog.show_all();
    Gtk.main();
}

main();

