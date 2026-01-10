# Dockerfile para Backend
FROM node:18-alpine

# Instalar wget para healthcheck (precisa ser antes de criar usuário não-root)
RUN apk add --no-cache wget

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências primeiro (para cache de layers)
COPY package*.json ./

# Instalar dependências de produção
RUN npm ci --only=production

# Copiar código fonte
COPY . .

# Criar usuário não-root para segurança (após instalar tudo)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expor porta
EXPOSE 3000

# Variável de ambiente para Node
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Comando para iniciar
CMD ["node", "server.js"]

