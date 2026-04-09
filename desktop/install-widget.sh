#!/bin/bash
# Install the Daypilot KDE Plasma widget
# Run once on your Ubuntu machine

WIDGET_DIR="$HOME/.local/share/plasma/plasmoids/com.daypilot.widget"

echo "Installing Daypilot widget..."
mkdir -p "$WIDGET_DIR"
cp -r daypilot-widget/* "$WIDGET_DIR/"

# Restart Plasma shell to load the widget
kquitapp5 plasmashell && kstart5 plasmashell &

echo "Done! Right-click your desktop → Add Widgets → search 'Daypilot'"
