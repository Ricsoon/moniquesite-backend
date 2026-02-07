# Fluxo de Pagamentos e Créditos

Este documento descreve o fluxo completo de pagamentos no sistema Monique AI, desde a seleção do plano até a concessão de créditos.

## 📋 Visão Geral do Fluxo

1. **Usuário seleciona plano** no frontend
2. **Sistema cria transação** no Asaas via API
3. **Usuário efetua pagamento** (PIX, Cartão, Boleto)
4. **Asaas confirma pagamento** e envia webhook
5. **Sistema valida pagamento** e atualiza status
6. **Integração com API externa** para atualizar plano e créditos

## 🔄 Fluxo Detalhado

### 1. Seleção e Criação do Pagamento

**Frontend → Backend:**
- Usuário escolhe plano na interface
- Frontend chama endpoint `/api/transactions/create` com:
  - `plan_id`: ID do plano selecionado
  - `payment_method`: Método de pagamento (pix, credit_card, boleto)

**Backend:**
- Valida plano e usuário
- Cria cobrança no Asaas via API
- Salva transação no banco local
- Retorna dados do pagamento (QR Code PIX, link boleto, etc.)

### 2. Confirmação do Pagamento

**Asaas → Backend (Webhook):**
- Asaas envia webhook para `/api/webhooks/asaas` com evento `PAYMENT_RECEIVED`
- Backend valida assinatura do webhook
- Atualiza status da transação para `completed`

### 3. Processamento Pós-Pagamento

Após confirmação do pagamento, o sistema executa automaticamente:

#### 3.1 Consulta de Plano na API Externa
```javascript
// Busca planos disponíveis na API externa
GET /planos

// Encontra plano correspondente ao valor pago
const externalPlanId = await getExternalPlanIdByAmount(transaction.amount);
```

#### 3.2 Atualização do Plano do Usuário
```javascript
// Atualiza plano do usuário na API externa
PUT /credito_usuarios/update-plano
{
  "user_id": "id_user_platform", // ID interno da plataforma
  "planoId": "external_plan_id"
}
```

#### 3.3 Concessão de Créditos
```javascript
// Adiciona créditos do plano ao usuário
PUT /credito_usuarios/{user_id}
{
  "creditos": 600 // Quantidade de créditos do plano
}
```

## 🗄️ Estrutura de Dados

### Transação Local
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  plan_id INTEGER,
  amount DECIMAL(10,2),
  status VARCHAR(50), -- pending, completed, failed, refunded
  asaas_payment_id VARCHAR(255),
  payment_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Usuário PostgreSQL
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  id_user_platform VARCHAR(255) UNIQUE NOT NULL, -- ID interno
  user_id VARCHAR(255) UNIQUE, -- ID do N8N
  email VARCHAR(255) UNIQUE,
  nome VARCHAR(255),
  telefone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Configuração Necessária

### Variáveis de Ambiente
```env
# Asaas
ASAAS_API_KEY=your_asaas_api_key
ASAAS_BASE_URL=https://api.asaas.com/v3
ASAAS_WEBHOOK_TOKEN=your_webhook_token

# API Externa de Créditos
EXTERNAL_CREDITS_API_URL=https://your-api.com
EXTERNAL_CREDITS_API_TOKEN=your_api_token
```

### Endpoints da API Externa
- `GET /planos` - Lista planos disponíveis
- `PUT /credito_usuarios/update-plano` - Atualiza plano do usuário
- `PUT /credito_usuarios/{user_id}` - Adiciona créditos ao usuário

## 📊 Estados da Transação

- `pending`: Aguardando pagamento
- `completed`: Pagamento confirmado, créditos concedidos
- `failed`: Pagamento falhou
- `refunded`: Pagamento reembolsado

## 🔍 Monitoramento

### Logs Importantes
- Confirmação de pagamento no webhook
- Busca de plano na API externa
- Atualização de plano do usuário
- Concessão de créditos

### Possíveis Problemas
- Plano não encontrado na API externa (valor não corresponde)
- Usuário não encontrado no PostgreSQL
- Falha na comunicação com API externa
- Webhook não recebido do Asaas

## 🧪 Testes

Para testar o fluxo completo:

1. Criar transação de teste no Asaas Sandbox
2. Confirmar pagamento manualmente no dashboard Asaas
3. Verificar se webhook foi chamado
4. Confirmar atualização na API externa
5. Verificar créditos do usuário</content>
<parameter name="filePath">c:\Users\paino\Downloads\MoniqueAI\MoniqueAI\monique-site-backend-main\docs\PAYMENT_FLOW.md