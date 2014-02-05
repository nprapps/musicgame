// Constants
var TIMERLENGTH = 15; // Seconds allowed to answer per question
var INTERVAL = (TIMERLENGTH / 360) * 1000; // Timout interval

// DOM Refs
var $content = null;
var $quiz = null;
var $answers = null;
var $answersContainer = null;
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
var $score = null;

// Game state
var currentQuestion = 0;
var angle = 0;
var stopTimer = false;
var totalScore = 0;
var granularPoints = [];
var answers = [];
var incorrectAnswers = null;

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
    var context = QUIZ.questions[question];
    context.quizLength = QUIZ.questions.length;
    context.questionNumber = question + 1;
    var html = JST.question(context);
    var progress = context.questionNumber / context.quizLength * 100;
    incorrectAnswers = _(QUIZ.questions[currentQuestion].choices)
        .without(QUIZ.questions[currentQuestion].answer);


    angle = 0;
    stopTimer = false;

    $quiz.html(html);
    $content.removeClass().addClass(QUIZ.quiz_type);

    $answers = $content.find('.answers li');
    $answersContainer = $content.find('.answers');
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
    $score.removeClass('fade-in').css('top', $answersContainer.offset().top);
    $progressBar.css('width', progress + '%');

    // Set up the STORY NARRATION player.
    if (QUIZ.quiz_type === 'audio'){
        $questionPlayer.jPlayer({
            ready: function () {
                $(this).jPlayer('setMedia', {
                    mp3: QUIZ.questions[currentQuestion].audio,
                    oga: 'http://s.npr.org/news/specials/2014/wolves/wolf-ambient-draft.ogg'
                }).jPlayer('play');
                runTimer();
            },
            ended: function() {
                onQuestionStopButtonClick();
            },
            swfPath: 'js/lib',
            supplied: 'mp3, oga',
            loop: false
        });

        $content.find('.jp-play').hide();
        $content.find('.jp-stop').show();
    } else { // Start the timer immediately if no audio.
        runTimer();
    }



    sendHeightToParent();
};

/*
 * Render the game over screen.
 */
var renderGameOver = function() {
    var context = {
        'score': totalScore,
        'answers': answers,
        'questions': QUIZ.questions,
        'points': granularPoints
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
var onQuestionComplete = function(points){
    granularPoints.push(points);

    $score.text('+' + points).addClass('fade-in');

    $answers.each(function(){
        $this = $(this).find('a .answer');

        if ($this.text() === QUIZ.questions[currentQuestion].answer){
            $this.parent().parent().addClass('correct');
        }
    });

    $content.find('.answers li:not(.correct, .incorrect)').addClass('fade').off("click");

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
    var points = 0;
    var answer = QUIZ.questions[currentQuestion].answer;
    $this = $(this).find('a .answer');

    // Stop the timer
    stopTimer = true;
    $timerContainer.attr('class', 'timer-container fade');

    // Push the selected answer to our answer array
    answers.push($this.text());

    if ($this.text() === answer){
        $this.parent().parent().addClass('correct');
        points = Math.round(100 / QUIZ.questions.length * ((360 - angle) / 360));
        totalScore += points;
    } else {
        $this.parent().parent().addClass('incorrect');
    }

    onQuestionComplete(points);
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

var trimAnswers = function(){
    var wrongAnswer = incorrectAnswers.pop();

    $answers.each(function(){
        $this = $(this).find('a .answer');

        if ($this.text() === wrongAnswer && !$this.parent().parent().hasClass('fade')){
            $this.parent().parent().addClass('fade').off("click");
        }
    });
}

/*
* Animate our question timer
*/
var runTimer = function() {
    var answerAngle = 360 / QUIZ.questions[currentQuestion].choices.length;
    var angleInterval = (360 - answerAngle) / (QUIZ.questions[currentQuestion].choices.length - 2);

    if (stopTimer === true){
        return;
    }

    if (angle < 359){
        drawTimer();

        if (angle > answerAngle && angle % angleInterval === 0){
            trimAnswers();
        }

        var timer = setTimeout(runTimer, INTERVAL);
        angle++;
    } else {
        angle = 360 * .9999;
        drawTimer();
        onQuestionComplete(0);
    };
};

/*
* Go to the next question
*/
var onNextQuestionClick = function(event) {
    event.stopImmediatePropagation();
    currentQuestion++;
    renderQuestion(currentQuestion);
}

/*
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');
    $quiz = $('#quiz');
    $progressBar = $('.progress .bar');
    $score = $('#score');

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

