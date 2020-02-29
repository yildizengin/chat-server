const uuid = require('uuid/v4');
const Redis = require('ioredis');

const { Users } = require('./user');

class Messages {

    /**
     * @param {Redis} redis 
     */

    constructor(redis) {
        this.redis = redis;
    }

    create(senderId, conversationId, text) {
        return new Promise((resolve, reject) => {
            const id = require('uuid/v4')()
            this.redis.multi()
            .hset(`message:${id}`, 'id', id)
            .hset(`message:${id}`, 'text', text)
            .hset(`message:${id}`, 'conversationId', conversationId)
            .hset(`message:${id}`, 'createdBy', senderId)
            .hset(`message:${id}`, 'createdAt', new Date().toUTCString())
            .hset(`message:${id}`, 'readBy', JSON.stringify([]))
            .exec((err, result) => {
                if(!err) {
                    resolve(id);
                } else {
                    reject(err);
                }
            });
        })
    }




    fetch(criteria) {
        return new Promise(async (resolve, reject) => {
            let pipeline = this.redis.multi();
            if(criteria instanceof Array) {
                criteria.forEach(id => {
                    pipeline = pipeline.hgetall(`message:${id}`);
                })
            } else {
                pipeline = pipeline.hgetall(`message:${criteria}`);
            }
            pipeline.exec(function (err, results) {
                const messages = [];
                results.forEach(res => {
                    messages.push({
                        id: res[1].id,
                        text: res[1].text,
                        senderId: parseInt(res[1].createdBy),
                        createdAt: new Date(res[1].createdAt)
                    });
                });
                Users.fetch(messages.map(m => m.senderId)).then(users => {
                    resolve(messages.map(message => {
                        return {
                            id: message.id,
                            text: message.text,
                            createdAt: message.createdAt,
                            sender: {
                                id: message.senderId,
                                name: users[message.senderId.toString()].name
                            }
                        }
                    }));
                });
            })

        });

        Users.fetch(messages.map(m => m.senderId)).then(users => {
            resolve({ 
                messages: messages.map(message => {
                    return {
                        id: message.id,
                        text: message.text,
                        sender: {
                            id: message.senderId,
                            name: users[message.senderId.toString()].name
                        }
                    }
                }), 
                ofset: ofset - MESSAGE_FETCH_LIMIT - 1
            });
        });
    }

}


const messages = new Messages(new Redis());
module.exports.Messages = messages;