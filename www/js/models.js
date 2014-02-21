/*
 * Quiz
 */
var Quiz = Backbone.Model.extend({
    questions: null,
    photo: null,

    initialize: function(attributes) {
        this.questions = new Questions();
        this.setPhoto(new Photo());

        if (attributes) {
            if ("questions" in attributes) {
                _.each(attributes.questions, _.bind(function(questionData) {
                    var question = new Question(questionData);
                    question.quiz = this;

                    this.questions.add(question);
                }, this));
            }
            
            if ("photo" in attributes) {
                this.setPhoto(new Photo(attributes.photo));
            }
        }
    },
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        delete data['questions'];
        delete data['created'];
        delete data['updated'];

        return data;
    },
    onPhotoChange: function(photo) {
        this.set('photo', this.photo.id ? this.photo.id : null);
    },
    setPhoto: function(photo) {
        if (this.photo) {
            this.photo.off('change', this.onPhotoChange);
        }

        this.photo = photo;
        this.onPhotoChange(this.photo);

        this.photo.on('change', this.onPhotoChange);
    },
    getPreviewUrl: function() {
        return '/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/preview.html?quiz=' + this.get('slug');
    }
});

/*
 * Question
 */
var Question = Backbone.Model.extend({
    quiz: null,
    choices: null,
    audio: null,
    photo: null,

    initialize: function(attributes) {
        this.choices = new Choices();
        this.setAudio(new Audio());
        this.setPhoto(new Photo());

        if (attributes) {
            if ("choices" in attributes) {
                _.each(attributes.choices, _.bind(function(choiceData) {
                    var choice = new Choice(choiceData);
                    choice.question = this;

                    this.choices.add(choice);
                }, this));
            }

            if ("audio" in attributes) {
                this.setAudio(new Audio(attributes.audio));
            }
            
            if ("photo" in attributes) {
                this.setPhoto(new Photo(attributes.photo));
            }
        }
    },
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        // TODO: not necessary since these can't be reparented?
        this.set('quiz', this.quiz.id);

        var data = _.clone(this.attributes);

        delete data['choices'];

        return data;
    },
    onPhotoChange: function(photo) {
        this.set('photo', this.photo.id ? this.photo.id : null);
    },
    onAudioChange: function(audio) {
        this.set('audio', this.audio.id ? this.audio.id : null);
    },
    setPhoto: function(photo) {
        if (this.photo) {
            this.photo.off('change', this.onPhotoChange);
        }

        this.photo = photo;
        this.onPhotoChange(this.photo);

        this.photo.on('change', this.onPhotoChange);
    },
    setAudio: function(audio) {
        if (this.audio) {
            this.audio.off('change', this.onAudioChange);
        }

        this.audio = audio;
        this.onAudioChange(this.audio);

        this.audio.on('change', this.onAudioChange);
    }
});

var Choice = Backbone.Model.extend({
    question: null,
    audio: null,
    photo: null,

    initialize: function(attributes) {
        this.setAudio(new Audio());
        this.setPhoto(new Photo());

        if (attributes) {
            if ("audio" in attributes) {
                this.setAudio(new Audio(attributes.audio));
            }
            
            if ("photo" in attributes) {
                this.setPhoto(new Photo(attributes.photo));
            }
        }
    },
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        data['question'] = this.question.id;
        data['photo'] = (this.photo && this.photo.id) ? this.photo.id : null
        data['audio'] = (this.audio && this.audio.id) ? this.audio.id : null

        return data;
    },
    onPhotoChange: function(photo) {
        this.set('photo', this.photo.id ? this.photo.id : null);
    },
    onAudioChange: function(audio) {
        this.set('audio', this.audio.id ? this.audio.id : null);
    },
    setPhoto: function(photo) {
        if (this.photo) {
            this.photo.off('change', this.onPhotoChange);
        }

        this.photo = photo;
        this.onPhotoChange(this.photo);

        this.photo.on('change', this.onPhotoChange);
    },
    setAudio: function(audio) {
        if (this.audio) {
            this.audio.off('change', this.onAudioChange);
        }

        this.audio = audio;
        this.onAudioChange(this.audio);

        this.audio.on('change', this.onAudioChange);
    }
});

var Audio = Backbone.Model.extend({
    url: function() {
        return '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/audio/' + this.id + '/';
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Photo = Backbone.Model.extend({
    url: function() {
        return '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/photo/' + this.id + '/';
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});
