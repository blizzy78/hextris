#!/usr/bin/env -S bash -e

docker build --pull -f Dockerfile -t hextris:latest --no-cache-filter build .
docker save -o hextris.docker.tar hextris:latest
