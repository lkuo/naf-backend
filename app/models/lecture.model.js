'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var deepPopulate = require('mongoose-deep-populate')(mongoose);
var paginate = require('mongoose-paginate');

var LectureSchema = new Schema({
    name: {
        type: String
    },
    description: {
        type: String
    },
    teacher: {
        type: Schema.Types.ObjectId,
        ref: 'Teacher'
    },
    course: {
        type: Schema.Types.ObjectId,
        ref: 'Course'
    },
    presenter: {
        type: Schema.Types.ObjectId,
        ref: 'Presenter'
    },
    time: {
        type: Schema.Types.Date
    },
    vimeoLink: {
        type: String
    },
    zoomLink: {
        type: String
    },
    zoomStartLink: {
        type: String
    },
    zoomId: {
        type: String
    },
    zoomResBody: {
        type: String
    },
    imageLink: {
        type: String
    },
    status: {
        type: Boolean,
        default: true
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

if (!LectureSchema.options.toJSON) {
    LectureSchema.options.toJSON = {};
}
LectureSchema.options.toJSON.transform = function(doc, ret, options) {
    delete ret.__v;
};

LectureSchema.pre('save', function(next){
    var now = new Date();
    this.updatedAt = now;
    if (!this.createdAt ) {
        this.createdAt = now;
    }
    next();
});

LectureSchema.plugin(deepPopulate, {});
LectureSchema.plugin(paginate);

module.exports = mongoose.model('Lecture', LectureSchema);