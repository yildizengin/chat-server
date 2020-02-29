
const Redis = require('ioredis');
const { Users } = require('./user');
const { Messages } = require('./message');

const MESSAGE_FETCH_LIMIT = 1;
class Conversations {
    
    /**
     * @param {Redis} redis 
     */
    constructor(redis) {
        this.redis = redis;
    }

    create(type, owners, name, description) {
 
        return new Promise((resolve, reject) => {
            const id = require('uuid/v4')()
            this.redis.multi()
            .hset(`conversation:${id}`, 'id', id)
            .hset(`conversation:${id}`, 'status', 1)
            .hset(`conversation:${id}`, 'type', type)
            .hset(`conversation:${id}`, 'owners', JSON.stringify(owners || []))
            .hset(`conversation:${id}`, 'name', name || '')
            .hset(`conversation:${id}`, 'description', description || '')
            .exec((err, result) => {
                if(!err) {
                    resolve(id);
                } else {
                    reject(err);
                }
            });
        });
    }

    fetch(id) {
        return new Promise((resolve, reject) => {
            this.redis.hgetall(`conversation:${id}`, async (err, res) => {
                if(!err && res) {
                    resolve({
                        id: id,
                        type: res.type,
                        name: res.name,
                        description: res.description,
                        owners: JSON.parse(res.owners),
                    });
                } else {
                    reject(err);
                }
            })
        });
    }

    fetchByUserId(id) {
        return new Promise(async (resolve, reject) => {
            this.redis.hgetall(`user:${id}:conversations`, (err, conversations) => {
                
                if(!err && conversations) {
                    let pipeline = this.redis.multi();
                    for (var c in conversations) {
                        pipeline.hgetall(`conversation:${c}`);
                    }
                    pipeline.exec(async (err, results) => {
                        const conv = [];
                        for(var i = 0; i < results.length; i++) {
                            const res = results[0][1];
                            conv.push({
                                id: res.id,
                                type: res.type,
                                name: res.name,
                                description: res.description,
                                messageAt: res.messageAt,
                                ofset: await this.messageCount(res.id),
                                unread: parseInt(conversations[res.id] || 0)
                            })
                        }
                        resolve(conv);
                    })
                }
            })
        });
    }

    remove(id) {
        this.redis.hexists(`conversation:${id}`, 'status', (err, res) => {
            if(!err && res == 1) {
                this.redis.hset(`conversation:${id}`, 'status', 0);
            }
        });
    }

    subscribe(id, userId) {
        return new Promise((resolve, reject) => {
            this.fetch(id).then(async c => {
                if(!await this.isSubscriber(id, userId)) {
                    this.redis.sadd(`conversation:${id}:subscribers`, userId);
                    Users.addConversation(userId, id);
                }
                resolve(true);
            }).catch(reject);
        })
        
    }

    isSubscriber(id, userId) {
        return new Promise((resolve, reject) => {
            this.redis.sismember(`conversation:${id}:subscribers`, userId, (err, res) => {
                if(!err) {
                    resolve(res === 1);
                } else {
                    reject(err);
                }
            })
        });
    }

    unsubscribe(id, userId) {
        this.redis.srem(`conversation:${id}:subscribers`, userId);
        Users.removeConversation(userId, id);
    }

    fetchSubscribers(id) {
        return new Promise((resolve, reject) => {
            this.redis.smembers(`conversation:${id}:subscribers`, (err, res) => {
                if(!err) {
                    resolve(res.map(value => parseInt(value)));
                } else {
                    reject(err);
                }
            })
        });
    }

    fetchMessages(id, ofset) {
        return new Promise(async (resolve, reject) => {
            const count = await this.messageCount(id);
            ofset = ofset === 0 ? count : ofset;
            this.redis.lrange(`conversation:${id}:messages`, - ofset, - ofset + MESSAGE_FETCH_LIMIT, async (err, res) => {
                if(!err) {
                    resolve({
                        messages: await Messages.fetch(res),
                        ofset: ofset - MESSAGE_FETCH_LIMIT - 1
                    })
                } else {
                    reject(err);
                }
            })
        });
    }

    messageCount(id) {
        return new Promise((resolve, reject) => {
            this.redis.llen(`conversation:${id}:messages`, (err, res) => {
                resolve(parseInt(res));
            })
        })
    }

    addMessage(id, messageId) {
        return new Promise((resolve, reject) => {
            this.redis.multi().lpush(`conversation:${id}:messages`, messageId)
            .hset(`conversation:${id}`, 'messageAt', new Date().toUTCString())
            .exec((err, result) => {
                if(!err) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }

}
const conversations = new Conversations(new Redis());
//conversations.fetchByUserId(1).then(console.log);
module.exports.Conversations = conversations;

