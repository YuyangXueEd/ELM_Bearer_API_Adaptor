#!/bin/sh
sh "$(dirname "$0")/start-elm.sh"
status=$?
if [ "$status" -ne 0 ]; then
  printf '\nSetup could not start. Press Enter to close. '
  read -r reply
fi
exit "$status"
