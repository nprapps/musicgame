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
        return {};
    }
});

/*
 * QuizView
 */
var QuizView = BaseView.extend({
    tagName: 'tr',
    className: 'quiz',

    events: {
        'click .delete-quiz': 'rmQuiz'
    },

    initialize: function() {
        _.bindAll(this);

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_quizzes({'quiz': this.model}));
    },

    rmQuiz: function() {
        bootbox.confirm('Are you sure you want to delete the quiz "' + this.model.get('title') + '"?', _.bind(function(result) {
            if (result) {
                this.close();
            }
        }, this));
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
        'keyup .description': 'markNeedsSave',
        //'change .category': 'markNeedsSave',
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
        this.$publishButton = null;

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
        this.$previewButton = this.$('#preview');
        this.$publishButton = this.$('#publish');

        _.each(this.questionViews, function(view) {
            view.render();
        });

        var editor = new MediumEditor(this.$('.description'), {
            placeholder: '',
            buttons: ['bold','italic','anchor'],
            buttonLabels: 'fontawesome',
            targetBlank: true
        });
    },

    markNeedsSave: function() {
        this.$saveButton.removeAttr('disabled');
        this.$previewButton.attr('disabled', 'disabled');
        this.$publishButton.attr('disabled', 'disabled');
        this.$saveButton.text('Save now');
    },

    markSaving: function() {
        this.$saveButton.attr('disabled', 'disabled');
        this.$previewButton.attr('disabled', 'disabled');
        this.$publishButton.attr('disabled', 'disabled');
        this.$saveButton.text('Saving...');
    },

    markSaved: function() {
        this.$saveButton.attr('disabled', 'disabled');
        this.$previewButton.removeAttr('disabled');
        this.$publishButton.removeAttr('disabled');
        this.$saveButton.text('Saved');
    },

    previewQuiz: function() {
        this.previewModalView.show();
    },

    publishQuiz: function() {
        this.embedModalView.show();
    },

    saveQuiz: function() {
        $('.editable, .input-group').smartquotes();
        var properties = this.serialize();

        if (!properties['title']) {
            bootbox.alert('You must specify a title for the quiz before saving.');
            return;
        }

        // Save the quiz
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
                // Save all choices
                this.saveChoices().then(_.bind(function() {
                    // Deploy
                    this.deployQuiz().then(_.bind(function() {
                        // Mark as saved
                        console.log('Save complete.');
                        this.markSaved();
                    }, this));;
                }, this));
            }, this));
        }, this));
    },

    saveQuestions: function() {
        var saves = [];

        _.each(this.questionViews, function(questionView) {
            saves.push(questionView.saveQuestion());
        });

        return $.when.apply(this, saves);
    },

    saveChoices: function() {
        var saves = [];

        _.each(this.questionViews, function(questionView) {
            _.each(questionView.choiceViews, function(choiceView) {
                saves.push(choiceView.saveChoice());
            });
        });

        return $.when.apply(this, saves);
    },

    deployQuiz: function() {
        return this.model.deploy();
    },

    addQuestionModel: function() {
        var question = new Question({ quiz: this.model.id }, { 'parse': true });

        this.model.questions.add(question);
    },

    addQuestionView: function(question) {
        var questionView = new QuestionView({ model: question, parent: this });

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
            text: this.$('.description').html(),
            //category: this.$('.category option:selected').val(),
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

        $previewMobile = this.$('.preview-mobile');
        $previewLarge = this.$('.preview-large');
    },

    show: function() {
        var url = this.urlRoot + '/game.html?quiz=' + this.model.get('slug');

        $previewMobile.responsiveIframe({ src: url });
        $previewLarge.responsiveIframe({ src: url });

        this.$('.modal').modal();

        this.$('.modal').on('hide.bs.modal', this.onModalClosed);
    },

    onModalClosed: function() {
        $previewMobile.empty();
        $previewLarge.empty();
    }
});

/*
 * EmbedModalView
 */
var EmbedModalView = BaseView.extend({
    el: '#embed-modal',

    events: {
        'click .continue': 'onClickContinue'
    },

    initialize: function() {
        this.$step1 = null;
        this.$step2 = null;
        this.$cancel = null;
        this.$continue = null;
        this.$close = null;
        this.$seamusUrl = null;
        this.$invalidUrl = null;

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

        this.$step1 = this.$('.step1');
        this.$step2 = this.$('.step2');
        this.$cancel = this.$('.cancel');
        this.$continue = this.$('.continue');
        this.$close = this.$('.done');
        this.$seamusUrl = this.$('.seamus-url');
        this.$invalidUrl = this.$('.invalid-url');

        ZeroClipboard.setDefaults({
            moviePath: this.urlRoot + '/js/lib/ZeroClipboard.swf'
        });

        var clipper = new ZeroClipboard($('.clipper'));

        clipper.on('complete', function() {
            bootbox.alert('Embed code copied to your clipboard!');
        });

        clipper.on('dataRequested', _.bind(function(client, args) {
            client.setText(this.embedCode);
        }, this));
    },

    show: function() {
        this.$step1.show();
        this.$step2.hide();
        this.$cancel.show();
        this.$continue.show();
        this.$close.hide();
        this.$invalidUrl.hide();

        this.$('.modal').modal();
    },

    gotoStep2: function() {
        this.$step1.hide();
        this.$step2.show();
        this.$cancel.hide();
        this.$continue.hide();
        this.$close.show();
    },

    onClickContinue: function(e) {
        e.preventDefault();

        var seamusUrl = this.$seamusUrl.val();

        if (seamusUrl.indexOf('http://www.npr.org/')) {
            this.$invalidUrl.show();

            return;
        }

        $.ajax({
            'url': '/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/update-seamus-url/' + this.model.get('slug') + '/',
            'method': 'POST',
            'data': { 'seamus_url': seamusUrl },
            'success': _.bind(function() {
                console.log('Seamus URL updated.');

                this.gotoStep2();
            }, this),
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
        'keyup .after-text': 'markNeedsSave'
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

        this.toggleViews();
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

        var editor = new MediumEditor(this.$afterText, {
            placeholder: 'Description (appears after a choice is made)',
            buttons: ['bold','italic','anchor'],
            buttonLabels: 'fontawesome',
            targetBlank: true
        });
    },

    onAddChoice: function(e) {
        e.preventDefault();

        this.addChoiceModel();
    },

    addChoiceModel: function() {
        var choice = new Choice({}, { 'parse': true });
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

        if (!choice.id) {
            this.markNeedsSave();
        }

        if (this.model.choices.length == 4) {
            this.$addChoice.hide();
        }
    },

    rmChoiceView: function(choice) {
        delete this.choiceViews[choice.cid];

        // Grab the first choice in the list and make it the correct one.
        // It turns out we need to have a correct choice all the time because
        // of reasons.

        // Make sure there's at least one choice left.
        if (this.model.choices.models.length > 0) {
            // The new correct choice is the first one in the model list.
            var correct_choice = this.model.choices.models[0]

            // Select it by ID.
            $('#Q' + correct_choice.question.cid + '-C' + correct_choice.cid)
                .attr('checked', 'checked');
        }

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

    toggleViews: function() {
        if (this.model.photo.id) {
            this.$audio.hide();
            this.$photo.show();
        } else if (this.model.audio.id) {
            this.$audio.show();
            this.$photo.hide();
        } else {
            this.$audio.show();
            this.$photo.show();
        }
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
        var $questions = this.options.parent.$questions.children('.question');
        var order = $questions.index(this.$el);

        var properties = {
            'text': this.$question.val(),
            'order': order,
            'after_text': this.$afterText.html()
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
        'click .rm-choice': 'rmChoice',
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

    rmChoice: function() {
        if (this.model.collection.length <= 2) {
            bootbox.alert('This choice can not be deleted. A question must have at least two choices.');
            return;
        }

        this.close();
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

                    this.options.parent.model.setPhoto(new Photo(data, { 'parse': true }));
                    this.model = this.options.parent.model.photo;
                    this.render();

                    if (this.options.parent.toggleViews) {
                        this.options.parent.toggleViews();
                    }

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

        this.model = new Photo({}, { 'parse': true });
        this.options.parent.model.setPhoto(this.model);

        this.render();

        if (this.options.parent.toggleViews) {
            this.options.parent.toggleViews();
        }

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
        this.$audioPlayer = this.$('#jp-player-' + this.model.cid);
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

                    this.options.parent.model.setAudio(new Audio(data, { 'parse': true }));
                    this.model = this.options.parent.model.audio;
                    this.render();

                    if (this.options.parent.toggleViews) {
                        this.options.parent.toggleViews();
                    }

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

        this.model = new Audio({}, { 'parse': true });
        this.options.parent.model.setAudio(this.model);

        this.render();

        if (this.options.parent.toggleViews) {
            this.options.parent.toggleViews();
        }

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
