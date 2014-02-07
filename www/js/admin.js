// var $questions = null;
// var $choices = null;
// var $lastChoice = null;
// var $addQuestionButton = null;
// var $rmQuestionButton = null;
// var $addChoiceButton = null;
// var $rmChoiceButton = null;
var quiz = null;
var quizzes = null;
var quizDetailView = null;

// var addQuestion = function() {
//     var context = {};
//     var html = JST.admin_question(context);

//     $questions.append(html);
//     $rmQuestionButton = $('.rm-question');



//     $addChoiceButton = $('.add-choice');
//     $rmChoiceButton = $('.rm-choice');

//     $rmQuestionButton.last().on('click', rmQuestion);
//     $addChoiceButton.last().on('click', addChoice);
//     $rmChoiceButton.last().on('click', rmChoice);
// }

// var rmQuestion = function() {
//    var $el = $(this);
//    var parent = $el.parents('.question');

//    console.log(parent)

//    if ($questions.find('.question').length > 1) {
//         parent.remove();
//    }
// }

// var addChoice = function() {
//     var context = {};
//     var $el = $(this);
//     var html = JST.admin_choice(context);

//     $choices = $el.closest('.choices').find('.choice');
//     $lastChoice = $choices.last();

//     $lastChoice.after(html);
// }

// var rmChoice = function() {
//     var $el = $(this)

//     $choices = $el.closest('.choices').find('.choice');
//     $lastChoice = $choices.last();

//     if ($choices.length > 2) {
//         $lastChoice.remove();
//     }

// }

var onDocumentReady = function() {
    quizzes = new Quizzes();
    quiz = new Quiz(window.QUIZ_DATA);
    quizzes.add(quiz);
    quizDetailView = new QuizDetailView({ model: quiz });

    // $questions = $('.questions');
    // $choices = $('.choices');

    // $addQuestionButton = $('#add-question');
    // $addQuestionButton.on('click', addQuestion);


    // addQuestion();


}

$(document).ready(onDocumentReady);