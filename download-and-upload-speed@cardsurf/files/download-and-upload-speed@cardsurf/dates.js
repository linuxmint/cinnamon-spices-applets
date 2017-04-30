





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

    to_year_month_day_hour_second_string: function(separator) {
        let year = this.date.getFullYear().toString();
        let month = this._prepend_zero_if_single_digit((this.date.getMonth() + 1).toString());
        let day = this._prepend_zero_if_single_digit(this.date.getDate().toString());
        let hour = this._prepend_zero_if_single_digit(this.date.getHours().toString());
        let second = this._prepend_zero_if_single_digit(this.date.getSeconds().toString());
        return year + separator + month + separator + day + separator + hour + separator + second;
    },

    _prepend_zero_if_single_digit: function(number_string) {
        return number_string.length == 1 ? "0" + number_string : number_string;
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




