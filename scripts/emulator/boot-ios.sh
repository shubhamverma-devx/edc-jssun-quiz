#!/usr/bin/env bash
# Boots the iOS Simulator used for mobile testing (iPhone 16 Pro, iOS 18.6).
set -euo pipefail

DEVICE="${1:-iPhone 16 Pro}"

xcrun simctl boot "$DEVICE" 2>/dev/null || true # already booted is fine
open -a Simulator
echo "Waiting for '$DEVICE' to finish booting..."
xcrun simctl bootstatus "$DEVICE" -b
echo "iOS Simulator ready."
