/*
 * QuizListView
 */
var QuizListView = Backbone.View.extend({
    el: '#admin',
    events: {
        'click .add-quiz': 'addQuizModel'
    },

    initialize: function() {
        this.$quizzes = null;
        this.quizzes = new Quizzes();
        this.quizViews = {};

        _.bindAll(this);

        this.quizzes.fetch({
            success: _.bind(function() {
                this.render();
            }, this),
            error: function() {
                console.log('error');
            }
        });
    },
    render: function() {
        this.$el.empty();

        this.$el.html(JST.admin_quiz_list);

        this.$quizzes = $('.quizzes');

        this.quizzes.each(_.bind(function(quiz) {
            this.addQuizView(quiz);
        }, this));
    },
    addQuizView: function(quiz) {
        var quizView = new QuizView({model: quiz});
        quizView.render();

        this.$quizzes.append(quizView.el);
    },
    addQuizModel: function() {
        var properties = this.serialize();

        var quiz = this.quizzes.create(properties, {
            success: function() {
                window.location.replace('/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/quiz/' + quiz.get('id'));
            }
        });
    },
    serialize: function() {
        var properties = {
            title: 'Put Title Here',
            text: 'Put description here.',
            created: moment().format(),
            updated: moment().format(),
        };

        return properties;
    }
});

/*
 * QuizView
 */
var QuizView = Backbone.View.extend({
    className: 'quiz',
    events: {
        'click .delete-quiz': 'close'
    },

    tagName: 'tr',

    initialize: function() {
        _.bindAll(this);

        this.render();
    },

    render: function() {
        this.$el.empty();

        this.$el.append(JST.admin_quizzes({'quiz': this.model}));
    },
    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    }
});


/*
 * QuizDetailView
 */

var QuizDetailView = Backbone.View.extend({
    el: '#admin',
    events: {
        'click #save-quiz': 'saveQuiz',
        'click #add-question': 'addQuestionModel'
    },

    initialize: function() {
        this.questionViews = {};
        this.$questions = null;
        this.quiz = null;

        _.bindAll(this);

        this.render();

        this.model.questions.each(_.bind(function(question) {
            this.addQuestionView(question);
        }, this));

        this.model.questions.on('add', this.addQuestionView);
        this.model.questions.on('remove', this.rmQuestionView);
    },

    render: function() {
        this.$el.empty();

        this.$el.html(JST.admin_quiz_detail());

        this.$questions = this.$('.questions');

        _.each(this.questionViews, function(view) {
            view.render();
        });

        if (this.model.questions.length === 0) {
            for (i=0; i<4; i++) {
                this.addQuestionModel();
            }
        }
    },

    saveQuiz: function() {
        var properties = this.serialize();

        this.model.save(properties, {
            success: _.bind(function() {
                console.log('success');
                _.each(this.questionViews, function(question) {
                    question.saveQuestion();
                });
            }, this),
            error: _.bind(function() {
                console.log('error');
            }, this)
        });
    },

    addQuestionModel: function() {
        var question = new Question();
        question.quiz = this.model;

        this.model.questions.add(question);
    },

    addQuestionView: function(question) {
        var questionView = new QuestionView({ model: question });

        this.$questions.append(questionView.el);
        this.questionViews[question.cid] = questionView;
    },

    rmQuestionView: function(question) {
        delete this.questionViews[question.cid];
    },

    serialize: function() {
        var properties = {
            title: this.$('.title').val(),
            text: this.$('.description').val(),
        };

        return properties;
    }
});

/*
 * QuestionView
 */
var QuestionView = Backbone.View.extend({
    tagName: 'div',
    className: 'question',
    events: {
        'click .add-choice': 'addChoiceModel',
        'click .rm-choice': 'rmChoiceView',
        'click .rm-question': 'close',
        'click #save-quiz': 'saveQuestion',
    },

    initialize: function() {
        this.choiceViews = {};
        this.$choices = null;
        this.$photo = null;
        this.$audio = null;

        _.bindAll(this);

        this.render();

        this.model.choices.each(_.bind(function(choice) {
            this.addChoiceView(choice);
        }, this));

        this.addPhotoView(this.model.photo);
        this.addAudioView(this.model.audio);

        this.model.choices.on('add', this.addChoiceView);
    },
    render: function() {

        this.$el.html(JST.admin_question({ 'question': this.model }));

        this.$choices = this.$('.choices');
        this.$photo = this.$('.photo');
        this.$audio = this.$('.audio');

        _.each(this.choiceViews, function(view) {
            view.render();
        });

        if (this.model.choices.length === 0) {
            for (i=0; i<1; i++) {
                this.addChoiceModel();
            }
        }
    },

    addChoiceModel: function() {
        var choice = new Choice();
        choice.question = this.model;

        this.model.choices.add(choice);
    },

    addChoiceView: function(choice) {
        var choiceView = new ChoiceView({ model: choice });
        choiceView.render();

        this.$choices.append(choiceView.el);

        this.choiceViews[choice.cid] = choiceView;
    },

    addPhotoView: function(photo) {
        var photoView = new PhotoView({ model: photo, parent: this });
        photoView.render();

        this.$photo.append(photoView.el);
    },

    addAudioView: function(audio) {
        var audioView = new AudioView({ model: audio });
        audioView.render();

        this.$audio.append(audioView.el);
    },

    rmChoiceView: function() {
        // if (this.model.choices.length > 1) {
            var model = this.model.choices.last();
            this.choiceViews[model.cid].close();
            delete this.choiceViews[model.cid];
        // }
    },

    saveQuestion: function() {
        var properties = this.serialize();

        this.model.save(properties, {
            success: _.bind(function() {
                _.each(this.choiceViews, function(choiceView) {
                    choiceView.saveChoice();
                });
            }, this),
            error: _.bind(function() {
                console.log('error');
            }, this)
        });
    },

    close: function() {
        _.each(this.choiceViews, function(choiceView) {
            choiceView.close();
        });
        this.model.destroy();
        this.remove();
        this.unbind();
    },

    serialize: function() {
        var properties = {
            text: this.$('.interrogative').val(),
            order: 0, // TODO
            after_text: this.$('.after-text').val()
        };

        return properties;
    }
});

/*
 * ChoiceView
 */
var ChoiceView = Backbone.View.extend({
    tagName: 'div',

    className: 'choice',

    initialize: function() {
        this.$photo = null;
        this.$audio = null;

        _.bindAll(this);

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_choice({ 'choice': this.model }));

        $('.fileinput').fileinput();

        this.$photo = this.$('.choice-files .photo');
        this.$audio = this.$('.choice-files .audio');

        this.addPhotoView(this.model.photo);
        this.addAudioView(this.model.audio);
    },

    saveChoice: function() {
        var properties = this.serialize();

        this.model.save(properties);
    },

    addPhotoView: function(photo) {
        var photoView = new PhotoView({ model: photo, parent: this });
        photoView.render();

        this.$photo.append(photoView.el);
    },

    addAudioView: function(audio) {
        var audioView = new AudioView({ model: audio });
        audioView.render();

        this.$audio.append(audioView.el);
    },

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    },

    serialize: function() {
        var properties = {
            'text': this.$('.answer').val(),
            'correct_answer': false,
            'order': 0
        };
        if (this.$('.correct').is(':checked')) {
            properties['correct_answer'] = true;
        }

        return properties;
    }
});

/*
 * PhotoView
 */
var PhotoView = Backbone.View.extend({
    tagName: 'div',
    events: {
        'change input[type="file"]': 'upload'
    },
    className: 'fileinput',

    initialize: function() {
        _.bindAll(this);

        this.$photo_file = null;
        this.$photo_name = null;

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_photo({ 'photo': this.model }));

        this.$photo_file = this.$('input[type="file"]');
        this.$photo_name = this.$('.fileinput-filename');

        if (this.model.id) {
            this.$el.addClass('fileinput-exists');
        } else {
            this.$el.addClass('fileinput-new');
        }

        this.$el.fileinput();
    },

    upload: function() {
        var file = this.$photo_file[0].files[0];

        var reader = new FileReader();
        reader.readAsDataURL(file);

        var properties = this.serialize();

        reader.onloadend = _.bind(function() {
            properties['file_string'] = reader.result;

            $.ajax({
                'url': '/musicgame/admin/upload-photo/',
                'type': 'POST',
                'data': properties,
                'success': _.bind(function(data) {
                    this.options.parent.model.photo = new Photo(data);
                    this.model = this.options.parent.model.photo;
                    this.render();

                    console.log('Photo created.');
                }, this),
                'error': function() {
                    console.log('Failed to create photo.');
                }
            });
        }, this);
    },

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    },

    serialize: function() {
        var properties = {
            credit: 'TKTK',
            caption: 'TKTK',
            file_name: this.$photo_name.text()
        };

        return properties;
    }
});

/*
 * AudioView
 */
var AudioView = Backbone.View.extend({
    tagName: 'div',
    events: {
        'change input[type="file"]': 'uploadAudio'
    },
    className: 'fileinput',

    initialize: function() {
        _.bindAll(this);

        this.$audio_file = null;
        this.$audio_name = null;

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_audio({ 'audio': this.model }));

        this.$audio_file = this.$('input[type="file"]');
        this.$audio_name = this.$('.fileinput-filename');

        if (this.model.id) {
            this.$el.addClass('fileinput-exists');
        } else {
            this.$el.addClass('fileinput-new');
        }

        this.$el.fileinput();
    },

    uploadAudio: function() {
        var file = this.$audio_file[0].files[0];

        var reader = new FileReader();
        reader.readAsDataURL(file);

        var properties = this.serialize();

        reader.onloadend = _.bind(function() {
            properties['file_string'] = reader.result;
            $.ajax({
                'url': '/musicgame/admin/upload-audio/',
                'type': 'POST',
                'data': properties,
                'success': _.bind(function(data) {
                    this.options.parent.model.audio = new Audio(data);
                    this.model = this.options.parent.model.audio;
                    this.render();

                    console.log('Audio created.');
                }, this),
                'error': function() {
                    console.log('Failed to create audio.');
                }
            });
        }, this);
    },

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    },

    serialize: function() {
        var properties = {
            credit: 'TKTK',
            caption: 'TKTK',
            file_name: this.$audio_name.text()
        };

        return properties;
    }
});
