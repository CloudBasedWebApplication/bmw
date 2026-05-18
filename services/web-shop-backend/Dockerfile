FROM node:24-alpine
ENV NODE_ENV=production

WORKDIR /app/services/web-shop-backend

COPY services/web-shop-backend/package.json services/web-shop-backend/package-lock.json ./
RUN npm ci --omit=dev \
  && find node_modules -type d \( -iname test -o -iname tests -o -iname __tests__ -o -iname system-test -o -iname browser-test \) -prune -exec rm -rf '{}' + \
  && find node_modules -type f \( -iname '*.test.js' -o -iname '*.smoke.js' -o -iname 'test*.js' -o -iname '*tests.js' \) -exec rm -f '{}' +

COPY services/web-shop-backend/src /app/services/web-shop-backend/src
COPY web /app/web

EXPOSE 3006

CMD ["npm", "start"]
