
module.exports.MissingOrWrongParameterError = class MissingOrWrongParameterError extends Error {
    constructor() {
        super('Missing or wrong parameter!');
    }
}

module.exports.AuthenticationError = class AuthenticationError extends Error {
    constructor() {
        super('Authentication error. User not verified yet.');
    }
}

module.exports.UndefinedMethodError = class UndefinedMethodError extends Error {
    constructor() {
        super('Undefined method');
    }
}