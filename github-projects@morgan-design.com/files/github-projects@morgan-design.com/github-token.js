const Soup = imports.gi.Soup;
const Lang = imports.lang;

const API_ROOT = "https://api.github.com";

function GitHubOAuth(options) {
    this._init(options);
}

GitHubOAuth.prototype = {

    _init: function(options) {
        this._authToken = options.authToken;
    },
   
   /**
    "auth-token" : {
        "type" : "entry",
        "default" : "",
        "description" : "GitHub Access Token:",

        "tooltip" : "To create a Personal Access Token visit - https://github.com/settings/applications"
    },
    */
   _request: function(){
        let request = Soup.Message.new('GET', feedUrl);

        this.httpSession.queue_message(request, function(session, message){
           _this.onHandleFeedResponse(session, message)
        });
   },
   
   _authenticate: function(){
        // "https://api.github.com/?access_token=OAUTH-TOKEN"   
   },
   
   
   
 

}
