#!/bin/bash

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <Restate Service Name>"
  exit 1
fi

ARG=$1

# Loop until restate returns an error code (indicating no invocations for the service to clear)
while true; do
  bun restate invocations cancel "$ARG" --kill --yes --quiet
  if [ $? -eq 1 ]; then
    break
  fi
done

# Loop until restate returns an error code (indicating no state for the service to clear)
while true; do
  bun restate state clear "$ARG" --yes --quiet
  if [ $? -eq 1 ]; then
    break
  fi
done