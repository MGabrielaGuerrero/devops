#!/bin/sh

set -x

echo "Esperando DB en $SEQ_HOST:$SEQ_PORT"
until nc -z -v -w30 $SEQ_HOST $SEQ_PORT
do
  echo "Esperando conexión con PostgreSQL..."
  sleep 1
done

echo "Instalando dependencias"
npm install

echo "Ejecutando migraciones"
# npx sequelize-cli db:create || echo "DB ya existe"
npx sequelize-cli db:migrate

echo "Iniciando app"
npm run start

