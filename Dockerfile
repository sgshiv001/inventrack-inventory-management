FROM node:24-bookworm-slim

ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server.js cloud-start.cjs runtime-config.js app.js globe.js globe-math.js ./
COPY index.html styles.css workspace.css cinematic.css globe.css ./
COPY tools/database.cjs tools/hosted-store.cjs ./tools/
COPY vendor ./vendor/
COPY assets/earth-daymap.jpg assets/countries-110m.json assets/welcome-warehouse.jpg ./assets/

USER node
EXPOSE 10000
CMD ["node", "cloud-start.cjs"]
