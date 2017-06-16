





function ConvertableDate() {
    this._init();
};

ConvertableDate.prototype = {

    _init: function() {
        this.date = new Date();
    },

    get_date: function() {
        return this.date;
    },

    get_year: function() {
        return this.date.getFullYear();
    },

    get_month: function() {
        return this.date.getMonth();
    },

    get_day: function() {
        return this.date.getDate();
    },

    get_day: function() {
        return this.date.getDate();
    },

    get_hour: function() {
        return this.date.getHours();
    },

    get_minute: function() {
        return this.date.getMinutes();
    },

    get_second: function() {
        return this.date.getSeconds();
    },

    get_millisecond: function() {
        return this.date.getMilliseconds();
    },

    set_date: function(date) {
        let year = date.getFullYear();
        let month = date.getMonth();
        let day = date.getDate();
        let hours = date.getHours();
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();
        let milliseconds = date.getMilliseconds();
        this.date = new Date(year, month, day, hours, minutes, seconds, milliseconds);
    },

    set_year: function(year) {
        this.date.setFullYear(year);
    },

    set_month: function(month) {
        this.date.setMonth(month);
    },

    set_day: function(day) {
        this.date.setDate(day);
    },

    set_hour: function(hour) {
        this.date.setHours(hour);
    },

    set_minute: function(minute) {
        this.date.setMinutes(minute);
    },

    set_second: function(second) {
        this.date.setSeconds(second);
    },

    set_millisecond: function(millisecond) {
        this.date.setMilliseconds(millisecond);
    },

    add_minutes: function(minutes) {
        this.date.setMinutes(this.date.getMinutes() + minutes);
    },

    add_hours: function(hours) {
        this.date.setHours(this.date.getHours() + hours);
    },

    add_days: function(days) {
        this.date.setDate(this.date.getDate() + days);
    },

    to_year_month_day_int: function() {
        return parseInt(this.to_year_month_day_string(""));
    },

    to_year_month_day_string: function(separator) {
        let year = this.date.getFullYear().toString();
        let month = this._prepend_zero_if_single_digit((this.date.getMonth() + 1).toString());
        let day = this._prepend_zero_if_single_digit(this.date.getDate().toString());
        return year + separator + month + separator + day;
    },

    to_hour_minute_second_string: function(separator) {
        let hour = this._prepend_zero_if_single_digit(this.date.getHours().toString());
        let minute = this._prepend_zero_if_single_digit(this.date.getMinutes().toString());
        let second = this._prepend_zero_if_single_digit(this.date.getSeconds().toString());
        return hour + separator + minute + separator + second
    },

    to_year_month_day_hour_minute_second_string: function(separator) {
        let year = this.date.getFullYear().toString();
        let month = this._prepend_zero_if_single_digit((this.date.getMonth() + 1).toString());
        let day = this._prepend_zero_if_single_digit(this.date.getDate().toString());
        let hour = this._prepend_zero_if_single_digit(this.date.getHours().toString());
        let minute = this._prepend_zero_if_single_digit(this.date.getMinutes().toString());
        let second = this._prepend_zero_if_single_digit(this.date.getSeconds().toString());
        return year + separator + month + separator + day + separator + hour + separator + minute + separator + second;
    },

    _prepend_zero_if_single_digit: function(number_string) {
        return number_string.length == 1 ? "0" + number_string : number_string;
    },

    to_time_left_day_string: function() {
        let now = new Date();
        let difference_milliseconds = this.date - now;
        let difference_days = this.milliseconds_to_days(difference_milliseconds);
        return difference_days > 1 ? this.to_time_left_more_day() :
                                     this.to_time_left_less_day(difference_milliseconds);
    },

    milliseconds_to_days: function(milliseconds) {
        return milliseconds / 1000 / 60 / 60 / 24;
    },

    to_time_left_more_day: function() {
        return "more than a day";
    },

    to_time_left_less_day: function(difference_milliseconds) {
        let difference_seconds = difference_milliseconds / 1000;
        let difference_minutes = difference_seconds / 60;
        let difference_hours = difference_minutes / 60;
        let hours = difference_hours;
        let minutes = difference_minutes % 60;
        let seconds = difference_seconds % 60;

        let string = difference_hours > 1 ?
                     this.get_time_left_hours(hours) + " " + this.get_time_left_minutes(minutes) :
                     this.get_time_left_minutes(minutes) + " " + this.get_time_left_seconds(seconds);
        return string.trim();
    },

    get_time_left_hours: function(hours) {
        return this.get_time_left_unit(hours, "hour");
    },

    get_time_left_unit: function(left, unit) {
        left = Math.floor(left);
        if(left > 0) {
            return left == 1 ? left + " " + unit : left + " " + unit + "s";
        }
        return "";
    },

    get_time_left_minutes: function(minutes) {
        return this.get_time_left_unit(minutes, "minute");
    },

    get_time_left_seconds: function(seconds) {
        return this.get_time_left_unit(seconds, "second");
    },

    is_earlier: function(convertable_date) {
        return this.date < convertable_date.get_date();
    },

    is_earlier_or_equal: function(convertable_date) {
        return this.date <= convertable_date.get_date();
    },

    is_later: function(convertable_date) {
        return this.date > convertable_date.get_date();
    },

    is_later_or_equal: function(convertable_date) {
        return this.date >= convertable_date.get_date();
    },

    get_deep_copy: function() {
        let date = new ConvertableDate();
        date.set_date(this.date);
         return date;
    },

    toString: function() {
         return date.toString();
    },

};




