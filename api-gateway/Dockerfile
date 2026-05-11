FROM node:22-alpine

WORKDIR /app/api-gateway

COPY api-gateway/package.json api-gateway/package-lock.json* ./
RUN npm install

COPY api-gateway/src ./src

EXPOSE 3000

CMD ["npm", "start"]
