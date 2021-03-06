'use strict';
var Credential = require('../models/credential.model');
var Course = require('../models/course.model');
var Lecture = require('../models/lecture.model');
var async = require('async');
var constants = require('../utils/constants');
var config = require('../config');
var paginate = require('express-paginate');
var sanitize = require('mongo-sanitize');
var UploadUtil = require('../utils/uploadUtil');

module.exports.getCourse = getCourse;
module.exports.getLectures = getLectures;
module.exports.create = create;
module.exports.update = update;
module.exports.delete = deleteCourse;
module.exports.uploadImage = uploadImage;

function getLectures(req, res) {
    async.waterfall([
        validateRequest,
        findLectures
    ], function(err, lectures) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }
    });

    function validateRequest(callback) {
        req.checkParams('courseId', 'Course Id is requested').isMongoId();
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

    function findLectures(callback) {
        var query = Lecture
            .find({
                course: req.params.courseId,
                status: true
            })
            .sort('-date');
        var page = parseInt(sanitize(req.query.page)) || 1;
        var limit = parseInt(sanitize(req.query.limit)) || config.pagination.limit;

        Lecture.paginate(query, {page: page, limit: limit, populate: 'teacher'},
            function(err, lectures, pageCount, itemCount) {
                if(err) {
                    return res.sendStatus(500);
                }

                var result = [];

                lectures.forEach(function(lecture) {
                    result.push({
                        _id: lecture._id,
                        name: lecture.name,
                        description: lecture.description,
                        time: lecture.time,
                        updatedAt: lecture.updatedAt,
                        imageLink: lecture.imageLink,
                        teacher: {
                            _id: lecture.teacher._id,
                            name: lecture.teacher.name
                        }
                    });
                });

                return res.status(200).json({
                    object: 'list',
                    hasNext: paginate.hasNextPages(req)(pageCount),
                    data: result,
                    currentPage: page,
                    limit: limit,
                    pageCount: pageCount
                });
            });
    }
}

function getCourse(req, res) {
    async.waterfall([
        validateRequest,
        findCourse
    ], function(err, course) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }

        var result = {
            _id: course._id,
            name: course.name,
            presenter: {
                _id: course.presenter._id,
                name: course.presenter.name
            },
            description: course.description,
            imageLink: course.imageLink
        };

        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkParams('courseId', 'Course Id is requested').notEmpty().isMongoId();
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

    function findCourse(callback) {
        Course
            .findOne({
                _id: req.params.courseId,
                status: true
            })
            .populate('presenter')
            .exec(function(err, course) {
                if(err) {
                    return res.sendStatus(500);
                }
                if(!course) {
                    callback({
                        status: 404,
                        message: 'Invalid course Id'
                    });
                }
                callback(null, course);
            });
    }
}

function create(req, res) {
    async.waterfall([
        validateRequest,
        createCourse
    ], function(err, course) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }
        var result = {
            _id: course._id,
            name: course.name,
            description: course.description,
            imageLink: course.imageLink,
            presenter: {
                _id: course.presenter._id,
                name: course.presenter.name
            }
        };
        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkBody('name', 'Course name is required').notEmpty();
        var errors = req.validationErrors();
        if(errors) {
            return callback({
                status: 400,
                message: errors[0]['error']
            });
        }
        req.body = sanitize(req.body);
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

    function createCourse(presenter, callback) {
        var course = new Course({
            name: req.body.name,
            description: req.body.description || '',
            imageLink: req.body.imageLink || '',
            presenter: presenter._id
        });
        course.save(function(err, savedCourse) {
            if(err || !savedCourse) {
                return res.sendStatus(500);
            }
            savedCourse.presenter = presenter;
            callback(null, savedCourse);
        });
    }


}

function update(req, res) {
    async.waterfall([
        validateRequest,
        updateCourse
    ], function(err, course) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }

        var result = {
            _id: course._id,
            name: course.name,
            presenter: {
                _id: course.presenter._id,
                name: course.presenter.name
            },
            description: course.description,
            imageLink: course.imageLink
        };

        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkBody('_id', 'Course Id is required').notEmpty().isMongoId();
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
            course: getCourse
        }, function(err, results) {
            if(err || !results.credential.presenter || !results.course) {
                return res.sendStatus(500);
            }

            var presenter = results.credential.presenter;
            var course = results.course;
            if(!course.presenter.equals(presenter._id)) {
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

        function getCourse(callback) {
            Course
                .findById(req.body._id)
                .exec(function(err, course) {
                    if(err) {
                        return res.sendStatus(500);
                    }

                    callback(null, course);
                });
        }
    }

    function updateCourse(callback) {
        Course
            .findByIdAndUpdate(
                req.body._id,
                {
                    $set: {
                        name: req.body.name,
                        description: req.body.description,
                        imageLink: req.body.imageLink
                    }
                },
                {
                    new: true
                })
            .populate('presenter')
            .exec(function(err, course) {
                if(err) {
                    return res.sendStatus(500);
                }
                callback(null, course);
            });
    }
}

function deleteCourse(req, res) {
    async.waterfall([
        validateRequest,
        updateCourse
    ], function(err, course) {
        if(err) {
            return res
                .status(err.status)
                .json({
                    message: err.message
                });
        }

        var result = {
            _id: course._id,
        };

        return res
            .status(200)
            .json(result);
    });

    function validateRequest(callback) {
        req.checkBody('_id', 'Course Id is required').notEmpty().isMongoId();
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
            course: getCourse
        }, function(err, results) {
            if(err || !results.credential.presenter || !results.course) {
                return res.sendStatus(500);
            }

            var presenter = results.credential.presenter;
            var course = results.course;
            if(!course.presenter.equals(presenter._id)) {
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

        function getCourse(callback) {
            Course
                .findById(req.body._id)
                .exec(function(err, course) {
                    if(err) {
                        return res.sendStatus(500);
                    }

                    callback(null, course);
                });
        }
    }

    function updateCourse(callback) {
        Course
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
            .exec(function(err, course) {
                if(err) {
                    return res.sendStatus(500);
                }
                callback(null, course);
            });
    }
}

function uploadImage(req, res){
    if (!req.file || req.file.size <= 0) return res.status(400).json({error: "No file uploaded."});
    console.log('courseid : '+req.params.course_id);
    Course.findById( req.params.course_id, function(err, course) {
        if(err){
            console.log("Can not find Course");
            return res.status(400).json({error:"Can not find Course"});
        }
        UploadUtil.upLoadImage(req.file, 'course' + course._id, function(err, savedFileName) {
            if(err) {
                return res.status(500).json({error: err});
            }
            course.imageLink = savedFileName;
            course.save(function(err, savedCourse) {
                return res.status(200).json({imageLink:savedFileName});
            })
        })
    });


}