# Chatbase n8n community node

Chatbase helps teams build and manage AI agents trained on their content.

Generated from OpenAPI 2.0.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated bearer token credential in n8n before using the node.

## Supported operations

- `POST /agents/{agentId}/chat` - Chat with an agent
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/clone` - Clone agent
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents` - Create agent
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/voice/sessions` - Start a voice session
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /agents/{agentId}` - Delete agent
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}` - Get agent
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents` - List agents
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/conversations/{conversationId}/retry` - Retry a message
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/conversations/{conversationId}/tool-result` - Submit a tool result
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/train` - Train agent (deprecated)
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /agents/{agentId}` - Update agent
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /agents/{agentId}/auto-retrain` - Toggle auto-retrain
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /agents/{agentId}/styles` - Update agent styles
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/conversations/export` - Export conversations
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/conversations/{conversationId}` - Get a conversation
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/conversations/{conversationId}/messages` - List conversation messages
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/conversations` - List conversations
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/users/{userId}/conversations` - List conversations for a user
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/conversations/search` - Search conversations
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /agents/{agentId}/conversations/{conversationId}` - Pause or resume a conversation
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /agents/{agentId}/conversations/{conversationId}/messages/{messageId}/feedback` - Update message feedback
  - Retry Contract: none
  - Pagination Contract: none
- `GET /health` - Health check
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/helpdesk/tickets` - Create a ticket
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/helpdesk/tickets/{ticketNumber}/messages` - Add a message to a ticket
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/helpdesk/tickets/{ticketNumber}` - Get a ticket
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/helpdesk/teams` - List teams
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/helpdesk/tickets/{ticketNumber}/messages` - List ticket messages
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/helpdesk/ticket-statuses` - List ticket statuses
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/helpdesk/tickets` - List tickets
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/helpdesk/tickets/search` - Search tickets
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /agents/{agentId}/helpdesk/tickets/{ticketNumber}` - Update a ticket
  - Retry Contract: none
  - Pagination Contract: none
- `POST /api/v2/agents/{agentId}/sources` - Create file source
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/sources` - Create source
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /agents/{agentId}/sources/{sourceId}` - Delete source
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/sources/{sourceId}` - Get source
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/sources/summary` - Get sources summary
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/sources` - List sources
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/sources/{sourceId}/restore` - Restore source (deprecated)
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /api/v2/agents/{agentId}/sources/{sourceId}` - Update file source
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /agents/{agentId}/sources/{sourceId}` - Update source
  - Retry Contract: none
  - Pagination Contract: none
- `GET /agents/{agentId}/whatsapp/templates` - List WhatsApp templates
  - Retry Contract: none
  - Pagination Contract: none
- `POST /agents/{agentId}/whatsapp/messages/template` - Send a WhatsApp template message
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **Chatbase** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **Chatbase** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **Chatbase** display name.
