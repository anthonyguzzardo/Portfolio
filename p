#!/bin/bash
# Quick commit and push for Portfolio
# Usage: ./p "commit message"

if [ -z "$1" ]; then
  echo "Usage: ./p \"commit message\""
  exit 1
fi

git add . && git commit -m "$1" && git push origin main
