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
        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    },
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

        if (attributes) {
            if ("choices" in attributes) {
                _.each(attributes.choices, _.bind(function(choiceData) {
                    var choice = new Choice(choiceData);
                    choice.question = this;

                    this.choices.add(choice);
                }, this));
            }
            if ("audio" in attributes) {
                this.audio = new Audio(attributes.audio);
            }
            if ("photo" in attributes) {
                this.photo = new Photo(attributes.photo);
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

        delete data['choices'];
        delete data['photo'];
        delete data['audio'];

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Choice = Backbone.Model.extend({

    question: null,
    audio: null,
    photo: null,

    initialize: function(attributes) {
        if (attributes) {
            if ("audio" in attributes) {
                this.audio = new Audio(attributes.audio);
            }
            if ("photo" in attributes) {
                this.photo = new Photo(attributes.photo);
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
        console.log(data);
        data['question'] = this.question.id;

        delete data['photo'];
        delete data['audio'];

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
})

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
})

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
})