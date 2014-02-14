var QuizCategory = Backbone.Model.extend({

    quizzes: null,

    initialize: function(attributes) {
        this.quizzes = new Quiz();

        if (attributes) {
            if ("quizzes" in attributes) {
                this.quizzes.add(attributes.quizzes);
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

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    },
});


/*
 * Quiz
 */
var Quiz = Backbone.Model.extend({

    questions: null,

    initialize: function(attributes) {
        this.questions = new Questions();

        if (attributes) {
            if ("questions" in attributes) {
                _.each(attributes.questions, _.bind(function(questionData) {
                    var question = new Question(questionData);
                    question.quiz = this;

                    this.questions.add(question);
                }, this));
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
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
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
    audios: null,
    photos: null,

    initialize: function(attributes) {
        this.choices = new Choices();
        this.audios = new Audios();
        this.photos = new Photos();

        if (attributes) {
            if ("choices" in attributes) {
                _.each(attributes.choices, _.bind(function(choiceData) {
                    var choice = new Choice(choiceData);
                    choice.question = this;

                    this.choices.add(choice);
                }, this));
            }
            if ("audio" in attributes) {
                var audio = new Audio(attributes.audio);
                this.audios.add(audio);
            }
            if ("photo" in attributes) {
                var photo = new Photo(attributes.photo);

                this.photos.add(photo);
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

        data['quiz'] = this.quiz.id;
        data['photo'] = this.photo ? this.photo.id : null
        data['audio'] = this.audio ? this.audio.id : null

        delete data['choices'];

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Choice = Backbone.Model.extend({

    question: null,
    audios: null,
    photos: null,

    initialize: function(attributes) {
        this.audios = new Audios();
        this.photos = new Photos();

        if (attributes) {
            if ("audio" in attributes) {
                var audio = new Audio(attributes.audio);
                this.audios.add(audio);
            }
            if ("photo" in attributes) {
                var photo = new Photo(attributes.photo);

                this.photos.add(photo);
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

        delete data['photo'];
        delete data['audio'];

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Audio = Backbone.Model.extend({
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Photo = Backbone.Model.extend({
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});
