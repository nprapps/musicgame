// Constants
var TIMERLENGTH = 15; // Seconds allowed to answer per question
var INTERVAL = 50; // Timout interval in milliseconds

// DOM Refs
var $content = null;
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
var $responses = null;
var timer = false;

// Game state
var quizData = null;
var currentQuestion = 0;
var timeLeft = TIMERLENGTH * 1000;
var stopTimer = false;
var totalScore = 0;
var granularPoints = [];
var answers = [];
var correctAnswers = [];
var currentAnswer = null;
var incorrectAnswers = null;

/*
 * Render the start screen.
 */
var renderStart = function() {
    var html = JST.start(quizData);

    $content.html(html);

    $content.addClass('start').css('height', $(document).height());

    $startQuizButton = $content.find('#start-quiz');
    $startQuizButton.on('click', function(e){
        renderQuestion();
        $content.removeClass('start');
        return false;
    });

    sendHeightToParent();
};

/*
 * Render the question screen.
 */
var renderQuestion = function() {
    var question = quizData['questions'][currentQuestion];
    currentAnswer = _.where(question['choices'], {correct_answer: true})[0]['text'];


    var context = question;
    context['quizLength'] = quizData['questions'].length;
    context['questionNumber'] = currentQuestion + 1;

    var html = JST.question(context);

    incorrectAnswers = _.filter(question['choices'], function(choice){
        return !choice['correct_answer'];
    });

    timeLeft = TIMERLENGTH * 1000;
    stopTimer = false;

    $content.html(html);
    $content.removeClass();

    if (question['audio']) {
        $content.addClass('audio');
    }

    $answers = $content.find('.answers li');
    $answersContainer = $content.find('.answers');
    $progressBar = $content.find('.progress .bar');
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

    if (question['audio']){
        $questionPlayer.jPlayer({
            ready: function () {
                $(this).jPlayer('setMedia', {
                    mp3: question['audio']['file_path'],
                    // TODO
                    //oga: 'http://s.npr.org/news/specials/2014/wolves/wolf-ambient-draft.ogg'
                }).jPlayer('play');
            },
            play: function() {
                if (timer === 'true'){
                    runTimer();
                }
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
        if (timer === 'true'){
            runTimer();
        }
    }

    $content.css('height', $(document).height());
    sendHeightToParent();
};

/*
 * Render the game over screen.
 */
var renderGameOver = function() {
    var $showResults = null;
    var context = {
        'quizData': quizData,
        'score': totalScore,
        'selected_answers': answers,
        'points': granularPoints,
        'correct_answers': correctAnswers
    };

    var html = JST.gameover(context);

    $content.html(html);
    $content.addClass('end').css('height', $(document).height());
    $showResults = $content.find('#show-results');
    $responses = $content.find('.responses');
    var $players = $content.find('.jp-player')
    var $playButtons = $content.find('.jp-play');
    var $stopButtons = $content.find('.jp-stop');

    // Set up question audio players
    $players.jPlayer({
        ready: function () {
            $(this).jPlayer('setMedia', {
                mp3: $(this).data('audio'),
                oga: 'http://s.npr.org/news/specials/2014/wolves/wolf-ambient-draft.ogg'
            });
        },
        ended: function() {
            onQuestionStopButtonClick();
        },
        swfPath: 'js/lib',
        supplied: 'mp3, oga',
        loop: false
    });

    $playButtons.each(function(){
        $(this).on('click', function(){
            console.log($(this).closest('.jp-audio').prev());
            $players.jPlayer('stop');
            $stopButtons.hide();
            $playButtons.show();
            $(this).closest('.jp-audio').prev().jPlayer('play');
            $(this).hide().next().show();
        });

    });

    $stopButtons.each(function(){
        $(this).on('click', function(){
            $(this).closest('.jp-audio').prev().jPlayer('stop');
            $(this).hide().prev().show();
        });

    });

    $showResults.on('click', onShowResultsClick);

    sendHeightToParent();
};

/*
* Click handler for the question player "play" button.
*/
var onQuestionPlayButtonClick = function(e){
    $questionPlayer.jPlayer('play', 0);
    $content.find('.jp-play').hide();
    $content.find('.jp-stop').show();
};

/*
* Click handler for the question player "stop" button.
*/
var onQuestionStopButtonClick = function(e){
    $questionPlayer.jPlayer('stop');
    $content.find('.jp-stop').hide();
    $content.find('.jp-play').show();
};

/*
* Answer clicked or timer ran out
*/
var onQuestionComplete = function(points, selectedAnswer, element){
    var $correctAnswer = $answers.filter(function(){
        return $(this).find('a .answer').text() === currentAnswer;
    });
    var element = element||$correctAnswer;
    var scoreOffsetY = $(element).offset().top + $(element).outerHeight() / 2;
    var scoreOffsetX = $(element).offset().left + $(element).outerWidth() / 2;

    // Push answer and points for the round to our arrays
    correctAnswers.push(currentAnswer);
    answers.push(selectedAnswer);
    granularPoints.push(points);

    $correctAnswer.addClass('correct');
    $answers.not($correctAnswer).not($(element)).addClass('fade').off("click");
    $content.after('<div class="score-container"><div id="score"></div></div>');
    $(document).find('#score')
        .addClass(points > 0 ? '' : 'zero')
        .html('+' + points)
        .css({
            'top': scoreOffsetY,
            'left': scoreOffsetX
        })
        .addClass('fade-in')
        .bind("animationend webkitAnimationEnd oAnimationEnd MSAnimationEnd",
            function(){
                $(this).parent().remove();
        });

    if (currentQuestion + 1 < quizData['questions'].length){
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
    $this = $(this).find('a .answer');

    // Stop the timer
    stopTimer = true;
    $timerContainer.attr('class', 'timer-container fade');

    if ($this.text() === currentAnswer){
        $this.parent().parent().addClass('correct');
        if(timer !== 'false'){
            points = 100 / quizData['questions'].length * (timeLeft / (TIMERLENGTH * 1000));
        } else {
            points = 100 / quizData['questions'].length;
        }

        points = Math.round(points);

        totalScore += points;
    } else {
        $this.parent().parent().addClass('incorrect');
    }

    onQuestionComplete(points, $this.text(), this);
    return false;
};

var trimAnswers = function(){
    incorrectAnswers = _.shuffle(incorrectAnswers);
    var wrongAnswer = incorrectAnswers.pop();
    wrongAnswer = wrongAnswer.text||wrongAnswer;

    $answers.each(function(){
        var $this = $(this).find('a .answer');

        if ($this.text() === wrongAnswer && !$this.parent().parent().hasClass('fade')){
            $this.parent().parent().addClass('fade').off("click");
        }
    });
}

/*
* Animate our question timer
*/
var runTimer = function() {
    var trimInterval = TIMERLENGTH * 1000 / (quizData['questions'][currentQuestion]['choices'].length - 1);

    if (stopTimer === true){
        return;
    }

    if (timeLeft > 0){

        $progressBar.css('width', (TIMERLENGTH - timeLeft / 1000)/TIMERLENGTH * 100 + '%');

        if (timeLeft <= (TIMERLENGTH * 1000 - trimInterval) && timeLeft % trimInterval === 0){
            trimAnswers();
        }

        if (timeLeft / 1000 / TIMERLENGTH > (2/3)){
            $progressBar.removeClass('warning danger').addClass('safe');
        } else if (timeLeft / 1000 / TIMERLENGTH > (1/3)){
            $progressBar.removeClass('safe danger').addClass('warning');
        } else {
            $progressBar.removeClass('safe warning').addClass('danger');
        }

        var timer = setTimeout(runTimer, INTERVAL);
        timeLeft -= INTERVAL;
    } else {
        $progressBar.css('width', '100%');
        onQuestionComplete(0, '');
    };
};

/*
* Go to the next question
*/
var onNextQuestionClick = function() {
    currentQuestion++;
    renderQuestion();
    return false;
}

/*
* Go to the next question
*/
var onShowResultsClick = function() {
    $responses.removeClass('hide');
    return false;
}

/*
 * Scroll to a given element.
 */
var scrollTo = function($el) {
    var top = $el.offset().top;
    $('html,body').animate({
        scrollTop: top
    }, 1000);
};

/*
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');

    var slug = getParameterByName('quiz');

    if (getParameterByName('timer') !== ""){
        timer = getParameterByName('timer');
    }

    if (slug !== null) {
        var url = APP_CONFIG['S3_BASE_URL'] + '/live-data/game/' + slug + '.json';

        // Local testing
        if (!APP_CONFIG.DEPLOYMENT_TARGET) {
            url = APP_CONFIG['SERVER_BASE_URL'] + '/quiz/' + slug + '/';
        }

        $.ajax({
            url: url,
            dataType: 'json',
            async: false,
            crossDomain: false,
            jsonp: false,
            success: function(data){
                quizData = data;
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

