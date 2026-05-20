FROM node:24-alpine

WORKDIR /app/services/web-shop-frontend

COPY services/web-shop-frontend/package.json services/web-shop-frontend/package-lock.json ./
RUN npm ci

COPY services/web-shop-frontend/src /app/services/web-shop-frontend/src
COPY web /app/web

EXPOSE 3000

CMD ["npm", "start"]
