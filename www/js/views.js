/*
 * Base class for Backbone views.
 */
var BaseView = Backbone.View.extend({
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * Mixin for Backbone views that have a 1:1 relationship with models.
 */
var ModelViewMixin = {
    close: function() {
        this.model.destroy({
            success: _.bind(function() {
                console.log(this.model.name + ' destroyed.');
            }, this),
            error: _.bind(function() {
                console.log('Failed to destroy ' + this.model.name + '.');
            }, this)
        });
    }
};

/*
 * QuizListView
 */
var QuizListView = BaseView.extend({
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
                console.log('Fetched quizzes');

                this.render();
            }, this),
            error: function() {
                console.log('Error fetching quizzes.');
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
                console.log('Quiz created.');

                window.location.replace('/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/quiz/' + quiz.get('id'));
            },
            error: function() {
                console.log('Failed to create quiz.');
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
var QuizView = BaseView.extend({
    tagName: 'tr',
    className: 'quiz',

    events: {
        'click .delete-quiz': 'close'
    },

    initialize: function() {
        _.bindAll(this);

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_quizzes({'quiz': this.model}));
    }
});

Cocktail.mixin(QuizView, ModelViewMixin);

/*
 * QuizDetailView
 */

var QuizDetailView = BaseView.extend({
    el: '#admin',

    events: {
        'click #save-quiz': 'saveQuiz',
        'click #add-question': 'addQuestionModel',
        'input .title': 'markNeedsSave',
        'input .description': 'markNeedsSave',
        'change .category': 'markNeedsSave'
    },

    initialize: function() {
        this.photoView = null;
        this.questionViews = {};

        this.$questions = null;
        this.$photo = null;
        this.$saveButton = null;

        _.bindAll(this);

        this.render();

        this.model.questions.each(_.bind(function(question) {
            this.addQuestionView(question);
        }, this));

        this.model.questions.on('add', this.addQuestionView);
        this.model.questions.on('remove', this.rmQuestionView);

        this.addPhotoView();
    },

    render: function() {
        this.$el.empty();

        this.$el.html(JST.admin_quiz_detail());

        this.$questions = this.$('.questions');
        this.$photo = this.$('.photo');
        this.$saveButton = this.$('#save-quiz');

        _.each(this.questionViews, function(view) {
            view.render();
        });

        if (this.model.questions.length === 0) {
            for (i = 0; i < 4; i++) {
                this.addQuestionModel();
            }
        }
    },

    markNeedsSave: function() {
        this.$saveButton.removeAttr('disabled');
        this.$saveButton.text('Save now');
    },

    markSaved: function() {
        this.$saveButton.attr('disabled', 'disabled');
        this.$saveButton.text('Saved');
    },

    saveQuiz: function() {
        var properties = this.serialize();

        this.model.save(properties, {
            success: _.bind(function() {
                console.log('Quiz saved.');

                _.each(this.questionViews, function(question) {
                    question.saveQuestion();
                });

                this.markSaved();
            }, this),
            error: _.bind(function() {
                console.log('Error saving quiz.');
            }, this)
        });
    },

    addQuestionModel: function() {
        var question = new Question({ quiz: this.model.id });

        this.model.questions.add(question);
    },

    addQuestionView: function(question) {
        var questionView = new QuestionView({ model: question });

        this.$questions.append(questionView.el);
        this.questionViews[question.cid] = questionView;
    },

    rmQuestionView: function(question) {
        delete this.questionViews[question.cid];

        this.markNeedsSave();
    },

    addPhotoView: function(photo) {
        this.photoView = new PhotoView({
            'model': this.model.photo,
            'parent': this,
            'el': this.$photo
        });
        this.photoView.render();
    },

    serialize: function() {
        var properties = {
            title: this.$('.title').val(),
            text: this.$('.description').val(),
            category: this.$('.category option:selected').val()
        };

        return properties;
    }
});

/*
 * QuestionView
 */
var QuestionView = BaseView.extend({
    tagName: 'div',
    className: 'question',

    events: {
        'click .add-choice': 'addChoiceModel',
        'click .rm-question': 'close',
        'click #save-quiz': 'saveQuestion',
        'input .interrogative': 'markNeedsSave',
        'input .after-text': 'markNeedsSave'
    },

    initialize: function() {
        this.audioView = null;
        this.photoView = null;
        this.choiceViews = {};

        this.$choices = null;
        this.$photo = null;
        this.$audio = null;
        this.$question = null;
        this.$afterText = null;

        _.bindAll(this);

        this.render();

        this.model.choices.each(_.bind(function(choice) {
            this.addChoiceView(choice);
        }, this));

        this.addPhotoView();
        this.addAudioView();

        this.model.choices.on('add', this.addChoiceView);
        this.model.choices.on('remove', this.rmChoiceView);
    },

    render: function() {
        this.$el.html(JST.admin_question({ 'question': this.model }));

        this.$choices = this.$('.choices');
        this.$photo = this.$('.photo');
        this.$audio = this.$('.audio');
        this.$question = this.$('.interrogative');
        this.$afterText = this.$('.after-text');

        _.each(this.choiceViews, function(view) {
            view.render();
        });

        if (this.model.choices.length === 0) {
            for (i = 0; i < 4; i++) {
                this.addChoiceModel();
            }
        }
    },

    addChoiceModel: function() {
        var choice = new Choice();
        choice.question = this.model;

        // First choice is always selected
        if (this.model.choices.length === 0) {
            choice.set('correct_answer', true);
        }

        this.model.choices.add(choice);
    },

    addChoiceView: function(choice) {
        var choiceView = new ChoiceView({ model: choice });
        choiceView.render();

        this.$choices.append(choiceView.el);

        this.choiceViews[choice.cid] = choiceView;
    },

    rmChoiceView: function(choice) {
        delete this.choiceViews[choice.cid];

        this.markNeedsSave();
    },

    addPhotoView: function(photo) {
        this.photoView = new PhotoView({
            'model': this.model.photo,
            'parent': this,
            'el': this.$photo
        });
        this.photoView.render();
    },

    addAudioView: function(audio) {
        this.audioView = new AudioView({
            'model': this.model.audio,
            'parent': this,
            'el': this.$audio
        });
        this.audioView.render();
    },

    saveQuestion: function() {
        var properties = this.serialize();

        this.model.save(properties, {
            success: _.bind(function() {
                console.log('Saved question.');

                _.each(this.choiceViews, function(choiceView) {
                    choiceView.saveChoice();
                });
            }, this),
            error: _.bind(function() {
                console.log('Error saving question.');
            }, this)
        });
    },

    markNeedsSave: function() {
        quizDetailView.markNeedsSave();
    },

    close: function() {
        this.audioView.close();
        this.photoView.close();

        _.each(this.choiceViews, function(choiceView) {
            choiceView.close();
        });
    },

    serialize: function() {
        var properties = {
            text: this.$question.val(),
            order: this.model.collection.indexOf(this.model),
            after_text: this.$afterText.val()
        };

        return properties;
    }
});

Cocktail.mixin(QuestionView, ModelViewMixin);

/*
 * ChoiceView
 */
var ChoiceView = BaseView.extend({
    tagName: 'div',
    className: 'choice',

    events: {
        'click .rm-choice': 'close',
        'input .answer': 'markNeedsSave'
    },

    initialize: function() {
        this.$photo = null;
        this.$audio = null;
        this.audioView = null;
        this.photoView = null;

        _.bindAll(this);

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_choice({ 'choice': this.model }));

        this.$photo = this.$('.choice-files .photo');
        this.$audio = this.$('.choice-files .audio');

        this.addPhotoView();
        this.addAudioView();
    },

    saveChoice: function() {
        var properties = this.serialize();

        this.model.save(properties, {
            success: function() {
                console.log('Saved choice.');
            },
            error: function() {
                console.log('Failed to save choice.');
            }
        });
    },

    addPhotoView: function(photo) {
        this.photoView = new PhotoView({
            'model': this.model.photo,
            'parent': this,
            'el': this.$photo
        });
        this.photoView.render();
    },

    addAudioView: function(audio) {
        this.audioView = new AudioView({
            'model': this.model.audio,
            'parent': this,
            'el': this.$audio
        });
        this.audioView.render();
    },

    markNeedsSave: function() {
        quizDetailView.markNeedsSave();
    },

    close: function() {
        this.audioView.close();
        this.photoView.close();
    },

    serialize: function() {
        var properties = {
            'text': this.$('.answer').val(),
            'correct_answer': false,
            'order': this.model.collection.indexOf(this.model),
        };

        if (this.$('.correct').is(':checked')) {
            properties['correct_answer'] = true;
        }

        return properties;
    }
});

Cocktail.mixin(ChoiceView, ModelViewMixin);

/*
 * PhotoView
 */
var PhotoView = BaseView.extend({
    events: {
        'change input[type="file"]': 'uploadPhoto',
        'click .remove': 'removePhoto'
    },

    initialize: function() {
        _.bindAll(this);

        this.$photoForm = null;
        this.$photoFile = null;

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_photo({ 'photo': this.model }));

        this.$photoForm = this.$('form');
        this.$photoFile = this.$('input[type="file"]');
    },

    uploadPhoto: function(e) {
        var file = this.$photoFile[0].files[0];

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
                    console.log('Photo created.');

                    this.options.parent.model.setPhoto(new Photo(data));
                    this.model = this.options.parent.model.photo;
                    this.render();

                    this.markNeedsSave();
                }, this),
                'error': function() {
                    console.log('Failed to create photo.');
                }
            });
        }, this);
    },

    removePhoto: function(e) {
        this.model.destroy({
            success: function() {
                console.log('Photo destroyed.');
            },
            error: function() {
                console.log('Failed to destroy Photo.');
            }
        });

        this.model = new Photo();
        this.options.parent.model.setPhoto(this.model);

        // Reset file input via: http://stackoverflow.com/a/13351234/24608
        this.$photoFile.wrap('<form>').closest('form').get(0).reset();
        this.$photoFile.unwrap();

        this.render();

        this.markNeedsSave();

        e.preventDefault();
    },

    markNeedsSave: function() {
        quizDetailView.markNeedsSave();
    },

    serialize: function() {
        var properties = {
            credit: 'TKTK',
            caption: 'TKTK',
            file_name: this.$photoFile[0].files[0].name
        };

        return properties;
    }
});

Cocktail.mixin(PhotoView, ModelViewMixin);

/*
 * AudioView
 */
var AudioView = BaseView.extend({
    events: {
        'change input[type="file"]': 'uploadAudio',
        'click .remove': 'removeAudio',
        'click .play': 'play',
        'click .stop': 'stop'
    },

    initialize: function() {
        _.bindAll(this);

        this.$audioFile = null;
        this.$audioPlayer = null;
        this.$play = null;
        this.$stop = null;

        this.render();
    },

    render: function() {
        if (this.$audioPlayer) {
            this.$audioPlayer.jPlayer('destroy');
        }

        this.$el.html(JST.admin_audio({ 'audio': this.model }));

        this.$audioFile = this.$('input[type="file"]');
        this.$audioPlayer = this.$('#jp-player-' + this.model.id);
        this.$play = this.$('.play');
        this.$stop = this.$('.stop');

        if (this.model.id){
            this.$audioPlayer.jPlayer({
                ready: _.bind(function () {
                    this.$audioPlayer.jPlayer('setMedia', {
                        mp3: this.model.get('rendered_mp3_path'),
                        oga: this.model.get('rendered_oga_path')
                    });
                }, this),
                play: function() {
                    $(this).jPlayer('pauseOthers', 0);
                },
                ended: _.bind(function() {
                    this.$audioPlayer.jPlayer('stop');
                    this.$stop.hide();
                    this.$play.show();
                }, this),
                swfPath: 'js/lib',
                supplied: 'mp3, oga',
                loop: false,
            });

            this.$play.show();
            this.$stop.hide();
        }
    },

    play: function() {
        this.$audioPlayer.jPlayer('play');
        this.$play.hide();
        this.$stop.show();
    },

    stop: function() {
        this.$audioPlayer.jPlayer('stop');
        this.$stop.hide();
        this.$play.show();
    },

    uploadAudio: function(e) {
        var file = this.$audioFile[0].files[0];

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
                    console.log('Audio created.');

                    this.options.parent.model.setAudio(new Audio(data));
                    this.model = this.options.parent.model.audio;
                    this.render();

                    this.markNeedsSave();
                }, this),
                'error': function() {
                    console.log('Failed to create audio.');
                }
            });
        }, this);
    },

    removeAudio: function(e) {
        this.model.destroy({
            success: function() {
                console.log('Audio destroyed.');
            },
            error: function() {
                console.log('Failed to destroy Audio.');
            }
        });

        this.model = new Audio();
        this.options.parent.model.setAudio(this.model);

        this.render();

        this.markNeedsSave();

        e.preventDefault();
    },

    markNeedsSave: function() {
        quizDetailView.markNeedsSave();
    },

    close: function() {
        this.$audioPlayer.jPlayer('destroy');
    },

    serialize: function() {
        var properties = {
            credit: 'TKTK',
            caption: 'TKTK',
            file_name: this.$audioFile[0].files[0].name
        };

        return properties;
    }
});

Cocktail.mixin(AudioView, ModelViewMixin);
