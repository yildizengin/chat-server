
const ChatServer = require('./server');
const Faker = require('faker/locale/tr');

new ChatServer({
    
    port:8080,

    authentication:(token) => {
        return new Promise((resolve, reject) => {
            resolve({
                id: 1,//Faker.random.number(),
                name: Faker.name.firstName(),
                role: 'member'
            })
        });
    },

    userVerification:(id) => {
        return new Promise((resolve, reject) => {
            resolve({
                id: id,
                name: Faker.name.firstName(),
                role: 'admin'
            })
        });
    }

}).start().catch(e => console.log(e.message));
