

function CssStyle() {
    this._init();
};

CssStyle.prototype = {

    _init: function() {
        this.attributes = {}
    },

    add_or_modify_from_string: function(css_string) {
        let attributes = css_string.split(';');
        this.add_or_modify_from_list(attributes);
    },

    add_or_modify_from_list: function(attributes) {
        for (var i = 0; i < attributes.length; i++) {
            let attribute = attributes[i];
            let [attribute_name, attribute_value] = this._get_name_and_value(attribute);
            this.set_value(attribute_name, attribute_value);
        }
    },

    _get_name_and_value: function(attribute) {
        attribute = this._remove_whitespaces(attribute);
        attribute = attribute.split(':');
        let attribute_name = attribute[0];
        let attribute_value = attribute[1];
        return [attribute_name, attribute_value];
    },

    _remove_whitespaces: function(string) {
        return string.replace(/\s/g, '');
    },

    set_value: function(attribute_name, attribute_value) {
        if(attribute_value !== undefined) {
           this.attributes[attribute_name] = attribute_value;
        }
    },

    get_value_or_null: function(attribute_name) {
        attribute_name = this._remove_whitespaces(attribute_name);
        let attribute_value = this.attributes[attribute_name];
        return attribute_value === undefined ? null : attribute_value;
    },

    get_numeric_value_or_null: function(attribute_name) {
        let attribute_value = this.get_value_or_null(attribute_name);
        return attribute_value == null ? null : parseFloat(attribute_value);
    },

};






function CssConverter() {
    this._init();
};

CssConverter.prototype = {

    _init: function() {
    },

    convert_to_object: function(css_string) {
        let css_object = new CssStyle();
        css_object.add_or_modify_from_string(css_string);
        return css_object;
    },

    convert_to_string: function(css_object) {
        let css_string = "";

        for (let attribute_name in css_object.attributes) {
           let attribute_value = css_object.get_value_or_null(attribute_name);
           css_string += attribute_name + ":" + attribute_value + ";";
        }

        return css_string;
    },
};






function CssStringStyler() {
    this._init();
};

CssStringStyler.prototype = {

    _init: function() {
        this.converter = new CssConverter();
    },

    set_attributes: function(css_string, attributes) {
        let css_object = this.converter.convert_to_object(css_string);
        css_object.add_or_modify_from_list(attributes);
        css_string = this.converter.convert_to_string(css_object);
        return css_string;
    },

    get_value_or_null: function(css_string, attribute_name) {
        let css_object = this.converter.convert_to_object(css_string);
        let attribute_value = css_object.get_value_or_null(attribute_name);
        return attribute_value;
    },

    get_numeric_value_or_null: function(css_string, attribute_name) {
        let css_object = this.converter.convert_to_object(css_string);
        let attribute_value = css_object.get_numeric_value_or_null(attribute_name);
        return attribute_value;
    },

};




