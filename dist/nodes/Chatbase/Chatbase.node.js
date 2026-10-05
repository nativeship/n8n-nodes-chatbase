"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chatbase = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const http_1 = require("../../shared/http");
function normalizeParameterValue(value) {
    if (value && typeof value === 'object' && 'value' in value)
        return value.value;
    return value;
}
function normalizeJsonValue(value, label, context, itemIndex) {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed)
            return {};
        try {
            return JSON.parse(trimmed);
        }
        catch (error) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON: ${error.message}`, { itemIndex });
        }
    }
    if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}
function validateBodyValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c, _d, _e;
    if (value === undefined || value === '') {
        if (contract.required)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
        return;
    }
    if (value === null) {
        if (contract.nullable)
            return;
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
    }
    if ((_a = contract.alternatives) === null || _a === void 0 ? void 0 : _a.length) {
        selectAlternativeValue(value, contract, path, context, itemIndex);
        return;
    }
    if (contract.type === 'string' && typeof value !== 'string')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
    if (contract.type === 'boolean' && typeof value !== 'boolean')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
    if (contract.type === 'number' && typeof value !== 'number')
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
    if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
    if ((_b = contract.enum) === null || _b === void 0 ? void 0 : _b.length) {
        const enumValueMatches = (candidate) => candidate === value ||
            (candidate === null && value === 'null') ||
            (candidate === 'null' && value === null) ||
            Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
        const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
        const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
            ? value.every((item) => contract.enum.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
            : contract.enum.some(enumValueMatches);
        if (!matches)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
    }
    if (contract.type === 'number' || contract.type === 'integer') {
        const numeric = value;
        if (contract.minValue !== undefined && numeric < contract.minValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
        if (contract.maxValue !== undefined && numeric > contract.maxValue)
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
    }
    if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
    if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
    if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
        try {
            new URL(value);
        }
        catch {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
        }
    }
    if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
    if (contract.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
        const objectValue = value;
        for (const child of (_c = contract.fields) !== null && _c !== void 0 ? _c : [])
            validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
        if (contract.additionalValue) {
            const known = new Set(((_d = contract.fields) !== null && _d !== void 0 ? _d : []).map((field) => field.name));
            for (const [key, childValue] of Object.entries(objectValue)) {
                if (!known.has(key)) {
                    if (((_e = contract.additionalValue.alternatives) === null || _e === void 0 ? void 0 : _e.length) && contract.additionalValue.representation === 'raw')
                        continue;
                    validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
                }
            }
        }
    }
    if (contract.type === 'array') {
        if (!Array.isArray(value))
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
        if (contract.items)
            value.forEach((item, index) => validateBodyValue(item, contract.items, `${path}[${index}]`, context, itemIndex));
    }
}
function setBodyField(body, contract, value, context, itemIndex) {
    var _a, _b;
    const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
        ? normalizeJsonValue(value, (_a = contract.displayName) !== null && _a !== void 0 ? _a : contract.name, context, itemIndex)
        : normalizeParameterValue(value);
    const selected = ((_b = contract.alternatives) === null || _b === void 0 ? void 0 : _b.length) ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
    validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
    body[contract.name] = selected;
}
function selectAlternativeValue(value, contract, path, context, itemIndex) {
    var _a, _b, _c;
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
    const selectedName = String((_a = value.schemaAlternative) !== null && _a !== void 0 ? _a : '');
    const selected = ((_b = contract.alternatives) !== null && _b !== void 0 ? _b : []).find((alternative) => alternative.name === selectedName);
    if (!selected)
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${((_c = contract.alternatives) !== null && _c !== void 0 ? _c : []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
    const selectedValue = value.value;
    validateBodyValue(selectedValue, selected, path, context, itemIndex);
    return selectedValue;
}
function encodeFormValue(value) {
    if (value === null)
        return 'null';
    if (Array.isArray(value) || (value && typeof value === 'object'))
        return JSON.stringify(value);
    return String(value);
}
function toFormData(body) {
    const form = new FormData();
    for (const [key, value] of Object.entries(body))
        form.append(key, encodeFormValue(value));
    return form;
}
function selectResponseFields(value, fields) {
    if (fields.length === 0)
        return value;
    const selected = {};
    if (value.id !== undefined)
        selected.id = value.id;
    for (const field of fields)
        if (value[field] !== undefined)
            selected[field] = value[field];
    return selected;
}
function valueAtPath(value, path) {
    if (!path)
        return value;
    return path.split('.').filter(Boolean).reduce((current, segment) => {
        if (current === undefined || current === null)
            return undefined;
        if (Array.isArray(current))
            return current[Number(segment)];
        return current[segment];
    }, value);
}
class Chatbase {
    constructor() {
        this.description = {
            displayName: "Chatbase",
            name: "chatbase",
            icon: {
                light: "file:chatbase.svg",
                dark: "file:chatbase.dark.svg"
            },
            group: [],
            version: [
                1
            ],
            subtitle: "={{((JSON.parse(\"\\u007b\\\"agents\\\":\\u007b\\\"chatWithAgent\\\":\\\"chatWithAnAgent: agent\\\",\\\"cloneAgent\\\":\\\"cloneAgent: agent\\\",\\\"createAgent\\\":\\\"createAgent: agent\\\",\\\"createVoiceSession\\\":\\\"startAVoiceSession: agent\\\",\\\"deleteAgent\\\":\\\"deleteAgent: agent\\\",\\\"getAgent\\\":\\\"getAgent: agent\\\",\\\"listAgents\\\":\\\"listAgents: agent\\\",\\\"retryMessage\\\":\\\"retryAMessage: agent\\\",\\\"submitToolResult\\\":\\\"submitAToolResult: agent\\\",\\\"trainAgent\\\":\\\"trainAgentDeprecated: agent\\\",\\\"updateAgent\\\":\\\"updateAgent: agent\\\",\\\"updateAgentAutoRetrain\\\":\\\"toggleAutoRetrain: agent\\\",\\\"updateAgentStyles\\\":\\\"updateAgentStyles: agent\\\"\\u007d,\\\"conversations\\\":\\u007b\\\"exportConversations\\\":\\\"exportConversations: conversation\\\",\\\"getConversation\\\":\\\"getAConversation: conversation\\\",\\\"listConversationMessages\\\":\\\"listConversationMessages: conversation\\\",\\\"listConversations\\\":\\\"listConversations: conversation\\\",\\\"listUserConversations\\\":\\\"listConversationsForAUser: conversation\\\",\\\"searchConversations\\\":\\\"searchConversations: conversation\\\",\\\"updateConversation\\\":\\\"pauseOrResumeAConversation: conversation\\\",\\\"updateMessageFeedback\\\":\\\"updateMessageFeedback: conversation\\\"\\u007d,\\\"health\\\":\\u007b\\\"getHealth\\\":\\\"healthCheck: health\\\"\\u007d,\\\"helpdesk\\\":\\u007b\\\"createTicket\\\":\\\"createATicket: helpdesk\\\",\\\"createTicketMessage\\\":\\\"addAMessageToATicket: helpdesk\\\",\\\"getTicket\\\":\\\"getATicket: helpdesk\\\",\\\"listHelpdeskTeams\\\":\\\"listTeams: helpdesk\\\",\\\"listTicketMessages\\\":\\\"listTicketMessages: helpdesk\\\",\\\"listTicketStatuses\\\":\\\"listTicketStatuses: helpdesk\\\",\\\"listTickets\\\":\\\"listTickets: helpdesk\\\",\\\"searchTickets\\\":\\\"searchTickets: helpdesk\\\",\\\"updateTicket\\\":\\\"updateATicket: helpdesk\\\"\\u007d,\\\"sources\\\":\\u007b\\\"createFileSource\\\":\\\"createFileSource: source\\\",\\\"createSource\\\":\\\"createSource: source\\\",\\\"deleteSource\\\":\\\"deleteSource: source\\\",\\\"getSource\\\":\\\"getSource: source\\\",\\\"getSourcesSummary\\\":\\\"getSourcesSummary: source\\\",\\\"listSources\\\":\\\"listSources: source\\\",\\\"restoreSource\\\":\\\"restoreSourceDeprecated: source\\\",\\\"updateFileSource\\\":\\\"updateFileSource: source\\\",\\\"updateSource\\\":\\\"updateSource: source\\\"\\u007d,\\\"whatsapp\\\":\\u007b\\\"listWhatsAppTemplates\\\":\\\"listWhatsAppTemplates: whatsApp\\\",\\\"sendWhatsAppTemplateMessage\\\":\\\"sendAWhatsAppTemplateMessage: whatsApp\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
            description: "Chatbase helps teams build and manage AI agents trained on their content.",
            documentationUrl: "https://www.chatbase.co/api/v2",
            hints: [
                {
                    message: "Operation \"listAgents\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listConversations\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"exportConversations\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"searchConversations\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listConversationMessages\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listTickets\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listTicketMessages\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listSources\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "The specification uses an allOf composition that cannot be safely flattened into typed fields. The generated operation uses the raw JSON boundary for the composed value.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                },
                {
                    message: "Operation \"listUserConversations\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                    type: "warning",
                    location: "inputPane",
                    whenToDisplay: "always"
                }
            ],
            defaults: {
                name: "Chatbase"
            },
            usableAsTool: true,
            inputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            outputs: [
                n8n_workflow_1.NodeConnectionTypes.Main
            ],
            credentials: [
                {
                    name: "chatbaseApi",
                    required: true
                }
            ],
            properties: [
                {
                    displayName: "Resource",
                    name: "resource",
                    type: "options",
                    noDataExpression: true,
                    default: "agents",
                    options: [
                        {
                            name: "Agent",
                            value: "agents"
                        },
                        {
                            name: "Conversation",
                            value: "conversations"
                        },
                        {
                            name: "Health",
                            value: "health"
                        },
                        {
                            name: "Helpdesk",
                            value: "helpdesk"
                        },
                        {
                            name: "Source",
                            value: "sources"
                        },
                        {
                            name: "WhatsApp",
                            value: "whatsapp"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ]
                        }
                    },
                    default: "chatWithAgent",
                    options: [
                        {
                            name: "Chat With An",
                            value: "chatWithAgent",
                            action: "Chat with an agent",
                            description: "Send a message to an agent and receive a response. supports streaming responses when `stream: true` is set in the request body."
                        },
                        {
                            name: "Clone",
                            value: "cloneAgent",
                            action: "Clone agent",
                            description: "Clone an agent and its sources, excluding notion. the clone is independent. check `pendingsteps` for setup steps that need attention. plan limits return `agent_limit_reached` (403)."
                        },
                        {
                            name: "Create",
                            value: "createAgent",
                            action: "Create agent",
                            description: "Create an agent. if `URL` is provided, chatbase adds it as a link source and starts training. the agent is created even if setup fails; check `pendingsteps` for `add_source` or `train_agent`. no `pendingsteps` means setup succeeded. plan limits return `agent_limit_reached` (403)."
                        },
                        {
                            name: "Delete",
                            value: "deleteAgent",
                            action: "Delete agent",
                            description: "Permanently deletes an agent and all its sources. also disconnects any active integrations (slack, whatsapp, etc.). this action is irreversible."
                        },
                        {
                            name: "Get",
                            value: "getAgent",
                            action: "Get agent",
                            description: "Returns a single agent by ID"
                        },
                        {
                            name: "List",
                            value: "listAgents",
                            action: "List agents",
                            description: "Returns a paginated list of all agents for the authenticated account"
                        },
                        {
                            name: "Retry A Message",
                            value: "retryMessage",
                            action: "Retry message agents",
                            description: "Retry generating an assistant response for a given message. truncates the conversation at the target message, then re-sends the preceding user message through the chat service. agents."
                        },
                        {
                            name: "Start A Voice Session",
                            value: "createVoiceSession",
                            action: "Start voice session agents",
                            description: "Start a real-time voice session. pass response `data` to the chatbase voice SDK (`@chatbase-co/voice-SDK`) to connect the client. requires a plan with voice enabled; voice minutes use message credits. send {} when no options are needed. agents."
                        },
                        {
                            name: "Submit A Tool Result",
                            value: "submitToolResult",
                            action: "Submit tool result agents",
                            description: "Submit the result of a client-side tool call. use the toolcallid from the tool-call part in the chat response to identify the tool call. agents."
                        },
                        {
                            name: "Toggle Auto Retrain",
                            value: "updateAgentAutoRetrain",
                            action: "Toggle auto retrain agents",
                            description: "Enable or disable automatic retraining every 7 days. requires an agent that has been trained at least once (`agent_not_trained`, 409) and a standard plan or higher (`plan_feature_not_available`, 403)."
                        },
                        {
                            name: "Train Agent (Deprecated)",
                            value: "trainAgent",
                            action: "Train agent deprecated",
                            description: "Deprecated no-op; this endpoint always succeeds without starting training. sources train automatically after creation, update, or deletion. check source `status` or the agent `status` to track training."
                        },
                        {
                            name: "Update",
                            value: "updateAgent",
                            action: "Update agent",
                            description: "Partially updates an agent. only provided fields are changed."
                        },
                        {
                            name: "Update Agent Styles",
                            value: "updateAgentStyles",
                            action: "Update agent styles",
                            description: "Updates the visual styles for an agent"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "chatWithAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "chatWithAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Conversation ID",
                            name: "conversationId",
                            type: "string",
                            default: "",
                            description: "Optional conversation ID to continue an existing conversation. if omitted, a new conversation will be started."
                        },
                        {
                            displayName: "Message",
                            name: "message",
                            type: "string",
                            default: "",
                            description: "The user message to send to the agent. omit to continue the conversation after submitting a tool result.",
                            placeholder: "e.g. Hello, how can you help me?"
                        },
                        {
                            displayName: "Stream",
                            name: "stream",
                            type: "boolean",
                            default: true,
                            description: "Whether to stream the response as server-sent events (sse). defaults to true."
                        },
                        {
                            displayName: "User ID",
                            name: "userId",
                            type: "string",
                            default: "",
                            description: "Optional user ID for a new conversation. ignored when `conversationid` is set; the user ID on an existing conversation cannot be changed. use letters, digits, hyphens, underscores, or dots.",
                            hint: "Expected format: ^[a-zA-Z0-9._-]+$"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "cloneAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Agent name",
                    placeholder: "e.g. Support Bot",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "createAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "createAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Instructions",
                            name: "instructions",
                            type: "string",
                            default: "",
                            description: "System prompt / instructions for the agent (max 30,000 characters)"
                        },
                        {
                            displayName: "Model",
                            name: "model",
                            type: "options",
                            default: "gpt-4o-mini",
                            description: "Ai model to use",
                            placeholder: "e.g. gpt-5.6-terra",
                            options: [
                                {
                                    name: "Auto",
                                    value: "auto"
                                },
                                {
                                    name: "Claude Haiku 4 5",
                                    value: "claude-haiku-4-5"
                                },
                                {
                                    name: "Claude Opus 4 5",
                                    value: "claude-opus-4-5"
                                },
                                {
                                    name: "Claude Opus 4 6",
                                    value: "claude-opus-4-6"
                                },
                                {
                                    name: "Claude Opus 4 7",
                                    value: "claude-opus-4-7"
                                },
                                {
                                    name: "Claude Opus 4 8",
                                    value: "claude-opus-4-8"
                                },
                                {
                                    name: "Claude Opus 5 5",
                                    value: "claude-opus-5-5"
                                },
                                {
                                    name: "Claude Sonnet 4 5",
                                    value: "claude-sonnet-4-5"
                                },
                                {
                                    name: "Claude Sonnet 4 6",
                                    value: "claude-sonnet-4-6"
                                },
                                {
                                    name: "Claude Sonnet 5 5",
                                    value: "claude-sonnet-5-5"
                                },
                                {
                                    name: "DeepSeek R1",
                                    value: "DeepSeek-R1"
                                },
                                {
                                    name: "DeepSeek V3.1",
                                    value: "DeepSeek-V3.1"
                                },
                                {
                                    name: "DeepSeek V4 Flash",
                                    value: "DeepSeek-V4-Flash"
                                },
                                {
                                    name: "DeepSeek V4.1 Flash",
                                    value: "DeepSeek-V4.1-Flash"
                                },
                                {
                                    name: "Gemini 2.5 Pro",
                                    value: "gemini-2.5-pro"
                                },
                                {
                                    name: "Gemini 3 Flash",
                                    value: "gemini-3-flash"
                                },
                                {
                                    name: "Gemini 3.1 Flash Lite",
                                    value: "gemini-3.1-flash-lite"
                                },
                                {
                                    name: "Gemini 3.1 Pro",
                                    value: "gemini-3.1-pro"
                                },
                                {
                                    name: "Gemini 3.5 Flash",
                                    value: "gemini-3.5-flash"
                                },
                                {
                                    name: "Gemini 3.5 Flash Lite",
                                    value: "gemini-3.5-flash-lite"
                                },
                                {
                                    name: "Gemini 3.6 Flash",
                                    value: "gemini-3.6-flash"
                                },
                                {
                                    name: "Glm 5.2",
                                    value: "glm-5.2"
                                },
                                {
                                    name: "Glm 5.3 Flash",
                                    value: "glm-5.3-flash"
                                },
                                {
                                    name: "Gpt 4o Mini",
                                    value: "gpt-4o-mini"
                                },
                                {
                                    name: "Gpt 5 Mini",
                                    value: "gpt-5-mini"
                                },
                                {
                                    name: "Gpt 5 Nano",
                                    value: "gpt-5-nano"
                                },
                                {
                                    name: "Gpt 5.2",
                                    value: "gpt-5.2"
                                },
                                {
                                    name: "Gpt 5.5",
                                    value: "gpt-5.5"
                                },
                                {
                                    name: "Gpt 5.6 Terra",
                                    value: "gpt-5.6-terra"
                                },
                                {
                                    name: "Gpt 6 Luna",
                                    value: "gpt-6-luna"
                                },
                                {
                                    name: "Gpt 6.1 Sol",
                                    value: "gpt-6.1-sol"
                                },
                                {
                                    name: "Gpt Oss 120b",
                                    value: "gpt-oss-120b"
                                },
                                {
                                    name: "Gpt Oss 20b",
                                    value: "gpt-oss-20b"
                                },
                                {
                                    name: "Grok 3",
                                    value: "grok-3"
                                },
                                {
                                    name: "Grok 3 Mini",
                                    value: "grok-3-mini"
                                },
                                {
                                    name: "Grok 4",
                                    value: "grok-4"
                                },
                                {
                                    name: "Kimi K2.5",
                                    value: "kimi-k2.5"
                                },
                                {
                                    name: "Llama 4 Maverick 17B 128E Instruct FP8",
                                    value: "Llama-4-Maverick-17B-128E-Instruct-FP8"
                                },
                                {
                                    name: "Llama 4 Scout 17B 16E Instruct",
                                    value: "Llama-4-Scout-17B-16E-Instruct"
                                },
                                {
                                    name: "Mistral Medium 3.5",
                                    value: "mistral-medium-3.5"
                                },
                                {
                                    name: "Mistral Small 2603",
                                    value: "mistral-small-2603"
                                }
                            ]
                        },
                        {
                            displayName: "Temp",
                            name: "temp",
                            type: "number",
                            default: 0,
                            description: "Model temperature (0\u20131)",
                            placeholder: "e.g. 0",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 1
                            }
                        },
                        {
                            displayName: "URL",
                            name: "url",
                            type: "string",
                            default: "",
                            description: "Homepage URL of the product. the agent is pre-configured to answer questions about this website.",
                            placeholder: "e.g. https://example.com",
                            hint: "Expected format: uri"
                        },
                        {
                            displayName: "Visibility",
                            name: "visibility",
                            type: "options",
                            default: "public",
                            description: "Agent visibility (default: private)",
                            options: [
                                {
                                    name: "Private",
                                    value: "private"
                                },
                                {
                                    name: "Public",
                                    value: "public"
                                }
                            ]
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "createVoiceSession"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "createVoiceSession"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Conversation ID",
                            name: "conversationId",
                            type: "string",
                            default: "",
                            description: "Optional conversation UUID to group voice sessions. omit to create a new conversation. when reusing one, send the same `userid` or omit it to inherit the existing user; a different ID returns `conversation_user_mismatch`.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Timezone",
                            name: "timezone",
                            type: "string",
                            default: "UTC",
                            description: "Iana timezone of the end user (e.g. \"europe/paris\"), used by the agent for time-aware answers. defaults to UTC."
                        },
                        {
                            displayName: "User ID",
                            name: "userId",
                            type: "string",
                            default: "",
                            description: "End-user ID used for per-user voice limits. use a stable ID; if omitted, one is generated for the session or inherited from `conversationid`. sessions with the same user ID but no conversation ID create separate conversations. use letters, digits, hyphens, underscores, or dots.",
                            hint: "Expected format: ^[a-zA-Z0-9._-]+$"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "deleteAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "getAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "getAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "id",
                        "name",
                        "status",
                        "createdAt",
                        "autoRetrain",
                        "creditLimit",
                        "creditsUsed",
                        "instructions",
                        "lastMessageAt",
                        "lastTrainedAt"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "getAgent"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "AllowedDomains",
                            value: "allowedDomains"
                        },
                        {
                            name: "AutoRetrain",
                            value: "autoRetrain"
                        },
                        {
                            name: "BlockedCountries",
                            value: "blockedCountries"
                        },
                        {
                            name: "ChannelInstructions",
                            value: "channelInstructions"
                        },
                        {
                            name: "CreatedAt",
                            value: "createdAt"
                        },
                        {
                            name: "CreditLimit",
                            value: "creditLimit"
                        },
                        {
                            name: "CreditsUsed",
                            value: "creditsUsed"
                        },
                        {
                            name: "ID",
                            value: "id"
                        },
                        {
                            name: "InitialMessages",
                            value: "initialMessages"
                        },
                        {
                            name: "Instructions",
                            value: "instructions"
                        },
                        {
                            name: "IpRateLimits",
                            value: "ipRateLimits"
                        },
                        {
                            name: "LastMessageAt",
                            value: "lastMessageAt"
                        },
                        {
                            name: "LastTrainedAt",
                            value: "lastTrainedAt"
                        },
                        {
                            name: "Model",
                            value: "model"
                        },
                        {
                            name: "Name",
                            value: "name"
                        },
                        {
                            name: "NotificationsSettings",
                            value: "notificationsSettings"
                        },
                        {
                            name: "Size",
                            value: "size"
                        },
                        {
                            name: "SpamSettings",
                            value: "spamSettings"
                        },
                        {
                            name: "Status",
                            value: "status"
                        },
                        {
                            name: "Styles",
                            value: "styles"
                        },
                        {
                            name: "SuggestedMessages",
                            value: "suggestedMessages"
                        },
                        {
                            name: "Temp",
                            value: "temp"
                        },
                        {
                            name: "Visibility",
                            value: "visibility"
                        },
                        {
                            name: "VoiceSettings",
                            value: "voiceSettings"
                        }
                    ]
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "listAgents"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "retryMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "retryMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Message ID",
                    name: "messageId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The ID of the message to retry from",
                    placeholder: "e.g. msg-abc123",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "retryMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "retryMessage"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Stream",
                            name: "stream",
                            type: "boolean",
                            default: true,
                            description: "Whether to stream the response as sse. defaults to true."
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "submitToolResult"
                            ]
                        }
                    }
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "submitToolResult"
                            ]
                        }
                    }
                },
                {
                    displayName: "Tool Call ID",
                    name: "toolCallId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The toolcallid from the tool-call part in the chat response",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "submitToolResult"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "submitToolResult"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Output",
                            name: "output",
                            type: "string",
                            default: "",
                            description: "The result of executing the tool action"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "trainAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "updateAgent"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "updateAgent"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Allowed Domains",
                            name: "allowedDomains",
                            type: "json",
                            default: [],
                            description: "Allowed embed domains"
                        },
                        {
                            displayName: "Blocked Countries",
                            name: "blockedCountries",
                            type: "json",
                            default: [],
                            description: "ISO 3166-1 alpha-2 country codes to block (null = remove all blocking)",
                            placeholder: "e.g. RU,KP"
                        },
                        {
                            displayName: "Channel Instructions",
                            name: "channelInstructions",
                            type: "json",
                            default: {},
                            description: "Per-channel instruction overrides (max 30,000 characters each)"
                        },
                        {
                            displayName: "Credit Limit",
                            name: "creditLimit",
                            type: "number",
                            default: 0,
                            description: "Per-agent credit limit (null = no limit)"
                        },
                        {
                            displayName: "Initial Messages",
                            name: "initialMessages",
                            type: "json",
                            default: []
                        },
                        {
                            displayName: "Instructions",
                            name: "instructions",
                            type: "string",
                            default: "",
                            description: "System prompt (max 30,000 characters)"
                        },
                        {
                            displayName: "IP Rate Limits",
                            name: "ipRateLimits",
                            type: "json",
                            default: {},
                            description: "IP-based rate limit settings (partial update; null = reset to defaults)"
                        },
                        {
                            displayName: "Model",
                            name: "model",
                            type: "options",
                            default: "gpt-4o-mini",
                            description: "Ai model",
                            placeholder: "e.g. gpt-5.6-terra",
                            options: [
                                {
                                    name: "Auto",
                                    value: "auto"
                                },
                                {
                                    name: "Claude Haiku 4 5",
                                    value: "claude-haiku-4-5"
                                },
                                {
                                    name: "Claude Opus 4 5",
                                    value: "claude-opus-4-5"
                                },
                                {
                                    name: "Claude Opus 4 6",
                                    value: "claude-opus-4-6"
                                },
                                {
                                    name: "Claude Opus 4 7",
                                    value: "claude-opus-4-7"
                                },
                                {
                                    name: "Claude Opus 4 8",
                                    value: "claude-opus-4-8"
                                },
                                {
                                    name: "Claude Opus 5 5",
                                    value: "claude-opus-5-5"
                                },
                                {
                                    name: "Claude Sonnet 4 5",
                                    value: "claude-sonnet-4-5"
                                },
                                {
                                    name: "Claude Sonnet 4 6",
                                    value: "claude-sonnet-4-6"
                                },
                                {
                                    name: "Claude Sonnet 5 5",
                                    value: "claude-sonnet-5-5"
                                },
                                {
                                    name: "DeepSeek R1",
                                    value: "DeepSeek-R1"
                                },
                                {
                                    name: "DeepSeek V3.1",
                                    value: "DeepSeek-V3.1"
                                },
                                {
                                    name: "DeepSeek V4 Flash",
                                    value: "DeepSeek-V4-Flash"
                                },
                                {
                                    name: "DeepSeek V4.1 Flash",
                                    value: "DeepSeek-V4.1-Flash"
                                },
                                {
                                    name: "Gemini 2.5 Pro",
                                    value: "gemini-2.5-pro"
                                },
                                {
                                    name: "Gemini 3 Flash",
                                    value: "gemini-3-flash"
                                },
                                {
                                    name: "Gemini 3.1 Flash Lite",
                                    value: "gemini-3.1-flash-lite"
                                },
                                {
                                    name: "Gemini 3.1 Pro",
                                    value: "gemini-3.1-pro"
                                },
                                {
                                    name: "Gemini 3.5 Flash",
                                    value: "gemini-3.5-flash"
                                },
                                {
                                    name: "Gemini 3.5 Flash Lite",
                                    value: "gemini-3.5-flash-lite"
                                },
                                {
                                    name: "Gemini 3.6 Flash",
                                    value: "gemini-3.6-flash"
                                },
                                {
                                    name: "Glm 5.2",
                                    value: "glm-5.2"
                                },
                                {
                                    name: "Glm 5.3 Flash",
                                    value: "glm-5.3-flash"
                                },
                                {
                                    name: "Gpt 4o Mini",
                                    value: "gpt-4o-mini"
                                },
                                {
                                    name: "Gpt 5 Mini",
                                    value: "gpt-5-mini"
                                },
                                {
                                    name: "Gpt 5 Nano",
                                    value: "gpt-5-nano"
                                },
                                {
                                    name: "Gpt 5.2",
                                    value: "gpt-5.2"
                                },
                                {
                                    name: "Gpt 5.5",
                                    value: "gpt-5.5"
                                },
                                {
                                    name: "Gpt 5.6 Terra",
                                    value: "gpt-5.6-terra"
                                },
                                {
                                    name: "Gpt 6 Luna",
                                    value: "gpt-6-luna"
                                },
                                {
                                    name: "Gpt 6.1 Sol",
                                    value: "gpt-6.1-sol"
                                },
                                {
                                    name: "Gpt Oss 120b",
                                    value: "gpt-oss-120b"
                                },
                                {
                                    name: "Gpt Oss 20b",
                                    value: "gpt-oss-20b"
                                },
                                {
                                    name: "Grok 3",
                                    value: "grok-3"
                                },
                                {
                                    name: "Grok 3 Mini",
                                    value: "grok-3-mini"
                                },
                                {
                                    name: "Grok 4",
                                    value: "grok-4"
                                },
                                {
                                    name: "Kimi K2.5",
                                    value: "kimi-k2.5"
                                },
                                {
                                    name: "Llama 4 Maverick 17B 128E Instruct FP8",
                                    value: "Llama-4-Maverick-17B-128E-Instruct-FP8"
                                },
                                {
                                    name: "Llama 4 Scout 17B 16E Instruct",
                                    value: "Llama-4-Scout-17B-16E-Instruct"
                                },
                                {
                                    name: "Mistral Medium 3.5",
                                    value: "mistral-medium-3.5"
                                },
                                {
                                    name: "Mistral Small 2603",
                                    value: "mistral-small-2603"
                                }
                            ]
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Agent name"
                        },
                        {
                            displayName: "Notifications Settings",
                            name: "notificationsSettings",
                            type: "json",
                            default: {},
                            description: "Email notification settings (null = disable all notifications)"
                        },
                        {
                            displayName: "Spam Settings",
                            name: "spamSettings",
                            type: "json",
                            default: {},
                            description: "Spam detection settings (null = disable spam detection)"
                        },
                        {
                            displayName: "Suggested Messages",
                            name: "suggestedMessages",
                            type: "json",
                            default: []
                        },
                        {
                            displayName: "Temp",
                            name: "temp",
                            type: "number",
                            default: 0,
                            description: "Temperature (0\u20131)",
                            typeOptions: {
                                minValue: 0,
                                maxValue: 1
                            }
                        },
                        {
                            displayName: "Visibility",
                            name: "visibility",
                            type: "options",
                            default: "public",
                            options: [
                                {
                                    name: "Private",
                                    value: "private"
                                },
                                {
                                    name: "Public",
                                    value: "public"
                                }
                            ]
                        },
                        {
                            displayName: "Voice Settings",
                            name: "voiceSettings",
                            type: "json",
                            default: {},
                            description: "Voice mode configuration (null = disable voice mode)"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "updateAgentAutoRetrain"
                            ]
                        }
                    }
                },
                {
                    displayName: "Enabled",
                    name: "enabled",
                    type: "boolean",
                    default: false,
                    required: true,
                    description: "Whether true = retrain every 7 days, false = never",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "updateAgentAutoRetrain"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "updateAgentStyles"
                            ]
                        }
                    }
                },
                {
                    displayName: "Styles",
                    name: "styles",
                    type: "collection",
                    default: {},
                    placeholder: "Add Field",
                    options: [
                        {
                            displayName: "Center Stage",
                            name: "centerStage",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Accent Color",
                                    name: "accentColor",
                                    type: "color",
                                    default: {},
                                    description: "Custom accent color override for interactive elements"
                                },
                                {
                                    displayName: "Button Color",
                                    name: "buttonColor",
                                    type: "color",
                                    default: "",
                                    description: "Primary accent / send-button color (hex)",
                                    placeholder: "e.g. #1A2B3C",
                                    hint: "Expected format: ^#([0-9A-F]{3}){1,2}$/i"
                                },
                                {
                                    displayName: "Close On Outside Click",
                                    name: "closeOnOutsideClick",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether close the widget when the user clicks outside of it"
                                },
                                {
                                    displayName: "Custom Surface Colors",
                                    name: "customSurfaceColors",
                                    type: "color",
                                    default: {},
                                    description: "Override the widget background and foreground colors"
                                },
                                {
                                    displayName: "Dismissable Notice",
                                    name: "dismissableNotice",
                                    type: "string",
                                    default: "",
                                    description: "Text shown in a dismissable banner inside the widget. empty string = hidden (max 500 chars)."
                                },
                                {
                                    displayName: "Display Name",
                                    name: "displayName",
                                    type: "string",
                                    default: "",
                                    description: "Name shown in the widget header. defaults to the agent name (max 100 chars)."
                                },
                                {
                                    displayName: "Enabled",
                                    name: "enabled",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether enable or disable the center stage widget entirely"
                                },
                                {
                                    displayName: "Footer",
                                    name: "footer",
                                    type: "string",
                                    default: "",
                                    description: "Small text below the input bar, e.g. branding or legal notice (max 500 chars)"
                                },
                                {
                                    displayName: "Header Color",
                                    name: "headerColor",
                                    type: "color",
                                    default: "",
                                    description: "Header bar background color (hex)",
                                    placeholder: "e.g. #1A2B3C",
                                    hint: "Expected format: ^#([0-9A-F]{3}){1,2}$/i"
                                },
                                {
                                    displayName: "Message Placeholder",
                                    name: "messagePlaceholder",
                                    type: "string",
                                    default: "",
                                    description: "Placeholder text inside the message input field (max 200 chars)"
                                },
                                {
                                    displayName: "Notification Indicator",
                                    name: "notificationIndicator",
                                    type: "collection",
                                    default: {
                                        enabled: false,
                                        number: 0
                                    },
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Enabled",
                                            name: "enabled",
                                            type: "boolean",
                                            default: false,
                                            description: "Whether the notification badge is shown"
                                        },
                                        {
                                            displayName: "Number",
                                            name: "number",
                                            type: "number",
                                            default: 0,
                                            description: "Number displayed in the badge (0\u201399)",
                                            placeholder: "e.g. 3",
                                            typeOptions: {
                                                minValue: 0,
                                                maxValue: 99
                                            }
                                        }
                                    ],
                                    description: "Numeric badge on the launcher to draw attention before the user opens the widget"
                                },
                                {
                                    displayName: "Notification Message",
                                    name: "notificationMessage",
                                    type: "collection",
                                    default: {
                                        enabled: false,
                                        text: ""
                                    },
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Enabled",
                                            name: "enabled",
                                            type: "boolean",
                                            default: false,
                                            description: "Whether the notification message bubble is shown"
                                        },
                                        {
                                            displayName: "Text",
                                            name: "text",
                                            type: "string",
                                            default: "",
                                            description: "Message text displayed in the bubble (max 200 chars)"
                                        }
                                    ],
                                    description: "Floating message bubble next to the launcher shown before the user opens the widget"
                                },
                                {
                                    displayName: "Show Attachments",
                                    name: "showAttachments",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether allow users to attach files to their messages"
                                },
                                {
                                    displayName: "Show Chat Bubble",
                                    name: "showChatBubble",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether wrap agent messages in a chat bubble style"
                                },
                                {
                                    displayName: "Show Copy Button",
                                    name: "showCopyButton",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show a copy-to-clipboard button on agent messages"
                                },
                                {
                                    displayName: "Show Data Source",
                                    name: "showDataSource",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show the source citation below agent messages"
                                },
                                {
                                    displayName: "Show Dictation",
                                    name: "showDictation",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show a microphone button for speech-to-text input"
                                },
                                {
                                    displayName: "Show Feedback",
                                    name: "showFeedback",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show thumbs-up / thumbs-down feedback buttons on agent messages"
                                },
                                {
                                    displayName: "Show Voice Mode",
                                    name: "showVoiceMode",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show the voice-conversation mode button"
                                },
                                {
                                    displayName: "Suggested Messages",
                                    name: "suggestedMessages",
                                    type: "json",
                                    default: [],
                                    description: "Quick-reply buttons shown to the user at the start of the conversation"
                                },
                                {
                                    displayName: "Theme",
                                    name: "theme",
                                    type: "options",
                                    default: "light",
                                    description: "Widget color theme",
                                    placeholder: "e.g. light",
                                    options: [
                                        {
                                            name: "Dark",
                                            value: "dark"
                                        },
                                        {
                                            name: "Light",
                                            value: "light"
                                        }
                                    ]
                                },
                                {
                                    displayName: "Tinted Grayscale",
                                    name: "tintedGrayscale",
                                    type: "collection",
                                    default: {
                                        enabled: false,
                                        hue: 0,
                                        shade: 0,
                                        tint: 0
                                    },
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Enabled",
                                            name: "enabled",
                                            type: "boolean",
                                            default: false,
                                            description: "Whether tinted grayscale is active"
                                        },
                                        {
                                            displayName: "Hue",
                                            name: "hue",
                                            type: "number",
                                            default: 0,
                                            description: "Base hue for the grayscale tint (0\u2013360\u00B0)",
                                            placeholder: "e.g. 220",
                                            typeOptions: {
                                                minValue: 0,
                                                maxValue: 360
                                            }
                                        },
                                        {
                                            displayName: "Shade",
                                            name: "shade",
                                            type: "number",
                                            default: 0,
                                            description: "Amount of hue mixed into darker tones (0\u201310)",
                                            placeholder: "e.g. 3",
                                            typeOptions: {
                                                minValue: 0,
                                                maxValue: 10
                                            }
                                        },
                                        {
                                            displayName: "Tint",
                                            name: "tint",
                                            type: "number",
                                            default: 0,
                                            description: "Amount of hue mixed into lighter tones (0\u201310)",
                                            placeholder: "e.g. 3",
                                            typeOptions: {
                                                minValue: 0,
                                                maxValue: 10
                                            }
                                        }
                                    ],
                                    description: "Tinted grayscale palette. when enabled the widget uses shades of a single hue instead of neutral gray."
                                },
                                {
                                    displayName: "Typography",
                                    name: "typography",
                                    type: "collection",
                                    default: {
                                        fontFamily: "Inter",
                                        fontSize: "12px"
                                    },
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Font Family",
                                            name: "fontFamily",
                                            type: "options",
                                            default: "Inter",
                                            description: "Widget font family",
                                            placeholder: "e.g. Inter",
                                            options: [
                                                {
                                                    name: "Arial",
                                                    value: "Arial"
                                                },
                                                {
                                                    name: "Geist",
                                                    value: "Geist"
                                                },
                                                {
                                                    name: "Georgia",
                                                    value: "Georgia"
                                                },
                                                {
                                                    name: "Helvetica",
                                                    value: "Helvetica"
                                                },
                                                {
                                                    name: "Inter",
                                                    value: "Inter"
                                                },
                                                {
                                                    name: "System",
                                                    value: "System"
                                                }
                                            ]
                                        },
                                        {
                                            displayName: "Font Size",
                                            name: "fontSize",
                                            type: "options",
                                            default: "12px",
                                            description: "Widget base font size",
                                            placeholder: "e.g. 16px",
                                            options: [
                                                {
                                                    name: "12px",
                                                    value: "12px"
                                                },
                                                {
                                                    name: "14px",
                                                    value: "14px"
                                                },
                                                {
                                                    name: "16px",
                                                    value: "16px"
                                                },
                                                {
                                                    name: "18px",
                                                    value: "18px"
                                                },
                                                {
                                                    name: "20px",
                                                    value: "20px"
                                                }
                                            ]
                                        }
                                    ],
                                    description: "Widget font family and size"
                                },
                                {
                                    displayName: "User Message Color",
                                    name: "userMessageColor",
                                    type: "color",
                                    default: "",
                                    description: "User message bubble background color (hex)",
                                    placeholder: "e.g. #1A2B3C",
                                    hint: "Expected format: ^#([0-9A-F]{3}){1,2}$/i"
                                },
                                {
                                    displayName: "Welcome Message",
                                    name: "welcomeMessage",
                                    type: "string",
                                    default: "",
                                    description: "Greeting text shown above the message input when the conversation is empty (max 500 chars)"
                                },
                                {
                                    displayName: "Width",
                                    name: "width",
                                    type: "options",
                                    default: "small",
                                    description: "Widget width preset (small \u2248 360 px, medium \u2248 420 px, large \u2248 520 px)",
                                    placeholder: "e.g. medium",
                                    options: [
                                        {
                                            name: "Large",
                                            value: "large"
                                        },
                                        {
                                            name: "Medium",
                                            value: "medium"
                                        },
                                        {
                                            name: "Small",
                                            value: "small"
                                        }
                                    ]
                                }
                            ],
                            description: "Center stage widget styles"
                        },
                        {
                            displayName: "Chat",
                            name: "chat",
                            type: "collection",
                            default: {},
                            placeholder: "Add Field",
                            options: [
                                {
                                    displayName: "Align Chat Button",
                                    name: "alignChatButton",
                                    type: "options",
                                    default: "left",
                                    description: "Corner the launcher button is anchored to",
                                    placeholder: "e.g. right",
                                    options: [
                                        {
                                            name: "Left",
                                            value: "left"
                                        },
                                        {
                                            name: "Right",
                                            value: "right"
                                        }
                                    ]
                                },
                                {
                                    displayName: "Auto Open Chat Window After",
                                    name: "autoOpenChatWindowAfter",
                                    type: "number",
                                    default: 0,
                                    description: "Seconds after page load before the chat window opens automatically. null = disabled.",
                                    placeholder: "e.g. 5"
                                },
                                {
                                    displayName: "Button Color",
                                    name: "buttonColor",
                                    type: "color",
                                    default: {
                                        schemaAlternative: "alternative1",
                                        value: ""
                                    },
                                    description: "Chat launcher button and primary accent color. pass a hex code or \"transparent\".",
                                    placeholder: "e.g. #1A2B3C"
                                },
                                {
                                    displayName: "Dismissable Notice",
                                    name: "dismissableNotice",
                                    type: "string",
                                    default: "",
                                    description: "Text shown in a dismissable banner above the chat. empty string = hidden (max 500 chars)."
                                },
                                {
                                    displayName: "Display Name",
                                    name: "displayName",
                                    type: "string",
                                    default: "",
                                    description: "Name displayed in the chat header. defaults to the agent name (max 100 chars)."
                                },
                                {
                                    displayName: "Footer",
                                    name: "footer",
                                    type: "string",
                                    default: "",
                                    description: "Small text shown below the input bar, e.g. branding or legal notice (max 500 chars)"
                                },
                                {
                                    displayName: "Header Color",
                                    name: "headerColor",
                                    type: "color",
                                    default: "",
                                    description: "Chat header background color (hex, e.g. #1a2b3c)",
                                    placeholder: "e.g. #1A2B3C",
                                    hint: "Expected format: ^#([0-9A-F]{3}){1,2}$/i"
                                },
                                {
                                    displayName: "Message Placeholder",
                                    name: "messagePlaceholder",
                                    type: "string",
                                    default: "",
                                    description: "Placeholder text shown inside the message input field (max 200 chars)"
                                },
                                {
                                    displayName: "Mobile",
                                    name: "mobile",
                                    type: "collection",
                                    default: {},
                                    placeholder: "Add Field",
                                    options: [
                                        {
                                            displayName: "Auto Open Chat Window After",
                                            name: "autoOpenChatWindowAfter",
                                            type: "json",
                                            default: {}
                                        },
                                        {
                                            displayName: "Initial Messages",
                                            name: "initialMessages",
                                            type: "json",
                                            default: {}
                                        },
                                        {
                                            displayName: "Show Auto Open",
                                            name: "showAutoOpen",
                                            type: "boolean",
                                            default: false,
                                            description: "Whether to enable show auto open"
                                        }
                                    ],
                                    description: "Mobile-specific overrides for initial messages and auto-open timing"
                                },
                                {
                                    displayName: "Show Attachments",
                                    name: "showAttachments",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether allow users to attach files to their messages"
                                },
                                {
                                    displayName: "Show Copy Button",
                                    name: "showCopyButton",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show a copy-to-clipboard button on agent messages"
                                },
                                {
                                    displayName: "Show Dictation",
                                    name: "showDictation",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show a microphone button for speech-to-text input"
                                },
                                {
                                    displayName: "Show Feedback",
                                    name: "showFeedback",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show thumbs-up / thumbs-down buttons on agent messages"
                                },
                                {
                                    displayName: "Show Voice Mode",
                                    name: "showVoiceMode",
                                    type: "boolean",
                                    default: false,
                                    description: "Whether show the voice-conversation mode button in the chat"
                                },
                                {
                                    displayName: "Theme",
                                    name: "theme",
                                    type: "options",
                                    default: "light",
                                    description: "Widget color theme",
                                    placeholder: "e.g. light",
                                    options: [
                                        {
                                            name: "Dark",
                                            value: "dark"
                                        },
                                        {
                                            name: "Light",
                                            value: "light"
                                        }
                                    ]
                                },
                                {
                                    displayName: "User Message Color",
                                    name: "userMessageColor",
                                    type: "color",
                                    default: "",
                                    description: "User message bubble background color (hex)",
                                    placeholder: "e.g. #1A2B3C",
                                    hint: "Expected format: ^#([0-9A-F]{3}){1,2}$/i"
                                }
                            ],
                            description: "Chat widget styles"
                        }
                    ],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "agents"
                            ],
                            operation: [
                                "updateAgentStyles"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ]
                        }
                    },
                    default: "exportConversations",
                    options: [
                        {
                            name: "Export",
                            value: "exportConversations",
                            action: "Export conversations",
                            description: "Export full message histories across all conversation sources. tool results are sanitized. supports cursor pagination and filters for `conversationid`, `source`, and `startdate`/`enddate` (created-at window). set `include=summary` to omit message bodies."
                        },
                        {
                            name: "Get A",
                            value: "getConversation",
                            action: "Get conversation",
                            description: "Get conversation metadata and its latest messages. use its cursor with list conversation messages to fetch older messages. this endpoint returns API-created conversations only; use export conversations with `conversationid` for widget, whatsapp, and other sources."
                        },
                        {
                            name: "List",
                            value: "listConversations",
                            action: "List conversations",
                            description: "List conversations for an agent, ordered by createdat date. supports cursor-based pagination. pass `startdate` and/or `enddate` to restrict the results to a createdat window."
                        },
                        {
                            name: "List Conversation Messages",
                            value: "listConversationMessages",
                            action: "List conversation messages",
                            description: "List all messages in a conversation with cursor-based pagination. messages are returned in chronological order within each page, paginating backward from newest. the cursor from the get-conversation endpoint works here."
                        },
                        {
                            name: "List Conversations For A User",
                            value: "listUserConversations",
                            action: "List conversations for a user",
                            description: "List conversations for a specific user under an agent, ordered by last activity. supports cursor-based pagination."
                        },
                        {
                            name: "Pause Or Resume A",
                            value: "updateConversation",
                            action: "Pause or resume a conversation",
                            description: "Pause or resume an ongoing conversation. a paused conversation stops receiving ai replies but still records incoming messages."
                        },
                        {
                            name: "Search",
                            value: "searchConversations",
                            action: "Search conversations",
                            description: "Searches conversations created since the first of the month 12 months ago (UTC). text matches are ranked with snippets; without `query`, results sort by activity. filters use and across fields and or for comma-separated values. results may lag; follow the cursor while `hasmore` is true, including after an empty page. use export conversations with `conversationid` to read messages."
                        },
                        {
                            name: "Update Message Feedback",
                            value: "updateMessageFeedback",
                            action: "Update message feedback conversations",
                            description: "Set or clear feedback on an assistant message. use \"positive\" or \"negative\" to set feedback, or null to remove existing feedback. conversations."
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "exportConversations"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "exportConversations"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Conversation ID",
                            name: "conversationId",
                            type: "string",
                            default: "",
                            description: "Return only the conversation with this ID. use this to fetch a single conversation from any source (widget, API, whatsapp, etc)."
                        },
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "End Date",
                            name: "endDate",
                            type: "string",
                            default: "",
                            description: "Only return conversations created at or before this point. accepts a calendar date (`yyyy-mm-dd`, interpreted as the *end* of that day in UTC, so the day itself is included) or an ISO 8601 date-time.",
                            placeholder: "e.g. 2024-01-31"
                        },
                        {
                            displayName: "Include",
                            name: "include",
                            type: "options",
                            default: "messages",
                            description: "Whether to include message bodies. `summary` omits them and skips reading them from the database \u2014 use it to triage a page cheaply, then re-request a specific conversation with `conversationid`. defaults to `messages`.",
                            placeholder: "e.g. summary",
                            options: [
                                {
                                    name: "Messages",
                                    value: "messages"
                                },
                                {
                                    name: "Summary",
                                    value: "summary"
                                }
                            ]
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Source",
                            name: "source",
                            type: "string",
                            default: "",
                            description: "Comma-separated conversation sources to include, e.g. `API,whatsapp`. omit for all sources.",
                            placeholder: "e.g. Widget or Iframe"
                        },
                        {
                            displayName: "Start Date",
                            name: "startDate",
                            type: "string",
                            default: "",
                            description: "Only return conversations created at or after this point. accepts a calendar date (`yyyy-mm-dd`, interpreted as the start of that day in UTC) or an ISO 8601 date-time.",
                            placeholder: "e.g. 2024-01-01"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "getConversation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "getConversation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listConversationMessages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listConversationMessages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listConversationMessages"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listConversations"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listConversations"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "End Date",
                            name: "endDate",
                            type: "string",
                            default: "",
                            description: "Only return conversations created at or before this point. accepts a calendar date (`yyyy-mm-dd`, interpreted as the *end* of that day in UTC, so the day itself is included) or an ISO 8601 date-time.",
                            placeholder: "e.g. 2024-01-31"
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Start Date",
                            name: "startDate",
                            type: "string",
                            default: "",
                            description: "Only return conversations created at or after this point. accepts a calendar date (`yyyy-mm-dd`, interpreted as the start of that day in UTC) or an ISO 8601 date-time.",
                            placeholder: "e.g. 2024-01-01"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listUserConversations"
                            ]
                        }
                    }
                },
                {
                    displayName: "User ID",
                    name: "userId",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The user ID (URL-safe characters only: letters, digits, hyphens, underscores, dots)",
                    placeholder: "e.g. user_abc123",
                    hint: "Expected format: ^[a-zA-Z0-9._-]+$",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listUserConversations"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "listUserConversations"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "searchConversations"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "searchConversations"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Action Type",
                            name: "actionType",
                            type: "string",
                            default: "",
                            description: "Comma-separated action types that ran, e.g. `collect-leads`"
                        },
                        {
                            displayName: "Activity State",
                            name: "activityState",
                            type: "string",
                            default: "",
                            description: "Comma-separated: `ongoing`, `ended`, `taken_over`, `paused`",
                            placeholder: "e.g. taken_over"
                        },
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "`Pagination.cursor` from the previous page. keep the other parameters unchanged."
                        },
                        {
                            displayName: "End Date",
                            name: "endDate",
                            type: "string",
                            default: "",
                            description: "Created at or before this point (`yyyy-mm-dd`, inclusive, or ISO 8601)"
                        },
                        {
                            displayName: "Escalated",
                            name: "escalated",
                            type: "options",
                            default: "true",
                            description: "`True`: only conversations escalated to a human (ticket or live-chat handoff)",
                            placeholder: "e.g. true",
                            options: [
                                {
                                    name: "True",
                                    value: "true"
                                }
                            ]
                        },
                        {
                            displayName: "Feedback",
                            name: "feedback",
                            type: "string",
                            default: "",
                            description: "Comma-separated message ratings: `positive`, `negative`",
                            placeholder: "e.g. negative"
                        },
                        {
                            displayName: "Has Voice",
                            name: "hasVoice",
                            type: "options",
                            default: "true",
                            description: "Whether a voice session took place",
                            options: [
                                {
                                    name: "False",
                                    value: "false"
                                },
                                {
                                    name: "True",
                                    value: "true"
                                }
                            ]
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 25",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Procedure",
                            name: "procedure",
                            type: "string",
                            default: "",
                            description: "Comma-separated procedure names that ran"
                        },
                        {
                            displayName: "Procedure Outcome",
                            name: "procedureOutcome",
                            type: "string",
                            default: "",
                            description: "Comma-separated procedure run statuses. scoped to `procedure` when set.",
                            placeholder: "e.g. completed"
                        },
                        {
                            displayName: "Query",
                            name: "query",
                            type: "string",
                            default: "",
                            description: "Free-text search over messages and titles",
                            placeholder: "e.g. refund"
                        },
                        {
                            displayName: "Sentiment",
                            name: "sentiment",
                            type: "string",
                            default: "",
                            description: "Comma-separated: `positive`, `neutral`, `negative`, or `unspecified` for none",
                            placeholder: "e.g. negative"
                        },
                        {
                            displayName: "Source",
                            name: "source",
                            type: "string",
                            default: "",
                            description: "Comma-separated sources, e.g. `API,whatsapp`",
                            placeholder: "e.g. Widget or Iframe"
                        },
                        {
                            displayName: "Start Date",
                            name: "startDate",
                            type: "string",
                            default: "",
                            description: "Created at or after this point (`yyyy-mm-dd` or ISO 8601). must be inside the searchable window."
                        },
                        {
                            displayName: "Tool",
                            name: "tool",
                            type: "string",
                            default: "",
                            description: "Comma-separated tool names that were called"
                        },
                        {
                            displayName: "Tool Outcome",
                            name: "toolOutcome",
                            type: "string",
                            default: "",
                            description: "Comma-separated tool result statuses, e.g. `error`. scoped to `tool` when set.",
                            placeholder: "e.g. error"
                        },
                        {
                            displayName: "Topic",
                            name: "topic",
                            type: "string",
                            default: "",
                            description: "Comma-separated topic names, or `unspecified` for none",
                            placeholder: "e.g. billing"
                        },
                        {
                            displayName: "Updated After",
                            name: "updatedAfter",
                            type: "string",
                            default: "",
                            description: "Last active at or after this point (`yyyy-mm-dd` or ISO 8601)"
                        },
                        {
                            displayName: "Updated Before",
                            name: "updatedBefore",
                            type: "string",
                            default: "",
                            description: "Last active at or before this point (`yyyy-mm-dd`, inclusive, or ISO 8601)"
                        },
                        {
                            displayName: "User ID",
                            name: "userId",
                            type: "string",
                            default: "",
                            description: "Comma-separated user IDs"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateConversation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateConversation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Paused",
                    name: "paused",
                    type: "boolean",
                    default: false,
                    required: true,
                    description: "Whether set to true to pause, false to resume",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateConversation"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateMessageFeedback"
                            ]
                        }
                    }
                },
                {
                    displayName: "Conversation ID",
                    name: "conversationId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateMessageFeedback"
                            ]
                        }
                    }
                },
                {
                    displayName: "Message ID",
                    name: "messageId",
                    type: "string",
                    default: "",
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateMessageFeedback"
                            ]
                        }
                    }
                },
                {
                    displayName: "Feedback",
                    name: "feedback",
                    type: "options",
                    default: "positive",
                    required: true,
                    description: "Set feedback: \"positive\", \"negative\", or null to clear",
                    options: [
                        {
                            name: "Negative",
                            value: "negative"
                        },
                        {
                            name: "Null",
                            value: "null"
                        },
                        {
                            name: "Positive",
                            value: "positive"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "conversations"
                            ],
                            operation: [
                                "updateMessageFeedback"
                            ]
                        }
                    }
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "health"
                            ]
                        }
                    },
                    default: "getHealth",
                    options: [
                        {
                            name: "Health Check",
                            value: "getHealth",
                            action: "Health check",
                            description: "Returns the API health status. no authentication required."
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ]
                        }
                    },
                    default: "createTicket",
                    options: [
                        {
                            name: "Add A Message To A Ticket",
                            value: "createTicketMessage",
                            action: "Add message to a ticket helpdesk",
                            description: "Posts an agent reply to a ticket on behalf of a team member. delivery to the customer is asynchronous; a 201 confirms the reply was recorded, not delivered. posting a reply may transition the ticket status, matching dashboard behavior. helpdesk."
                        },
                        {
                            name: "Create A Ticket",
                            value: "createTicket",
                            action: "Create ticket helpdesk",
                            description: "Creates a ticket on behalf of a customer. unless an assignee is provided, the ticket is auto-assigned via the agent's routing rules. helpdesk."
                        },
                        {
                            name: "Get A Ticket",
                            value: "getTicket",
                            action: "Get ticket helpdesk",
                            description: "Returns a single ticket by its per-agent ticket number. helpdesk."
                        },
                        {
                            name: "List Teams",
                            value: "listHelpdeskTeams",
                            action: "List teams helpdesk",
                            description: "Returns the teams configured for an agent, ordered by creation date. exactly one team is marked as the default for the agent. helpdesk."
                        },
                        {
                            name: "List Ticket Messages",
                            value: "listTicketMessages",
                            action: "List ticket messages helpdesk",
                            description: "Returns a ticket's message thread in chronological order. supports cursor-based pagination. helpdesk."
                        },
                        {
                            name: "List Ticket Statuses",
                            value: "listTicketStatuses",
                            action: "List ticket statuses helpdesk",
                            description: "Returns the active (non-archived) ticket statuses configured for an agent, ordered by category then position. each category has exactly one default status. helpdesk."
                        },
                        {
                            name: "List Tickets",
                            value: "listTickets",
                            action: "List tickets helpdesk",
                            description: "Returns tickets for an agent, sorted by `updatedat` descending by default. supports filtering and cursor-based pagination. filters combine with and across parameters. helpdesk."
                        },
                        {
                            name: "Search Tickets",
                            value: "searchTickets",
                            action: "Search tickets helpdesk",
                            description: "Searches ticket messages with a free-text query and returns matching tickets ranked by relevance. results are capped and not paginated. helpdesk."
                        },
                        {
                            name: "Update A Ticket",
                            value: "updateTicket",
                            action: "Update ticket helpdesk",
                            description: "Partially updates a ticket's status, assignee, team, or priority. only provided fields are changed. fields are validated together but written independently, so a 500 can leave a partial update. helpdesk."
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Customer",
                    name: "customer",
                    type: "collection",
                    default: {
                        email: ""
                    },
                    placeholder: "Add Field",
                    options: [
                        {
                            displayName: "Email",
                            name: "email",
                            type: "string",
                            default: "",
                            description: "Resolves to an existing chatbot_users row for this agent, or creates one",
                            placeholder: "e.g. jane@example.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Used only when creating a new customer record; ignored if the email already resolves",
                            placeholder: "e.g. Jane Doe"
                        }
                    ],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Description",
                    name: "description",
                    type: "string",
                    default: "",
                    required: true,
                    description: "The first message body, written as a reply authored by the customer (1-10,000 characters)",
                    placeholder: "e.g. Customer cannot export orders.",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Subject",
                    name: "subject",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Ticket subject (1-500 characters)",
                    placeholder: "e.g. Export failing with 500",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Assignee Email",
                            name: "assigneeEmail",
                            type: "string",
                            default: "",
                            description: "Email of the agent to assign (case-insensitive). provide at most one of assigneeid / assigneeemail.",
                            placeholder: "e.g. sam@example.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Assignee ID",
                            name: "assigneeId",
                            type: "string",
                            default: "",
                            description: "Platform user ID of the agent to assign. provide at most one of assigneeid / assigneeemail. pass `null` to explicitly create the ticket unassigned (suppresses auto-assignment); omit to let auto-assignment apply.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Priority",
                            name: "priority",
                            type: "options",
                            default: "none",
                            description: "Ticket priority. defaults to `none` (untriaged) when omitted.",
                            placeholder: "e.g. high",
                            options: [
                                {
                                    name: "High",
                                    value: "high"
                                },
                                {
                                    name: "Low",
                                    value: "low"
                                },
                                {
                                    name: "None",
                                    value: "none"
                                },
                                {
                                    name: "Normal",
                                    value: "normal"
                                },
                                {
                                    name: "Urgent",
                                    value: "urgent"
                                }
                            ]
                        },
                        {
                            displayName: "Status Category",
                            name: "statusCategory",
                            type: "options",
                            default: "new",
                            description: "Status category; resolves to that category's default status. provide at most one of statusid / statuscategory. defaults to the \"new\" category default when neither is provided.",
                            placeholder: "e.g. new",
                            options: [
                                {
                                    name: "Cancelled",
                                    value: "cancelled"
                                },
                                {
                                    name: "Closed",
                                    value: "closed"
                                },
                                {
                                    name: "New",
                                    value: "new"
                                },
                                {
                                    name: "On Customer",
                                    value: "on_customer"
                                },
                                {
                                    name: "On Hold",
                                    value: "on_hold"
                                },
                                {
                                    name: "On You",
                                    value: "on_you"
                                }
                            ]
                        },
                        {
                            displayName: "Status ID",
                            name: "statusId",
                            type: "string",
                            default: "",
                            description: "ID of an existing status for this agent. provide at most one of statusid / statuscategory.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Team ID",
                            name: "teamId",
                            type: "string",
                            default: "",
                            description: "Team ID for this agent. without an assignee field, a team member is assigned using the team's strategy, and agent routing rules are skipped. with `assigneeid` or `assigneeemail` (including `assigneeid: null`), auto-assignment is skipped and the team is set as provided.",
                            hint: "Expected format: uuid"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "description",
                        "createdAt",
                        "updatedAt",
                        "assigneeId",
                        "channel",
                        "conversationId",
                        "lastMessageAt",
                        "priority",
                        "statusCategory",
                        "statusId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicket"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "AssigneeId",
                            value: "assigneeId"
                        },
                        {
                            name: "Channel",
                            value: "channel"
                        },
                        {
                            name: "ConversationId",
                            value: "conversationId"
                        },
                        {
                            name: "CreatedAt",
                            value: "createdAt"
                        },
                        {
                            name: "Customer",
                            value: "customer"
                        },
                        {
                            name: "Description",
                            value: "description"
                        },
                        {
                            name: "LastMessageAt",
                            value: "lastMessageAt"
                        },
                        {
                            name: "Metadata",
                            value: "metadata"
                        },
                        {
                            name: "Priority",
                            value: "priority"
                        },
                        {
                            name: "StatusCategory",
                            value: "statusCategory"
                        },
                        {
                            name: "StatusId",
                            value: "statusId"
                        },
                        {
                            name: "Subject",
                            value: "subject"
                        },
                        {
                            name: "TeamId",
                            value: "teamId"
                        },
                        {
                            name: "TicketNumber",
                            value: "ticketNumber"
                        },
                        {
                            name: "UpdatedAt",
                            value: "updatedAt"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicketMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Ticket Number",
                    name: "ticketNumber",
                    type: "number",
                    default: 0,
                    required: true,
                    placeholder: "e.g. 123",
                    typeOptions: {
                        maxValue: 2147483647
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicketMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Content",
                    name: "content",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Message body as github-flavored markdown. plain text is valid markdown; single newlines are kept as line breaks. raw inline HTML is stripped. limited to 10,000 characters after trimming.",
                    placeholder: "e.g. Thanks for reaching out. This is **fixed** now.",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicketMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Type",
                    name: "type",
                    type: "options",
                    default: "reply",
                    required: true,
                    description: "Message type. only `reply` (customer-visible, delivered to the customer) is supported.",
                    placeholder: "e.g. reply",
                    options: [
                        {
                            name: "Reply",
                            value: "reply"
                        }
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicketMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "createTicketMessage"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Author Email",
                            name: "authorEmail",
                            type: "string",
                            default: "",
                            description: "Email of the team member the reply is attributed to (case-insensitive). provide exactly one of authorid / authoremail.",
                            placeholder: "e.g. sam@example.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Author ID",
                            name: "authorId",
                            type: "string",
                            default: "",
                            description: "Platform user ID of the team member the reply is attributed to. provide exactly one of authorid / authoremail.",
                            hint: "Expected format: uuid"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "getTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Ticket Number",
                    name: "ticketNumber",
                    type: "number",
                    default: 0,
                    required: true,
                    placeholder: "e.g. 123",
                    typeOptions: {
                        maxValue: 2147483647
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "getTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "getTicket"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "description",
                        "createdAt",
                        "updatedAt",
                        "assigneeId",
                        "channel",
                        "conversationId",
                        "lastMessageAt",
                        "priority",
                        "statusCategory",
                        "statusId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "getTicket"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "AssigneeId",
                            value: "assigneeId"
                        },
                        {
                            name: "Channel",
                            value: "channel"
                        },
                        {
                            name: "ConversationId",
                            value: "conversationId"
                        },
                        {
                            name: "CreatedAt",
                            value: "createdAt"
                        },
                        {
                            name: "Customer",
                            value: "customer"
                        },
                        {
                            name: "Description",
                            value: "description"
                        },
                        {
                            name: "LastMessageAt",
                            value: "lastMessageAt"
                        },
                        {
                            name: "Metadata",
                            value: "metadata"
                        },
                        {
                            name: "Priority",
                            value: "priority"
                        },
                        {
                            name: "StatusCategory",
                            value: "statusCategory"
                        },
                        {
                            name: "StatusId",
                            value: "statusId"
                        },
                        {
                            name: "Subject",
                            value: "subject"
                        },
                        {
                            name: "TeamId",
                            value: "teamId"
                        },
                        {
                            name: "TicketNumber",
                            value: "ticketNumber"
                        },
                        {
                            name: "UpdatedAt",
                            value: "updatedAt"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listHelpdeskTeams"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listTicketMessages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Ticket Number",
                    name: "ticketNumber",
                    type: "number",
                    default: 0,
                    required: true,
                    placeholder: "e.g. 123",
                    typeOptions: {
                        maxValue: 2147483647
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listTicketMessages"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listTicketMessages"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Order",
                            name: "order",
                            type: "options",
                            default: "asc",
                            description: "Chronological direction. defaults to `asc`, so a thread reads oldest-first. a cursor is only valid for the direction it was issued with.",
                            placeholder: "e.g. asc",
                            options: [
                                {
                                    name: "Asc",
                                    value: "asc"
                                },
                                {
                                    name: "Desc",
                                    value: "desc"
                                }
                            ]
                        },
                        {
                            displayName: "Types",
                            name: "types",
                            type: "string",
                            default: "reply,note",
                            description: "Comma-separated message types. defaults to `reply,note`; system `event` messages are opt-in.",
                            placeholder: "e.g. reply,note"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listTicketStatuses"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listTickets"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "listTickets"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Assignee ID",
                            name: "assigneeId",
                            type: "json",
                            default: {
                                schemaAlternative: "",
                                value: ""
                            },
                            description: "Filter by assigned agent user ID. pass `none` for unassigned tickets."
                        },
                        {
                            displayName: "Channel",
                            name: "channel",
                            type: "string",
                            default: "",
                            description: "Comma-separated channels (is-any-of)",
                            placeholder: "e.g. email,api"
                        },
                        {
                            displayName: "Created After",
                            name: "createdAfter",
                            type: "dateTime",
                            default: "",
                            description: "Only tickets created at or after this ISO 8601 timestamp",
                            placeholder: "e.g. 2026-07-01T00:00:00Z"
                        },
                        {
                            displayName: "Created Before",
                            name: "createdBefore",
                            type: "dateTime",
                            default: "",
                            description: "Only tickets created at or before this ISO 8601 timestamp",
                            placeholder: "e.g. 2026-07-31T23:59:59Z"
                        },
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "Include Messages",
                            name: "includeMessages",
                            type: "options",
                            default: "false",
                            description: "When `true`, each ticket includes `messages`: its first 25 messages, oldest first, shaped like list ticket messages",
                            placeholder: "e.g. false",
                            options: [
                                {
                                    name: "False",
                                    value: "false"
                                },
                                {
                                    name: "True",
                                    value: "true"
                                }
                            ]
                        },
                        {
                            displayName: "Include Total",
                            name: "includeTotal",
                            type: "options",
                            default: "false",
                            description: "When `true`, the response includes `pagination.total` (costs an extra count query)",
                            placeholder: "e.g. false",
                            options: [
                                {
                                    name: "False",
                                    value: "false"
                                },
                                {
                                    name: "True",
                                    value: "true"
                                }
                            ]
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Message Types",
                            name: "messageTypes",
                            type: "string",
                            default: "reply,note",
                            description: "Message types for `messages`, as in list ticket messages. ignored unless `includemessages=true`.",
                            placeholder: "e.g. reply,note"
                        },
                        {
                            displayName: "Order",
                            name: "order",
                            type: "options",
                            default: "desc",
                            description: "Sort direction. defaults to `desc`, newest first. a cursor is only valid for the `sortby`/`order` it was issued with; changing either mid-walk is a 400.",
                            placeholder: "e.g. desc",
                            options: [
                                {
                                    name: "Asc",
                                    value: "asc"
                                },
                                {
                                    name: "Desc",
                                    value: "desc"
                                }
                            ]
                        },
                        {
                            displayName: "Priority",
                            name: "priority",
                            type: "string",
                            default: "",
                            description: "Comma-separated priorities (is-any-of). priorities: none, low, normal, high, urgent. pass `none` for untriaged tickets.",
                            placeholder: "e.g. high,urgent"
                        },
                        {
                            displayName: "Sort By",
                            name: "sortBy",
                            type: "options",
                            default: "updatedAt",
                            description: "Sort field. `updatedat` and `lastmessageat` fall back to `createdat` when unset. sorting by a mutable field means a page window is not a snapshot. pollers should use `sortby=updatedat&order=asc` with a high-water mark.",
                            placeholder: "e.g. updatedAt",
                            options: [
                                {
                                    name: "CreatedAt",
                                    value: "createdAt"
                                },
                                {
                                    name: "LastMessageAt",
                                    value: "lastMessageAt"
                                },
                                {
                                    name: "UpdatedAt",
                                    value: "updatedAt"
                                }
                            ]
                        },
                        {
                            displayName: "Status",
                            name: "status",
                            type: "string",
                            default: "",
                            description: "Comma-separated status categories (is-any-of). categories: new, on_you, on_customer, on_hold, closed, cancelled.",
                            placeholder: "e.g. new,on_you"
                        },
                        {
                            displayName: "Team ID",
                            name: "teamId",
                            type: "json",
                            default: {
                                schemaAlternative: "",
                                value: ""
                            },
                            description: "Filter by team ID. pass `none` for tickets with no team."
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "searchTickets"
                            ]
                        }
                    }
                },
                {
                    displayName: "Query",
                    name: "query",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Free-text search terms, matched against ticket messages",
                    placeholder: "e.g. refund not received",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "searchTickets"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "searchTickets"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "updateTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Ticket Number",
                    name: "ticketNumber",
                    type: "number",
                    default: 0,
                    required: true,
                    placeholder: "e.g. 123",
                    typeOptions: {
                        maxValue: 2147483647
                    },
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "updateTicket"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "updateTicket"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Agent Email",
                            name: "agentEmail",
                            type: "string",
                            default: "",
                            description: "Attribute the change to this account member (email matching is case-insensitive). if omitted or unrecognized, the change is recorded as an automatic system change. you must still provide at least one ticket field to update.",
                            placeholder: "e.g. sam@example.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Assignee Email",
                            name: "assigneeEmail",
                            type: "string",
                            default: "",
                            description: "Email of the agent to assign (case-insensitive). provide at most one of assigneeid / assigneeemail. does not accept null; unassign via assigneeid: null. omit to leave the assignee unchanged.",
                            placeholder: "e.g. sam@example.com",
                            hint: "Expected format: email"
                        },
                        {
                            displayName: "Assignee ID",
                            name: "assigneeId",
                            type: "string",
                            default: "",
                            description: "Platform user ID of the agent to assign. provide at most one of assigneeid / assigneeemail. pass null to unassign the ticket. omit to leave the assignee unchanged.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Priority",
                            name: "priority",
                            type: "options",
                            default: "none",
                            description: "New ticket priority. pass `none` to clear it. omit to leave the priority unchanged.",
                            placeholder: "e.g. urgent",
                            options: [
                                {
                                    name: "High",
                                    value: "high"
                                },
                                {
                                    name: "Low",
                                    value: "low"
                                },
                                {
                                    name: "None",
                                    value: "none"
                                },
                                {
                                    name: "Normal",
                                    value: "normal"
                                },
                                {
                                    name: "Urgent",
                                    value: "urgent"
                                }
                            ]
                        },
                        {
                            displayName: "Status Category",
                            name: "statusCategory",
                            type: "options",
                            default: "new",
                            description: "Status category; resolves to that category's default status. provide at most one of statusid / statuscategory. omit to leave the status unchanged.",
                            placeholder: "e.g. on_customer",
                            options: [
                                {
                                    name: "Cancelled",
                                    value: "cancelled"
                                },
                                {
                                    name: "Closed",
                                    value: "closed"
                                },
                                {
                                    name: "New",
                                    value: "new"
                                },
                                {
                                    name: "On Customer",
                                    value: "on_customer"
                                },
                                {
                                    name: "On Hold",
                                    value: "on_hold"
                                },
                                {
                                    name: "On You",
                                    value: "on_you"
                                }
                            ]
                        },
                        {
                            displayName: "Status ID",
                            name: "statusId",
                            type: "string",
                            default: "",
                            description: "ID of an existing status for this agent. provide at most one of statusid / statuscategory. omit to leave the status unchanged.",
                            hint: "Expected format: uuid"
                        },
                        {
                            displayName: "Team ID",
                            name: "teamId",
                            type: "string",
                            default: "",
                            description: "ID of an existing team for this agent. pass null to clear the team. omit to leave the team unchanged.",
                            hint: "Expected format: uuid"
                        }
                    ]
                },
                {
                    displayName: "Output",
                    name: "outputMode",
                    type: "options",
                    default: "simplified",
                    description: "Choose whether to return useful fields, the raw response, or selected fields",
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "updateTicket"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "Raw",
                            value: "raw",
                            description: "Return the complete API response"
                        },
                        {
                            name: "Selected Fields",
                            value: "selected",
                            description: "Return only selected fields"
                        },
                        {
                            name: "Simplified",
                            value: "simplified",
                            description: "Return up to 10 useful fields"
                        }
                    ]
                },
                {
                    displayName: "Fields to Include",
                    name: "selectedFields",
                    type: "multiOptions",
                    default: [
                        "description",
                        "createdAt",
                        "updatedAt",
                        "assigneeId",
                        "channel",
                        "conversationId",
                        "lastMessageAt",
                        "priority",
                        "statusCategory",
                        "statusId"
                    ],
                    displayOptions: {
                        show: {
                            resource: [
                                "helpdesk"
                            ],
                            operation: [
                                "updateTicket"
                            ],
                            outputMode: [
                                "selected"
                            ]
                        }
                    },
                    options: [
                        {
                            name: "AssigneeId",
                            value: "assigneeId"
                        },
                        {
                            name: "Channel",
                            value: "channel"
                        },
                        {
                            name: "ConversationId",
                            value: "conversationId"
                        },
                        {
                            name: "CreatedAt",
                            value: "createdAt"
                        },
                        {
                            name: "Customer",
                            value: "customer"
                        },
                        {
                            name: "Description",
                            value: "description"
                        },
                        {
                            name: "LastMessageAt",
                            value: "lastMessageAt"
                        },
                        {
                            name: "Metadata",
                            value: "metadata"
                        },
                        {
                            name: "Priority",
                            value: "priority"
                        },
                        {
                            name: "StatusCategory",
                            value: "statusCategory"
                        },
                        {
                            name: "StatusId",
                            value: "statusId"
                        },
                        {
                            name: "Subject",
                            value: "subject"
                        },
                        {
                            name: "TeamId",
                            value: "teamId"
                        },
                        {
                            name: "TicketNumber",
                            value: "ticketNumber"
                        },
                        {
                            name: "UpdatedAt",
                            value: "updatedAt"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ]
                        }
                    },
                    default: "createFileSource",
                    options: [
                        {
                            name: "Create",
                            value: "createSource",
                            action: "Create source",
                            description: "Create a text, q&a, or link source. use the dedicated endpoint for files; ticket and notion sources are not supported. training starts immediately; poll source `status` until `trained` or `failed`. q&a request bodies must not exceed 4.5 mb."
                        },
                        {
                            name: "Create File",
                            value: "createFileSource",
                            action: "Create file source",
                            description: "Upload a file as a knowledge source for an agent. accepts pdf, doc, docx, and txt files up to 20 mb. **base URL:** `https://files.chatbase.co/API/v2` \u2014 this endpoint uses a different host from all other sources endpoints."
                        },
                        {
                            name: "Delete",
                            value: "deleteSource",
                            action: "Delete source",
                            description: "Deletes a source. its knowledge is removed from the agent immediately; the response carries the final state (`deleted`, or `tobedeleted` while the purge finishes)."
                        },
                        {
                            name: "Get",
                            value: "getSource",
                            action: "Get source",
                            description: "Returns a single source by ID"
                        },
                        {
                            name: "Get Sources Summary",
                            value: "getSourcesSummary",
                            action: "Get sources summary",
                            description: "Returns aggregated counts and sizes for each source type, plus a flag if the chatbot knowledge base requires a retrain to reflect any changes"
                        },
                        {
                            name: "List",
                            value: "listSources",
                            action: "List sources",
                            description: "Returns a paginated list of sources for an agent. ticket sources are excluded. for link sources only individual or sitemap/crawl parent links are returned with aggregated children metadata."
                        },
                        {
                            name: "Restore Source (Deprecated)",
                            value: "restoreSource",
                            action: "Restore source deprecated",
                            description: "**Deprecated.** a delete takes effect immediately \u2014 the knowledge is purged right away, so there is no pending state to restore from. the call does nothing and always succeeds. re-create the source instead."
                        },
                        {
                            name: "Update",
                            value: "updateSource",
                            action: "Update source",
                            description: "Update a text, q&a, or link source. use the dedicated endpoint for files; ticket and notion sources are not supported. content changes start retraining (`updated` until live). link URLs cannot be changed; delete and recreate the source. q&a request bodies must not exceed 4.5 mb."
                        },
                        {
                            name: "Update File",
                            value: "updateFileSource",
                            action: "Update file source",
                            description: "Replace a file source's content, rename it, or both. at least one of `name` or `file` must be provided. **base URL:** `https://files.chatbase.co/API/v2` \u2014 this endpoint uses a different host from all other sources endpoints."
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "createFileSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "File",
                    name: "file",
                    type: "string",
                    default: "",
                    required: true,
                    description: "File to upload. formats: .pdf, .doc, .docx, .txt. max 20 mb.",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "createFileSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Name",
                    name: "name",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Display name for the source",
                    placeholder: "e.g. Employee Handbook",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "createFileSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "createSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "createSource"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Body JSON",
                            name: "bodyJson",
                            type: "json",
                            default: {
                                schemaAlternative: "alternative1",
                                value: ""
                            },
                            description: "Raw request body"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "deleteSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Source ID",
                    name: "sourceId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a63a69a5-e7a9-4757-b73b-2041854d435d",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "deleteSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "getSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Source ID",
                    name: "sourceId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a63a69a5-e7a9-4757-b73b-2041854d435d",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "getSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "getSourcesSummary"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "listSources"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "listSources"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Cursor",
                            name: "cursor",
                            type: "string",
                            default: "",
                            description: "Opaque cursor from a previous response to fetch the next page",
                            placeholder: "e.g. eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMC4wMDBaIiwiaWQiOiJhYmMxMjMifQ=="
                        },
                        {
                            displayName: "Limit",
                            name: "limit",
                            type: "number",
                            default: 50,
                            description: "Max number of results to return",
                            placeholder: "e.g. 20",
                            typeOptions: {
                                minValue: 1
                            }
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Partial (case-insensitive) name match",
                            placeholder: "e.g. handbook"
                        },
                        {
                            displayName: "Type",
                            name: "type",
                            type: "string",
                            default: "",
                            description: "Comma-separated source types to filter by. allowed values: link, file, qna, notionpage, text.",
                            placeholder: "e.g. file,qna"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "restoreSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Source ID",
                    name: "sourceId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a63a69a5-e7a9-4757-b73b-2041854d435d",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "restoreSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "updateFileSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Source ID",
                    name: "sourceId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a63a69a5-e7a9-4757-b73b-2041854d435d",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "updateFileSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "updateFileSource"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "File",
                            name: "file",
                            type: "string",
                            default: "",
                            description: "Replacement file. same constraints as create. if omitted, existing content is preserved."
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "New display name. if omitted, the existing name is preserved.",
                            placeholder: "e.g. Employee Handbook v2"
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "updateSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Source ID",
                    name: "sourceId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. a63a69a5-e7a9-4757-b73b-2041854d435d",
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "updateSource"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "sources"
                            ],
                            operation: [
                                "updateSource"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "Body JSON",
                            name: "bodyJson",
                            type: "json",
                            default: {
                                schemaAlternative: "alternative1",
                                value: ""
                            },
                            description: "Raw request body"
                        }
                    ]
                },
                {
                    displayName: "Operation",
                    name: "operation",
                    type: "options",
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "whatsapp"
                            ]
                        }
                    },
                    default: "listWhatsAppTemplates",
                    options: [
                        {
                            name: "List WhatsApp Templates",
                            value: "listWhatsAppTemplates",
                            action: "List whatsapp templates",
                            description: "List approved templates from the agent's connected whatsapp business accounts. use a template's `variables` shape when sending and match its `wabaid` to a sender. `complete=false` means one or more accounts could not be read."
                        },
                        {
                            name: "Send A WhatsApp Template Message",
                            value: "sendWhatsAppTemplateMessage",
                            action: "Send whatsapp template message",
                            description: "Send an approved whatsapp template to a phone number. chatbase resolves or creates the user from `to`; no user ID is needed, and replies follow the regular whatsapp flow. the message is appended to the conversation unless a human has taken over or it has ended; see `conversationid`."
                        }
                    ]
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "whatsapp"
                            ],
                            operation: [
                                "listWhatsAppTemplates"
                            ]
                        }
                    }
                },
                {
                    displayName: "Agent ID",
                    name: "agentId",
                    type: "string",
                    default: "",
                    required: true,
                    placeholder: "e.g. 5QHA6VB-DIAbBhxwqxfdi",
                    displayOptions: {
                        show: {
                            resource: [
                                "whatsapp"
                            ],
                            operation: [
                                "sendWhatsAppTemplateMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Template",
                    name: "template",
                    type: "collection",
                    default: {
                        name: ""
                    },
                    placeholder: "Add Field",
                    options: [
                        {
                            displayName: "Language",
                            name: "language",
                            type: "string",
                            default: "",
                            description: "Template language code (e.g. `en_us`). optional when the template exists in a single language.",
                            placeholder: "e.g. en_US"
                        },
                        {
                            displayName: "Name",
                            name: "name",
                            type: "string",
                            default: "",
                            description: "Name of the approved template",
                            placeholder: "e.g. order_confirmation"
                        },
                        {
                            displayName: "Variables",
                            name: "variables",
                            type: "json",
                            default: {},
                            description: "Template values grouped by component, such as `header` and `body`. numbering starts at `{{1}}` in each component; for named templates, use parameter names. the list-templates response shows the exact keys each component expects.",
                            placeholder: "e.g. [object Object]"
                        }
                    ],
                    required: true,
                    displayOptions: {
                        show: {
                            resource: [
                                "whatsapp"
                            ],
                            operation: [
                                "sendWhatsAppTemplateMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "To",
                    name: "to",
                    type: "string",
                    default: "",
                    required: true,
                    description: "Recipient phone number in international format. a leading plus sign and separators are allowed. chatbase resolves or creates the user from this number, and replies continue in that user's conversation; no user ID is needed.",
                    placeholder: "e.g. 14155552671",
                    displayOptions: {
                        show: {
                            resource: [
                                "whatsapp"
                            ],
                            operation: [
                                "sendWhatsAppTemplateMessage"
                            ]
                        }
                    }
                },
                {
                    displayName: "Additional Fields",
                    name: "additionalFields",
                    type: "collection",
                    placeholder: "Add Field",
                    default: {},
                    displayOptions: {
                        show: {
                            resource: [
                                "whatsapp"
                            ],
                            operation: [
                                "sendWhatsAppTemplateMessage"
                            ]
                        }
                    },
                    options: [
                        {
                            displayName: "From",
                            name: "from",
                            type: "string",
                            default: "",
                            description: "Which of the agent\u2019s connected whatsapp business numbers to send from, in international format. formatting is ignored when matching, so `+1 415-555-2671` and `14155552671` are equivalent. optional when the agent has exactly one connected number.",
                            placeholder: "e.g. 14155552671"
                        }
                    ]
                }
            ]
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const inputItems = this.getInputData();
        const output = [];
        for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
            const outputStart = output.length;
            let errorPlan = {};
            try {
                const operation = this.getNodeParameter('operation', itemIndex);
                const nodeVersion = this.getNode().typeVersion;
                let additionalFields = {};
                const nodeOptions = this.getNodeParameter('options', itemIndex, {});
                let retryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
                let credentialApplications;
                let options;
                let pagination = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                let responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                switch (operation) {
                    case "chatWithAgent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/chat";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["conversationId"] !== undefined)
                            setBodyField(body, { "name": "conversationId", "displayName": "Conversation Id", "description": "Optional conversation ID to continue an existing conversation. If omitted, a new conversation will be started.", "type": "string" }, additionalFields["conversationId"], this, itemIndex);
                        if (additionalFields["message"] !== undefined)
                            setBodyField(body, { "name": "message", "displayName": "Message", "description": "The user message to send to the agent. Omit to continue the conversation after submitting a tool result.", "type": "string", "example": "Hello, how can you help me?" }, additionalFields["message"], this, itemIndex);
                        if (additionalFields["stream"] !== undefined)
                            setBodyField(body, { "name": "stream", "displayName": "Stream", "description": "Whether to stream the response as Server-Sent Events (SSE). Defaults to true.", "type": "boolean", "default": true }, additionalFields["stream"], this, itemIndex);
                        if (additionalFields["userId"] !== undefined)
                            setBodyField(body, { "name": "userId", "displayName": "User Id", "description": "Optional user ID for a new conversation. Ignored when `conversationId` is set; the user ID on an existing conversation cannot be changed. Use letters, digits, hyphens, underscores, or dots.", "type": "string", "pattern": "^[a-zA-Z0-9._-]+$" }, additionalFields["userId"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "402": { "title": "The account's message credit balance is zero. Upgrade the plan or wait for credits to reset at the next billing cycle." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "cloneAgent": {
                        let path = "/agents/{agentId}/clone";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["id", "pendingSteps"], simplified: ["id", "pendingSteps"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "createAgent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/agents";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        if (additionalFields["instructions"] !== undefined)
                            setBodyField(body, { "name": "instructions", "displayName": "Instructions", "description": "System prompt / instructions for the agent (max 30,000 characters)", "type": "string" }, additionalFields["instructions"], this, itemIndex);
                        if (additionalFields["model"] !== undefined)
                            setBodyField(body, { "name": "model", "displayName": "Model", "description": "AI model to use", "type": "string", "enum": ["gpt-4o-mini", "gpt-oss-120b", "gpt-oss-20b", "gpt-5.2", "gpt-5.5", "gpt-5.6-terra", "gpt-6.1-sol", "gpt-6-luna", "gpt-5-mini", "gpt-5-nano", "claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-opus-4-5", "claude-haiku-4-5", "claude-sonnet-4-5", "gemini-2.5-pro", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "grok-3", "grok-3-mini", "grok-4", "DeepSeek-V3.1", "DeepSeek-R1", "DeepSeek-V4-Flash", "DeepSeek-V4.1-Flash", "Llama-4-Scout-17B-16E-Instruct", "Llama-4-Maverick-17B-128E-Instruct-FP8", "kimi-k2.5", "mistral-medium-3.5", "mistral-small-2603", "glm-5.2", "glm-5.3-flash", "auto"], "example": "gpt-5.6-terra" }, additionalFields["model"], this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "description": "Agent name", "type": "string", "required": true, "example": "Support Bot" }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        if (additionalFields["temp"] !== undefined)
                            setBodyField(body, { "name": "temp", "displayName": "Temp", "description": "Model temperature (0–1)", "type": "number", "minValue": 0, "maxValue": 1, "example": 0 }, additionalFields["temp"], this, itemIndex);
                        if (additionalFields["url"] !== undefined)
                            setBodyField(body, { "name": "url", "displayName": "Url", "description": "Homepage URL of the product. The agent is pre-configured to answer questions about this website.", "type": "string", "format": "uri", "example": "https://example.com" }, additionalFields["url"], this, itemIndex);
                        if (additionalFields["visibility"] !== undefined)
                            setBodyField(body, { "name": "visibility", "displayName": "Visibility", "description": "Agent visibility (default: private)", "type": "string", "enum": ["public", "private"] }, additionalFields["visibility"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["id", "pendingSteps"], simplified: ["id", "pendingSteps"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "createVoiceSession": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/voice/sessions";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["conversationId"] !== undefined)
                            setBodyField(body, { "name": "conversationId", "displayName": "Conversation Id", "description": "Optional conversation UUID to group voice sessions. Omit to create a new conversation. When reusing one, send the same `userId` or omit it to inherit the existing user; a different ID returns `CONVERSATION_USER_MISMATCH`.", "type": "string", "format": "uuid" }, additionalFields["conversationId"], this, itemIndex);
                        if (additionalFields["timezone"] !== undefined)
                            setBodyField(body, { "name": "timezone", "displayName": "Timezone", "description": "IANA timezone of the end user (e.g. \"Europe/Paris\"), used by the agent for time-aware answers. Defaults to UTC.", "type": "string", "default": "UTC" }, additionalFields["timezone"], this, itemIndex);
                        if (additionalFields["userId"] !== undefined)
                            setBodyField(body, { "name": "userId", "displayName": "User Id", "description": "End-user ID used for per-user voice limits. Use a stable ID; if omitted, one is generated for the session or inherited from `conversationId`. Sessions with the same user ID but no conversation ID create separate conversations. Use letters, digits, hyphens, underscores, or dots.", "type": "string", "pattern": "^[a-zA-Z0-9._-]+$" }, additionalFields["userId"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "deleteAgent": {
                        let path = "/agents/{agentId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["success"], simplified: ["success"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "getAgent": {
                        let path = "/agents/{agentId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["allowedDomains", "autoRetrain", "blockedCountries", "channelInstructions", "createdAt", "creditLimit", "creditsUsed", "id", "initialMessages", "instructions", "ipRateLimits", "lastMessageAt", "lastTrainedAt", "model", "name", "notificationsSettings", "size", "spamSettings", "status", "styles", "suggestedMessages", "temp", "visibility", "voiceSettings"], simplified: ["id", "name", "status", "createdAt", "autoRetrain", "creditLimit", "creditsUsed", "instructions", "lastMessageAt", "lastTrainedAt"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listAgents": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const path = "/agents";
                        const qs = {};
                        const body = {};
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "retryMessage": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/conversations/{conversationId}/retry";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        setBodyField(body, { "name": "messageId", "displayName": "Message Id", "description": "The ID of the message to retry from", "type": "string", "required": true, "example": "msg-abc123" }, this.getNodeParameter("messageId", itemIndex), this, itemIndex);
                        if (additionalFields["stream"] !== undefined)
                            setBodyField(body, { "name": "stream", "displayName": "Stream", "description": "Whether to stream the response as SSE. Defaults to true.", "type": "boolean", "default": true }, additionalFields["stream"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "402": { "title": "The account's message credit balance is zero. Upgrade the plan or wait for credits to reset at the next billing cycle." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "The provided `messageId` does not exist in the conversation." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "submitToolResult": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/conversations/{conversationId}/tool-result";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        if (additionalFields["output"] !== undefined)
                            setBodyField(body, { "name": "output", "displayName": "Output", "description": "The result of executing the tool action", "type": "string" }, additionalFields["output"], this, itemIndex);
                        setBodyField(body, { "name": "toolCallId", "displayName": "Tool Call Id", "description": "The toolCallId from the tool-call part in the chat response", "type": "string", "required": true }, this.getNodeParameter("toolCallId", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No pending tool call matches the provided `toolCallId`. It may have expired or already been resolved." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "trainAgent": {
                        let path = "/agents/{agentId}/train";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["deprecated", "message", "success"], simplified: ["deprecated", "message", "success"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." } };
                        break;
                    }
                    case "updateAgent": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["allowedDomains"] !== undefined)
                            setBodyField(body, { "name": "allowedDomains", "displayName": "Allowed Domains", "description": "Allowed embed domains", "type": "array", "representation": "raw", "nullable": true, "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["allowedDomains"], this, itemIndex);
                        if (additionalFields["blockedCountries"] !== undefined)
                            setBodyField(body, { "name": "blockedCountries", "displayName": "Blocked Countries", "description": "ISO 3166-1 alpha-2 country codes to block (null = remove all blocking)", "type": "array", "example": ["RU", "KP"], "representation": "raw", "nullable": true, "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["blockedCountries"], this, itemIndex);
                        if (additionalFields["channelInstructions"] !== undefined)
                            setBodyField(body, { "name": "channelInstructions", "displayName": "Channel Instructions", "description": "Per-channel instruction overrides (max 30,000 characters each)", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "android_sdk", "displayName": "Android sdk", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "api", "displayName": "Api", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "center_stage", "displayName": "Center stage", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "chat_widget", "displayName": "Chat widget", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "email", "displayName": "Email", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "help_page", "displayName": "Help page", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "instagram", "displayName": "Instagram", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "ios_sdk", "displayName": "Ios sdk", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "messenger", "displayName": "Messenger", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "phone", "displayName": "Phone", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "salesforce", "displayName": "Salesforce", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "search", "displayName": "Search", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "side_panel", "displayName": "Side panel", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "slack", "displayName": "Slack", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "whatsapp", "displayName": "Whatsapp", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "zendesk", "displayName": "Zendesk", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }, { "name": "zendesk_messaging", "displayName": "Zendesk messaging", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "chat", "displayName": "Chat", "type": "string" }, { "name": "voice", "displayName": "Voice", "type": "string" }] }] }] }, additionalFields["channelInstructions"], this, itemIndex);
                        if (additionalFields["creditLimit"] !== undefined)
                            setBodyField(body, { "name": "creditLimit", "displayName": "Credit Limit", "description": "Per-agent credit limit (null = no limit)", "type": "integer", "nullable": true }, additionalFields["creditLimit"], this, itemIndex);
                        if (additionalFields["initialMessages"] !== undefined)
                            setBodyField(body, { "name": "initialMessages", "displayName": "Initial Messages", "description": "Initial messages", "type": "array", "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }, additionalFields["initialMessages"], this, itemIndex);
                        if (additionalFields["instructions"] !== undefined)
                            setBodyField(body, { "name": "instructions", "displayName": "Instructions", "description": "System prompt (max 30,000 characters)", "type": "string" }, additionalFields["instructions"], this, itemIndex);
                        if (additionalFields["ipRateLimits"] !== undefined)
                            setBodyField(body, { "name": "ipRateLimits", "displayName": "Ip Rate Limits", "description": "IP-based rate limit settings (partial update; null = reset to defaults)", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "limit", "displayName": "Limit", "description": "Maximum messages per timeframe (1–200)", "type": "integer", "minValue": 1, "maxValue": 200, "example": 20 }, { "name": "message", "displayName": "Message", "description": "Message shown when rate limit is exceeded", "type": "string", "example": "Too many messages in a row" }, { "name": "timeframe", "displayName": "Timeframe", "description": "Timeframe in seconds for the rate limit (1–3600)", "type": "integer", "minValue": 1, "maxValue": 3600, "example": 240 }] }, additionalFields["ipRateLimits"], this, itemIndex);
                        if (additionalFields["model"] !== undefined)
                            setBodyField(body, { "name": "model", "displayName": "Model", "description": "AI model", "type": "string", "enum": ["gpt-4o-mini", "gpt-oss-120b", "gpt-oss-20b", "gpt-5.2", "gpt-5.5", "gpt-5.6-terra", "gpt-6.1-sol", "gpt-6-luna", "gpt-5-mini", "gpt-5-nano", "claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-opus-4-5", "claude-haiku-4-5", "claude-sonnet-4-5", "gemini-2.5-pro", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "grok-3", "grok-3-mini", "grok-4", "DeepSeek-V3.1", "DeepSeek-R1", "DeepSeek-V4-Flash", "DeepSeek-V4.1-Flash", "Llama-4-Scout-17B-16E-Instruct", "Llama-4-Maverick-17B-128E-Instruct-FP8", "kimi-k2.5", "mistral-medium-3.5", "mistral-small-2603", "glm-5.2", "glm-5.3-flash", "auto"], "example": "gpt-5.6-terra" }, additionalFields["model"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "Agent name", "type": "string" }, additionalFields["name"], this, itemIndex);
                        if (additionalFields["notificationsSettings"] !== undefined)
                            setBodyField(body, { "name": "notificationsSettings", "displayName": "Notifications Settings", "description": "Email notification settings (null = disable all notifications)", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "dailyConversations", "displayName": "Daily Conversations", "description": "Daily summary of conversation volume for this agent", "type": "object", "representation": "raw", "fields": [{ "name": "active", "displayName": "Active", "description": "Whether this notification type is enabled", "type": "boolean", "required": true }, { "name": "emails", "displayName": "Emails", "description": "Recipient email addresses (max 10)", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "example": "alerts@company.com", "pattern": "^\\w+([+.-]?\\w+)*@\\w+([.-]?\\w+)*(\\.\\w{2,})+$" } }] }, { "name": "dailyLeadsCollected", "displayName": "Daily Leads Collected", "description": "Daily summary of new leads collected by this agent", "type": "object", "representation": "raw", "fields": [{ "name": "active", "displayName": "Active", "description": "Whether this notification type is enabled", "type": "boolean", "required": true }, { "name": "emails", "displayName": "Emails", "description": "Recipient email addresses (max 10)", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string", "example": "alerts@company.com", "pattern": "^\\w+([+.-]?\\w+)*@\\w+([.-]?\\w+)*(\\.\\w{2,})+$" } }] }] }, additionalFields["notificationsSettings"], this, itemIndex);
                        if (additionalFields["spamSettings"] !== undefined)
                            setBodyField(body, { "name": "spamSettings", "displayName": "Spam Settings", "description": "Spam detection settings (null = disable spam detection)", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "enabled", "displayName": "Enabled", "description": "Whether spam detection is enabled", "type": "boolean", "required": true }, { "name": "prompt", "displayName": "Prompt", "description": "Custom prompt describing what counts as spam for this agent (max 2000 chars)", "type": "string", "required": true }] }, additionalFields["spamSettings"], this, itemIndex);
                        if (additionalFields["suggestedMessages"] !== undefined)
                            setBodyField(body, { "name": "suggestedMessages", "displayName": "Suggested Messages", "description": "Suggested messages", "type": "array", "representation": "raw", "nullable": true, "items": { "name": "item", "displayName": "Item", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "object", "representation": "raw", "fields": [{ "name": "icon", "displayName": "Icon", "type": "string", "nullable": true }, { "name": "order", "displayName": "Order", "type": "number", "required": true }, { "name": "text", "displayName": "Text", "type": "string", "required": true }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["single"] }] }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "icon", "displayName": "Icon", "type": "string", "nullable": true }, { "name": "items", "displayName": "Items", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "icon", "displayName": "Icon", "type": "string", "nullable": true }, { "name": "order", "displayName": "Order", "type": "number", "required": true }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] } }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "order", "displayName": "Order", "type": "number", "required": true }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["nested"] }] }] } }, additionalFields["suggestedMessages"], this, itemIndex);
                        if (additionalFields["temp"] !== undefined)
                            setBodyField(body, { "name": "temp", "displayName": "Temp", "description": "Temperature (0–1)", "type": "number", "minValue": 0, "maxValue": 1 }, additionalFields["temp"], this, itemIndex);
                        if (additionalFields["visibility"] !== undefined)
                            setBodyField(body, { "name": "visibility", "displayName": "Visibility", "description": "Visibility", "type": "string", "enum": ["public", "private"] }, additionalFields["visibility"], this, itemIndex);
                        if (additionalFields["voiceSettings"] !== undefined)
                            setBodyField(body, { "name": "voiceSettings", "displayName": "Voice Settings", "description": "Voice mode configuration (null = disable voice mode)", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "allowInterruptions", "displayName": "Allow Interruptions", "description": "When true the user can speak while the agent is talking and the agent will stop and listen. When false the agent finishes its turn before processing new speech.", "type": "boolean" }, { "name": "allowTextInput", "displayName": "Allow Text Input", "description": "When true users can also type messages during a voice session instead of only speaking.", "type": "boolean" }, { "name": "endConversationAfterSilenceSeconds", "displayName": "End Conversation After Silence Seconds", "description": "Seconds of inactivity before the session ends automatically. Minimum 10 seconds. null = session never auto-ends.", "type": "integer", "minValue": 10, "example": 300, "nullable": true }, { "name": "errorMessage", "displayName": "Error Message", "description": "Fallback message spoken to the user when the agent encounters an unrecoverable error during a call (max 500 chars).", "type": "string" }, { "name": "initialMessage", "displayName": "Initial Message", "description": "Message the agent speaks immediately when a voice session starts, before the user says anything. Leave empty to wait for the user to speak first (max 500 chars).", "type": "string" }, { "name": "maxCallDurationSeconds", "displayName": "Max Call Duration Seconds", "description": "Maximum length of a single call in seconds. The call ends automatically when reached. null = no limit.", "type": "integer", "example": 900, "nullable": true }, { "name": "maxConcurrentSessions", "displayName": "Max Concurrent Sessions", "description": "Maximum simultaneous active voice calls for this agent. null = no limit.", "type": "integer", "example": 5, "nullable": true }, { "name": "maxDailyCallsPerUser", "displayName": "Max Daily Calls Per User", "description": "Maximum voice calls a single user can start per calendar day. null = no limit.", "type": "integer", "example": 10, "nullable": true }, { "name": "model", "displayName": "Model", "description": "AI model used to generate responses during a voice call. Can be set independently from the chat model — faster, cheaper models are common here.", "type": "string", "enum": ["gpt-4o-mini", "gpt-oss-120b", "gpt-oss-20b", "gpt-5.2", "gpt-5.5", "gpt-5.6-terra", "gpt-6.1-sol", "gpt-6-luna", "gpt-5-mini", "gpt-5-nano", "claude-opus-5-5", "claude-sonnet-5-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-sonnet-4-6", "claude-opus-4-5", "claude-haiku-4-5", "claude-sonnet-4-5", "gemini-2.5-pro", "gemini-3-flash", "gemini-3.1-flash-lite", "gemini-3.1-pro", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "grok-3", "grok-3-mini", "grok-4", "DeepSeek-V3.1", "DeepSeek-R1", "DeepSeek-V4-Flash", "DeepSeek-V4.1-Flash", "Llama-4-Scout-17B-16E-Instruct", "Llama-4-Maverick-17B-128E-Instruct-FP8", "kimi-k2.5", "mistral-medium-3.5", "mistral-small-2603", "glm-5.2", "glm-5.3-flash", "auto"], "example": "gpt-6-luna" }, { "name": "recordings", "displayName": "Recordings", "description": "Call recording and retention settings", "type": "object", "representation": "raw", "fields": [{ "name": "enabled", "displayName": "Enabled", "description": "Whether voice calls are recorded and stored", "type": "boolean", "required": true }, { "name": "retentionDays", "displayName": "Retention Days", "description": "How many days recordings are kept before automatic deletion. 0 disables storage even when enabled is true.", "type": "integer", "required": true, "minValue": 0, "example": 30 }] }, { "name": "temperature", "displayName": "Temperature", "description": "Randomness of voice responses (0–1). 0 = deterministic and focused, 1 = more varied and creative.", "type": "number", "minValue": 0, "maxValue": 1, "example": 0 }, { "name": "transcriber", "displayName": "Transcriber", "description": "Speech-to-text (voice input) configuration", "type": "object", "representation": "raw", "fields": [{ "name": "activationThreshold", "displayName": "Activation Threshold", "description": "Voice activity detection sensitivity (0–1). Lower values detect quieter speech but may pick up background noise. Higher values require clearer speech to activate.", "type": "number", "required": true, "minValue": 0, "maxValue": 1, "example": 0.5 }, { "name": "language", "displayName": "Language", "description": "BCP-47 language code for speech recognition (e.g. \"en\", \"fr\", \"ar\"). Use \"multi\" for automatic detection. Valid codes depend on the selected model.", "type": "string", "required": true, "example": "multi" }, { "name": "minSilenceDuration", "displayName": "Min Silence Duration", "description": "Seconds of continuous silence that signals the user has finished speaking (0.1–3.0). Lower values make the agent respond faster but may cut off slow speakers.", "type": "number", "required": true, "minValue": 0.1, "maxValue": 3, "example": 0.75 }, { "name": "model", "displayName": "Model", "description": "Speech-to-text model to use for this agent.", "type": "string", "required": true, "enum": ["elevenlabs/scribe_v2_realtime", "cartesia/ink-2", "cartesia/ink-whisper", "deepgram/nova-3", "deepgram/nova-2", "deepgram/flux-general-multi", "soniox/stt-rt-v5", "soniox/stt-rt-v4", "hamsa/hamsa-ar"], "example": "soniox/stt-rt-v5" }] }, { "name": "voice", "displayName": "Voice", "description": "Text-to-speech voice configuration", "type": "object", "representation": "raw", "fields": [{ "name": "instructions", "displayName": "Instructions", "description": "Natural-language delivery instructions for the voice (max 500 chars). Only supported on select voices; ignored for others.", "type": "string", "example": "Speak slowly and clearly." }, { "name": "similarity", "displayName": "Similarity", "description": "How closely the output matches the reference voice sample (0–1). Only supported on select voices; ignored for others.", "type": "number", "minValue": 0, "maxValue": 1, "example": 0.75 }, { "name": "speed", "displayName": "Speed", "description": "Speech rate multiplier (0.7–1.2). Only supported on select voices; ignored for others.", "type": "number", "minValue": 0.7, "maxValue": 1.2, "example": 1 }, { "name": "stability", "displayName": "Stability", "description": "Voice consistency (0–1). Higher values produce more consistent delivery. Only supported on select voices; ignored for others.", "type": "number", "minValue": 0, "maxValue": 1, "example": 0.5 }, { "name": "voiceName", "displayName": "Voice Name", "description": "Name of the voice for this agent.", "type": "string", "required": true, "enum": ["Sarah", "Laura", "Alice", "Matilda", "Jessica", "Lily", "Bella", "Roger", "George", "Charlie", "Adam", "Daniel", "Brian", "Eric", "Chris", "Liam", "Harry", "Will", "Bill", "Callum", "Masry", "Hanafi", "Alberto Rodríguez", "Jhenny", "Anna", "Peter", "Marc Aurèle", "Marie Line", "Yasmin Alves", "Lax", "Skylar", "Corey", "Jacqueline", "Blake", "Pedro", "Marta", "Alloy", "Ash", "Ballad", "Coral", "Echo", "Fable", "Nova", "Onyx", "Sage", "Shimmer", "Nouran", "Nermin", "Othman", "Layla", "Nada", "Mariam", "Samir", "Eman", "Haneen", "Fahd", "Jasem", "Marwa", "Razan", "Yehya", "Hamdan", "Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Aoede", "Enceladus", "Sulafat", "Mina", "Nina", "Ruby", "Mason", "Rohan"], "example": "Corey" }] }] }, additionalFields["voiceSettings"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["success"], simplified: ["success"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "updateAgentAutoRetrain": {
                        let path = "/agents/{agentId}/auto-retrain";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        setBodyField(body, { "name": "enabled", "displayName": "Enabled", "description": "true = retrain every 7 days, false = never", "type": "boolean", "required": true }, this.getNodeParameter("enabled", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["success"], simplified: ["success"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "409": { "title": "Auto-retrain requires the agent to have completed at least one training run." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "updateAgentStyles": {
                        let path = "/agents/{agentId}/styles";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        setBodyField(body, { "name": "styles", "displayName": "Styles", "type": "object", "required": true, "representation": "raw", "fields": [{ "name": "centerStage", "displayName": "Center Stage", "description": "Center stage widget styles", "type": "object", "representation": "raw", "fields": [{ "name": "accentColor", "displayName": "Accent Color", "description": "Custom accent color override for interactive elements", "type": "object", "representation": "raw", "fields": [{ "name": "color", "displayName": "Color", "description": "Accent color applied to interactive elements (hex)", "type": "string", "required": true, "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "enabled", "displayName": "Enabled", "description": "Whether the custom accent color is active", "type": "boolean", "required": true }] }, { "name": "buttonColor", "displayName": "Button Color", "description": "Primary accent / send-button color (hex)", "type": "string", "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "closeOnOutsideClick", "displayName": "Close On Outside Click", "description": "Close the widget when the user clicks outside of it", "type": "boolean" }, { "name": "customSurfaceColors", "displayName": "Custom Surface Colors", "description": "Override the widget background and foreground colors", "type": "object", "representation": "raw", "fields": [{ "name": "background", "displayName": "Background", "description": "Widget background color (hex)", "type": "string", "required": true, "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "enabled", "displayName": "Enabled", "description": "Whether custom surface colors are active", "type": "boolean", "required": true }, { "name": "foreground", "displayName": "Foreground", "description": "Primary text color on the background (hex)", "type": "string", "required": true, "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }] }, { "name": "dismissableNotice", "displayName": "Dismissable Notice", "description": "Text shown in a dismissable banner inside the widget. Empty string = hidden (max 500 chars)", "type": "string", "nullable": true }, { "name": "displayName", "displayName": "Display Name", "description": "Name shown in the widget header. Defaults to the agent name (max 100 chars)", "type": "string", "nullable": true }, { "name": "enabled", "displayName": "Enabled", "description": "Enable or disable the Center Stage widget entirely", "type": "boolean" }, { "name": "footer", "displayName": "Footer", "description": "Small text below the input bar, e.g. branding or legal notice (max 500 chars)", "type": "string", "nullable": true }, { "name": "headerColor", "displayName": "Header Color", "description": "Header bar background color (hex)", "type": "string", "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "messagePlaceholder", "displayName": "Message Placeholder", "description": "Placeholder text inside the message input field (max 200 chars)", "type": "string", "nullable": true }, { "name": "notificationIndicator", "displayName": "Notification Indicator", "description": "Numeric badge on the launcher to draw attention before the user opens the widget", "type": "object", "representation": "raw", "fields": [{ "name": "enabled", "displayName": "Enabled", "description": "Whether the notification badge is shown", "type": "boolean", "required": true }, { "name": "number", "displayName": "Number", "description": "Number displayed in the badge (0–99)", "type": "integer", "required": true, "minValue": 0, "maxValue": 99, "example": 3 }] }, { "name": "notificationMessage", "displayName": "Notification Message", "description": "Floating message bubble next to the launcher shown before the user opens the widget", "type": "object", "representation": "raw", "fields": [{ "name": "enabled", "displayName": "Enabled", "description": "Whether the notification message bubble is shown", "type": "boolean", "required": true }, { "name": "text", "displayName": "Text", "description": "Message text displayed in the bubble (max 200 chars)", "type": "string", "required": true }] }, { "name": "showAttachments", "displayName": "Show Attachments", "description": "Allow users to attach files to their messages", "type": "boolean" }, { "name": "showChatBubble", "displayName": "Show Chat Bubble", "description": "Wrap agent messages in a chat bubble style", "type": "boolean" }, { "name": "showCopyButton", "displayName": "Show Copy Button", "description": "Show a copy-to-clipboard button on agent messages", "type": "boolean" }, { "name": "showDataSource", "displayName": "Show Data Source", "description": "Show the source citation below agent messages", "type": "boolean" }, { "name": "showDictation", "displayName": "Show Dictation", "description": "Show a microphone button for speech-to-text input", "type": "boolean" }, { "name": "showFeedback", "displayName": "Show Feedback", "description": "Show thumbs-up / thumbs-down feedback buttons on agent messages", "type": "boolean" }, { "name": "showVoiceMode", "displayName": "Show Voice Mode", "description": "Show the voice-conversation mode button", "type": "boolean" }, { "name": "suggestedMessages", "displayName": "Suggested Messages", "description": "Quick-reply buttons shown to the user at the start of the conversation", "type": "array", "representation": "raw", "nullable": true, "items": { "name": "item", "displayName": "Item", "type": "alternative", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "object", "representation": "raw", "fields": [{ "name": "icon", "displayName": "Icon", "type": "string", "nullable": true }, { "name": "order", "displayName": "Order", "type": "number", "required": true }, { "name": "text", "displayName": "Text", "type": "string", "required": true }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["single"] }] }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "representation": "raw", "fields": [{ "name": "icon", "displayName": "Icon", "type": "string", "nullable": true }, { "name": "items", "displayName": "Items", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "object", "representation": "raw", "fields": [{ "name": "icon", "displayName": "Icon", "type": "string", "nullable": true }, { "name": "order", "displayName": "Order", "type": "number", "required": true }, { "name": "text", "displayName": "Text", "type": "string", "required": true }] } }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "order", "displayName": "Order", "type": "number", "required": true }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["nested"] }] }] } }, { "name": "theme", "displayName": "Theme", "description": "Widget color theme", "type": "string", "enum": ["light", "dark"], "example": "light" }, { "name": "tintedGrayscale", "displayName": "Tinted Grayscale", "description": "Tinted grayscale palette. When enabled the widget uses shades of a single hue instead of neutral gray", "type": "object", "representation": "raw", "fields": [{ "name": "enabled", "displayName": "Enabled", "description": "Whether tinted grayscale is active", "type": "boolean", "required": true }, { "name": "hue", "displayName": "Hue", "description": "Base hue for the grayscale tint (0–360°)", "type": "number", "required": true, "minValue": 0, "maxValue": 360, "example": 220 }, { "name": "shade", "displayName": "Shade", "description": "Amount of hue mixed into darker tones (0–10)", "type": "number", "required": true, "minValue": 0, "maxValue": 10, "example": 3 }, { "name": "tint", "displayName": "Tint", "description": "Amount of hue mixed into lighter tones (0–10)", "type": "number", "required": true, "minValue": 0, "maxValue": 10, "example": 3 }] }, { "name": "typography", "displayName": "Typography", "description": "Widget font family and size", "type": "object", "representation": "raw", "fields": [{ "name": "fontFamily", "displayName": "Font Family", "description": "Widget font family", "type": "string", "required": true, "enum": ["Inter", "System", "Arial", "Helvetica", "Georgia", "Geist"], "example": "Inter" }, { "name": "fontSize", "displayName": "Font Size", "description": "Widget base font size", "type": "string", "required": true, "enum": ["12px", "14px", "16px", "18px", "20px"], "example": "16px" }] }, { "name": "userMessageColor", "displayName": "User Message Color", "description": "User message bubble background color (hex)", "type": "string", "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "welcomeMessage", "displayName": "Welcome Message", "description": "Greeting text shown above the message input when the conversation is empty (max 500 chars)", "type": "string", "nullable": true }, { "name": "width", "displayName": "Width", "description": "Widget width preset (small ≈ 360 px, medium ≈ 420 px, large ≈ 520 px)", "type": "string", "enum": ["small", "medium", "large"], "example": "medium" }] }, { "name": "chat", "displayName": "Chat", "description": "Chat widget styles", "type": "object", "representation": "raw", "fields": [{ "name": "alignChatButton", "displayName": "Align Chat Button", "description": "Corner the launcher button is anchored to", "type": "string", "enum": ["left", "right"], "example": "right" }, { "name": "autoOpenChatWindowAfter", "displayName": "Auto Open Chat Window After", "description": "Seconds after page load before the chat window opens automatically. null = disabled", "type": "number", "example": 5, "nullable": true }, { "name": "buttonColor", "displayName": "Button Color", "description": "Chat launcher button and primary accent color. Pass a hex code or \"transparent\"", "type": "alternative", "example": "#1A2B3C", "composition": "anyOf", "representation": "raw", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "string", "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "alternative2", "displayName": "Alternative2", "type": "string", "enum": ["transparent"] }] }, { "name": "dismissableNotice", "displayName": "Dismissable Notice", "description": "Text shown in a dismissable banner above the chat. Empty string = hidden (max 500 chars)", "type": "string", "nullable": true }, { "name": "displayName", "displayName": "Display Name", "description": "Name displayed in the chat header. Defaults to the agent name (max 100 chars)", "type": "string", "nullable": true }, { "name": "footer", "displayName": "Footer", "description": "Small text shown below the input bar, e.g. branding or legal notice (max 500 chars)", "type": "string", "nullable": true }, { "name": "headerColor", "displayName": "Header Color", "description": "Chat header background color (hex, e.g. #1A2B3C)", "type": "string", "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }, { "name": "messagePlaceholder", "displayName": "Message Placeholder", "description": "Placeholder text shown inside the message input field (max 200 chars)", "type": "string", "nullable": true }, { "name": "mobile", "displayName": "Mobile", "description": "Mobile-specific overrides for initial messages and auto-open timing", "type": "object", "representation": "raw", "fields": [{ "name": "autoOpenChatWindowAfter", "displayName": "Auto Open Chat Window After", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "enabled", "displayName": "Enabled", "type": "boolean", "required": true }, { "name": "value", "displayName": "Value", "type": "number", "required": true }] }, { "name": "initialMessages", "displayName": "Initial Messages", "type": "object", "representation": "raw", "nullable": true, "fields": [{ "name": "enabled", "displayName": "Enabled", "type": "boolean", "required": true }, { "name": "value", "displayName": "Value", "type": "array", "required": true, "representation": "raw", "items": { "name": "item", "displayName": "Item", "type": "string" } }] }, { "name": "showAutoOpen", "displayName": "Show Auto Open", "type": "boolean", "nullable": true }] }, { "name": "showAttachments", "displayName": "Show Attachments", "description": "Allow users to attach files to their messages", "type": "boolean" }, { "name": "showCopyButton", "displayName": "Show Copy Button", "description": "Show a copy-to-clipboard button on agent messages", "type": "boolean" }, { "name": "showDictation", "displayName": "Show Dictation", "description": "Show a microphone button for speech-to-text input", "type": "boolean" }, { "name": "showFeedback", "displayName": "Show Feedback", "description": "Show thumbs-up / thumbs-down buttons on agent messages", "type": "boolean" }, { "name": "showVoiceMode", "displayName": "Show Voice Mode", "description": "Show the voice-conversation mode button in the chat", "type": "boolean" }, { "name": "theme", "displayName": "Theme", "description": "Widget color theme", "type": "string", "enum": ["light", "dark"], "example": "light" }, { "name": "userMessageColor", "displayName": "User Message Color", "description": "User message bubble background color (hex)", "type": "string", "example": "#1A2B3C", "pattern": "^#([0-9A-F]{3}){1,2}$/i" }] }] }, this.getNodeParameter("styles", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["success"], simplified: ["success"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "exportConversations": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/conversations/export";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["startDate"] !== undefined)
                            qs["startDate"] = additionalFields["startDate"];
                        if (additionalFields["endDate"] !== undefined)
                            qs["endDate"] = additionalFields["endDate"];
                        if (additionalFields["conversationId"] !== undefined)
                            qs["conversationId"] = additionalFields["conversationId"];
                        if (additionalFields["include"] !== undefined)
                            qs["include"] = additionalFields["include"];
                        if (additionalFields["source"] !== undefined)
                            qs["source"] = additionalFields["source"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "getConversation": {
                        let path = "/agents/{agentId}/conversations/{conversationId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No resource matches the provided ID, or it has been deleted. Verify the resource ID in the request path." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listConversationMessages": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/conversations/{conversationId}/messages";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No resource matches the provided ID, or it has been deleted. Verify the resource ID in the request path." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listConversations": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/conversations";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["startDate"] !== undefined)
                            qs["startDate"] = additionalFields["startDate"];
                        if (additionalFields["endDate"] !== undefined)
                            qs["endDate"] = additionalFields["endDate"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listUserConversations": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/users/{userId}/conversations";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{userId}").join(encodeURIComponent(String(this.getNodeParameter("userId", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "searchConversations": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/conversations/search";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["startDate"] !== undefined)
                            qs["startDate"] = additionalFields["startDate"];
                        if (additionalFields["endDate"] !== undefined)
                            qs["endDate"] = additionalFields["endDate"];
                        if (additionalFields["query"] !== undefined)
                            qs["query"] = additionalFields["query"];
                        if (additionalFields["source"] !== undefined)
                            qs["source"] = additionalFields["source"];
                        if (additionalFields["sentiment"] !== undefined)
                            qs["sentiment"] = additionalFields["sentiment"];
                        if (additionalFields["topic"] !== undefined)
                            qs["topic"] = additionalFields["topic"];
                        if (additionalFields["userId"] !== undefined)
                            qs["userId"] = additionalFields["userId"];
                        if (additionalFields["activityState"] !== undefined)
                            qs["activityState"] = additionalFields["activityState"];
                        if (additionalFields["feedback"] !== undefined)
                            qs["feedback"] = additionalFields["feedback"];
                        if (additionalFields["escalated"] !== undefined)
                            qs["escalated"] = additionalFields["escalated"];
                        if (additionalFields["actionType"] !== undefined)
                            qs["actionType"] = additionalFields["actionType"];
                        if (additionalFields["tool"] !== undefined)
                            qs["tool"] = additionalFields["tool"];
                        if (additionalFields["toolOutcome"] !== undefined)
                            qs["toolOutcome"] = additionalFields["toolOutcome"];
                        if (additionalFields["procedure"] !== undefined)
                            qs["procedure"] = additionalFields["procedure"];
                        if (additionalFields["procedureOutcome"] !== undefined)
                            qs["procedureOutcome"] = additionalFields["procedureOutcome"];
                        if (additionalFields["hasVoice"] !== undefined)
                            qs["hasVoice"] = additionalFields["hasVoice"];
                        if (additionalFields["updatedAfter"] !== undefined)
                            qs["updatedAfter"] = additionalFields["updatedAfter"];
                        if (additionalFields["updatedBefore"] !== undefined)
                            qs["updatedBefore"] = additionalFields["updatedBefore"];
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Forbidden" }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Service unavailable" } };
                        break;
                    }
                    case "updateConversation": {
                        let path = "/agents/{agentId}/conversations/{conversationId}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        setBodyField(body, { "name": "paused", "displayName": "Paused", "description": "Set to true to pause, false to resume", "type": "boolean", "required": true }, this.getNodeParameter("paused", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "updateMessageFeedback": {
                        let path = "/agents/{agentId}/conversations/{conversationId}/messages/{messageId}/feedback";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{conversationId}").join(encodeURIComponent(String(this.getNodeParameter("conversationId", itemIndex))));
                        path = path.split("{messageId}").join(encodeURIComponent(String(this.getNodeParameter("messageId", itemIndex))));
                        setBodyField(body, { "name": "feedback", "displayName": "Feedback", "description": "Set feedback: \"positive\", \"negative\", or null to clear", "type": "string", "required": true, "enum": ["positive", "negative", null], "nullable": true }, this.getNodeParameter("feedback", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data"], simplified: ["data"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No message matches the provided ID in this conversation. Verify the message ID." }, "422": { "title": "The specified message is not an assistant message. Metadata updates are only supported on assistant text messages." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "getHealth": {
                        const path = "/health";
                        const qs = {};
                        const body = {};
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["status", "timestamp"], simplified: ["status", "timestamp"] };
                        errorPlan = {};
                        break;
                    }
                    case "createTicket": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/helpdesk/tickets";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["assigneeEmail"] !== undefined)
                            setBodyField(body, { "name": "assigneeEmail", "displayName": "Assignee Email", "description": "Email of the agent to assign (case-insensitive). Provide at most one of assigneeId / assigneeEmail.", "type": "string", "format": "email", "example": "sam@example.com" }, additionalFields["assigneeEmail"], this, itemIndex);
                        if (additionalFields["assigneeId"] !== undefined)
                            setBodyField(body, { "name": "assigneeId", "displayName": "Assignee Id", "description": "Platform user id of the agent to assign. Provide at most one of assigneeId / assigneeEmail. Pass `null` to explicitly create the ticket unassigned (suppresses auto-assignment); omit to let auto-assignment apply.", "type": "string", "format": "uuid", "nullable": true }, additionalFields["assigneeId"], this, itemIndex);
                        setBodyField(body, { "name": "customer", "displayName": "Customer", "type": "object", "required": true, "representation": "raw", "fields": [{ "name": "email", "displayName": "Email", "description": "Resolves to an existing chatbot_users row for this agent, or creates one", "type": "string", "format": "email", "required": true, "example": "jane@example.com" }, { "name": "name", "displayName": "Name", "description": "Used only when creating a new customer record; ignored if the email already resolves", "type": "string", "example": "Jane Doe" }] }, this.getNodeParameter("customer", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "description", "displayName": "Description", "description": "The first message body, written as a reply authored by the customer (1-10,000 characters)", "type": "string", "required": true, "example": "Customer cannot export orders." }, this.getNodeParameter("description", itemIndex), this, itemIndex);
                        if (additionalFields["priority"] !== undefined)
                            setBodyField(body, { "name": "priority", "displayName": "Priority", "description": "Ticket priority. Defaults to `none` (untriaged) when omitted.", "type": "string", "enum": ["none", "low", "normal", "high", "urgent"], "example": "high" }, additionalFields["priority"], this, itemIndex);
                        if (additionalFields["statusCategory"] !== undefined)
                            setBodyField(body, { "name": "statusCategory", "displayName": "Status Category", "description": "Status category; resolves to that category's default status. Provide at most one of statusId / statusCategory. Defaults to the \"new\" category default when neither is provided.", "type": "string", "enum": ["new", "on_you", "on_customer", "on_hold", "closed", "cancelled"], "example": "new" }, additionalFields["statusCategory"], this, itemIndex);
                        if (additionalFields["statusId"] !== undefined)
                            setBodyField(body, { "name": "statusId", "displayName": "Status Id", "description": "ID of an existing status for this agent. Provide at most one of statusId / statusCategory.", "type": "string", "format": "uuid" }, additionalFields["statusId"], this, itemIndex);
                        setBodyField(body, { "name": "subject", "displayName": "Subject", "description": "Ticket subject (1-500 characters)", "type": "string", "required": true, "example": "Export failing with 500" }, this.getNodeParameter("subject", itemIndex), this, itemIndex);
                        if (additionalFields["teamId"] !== undefined)
                            setBodyField(body, { "name": "teamId", "displayName": "Team Id", "description": "Team ID for this agent. Without an assignee field, a team member is assigned using the team's strategy, and agent routing rules are skipped. With `assigneeId` or `assigneeEmail` (including `assigneeId: null`), auto-assignment is skipped and the team is set as provided.", "type": "string", "format": "uuid" }, additionalFields["teamId"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["assigneeId", "channel", "conversationId", "createdAt", "customer", "description", "lastMessageAt", "metadata", "priority", "statusCategory", "statusId", "subject", "teamId", "ticketNumber", "updatedAt"], simplified: ["description", "createdAt", "updatedAt", "assigneeId", "channel", "conversationId", "lastMessageAt", "priority", "statusCategory", "statusId"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "422": { "title": "`statusId` does not belong to a status for this agent. Discover valid ids via GET /ticket-statuses." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." } };
                        break;
                    }
                    case "createTicketMessage": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/helpdesk/tickets/{ticketNumber}/messages";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{ticketNumber}").join(encodeURIComponent(String(this.getNodeParameter("ticketNumber", itemIndex))));
                        if (additionalFields["authorEmail"] !== undefined)
                            setBodyField(body, { "name": "authorEmail", "displayName": "Author Email", "description": "Email of the team member the reply is attributed to (case-insensitive). Provide exactly one of authorId / authorEmail.", "type": "string", "format": "email", "example": "sam@example.com" }, additionalFields["authorEmail"], this, itemIndex);
                        if (additionalFields["authorId"] !== undefined)
                            setBodyField(body, { "name": "authorId", "displayName": "Author Id", "description": "Platform user id of the team member the reply is attributed to. Provide exactly one of authorId / authorEmail.", "type": "string", "format": "uuid" }, additionalFields["authorId"], this, itemIndex);
                        setBodyField(body, { "name": "content", "displayName": "Content", "description": "Message body as GitHub-flavored Markdown. Plain text is valid markdown; single newlines are kept as line breaks. Raw inline HTML is stripped. Limited to 10,000 characters after trimming.", "type": "string", "required": true, "example": "Thanks for reaching out. This is **fixed** now." }, this.getNodeParameter("content", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "type", "displayName": "Type", "description": "Message type. Only `reply` (customer-visible, delivered to the customer) is supported.", "type": "string", "required": true, "enum": ["reply"], "example": "reply" }, this.getNodeParameter("type", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["content", "contentText", "createdAt", "id", "sender", "type"], simplified: ["content", "contentText", "createdAt", "id", "sender", "type"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No ticket matches the provided ticket number for this agent. Verify the ticket number in the request path." }, "409": { "title": "This ticket is linked to a live conversation that has not been taken over from the AI agent, so a human reply cannot be posted. Take over the conversation from the dashboard first." }, "422": { "title": "The authorId or authorEmail does not resolve to a member of your account. Authors must be existing team members. Also returned with code `MESSAGE_CONTENT_NOT_RENDERABLE` when the message body renders to empty HTML." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "getTicket": {
                        let path = "/agents/{agentId}/helpdesk/tickets/{ticketNumber}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{ticketNumber}").join(encodeURIComponent(String(this.getNodeParameter("ticketNumber", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["assigneeId", "channel", "conversationId", "createdAt", "customer", "description", "lastMessageAt", "metadata", "priority", "statusCategory", "statusId", "subject", "teamId", "ticketNumber", "updatedAt"], simplified: ["description", "createdAt", "updatedAt", "assigneeId", "channel", "conversationId", "lastMessageAt", "priority", "statusCategory", "statusId"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "The agent could not be found (or does not belong to the authenticated account), or the ticket number does not exist for it." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listHelpdeskTeams": {
                        let path = "/agents/{agentId}/helpdesk/teams";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["id", "isDefault", "memberCount", "name"], simplified: ["id", "isDefault", "memberCount", "name"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listTicketMessages": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/helpdesk/tickets/{ticketNumber}/messages";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{ticketNumber}").join(encodeURIComponent(String(this.getNodeParameter("ticketNumber", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["types"] !== undefined)
                            qs["types"] = additionalFields["types"];
                        if (additionalFields["order"] !== undefined)
                            qs["order"] = additionalFields["order"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "The agent could not be found (or does not belong to the authenticated account), or the ticket number does not exist for it." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listTicketStatuses": {
                        let path = "/agents/{agentId}/helpdesk/ticket-statuses";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["category", "color", "externalLabel", "id", "internalLabel", "isDefault", "position"], simplified: ["category", "color", "externalLabel", "id", "internalLabel", "isDefault", "position"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listTickets": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/helpdesk/tickets";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["status"] !== undefined)
                            qs["status"] = additionalFields["status"];
                        if (additionalFields["channel"] !== undefined)
                            qs["channel"] = additionalFields["channel"];
                        if (additionalFields["assigneeId"] !== undefined)
                            qs["assigneeId"] = additionalFields["assigneeId"];
                        if (additionalFields["teamId"] !== undefined)
                            qs["teamId"] = additionalFields["teamId"];
                        if (additionalFields["priority"] !== undefined)
                            qs["priority"] = additionalFields["priority"];
                        if (additionalFields["createdAfter"] !== undefined)
                            qs["createdAfter"] = additionalFields["createdAfter"];
                        if (additionalFields["createdBefore"] !== undefined)
                            qs["createdBefore"] = additionalFields["createdBefore"];
                        if (additionalFields["sortBy"] !== undefined)
                            qs["sortBy"] = additionalFields["sortBy"];
                        if (additionalFields["order"] !== undefined)
                            qs["order"] = additionalFields["order"];
                        if (additionalFields["includeTotal"] !== undefined)
                            qs["includeTotal"] = additionalFields["includeTotal"];
                        if (additionalFields["includeMessages"] !== undefined)
                            qs["includeMessages"] = additionalFields["includeMessages"];
                        if (additionalFields["messageTypes"] !== undefined)
                            qs["messageTypes"] = additionalFields["messageTypes"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "searchTickets": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/helpdesk/tickets/search";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["limit"] !== undefined)
                            setBodyField(body, { "name": "limit", "displayName": "Limit", "description": "Number of results to return (1 to 50, default 20)", "type": "integer", "minValue": 1, "maxValue": 50, "default": 20, "example": 20 }, additionalFields["limit"], this, itemIndex);
                        setBodyField(body, { "name": "query", "displayName": "Query", "description": "Free-text search terms, matched against ticket messages.", "type": "string", "required": true, "example": "refund not received" }, this.getNodeParameter("query", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "updateTicket": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/helpdesk/tickets/{ticketNumber}";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{ticketNumber}").join(encodeURIComponent(String(this.getNodeParameter("ticketNumber", itemIndex))));
                        if (additionalFields["agentEmail"] !== undefined)
                            setBodyField(body, { "name": "agentEmail", "displayName": "Agent Email", "description": "Attribute the change to this account member (email matching is case-insensitive). If omitted or unrecognized, the change is recorded as an automatic system change. You must still provide at least one ticket field to update.", "type": "string", "format": "email", "example": "sam@example.com" }, additionalFields["agentEmail"], this, itemIndex);
                        if (additionalFields["assigneeEmail"] !== undefined)
                            setBodyField(body, { "name": "assigneeEmail", "displayName": "Assignee Email", "description": "Email of the agent to assign (case-insensitive). Provide at most one of assigneeId / assigneeEmail. Does not accept null; unassign via assigneeId: null. Omit to leave the assignee unchanged.", "type": "string", "format": "email", "example": "sam@example.com" }, additionalFields["assigneeEmail"], this, itemIndex);
                        if (additionalFields["assigneeId"] !== undefined)
                            setBodyField(body, { "name": "assigneeId", "displayName": "Assignee Id", "description": "Platform user id of the agent to assign. Provide at most one of assigneeId / assigneeEmail. Pass null to unassign the ticket. Omit to leave the assignee unchanged.", "type": "string", "format": "uuid", "nullable": true }, additionalFields["assigneeId"], this, itemIndex);
                        if (additionalFields["priority"] !== undefined)
                            setBodyField(body, { "name": "priority", "displayName": "Priority", "description": "New ticket priority. Pass `none` to clear it. Omit to leave the priority unchanged.", "type": "string", "enum": ["none", "low", "normal", "high", "urgent"], "example": "urgent" }, additionalFields["priority"], this, itemIndex);
                        if (additionalFields["statusCategory"] !== undefined)
                            setBodyField(body, { "name": "statusCategory", "displayName": "Status Category", "description": "Status category; resolves to that category's default status. Provide at most one of statusId / statusCategory. Omit to leave the status unchanged.", "type": "string", "enum": ["new", "on_you", "on_customer", "on_hold", "closed", "cancelled"], "example": "on_customer" }, additionalFields["statusCategory"], this, itemIndex);
                        if (additionalFields["statusId"] !== undefined)
                            setBodyField(body, { "name": "statusId", "displayName": "Status Id", "description": "ID of an existing status for this agent. Provide at most one of statusId / statusCategory. Omit to leave the status unchanged.", "type": "string", "format": "uuid" }, additionalFields["statusId"], this, itemIndex);
                        if (additionalFields["teamId"] !== undefined)
                            setBodyField(body, { "name": "teamId", "displayName": "Team Id", "description": "ID of an existing team for this agent. Pass null to clear the team. Omit to leave the team unchanged.", "type": "string", "format": "uuid", "nullable": true }, additionalFields["teamId"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PATCH", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["assigneeId", "channel", "conversationId", "createdAt", "customer", "description", "lastMessageAt", "metadata", "priority", "statusCategory", "statusId", "subject", "teamId", "ticketNumber", "updatedAt"], simplified: ["description", "createdAt", "updatedAt", "assigneeId", "channel", "conversationId", "lastMessageAt", "priority", "statusCategory", "statusId"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "The agent could not be found (or does not belong to the authenticated account), or the ticket number does not exist for it." }, "422": { "title": "The requested statusId/assignee/teamId either doesn't belong to this agent or account, or (for the assignee) was not found." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." } };
                        break;
                    }
                    case "createFileSource": {
                        let path = "/api/v2/agents/{agentId}/sources";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        setBodyField(body, { "name": "file", "displayName": "File", "description": "File to upload. Formats: .pdf, .doc, .docx, .txt. Max 20 MB.", "type": "string", "format": "binary", "required": true }, this.getNodeParameter("file", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "name", "displayName": "Name", "description": "Display name for the source.", "type": "string", "required": true, "example": "Employee Handbook" }, this.getNodeParameter("name", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "operationCreatefilesourceServer1HttpsFilesChatbaseCo", "url": "https://files.chatbase.co", "kind": "fixed", "variables": [] }], "operationCreatefilesourceServer1HttpsFilesChatbaseCo", nodeOptions, true);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: toFormData(body), json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["createdAt", "id", "metadata", "name", "size", "status", "type"], simplified: ["createdAt", "id", "metadata", "name", "size", "status", "type"] };
                        errorPlan = { "400": { "title": "Missing required field, unsupported file type, or a file outside the allowed size range." }, "401": { "title": "No Authorization header present." }, "403": { "title": "Standard plan or higher required." }, "404": { "title": "Agent not found." }, "422": { "title": "Adding this file would exceed the plan storage limit for this agent." }, "429": { "title": "Rate limit exceeded." }, "500": { "title": "Unhandled server error." } };
                        break;
                    }
                    case "createSource": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/sources";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["bodyJson"] !== undefined) {
                            body = normalizeJsonValue(additionalFields["bodyJson"], "Body JSON", this, itemIndex);
                            validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "description": "Raw request body", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "object", "fields": [{ "name": "content", "displayName": "Content", "type": "string", "required": true }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["text"] }], "representation": "raw" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "fields": [{ "name": "answer", "displayName": "Answer", "type": "string", "required": true }, { "name": "name", "displayName": "Name", "type": "string", "required": true }, { "name": "questions", "displayName": "Questions", "type": "array", "required": true, "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["qna"] }], "representation": "raw" }, { "name": "alternative3", "displayName": "Alternative3", "type": "object", "fields": [{ "name": "excludePaths", "displayName": "Exclude Paths", "type": "array", "default": [], "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, { "name": "includeOnlyPaths", "displayName": "Include Only Paths", "type": "array", "default": [], "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, { "name": "linkType", "displayName": "Link Type", "type": "string", "required": true, "enum": ["individual", "sitemap", "crawl"] }, { "name": "slowScraping", "displayName": "Slow Scraping", "type": "boolean", "default": false }, { "name": "type", "displayName": "Type", "type": "string", "required": true, "enum": ["link"] }, { "name": "url", "displayName": "Url", "type": "string", "format": "uri", "required": true }], "representation": "raw" }], "composition": "oneOf", "representation": "raw" }, "Body JSON", this, itemIndex);
                        }
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["createdAt", "id", "metadata", "name", "size", "status", "type"], simplified: ["createdAt", "id", "metadata", "name", "size", "status", "type"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "409": { "title": "A parent link with this URL and link type already exists for this agent." }, "422": { "title": "Adding or updating this source would exceed the storage limit for your plan. Remove existing sources or upgrade your plan." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "deleteSource": {
                        let path = "/agents/{agentId}/sources/{sourceId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{sourceId}").join(encodeURIComponent(String(this.getNodeParameter("sourceId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "DELETE", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "409": { "title": "This source is already marked for deletion. Call the restore endpoint to undo the pending deletion first." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "getSource": {
                        let path = "/agents/{agentId}/sources/{sourceId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{sourceId}").join(encodeURIComponent(String(this.getNodeParameter("sourceId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["createdAt", "id", "metadata", "name", "size", "status", "type"], simplified: ["createdAt", "id", "metadata", "name", "size", "status", "type"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "getSourcesSummary": {
                        let path = "/agents/{agentId}/sources/summary";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["files", "links", "notionPages", "qnas", "salesforceCases", "shouldRetrain", "texts", "zendeskTickets"], simplified: ["files", "links", "notionPages", "qnas", "salesforceCases", "shouldRetrain", "texts", "zendeskTickets"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listSources": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/sources";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["cursor"] !== undefined)
                            qs["cursor"] = additionalFields["cursor"];
                        if (additionalFields["limit"] !== undefined)
                            qs["limit"] = additionalFields["limit"];
                        if (additionalFields["type"] !== undefined)
                            qs["type"] = additionalFields["type"];
                        if (additionalFields["name"] !== undefined)
                            qs["name"] = additionalFields["name"];
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data", "pagination"], simplified: ["data", "pagination"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "restoreSource": {
                        let path = "/agents/{agentId}/sources/{sourceId}/restore";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{sourceId}").join(encodeURIComponent(String(this.getNodeParameter("sourceId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["deprecated", "message", "success"], simplified: ["deprecated", "message", "success"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." } };
                        break;
                    }
                    case "updateFileSource": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/api/v2/agents/{agentId}/sources/{sourceId}";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{sourceId}").join(encodeURIComponent(String(this.getNodeParameter("sourceId", itemIndex))));
                        if (additionalFields["file"] !== undefined)
                            setBodyField(body, { "name": "file", "displayName": "File", "description": "Replacement file. Same constraints as create. If omitted, existing content is preserved.", "type": "string", "format": "binary" }, additionalFields["file"], this, itemIndex);
                        if (additionalFields["name"] !== undefined)
                            setBodyField(body, { "name": "name", "displayName": "Name", "description": "New display name. If omitted, the existing name is preserved.", "type": "string", "example": "Employee Handbook v2" }, additionalFields["name"], this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "operationCreatefilesourceServer1HttpsFilesChatbaseCo", "url": "https://files.chatbase.co", "kind": "fixed", "variables": [] }], "operationCreatefilesourceServer1HttpsFilesChatbaseCo", nodeOptions, true);
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, body: toFormData(body), json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["createdAt", "id", "metadata", "name", "size", "status", "type"], simplified: ["createdAt", "id", "metadata", "name", "size", "status", "type"] };
                        errorPlan = { "400": { "title": "No fields provided, unsupported file type, or a file outside the allowed size range." }, "401": { "title": "No Authorization header present." }, "403": { "title": "Standard plan or higher required." }, "404": { "title": "Agent or source not found." }, "409": { "title": "Source is pending deletion. Restore it before editing." }, "422": { "title": "Adding this file would exceed the plan storage limit for this agent." }, "429": { "title": "Rate limit exceeded." }, "500": { "title": "Unhandled server error." } };
                        break;
                    }
                    case "updateSource": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/sources/{sourceId}";
                        const qs = {};
                        const headers = {};
                        let body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        path = path.split("{sourceId}").join(encodeURIComponent(String(this.getNodeParameter("sourceId", itemIndex))));
                        if (additionalFields["bodyJson"] !== undefined) {
                            body = normalizeJsonValue(additionalFields["bodyJson"], "Body JSON", this, itemIndex);
                            validateBodyValue(body, { "name": "bodyJson", "displayName": "Body JSON", "type": "any", "description": "Raw request body", "alternatives": [{ "name": "alternative1", "displayName": "Alternative1", "type": "object", "fields": [{ "name": "content", "displayName": "Content", "type": "string" }, { "name": "name", "displayName": "Name", "type": "string" }], "representation": "raw" }, { "name": "alternative2", "displayName": "Alternative2", "type": "object", "fields": [{ "name": "answer", "displayName": "Answer", "type": "string" }, { "name": "name", "displayName": "Name", "type": "string" }, { "name": "questions", "displayName": "Questions", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }], "representation": "raw" }, { "name": "alternative3", "displayName": "Alternative3", "type": "object", "fields": [{ "name": "excludePaths", "displayName": "Exclude Paths", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, { "name": "includeOnlyPaths", "displayName": "Include Only Paths", "type": "array", "items": { "name": "item", "displayName": "Item", "type": "string" }, "representation": "raw" }, { "name": "slowScraping", "displayName": "Slow Scraping", "type": "boolean" }], "representation": "raw" }], "composition": "anyOf", "representation": "raw" }, "Body JSON", this, itemIndex);
                        }
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "PUT", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["createdAt", "id", "metadata", "name", "size", "status", "type"], simplified: ["createdAt", "id", "metadata", "name", "size", "status", "type"] };
                        errorPlan = { "400": { "title": "The request body failed schema validation. Inspect the `details` object in the error response for field-level errors." }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "Your current plan does not include API access. Upgrade to the Standard plan or higher to use the API." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "409": { "title": "Restore the source before making changes to it." }, "422": { "title": "Adding or updating this source would exceed the storage limit for your plan. Remove existing sources or upgrade your plan." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "503": { "title": "Chatbase is undergoing scheduled maintenance and the API is temporarily rejecting requests. This is transient; retry after a short delay. Requests are rejected before any data is read or written, so no partial changes are applied." } };
                        break;
                    }
                    case "listWhatsAppTemplates": {
                        let path = "/agents/{agentId}/whatsapp/templates";
                        const qs = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "GET", url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["complete", "senders", "templates", "unavailableWabaIds"], simplified: ["complete", "senders", "templates", "unavailableWabaIds"] };
                        errorPlan = { "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "The agent exists but has no WhatsApp phone number connected. Connect a number from the deploy page before calling WhatsApp endpoints." }, "404": { "title": "No agent matches the provided `agentId`, or it does not belong to the authenticated account." }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." } };
                        break;
                    }
                    case "sendWhatsAppTemplateMessage": {
                        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        let path = "/agents/{agentId}/whatsapp/messages/template";
                        const qs = {};
                        const headers = {};
                        const body = {};
                        path = path.split("{agentId}").join(encodeURIComponent(String(this.getNodeParameter("agentId", itemIndex))));
                        if (additionalFields["from"] !== undefined)
                            setBodyField(body, { "name": "from", "displayName": "From", "description": "Which of the agent’s connected WhatsApp business numbers to send from, in international format. Formatting is ignored when matching, so `+1 415-555-2671` and `14155552671` are equivalent. Optional when the agent has exactly one connected number.", "type": "string", "example": "14155552671" }, additionalFields["from"], this, itemIndex);
                        setBodyField(body, { "name": "template", "displayName": "Template", "type": "object", "required": true, "representation": "raw", "fields": [{ "name": "language", "displayName": "Language", "description": "Template language code (e.g. `en_US`). Optional when the template exists in a single language.", "type": "string", "example": "en_US" }, { "name": "name", "displayName": "Name", "description": "Name of the approved template", "type": "string", "required": true, "example": "order_confirmation" }, { "name": "variables", "displayName": "Variables", "description": "Template values grouped by component, such as `header` and `body`. Numbering starts at `{{1}}` in each component; for named templates, use parameter names. The list-templates response shows the exact keys each component expects.", "type": "object", "default": {}, "example": { "body": { "1": "Jane", "2": "Friday" }, "header": { "1": "#1042" } }, "representation": "raw", "additionalValue": { "name": "value", "displayName": "Value", "type": "object", "representation": "raw", "additionalValue": { "name": "value", "displayName": "Value", "type": "string" } } }] }, this.getNodeParameter("template", itemIndex), this, itemIndex);
                        setBodyField(body, { "name": "to", "displayName": "To", "description": "Recipient phone number in international format. A leading plus sign and separators are allowed. Chatbase resolves or creates the user from this number, and replies continue in that user's conversation; no user ID is needed.", "type": "string", "required": true, "example": "14155552671" }, this.getNodeParameter("to", itemIndex), this, itemIndex);
                        const serverBaseUrl = (0, http_1.resolveServerBaseUrl)(this, [{ "id": "documentServer1HttpsWwwChatbaseCoApiV2", "url": "https://www.chatbase.co/api/v2", "kind": "fixed", "variables": [] }], "documentServer1HttpsWwwChatbaseCoApiV2", nodeOptions, false);
                        options = { method: "POST", url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
                        credentialApplications = ([{ "credentialType": "chatbaseApi", "type": "bearer" }]);
                        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
                        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
                        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["conversationId", "messageId", "to"], simplified: ["conversationId", "messageId", "to"] };
                        errorPlan = { "400": { "title": "Invalid request" }, "401": { "title": "No Authorization header present. Provide a valid API key as a Bearer token in the Authorization header: `Authorization: Bearer <api-key>`." }, "403": { "title": "The agent exists but has no WhatsApp phone number connected. Connect a number from the deploy page before calling WhatsApp endpoints." }, "404": { "title": "Resource not found" }, "409": { "title": "Cannot send in the current state" }, "422": { "title": "Unprocessable message" }, "429": { "title": "Rate limit exceeded. Check the `X-RateLimit-Reset` response header for the Unix epoch seconds when the limit resets." }, "500": { "title": "An unhandled server error occurred. If the issue persists, contact support with the `x-request-id` response header value for debugging." }, "502": { "title": "Upstream WhatsApp API failure" } };
                        break;
                    }
                    default: throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
                }
                const returnAll = pagination.style !== 'none' ? Boolean((_a = nodeOptions.returnAll) !== null && _a !== void 0 ? _a : false) : false;
                const resultLimit = pagination.style !== 'none' && !returnAll ? Number((_b = nodeOptions.resultLimit) !== null && _b !== void 0 ? _b : 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
                const pageStartTime = Date.now();
                const seenCursors = new Map();
                const seenPages = new Map();
                let page = 1;
                let offset = 0;
                let cursor;
                let pagesFetched = 0;
                let estimatedBytes = 0;
                let finished = false;
                while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
                    if (Date.now() - pageStartTime > pagination.maxElapsedMs)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
                    const qs = options.qs;
                    if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined))
                        qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
                    if (pagination.style === 'offset' && pagination.page)
                        qs[pagination.page] = offset;
                    if (pagination.style === 'pageNumber' && pagination.page)
                        qs[pagination.page] = page;
                    if (pagination.style === 'cursor' && pagination.cursor && cursor)
                        qs[pagination.cursor] = cursor;
                    const response = await (0, http_1.requestWithRetry)(this, options, credentialApplications, retryContract, itemIndex);
                    pagesFetched += 1;
                    const pageFingerprint = JSON.stringify(response);
                    const pageRepeats = ((_c = seenPages.get(pageFingerprint)) !== null && _c !== void 0 ? _c : 0) + 1;
                    seenPages.set(pageFingerprint, pageRepeats);
                    if (pageRepeats > pagination.repeatedPageLimit)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
                    estimatedBytes += pageFingerprint.length;
                    if (estimatedBytes > pagination.maxMemoryBytes)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
                    if (responsePlan.binary) {
                        const binaryPayload = responsePlan.full ? ((_d = response.body) !== null && _d !== void 0 ? _d : response) : response;
                        const responseHeaders = (_e = (responsePlan.full ? response.headers : undefined)) !== null && _e !== void 0 ? _e : {};
                        const contentType = String((_f = responseHeaders['content-type']) !== null && _f !== void 0 ? _f : '').split(';')[0].trim() || 'application/octet-stream';
                        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload), undefined, contentType);
                        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
                        finished = true;
                        continue;
                    }
                    const normalizedResponse = responsePlan.full ? ((_g = response.body) !== null && _g !== void 0 ? _g : response) : response;
                    const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
                    if (responsePlan.envelopePath && envelopeValue === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
                    const envelope = (envelopeValue !== null && envelopeValue !== void 0 ? envelopeValue : normalizedResponse);
                    const itemPath = pagination.itemPath || responsePlan.itemPath;
                    const extractedItems = valueAtPath(envelope, itemPath);
                    if (itemPath && extractedItems === undefined)
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
                    const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
                        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse).length === 0));
                    const values = deletedFallback
                        ? [{ deleted: true }]
                        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems !== null && extractedItems !== void 0 ? extractedItems : envelope];
                    const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') : 'raw';
                    const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) : [];
                    for (const value of values) {
                        if (output.length - outputStart >= resultLimit)
                            break;
                        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
                        output.push({ json: selectResponseFields(value, fields), pairedItem: { item: itemIndex } });
                    }
                    if (!returnAll || pagination.style === 'none' || values.length === 0) {
                        finished = true;
                        continue;
                    }
                    if (pagination.hasMore && envelope[pagination.hasMore] === false) {
                        finished = true;
                        continue;
                    }
                    if (pagination.style === 'cursor') {
                        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
                        finished = !cursor;
                        if (cursor) {
                            const key = String(cursor);
                            const repeats = ((_h = seenCursors.get(key)) !== null && _h !== void 0 ? _h : 0) + 1;
                            seenCursors.set(key, repeats);
                            if (repeats > pagination.repeatedCursorLimit)
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
                        }
                    }
                    if (pagination.advancement === 'offsetByItems')
                        offset += values.length;
                    if (pagination.advancement === 'incrementPage')
                        page += 1;
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    output.push({ json: { error: error.message }, pairedItem: { item: itemIndex } });
                    continue;
                }
                if (error instanceof n8n_workflow_1.NodeApiError) {
                    const status = String((_l = (_j = error.httpCode) !== null && _j !== void 0 ? _j : (_k = error.cause) === null || _k === void 0 ? void 0 : _k.statusCode) !== null && _l !== void 0 ? _l : 'default');
                    const planned = (_m = errorPlan[status]) !== null && _m !== void 0 ? _m : errorPlan.default;
                    if (planned) {
                        const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
                        const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex, message: planned.title, description });
                    }
                }
                if (error instanceof n8n_workflow_1.NodeApiError)
                    throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex });
            }
        }
        return [output];
    }
}
exports.Chatbase = Chatbase;
//# sourceMappingURL=Chatbase.node.js.map