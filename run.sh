#!/bin/bash
# Arranca Lavalink en segundo plano
java -jar Lavalink.jar > lavalink.log 2>&1 &

# Espera unos segundos a que Lavalink arranque
sleep 5

# Arranca el bot de Node.js
node bot.js