#!/bin/sh
set -e

# Enable password authentication
sudo sed -i 's/#PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config

# Enable root login in SSH
sudo sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Change port to 2223
sudo sed -i 's/Port 2222/Port 2223/' /etc/ssh/sshd_config

# Set root password to 'root'
echo 'root:root' | sudo chpasswd

sudo service ssh restart
