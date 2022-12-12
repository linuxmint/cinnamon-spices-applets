var inWinamp = false;
var stream = null;
var stats = null;
var sliderContentIndex = 0;
var sliderContentInterval = 8500;
var sessionVolumeTimer = null;
var currentTrackTimer = null;
var currentStep = 1;
var playerVolume = 0.5;
var fixedHeaderSize = 470;
var hasCookieData = false;
var audioPlayer = null;
var currentPage;
var streamingTrack = false;
var interval;
// Page loaded

$(function () {
    initializePlayer();

    if (ios()) {
        $("body").delegate("a[rel='internal']", "click touchend", function (event) {
            var url = $(this).attr('href');
            goTo(url);
            event.preventDefault();
        });
    }
    else {
        $("body").delegate("a[rel='internal']", "click", function (event) {
            var url = $(this).attr('href');
            goTo(url);
            event.preventDefault();
            return false;
        });
    }

    //if ($(window).width() > 769) {
    //  $(window).scroll(function () {
    //    if ($(window).scrollTop() > 296)
    //    { $("#genre-colonne").css("top", $(window).scrollTop() - 296 + "px"); }
    //    else
    //    { $("#genre-colonne").css("top", "0px"); }
    //  });
    //}

    /* History */
    $(window).bind('popstate', function (e) {
        var state = e.originalEvent.state;

        if (state) {
            // Make sure that we don't push the state again when
            // going back (this is done by passing false as last
            // parameter to the goTo function)
            if (state.data) {
                goTo(state.page, state.data, false);
            }
            else {
                goTo(state.page, null, false);
            }
        }
    });
    $("body").delegate("#search-form", "submit", function (event) {
        var input = $('#search-focus');
        var query = input.val();

        input.val('');
        input.blur();

        if (!query)
            return;

        inWinamp ? goTo('/Scradioinwinamp/Search', { query: query }) : goTo('/Search', { query: query });

        event.preventDefault();
    });
    loadCookie();
});



/* Start With Function*/
if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str) {
        return this.indexOf(str) == 0;
    }
}

/* Format Function*/
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
   ? args[number]
   : match
            ;
        });
    };
}

function isChromeAndroidBrowser() {
    return false;
    //var ua = navigator.userAgent.toLowerCase();
    //return /chrome/.test(ua) && /android/.test(ua);
}
function isMobile() {
    return $(window).width() <= 1006;
}
function ios() {
    var platform = navigator.platform.toLowerCase();

    return platform === 'ipad' || platform === 'iphone' || platform === 'ipod';
}

function isIE() {
    var tmp = document.documentMode, e, isIE;

    try { document.documentMode = ""; }
    catch (e) { };

    isIE = typeof document.documentMode == "number" || eval("/*@cc_on!@*/!1");

    try { document.documentMode = tmp; }
    catch (e) { };

    return isIE;
}

function parseQueryString(url) {
    var res = {};
    var index = url.indexOf('?');

    if (index > 0) {
        var queryString = url.substring(index + 1).split('&');
        for (var i = queryString.length - 1; i >= 0; i--) {
            var pair = queryString[i].split('=');
            res[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
    }

    return res;
}
function scrollToElement(selector, duration) {
    console.log("scroll to ", selector);
    var headerOffset = isMobile() ? 0 : $('.header').height();
    var element = $(selector);

    if (element != null && element.offset() != null) {
        $('html, body').animate({
            scrollTop: element.offset().top - headerOffset
        }, typeof duration === 'undefined' ? 100 : duration);
    }
}
function goTo(url, parameters, addToHistory) {
    // Query string parameters
    var qsp = parseQueryString(url);
    if (qsp != null) {
        if (parameters != null) {
            for (var val in qsp) {
                if (qsp.hasOwnProperty(val)) {
                    parameters[val] = qsp[val];
                }
            }
        }
        else {
            parameters = qsp;
        }
    }

    //$("main").load(url + ' main', parameters, function () {

    //    stations.length = 0;

    //    $('#nav-btn').removeClass('active');
    //    $('header').removeClass('homeheader');
    //    $('#push-nav').removeClass('nav-open');
    //    $('#layout').removeClass('help-page');

    //    wr("main Replaced");
    //    checkAnchor(url);
    //    loadPage(url, addToHistory, parameters);
    //    ga('send', 'pageview');


    //})

    $.post(url, parameters, function (data) {
        if (data) {
            stations.length = 0;

            //$('#nav-btn').removeClass('active');
            //$('header').removeClass('homeheader');
            //$('#push-nav').removeClass('nav-open');
            //$('#layout').removeClass('help-page');

            $('#genre-title').hide();

            /* V2 */
            replaceContentPage(data);

            //contentScripts();

            checkAnchor(url);

            loadPage(url, addToHistory, parameters);

            //refreshHeader();

            ga('send', 'pageview');
        }
    });
}


function loadPage(url, addToHistory, parameters) {
    setCurrentUrl(url, addToHistory, parameters);

    handlePageLoad(url, parameters);
}


function handlePageLoad(url, parameters) {

    switch (url.split('?')[0].split('#')[0].toLowerCase()) {
        //case '/':
        //    if (selGenreId && selParentGenreId && selGenreName) {
        //        loadStationsByGenre(selGenreName, selGenreId, selGenreName);
        //    }
        //    else {
        //        loadTopStations();
        //    }
        //    break;
        case '/scradioinwinamp/search':
        case '/search':
            if (parameters)
                searchStations(parameters.query);
            break;

        case '/search/advancedsearch':
            if (parameters) {
                $('#as-genre').val(parameters.genre);
                $('#as-station').val(parameters.station);
                $('#as-type').val(parameters.type);
                $('#as-artist').val(parameters.artist);
                $('#as-song').val(parameters.song);

                searchStationsAdvanced(parameters.genre, parameters.station, parameters.type, parameters.artist, parameters.song);
            }
            break;

        case '/partners':
            reorderPans();
            break;

        case '/account/lostpassword':
            loadRecaptcha();
            break;
    }
}

function supportsHistoryApi() {
    return !!(window.history && history.pushState);
}

var currentPage = '/';
function setCurrentUrl(url, addToHistory, historyData) {
    console.log("function setCurrentUrl");
    var urlList = url.split('#');

    currentPage = urlList[0].split('?')[0].toLowerCase();

    // Scroll to section if there is one
    if (urlList.length > 1) {
        scrollToElement('#' + urlList[1]);
        //var headerOffset = isMobile() ? 0 : $('.header').height();
        //$('html, body').animate({
        //    scrollTop: $('#' + urlList[1]).offset().top - headerOffset
        //});
    }

    if (!supportsHistoryApi())
        return;

    if (addToHistory || typeof addToHistory === 'undefined') {
        history.pushState({
            page: url,
            data: historyData
        }, null, url);
    }
}

function checkAnchor(url) {
    console.log("function anchor", url);
    if (url.indexOf('#') == -1) {
        window.scrollTo(0, 0);
    }
}
function refreshGenreTitle() {
    $("#genre-sep").hide();
    $("#parent-genre").html($("#genre-colonne li.main-genre.current span a").html());

    var subgenreName = $("#genre-colonne li.main-genre.current ul li.current a").html();
    if (subgenreName && subgenreName != "") {
        $("#subgenre").html($("#genre-colonne li.main-genre.current ul li.current a").html());
        $("#genre-sep").show()
    }
}

function refreshGenreListState(genrename, genreid, parentid, processExpension) {

    var subNav = $("#genre-colonne ul li")
    subNav.removeClass('current');
    $('#genre-' + genreid).addClass('current');
    if (parentid != 0) {
        $("#genre-sep").show();
        $('#genre-' + parentid).addClass('current');
        //$('#ugenre-' + parentid).addClass('active');
    }
    else {
        $("#genre-sep").hide();
        $("#subgenre").html("");
        if (processExpension) {
            $("li.main-genre[id!=" + genreid + "] ul").slideUp(100, refreshPlaylistHeight);
            $("li#genre-" + genreid + " ul").slideDown(100, refreshPlaylistHeight);
        }
    }
}
function refreshPlaylistHeight() {
    var genreColumn = $("div#genre-colonne");
    var minHeight = parseInt(genreColumn.css("padding-top")) + parseInt(genreColumn.css("padding-bottom")) +
          genreColumn.find("div.genre-wrapper").height();
    $("div#playlist").css("min-height", minHeight + "px");
}

function loadStationsByGenre(genrename, genreid, parentid) {
    if (typeof genreid !== 'undefined' && typeof parentid !== 'undefined') {

        refreshGenreListState(genrename, genreid, parentid, true)
        refreshGenreTitle();
    }

    $.post('/Home/BrowseByGenre',
    { genrename: genrename },
    function (data) {
        if (data) {
            stations = data;
            if (parentid != 0) {
                $('body, html').animate({
                    scrollTop: 0
                }, 100);
            }
            $('#nb-result').text(genrename).text() + ': ' + stations.length + ' result(s)';
            //if (isHeaderClosed() || inWinamp) {
            //    $('#genre-title, #result-search').show();
            //    $('#no-result').hide();
            //}
            if (stations.length == 0) {
                $("#no-result").show();
                $("#station-list").hide();
            }
            else {
                $("#no-result").hide();
                $("#station-list").show();
            }

            sortStations();
            refreshPlaylistHeight();
            refreshPlayingStreamButtonState();
        }
    }
  );
    return false;
}

function replaceContentPage(content) {
    var pageContent = $(content);

    /* Page Title */
    $('title').html(pageContent.closest('title').html());
    /* Top Menu */
    var contentTopMenu = pageContent.find("#topMenu");
    if (contentTopMenu.length > 0)
        $('header nav#topMenu').html(contentTopMenu.html());
    else
        $('header nav#topMenu li').removeClass("current");

    /* Main */
    $("main").animate({ opacity: 0 }, 100, function () {
        $('main').html(pageContent.closest('main').html());
        $("main").animate({ opacity: 1 }, 100);
        $("div.pageScripts").html(pageContent.closest("div.pageScripts").html());
    })
}

function writeInConsole(text, clear) {
    if (typeof console !== 'undefined') {
        if (clear)
            console.clear();
        console.log(text);
    }
}

function wr(text, clear) {
    writeInConsole(text, clear);
}


function loadTopStations() {
    $("#parent-genre").html("Top Stations");
    $.post('/Home/Top', function (data) {
        if (data) {
            stations = data;
            if (stations.length == 0) {
                $("#no-result").show();
                $("#station-list").hide();
            }
            else {
                $("#no-result").hide();
                $("#station-list").show();
            }
            sortStations();
            refreshPlayingStreamButtonState();
        }
    });
}

/* PLAYER */
var stream;
function initializePlayer() {

    if (isChromeAndroidBrowser()) {
        audioPlayer = document.createElement('audio');
        audioPlayer.setAttribute('preload', 'none');
    }
    else {
        $('#jplayer').jPlayer({
            error: function (event) {
                console.log(event);
                stream.isPlaying = false;
                refreshPlayingStreamButtonState();
            },
            solution: 'html,flash',
            swfPath: '/js/jQuery.jPlayer.2.9.2',
            supplied: 'mp3,m4a,M3UA,FLA,WEBMA,WAV,OGA',
            preload: 'none',
            wmode: 'window',
            keyEnabled: true,
            volume: playerVolume,
            ready: function () {

            },
            //play: function () { alert("Play"); },
            //pause: function () { alert("Pause"); },
            //loadstart: function () { alert("Load Start");/*writeInConsole("Player loadstart");*/ },
            //waiting: function () { alert("Waiting");/*writeInConsole("Player waiting");*/ },
            //ended: function () { alert("Ended");},
            flashreset: function () { /*writeInConsole("Player reset");*/ },
            error: function (e) {
                console.log(e);
                //if (streamingTrack || (stream && stream.isPlaying == true))
                //{
                //    $('#jplayer').jPlayer("setMedia", { mp3: stream.mp3 }).jPlayer("play");
                //}
                //else {
                    alert("Unable to play the radio station stream.");
                //}
            }
        });
    }
}
function startPlay(stationIndex) {
    console.log(startPlay, stationIndex);
    var station = stations[stationIndex];
    var playerContainer = $("#player");
    if (station) {
        streamingTrack = true;
        playerContainer.slideDown(100, function () {
            $("footer").css("margin-bottom", playerContainer.height() + "px");
        });
        startPlayStation(station);
    }
    return false;
}

function startPlayStation(station) {
    //var url = null;
    //stream = {};
    getStreamUrl(station, function (url) {
        if (url) {

            console.log(url);
            var streamStopped = false;

            if (stream != null) {
                if ((stream.ID == station.ID) && stream.isPlaying) {
                    stopStream();
                    streamStopped = true;
                }
                //else $('tr#' + stream.ID + " td.play").removeClass('stop');
                $('tr#' + stream.ID + " td.play").removeClass('stop');
            }

            var aac = station.AACEnabled && station.Format == 'audio/aacp';

            stream = station;
            stream.mp3 = aac ? url + '&type=.flv' : url;
            //if (!streamStopped) {
            //    playStream();
            //}

            //updatePlayerText();
        }

    });

    interval = setInterval(function () {
        try {
            if (stream != null && stream.mp3) {
                clearInterval(interval);
                playStream();
                updatePlayerText();
            }
        } catch (e) {
            //alert(JSON.stringify(e));
        }

    }, 200);


}

function getStreamUrl(station, callback) {
    $.post('/Player/GetStreamUrl', { station: station.ID }, function (data) {
        if (data) {
            callback(data);
        }
        else {
            callback();
        }
    });
}

function togglePlay() {
    if (stream == null) return;
    if (stream.isPlaying) {
        stopStream();
        refreshPlayingStreamButtonState();
    }
    else {
        playStream();
        refreshPlayingStreamButtonState();
    }
}

function playStream() {
    if (stream == null) {
        return;
    }
    var btn = $('#player-play-btn');
    btn.addClass('p-stop');

    stream.isPlaying = true;

    try {
        //audioPlayer.setAttribute('src', stream.mp3);
        //audioPlayer.play();

        if (isChromeAndroidBrowser()) {
            try {
                audioPlayer.autoplay = true;
                audioPlayer.setAttribute('src', stream.mp3);
                audioPlayer.play();
            } catch (e) {
                //alert(e);
            }
        }
        else {
            $('#jplayer').jPlayer('setMedia', stream).jPlayer('play');
        }
    } catch (e) {
        //alert(JSON.stringify(e));
    }

    refreshPlayingStreamButtonState();

    if (currentTrackTimer != null) {
        clearTimeout(currentTrackTimer);
    }

    currentTrackTimer = setTimeout(getCurrentTrack, 5000);

}
function refreshPlayingStreamButtonState() {
    if (stream != null) {
        if (stream.isPlaying) {
            $('tr#' + stream.ID + " td.play").addClass('stop');
        }
        else {
            $('tr#' + stream.ID + " td.play").removeClass('stop');
        }
    }
}

function setPlayerVolume(volume, updateCookieData) {
    $("#amount").val(volume);
    $('#sound-wrapper .sound-bar #slider').slider('value', volume);

    if (isChromeAndroidBrowser()) {
        audioPlayer.volume = volume / 100;
    }
    else {
        $("#jplayer").jPlayer("volume", volume / 100);
    }

    if (updateCookieData) {
        updateCookieDataDelayed();
    }
}

function setPlayerMuted(muted, updateCookieData) {
    var slider = $('#slider');
    var icon = $('.sound-off i');
    var handle = $('.ui-slider-handle');
    var range = $('.ui-slider-range');

    if (muted) {
        icon.removeClass('fa-volume-down').addClass('fa-volume-off');
        slider.slider('option', 'disabled', true);
        handle.addClass('mute');
        range.addClass('mute');

        if (isChromeAndroidBrowser()) {
            audioPlayer.muted = true;
        }
        else {
            $('#jplayer').jPlayer("mute", true);
        }
    } else {
        icon.removeClass('fa-volume-off').addClass('fa-volume-down');
        slider.slider('option', 'disabled', false);
        handle.removeClass('mute');
        range.removeClass('mute');

        if (isChromeAndroidBrowser()) {
            audioPlayer.muted = false;
        }
        else {
            $('#jplayer').jPlayer('mute', false);
        }
    }

    if (updateCookieData) {
        updateCookieDataDelayed();
    }
}
function stopStream() {
    if (interval)
        clearInterval(interval);
    var playerContainer = $("#player");
    var btn = playerContainer.find('#player-play-btn');

    stream.isPlaying = false;

    if (isChromeAndroidBrowser()) {
        audioPlayer.pause();
        if (audioPlayer.duration) audioPlayer.currentTime = 0;
        audioPlayer.src = '';
    }
    else {
        $('#jplayer').jPlayer('stop');
    }

    btn.removeClass('p-stop');

    refreshPlayingStreamButtonState();

    playerContainer.slideUp();

}
function processStationAction(lnk, index) {
    console.log(processStationAction, lnk);
    try {
        var radName = $(this).parents("tr").find("td.radio-name a").html();
        var radId = $(this).parents("tr").attr("id");
        ga('send',
            {
                hitType: 'event',
                eventCategory: 'play',
                eventAction: radId,
                eventLabel: radId + "|" + radName
            });
    } catch (e) {

    }


    if (lnk.hasClass("stop")) {
        stopStream();
    }
    else {
        startPlay(index);
    }
}
function updatePlayerText() {
    if (stream == null)
        return;

    $('#nowplaying-station').text(stream.Name);
    if (stream.CurrentTrack != null)
        $('#nowplaying-song').text(stream.CurrentTrack);
}
function getCurrentTrack() {
    if (stream == null)
        return;

    if (currentTrackTimer != null) {
        clearTimeout(currentTrackTimer);
    }

    $.post('/Player/GetCurrentTrack',
    { stationID: stream.ID },
    function (trackData) {
        if (trackData) {
            if (stream != null && stream.ID == trackData.Station.ID) {
                stream.CurrentTrack = trackData.Station.CurrentTrack;
                updatePlayerText();

                currentTrackTimer = setTimeout(getCurrentTrack, trackData.CallbackDelay);
            }
        }
    }
  );
}
/* End PLayer */

// #region cookies
function updateCookieData() {
    if (!hasCookieData)
        return;

    var volume, muted;

    if (isChromeAndroidBrowser()) {
        volume = audioPlayer.volume * 100;
        muted = audioPlayer.muted;
    }
    else {
        var playerOptions = $("#jplayer").jPlayer('option');
        volume = parseInt(playerOptions.volume * 100);
        muted = playerOptions.muted;
    }

    $.post('/Home/UpdateCookieData', {
        volume: volume,
        muted: muted,
        sorting: currentSorting,
        sortingType: currentSortingType,
    });
}

function loadCookie() {
    $.post('/Home/HasCookieData', function (data) {
        if (typeof data != 'undefined') {
            if (!data.hasCookieData) {
                $('#cookies').show();
            } else {
                hasCookieData = true;

                setPlayerVolume(data.volume, false);
                setPlayerMuted(data.muted, false);

                sortStations(data.sorting, data.sortingType);
            }
        }
    });
}

function updateCookieDataDelayed() {
    if (sessionVolumeTimer)
        clearTimeout(sessionVolumeTimer);

    sessionVolumeTimer = setTimeout(updateCookieData, 3000);
}
// #endregion

// FORMS

function partnerRequestBegin() {
    var statusContainer = $('#send-status');
    statusContainer.html("");
    $("#submit-partners").attr("disabled", "disabled").hide();
}

function partnerRequestError(data) {
    var statusContainer = $('#send-status');
    statusContainer.html('<i class="fa fa-times"></i> An error occured while transfering the Partner Request');
    statusContainer.css('color', '#c0392b');
    statusContainer.show();
}

function submitCDNRequest(form) {
    $.post(form.attr("action"), form.serialize(), cdnContactRequestCallback)
    .error(partnerRequestError)
    return false;
}

function submitPartnerRequest(form) {
    $.post(form.attr("action"), form.serialize(), cdnContactRequestCallback)
    .error(partnerRequestError)
    return false;
}

function cdnContactRequestCallback(data) {
    var statusContainer = $('#send-status');
    if (data) {
        if (data.Success) {
            statusContainer.html('<i class="fa fa-check-circle-o"></i> Your contact request has been sent!');
            statusContainer.css('color', '#27ae60');
        }
        else {
            statusContainer.html("");
            if (data.Error)
                statusContainer.html('<i class="fa fa-times"></i> ' + data.Error);
            for (var i = 0; data.Errors && i < data.Errors.length; i++) {
                statusContainer.append(data.Errors[i] + '<br/>');
            }

            statusContainer.css('color', '#c0392b');
        }
        statusContainer.show();
    }
}
function partnerRequestCallback(data) {
    var statusContainer = $('#send-status');
    if (data) {
        if (data.Success) {
            statusContainer.html('<i class="fa fa-check-circle-o"></i> Your email has been sent!');
            statusContainer.css('color', '#27ae60');
        }
        else {
            statusContainer.html("");
            if (data.Error)
                statusContainer.html('<i class="fa fa-times"></i> ' + data.Error);
            for (var i = 0; data.Errors && i < data.Errors.length; i++) {
                statusContainer.append(data.Errors[i] + '<br/>');
            }

            statusContainer.css('color', '#c0392b');
        }

        statusContainer.show();
    }
}
function isHomePage() {
    return currentPage == '/' || currentPage.startsWith('/home');
}

function getStats() {
    if (!isHomePage())
        return;

    $.post('/Home/GetStats', function (data) {
        if (data) {
            if (stats == null) {
                stats = data;

                //slideContent();
                //setInterval(slideContent, sliderContentInterval);
            }
            else stats = data;
            $("#listeners-count").html(data.TotalListeners);
            $("#radio-count").html(data.TotalStations);

        }
    });
}

function slideContent() {
    sliderContentIndex++;

    if (sliderContentIndex >= sliderContent.length)
        sliderContentIndex = 0;

    var text = sliderContent[sliderContentIndex];
    switch (sliderContentIndex) {
        case 0:
            text = text.format(stats.TotalStations);
            break;

        case 1:
            text = text.format(stats.TotalListeners);
            break;
    }

    var target = $('#slide-text');
    target.fadeOut(2000, function () {
        target.html(text);

        target.fadeIn(2000);
    });
}
// SEARCH


function searchStations(query) {
    $("#search-term").html(query);
    $("#searching-result").hide();
    $.post('/Search/UpdateSearch',
    { query: query },
    function (data) {
        $("#search-failure").hide();
        if (data) {
            stations = data;
            $("#search-term").html(query);
            $("#search-status").html(" : " + stations.length + ' result(s)');
            if (stations.length > 0) {
                $('#result-search').show();
                $('#no-result').hide();
                addRow(stationsPerScroll);
            }
            else {
                $('#result-search').hide();
                $('#no-result').show();
            }
            sortStations();
        }
        else {
            $("#search-failure").show();
            $("#no-result").hide();
        }
    }
  );
}
function advancedSearchBegin(form) {
    $("#station-list").hide();
    $("#search-status").html(" : searching ... ");
    $("#searching-result").show();
    $("#search-failure").hide();
    $("#no-result").hide();

    $.post(form.attr("action"), form.serialize(), advancedSearchReceived).error(advancedSearchFailure);
    return false;
}
function advancedSearchFailure() {
    $("#search-status").html("");
    $("#searching-result").hide();
    $("#search-failure").show();
}

function advancedSearchReceived(data) {
    $("#searching-result").hide();
    if (data) {
        $("#search-failure").hide();
        stations = data;

        $("#search-status").html(" : " + stations.length + ' result(s)');

        if (stations.length > 0) {
            $('#result-search').show();
            $('#no-result').hide();

            addRow(stationsPerScroll);
        }
        else {
            $('#result-search').hide();
            $('#no-result').show();
        }

        sortStations();
    }
    else {
        $("#search-failure").show();
        $("#no-result").hide();
    }
}
function searchStationsAdvanced(genre, station, type, artist, song) {
    if (!genre && !station && !type && !artist && !song)
        return;

    $('#nb-result').html('Searching...');

    $.post('/Search/UpdateAdvancedSearch',
    { genre: genre, station: station, type: type, artist: artist, song: song },
    function (data) {
        if (data) {
            stations = data;

            if (stations.length > 0) {
                $('#nb-result').html(stations.length + ' result(s)');

                $('#result-search').show();
                $('#no-result').hide();

                addRow(stationsPerScroll);
            }
            else {
                $('#result-search').hide();
                $('#no-result').show();
            }

            sortStations();
        }
    });
    return false;
}

function isChromeBrowser() {
    var isChromium = window.chrome,
  winNav = window.navigator,
  vendorName = winNav.vendor,
  isOpera = winNav.userAgent.indexOf("OPR") > -1,
  isIEedge = winNav.userAgent.indexOf("Edge") > -1;

    return isChromium !== null && isChromium !== undefined && vendorName === "Google Inc." && isOpera == false && isIEedge == false;
}
