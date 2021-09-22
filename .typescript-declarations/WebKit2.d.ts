declare namespace imports.gi.WebKit2 {

    interface WebView extends gi.Gtk.Container {

        connect(event: 'load-changed', callback: (actor: this, event: LoadEvent) => void): number

        /**
         * Requests loading of the specified URI string.
         * You can monitor the load operation by connecting to
         * WebKit2.WebView.load-changed signal.
         * 
         * @param uri an URI string
        */
        load_uri(uri: string): void
        

        /**
         * The current active URI of the WebKit2.WebView.
         * See WebKit2.WebView.get_uri for more details.
         */
        readonly uri: string

    }

    class WebView {
        constructor()
    }


    enum LoadEvent {
        /** A new load request has been made. 
         * No data has been received yet, empty structures have 
         * been allocated to perform the load; the load may still 
         * fail due to transport issues such as not being able to
         * resolve a name, or connect to a port */
        STARTED = 0,
        /** A provisional data source received a server redirect */
        REDIRECTED = 1,
        /** The content started arriving for a page load. 
         * The necessary transport requirements are established, and the 
         * load is being performed. */
        COMMITED = 2,
        /** Load completed. All resources are done loading 
         * or there was an error during the load operation. */
        FINISHED = 3
    }

}