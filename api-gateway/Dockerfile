FROM node:22-alpine

WORKDIR /app/api-gateway

COPY api-gateway/package.json api-gateway/package-lock.json* ./
RUN npm install

COPY api-gateway/src ./src

WORKDIR /app
COPY web ./web

WORKDIR /app/api-gateway

EXPOSE 3000

CMD ["npm", "start"]
