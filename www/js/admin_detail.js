var quiz = null;
var quizzes = null;
var quizDetailView = null;

var onDocumentReady = function() {
    quizzes = new Quizzes();
    quiz = new Quiz(window.QUIZ_DATA, { 'parse': true });
    quizzes.add(quiz);
    quizDetailView = new QuizDetailView({ model: quiz });
};

$(document).ready(onDocumentReady);
