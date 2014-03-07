// Constants
var TIMERLENGTH = 15; // Seconds allowed to answer per question
var INTERVAL = 50; // Timout interval in milliseconds
var PIXEL_RATIO = window.devicePixelRatio;
var _gaq = window._gaq||[];

// DOM Refs
var $content = null;
var $answers = null;
var $answersContainer = null;
var $questionPlayer = null;
var $questionPlayButton = null;
var $questionPauseButton = null;
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
    $content.addClass('start');

    $startQuizButton = $content.find('#start-quiz');
    $startQuizButton.on('click', function(e){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Game Started', quizData['slug']]);
        $content.empty().removeClass('start');
        renderQuestion();
        return false;
    });

    resizeWindow();
};

/*
 * Render the question screen.
 */
var renderQuestion = function() {
    var question = quizData['questions'][currentQuestion];
    currentAnswer = _.where(question['choices'], {correct_answer: true})[0]['id'];


    var context = question;
    context['quizLength'] = quizData['questions'].length;
    context['questionNumber'] = currentQuestion + 1;

    var html = JST.question(context);

    incorrectAnswers = _.chain(question['choices'])
        .filter(function(choice){
            return !choice['correct_answer'];
        })
        .pluck('id')
        .value();

    timeLeft = TIMERLENGTH * 1000;
    stopTimer = false;

    $content.append(html);
    $content.removeClass().addClass('question');
    resizeWindow();

    if (question['audio']) {
        $content.addClass('audio');
    }

    $currentQuestion = $content.find('.question-' + (currentQuestion + 1));
    $previousQuestion = $content.find('.question-' + currentQuestion);

    $answers = $currentQuestion.find('.answers li');
    $answersContainer = $currentQuestion.find('.answers');
    $progressBar = $currentQuestion.find('.progress .bar');
    $questionPlayer = $currentQuestion.find('.player');
    $questionPlayButton = $currentQuestion.find('.jp-play');
    $questionPauseButton = $currentQuestion.find('.jp-pause');
    $timerContainer = $currentQuestion.find('.timer-container');
    $timerBg = $currentQuestion.find('#timer-bg');
    $timer = $currentQuestion.find('#timer');
    $nextQuestionButton = $currentQuestion.find('.next-question');
    $showScoreButton = $currentQuestion.find('.show-score');
    var $aftertext_links = $currentQuestion.find('.after-text a');

    $questionPlayButton.on('click', onQuestionPlayButtonClick);
    $questionPauseButton.on('click', onQuestionPauseButtonClick);
    $answers.on('click', onAnswerClick);
    $nextQuestionButton.on('click', onNextQuestionClick);
    $showScoreButton.on('click', renderGameOver);
    $aftertext_links.on('click', function(){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Quizmaster Link (Question)', quizData['slug']]);
    });


    $nextQuestionButton.removeClass('show');

    if (question['audio']){

        $previousQuestion.find('.player').jPlayer('destroy');
        $questionPlayer.jPlayer({
            ready: function () {
                $(this).jPlayer('setMedia', {
                    mp3: question['audio']['rendered_mp3_path'],
                    oga: question['audio']['rendered_oga_path']
                }).jPlayer('play');
            },
            play: function() {
                if (timer === 'true'){
                    runTimer();
                }

                $questionPauseButton.show();
                $questionPlayButton.hide();
            },
            ended: function() {
                $questionPauseButton.hide();
                $questionPlayButton.show();
            },
            swfPath: 'js/lib',
            supplied: 'mp3, oga',
            loop: false
        });

    } else { // Start the timer immediately if no audio.
        if (timer === 'true'){
            runTimer();
        }
    }

    // Safari doesn't animate properly without this
    _.defer(function(){
        $previousQuestion.removeClass('in').addClass('out');
        $currentQuestion.addClass('in');
    });

    _.delay(function(){
        $previousQuestion.remove();
    }, 500);


};

/*
 * Render the game over screen.
 */
var renderGameOver = function() {
    _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Game Over', quizData['slug']]);

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
    $content.removeClass().addClass('end');
    $responses = $content.find('.responses');
    var $players = $content.find('.jp-player')
    var $playButtons = $content.find('.play');
    var $pauseButtons = $content.find('.pause');
    var $nextup = $content.find('.next-up a');
    var $aftertext_links = $content.find('.after-text a');

    $aftertext_links.on('click', function(){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Quizmaster Link (Game Over)', quizData['slug']]);
    });

    // Set up question audio players
    $players.jPlayer({
        ready: function () {
            $(this).jPlayer('setMedia', {
                mp3: $(this).data('mp3'),
                oga: $(this).data('ogg')
            });
        },
        ended: function(){
            // Reset media because of webkit audio bug
            $(this).jPlayer('setMedia', {
                mp3: $(this).data('mp3'),
                oga: $(this).data('ogg')
            });

            $pauseButtons.hide();
            $playButtons.show();
        },
        swfPath: 'js/lib',
        supplied: 'mp3, oga',
        loop: false
    });

    $playButtons.on('click', function(){
        $pauseButtons.hide();
        $playButtons.show();
        $players.jPlayer('pause');
        $(this).parents('li').find('.jp-player').jPlayer('play');
        $(this).hide().siblings('.pause').show();
    });

    $pauseButtons.on('click', function(){
        $(this).parents('li').find('.jp-player').jPlayer('pause');
        $(this).hide().siblings('.play').show();
    });

    $nextup.on('click', function(){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Continous Play', quizData['slug']]);
    });

    resizeWindow();
    $content.find('.container').addClass('in');
};

/*
* Click handler for the question player "play" button.
*/
var onQuestionPlayButtonClick = function(e){
    // $questionPlayer.jPlayer('play');
    $questionPlayButton.hide();
    $questionPauseButton.show();
};

/*
* Click handler for the question player "stop" button.
*/
var onQuestionPauseButtonClick = function(e){
    // $questionPlayer.jPlayer('pause');
    $questionPauseButton.hide();
    $questionPlayButton.show();
};

/*
* Answer clicked or timer ran out
*/
var onQuestionComplete = function(points, selectedAnswer, element){
    var $correctAnswer = $answers.filter(function(){
        return $(this).data('choice-id') === currentAnswer;
    });
    var element = $(element)||$correctAnswer;

    // Push answer and points for the round to our arrays
    correctAnswers.push(currentAnswer);
    answers.push(selectedAnswer);
    granularPoints.push(points);

    $correctAnswer.addClass('correct');
    $answers.not($correctAnswer).not($(element)).addClass('fade').off("click");

    displayScore(points, element);

    if (currentQuestion + 1 < quizData['questions'].length){
        $nextQuestionButton.addClass('show');
    } else {
        $showScoreButton.addClass('show');
    }

    resizeWindow();
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
* Animate our score bubble
*/
var displayScore = function(points, $el){
    var scoreOffsetY = $el.offset().top + $el.outerHeight() / 2;
    var scoreOffsetX = $el.offset().left + $el.outerWidth() / 2;

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
                $content.find('.after-text').slideDown({
                    duration: 'fast',
                    progress: function(){
                        $content.attr('style','').css('height', $currentQuestion.height());
                        sendHeightToParent();
                    },
                    done: function(){
                        $content.attr('style','').css('height', $currentQuestion.height());
                        sendHeightToParent();
                    }
                });
        });
}

/*
* Check if clicked answer is correct
*/
var onAnswerClick = function(){
    var points = 0;
    $this = $(this);

    // Stop the timer
    stopTimer = true;
    $timerContainer.attr('class', 'timer-container fade');

    if ($this.data('choice-id') == currentAnswer){
        $this.addClass('correct');
        if(timer === 'true'){
            points = 100 / quizData['questions'].length * (timeLeft / (TIMERLENGTH * 1000));
        } else {
            points = 1;
        }

        points = Math.round(points);

        totalScore += points;
    } else {
        $this.addClass('incorrect');
    }

    $answers.off("click");

    onQuestionComplete(points, $this.data('choice-id'), this);
    return false;
};

var trimAnswers = function(){
    incorrectAnswers = _.shuffle(incorrectAnswers);
    var wrongAnswer = incorrectAnswers.pop();

    $answers.each(function(){
        var $this = $(this);

        if ($this.data('choice-id') == wrongAnswer && !$this.hasClass('fade')){
            $this.addClass('fade').off("click");
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
 * Intelligently load images
 */
var loadImages = function() {
    var $images = $('.img-responsive');

    $images.each(function(){
        var $this = $(this);
        var width = $this.width();
        var path = PIXEL_RATIO >= 2 ? 'medium' : 'small';

        if (width > 100 && width < 300){
            path = PIXEL_RATIO >= 2 ? 'large' : 'medium';
        } else if (width > 300){
            path = 'large';
        }

        $this.attr('src', $this.data(path)).addClass('fade-in');
    });
};

/*
 * Check for images in content and size window after load
 */
var resizeWindow = function(){
    var images = $content.find('img');

    if(images.length > 0){
        loadImages();
        $(images).load(function(){
            $content.attr('style','').css('height', $content.children().last().outerHeight());
            sendHeightToParent();
        });
    } else {
        $content.attr('style','').css('height', $content.children().last().outerHeight());
        sendHeightToParent();
    }
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
        var url = '/' + APP_CONFIG['PROJECT_SLUG'] + '/quiz/' + slug + '/';

        // Deployed
        if (APP_CONFIG.DEPLOYMENT_TARGET) {
            var cacheBuster = (new Date()).getTime();
            url = APP_CONFIG['S3_BASE_URL'] + '/live-data/games/' + slug + '.json?' + cacheBuster;
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
$(window).on('resize', _.throttle(resizeWindow, 100));

