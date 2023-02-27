var stationsPerScroll = 50;

var maxStations = 200;

var stations = [];
var stationIndex = 0;

var currentSorting = 'listeners';
var currentSortingType = 'desc';

$(function () {
    $(window).click(function () {
        if ($('.dl-table :hover').length == 0)
            hideLinks();
    });
    $("body").delegate("a.pls, a.m3u, a.xspf", "click", function () {
        var radName = $(this).parents("tr").find("td.radio-name a").html();
        var radId = $(this).parents("tr").attr("id");
        ga('send',
            {
                hitType: 'event',
                eventCategory: 'download',
                eventAction: $(this).attr("action"),
                eventLabel: radId + "|" + radName,
            });
    });

});

function initializeStationListTable() {
    $(window).scroll(function () {
        if ($(document).height() - 50 <= $(window).scrollTop() + $(window).height()) {
            addRow(stationsPerScroll)
        }
    });

    $('#station-list thead th').click(function () {
        var header = $(this).text().trim().toLowerCase();

        $('#station-list thead th i.fa').removeClass("fa-angle-up").removeClass("fa-angle-down").addClass("fa-angle-up");

        if (currentSortingType == "desc") {
            $(this).find("i").addClass("fa-angle-down");
        }

        sortStations(header, currentSortingType == 'asc' ? 'desc' : 'asc');

        updateCookieDataDelayed();
    });

    if (inWinamp) {
        $('#station-list thead th').eq(0).hide();
    }

    sortStations();
}

function sortStations(sort, sortType) {
    if (typeof sort === 'undefined') {
        sort = currentSorting;
    }

    if (typeof sortType === 'undefined') {
        sortType = currentSortingType;
    }

    $('#station-list .' + sort).find('i').removeClass();

    if (sort == 'genre') stations.sort(sortByGenre);
    else if (sort == 'listeners') stations.sort(sortByListeners);
    else if (sort == 'bitrate') stations.sort(sortByBitrate);
    else if (sort == 'type') stations.sort(sortByFormat);
    else stations.sort(sortByStationName);

    currentSorting = sort;
    currentSortingType = sortType;

    if (sortType == 'desc') {
        stations.reverse();
    }

    clearTable();

    var btn = $('#station-list .' + sort).find('i');
    btn.removeClass();
    btn.addClass('fa ' + (sortType == 'desc' ? 'fa-angle-down' : 'fa-angle-up'));
    btn.css('color', inWinamp ? '#b3dcf0' : '#42a4bd');
    //btn.css('visibility', 'visible');
    if (stations.length > 0)
        addRow(stationsPerScroll);
}

function showLinks(stationID) {
    var tooltip = $('#dl-' + stationID);
    var hasClass = tooltip.hasClass('active');

    $('#station-list span').removeClass('active');
    $('.dl-table').removeClass('active');

    if (!hasClass) {
        tooltip.addClass('active');
        tooltip.parent().children('a').addClass('active');
    }
    else {
        tooltip.parent().children('a').removeClass('active');
    }
}

function hideLinks() {
    $('#station-list span').removeClass('active');
    $('.dl-table').removeClass('active');
}

function clearTable() {
    $('#station-list tbody').html('');

    $('#station-list thead th i').css('color', inWinamp ? 'white' : 'black');
    //$('#station-list thead th i').css('visibility', 'hidden');
    stationIndex = 0;
}

function addRow(n) {
    if (stationIndex > maxStations)
        return;

    var table = $('#station-list')
    var tbody = table.find('tbody');

    var i;
    for (var i = 0; i < n && i + stationIndex < stations.length; i++) {
        if (i == 0)
            table.show();

        var station = stations[i + stationIndex];
        station.Index = i + stationIndex;

        tbody.append(rowTemplate(station));
    }

    stationIndex += i;
}

function rowTemplate(station) {
    var format = station.Format.toLowerCase() == 'audio/mpeg' ? 'MP3' : 'AAC';
    var tunein = 'http://yp.shoutcast.com/sbin/tunein-station.{0}?id=' + station.ID;
    var scradioinwinamp = currentPage == '/scradioinwinamp';

    var rowTr = $("<div></div>");
    rowTr.append("<tr>" +
                    "<td class='play'><a href='#' ><i class='fa fa-play'></i></a></td>" +
                    "<td class='down'>" +
                        "<a href='#' class='trigger'>Download</a>" +
                        "<div id='dl-" + station.ID + "' class='tooltips-item'>" +
                            "<a class='pls' action='pls' href='" + tunein.format("pls") + "' target='_blank'>Winamp (.pls)</a>" +
                            "<a class='m3u' action='m3u' href='" + tunein.format('m3u') + "' target='_blank'>Any player (.m3u)</a>" +
                            "<a class='xspf' action='xspf' href='" + tunein.format('xspf') + "' target='_blank'>Open Format (.XSPF)</a>" +
                        "</div>" +
                    "</td>" +
                    "<td class='radio-name'></td>" +
                    "<td class='genre' ></td>" +
                    "<td class='listeners'></td>" +
                    "<td class='bitrate'></td>" +
                    "<td class='encode'></td></tr>");
    rowTr.find("tr").attr("id", station.ID);
    rowTr.find("td.down span").attr("id", "dl-" + station.ID);
    rowTr.find("td.radio-name").html("<a href='#'>" + station.Name + "</a>");
    rowTr.find("td.genre").html("<a href='#' onclick='return loadStationsByGenre(\"" + station.Genre + "\")'>" + station.Genre + "</a>");
    rowTr.find("td.listeners").html(station.Listeners);
    rowTr.find("td.bitrate").html(station.Bitrate);
    rowTr.find("td.encode").html(format);
    var aPlay = rowTr.find("td.play a");

    if (inWinamp) {
        aPlay.attr("href", tunein.format("pls"));
    }
    else {
        if (format == 'MP3' || isChromeBrowser()) {
            aPlay.attr("onclick", "processStationAction($(this), " + station.Index + ");return false;");
        }
        else {
            rowTr.find("td.play").addClass("disabled");
            rowTr.find("td.play a")
                .attr("onclick", "return false;")
                .attr("data-tooltip", "Please use download link to play AAC streams.");
        }
    }
    return rowTr.html();
    //('<tr id=' + station.ID + '>' +
    //    (inWinamp ? '' : '<td class="table-icon"><a href="{0}" class="play-btn play-table {7}" {1}><i class="fa fa-play"></i></a></td>') +
    //    '<td class="table-icon">' +
    //    '<a href="' + tunein.format('pls') + '" onclick="' + (inWinamp ? '' : 'showLinks(' + station.ID + '); return false;') + '" class="dl-btn dl-table tooltips"><i class="fa ' + (inWinamp ? 'fa-play' : 'fa-download') + '"></i></a>' +
    //        '<span id="dl-' + station.ID + '" class="tooltips-item" >' +
    //            '<a href="' + tunein.format('pls') + '" target="_blank">Winamp</a>' +
    //            '<a href="' + tunein.format('m3u') + '" target="_blank">M3U</a>' +
    //            '<a href="' + tunein.format('xspf') + '" target="_blank">XSPF</a>' +
    //        '</span>' +
    //    '</td>' +
    //    '<td class="stations">{2}</td>' +
    //    '<td class="genre">{3}</td>' +
    //    '<td class="listeners">{4}</td>' +
    //    '<td class="bitrate">{5}</td>' +
    //    '<td class="type">{6}</td>' +
    //'</tr>').format(
    //    '#',
    //    format == 'MP3' ? ('onclick="startPlay(' + station.Index + '); return false;"') : 'onclick="return false;" data-tooltip="Please use download link to play AAC streams."',
    //    station.Name,
    //    station.Genre,
    //    station.Listeners,
    //    station.Bitrate,
    //    format,
    //    format == 'MP3' ? '' : 'tooltip-bottom desable');

}

function sortByStationName(a, b) {
    if (a.Name.toLowerCase() < b.Name.toLowerCase()) return -1;
    else if (a.Name.toLowerCase() > b.Name.toLowerCase()) return 1;
    return 0;
}

function sortByGenre(a, b) {
    if (a.Genre.length == 0) return -1;
    if (b.Genre.length == 0) return 1;

    if (a.Genre[0].toLowerCase() < b.Genre[0].toLowerCase()) return -1;
    else if (a.Genre[0].toLowerCase() > b.Genre[0].toLowerCase()) return 1;
    return 0;
}

function sortByListeners(a, b) {
    return a.Listeners - b.Listeners;
}

function sortByBitrate(a, b) {
    return a.Bitrate - b.Bitrate;
}

function sortByFormat(a, b) {
    if (a.Format.toLowerCase() < b.Format.toLowerCase()) return -1;
    else if (a.Format.toLowerCase() > b.Format.toLowerCase()) return 1;
    return 0;
}

