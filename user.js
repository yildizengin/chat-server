
const Redis = require('ioredis');


class Users {
    
    /**
     * @param {Redis} redis 
     */
    constructor(redis) {
        this.redis = redis;
    }

    create(id, name, role) {
        return new Promise((resolve, reject) => {
            this.redis.multi()
            .hset(`user:${id}`, 'id', id)
            .hset(`user:${id}`, 'name', name)
            .hset(`user:${id}`, 'role', role)
            .exec((err, result) => {
                if(!err) {
                    resolve(id);
                } else {
                    reject(err);
                }
            });
        });
    }

    addConversation(id, conversationId) {
        this.redis.hset(`user:${id}:conversations`, conversationId, 0);
    }

    removeConversation(id, conversationId) {
        this.redis.hdel(`user:${id}:conversations`, conversationId);
    }

    addUnreadMessage(id, conversationId) {
        this.redis.hincrby(`user:${id}:conversations`, conversationId, 1);
    }

    fetch(criteria) {
        return new Promise((resolve, reject) => {
            let pipeline = this.redis.multi();
            if(criteria instanceof Array) {
                criteria.forEach(id => {
                    pipeline = pipeline.hgetall(`user:${id}`);
                })
            } else {
                pipeline = pipeline.hgetall(`user:${criteria}`);
            }
            pipeline.exec(function (err, results) {
                const users = {};
                results.forEach(res => {
                    const user = res[1];
                    users[user.id] = {
                        id: parseInt(user.id),
                        name: user.name
                    }
                });
                resolve(users);
            })
        });
    }
}

const users = new Users(new Redis());
//users.fetchConversations(1).then(console.log);
module.exports.Users = users;