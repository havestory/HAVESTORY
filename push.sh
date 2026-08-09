#!/bin/bash
cd "$(dirname "$0")"
git remote set-url origin "https://$GITHU_TOKEN@github.com/kleraandria35-coder/PrintBloom.git" 2>/dev/null || \
git remote add origin "https://$GITHU_TOKEN@github.com/kleraandria35-coder/PrintBloom.git"
git push origin main
echo "Done!"
