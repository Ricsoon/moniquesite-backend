# Configuração do PostgreSQL

Este documento descreve como configurar o banco de dados PostgreSQL para armazenar informações dos usuários.

## Estrutura da Tabela

### Tabela `users`

Esta tabela armazena os dados dos usuários recebidos do N8N após verificação do WhatsApp.

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  id_user_platform VARCHAR(255) UNIQUE NOT NULL, -- Identificador interno da plataforma
  user_id VARCHAR(255) UNIQUE, -- ID do usuário retornado pelo N8N
  email VARCHAR(255) UNIQUE,
  nome VARCHAR(255),
  telefone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_identifier_check CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

-- Criar índices para melhor performance (execute cada comando separadamente)
CREATE INDEX IF NOT EXISTS idx_users_id_user_platform ON users(id_user_platform);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_telefone ON users(telefone);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
```

## Campos da Tabela

- **id**: ID interno do banco (auto-incremento)
- **id_user_platform**: Identificador único interno da plataforma (gerado automaticamente)
- **user_id**: ID do usuário retornado pelo N8N (único, opcional inicialmente)
- **email**: Email do usuário (único, opcional mas deve ter pelo menos email ou user_id)
- **nome**: Nome do usuário (opcional)
- **telefone**: Número de telefone do usuário (opcional)
- **status**: Status do usuário (pending, verified, active, inactive) - padrão: 'pending'
- **created_at**: Data de criação do registro
- **updated_at**: Data da última atualização

## Migração da Tabela (se já existir)

Se a tabela `users` já existir com a estrutura antiga, execute os comandos de migração:

```sql
-- Adicionar nova coluna id_user_platform
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_user_platform VARCHAR(255) UNIQUE;

-- Renomear coluna n8n_user_id para user_id (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'n8n_user_id') THEN
    ALTER TABLE users RENAME COLUMN n8n_user_id TO user_id;
  END IF;
END $$;

-- Gerar id_user_platform para registros existentes
UPDATE users SET id_user_platform = gen_random_uuid()::text WHERE id_user_platform IS NULL;

-- Tornar id_user_platform NOT NULL após popular
ALTER TABLE users ALTER COLUMN id_user_platform SET NOT NULL;

-- Atualizar constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identifier_check;
ALTER TABLE users ADD CONSTRAINT users_identifier_check CHECK (user_id IS NOT NULL OR email IS NOT NULL);

-- Recriar índices
DROP INDEX IF EXISTS idx_users_n8n_user_id;
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_id_user_platform ON users(id_user_platform);
```

## Variáveis de Ambiente

Configure as seguintes variáveis no arquivo `.env`:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=monique_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha_postgres_aqui
```

## Fluxo de Dados

1. **Verificação OTP**: Quando o usuário verifica o código OTP, os dados (email, nome, telefone) são armazenados no PostgreSQL com status 'pending' e sem n8n_user_id.

2. **Webhook N8N**: Quando o N8N processa a verificação e retorna o `user_id`, este é enviado via webhook para `POST /api/webhooks/n8n` com:
   - `user_id` (obrigatório): ID do usuário no N8N
   - `email` (opcional)
   - `nome` (opcional)
   - `telefone` (opcional)
   - `status` (opcional): Status do usuário (padrão: 'verified')

3. **Atualização**: O sistema atualiza o registro existente (se encontrado por email ou n8n_user_id) ou cria um novo registro com os dados fornecidos.

## Endpoints

### POST /api/webhooks/n8n

Recebe o webhook do N8N com os dados do usuário após verificação.

**Payload:**
```json
{
  "user_id": "n8n_user_123",
  "email": "usuario@example.com",
  "nome": "Nome do Usuário",
  "telefone": "5511999999999",
  "status": "verified"
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Usuário armazenado com sucesso",
  "data": {
    "id": 1,
    "n8n_user_id": "n8n_user_123",
    "email": "usuario@example.com",
    "nome": "Nome do Usuário",
    "telefone": "5511999999999",
    "status": "verified",
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

## Instalação e Configuração

1. Instale o PostgreSQL em seu sistema
2. Crie o banco de dados:
   ```sql
   CREATE DATABASE monique_db;
   ```

3. Configure as variáveis de ambiente no arquivo `.env`

4. O sistema criará automaticamente as tabelas e índices ao iniciar (verifique `config/postgres.js`)

5. Se preferir criar manualmente, execute o script SQL acima no banco de dados

## Estrutura de Tabelas

O PostgreSQL é usado como banco de dados principal para:

1. **Usuários verificados** (`users`) - Dados recebidos do N8N após verificação do WhatsApp
2. **Planos** (`plans`) - Planos de assinatura disponíveis
3. **Transações** (`transactions`) - Histórico de pagamentos e transações

## Notas

- O PostgreSQL é o banco de dados principal para planos, transações e usuários verificados
- O MongoDB ainda é usado apenas para User e OTPCode (autenticação e códigos de verificação)
- Quando o código OTP é verificado, os dados são armazenados no PostgreSQL automaticamente
- O webhook do N8N atualiza o registro adicionando o `n8n_user_id`
- Planos e transações foram migrados para PostgreSQL e não dependem mais do MongoDB

