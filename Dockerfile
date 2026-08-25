FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js ./
COPY index.html ./
COPY css ./css
COPY js ./js
COPY assets ./assets

EXPOSE 8080
CMD ["node", "server.js"]
