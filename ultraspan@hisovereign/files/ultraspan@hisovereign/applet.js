#!/bin/bash
# ============================================
# Combined Single-Span Multi-Monitor Wallpaper Management System
# ============================================
# Version 2.8 - Added random rotation feature
# ============================================

set -e

# -----------------------------
# CONFIGURATION
# -----------------------------
CONFIG_DIR="$HOME/.config/ultraspan"
CONFIG_FILE="$CONFIG_DIR/config"
CACHE_DIR="$HOME/.cache/ultraspan"
STATE_FILE="$CONFIG_DIR/state"
RANDOM_FILE="$CONFIG_DIR/random"
LOCK_FILE="/tmp/ultraspan.lock"

# -----------------------------
# SINGLE-INSTANCE LOCK
# -----------------------------
exec 9>"$LOCK_FILE" || exit 1
if ! flock -n 9; then
    echo "❌ Another instance of ultraspan is already running." >&2
    exit 1
fi

# Ensure lock is released on script exit
cleanup_lock() {
    flock -u 9 2>/dev/null
    exec 9>&-
}
trap cleanup_lock EXIT

# Default settings
BLUR_AMOUNT=15
BG_COLOR="#000000"
BG_TYPE="blur"

# -----------------------------
# HELPER FUNCTIONS
# -----------------------------

show_help() {
    cat << 'EOF'
Ultraspan - Combined Single-Span Wallpaper Manager
================================================

COMMANDS:
  set IMAGE_PATH [MODE]      Set wallpaper with optional mode
  mode MODE                  Set default mode: zoom, fit, center
  bg-type [TYPE]            Set background type: blur, solid
  blur [0-100]              Set blur amount (default: 15)
  color [COLOR]             Set solid color (hex: #RRGGBB)
  random DIR [MODE]          Start random rotation from directory
  random-stop                Stop random rotation
  random-status              Show random rotation status
  interval MINUTES           Set random rotation interval (default: 30)
  list                      List recent wallpapers
  status                    Show current wallpaper and settings
  info IMAGE_PATH           Show image info and preview size
  restore                    Restore default system wallpaper
  clean                      Clear wallpaper cache
  help                       Show this help

MODES:
  zoom      - Crop and zoom to fill all monitors
  fit       - Fit image within space (with background)
  center    - Center image (with background)

BACKGROUND TYPES:
  blur      - Use blurred version of image as background
  solid     - Use solid color as background

EXAMPLES:
  ultraspan set ~/Pictures/wallpaper.jpg
  ultraspan set ~/Pictures/landscape.jpg fit
  ultraspan random ~/Pictures/Wallpapers zoom
  ultraspan interval 10
  ultraspan status
EOF
}

# Load config
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        while IFS='=' read -r key value; do
            case "$key" in
                "mode") MODE="$value" ;;
                "bg_type") BG_TYPE="$value" ;;
                "blur") BLUR_AMOUNT="$value" ;;
                "color") BG_COLOR="$value" ;;
            esac
        done < "$CONFIG_FILE"
    fi
}

# Get default mode
get_default_mode() {
    load_config
    echo "${MODE:-zoom}"
}

# Set wallpaper with specified mode
set_wallpaper() {
    local image="$1"
    local mode="${2:-zoom}"
    
    [ -f "$image" ] || { echo "❌ Error: File not found: $image"; exit 1; }
    
    echo "🎨 Setting wallpaper: $(basename "$image")"
    echo "📐 Mode: $mode"
    echo "🎨 Background: $BG_TYPE"
    if [ "$BG_TYPE" = "blur" ]; then
        echo "🎭 Blur amount: $BLUR_AMOUNT"
    else
        echo "🎨 Solid color: $BG_COLOR"
    fi
    
    # Get monitor layout
    XRANDR_OUT=$(xrandr --listmonitors 2>/dev/null) || { echo "❌ Error: Cannot get monitor information"; exit 1; }
    
    local MIN_X=99999 MIN_Y=99999 MAX_X=0 MAX_Y=0
    while IFS= read -r line; do
        if [[ $line =~ ([0-9]+:[[:space:]]+[\+\*]*)([A-Za-z0-9-]+)[[:space:]]+([0-9]+)\/[0-9]+x([0-9]+)\/[0-9]+\+([0-9]+)\+([0-9]+) ]]; then
            local W="${BASH_REMATCH[3]}" H="${BASH_REMATCH[4]}" X="${BASH_REMATCH[5]}" Y="${BASH_REMATCH[6]}"
            [ $X -lt $MIN_X ] && MIN_X=$X
            [ $Y -lt $MIN_Y ] && MIN_Y=$Y
            local X2=$((X + W))
            local Y2=$((Y + H))
            [ $X2 -gt $MAX_X ] && MAX_X=$X2
            [ $Y2 -gt $MAX_Y ] && MAX_Y=$Y2
        fi
    done <<< "$XRANDR_OUT"
    
    local TOTAL_WIDTH=$((MAX_X - MIN_X))
    local TOTAL_HEIGHT=$((MAX_Y - MIN_Y))
    
    [ $TOTAL_WIDTH -eq 0 ] || [ $TOTAL_HEIGHT -eq 0 ] && { echo "❌ Error: Could not determine monitor layout"; exit 1; }
    
    echo "🖥️  Monitor span: ${TOTAL_WIDTH}x${TOTAL_HEIGHT}"
    
    # Create cache directory
    mkdir -p "$CACHE_DIR"
    mkdir -p "$(dirname "$STATE_FILE")"
    
    # Generate cache filename with all settings
    local HASH
    HASH=$(sha1sum "$image" | cut -d' ' -f1)
    local CACHE_FILE="$CACHE_DIR/${HASH:0:12}-${mode}-${BG_TYPE}"
    if [ "$BG_TYPE" = "blur" ]; then
        CACHE_FILE="${CACHE_FILE}-blur${BLUR_AMOUNT}.jpg"
    else
        # Use color without # for filename
        local COLOR_CODE=${BG_COLOR//#/}
        CACHE_FILE="${CACHE_FILE}-${COLOR_CODE}.jpg"
    fi
    
    echo "⚙️  Processing image..."
    
    # Get image dimensions for info
    local img_width img_height
    img_width=$(identify -format "%w" "$image" 2>/dev/null || echo "0")
    img_height=$(identify -format "%h" "$image" 2>/dev/null || echo "0")
    
    echo "📐 Original image: ${img_width}x${img_height}"
    
    # Process based on mode
    case "$mode" in
        "zoom")
            # Zoom to fill (crops if necessary)
            convert "$image" \
                -resize "${TOTAL_WIDTH}x${TOTAL_HEIGHT}^" \
                -gravity center \
                -extent "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" \
                -quality 95 \
                "$CACHE_FILE"
            ;;
            
        "fit")
            # Fit image within area
            echo "  Creating fit mode..."
            
            if [ "$BG_TYPE" = "blur" ]; then
                # Blurred background
                convert "$image" \
                    \( -clone 0 -resize "${TOTAL_WIDTH}x${TOTAL_HEIGHT}^" -gravity center -extent "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" -blur "0x${BLUR_AMOUNT}" \) \
                    \( -clone 0 -resize "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" \) \
                    -delete 0 \
                    -gravity center \
                    -composite \
                    -quality 95 \
                    "$CACHE_FILE"
            else
                # Solid color background
                convert "$image" \
                    -resize "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" \
                    -background "$BG_COLOR" \
                    -gravity center \
                    -extent "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" \
                    -quality 95 \
                    "$CACHE_FILE"
            fi
            ;;
            
        "center")
            # Center image on background - SIMPLIFIED LOGIC
            echo "  Creating center mode..."
            
            if [ "$BG_TYPE" = "blur" ]; then
                # Create blurred background (zoomed to fill)
                convert "$image" \
                    -resize "${TOTAL_WIDTH}x${TOTAL_HEIGHT}^" \
                    -gravity center \
                    -extent "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" \
                    -blur "0x${BLUR_AMOUNT}" \
                    /tmp/ultraspan_blur_bg.jpg
                
                # Create centered image (max 80% of monitor)
                local fit_width fit_height
                if [ $img_width -gt $img_height ]; then
                    fit_width=$((TOTAL_WIDTH * 80 / 100))
                    fit_height=$((img_height * fit_width / img_width))
                else
                    fit_height=$((TOTAL_HEIGHT * 80 / 100))
                    fit_width=$((img_width * fit_height / img_height))
                fi
                
                [ $fit_width -gt $TOTAL_WIDTH ] && fit_width=$TOTAL_WIDTH
                [ $fit_height -gt $TOTAL_HEIGHT ] && fit_height=$TOTAL_HEIGHT
                
                echo "  Centered image size: ${fit_width}x${fit_height}"
                
                convert "$image" \
                    -resize "${fit_width}x${fit_height}" \
                    /tmp/ultraspan_center_fg.jpg
                
                # Composite centered image on blurred background
                convert /tmp/ultraspan_blur_bg.jpg \
                    /tmp/ultraspan_center_fg.jpg \
                    -gravity center \
                    -composite \
                    -quality 95 \
                    "$CACHE_FILE"
                
                # Cleanup
                rm -f /tmp/ultraspan_blur_bg.jpg /tmp/ultraspan_center_fg.jpg
                
            else
                # Solid color background - SIMPLE APPROACH
                # Create centered image (max 80% of monitor)
                local fit_width fit_height
                if [ $img_width -gt $img_height ]; then
                    fit_width=$((TOTAL_WIDTH * 80 / 100))
                    fit_height=$((img_height * fit_width / img_width))
                else
                    fit_height=$((TOTAL_HEIGHT * 80 / 100))
                    fit_width=$((img_width * fit_height / img_height))
                fi
                
                [ $fit_width -gt $TOTAL_WIDTH ] && fit_width=$TOTAL_WIDTH
                [ $fit_height -gt $TOTAL_HEIGHT ] && fit_height=$TOTAL_HEIGHT
                
                echo "  Centered image size: ${fit_width}x${fit_height}"
                
                # Simple version without temporary files
                convert "$image" \
                    -resize "${fit_width}x${fit_height}" \
                    -background "$BG_COLOR" \
                    -gravity center \
                    -extent "${TOTAL_WIDTH}x${TOTAL_HEIGHT}" \
                    -quality 95 \
                    "$CACHE_FILE"
            fi
            ;;
            
        *)
            echo "❌ Error: Unknown mode: $mode. Use: zoom, fit, center"
            exit 1
            ;;
    esac
    
    [ -f "$CACHE_FILE" ] || { echo "❌ Error: Image processing failed"; exit 1; }
    
    # Save state
    echo "$image" > "$STATE_FILE"
    echo "$mode" >> "$STATE_FILE"
    echo "$BG_TYPE" >> "$STATE_FILE"
    if [ "$BG_TYPE" = "blur" ]; then
        echo "$BLUR_AMOUNT" >> "$STATE_FILE"
    else
        echo "$BG_COLOR" >> "$STATE_FILE"
    fi
    echo "$(date '+%Y-%m-%d %H:%M:%S')" >> "$STATE_FILE"
    
    # Set wallpaper
    echo "🎯 Applying wallpaper..."
    gsettings set org.cinnamon.desktop.background picture-uri "file://$CACHE_FILE"
    gsettings set org.cinnamon.desktop.background picture-options "spanned"
    
    echo "✅ Wallpaper set successfully!"
}

# Random wallpaper functions
start_random_mode() {
    local directory="$1"
    local mode="${2:-zoom}"
    local interval="${RANDOM_INTERVAL:-30}"
    
    [ -d "$directory" ] || { echo "❌ Error: Directory not found: $directory"; exit 1; }
    
    # Get list of image files
    local images=()
    while IFS= read -r -d $'\0' file; do
        images+=("$file")
    done < <(find "$directory" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) -print0)
    
    [ ${#images[@]} -eq 0 ] && { echo "❌ Error: No image files found in $directory"; exit 1; }
    
    echo "📁 Found ${#images[@]} images in $directory"
    echo "⏰ Interval: $interval minutes"
    echo "📐 Mode: $mode"
    
    # Save random mode settings
    mkdir -p "$CONFIG_DIR"
    echo "directory=$directory" > "$RANDOM_FILE"
    echo "mode=$mode" >> "$RANDOM_FILE"
    echo "interval=$interval" >> "$RANDOM_FILE"
    echo "pid=$$" >> "$RANDOM_FILE"
    
    echo "🔄 Random rotation started. Press Ctrl+C to stop."
    
    # Function to pick random image
    pick_random_image() {
        local random_index=$((RANDOM % ${#images[@]}))
        echo "${images[$random_index]}"
    }
    
    # Set first wallpaper
    local first_image
    first_image=$(pick_random_image)
    echo "🎲 First random image: $(basename "$first_image")"
    set_wallpaper "$first_image" "$mode"
    
    # Continue in background
    (
        exec 9>&-
        while true; do
            sleep $((interval * 60))
            
            # Check if still running
            [ ! -f "$RANDOM_FILE" ] && exit 0
            
            # Pick new random image
            local new_image
            new_image=$(pick_random_image)
            echo "🔄 Rotating to: $(basename "$new_image")"
            set_wallpaper "$new_image" "$mode" 2>/dev/null || true
        done
    ) &
    
    echo $! >> "$RANDOM_FILE"
    disown
}

stop_random_mode() {
    if [ -f "$RANDOM_FILE" ]; then
        # Get PID from file (last line)
        local pid
        pid=$(tail -n1 "$RANDOM_FILE" 2>/dev/null)
        
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo "⏹️ Random rotation stopped"
        else
            echo "⚠️ Random rotation not running"
        fi
        
        rm -f "$RANDOM_FILE"
    else
        echo "⚠️ Random rotation not active"
    fi
}

show_random_status() {
    if [ -f "$RANDOM_FILE" ]; then
        echo "=== Random Rotation Status ==="
        echo ""
        
        # Read settings
        while IFS='=' read -r key value; do
            case "$key" in
                "directory") DIRECTORY="$value" ;;
                "mode") RANDOM_MODE="$value" ;;
                "interval") INTERVAL="$value" ;;
                "pid") PID="$value" ;;
            esac
        done < "$RANDOM_FILE"
        
        echo "📁 Directory: $DIRECTORY"
        echo "📐 Mode: $RANDOM_MODE"
        echo "⏰ Interval: $INTERVAL minutes"
        
        # Check if process is running
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            echo "🟢 Status: Running (PID: $PID)"
            
            # Count images
            local count
            count=$(find "$DIRECTORY" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" \) | wc -l)
            echo "📊 Images available: $count"
            
            # Next rotation time
            local next_time
            next_time=$(date -d "+$INTERVAL minutes" '+%H:%M')
            echo "⏱️ Next rotation: ~$next_time"
        else
            echo "🔴 Status: Not running (stale config)"
        fi
    else
        echo "ℹ️ Random rotation is not active"
    fi
}

set_interval() {
    local interval="$1"
    
    # Validate interval
    if [[ ! "$interval" =~ ^[0-9]+$ ]] || [ "$interval" -lt 1 ]; then
        echo "❌ Error: Interval must be a positive number (minutes)"
        exit 1
    fi
    
    # Update config
    RANDOM_INTERVAL="$interval"
    mkdir -p "$CONFIG_DIR"
    
    # Load existing config or create new
    if [ -f "$CONFIG_FILE" ]; then
        grep -v "^random_interval=" "$CONFIG_FILE" > /tmp/ultraspan_config.tmp
        mv /tmp/ultraspan_config.tmp "$CONFIG_FILE"
    fi
    
    echo "mode=${MODE:-zoom}" >> "$CONFIG_FILE"
    echo "bg_type=$BG_TYPE" >> "$CONFIG_FILE"
    if [ "$BG_TYPE" = "blur" ]; then
        echo "blur=$BLUR_AMOUNT" >> "$CONFIG_FILE"
    else
        echo "color=$BG_COLOR" >> "$CONFIG_FILE"
    fi
    echo "random_interval=$interval" >> "$CONFIG_FILE"
    
    echo "✅ Random rotation interval set to: $interval minutes"
    
    # Update running random mode if active
    if [ -f "$RANDOM_FILE" ]; then
    # Save directory and mode BEFORE stopping
    local random_dir random_mode
    while IFS='=' read -r key value; do
        case "$key" in
            "directory") random_dir="$value" ;;
            "mode") random_mode="$value" ;;
        esac
    done < "$RANDOM_FILE"
    
    echo "🔄 Updating running random rotation..."
    stop_random_mode
    
    # Restart with saved values
    if [ -n "$random_dir" ] && [ -d "$random_dir" ]; then
        start_random_mode "$random_dir" "$random_mode"
    fi
fi
}

# Show status
show_status() {
    load_config
    
    echo "=== Ultraspan Status ==="
    echo ""
    
    # Current wallpaper
    local current_uri
    current_uri=$(gsettings get org.cinnamon.desktop.background picture-uri | sed "s/'//g")
    echo "📷 Current Wallpaper:"
    echo "   $current_uri"
    echo ""
    
    # Monitor info
    local XRANDR_OUT
    XRANDR_OUT=$(xrandr --listmonitors 2>/dev/null)
    local MIN_X=99999 MIN_Y=99999 MAX_X=0 MAX_Y=0
    while IFS= read -r line; do
        if [[ $line =~ ([0-9]+:[[:space:]]+[\+\*]*)([A-Za-z0-9-]+)[[:space:]]+([0-9]+)\/[0-9]+x([0-9]+)\/[0-9]+\+([0-9]+)\+([0-9]+) ]]; then
            local W="${BASH_REMATCH[3]}" H="${BASH_REMATCH[4]}" X="${BASH_REMATCH[5]}" Y="${BASH_REMATCH[6]}"
            [ $X -lt $MIN_X ] && MIN_X=$X
            [ $Y -lt $MIN_Y ] && MIN_Y=$Y
            local X2=$((X + W))
            local Y2=$((Y + H))
            [ $X2 -gt $MAX_X ] && MAX_X=$X2
            [ $Y2 -gt $MAX_Y ] && MAX_Y=$Y2
        fi
    done <<< "$XRANDR_OUT"
    
    echo "🖥️  Monitor Layout:"
    echo "   Total span: $((MAX_X - MIN_X))x$((MAX_Y - MIN_Y))"
    echo ""
    
    # Settings
    echo "⚙️  Settings:"
    echo "   Mode: ${MODE:-zoom}"
    echo "   Background type: ${BG_TYPE:-blur}"
    if [ "${BG_TYPE:-blur}" = "blur" ]; then
        echo "   Blur amount: ${BLUR_AMOUNT:-15}"
    else
        echo "   Color: ${BG_COLOR:-#000000}"
    fi
    
    # Random rotation status
    if [ -f "$RANDOM_FILE" ]; then
        echo ""
        echo "🎲 Random Rotation: Active"
        while IFS='=' read -r key value; do
            case "$key" in
                "directory") echo "   Directory: $value" ;;
                "mode") echo "   Mode: $value" ;;
                "interval") echo "   Interval: $value minutes" ;;
            esac
        done < "$RANDOM_FILE"
    fi
    echo ""
    
    # Cache info
    if [ -d "$CACHE_DIR" ]; then
        local cache_size cache_count
        cache_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1 || echo "0")
        cache_count=$(find "$CACHE_DIR" -name "*.jpg" | wc -l)
        echo "🗃️  Cache:"
        echo "   Files: $cache_count"
        echo "   Size: $cache_size"
        echo ""
    fi
    
    # Recent wallpaper from state
    if [ -f "$STATE_FILE" ]; then
        local recent_image
        recent_image=$(head -n1 "$STATE_FILE")
        if [ -f "$recent_image" ]; then
            echo "📝 Recent Wallpaper:"
            echo "   $recent_image"
            local recent_mode
            recent_mode=$(sed -n '2p' "$STATE_FILE" 2>/dev/null)
            if [ -n "$recent_mode" ]; then
                echo "   Mode: $recent_mode"
                local recent_bg_type
                recent_bg_type=$(sed -n '3p' "$STATE_FILE" 2>/dev/null)
                echo "   Background: $recent_bg_type"
                if [ "$recent_bg_type" = "blur" ]; then
                    echo "   Blur: $(sed -n '4p' "$STATE_FILE" 2>/dev/null)"
                else
                    echo "   Color: $(sed -n '4p' "$STATE_FILE" 2>/dev/null)"
                fi
            fi
        fi
    fi
}

# Show image info
show_image_info() {
    local image="$1"
    
    [ -f "$image" ] || { echo "❌ Error: File not found: $image"; exit 1; }
    
    echo "=== Image Information ==="
    echo ""
    
    echo "📄 File: $(basename "$image")"
    echo "📁 Path: $image"
    echo "📏 Size: $(du -h "$image" | cut -f1)"
    echo ""
    
    # Image dimensions
    local img_width img_height
    img_width=$(identify -format "%w" "$image" 2>/dev/null || echo "Unknown")
    img_height=$(identify -format "%h" "$image" 2>/dev/null || echo "Unknown")
    
    echo "🖼️  Dimensions: ${img_width}x${img_height}"
    echo ""
    
    # Get monitor span
    local XRANDR_OUT
    XRANDR_OUT=$(xrandr --listmonitors 2>/dev/null)
    local MIN_X=99999 MIN_Y=99999 MAX_X=0 MAX_Y=0
    while IFS= read -r line; do
        if [[ $line =~ ([0-9]+:[[:space:]]+[\+\*]*)([A-Za-z0-9-]+)[[:space:]]+([0-9]+)\/[0-9]+x([0-9]+)\/[0-9]+\+([0-9]+)\+([0-9]+) ]]; then
            local W="${BASH_REMATCH[3]}" H="${BASH_REMATCH[4]}" X="${BASH_REMATCH[5]}" Y="${BASH_REMATCH[6]}"
            [ $X -lt $MIN_X ] && MIN_X=$X
            [ $Y -lt $MIN_Y ] && MIN_Y=$Y
            local X2=$((X + W))
            local Y2=$((Y + H))
            [ $X2 -gt $MAX_X ] && MAX_X=$X2
            [ $Y2 -gt $MAX_Y ] && MAX_Y=$Y2
        fi
    done <<< "$XRANDR_OUT"
    
    local total_width=$((MAX_X - MIN_X))
    local total_height=$((MAX_Y - MIN_Y))
    
    echo "📐 Target Monitor Span: ${total_width}x${total_height}"
}

# List recent wallpapers
list_recent() {
    echo "=== Recent Wallpapers ==="
    echo ""
    
    if [ -f "$STATE_FILE" ]; then
        local recent_image
        recent_image=$(head -n1 "$STATE_FILE")
        if [ -f "$recent_image" ]; then
            echo "📌 Current: $recent_image"
            local recent_mode
            recent_mode=$(sed -n '2p' "$STATE_FILE" 2>/dev/null)
            if [ -n "$recent_mode" ]; then
                echo "   Mode: $recent_mode"
                local recent_bg_type
                recent_bg_type=$(sed -n '3p' "$STATE_FILE" 2>/dev/null)
                echo "   Background: $recent_bg_type"
                if [ "$recent_bg_type" = "blur" ]; then
                    echo "   Blur: $(sed -n '4p' "$STATE_FILE" 2>/dev/null)"
                else
                    echo "   Color: $(sed -n '4p' "$STATE_FILE" 2>/dev/null)"
                fi
            fi
        fi
    fi
    
    # Check cache for recent files
    if [ -d "$CACHE_DIR" ]; then
        echo ""
        echo "🗃️  Cached Wallpapers:"
        find "$CACHE_DIR" -name "*.jpg" -type f -exec ls -lt {} + 2>/dev/null | \
            head -5 | \
            while read -r line; do
                local file date size
                file=$(echo "$line" | awk '{print $9}')
                date=$(echo "$line" | awk '{print $6, $7, $8}')
                size=$(du -h "$file" 2>/dev/null | cut -f1)
                echo "   $(basename "$file") - $size - $date"
            done
    fi
}

# Set mode
set_mode() {
    local mode="$1"
    
    case "$mode" in
        "zoom"|"fit"|"center")
            MODE="$mode"
            mkdir -p "$CONFIG_DIR"
            echo "mode=$MODE" > "$CONFIG_FILE"
            echo "bg_type=$BG_TYPE" >> "$CONFIG_FILE"
            if [ "$BG_TYPE" = "blur" ]; then
                echo "blur=$BLUR_AMOUNT" >> "$CONFIG_FILE"
            else
                echo "color=$BG_COLOR" >> "$CONFIG_FILE"
            fi
            echo "✅ Default mode set to: $mode"
            
            # If there's a recent wallpaper, reapply it with new mode
            if [ -f "$STATE_FILE" ]; then
                local recent_image
                recent_image=$(head -n1 "$STATE_FILE")
                if [ -f "$recent_image" ]; then
                    echo "🔄 Reapplying current wallpaper with new mode..."
                    set_wallpaper "$recent_image" "$mode"
                fi
            fi
            ;;
        *)
            echo "❌ Error: Invalid mode: $mode"
            echo "   Valid modes: zoom, fit, center"
            exit 1
            ;;
    esac
}

# Set background type
set_bg_type() {
    local bg_type="$1"
    
    case "$bg_type" in
        "blur"|"solid")
            BG_TYPE="$bg_type"
            mkdir -p "$CONFIG_DIR"
            echo "mode=${MODE:-zoom}" > "$CONFIG_FILE"
            echo "bg_type=$BG_TYPE" >> "$CONFIG_FILE"
            if [ "$BG_TYPE" = "blur" ]; then
                echo "blur=$BLUR_AMOUNT" >> "$CONFIG_FILE"
            else
                echo "color=$BG_COLOR" >> "$CONFIG_FILE"
            fi
            echo "✅ Background type set to: $BG_TYPE"
            
            # If there's a recent wallpaper, reapply it with new background type
            if [ -f "$STATE_FILE" ]; then
                local recent_image
                recent_image=$(head -n1 "$STATE_FILE")
                local recent_mode
                recent_mode=$(sed -n '2p' "$STATE_FILE" 2>/dev/null || echo "zoom")
                if [ -f "$recent_image" ] && [ "$recent_mode" != "zoom" ]; then
                    echo "🔄 Reapplying current wallpaper with new background type..."
                    set_wallpaper "$recent_image" "$recent_mode"
                fi
            fi
            ;;
        *)
            echo "❌ Error: Invalid background type: $bg_type"
            echo "   Valid types: blur, solid"
            exit 1
            ;;
    esac
}

# Set blur amount
set_blur() {
    local blur_amount="$1"
    
    # Validate blur amount
    if [[ ! "$blur_amount" =~ ^[0-9]+$ ]] || [ "$blur_amount" -lt 0 ] || [ "$blur_amount" -gt 100 ]; then
        echo "❌ Error: Blur amount must be between 0 and 100"
        exit 1
    fi
    
    BLUR_AMOUNT="$blur_amount"
    mkdir -p "$CONFIG_DIR"
    echo "mode=${MODE:-zoom}" > "$CONFIG_FILE"
    echo "bg_type=$BG_TYPE" >> "$CONFIG_FILE"
    echo "blur=$BLUR_AMOUNT" >> "$CONFIG_FILE"
    echo "✅ Blur amount set to: $BLUR_AMOUNT"
    
    # If there's a recent wallpaper, reapply it with new blur
    if [ -f "$STATE_FILE" ]; then
        local recent_image
        recent_image=$(head -n1 "$STATE_FILE")
        local recent_mode
        recent_mode=$(sed -n '2p' "$STATE_FILE" 2>/dev/null || echo "zoom")
        if [ -f "$recent_image" ] && [ "$recent_mode" != "zoom" ] && [ "$BG_TYPE" = "blur" ]; then
            echo "🔄 Reapplying current wallpaper with new blur amount..."
            set_wallpaper "$recent_image" "$recent_mode"
        fi
    fi
}

# Set solid color
set_color() {
    local color="$1"
    
    # Validate color format (simple check for hex)
    if [[ ! "$color" =~ ^#[0-9A-Fa-f]{6}$ ]]; then
        echo "❌ Error: Color must be in hex format: #RRGGBB"
        echo "   Example: #1a1a1a, #FF5733, #3498db"
        exit 1
    fi
    
    BG_COLOR="$color"
    mkdir -p "$CONFIG_DIR"
    echo "mode=${MODE:-zoom}" > "$CONFIG_FILE"
    echo "bg_type=$BG_TYPE" >> "$CONFIG_FILE"
    echo "color=$BG_COLOR" >> "$CONFIG_FILE"
    echo "✅ Solid color set to: $BG_COLOR"
    
    # If there's a recent wallpaper, reapply it with new color
    if [ -f "$STATE_FILE" ]; then
        local recent_image
        recent_image=$(head -n1 "$STATE_FILE")
        local recent_mode
        recent_mode=$(sed -n '2p' "$STATE_FILE" 2>/dev/null || echo "zoom")
        if [ -f "$recent_image" ] && [ "$recent_mode" != "zoom" ] && [ "$BG_TYPE" = "solid" ]; then
            echo "🔄 Reapplying current wallpaper with new color..."
            set_wallpaper "$recent_image" "$recent_mode"
        fi
    fi
}

# Clean cache
clean_cache() {
    echo "🧹 Cleaning wallpaper cache..."
    
    if [ -d "$CACHE_DIR" ]; then
        local cache_size file_count
        cache_size=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1 || echo "0")
        file_count=$(find "$CACHE_DIR" -name "*.jpg" | wc -l)
        
        rm -rf "$CACHE_DIR"
        mkdir -p "$CACHE_DIR"
        
        echo "✅ Cache cleaned: removed $file_count files ($cache_size)"
    else
        echo "ℹ️  Cache directory does not exist"
    fi
}

# Restore default
restore_default() {
    echo "🔄 Restoring default wallpaper..."
    
    local default_wallpaper="/usr/share/backgrounds/linuxmint/default_background.jpg"
    
    if [ -f "$default_wallpaper" ]; then
        set_wallpaper "$default_wallpaper" "zoom"
    else
        echo "❌ Error: Default wallpaper not found at: $default_wallpaper"
        
        # Try other common locations
        local alternatives=(
            "/usr/share/backgrounds"
            "/usr/share/wallpapers"
            "/usr/share/gnome-background-properties"
        )
        
        for dir in "${alternatives[@]}"; do
            if [ -d "$dir" ]; then
                local first_wallpaper
                first_wallpaper=$(find "$dir" -name "*.jpg" -o -name "*.png" | head -1)
                if [ -n "$first_wallpaper" ]; then
                    set_wallpaper "$first_wallpaper" "zoom"
                    return 0
                fi
            fi
        done
        
        echo "❌ Could not find any system wallpaper"
    fi
}

# -----------------------------
# DEPENDENCY CHECK
# -----------------------------
check_dependencies() {
    local missing=()
    for cmd in convert identify xrandr gsettings sha1sum bc; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
        fi
    done
    if [ ${#missing[@]} -ne 0 ]; then
        echo "❌ Error: Missing required dependencies: ${missing[*]}" >&2
        echo "   Please install them using your package manager." >&2
        echo "   For example: sudo apt install imagemagick x11-utils bc" >&2
        exit 1
    fi
}

# -----------------------------
# MAIN COMMAND DISPATCHER
# -----------------------------

# Load config first
load_config

# Also load random interval if exists
if [ -f "$CONFIG_FILE" ]; then
    while IFS='=' read -r key value; do
        case "$key" in
            "random_interval") RANDOM_INTERVAL="$value" ;;
        esac
    done < "$CONFIG_FILE"
fi

# Get the command
COMMAND="${1:-help}"

case "$COMMAND" in
    "set")
        if [ -z "${2:-}" ]; then
            echo "❌ Error: No image specified"
            echo "   Usage: ultraspan set IMAGE_PATH [MODE]"
            exit 1
        fi
        
        # Get default mode from config
        DEFAULT_MODE=$(get_default_mode)
        
        # Call set_wallpaper with image and mode
        set_wallpaper "$2" "${3:-$DEFAULT_MODE}"
        ;;
        
    "random-stop")
        stop_random_mode
        ;;
        
    "random-status")
        show_random_status
        ;;

    "random")
        if [ -z "${2:-}" ]; then
            echo "❌ Error: No directory specified"
            echo "   Usage: ultraspan random DIRECTORY [MODE]"
            echo "   Example: ultraspan random ~/Pictures/Wallpapers zoom"
            exit 1
        fi
        
        # Stop any existing random mode
        stop_random_mode
        
        # Get default mode from config
        DEFAULT_MODE=$(get_default_mode)
        
        # Start random mode
        start_random_mode "$2" "${3:-$DEFAULT_MODE}"
        ;;
        
    "interval")
        if [ -z "${2:-}" ]; then
            echo "⏰ Current random interval: ${RANDOM_INTERVAL:-30} minutes"
            echo "   Usage: ultraspan interval MINUTES"
            echo "   Example: ultraspan interval 10"
        else
            set_interval "$2"
        fi
        ;;
        
    "status")
        show_status
        ;;
        
    "info")
        if [ -z "${2:-}" ]; then
            echo "❌ Error: No image specified"
            echo "   Usage: ultraspan info IMAGE_PATH"
            exit 1
        fi
        show_image_info "$2"
        ;;
        
    "list")
        list_recent
        ;;
        
    "mode")
        if [ -z "${2:-}" ]; then
            # Show current mode
            load_config
            echo "📐 Current mode: ${MODE:-zoom}"
        else
            set_mode "$2"
        fi
        ;;
        
    "bg-type")
        if [ -z "${2:-}" ]; then
            echo "🎨 Current background type: $BG_TYPE"
            echo "   Usage: ultraspan bg-type [blur|solid]"
        else
            set_bg_type "$2"
        fi
        ;;
        
    "blur")
        if [ -z "${2:-}" ]; then
            echo "🎭 Current blur amount: $BLUR_AMOUNT"
            echo "   Usage: ultraspan blur [0-100]"
        else
            set_blur "$2"
        fi
        ;;
        
    "color")
        if [ -z "${2:-}" ]; then
            echo "🎨 Current solid color: $BG_COLOR"
            echo "   Usage: ultraspan color [HEX_COLOR]"
            echo "   Example: ultraspan color \"#1a1a1a\""
        else
            set_color "$2"
        fi
        ;;
        
    "restore")
        restore_default
        ;;
        
    "clean")
        clean_cache
        ;;
        
    "help"|"--help"|"-h")
        show_help
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
