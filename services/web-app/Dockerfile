FROM node:22-alpine

WORKDIR /app/services/web-app

COPY services/web-app/package.json ./
RUN npm install

COPY services/web-app/src ./src
COPY web /app/web

EXPOSE 3006

CMD ["npm", "start"]
