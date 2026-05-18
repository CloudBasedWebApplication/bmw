FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
EXPOSE 3002
CMD ["npm", "start"]
