#!/bin/bash
set -e

CONTAINER_IP=$(hostname -i | awk '{print $1}')
export RELEASE_NODE="${RELEASE_NODE_OVERRIDE:-floodilka_gateway@${CONTAINER_IP}}"
export NODE_COOKIE="${NODE_COOKIE:-floodilka_default_change_me}"
export LOGGER_LEVEL="${LOGGER_LEVEL:-info}"

exec /opt/floodilka_gateway/bin/floodilka_gateway foreground
