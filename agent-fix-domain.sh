#!/usr/bin/env bash
# Быстрый фикс: новый IP (доп.) не активирован в сети сервера Timeweb —
# переключаем Caddy обратно на домен старого (рабочего) IP, чтобы сайт открылся.
set -e
IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')
HOST="${IP//./-}.sslip.io"
cat > /etc/caddy/Caddyfile <<CADDY
$HOST {
    root * /var/www/urartu-ai
    file_server
    reverse_proxy /api/* 127.0.0.1:8787
}
CADDY
systemctl reload caddy || systemctl restart caddy
sleep 2
echo "Готово: https://$HOST"
curl -s -o /dev/null -w "Проверка: HTTP %{http_code}\n" "https://$HOST/"
