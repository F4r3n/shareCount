#!/bin/sh
podman-compose down
podman volume rm $1
podman-compose up