//------------------------------- UTILITY FUNCTIONS

//@for debugging purposes
function print(str, object) {
    global.log(str, JSON.stringify(object));
}

function windowPrint(str, window) {
    if (!window) {
        global.log(str, null)
        return;
    }
    let windowDetails = {
        type: window.get_meta_window().get_window_type(),
        appId: window.get_meta_window().get_gtk_application_id(),
        id: window.get_meta_window().get_id(),
        description: window.get_meta_window().get_description(),
    };
    global.log(str, JSON.stringify(windowDetails));
}