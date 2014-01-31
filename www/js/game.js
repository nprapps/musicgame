var $content = null;
var $quiz = null;
var $answers = null;
var $questionPlayer = null;
var $questionPlayButton = null;
var $questionStopButton = null;
var $timerContainer = null;
var $timerBg = null;
var $timer = null;
var $nextQuestionButton = null;
var $showScoreButton = null;
var $startQuizButton = null;
var $progressBar = null;
var angle = 0;
var interval = 30;
var currentQuestion = 0;
var stopTimer = false;
var score = 0;

/*
 * Render the start screen.
 */
var renderStart = function() {
    var context = {};
    var html = JST.start(context);

    $quiz.html(html);

    $content.addClass('start').css('height', $(window).height());

    $startQuizButton = $content.find('#start-quiz');
    $startQuizButton.on('click', function(){
        renderQuestion(currentQuestion);
        $content.removeClass('start');
    });
    
    sendHeightToParent();
};

/*
 * Render the question screen.
 */
var renderQuestion = function(question) {
    $content.removeClass().addClass(QUIZ.quiz_type);
    var context = QUIZ.questions[question];
    context.quizLength = QUIZ.questions.length;
    context.questionNumber = question + 1;
    var html = JST.question(context);
    var progress = context.questionNumber / context.quizLength * 100;
    angle = 0;
    stopTimer = false;

    $quiz.html(html);

    $answers = $content.find('.answers li');
    $questionPlayer = $content.find('#player');
    $questionPlayButton = $content.find('.jp-play');
    $questionStopButton = $content.find('.jp-stop');
    $timerContainer = $content.find('.timer-container');
    $timerBg = $content.find('#timer-bg');
    $timer = $content.find('#timer');
    $nextQuestionButton = $content.find('#next-question');
    $showScoreButton = $content.find('#show-score');


    $questionPlayButton.on('click', onQuestionPlayButtonClick);
    $questionStopButton.on('click', onQuestionStopButtonClick);
    $answers.on('click', onAnswerClick);
    $nextQuestionButton.on('click', onNextQuestionClick);
    $showScoreButton.on('click', renderGameOver);

    $nextQuestionButton.removeClass('show');
    $progressBar.css('width', progress + '%');

    // Set up the STORY NARRATION player.
    if (QUIZ.quiz_type === 'audio'){
        $questionPlayer.jPlayer({
            ready: function () {
                $(this).jPlayer('setMedia', {
                    mp3: QUIZ.questions[currentQuestion].audio,
                    oga: 'http://s.npr.org/news/specials/2014/wolves/wolf-ambient-draft.ogg'
                }).jPlayer('stop');
            },
            ended: function() {
                onQuestionStopButtonClick();
            },
            swfPath: 'js/lib',
            supplied: 'mp3, oga',
            loop: false
        });
    }

    if (QUIZ.quiz_type === 'text'){
        runTimer();
    }

    sendHeightToParent();
};

/*
 * Render the game over screen.
 */
var renderGameOver = function() {
    var context = {
        'score': score + '%'
    };

    var html = JST.gameover(context);

    $quiz.html(html);
    $content.addClass('end').css('height', $(window).height());;

    sendHeightToParent();
};

/*
* Click handler for the question player "play" button.
*/
var onQuestionPlayButtonClick = function(){
    $questionPlayer.jPlayer('play', 0);
    $content.find('.jp-play').hide();
    $content.find('.jp-stop').show();
    runTimer();
};

/*
* Click handler for the question player "stop" button.
*/
var onQuestionStopButtonClick = function(){
    $questionPlayer.jPlayer('stop');
    $content.find('.jp-stop').hide();
    $content.find('.jp-play').show();
};

/*
* Answer clicked or timer ran out
*/
var onQuestionComplete = function(){
    $answers.each(function(){
        $this = $(this).find('a .answer');

        if ($this.text() === QUIZ.questions[currentQuestion].answer){
            $this.parent().parent().addClass('correct');
        }
    });
    $content.find('.answers li:not(.correct, .incorrect)').addClass('fade');

    if (currentQuestion + 1 < QUIZ.questions.length){
        $nextQuestionButton.addClass('show');
    } else {
        $showScoreButton.addClass('show');
    }

    sendHeightToParent();
};

/*
* You ran out of time
*/
var onAnswerClick = function(){
    var answer = QUIZ.questions[currentQuestion].answer;
    $this = $(this).find('a .answer');

    // Stop the timer
    stopTimer = true;
    $timerContainer.attr('class', 'timer-container fade');

    if ($this.text() === answer){
        $this.parent().parent().addClass('correct');

        // TODO: more elegant scoring
        score += Math.round(100 / QUIZ.questions.length);
    } else {
        $this.parent().parent().addClass('incorrect');
    }

    onQuestionComplete();
};

/*
* Draw the timer
*/
var drawTimer = function(){
    var r = ( angle * Math.PI / 180 );
    var x = Math.sin( r ) * 25;
    var y = Math.cos( r ) * - 25;
    var mid = ( angle > 180 ) ? 1 : 0;
    var anim = 'M 0 0 v -25 A 25 25 1 '
             + mid + ' 1 '
             +  x  + ' '
             +  y  + ' z';

    $timer.attr( 'd', anim );
}

/*
* Animate our question timer
*/
var runTimer = function() {
    if (stopTimer === true){
        return;
    }

    if (angle < 359){
        drawTimer();
        var timer = setTimeout(runTimer, interval);
        angle++;
    } else {
        angle = 360 * .9999;
        drawTimer();
        onQuestionComplete();
    };
};

/*
* Go to the next question
*/
var onNextQuestionClick = function(event) {
    event.stopImmediatePropagation();
    currentQuestion++;
    console.log(currentQuestion);
    renderQuestion(currentQuestion);
}

/*
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');
    $quiz = $('#quiz');
    $progressBar = $('.progress .bar');

    var slug = getParameterByName('quiz');

    if (slug !== null) {
        $.ajax({
            url: '/musicgame/assets/data/' + slug + '.json',
            dataType: 'json',
            async: false,
            crossDomain: false,
            jsonp: false,
            success: function(data){
                window.QUIZ = data;
                renderStart();
            },
            error: function(error){
                alert('No quiz data');
            }
        })
    }
};

/*
 * On window fully loaded.
 */
var onWindowLoad = function() {
    setupResponsiveChild();
};

$(document).ready(onDocumentReady);
$(window).load(onWindowLoad);

