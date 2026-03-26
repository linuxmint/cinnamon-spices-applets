
var DisplayMode = {
    SPEED: 0,
    DATA: 1
}

var Unit = {
    AUTO: 0,
    B: 1,
    KB: 2,
    MB: 3,
    GB: 4,
    TB: 5
}

var UnitType = {
    BYTES: 0,
    BITS: 1
}

var GuiSpeedType = {
    COMPACT: 0,
    LARGE: 1
}

var GuiValueOrder = {
    DOWNLOAD_FIRST: 0,
    UPLOAD_FIRST: 1
}

var GuiDataLimitType = {
    NONE: 0,
    CIRCLE: 1,
    TEXT: 2
}

var DecimalPlaces = {
    AUTO: -1,
    ZERO: 0,
    ONE: 1,
    TWO: 2,
    THREE: 3
}

var BytesStartTime = {
    START_OF_CURRENT_SESSION : -1,
    TODAY: 0,
    YESTERDAY : 1,
    THREE_DAYS_AGO : 3,
    FIVE_DAYS_AGO : 5,
    SEVEN_DAYS_AGO : 7,
    TEN_DAYS_AGO : 10,
    FOURTEEN_DAYS_AGO : 14,
    THIRTY_DAYS_AGO: 30,
    CUSTOM_DATE : -2
}

const SIZE_DEC = [1, 1e3, 1e6, 1e9, 1e12];
const SIZE_BIN = [1, 1024, 1024**2, 1024**3, 1024**4];
const BYTE_UNITS_DEC = ["  B", " kB", " MB", " GB", " TB"];
const BYTE_UNITS_BIN = ["   B", " kiB", " MiB", " GiB", " TiB"];
const BIT_UNITS_DEC  = ["  b", " kb", " Mb", " Gb", " Tb"];
const BIT_UNITS_BIN  = ["   b", " kib", " Mib", " Gib", " Tib"];

