FROM node:22-alpine

WORKDIR /app/services/web-app

COPY services/web-app/package.json ./
RUN npm install

COPY services /app/services

EXPOSE 3006

CMD ["npm", "start"]
