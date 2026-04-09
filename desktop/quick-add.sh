#!/bin/bash
# Daypilot Quick Add — GNOME (Wayland compatible)
# Requires: yad, curl
# Install: sudo apt install yad curl

# Fix yad on Wayland
export GDK_BACKEND=x11
export DISPLAY=${DISPLAY:-:0}

SERVER="https://daypilot-1hr8.onrender.com"
TODAY=$(date +%Y-%m-%d)

# Step 1 — Pick mode
yad \
  --title="Daypilot" \
  --text="<b>What do you want to add?</b>" \
  --button="Meeting:0" \
  --button="Focus Block:1" \
  --button="Cancel:2" \
  --center --width=300 --borders=16

EXIT=$?
[ $EXIT -eq 2 ] && exit 0
[ $EXIT -eq 0 ] && MODE="meeting" || MODE="focus"

# Step 2 — Fetch rooms (meeting only)
ROOMS_JSON=""
ROOM_NAMES="No room"
if [ "$MODE" = "meeting" ]; then
  ROOMS_JSON=$(curl -sf "$SERVER/api/calendar/rooms" 2>/dev/null)
  if [ -n "$ROOMS_JSON" ]; then
    EXTRA=$(echo "$ROOMS_JSON" | python3 -c "import sys,json; [print(r.get('resourceName','')) for r in json.load(sys.stdin)]" 2>/dev/null)
    [ -n "$EXTRA" ] && ROOM_NAMES="No room!$(echo "$EXTRA" | tr '\n' '!')" || ROOM_NAMES="No room"
  fi
fi

# Step 3 — Form
if [ "$MODE" = "meeting" ]; then
  RESULT=$(yad \
    --title="Daypilot — New Meeting" \
    --form \
    --field="Jira key (optional)" "" \
    --field="Title" "" \
    --field="Date" "$TODAY" \
    --field="Start (HH:MM)" "09:00" \
    --field="End (HH:MM)" "10:00" \
    --field="Room:CBE" "$ROOM_NAMES" \
    --button="Add to Calendar:0" \
    --button="Cancel:1" \
    --center --width=420 --borders=16 \
    --separator="|")
else
  RESULT=$(yad \
    --title="Daypilot — Focus Block" \
    --form \
    --field="Title" "Focus Time" \
    --field="Date" "$TODAY" \
    --field="Start (HH:MM)" "09:00" \
    --field="End (HH:MM)" "11:00" \
    --button="Block Focus Time:0" \
    --button="Cancel:1" \
    --center --width=420 --borders=16 \
    --separator="|")
fi

[ $? -ne 0 ] && exit 0

# Step 4 — Parse and POST
TZ_OFFSET="+05:30"

if [ "$MODE" = "meeting" ]; then
  JIRA_KEY=$(echo "$RESULT" | cut -d'|' -f1)
  TITLE=$(echo "$RESULT" | cut -d'|' -f2)
  DATE=$(echo "$RESULT" | cut -d'|' -f3)
  START=$(echo "$RESULT" | cut -d'|' -f4)
  END=$(echo "$RESULT" | cut -d'|' -f5)
  ROOM_NAME=$(echo "$RESULT" | cut -d'|' -f6)

  ROOM_EMAIL=""
  if [ -n "$ROOMS_JSON" ] && [ "$ROOM_NAME" != "No room" ]; then
    ROOM_EMAIL=$(echo "$ROOMS_JSON" | python3 -c "
import sys,json
for r in json.load(sys.stdin):
    if r.get('resourceName','') == '$ROOM_NAME':
        print(r.get('resourceEmail',''))
        break
" 2>/dev/null)
  fi

  PAYLOAD=$(python3 -c "
import json
p={'title':'$TITLE','start':'${DATE}T${START}:00${TZ_OFFSET}','end':'${DATE}T${END}:00${TZ_OFFSET}'}
if '$JIRA_KEY': p['jiraKey']='$JIRA_KEY'
if '$ROOM_EMAIL': p['roomResourceEmail']='$ROOM_EMAIL'
print(json.dumps(p))")
  ENDPOINT="/api/calendar/event"
else
  TITLE=$(echo "$RESULT" | cut -d'|' -f1)
  DATE=$(echo "$RESULT" | cut -d'|' -f2)
  START=$(echo "$RESULT" | cut -d'|' -f3)
  END=$(echo "$RESULT" | cut -d'|' -f4)
  PAYLOAD=$(python3 -c "import json; print(json.dumps({'title':'$TITLE','start':'${DATE}T${START}:00${TZ_OFFSET}','end':'${DATE}T${END}:00${TZ_OFFSET}'}))")
  ENDPOINT="/api/calendar/focus"
fi

RESPONSE=$(curl -sf -X POST -H "Content-Type: application/json" -d "$PAYLOAD" "$SERVER$ENDPOINT" 2>&1)
STATUS=$?

# Step 5 — Notify
if [ $STATUS -eq 0 ]; then
  yad --info --title="Daypilot" \
    --text="<b>Done!</b> Added to Google Calendar." \
    --button="OK:0" --center --width=280 --borders=16 --timeout=3
else
  yad --error --title="Daypilot — Error" \
    --text="Failed to add event.\n\n<tt>$RESPONSE</tt>" \
    --button="OK:0" --center --width=360 --borders=16
fi
