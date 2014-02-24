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

                $(".quiz-list").tablesorter();

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
            category: 'Drum Fill Friday',
            author: 'Put author name here.'
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
        'click #preview': 'previewQuiz',
        'click #publish': 'publishQuiz',
        'click #add-question': 'addQuestionModel',
        'input .title': 'markNeedsSave',
        'input .description': 'markNeedsSave',
        'change .category': 'markNeedsSave',
        'input .author': 'markNeedsSave'
    },

    initialize: function() {
        this.previewModalView = null;
        this.embedModalView = null;
        this.photoView = null;
        this.questionViews = {};

        this.$questions = null;
        this.$photo = null;
        this.$saveButton = null;
        this.$previewButton = null;

        _.bindAll(this);

        this.render();

        this.previewModalView = new PreviewModalView({
            'model': this.model
        });

        this.embedModalView = new EmbedModalView({
            'model': this.model
        });

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
        this.$previewButton = this.$('#preview-publish');

        _.each(this.questionViews, function(view) {
            view.render();
        });

        if (this.model.questions.length === 0) {
            this.addQuestionModel();
        }
    },

    markNeedsSave: function() {
        this.$saveButton.removeAttr('disabled');
        this.$previewButton.attr('disabled', 'disabled');
        this.$saveButton.text('Save now');
    },

    markSaved: function() {
        this.$saveButton.attr('disabled', 'disabled');
        this.$previewButton.removeAttr('disabled');
        this.$saveButton.text('Saved');
    },

    previewQuiz: function() {
        this.previewModalView.show();
    },

    publishQuiz: function() {
        this.embedModalView.show();
    },

    saveQuiz: function() {
        var properties = this.serialize();

        this.model.save(properties, {
            skipped: function() {
                console.log('Skipped saving Quiz.');
            },
            success: function() {
                console.log('Quiz saved.');
            },
            error: function() {
                console.log('Error saving quiz.');
            }
        }).then(_.bind(function() {
            // Save All Questions
            this.saveQuestions().then(_.bind(function() {
                this.saveChoices().then(_.bind(function() {
                    this.deployQuiz();
                }, this));
            }, this));
        }, this));
    },

    saveQuestions: function() {
        var saves = [];

        _.each(this.questionViews, function(questionView) {
            saves.push.apply(saves, questionView.saveQuestion());
        });

        return $.when(saves);
    },

    saveChoices: function() {
        var saves = [];

        _.each(this.questionViews, function(questionView) {
            _.each(questionView.choiceViews, function(choiceView) {
                saves.push.apply(saves, choiceView.saveChoice());
            });
        });

        return $.when(saves);
    },

    deployQuiz: function() {
        this.model.deploy();

        this.markSaved();
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
            category: this.$('.category option:selected').val(),
            author: this.$('.author').val()
        };

        return properties;
    }
});

/*
 * PreviewModalView
 */
var PreviewModalView = BaseView.extend({
    el: '#preview-modal',

    initialize: function() {
        this.$preview = null;

        this.urlRoot = '/' + APP_CONFIG['PROJECT_SLUG'];

        if (APP_CONFIG['DEPLOYMENT_TARGET']) {
            this.urlRoot = APP_CONFIG['S3_BASE_URL']
        }

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_preview());

        $preview = this.$('.preview');

        $preview.responsiveIframe({
            src: this.urlRoot + '/game.html?quiz=' + this.model.get('slug')
        });
    },

    show: function() {
        this.$('.modal').modal();
    }
});

/*
 * EmbedModalView
 */
var EmbedModalView = BaseView.extend({
    el: '#embed-modal',

    events: {
        'click .save': 'onClickSave'
    },

    initialize: function() {
        this.$seamusUrl = null;

        this.urlRoot = '/' + APP_CONFIG['PROJECT_SLUG'];

        if (APP_CONFIG['DEPLOYMENT_TARGET']) {
            this.urlRoot = APP_CONFIG['S3_BASE_URL']
        }

        this.embedCode = null;

        this.render();
    },

    render: function() {
        this.embedCode = JST.embed({
            'urlRoot': this.urlRoot,
            'slug': this.model.get('slug')
        });

        this.$el.html(JST.admin_embed({
            'quiz': this.model,
            'embed': this.embedCode
        }));

        this.$seamusUrl = this.$('.seamus-url');

        ZeroClipboard.setDefaults({
            moviePath: this.urlRoot + '/js/lib/ZeroClipboard.swf'
        });

        var clipper = new ZeroClipboard($('.clipper'));

        clipper.on('complete', function() {
            alert('Embed code copied to your clipboard!');
        });

        clipper.on('dataRequested', _.bind(function(client, args) {
            client.setText(this.embedCode);
        }, this));
    },

    show: function() {
        this.$('.modal').modal();
    },

    onClickSave: function(e) {
        e.preventDefault();

        $.ajax({
            'url': '/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/update-seamus-url/' + this.model.get('slug') + '/',
            'method': 'POST',
            'data': { 'seamus_url': this.$seamusUrl.val() },
            'success': function() {
                console.log('Seamus URL updated.');
            },
            'error': function() {
                console.log('Failed to update Seamus URL.');
            }
        });
    }
});

/*
 * QuestionView
 */
var QuestionView = BaseView.extend({
    tagName: 'div',
    className: 'question',

    events: {
        'click .add-choice': 'onAddChoice',
        'click .rm-question': 'close',
        'click #save-quiz': 'saveQuestion',
        'input .interrogative': 'markNeedsSave',
        'input .after-text': 'markNeedsSave'
    },

    initialize: function() {
        this.audioView = null;
        this.photoView = null;
        this.choiceViews = {};

        this.$addChoice = null;
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

        this.$addChoice = this.$('.add-choice');
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

    onAddChoice: function(e) {
        e.preventDefault();

        this.addChoiceModel();
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

        if (this.model.choices.length == 4) {
            this.$addChoice.hide();
        }
    },

    rmChoiceView: function(choice) {
        delete this.choiceViews[choice.cid];

        this.$addChoice.show();

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

        return this.model.save(properties, {
            skipped: function() {
                console.log('Skipped saving Question.');
            },
            success: function() {
                console.log('Saved Question.');
            },
            error: function() {
                console.log('Error saving Question.');
            }
        });
    },

    markNeedsSave: function() {
        quizDetailView.markNeedsSave();
    },

    close: function() {
        BaseView.prototype.close.apply(this);

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
        'input .answer': 'markNeedsSave',
        'change input[type="radio"]': 'markNeedsSave'
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

        return this.model.save(properties, {
            skipped: _.bind(function() {
                console.log('Skipped saving Choice.');
            }, this),
            success: function() {
                console.log('Saved Choice.');
            },
            error: function() {
                console.log('Failed to save Choice.');
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
        BaseView.prototype.close.apply(this);

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
        e.preventDefault();

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

        this.render();

        this.markNeedsSave();
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
        e.preventDefault();

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
    },

    markNeedsSave: function() {
        quizDetailView.markNeedsSave();
    },

    close: function() {
        BaseView.prototype.close.apply(this);

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
