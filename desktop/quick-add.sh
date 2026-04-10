#!/bin/bash
# Daypilot Quick Add — GNOME (Wayland compatible)
# Requires: yad, curl
# Install: sudo apt install yad curl

export GDK_BACKEND=x11
export DISPLAY=${DISPLAY:-:0}

SERVER="https://daypilot-1hr8.onrender.com"
TODAY=$(date +%Y-%m-%d)
NOW=$(date +%H:%M)

# Keys must match exactly what Tempo has — CUST_ORDO = Billable, OPEX = 7EDGE_OPEX
ACCOUNTS="CLOUD_NATIVE_ENG_OPEX!CUST_ORDO!CUST_ORDO_Non_Billable!INT-AI-TP!INT-ORG-COMMUNITY-INITIATIVE!INT-ORG-INNOVATION-TIME!OPEX"

# ── Step 1: Pick mode ────────────────────────────────────────────────────────
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

# ── FOCUS BLOCK ──────────────────────────────────────────────────────────────
if [ "$MODE" = "focus" ]; then

  # Fetch In Progress / QA cards assigned to me
  ISSUES_JSON=$(curl -sf "$SERVER/api/jira/active-issues" 2>/dev/null)
  CARD_LIST="No card"
  if [ -n "$ISSUES_JSON" ]; then
    CARDS=$(echo "$ISSUES_JSON" | python3 -c "
import sys, json
for i in json.load(sys.stdin):
    print(f\"{i['key']} \u2014 {i['fields']['summary']}\")" 2>/dev/null)
    [ -n "$CARDS" ] && CARD_LIST="No card!$(echo "$CARDS" | tr '\n' '!')"
  fi

  RESULT=$(yad \
    --title="Daypilot Log Focus Time" \
    --form \
    --field="Card:CBE"       "$CARD_LIST" \
    --field="Date"           "$TODAY" \
    --field="Start (HH:MM)"  "$NOW" \
    --field="Hours:CBE"      "1!2!3" \
    --field="Minutes:CBE"    "00!15!30!45" \
    --field="Account:CBE"    "$ACCOUNTS" \
    --button="Log:0" \
    --button="Cancel:1" \
    --center --width=420 --borders=16 \
    --separator=$'\t')

  [ $? -ne 0 ] && exit 0

  CARD=$(echo "$RESULT"    | cut -f1)
  DATE=$(echo "$RESULT"    | cut -f2)
  START=$(echo "$RESULT"   | cut -f3)
  HOURS=$(echo "$RESULT"   | cut -f4)
  MINUTES=$(echo "$RESULT" | cut -f5)
  ACCOUNT=$(echo "$RESULT" | cut -f6)

  # Extract Jira key from "ZZ-3427 — Title"
  JIRA_KEY=$(echo "$CARD" | awk '{print $1}')
  [ "$JIRA_KEY" = "No" ] && JIRA_KEY=""

  PAYLOAD=$(python3 -c "
import json
p = {
  'startTime': '${DATE}T${START}:00+05:30',
  'durationHours': int('${HOURS}'),
  'durationMinutes': int('${MINUTES}'),
  'account': '$ACCOUNT',
}
if '$JIRA_KEY': p['jiraKey'] = '$JIRA_KEY'
print(json.dumps(p))")

  RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$SERVER/api/focus/log" 2>&1)
  STATUS=$?

  # Check for error field in JSON response
  IS_ERROR=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'error' in d else 'no')" 2>/dev/null)

  if [ $STATUS -eq 0 ] && [ "$IS_ERROR" != "yes" ]; then
    yad --info --title="Daypilot" \
      --text="<b>Logged!</b>\nCalendar event created and Tempo worklog updated." \
      --button="OK:0" --center --width=300 --borders=16 --timeout=3
  else
    ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','Unknown error'))" 2>/dev/null || echo "$RESPONSE")
    yad --error --title="Daypilot Error" \
      --text="Failed to log focus time.\n\n<tt>$ERROR_MSG</tt>\n\n<small>Payload: $PAYLOAD</small>" \
      --button="OK:0" --center --width=420 --borders=16
  fi
  exit 0
fi

# ── MEETING ──────────────────────────────────────────────────────────────────

# Fetch all 7edge users for attendee picker (can run in background while user fills form)
USERS_JSON=$(curl -sf "$SERVER/api/jira/users" 2>/dev/null)

# Step 1: Time slot first — needed to check room availability
TIME_RESULT=$(yad \
  --title="Daypilot New Meeting" \
  --form \
  --field="Date"           "$TODAY" \
  --field="Start (HH:MM)"  "09:00" \
  --field="End (HH:MM)"    "10:00" \
  --button="Check Rooms:0" \
  --button="Cancel:1" \
  --center --width=320 --borders=16 \
  --separator=$'\t')

[ $? -ne 0 ] && exit 0

DATE=$(echo "$TIME_RESULT"  | cut -f1)
START=$(echo "$TIME_RESULT" | cut -f2)
END=$(echo "$TIME_RESULT"   | cut -f3)

# Step 2: Fetch available rooms for that slot
ROOMS_JSON=$(curl -sf "$SERVER/api/calendar/available-rooms?start=${DATE}T${START}:00%2B05:30&end=${DATE}T${END}:00%2B05:30" 2>/dev/null)
ROOM_NAMES="No room"
if [ -n "$ROOMS_JSON" ]; then
  NAMES=$(echo "$ROOMS_JSON" | python3 -c "
import sys, json
rooms = json.load(sys.stdin)
for r in rooms:
    print(r.get('resourceName',''))" 2>/dev/null)
  [ -n "$NAMES" ] && ROOM_NAMES="No room!$(echo "$NAMES" | tr '\n' '!')" || ROOM_NAMES="No room (all busy)"
fi

# Step 3: Full meeting details with available rooms
RESULT=$(yad \
  --title="Daypilot \u2014 New Meeting" \
  --form \
  --field="Jira key (optional)" "" \
  --field="Title" "" \
  --field="Room:CBE"     "$ROOM_NAMES" \
  --field="Account:CBE"  "$ACCOUNTS" \
  --button="Next \u2192 Add People:0" \
  --button="Cancel:1" \
  --center --width=420 --borders=16 \
  --separator=$'\t')

[ $? -ne 0 ] && exit 0

JIRA_KEY=$(echo "$RESULT"  | cut -f1)
TITLE=$(echo "$RESULT"     | cut -f2)
ROOM_NAME=$(echo "$RESULT" | cut -f3)
MTG_ACCOUNT=$(echo "$RESULT" | cut -f4)

# Step 2: People picker — search-based, multi-round
ATTENDEE_EMAILS=""
ATTENDEE_NAMES=""

if [ -n "$USERS_JSON" ]; then
  while true; do
    # Show search box; display already-added names as context
    ADDED_LABEL="${ATTENDEE_NAMES:-none}"
    SEARCH=$(yad \
      --entry \
      --title="Daypilot — Add People" \
      --text="<b>Search attendees</b>\n<small>Added so far: ${ADDED_LABEL}</small>" \
      --entry-label="Name or email:" \
      --button="Search:0" \
      --button="Done ✓:1" \
      --button="Cancel:2" \
      --center --width=420 --borders=16 2>/dev/null)

    BTN=$?
    [ $BTN -eq 1 ] && break          # Done — keep what's selected
    [ $BTN -eq 2 ] && { ATTENDEE_EMAILS=""; ATTENDEE_NAMES=""; break; }  # Cancel

    # Filter users JSON by search term (name or email, case-insensitive)
    SAFE_SEARCH=$(echo "$SEARCH" | sed "s/'/'\\\\''/g")
    declare -a YAD_ROWS=()
    while IFS='|' read -r name email; do
      YAD_ROWS+=("FALSE" "$name" "$email")
    done < <(echo "$USERS_JSON" | python3 -c "
import sys, json
q = '${SAFE_SEARCH}'.lower()
for u in json.load(sys.stdin):
    name  = u.get('displayName', '')
    email = u.get('email', '')
    if not q or q in name.lower() or q in email.lower():
        print(f'{name}|{email}')" 2>/dev/null)

    if [ ${#YAD_ROWS[@]} -eq 0 ]; then
      yad --info --title="No results" \
        --text="No users found matching <b>\"${SEARCH}\"</b>" \
        --button="Try again:0" --center --width=300 --borders=16 --timeout=3
      continue
    fi

    SELECTED=$(yad \
      --list \
      --column=":CHK" \
      --column="Name" \
      --column="Email" \
      --print-column=3 \
      --separator="," \
      --title="Daypilot — Results for \"${SEARCH}\"" \
      --text="Tick people to add, then click <b>Add Selected</b>:" \
      --button="Add Selected:0" \
      --button="← Back:1" \
      --center --width=500 --height=380 \
      "${YAD_ROWS[@]}" 2>/dev/null)

    [ $? -ne 0 ] && continue   # Back — loop to search again

    # Accumulate emails and display names, skipping duplicates
    if [ -n "$SELECTED" ]; then
      IFS=',' read -ra NEW_EMAILS <<< "$SELECTED"
      for raw_email in "${NEW_EMAILS[@]}"; do
        email=$(echo "$raw_email" | xargs)   # trim whitespace
        [ -z "$email" ] && continue
        [[ "$ATTENDEE_EMAILS" == *"$email"* ]] && continue  # already added

        [ -n "$ATTENDEE_EMAILS" ] && ATTENDEE_EMAILS="${ATTENDEE_EMAILS},${email}" \
                                  || ATTENDEE_EMAILS="$email"

        dname=$(echo "$USERS_JSON" | python3 -c "
import sys, json
for u in json.load(sys.stdin):
    if u.get('email','') == '${email}':
        print(u.get('displayName',''))
        break" 2>/dev/null)
        [ -n "$ATTENDEE_NAMES" ] && ATTENDEE_NAMES="${ATTENDEE_NAMES}, ${dname}" \
                                  || ATTENDEE_NAMES="$dname"
      done
    fi
  done
fi

# Resolve room email
ROOM_EMAIL=""
if [ -n "$ROOMS_JSON" ] && [ "$ROOM_NAME" != "No room" ]; then
  ROOM_EMAIL=$(echo "$ROOMS_JSON" | python3 -c "
import sys, json
for r in json.load(sys.stdin):
    if r.get('resourceName','') == '$ROOM_NAME':
        print(r.get('resourceEmail',''))
        break
" 2>/dev/null)
fi

PAYLOAD=$(python3 -c "
import json
p = {
  'title': '$TITLE',
  'start': '${DATE}T${START}:00+05:30',
  'end':   '${DATE}T${END}:00+05:30',
}
if '$JIRA_KEY':    p['jiraKey'] = '$JIRA_KEY'
if '$ROOM_EMAIL':  p['roomResourceEmail'] = '$ROOM_EMAIL'
if '$MTG_ACCOUNT': p['account'] = '$MTG_ACCOUNT'
emails = [e.strip() for e in '$ATTENDEE_EMAILS'.split(',') if e.strip()]
if emails:         p['attendees'] = emails
print(json.dumps(p))")

RESPONSE=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "$SERVER/api/calendar/event" 2>&1)
STATUS=$?

if [ $STATUS -eq 0 ]; then
  yad --info --title="Daypilot" \
    --text="<b>Done!</b> Meeting added to Google Calendar." \
    --button="OK:0" --center --width=280 --borders=16 --timeout=3
else
  yad --error --title="Daypilot \u2014 Error" \
    --text="Failed to add meeting.\n\n<tt>$RESPONSE</tt>" \
    --button="OK:0" --center --width=380 --borders=16
fi
