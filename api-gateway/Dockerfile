FROM node:22-alpine

WORKDIR /app

COPY api-gateway/package.json ./
RUN npm install

COPY api-gateway/src ./src
COPY services ./services

EXPOSE 3000

CMD ["npm", "start"]
