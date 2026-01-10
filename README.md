# Backend User Monique

Backend em Node.js/Express para controle de usuários e gestão financeira de planos, com integração para React.js.

## 🚀 Funcionalidades

- **Autenticação Google OAuth**: Login exclusivo via Google (OAuth 2.0)
- **Autenticação JWT**: Sistema de tokens para sessões autenticadas
- **Gerenciamento de Usuários**: CRUD completo com controle de permissões
- **Sistema de Planos**: Criação e gerenciamento de planos de assinatura
- **Controle Financeiro**: Transações e controle de pagamentos integrado com **Asaas**
- **Integração Asaas**: Processamento de pagamentos via PIX, Cartão de Crédito, Boleto e Assinaturas
- **Webhooks**: Recebimento automático de notificações de pagamento da Asaas
- **Segurança**: Middleware de autenticação, validação de dados e controle de acesso

## 📋 Pré-requisitos

- Node.js (v14 ou superior)
- MongoDB (local ou remoto)
- npm ou yarn
- Conta Google Cloud (para OAuth)
  - Crie um projeto em: https://console.cloud.google.com/
  - Configure OAuth 2.0 e obtenha Client ID e Client Secret
- Conta no Asaas (para processamento de pagamentos)
  - Crie uma conta em: https://www.asaas.com/
  - Para testes, use o Sandbox: https://sandbox.asaas.com/

## 🔧 Instalação

1. Clone o repositório ou navegue até a pasta do projeto

2. Instale as dependências:
```bash
npm install
```

3. Execute o seed dos planos padrão:
```bash
npm run seed:plans
```
Isso criará os 3 planos padrão: Gratuito (200 créditos), Pro (600 créditos) e Ilimitado.

4. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Edite o arquivo `.env` com suas configurações:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/user-monique
JWT_SECRET=seu_jwt_secret_super_seguro_aqui
JWT_REFRESH_SECRET=seu_jwt_refresh_secret_super_seguro_aqui
CORS_ORIGIN=http://localhost:3001,http://localhost:5173
FRONTEND_URL=http://localhost:3001

# Configurações Google OAuth
GOOGLE_CLIENT_ID=seu_google_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_google_client_secret_aqui
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
SESSION_SECRET=session_secret_super_seguro_aqui

# Configurações Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role_do_supabase

# Configurações Asaas
ASAAS_API_KEY=sua_chave_api_asaas_aqui
ASAAS_BASE_URL=https://api.asaas.com/v3
# Para ambiente de testes (sandbox), use: https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=token_webhook_asaas_opcional
```

**Como configurar Google OAuth:**
1. Acesse https://console.cloud.google.com/
2. Crie um novo projeto ou selecione um existente
3. Vá em "APIs e Serviços" > "Credenciais"
4. Clique em "Criar credenciais" > "ID do cliente OAuth"
5. Configure:
   - Tipo de aplicativo: Aplicativo da Web
   - URIs de redirecionamento autorizados: `http://localhost:3000/api/auth/google/callback` (e sua URL de produção)
6. Copie o Client ID e Client Secret para o arquivo `.env`

**Como obter a chave API do Asaas:**
1. Acesse sua conta no Asaas
2. Vá em "Minha Conta" > "Integração" > "Gerar chave de API"
3. Copie a chave gerada e cole no arquivo `.env`

5. Inicie o servidor:
```bash
# Modo desenvolvimento (com nodemon)
npm run dev

# Modo produção
npm start
```

## 📚 Estrutura do Projeto

```
backend-user-monique/
├── config/
│   ├── config.js          # Configurações gerais
│   ├── database.js        # Conexão com MongoDB
│   └── passport.js        # Configuração Passport/Google OAuth
├── middleware/
│   ├── auth.js            # Autenticação JWT
│   └── validation.js      # Validação de dados
├── models/
│   ├── User.js            # Modelo de usuário
│   ├── Plan.js            # Modelo de plano
│   └── Transaction.js     # Modelo de transação
├── routes/
│   ├── auth.js            # Rotas de autenticação (Google OAuth)
│   ├── users.js           # Rotas de usuários
│   ├── plans.js           # Rotas de planos
│   ├── transactions.js    # Rotas de transações
│   └── webhooks.js        # Webhooks da Asaas
├── services/
│   └── asaasService.js    # Serviço de integração com Asaas
├── routes/
│   ├── auth.js            # Rotas de autenticação (Google OAuth)
│   ├── users.js           # Rotas de usuários
│   ├── plans.js           # Rotas de planos
│   ├── transactions.js    # Rotas de transações
│   ├── webhooks.js        # Webhooks da Asaas
│   └── credits.js         # Rotas de gerenciamento de créditos
├── services/
│   └── asaasService.js    # Serviço de integração com Asaas
├── scripts/
│   └── seedPlans.js       # Script para criar planos padrão
├── utils/
│   ├── jwt.js             # Utilitários JWT
│   ├── calculatePlanDates.js  # Cálculo de datas de planos
│   └── activatePlan.js    # Ativação de planos e atribuição de créditos
├── server.js              # Servidor principal
├── package.json
└── README.md
```

## 🔌 Endpoints da API

### Autenticação (`/api/auth`)

- `GET /api/auth/google` - Iniciar autenticação com Google (redirect)
- `GET /api/auth/google/callback` - Callback do Google OAuth
- `POST /api/auth/google/token` - Autenticar com token do Google (alternativa)
- `POST /api/auth/refresh` - Renovar token de acesso
- `GET /api/auth/me` - Obter dados do usuário autenticado
- `POST /api/auth/logout` - Logout (informativo)

### Usuários (`/api/users`)

- `GET /api/users` - Listar usuários (apenas admin)
- `GET /api/users/:id` - Obter usuário por ID
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Desativar usuário (apenas admin)

### Planos (`/api/plans`)

- `GET /api/plans` - Listar planos ativos
- `GET /api/plans/:id` - Obter plano por ID
- `POST /api/plans` - Criar plano (apenas admin)
- `PUT /api/plans/:id` - Atualizar plano (apenas admin)
- `DELETE /api/plans/:id` - Desativar plano (apenas admin)

### Transações (`/api/transactions`)

- `GET /api/transactions` - Listar transações
- `GET /api/transactions/:id` - Obter transação por ID
- `POST /api/transactions` - Criar transação (comprar plano) - **Integrado com Asaas**
- `GET /api/transactions/:id/payment-status` - Verificar status do pagamento na Asaas
- `GET /api/transactions/:id/pix-qrcode` - Obter QR Code PIX atualizado
- `PUT /api/transactions/:id` - Atualizar transação (apenas admin)

### Créditos (`/api/credits`)

- `GET /api/credits/balance` - Obter saldo de créditos do usuário
- `POST /api/credits/consume` - Consumir créditos (sincroniza com Supabase)
- `GET /api/credits/check?amount=X` - Verificar se tem créditos suficientes
- `POST /api/credits/add` - Adicionar créditos (apenas admin, sincroniza com Supabase)
- `POST /api/credits/reset` - Resetar créditos utilizados (apenas admin)

### Supabase (`/api/supabase`)

- `POST /api/supabase/sync-credits` - Sincronizar créditos do MongoDB para Supabase
- `GET /api/supabase/balance` - Obter saldo de créditos do Supabase
- `POST /api/supabase/find-user` - Buscar usuário no Supabase pelo Google token/ID/email

### Webhooks (`/api/webhooks`)

- `POST /api/webhooks/asaas` - Endpoint para receber notificações da Asaas

## 🔐 Autenticação

A API usa JWT (JSON Web Tokens) para autenticação. Inclua o token no header das requisições:

```
Authorization: Bearer <seu_token_aqui>
```

## 📝 Exemplos de Uso

### Login com Google (Redirect)
No frontend, redirecione o usuário para:
```
GET http://localhost:3000/api/auth/google
```
O usuário será redirecionado para o Google, e após autenticação, será redirecionado de volta para:
```
http://seu-frontend.com/auth/callback?token=<accessToken>&refreshToken=<refreshToken>
```

### Login com Google (Token)
Se você já tem o token do Google (por exemplo, usando Google Sign-In no frontend):
```javascript
POST /api/auth/google/token
{
  "googleToken": "token_do_google_aqui"
}
```

**Resposta:**
```javascript
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "user": {
      "id": "...",
      "name": "João Silva",
      "email": "joao@example.com",
      "picture": "https://...",
      "role": "user",
      "activePlan": null
    },
    "accessToken": "jwt_token_aqui",
    "refreshToken": "refresh_token_aqui"
  }
}
```

### Comprar Plano (com integração Asaas)
```javascript
POST /api/transactions
Headers: { Authorization: "Bearer <token>" }
{
  "planId": "507f1f77bcf86cd799439011",
  "billingType": "CREDIT_CARD", // ou "PIX", "BOLETO", "DEBIT_CARD"
  "creditCard": {
    "holderName": "João Silva",
    "number": "5162306219378829",
    "expiryMonth": "05",
    "expiryYear": "2025",
    "ccv": "318"
  },
  "creditCardHolderInfo": {
    "name": "João Silva",
    "email": "joao@example.com",
    "cpfCnpj": "12345678900",
    "postalCode": "01310100",
    "addressNumber": "123",
    "addressComplement": "Apto 45",
    "phone": "11999999999"
  }
}
```

**Tipos de cobrança suportados:**
- `CREDIT_CARD` - Cartão de Crédito
- `DEBIT_CARD` - Cartão de Débito
- `PIX` - Pagamento via PIX
- `BOLETO` - Boleto bancário

**Resposta (exemplo com PIX):**
```javascript
{
  "success": true,
  "message": "Transação criada com sucesso",
  "data": {
    "transaction": { ... },
    "payment": {
      "id": "pay_123456789",
      "status": "PENDING",
      "pixQrCode": "00020126360014BR.GOV.BCB.PIX...",
      "pixQrCodeExpiration": "2024-01-15T23:59:59Z",
      "bankSlipUrl": null,
      "invoiceUrl": "https://www.asaas.com/c/i/...",
      "isSubscription": false
    }
  }
}
```

### Verificar Status do Pagamento
```javascript
GET /api/transactions/:id/payment-status
Headers: { Authorization: "Bearer <token>" }
```

### Obter QR Code PIX
```javascript
GET /api/transactions/:id/pix-qrcode
Headers: { Authorization: "Bearer <token>" }
```

## 🔒 Permissões

- **Usuário comum**: Pode ver e editar apenas seus próprios dados
- **Admin**: Acesso completo a todas as funcionalidades

## 🛠️ Tecnologias Utilizadas

- **Express.js** - Framework web
- **MongoDB/Mongoose** - Banco de dados
- **JWT** - Autenticação
- **bcryptjs** - Hash de senhas
- **express-validator** - Validação de dados
- **CORS** - Controle de acesso cross-origin
- **Axios** - Cliente HTTP para integração com APIs
- **Asaas API** - Processamento de pagamentos

## 💳 Sistema de Créditos

O sistema utiliza um modelo de créditos para controlar o uso da assistente pessoal:

### Planos Disponíveis

1. **Gratuito** - R$ 0,00
   - 200 créditos mensais
   - Acesso básico à assistente pessoal

2. **Pro** - R$ 50,00/mês
   - 600 créditos mensais
   - Acesso completo à assistente pessoal
   - Suporte prioritário

3. **Ilimitado** - R$ 200,00/mês
   - Créditos ilimitados
   - Acesso completo sem restrições
   - Suporte premium 24/7

### Funcionalidades

- **Novos usuários**: Recebem automaticamente o plano Gratuito (200 créditos) ao fazer login pela primeira vez
- **Ativação de planos**: Quando um pagamento é confirmado, os créditos são atribuídos automaticamente
- **Consumo de créditos**: Use `POST /api/credits/consume` para consumir créditos quando o usuário usar a assistente
- **Verificação**: Use `GET /api/credits/check?amount=X` para verificar se o usuário tem créditos suficientes antes de permitir uma ação

### Exemplo de Uso

```javascript
// Verificar se tem créditos suficientes
const checkResponse = await fetch('/api/credits/check?amount=10', {
  headers: { Authorization: `Bearer ${token}` }
});

if (checkResponse.data.hasEnoughCredits) {
  // Consumir créditos após usar a assistente
  await fetch('/api/credits/consume', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: 10 }),
  });
}
```

## 🔗 Integração com Supabase

O sistema está integrado com Supabase para gerenciar créditos dos usuários. Todas as operações de créditos são sincronizadas automaticamente entre MongoDB e Supabase.

### Funcionalidades

- **Sincronização automática**: Créditos são sincronizados automaticamente quando:
  - Um plano é ativado
  - Créditos são consumidos
  - Créditos são adicionados
  - Um novo usuário é criado

- **Busca de usuários**: O sistema busca usuários no Supabase por:
  - Google ID (prioridade)
  - Email (fallback)
  - Google Token OAuth

- **Histórico de transações**: Todas as transações de créditos são registradas no Supabase para auditoria.

### Configuração

Consulte o arquivo `docs/SUPABASE_SETUP.md` para instruções detalhadas sobre:
- Estrutura das tabelas
- Scripts SQL para criação
- Políticas RLS
- Configuração de variáveis de ambiente

## 📝 Notas

- **Autenticação Google**: O sistema usa exclusivamente Google OAuth para login. Não há registro tradicional com senha.
- **Criação automática de usuários**: Quando um usuário faz login pela primeira vez com Google, uma conta é criada automaticamente com o plano Gratuito.
- **Sistema de créditos**: Cada plano possui uma quantidade específica de créditos que são consumidos conforme o uso da assistente pessoal.
- **Sincronização Supabase**: Todos os créditos são sincronizados automaticamente com Supabase para manter consistência entre sistemas.
- Os tokens JWT têm tempo de expiração configurável
- O sistema usa soft delete (desativação) em vez de exclusão permanente
- As datas dos planos são calculadas automaticamente baseadas na duração
- **Integração Asaas**: O sistema cria automaticamente clientes no Asaas quando necessário
- **Webhooks**: Configure o webhook no painel do Asaas apontando para: `https://seu-dominio.com/api/webhooks/asaas`
- **Assinaturas**: Planos com duração em meses ou anos são criados como assinaturas recorrentes no Asaas
- **Pagamentos únicos**: Planos com duração em dias são criados como pagamentos únicos

## 🤝 Integração com React

Para integrar com seu frontend React, configure o CORS no arquivo `.env` com a URL do seu frontend:

```env
CORS_ORIGIN=http://localhost:3001,http://localhost:5173
FRONTEND_URL=http://localhost:3001
```

### Opção 1: Redirect (Recomendado)
```javascript
// No seu componente React
const handleGoogleLogin = () => {
  window.location.href = 'http://localhost:3000/api/auth/google';
};

// Na página de callback (/auth/callback)
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const refreshToken = urlParams.get('refreshToken');
  
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    // Redirecionar para página principal
    window.location.href = '/';
  }
}, []);
```

### Opção 2: Google Sign-In SDK
```javascript
import { GoogleLogin } from '@react-oauth/google';

const handleGoogleSuccess = async (credentialResponse) => {
  const response = await fetch('http://localhost:3000/api/auth/google/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      googleToken: credentialResponse.credential,
    }),
  });

  const data = await response.json();
  localStorage.setItem('token', data.data.accessToken);
  localStorage.setItem('refreshToken', data.data.refreshToken);
};

// No componente
<GoogleLogin
  onSuccess={handleGoogleSuccess}
  onError={() => console.log('Login Failed')}
/>
```

### Usar token em requisições
```javascript
const response = await fetch('http://localhost:3000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
  },
});
```

## 📄 Licença

ISC

