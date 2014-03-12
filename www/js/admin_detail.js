var quiz = null;
var quizzes = null;
var quizDetailView = null;

var onDocumentReady = function() {

    // Does the browser support the file api? Suggest a better browser if not.
    if (!window.File && !window.FileReader && !window.FileList && !window.Blob) {
        $('body').addClass('bsod');
        $('#admin').html(JST.admin_bsod());
        return false;
    }

    quizzes = new Quizzes();
    quiz = new Quiz(window.QUIZ_DATA, { 'parse': true });
    quizzes.add(quiz);
    quizDetailView = new QuizDetailView({ model: quiz });
};

$(document).ready(onDocumentReady);