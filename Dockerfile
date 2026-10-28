# Imagen del servidor (Express + Socket.IO). El cliente se despliega aparte en S3 + CloudFront.
#   docker build -t salon-server .

# ---- compilación: dependencias completas, compila shared y server ----
FROM node:22-alpine AS build
WORKDIR /app

# Solo los manifiestos primero, para aprovechar la caché de capas.
# El package.json del cliente hace falta para que npm reconozca el workspace, pero no se instala.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace shared --workspace server --include-workspace-root

COPY shared shared
COPY server server
RUN npm run build -w shared && npm run build -w server

# ---- ejecución: solo dependencias de producción y el código compilado ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace shared --workspace server && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY server/data server/data

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "server/dist/index.js"]
