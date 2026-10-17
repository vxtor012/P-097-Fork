FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
ENV ZALO_DATA_DIR=/data ZALO_BRIDGE_HOST=0.0.0.0
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8010
CMD ["node", "src/server.mjs"]
