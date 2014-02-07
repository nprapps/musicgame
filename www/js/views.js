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
        // TODO
    },

    addQuestionModel: function() {
        this.model.questions.add(new Question());
    },

    addQuestionView: function(question) {
        var questionView = new QuestionView({ model: question });

        this.$questions.append(questionView.el);
        this.questionViews[question.cid] = questionView;
    },

    rmQuestionView: function(question) {
        delete this.questionViews[question.cid];
    }
});

var QuestionView = Backbone.View.extend({
    tagName: 'div',
    className: 'question',
    events: {
        'click .add-choice': 'addChoiceModel',
        'click .rm-choice': 'rmChoiceView',
        'click .rm-question': 'close'
    },
    model: null,

    $choices: null,

    choiceViews: {},

    initialize: function() {
        _.bindAll(this);

        this.render();

        this.model.choices.each(_.bind(function(choice) {
            console.log(choice);
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

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
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

    close: function() {
        this.model.destroy();
        this.remove();
        this.unbind();
    }
});