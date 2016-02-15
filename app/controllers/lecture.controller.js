'use strict';
var Credential = require('../models/credential.model');
var Lecture = require('../models/lecture.model');
var sanitize = require('mongo-sanitize');
var async = require('async');
var constants = require('../utils/constants');

module.exports.getLecture = getLecture;
module.exports.create = createLecture;
module.exports.update = updateLecture;
module.exports.delete = deleteLecture;

function updateLecture(req, res) {
    async.waterfall([
        validateRequest,
        updateLecture
    ], function(err, lecture) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }

        var result = {
            _id: lecture._id,
            name: lecture.name,
            time: lecture.time,
            description: lecture.description,
            presenter: {
                _id: lecture.presenter._id,
                name: lecture.presenter.name
            },
            teacher: {
                _id: lecture.teacher._id,
                name: lecture.teacher.name
            },
            zoomLink: lecture.zoomLink,
            vimeoLink: lecture.vimeoLink
        };

        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkBody('_id', 'Lecture Id is required').isMongoId();
        req.checkBody('name', 'Lecture name is required').notEmpty();
        req.checkBody('time', 'Date is required').isDate();
        req.checkBody('teacher', 'Teacher Id is required').isMongoId();

        var errors = req.validationErrors();
        if(errors) {
            return callback({
                status: 400,
                message: errors[0]['error']
            });
        }
        req.body = sanitize(req.body);
        async.series({
            credential: getCredential,
            lecture: getLecture
        }, function(err, results) {
            if(err || !results.credential.presenter || !results.lecture) {
                return res.sendStatus(500);
            }

            var presenter = results.credential.presenter;
            var lecture = results.lecture;
            if(!lecture.presenter.equals(presenter._id)) {
                return callback({
                    status: 401,
                    message: 'Invalid user Id'
                });
            }
            callback(null);
        });

        function getCredential(callback) {
            Credential
                .findById(req.user._id)
                .populate('presenter')
                .exec(function(err, credential) {
                    if(err || !credential || !credential.presenter) {
                        return res.sendStatus(500);
                    }

                    callback(null, credential);
                });
        }

        function getLecture(callback) {
            Lecture
                .findById(req.body._id)
                .exec(function(err, lecture) {
                    if(err) {
                        return res.sendStatus(500);
                    }

                    callback(null, lecture);
                });
        }
    }

    function updateLecture(callback) {
        Lecture
            .findByIdAndUpdate(
                req.body._id,
                {
                    $set: {
                        name: req.body.name,
                        time: req.body.time,
                        description: req.body.description,
                        teacher: req.body.teacher,
                        zoomLink: req.body.zoomLink,
                        vimeoLink: req.body.vimeoLink
                    }
                },
                {
                    new: true
                })
            .populate('presenter teacher')
            .exec(function(err, lecture) {
                if(err) {
                    return res.sendStatus(500);
                }
                callback(null, lecture);
            });
    }
}

function getLecture(req, res) {
    async.waterfall([
        validateRequest,
        findLecture
    ], function(err, lecture) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }

        var result = {
            _id: lecture._id,
            name: lecture.name,
            time: lecture.time,
            description: lecture.description,
            presenter: {
                _id: lecture.presenter._id,
                name: lecture.presenter.name
            },
            teacher: {
                _id: lecture.teacher._id,
                name: lecture.teacher.name
            },
            zoomLink: lecture.zoomLink,
            vimeoLink: lecture.vimeoLink
        };

        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkParams('lectureId', 'Lecture Id is requested').isMongoId();
        var errors = req.validationErrors();
        if(errors) {
            return callback({
                status: 400,
                message: errors[0]['error']
            });
        }
        req.params = sanitize(req.params);
        callback(null);
    }

    function findLecture(callback) {
        Lecture
            .findOne({
                _id: req.params.lectureId,
                status: true
            })
            .populate('presenter teacher')
            .exec(function(err, lecture) {
                if(err) {
                    return res.sendStatus(500);
                }
                if(!lecture) {
                    callback({
                        status: 404,
                        message: 'Invalid lecture Id'
                    });
                }
                callback(null, lecture);
            });
    }
}

function createLecture(req, res) {
    async.waterfall([
        validateRequest,
        saveLecture
    ], function(err, lecture) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }
        Lecture
            .findById(lecture._id)
            .populate('presenter teacher')
            .exec(function(err, lecture) {
                if(err) {
                    return res.sendStatus(500);
                }
                var result = {
                    _id: lecture._id,
                    name: lecture.name,
                    time: lecture.time,
                    description: lecture.description,
                    presenter: {
                        _id: lecture.presenter._id,
                        name: lecture.presenter.name
                    },
                    teacher: {
                        _id: lecture.teacher._id,
                        name: lecture.teacher.name
                    },
                    zoomLink: lecture.zoomLink
                };
                return res
                    .status(200)
                    .json(result);
            });
    });

    function validateRequest(callback) {
        req.checkBody('name', 'Lecture name is required').notEmpty();
        req.checkBody('teacher', 'Teacher Id is required').isMongoId();
        req.checkBody('course', 'Course Id is required').isMongoId();
        req.checkBody('time', 'Date is required').notEmpty().isDate();
        var errors = req.validationErrors();
        if(errors) {
            return callback({
                status: 400,
                message: errors[0]['error']
            });
        }
        req.body = sanitize(req.body)
        Credential
            .findById(req.user._id)
            .populate('presenter')
            .exec(function(err, credential) {
                if(err || !credential || !credential.presenter) {
                    return res.sendStatus(500);
                }
                callback(null, credential.presenter);
            });
    }

    function saveLecture(presenter, callback) {
        var lecture = new Lecture({
            name: req.body.name,
            time: new Date(req.body.time),
            description: req.body.description,
            course: req.body.course,
            presenter: presenter._id,
            teacher: req.body.teacher
        });
        async.waterfall([
            getZoomLink,
            saveNewLecture
        ], callback);

        function getZoomLink(callback) {
            // TODO implement zoom module
            lecture.zoomLink = "invalid sample link";
            callback(null, lecture);
        }

        function saveNewLecture(lecture, callback) {
            lecture.save(function(err, savedLecture) {
                if(err || !savedLecture) {
                    return res.sendStatus(500);
                }
                callback(null, savedLecture);
            });
        }
    }
}


function deleteLecture(req, res) {
    async.waterfall([
        validateRequest,
        updateLecture
    ], function(err, lecture) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }

        var result = {
            _id: lecture._id
        };

        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkBody('_id', 'Lecture Id is required').isMongoId();
        var errors = req.validationErrors();
        if(errors) {
            return callback({
                status: 400,
                message: errors[0]['error']
            });
        }
        req.body = sanitize(req.body);
        async.series({
            credential: getCredential,
            lecture: getLecture
        }, function(err, results) {
            if(err || !results.credential.presenter || !results.lecture) {
                return res.sendStatus(500);
            }

            var presenter = results.credential.presenter;
            var lecture = results.lecture;
            if(!lecture.presenter.equals(presenter._id)) {
                return callback({
                    status: 401,
                    message: 'Invalid user Id'
                });
            }
            callback(null);
        });

        function getCredential(callback) {
            Credential
                .findById(req.user._id)
                .populate('presenter')
                .exec(function(err, credential) {
                    if(err || !credential || !credential.presenter) {
                        return res.sendStatus(500);
                    }

                    callback(null, credential);
                });
        }

        function getLecture(callback) {
            Lecture
                .findById(req.body._id)
                .exec(function(err, lecture) {
                    if(err) {
                        return res.sendStatus(500);
                    }

                    callback(null, lecture);
                });
        }
    }

    function updateLecture(callback) {
        Lecture
            .findByIdAndUpdate(
                req.body._id,
                {
                    $set: {
                        status:false
                    }
                },
                {
                    new: true
                })
            .exec(function(err, lecture) {
                if(err) {
                    return res.sendStatus(500);
                }
                callback(null, lecture);
            });
    }
}