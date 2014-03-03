/*
 * Base model class that tracks when a model has changed
 * and avoids syncing if it hasn't.
 *
 * When calling save on a subclass of this Model you should
 * pass a "skipped" callback in addition to "success" and
 * "error".
 */
var ChangeTrackingModel = Backbone.Model.extend({
    initialize: function(attributes) {
        this.needsSave = this.isNew();

        this.on('change', this.onChange);
    },
  
    onChange: function() {
        this.needsSave = true;
    },

    sync: function(method, model, options) {
        if (method === 'create' || method === 'update') {
            if (!this.needsSave) {
                if (options.skipped) {
                    options.skipped();
                }

                return $.Deferred().resolve().promise();
            }
        }

        options = options || {};
        
        var success = options.success;
        
        options.success = function(resp) {
            success && success(resp);
            model.needsSave = false;
        };
        
        return Backbone.sync(method, model, options);
    } 
});

/*
 * RelatedPhotoMixin
 */
var RelatedPhotoMixin = {
    parse: function(response, options) {
        if (response['photo']) {
            var photo = new Photo(response['photo'], { 'parse': true });
            this.setPhoto(photo);
        }

        if (!this.photo) {
            this.setPhoto(new Photo());
        }

        delete response['photo'];

        return response;
    },

    onPhotoChange: function(photo) {
        //console.log(this.get('photo') + ' == ' + this.photo.id);
        this.set('photo', this.photo.id ? this.photo.id : null);
    },

    setPhoto: function(photo) {
        if (this.photo) {
            this.photo.off('change', this.onPhotoChange);
        }

        this.photo = photo;
        this.onPhotoChange(this.photo);

        this.photo.on('change', this.onPhotoChange);
    }
}

/*
 * RelatedAudioMixin
 */
var RelatedAudioMixin = {
    parse: function(response, options) {
        if (response['audio']) {
            var audio = new Audio(response['audio'], { 'parse': true });
            this.set('audio', response['audio'].id);
            this.setAudio(audio);
        }

        if (!this.audio) {
            this.setAudio(new Audio());
        }

        delete response['audio'];

        return response;
    },

    onAudioChange: function(audio) {
        this.set('audio', this.audio.id ? this.audio.id : null);
    },

    setAudio: function(audio) {
        if (this.audio) {
            this.audio.off('change', this.onAudioChange);
        }

        this.audio = audio;
        this.onAudioChange(this.audio);

        this.audio.on('change', this.onAudioChange);
    }
}

/*
 * Quiz
 */
var Quiz = ChangeTrackingModel.extend({
    name: 'Quiz',

    initialize: function(attributes) {
        ChangeTrackingModel.prototype.initialize.apply(this, [attributes]);  
    },

    parse: function(response, options) {
        this.questions = new Questions();

        if (response['questions']) {
            _.each(response['questions'], _.bind(function(questionData) {
                var question = new Question(questionData, { 'parse': true });
                question.quiz = this;

                this.questions.add(question);
            }, this));
        }

        delete response['questions'];

        return response;
    },

    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },

    toJSON: function() {
        var data = _.clone(this.attributes);

        delete data['created'];
        delete data['updated'];

        return data;
    },

    deploy: function() {
        return $.ajax({
            'url': '/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/deploy/' + this.get('slug') + '/',
            'type': 'GET',
            'success': function() {
                console.log('Quiz deployed.');
            },
            'error': function() {
                console.log('Failed to deploy quiz.');
            }
        });
    }
});

Cocktail.mixin(Quiz, RelatedPhotoMixin);

/*
 * Question
 */
var Question = ChangeTrackingModel.extend({
    name: 'Question',

    initialize: function(attributes) {
        ChangeTrackingModel.prototype.initialize.apply(this, [attributes]);  
    },

    parse: function(response, options) {
        this.choices = new Choices();

        if (response['choices']) {
            _.each(response['choices'], _.bind(function(choiceData) {
                var choice = new Choice(choiceData, { 'parse': true });
                choice.question = this;

                this.choices.add(choice);
            }, this));
        }

        delete response['choices'];

        return response;
    },

    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    }, 

    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

Cocktail.mixin(Question, RelatedPhotoMixin, RelatedAudioMixin);

var Choice = ChangeTrackingModel.extend({
    name: 'Choice',

    initialize: function(attributes) {
        ChangeTrackingModel.prototype.initialize.apply(this, [attributes]);  
    },

    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },

    toJSON: function() {
        var data = _.clone(this.attributes);

        data['question'] = this.question.id;

        return data;
    }
});

Cocktail.mixin(Choice, RelatedPhotoMixin, RelatedAudioMixin);

var Audio = ChangeTrackingModel.extend({
    name: 'Audio',

    initialize: function(attributes) {
        ChangeTrackingModel.prototype.initialize.apply(this, [attributes]);  
    },

    url: function() {
        return '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/audio/' + this.id + '/';
    },

    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Photo = ChangeTrackingModel.extend({
    name: 'Photo',

    initialize: function(attributes) {
        ChangeTrackingModel.prototype.initialize.apply(this, [attributes]);  
    },

    url: function() {
        return '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/photo/' + this.id + '/';
    },

    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});
