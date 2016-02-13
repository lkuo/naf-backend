'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate')(mongoose);

var credentialSchema = new Schema({
    email: {
        type: Schema.Types.String,
        required: true
    },
    password: {
        type: Schema.Types.String,
        required: true
    },
    userType: {
        type: Schema.Types.String,
        required: true
    },
    attendee: {
        type: Schema.Types.ObjectId,
        ref: 'Attendee'
    },
    presenter: {
        type: Schema.Types.ObjectId,
        ref: 'Presenter'
    },
    teacher: {
        type: Schema.Types.ObjectId,
        ref: 'Teacher'
    },
    createdAt: {
        type: Schema.Types.Date
    },
    updatedAt: {
        type: Schema.Types.Date
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Credential'
    }
});

if (!credentialSchema.options.toJSON) {
    credentialSchema.options.toJSON = {};
}
credentialSchema.options.toJSON.transform = function(doc, ret, options) {
    delete ret.__v;
};

credentialSchema.plugin(deepPopulate, {} );

credentialSchema.statics.checkEmailRegistered = checkEmailRegistered;
credentialSchema.statics.register = register;

module.exports = mongoose.model('Credential', credentialSchema);

function checkEmailRegistered(email, callback) {
    this.findOne({
        email: email
    }, function(err, credential) {
        if(err || credential) {
            callback(['Email is registered']);
        }
        callback(null);
    });
}

function register(params, callback) {
    this.create(params, callback);
}