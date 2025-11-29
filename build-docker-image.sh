#!/usr/bin/env -S bash -e

docker build --pull -f Dockerfile -t hextris:latest --no-cache-filter build .
