#!/bin/bash

# /home/anon/projects/royal-game-of-ur/out

# semanage fcontext -a -t httpd_sys_content_t "/home/anon/projects/royal-game-of-ur/out(/.*)?"
# semanage fcontext -a -t httpd_sys_content_t "/home/anon/projects/royal-game-of-ur/out(/.*)?"
# restorecon -Rv /home/anon/projects/royal-game-of-ur/out

semanage fcontext -a -t httpd_sys_content_t "/srv/royal-game-of-ur/out(/.*)?"
restorecon -Rv /srv/royal-game-of-ur/out

BUCKET=ur
pnpm run build
aws s3 rm --recursive s3://${BUCKET}
aws s3 sync ./out s3://${BUCKET}

