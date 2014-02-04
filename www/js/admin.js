var $questions = null;
var $choices = null;
var $lastChoice = null;
var $newQuestionButton = null;
var $addChoiceButton = null;
var $rmChoiceButton = null;

var addQuestion = function() {
    var context = {};
    var html = JST.admin_question(context);

    $questions.append(html);

    $addChoiceButton = $('.add-choice');
    $rmChoiceButton = $('.rm-choice');


    $addChoiceButton.last().on('click', addChoice);
    $rmChoiceButton.last().on('click', rmChoice);
}

var addChoice = function() {
    var context = {};
    var $el = $(this);
    var html = JST.admin_choice(context);

    $choices = $el.closest('.choices').find('.choice');
    $lastChoice = $choices.last();

    $lastChoice.after(html);
}

var rmChoice = function() {
    var $el = $(this)

    $choices = $el.closest('.choices').find('.choice');
    $lastChoice = $choices.last();

    if ($choices.length > 2) {
        $lastChoice.remove();
    }

}

var onDocumentReady = function() {
    $questions = $('.questions');
    $choices = $('.choices');
    $newQuestionButton = $('#add-question');
    $addChoiceButton = $('.add-choice');
    $rmChoiceButton = $('.rm-choice');

    $newQuestionButton.on('click', addQuestion);
    $addChoiceButton.on('click', addChoice);
    $rmChoiceButton.on('click', rmChoice);

    addQuestion();
}

$(document).ready(onDocumentReady);