#!/usr/bin/env bash
# Terminal Live Dashboard for Avathings (changestate + avabatt)
clear

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

while true; do
    # Clear screen and move cursor to home position
    printf "\033[H\033[J"
    
    echo -e "${CYAN}${BOLD}================================================================${NC}"
    echo -e "${CYAN}${BOLD}          🛠️  AVATHINGS LIVE HARDWARE DASHBOARD               ${NC}"
    echo -e "${CYAN}${BOLD}================================================================${NC}"
    echo -e " Time: $(date '+%Y-%m-%d %H:%M:%S')  |  Press ${YELLOW}Ctrl+C${NC} to exit"
    echo ""

    # Run changestate status
    if command -v changestate >/dev/null 2>&1; then
        changestate status 2>/dev/null
    fi

    echo ""
    echo -e "${GREEN}${BOLD}----------------------------------------------------------------${NC}"
    echo -e "${GREEN}${BOLD}  🔋 AVABATT HARDWARE TELEMETRY                                 ${NC}"
    echo -e "${GREEN}${BOLD}----------------------------------------------------------------${NC}"

    if command -v avabatt >/dev/null 2>&1; then
        avabatt status 2>/dev/null
    fi

    sleep 2
done
