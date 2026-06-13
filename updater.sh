#!/usr/bin/env bash

# Change to the script's own directory
cd "$(dirname "$0")" || exit 1

echo "Starting hourly updater. Will run every hour. Press Ctrl+C to stop."

while true; do
    echo "[$(date)] Running node update-widget.js"
    node update-widget.js
    echo "[$(date)] Finished, sleeping for 1 hour."
    sleep 3600
done
