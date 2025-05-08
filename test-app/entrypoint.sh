#!/bin/sh

set -e

echo "Instalando dependencias..."
npm install

echo "Construyendo aplicación..."
npm run build

echo "Instalando servidor estático..."
npm install -g serve

echo "Iniciando servidor en el puerto 3000..."
serve -s build -l 3000

