#!/usr/bin/env bash
# Takes screenshots on both simulators: screenshot.sh <name>
# Saves /tmp/ios-<name>.png and /tmp/android-<name>.png
set -euo pipefail

NAME="${1:?usage: screenshot.sh <name>}"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"

xcrun simctl io booted screenshot "/tmp/ios-$NAME.png"
"$SDK/platform-tools/adb" exec-out screencap -p > "/tmp/android-$NAME.png"
echo "Saved /tmp/ios-$NAME.png and /tmp/android-$NAME.png"
