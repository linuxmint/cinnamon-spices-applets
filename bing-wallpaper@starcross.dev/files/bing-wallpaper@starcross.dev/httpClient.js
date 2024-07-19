const Soup = imports.gi.Soup;
const ByteArray = imports.byteArray;
const Lang = imports.lang;

/**
 * HttpClient handles HTTP requests to fetch data from the web.
 */
const HttpClient = function () {
  this._init();
};

HttpClient.prototype = {
  /**
   * Initializes the HTTP client based on the version of Soup.
   */
  _init: function () {
    this.session =
      Soup.MAJOR_VERSION === 2 ? new Soup.SessionAsync() : new Soup.Session();
    if (Soup.MAJOR_VERSION === 2) {
      Soup.Session.prototype.add_feature.call(
        this.session,
        new Soup.ProxyResolverDefault()
      );
    }
  },

  /**
   * Performs a GET request to the specified URL.
   * @param {string} url - The URL to fetch data from.
   * @param {function} onSuccess - Callback function to handle successful response.
   * @param {function} onError - Callback function to handle errors.
   */
  get: function (url, onSuccess, onError) {
    let request = Soup.Message.new("GET", url);
    if (Soup.MAJOR_VERSION === 2) {
      this.session.queue_message(request, (session, message) => {
        if (message.status_code === 200) {
          onSuccess(message.response_body.data);
        } else {
          onError(message.status_code);
        }
      });
    } else {
      this.session.send_and_read_async(
        request,
        Soup.MessagePriority.NORMAL,
        null,
        (session, message) => {
          if (request.get_status() === 200) {
            const bytes = this.session.send_and_read_finish(message);
            onSuccess(ByteArray.toString(bytes.get_data()));
          } else {
            onError(request.get_status());
          }
        }
      );
    }
  },
};

exports.HttpClient = HttpClient;
