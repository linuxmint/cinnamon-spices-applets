
/**
 * Simple logging utility
 **/
function Logger(options){
	this.uuid = options.uuid || "";
    this.verboseLogging = options.verboseLogging || false;
}

Logger.prototype.debug = function(logMsg){
	if(this.verboseLogging){
		global.log(this.uuid + "::" + logMsg);
	}
}

Logger.prototype.error = function(error) {
	global.logError(this.uuid + ":: ERRROR :: " + error);
}