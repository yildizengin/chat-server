const http = require('http');
const express = require('express');
const WebSocket = require('ws');

const { AuthenticationError, MissingOrWrongParameterError, UndefinedMethodError } = require('./errors');
const { Conversations } = require('./conversation');
const { Users } = require('./user');
const { Messages } = require('./message');

class ChatServer {

    constructor(settings) {
        
        this.port = settings.port || 80;
        this.authentication = settings.authentication || undefined;
        this.userVerification = settings.userVerification || undefined;
        this.messages = settings.messages || ((room, message) => {});

        this.connections = {};

        /*
        const id = Conversations.create('public', 'Mod Sohbet', 'Moderatör bu odada görüşme yapabilir :)');
        console.log('Public conversation:' + id);

        */

    }

    start() {
        return new Promise((resolve, reject) => {


            const app = express();

            //initialize a simple http server
            const server = http.createServer(app);
            
            if(this.authentication === undefined || this.userVerification === undefined) {
                reject(Error('Authentication or verification handler is not set!'));
                return;
            }

            try {
                const wss = new WebSocket.Server({server});

                wss.on('connection', ((ws) => {
                    ws.on('message', (message) => this.handleMessage(ws, message));
                    ws.on('close', () => this.handleConnectionClose(ws));
                }).bind(this));

                server.listen(this.port, () => {
                    resolve();
                });
            } catch(err) {
                reject(err);
            }
            
        });
    }

    handleConnectionClose(ws) {
        if(ws.user !== undefined) {
            delete this.connections[ws.user.id];
        }
    }

    async handleMessage(ws, message) {
        let requestId;
        try {
            const data = JSON.parse(message);
            requestId = data.requestId || undefined;
            if(data.method === undefined) {
                throw new UndefinedMethodError();
            }
            if(data.method === 'auth' && ws.user === undefined) {
                if(data.params.token === undefined) {
                    throw new MissingOrWrongParameterError();
                } else {
                    const promise = this.authentication(data.params.token);
                    if(promise !== undefined && promise instanceof Promise) {
                        promise.then(user => {
                            ws.user = user;
                            this.connections[user.id] = ws;
                            Users.create(user.id, user.name, user.role);
                            this.notifiy(user.id, 'auth', user, requestId)
                        }).catch(err => {
                            throw new AuthenticationError();
                        })
                    }
                }
            } else if(ws.user !== undefined) {
                this.execute(ws.user, data.method, data.params, requestId);
            }
        } catch(err) {
            if(ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    method: 'error', 
                    params: {
                        message:err.message
                    },
                    requestId: requestId
                }));
            }
        }
    }

    execute(sender, method, params, requestId) {
        if(method === 'joinConversation') {
            if(params.conversationId === undefined) {
                throw new MissingOrWrongParameterError();
            }
            Conversations.subscribe(params.conversationId, sender).then(status => {
                this.listMessages(sender, method, params, requestId);
            }).catch(console.log);
        } else if(method === 'sendMessage') {
            this.sendMessage(sender, method, params, requestId);
        } else if(method === 'listMessages') {
            this.listMessages(sender, method, params, requestId);
        } else if(method === 'listConversations') {
            Conversations.fetchByUserId(sender.id).then(conversations => {
                this.notifiy(sender.id, 'listConversations', conversations, requestId);
            }).catch(console.log); 
        } else if(method === 'createGroupConversation') {
            this.userVerification(sender.id).then(async (user) => {
                if(user.role === 'admin') {
                    Conversations.create('group', [sender.id], params.name || '', params.description || '').then(async id => {
                        const members = params.members || [];
                        members.forEach(userId => {
                            this.userVerification(userId).then(async (user) => {
                                await Users.create(user.id, user.name, user.role);
                                await Conversations.subscribe(id, userId);
                            })
                        });
                        await Conversations.subscribe(id, sender.id);
                        this.notifiy(sender.id, 'createGroupConversation', { id:id }, requestId);
                    })
                }
                
            })
            
        } else if(method === 'addUserToConversation') {
            
        } else {
            throw new UndefinedMethodError();
        }
    }

    sendMessage(sender, method, params, requestId) {
        if(params.text === undefined || params.text === '' || params.conversationId === undefined) {
            throw new MissingOrWrongParameterError();
        }
        Conversations.isSubscriber(params.conversationId, sender.id).then((status) => {
            if(status) {
                Conversations.fetchSubscribers(params.conversationId).then(async users => {
                    const messageId = await Messages.create(sender.id, params.conversationId, params.text);
                    Conversations.addMessage(params.conversationId, messageId).then(async () => {
                        const messages = await Messages.fetch(messageId);
                        users.forEach(u => {
                            if(this.connections[u] !== undefined) {
                                this.notifiy(u, 'message', messages[0]);
                            } else {
                                Users.addUnreadMessage(u, params.conversationId);
                            }
                        })
                    });
                });
            } else {
                // TODO
            }
        }).catch(err => console.log(err.message));
        
    }

    listMessages(sender, method, params, requestId) {
        if(params.conversationId === undefined) {
            throw new MissingOrWrongParameterError();
        }
        Conversations.isSubscriber(params.conversationId, sender.id).then(status => {
            Conversations.fetchMessages(params.conversationId, params.ofset || 0).then((res) => {
                this.notifiy(sender.id, 'listMessages', {
                    conversationId: params.conversationId,
                    ofset:res.ofset,
                    messages:res.messages
                }, requestId);
            });
        }).catch(console.log);
        
    }

    notifiy(id, method, params, requestId) {
        if(this.connections[id] !== undefined && this.connections[id].readyState === WebSocket.OPEN) {
            this.connections[id].send(JSON.stringify({method: method, params: params, requestId:requestId}));
        }
    }

}

module.exports = ChatServer;