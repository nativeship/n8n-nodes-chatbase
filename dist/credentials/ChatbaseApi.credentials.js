"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbaseApi = void 0;
class ChatbaseApi {
    constructor() {
        this.name = "chatbaseApi";
        this.displayName = "Chatbase API";
        this.documentationUrl = "https://www.chatbase.co/api/v2";
        this.icon = {
            light: "file:../nodes/Chatbase/chatbase.svg",
            dark: "file:../nodes/Chatbase/chatbase.dark.svg"
        };
        this.properties = [
            {
                displayName: "Access Token",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://www.chatbase.co/api/v2",
                url: "/agents"
            }
        };
    }
}
exports.ChatbaseApi = ChatbaseApi;
//# sourceMappingURL=ChatbaseApi.credentials.js.map