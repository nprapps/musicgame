/*
 * QuizDetailView
 */

var QuizDetailView = Backbone.View.extend({
    el: '#admin',
    events: {
        'click #save-quiz': 'saveQuiz',
        'click #add-question': 'addQuestionModel'
    },

    $questions: null,

    quiz: null,
    questionViews: {},

    initialize: function() {
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
    },

    saveQuiz: function() {
        var properties = this.serialize();

        this.model.save(properties);

        _.each(this.questionViews, function(question) {
            question.saveQuestion();
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
            title: this.$('.title h1 span').text(),
            text: this.$('.desc h4 span').text(),
        };

        return properties;
    }
});

var QuestionView = Backbone.View.extend({
    tagName: 'div',
    className: 'question',
    events: {
        'click .add-choice': 'addChoiceModel',
        'click .rm-choice': 'rmChoiceView',
        'click .rm-question': 'close',
        'click #save-quiz': 'saveQuestion'
    },
    model: null,

    $choices: null,

    choiceViews: {},

    initialize: function() {
        _.bindAll(this);

        this.render();

        this.model.choices.each(_.bind(function(choice) {
            this.addChoiceView(choice);
        }, this));

        this.model.choices.on('add', this.addChoiceView);
    },
    render: function() {

        this.$el.html(JST.admin_question({ 'question': this.model }));

        this.$choices = this.$('.choices');

        _.each(this.choiceViews, function(view) {
            view.render();
        });

        if (this.model.choices.length == 0) {
            for (i=0; i<4; i++) {
                this.addChoiceModel();
            }
        }

    },

    addChoiceModel: function() {
        var choice = new Choice();
        choice.question = this.model;

        this.model.choices.add(new Choice());
    },

    addChoiceView: function(choice) {
        var choiceView = new ChoiceView({ model: choice });
        choiceView.render();

        this.$choices.append(choiceView.el);
        this.choiceViews[choice.cid] = choiceView;
    },

    rmChoiceView: function() {
        if (this.model.choices.length > 1) {
            var model = this.model.choices.last();
            this.choiceViews[model.cid].close();
            delete this.choiceViews[choice.cid];
        }
    },

    saveQuestion: function() {
        var properties = this.serialize();

        this.model.save(properties);

        _.each(this.choiceViews, function(choiceView) {
            choiceView.saveChoice();
        });
    },

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    },

    serialize: function() {
        var properties = {
            text: this.$('.interrogative').text()
        }

        return properties;
    }
});

/*
 * ChoiceView
 */
var ChoiceView = Backbone.View.extend({
    tagName: 'div',

    className: 'choice',

    model: null,

    initialize: function() {
        _.bindAll(this);

        this.render();
    },

    render: function() {
        this.$el.html(JST.admin_choice({ 'choice': this.model }));

    },

    saveChoice: function() {
        var properties = this.serialize();

        this.model.save(properties);
    },

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    },

    serialize: function() {
        var properties = {
            'text': this.$('.answer').val(),
            'correct_answer': false
        }
        if (this.$('.correct').is(':checked')) {
            properties['correct_answer'] = true;
        }

        return properties;
    }
});