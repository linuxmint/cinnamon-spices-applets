const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Lang = imports.lang;

const API_ROOT = "https://api.github.com";

/**
 * Simple Object to encapsulate all access and dealings with github
 **/
function GitHub(options){

	this.username		= options.username;	/** Username for GitHub **/
	this.version		= options.version;	/** Version of application, used in API request **/
	this.logger		= options.logger;	/** The Logger **/

	this.user_agent 	= "Cinnamon-GitHub-Explorer/" + this.version; /** User agent passed when making API requests **/

	this.totalFailureCount 	= 0; 		/** Count Number of failures to prevent **/
	this.lastAttemptDateTime= undefined; 	/** The last time we checked GitHub **/

	this.apiLimit		= undefined; 	/** Max number of requests per hour **/
	this.apiLimitRemaining 	= undefined; 	/** Remaining number of requests in hour **/
	this.apiLimitResetTime	= undefined; 	/** The time when the API rate limit is reset -http://en.wikipedia.org/wiki/Unix_time **/

	/** The magic callbacks **/
	this.callbacks = {}

	/** Object repository statistics information **/
	this.repos = {}

	/** Log verbosely **/
	this.logger.debug("GitHub : Setting Username  = " + this.username);
	this.logger.debug("GitHub : Setting UserAgent = " + this.user_agent);
	this.logger.debug("GitHub : Setting Version	  = " + this.version);

	this.hasExceededApiLimit = function(){
		return this.apiLimitRemaining != undefined && this.apiLimitRemaining <= 0;
	}

	this.onFailure = function(onFailure){
		this.callbacks.onFailure = onFailure;
	}

	this.onSuccess = function(onSuccess){
		this.callbacks.onSuccess = onSuccess;
	}

	this.onRepositoryChangedEvent = function(fireRepoChangedEvent){
		this.fireRepoChangedEvent = fireRepoChangedEvent;
	}

	this.minutesUntilNextRefreshWindow = function(){
		let next_reset = new Date(this.apiLimitResetTime * 1000); // Seconds to millis
		let timeDiff = next_reset.getTime() - this.lastAttemptDateTime.getTime();
		let minutes_diff = Math.floor((timeDiff/1000)/60);
		return minutes_diff + 1; // Always plus 1 minute to ensure we have atleast something to countdown
	}

	try {
		if (Soup.MAJOR_VERSION === 2) {
			this.httpSession = new Soup.SessionAsync();
		} else { //version 3
			this.httpSession = new Soup.Session();
		}
		this.httpSession.user_agent = this.user_agent;
		
		//Authorization: token OAUTH-TOKEN
		
	} catch(e) {
		throw 'GitHub: Creating Soup Session failed: ' + e;
	}

	if (Soup.MAJOR_VERSION === 2) {
		try {
			Soup.Session.prototype.add_feature.call(this.httpSession, new Soup.ProxyResolverDefault());
		} catch(e) {
			throw 'GitHub: Adding ProxyResolverDefault failed: ' + e;
		}
	}
}

GitHub.prototype.loadDataFeed = function(){

	this.lastAttemptDateTime = new Date(); // Update the attempted date

	var feedUrl = API_ROOT+"/users/"+this.username+"/repos";

	let _this = this;

	let request = Soup.Message.new('GET', feedUrl);

	if (Soup.MAJOR_VERSION == 2) {
		this.httpSession.queue_message(request, (session, response) => {
			this.apiLimit			= response.response_headers.get_one("X-RateLimit-Limit");
			this.apiLimitRemaining 	= response.response_headers.get_one("X-RateLimit-Remaining");
			this.apiLimitResetTime	= response.response_headers.get_one("X-RateLimit-Reset");
			const status_code = response.status_code;
			this.onHandleFeedResponse(status_code, response.response_body.data)
		});
	} else { //version 3
		this.httpSession.send_and_read_async(request, Soup.MessagePriority.NORMAL, null, (session, response) => {
			this.apiLimit			= request.get_response_headers().get_one("X-RateLimit-Limit");
			this.apiLimitRemaining 	= request.get_response_headers().get_one("X-RateLimit-Remaining");
			this.apiLimitResetTime	= request.get_response_headers().get_one("X-RateLimit-Reset");
			const status_code = request.get_status();
			const bytes = this.httpSession.send_and_read_finish(response);
			if (bytes) {
				this.onHandleFeedResponse(status_code, ByteArray.toString(bytes.get_data()));
			} else {
				this.onHandleFeedResponse(status_code, null);
			}
		});
	}
}

GitHub.prototype.onHandleFeedResponse = function(status_code, data) {
	this.logger.debug("Header [X-RateLimit-Limit]: " + this.apiLimit);
	this.logger.debug("Header [X-RateLimit-Remaining]: " + this.apiLimitRemaining);
	this.logger.debug("Header [X-RateLimit-Reset]: " + this.apiLimitResetTime);

	this.logger.debug("HTTP Response Status code [" + status_code + "]");

	try {
		var responseJson = JSON.parse(data);

		// Successful request
		if(status_code === 200){
			this.totalFailureCount = 0;
			this.callbacks.onSuccess(responseJson);

			for (i in responseJson) {

				let repo = responseJson[i];
				var key = repo.id + "-" + repo.name;

				// Check repo already in map
				if(key in this.repos){

					let current_repo = this.repos[key];

					if(current_repo.total_watchers > repo.watchers){
						this.fireRepoChangedEvent({
							type: "Watcher Removed",
							content: repo.name,
							link_url: "https://github.com/" + this.username+"/"+repo.name+"/watchers"
						});
					}
					else if(current_repo.total_watchers < repo.watchers){
						this.fireRepoChangedEvent({
							type: "New Watcher",
							content: repo.name,
							link_url: "https://github.com/" + this.username+"/"+repo.name+"/watchers"
						});
					}

					if(current_repo.total_open_issues > repo.open_issues){
						this.fireRepoChangedEvent({
							type: "Issue Resolved",
							content: repo.name,
							link_url: "https://github.com/" + this.username+"/"+repo.name+"/issues"
						});
					}
					else if(current_repo.total_open_issues < repo.open_issues){
						this.fireRepoChangedEvent({
							type: "New Issue",
							content: "",
							link_url: "https://github.com/" + this.username+"/"+repo.name+"/issues"
						});
					}

					if(current_repo.total_forks > repo.forks){
						this.fireRepoChangedEvent({
							type: "Removed Project Fork",
							content: repo.name,
							link_url: "https://github.com/" + this.username+"/"+repo.name+"/network"
						});
					}
					else if(current_repo.total_forks < repo.forks){
						this.fireRepoChangedEvent({
							type: "New Project Fork",
							content: repo.name,
							link_url: "https://github.com/" + this.username+"/"+repo.name+"/network"
						});
					}
				}
				// else if(responseJson.length > this.repos.length) {
				// this.logger.debug("JSON Length : " + responseJson.length);
				// this.logger.debug("Repo Length : " + Object.keys(this.repos).length)
				// 	this.fireRepoChangedEvent({
				// 		type: "New Repository Created",
				// 		content: repo.name,
				// 		link_url: "https://github.com/" + this.username+"/"+repo.name
				// 	});
				// }

				this.repos[key] = {
					repo_id: repo.id,
					repo_name: repo.name,
					total_watchers: repo.watchers,
					total_forks: repo.forks,
					total_open_issues: repo.open_issues
				}

			}
		}
		// Unsuccessful request
		else if(this.notOverFailureCountLimit()){
			this.totalFailureCount++;
			this.callbacks.onFailure(status_code, responseJson.message);
		}

	} catch(e) {
		this.logger.error("Problem with response callback response " + e);
	}
}

// Number of failures allowed
// TODO remove me!
GitHub.prototype.totalFailuresAllowed = 5;

GitHub.prototype.notOverFailureCountLimit = function() {
	return this.totalFailuresAllowed >= this.totalFailureCount;
}

