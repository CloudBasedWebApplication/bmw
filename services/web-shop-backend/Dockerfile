FROM node:24-alpine

WORKDIR /app/services/web-shop-backend

COPY services/web-shop-backend/package.json services/web-shop-backend/package-lock.json ./
RUN npm ci

COPY services/web-shop-backend/src /app/services/web-shop-backend/src
COPY web /app/web

EXPOSE 3006

CMD ["npm", "start"]
