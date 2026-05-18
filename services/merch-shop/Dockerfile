FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && find node_modules -type d \( -iname test -o -iname tests -o -iname __tests__ -o -iname system-test -o -iname browser-test \) -prune -exec rm -rf '{}' + \
  && find node_modules -type f \( -iname '*.test.js' -o -iname '*.smoke.js' -o -iname 'test*.js' -o -iname '*tests.js' \) -exec rm -f '{}' +
COPY src ./src
EXPOSE 3002
CMD ["npm", "start"]
