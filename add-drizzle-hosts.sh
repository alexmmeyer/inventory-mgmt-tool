#!/bin/bash
# Script to add local.drizzle.studio to /etc/hosts

if grep -q "local.drizzle.studio" /etc/hosts; then
    echo "Entry already exists in /etc/hosts"
else
    echo "Adding local.drizzle.studio to /etc/hosts..."
    sudo sh -c 'echo "127.0.0.1 local.drizzle.studio" >> /etc/hosts'
    echo "Done! You can now access Drizzle Studio at https://local.drizzle.studio"
fi

