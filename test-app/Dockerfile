# Etapa 1: build
FROM node:21 AS builder

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

# Etapa 2: servir build con 'serve'
FROM node:21 AS runtime

WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/build ./build

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
