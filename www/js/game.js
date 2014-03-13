// Constants
var TIMERLENGTH = 15; // Seconds allowed to answer per question
var INTERVAL = 50; // Timout interval in milliseconds
var PIXEL_RATIO = window.devicePixelRatio;
var _gaq = window._gaq||[];

// DOM Refs
var $content = null;
var $answers = null;
var $answersContainer = null;
var $nextQuestionButton = null;
var $showScoreButton = null;
var $startQuizButton = null;
var $progressBar = null;
var $currentQuestion = null;
var $previousQuestion = null;
var $questionPlayer = null;

// Game state
var quizData = null;
var useTimer = false;
var timeLeft = TIMERLENGTH * 1000;
var stopTimer = false;
var currentQuestion = 0;
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

    timeLeft = TIMERLENGTH * 1000;
    stopTimer = false;
    currentAnswer = _.where(question['choices'], { correct_answer: true })[0]['id'];

    incorrectAnswers = _.chain(question['choices'])
        .filter(function(choice){
            return !choice['correct_answer'];
        })
        .pluck('id')
        .value();

    var context = question;
    context['quizLength'] = quizData['questions'].length;
    context['questionNumber'] = currentQuestion + 1;
    
    var html = JST.question(context);

    // Render template
    $content.append(html);
    $content.removeClass().addClass('question');

    if (question['audio']) {
        $content.addClass('audio');
    }

    resizeWindow();

    // DOM refs
    $currentQuestion = $content.find('.question-' + (currentQuestion + 1));
    $previousQuestion = $content.find('.question-' + currentQuestion);
    $answers = $currentQuestion.find('.answers li');
    $answersContainer = $currentQuestion.find('.answers');
    $progressBar = $currentQuestion.find('.progress .bar');
    $nextQuestionButton = $currentQuestion.find('.next-question');
    $showScoreButton = $currentQuestion.find('.show-score');
    var $aftertext_links = $currentQuestion.find('.after-text a');

    // Event bindings
    $answers.on('click', onAnswerClick);
    $nextQuestionButton.on('click', onNextQuestionClick);
    $showScoreButton.on('click', renderGameOver);
    $(window).on("resize.movePhotoCredits", _.throttle(movePhotoCredits, 100));
    $aftertext_links.on('click', function(){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Quizmaster Link (Question)', quizData['slug']]);
    });

    // Initialize timer and audio player
    if (question['audio']) {
        updateQuestionPlayer(question);
    } else if (useTimer) { // Start the timer immediately if no audio.
        runTimer();
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

    var context = {
        'quizData': quizData,
        'score': totalScore,
        'selected_answers': answers,
        'points': granularPoints,
        'correct_answers': correctAnswers
    };

    var html = JST.gameover(context);

    // Remove the question player
    $questionPlayer.remove();

    // Render template
    $content.append(html);
    $content.removeClass().addClass('end');

    // DOM refs
    var $nextup = $content.find('.next-up a');
    var $aftertext_links = $content.find('.after-text a');

    // Event tracking
    $aftertext_links.on('click', function(){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Quizmaster Link (Game Over)', quizData['slug']]);
    });

    $nextup.on('click', function(){
        _gaq.push(['_trackEvent', APP_CONFIG.PROJECT_NAME, 'Continous Play', quizData['slug']]);
    });

    resizeWindow();

    // Mobile Safari screws up building the players unless we wait until the call stack is empty.
    _.defer(setupGameOverPlayers);

    // Animate in
    $content.find('.question-wrapper').removeClass('in').addClass('out');
    $content.find('.container').addClass('in');

    _.delay(function(){
        // Abort after-text and credit animations before removing the div
        $content.find('.question-wrapper').find('.credit, .after-text').stop(true, false);

        $content.find('.question-wrapper').remove();
    }, 500);
};

/*
* Answer clicked or timer ran out
*/
var onQuestionComplete = function(points, selectedAnswer, element){
    var $correctAnswer = $answers.filter(function() {
        return $(this).data('choice-id') === currentAnswer;
    });
    var $element = selectedAnswer === '' ? $correctAnswer: $(element);

    // Push answer and points for the round to arrays
    correctAnswers.push(currentAnswer);
    answers.push(selectedAnswer);
    granularPoints.push(points);

    // Highlight the correct answer and fade the others
    $correctAnswer.addClass('correct');
    $answers.not($correctAnswer).not($element).addClass('fade').off('click');

    // Show the points awarded for the round
    displayScore(points, $element);

    // Show after text and photo credits if no css animation
    if (!Modernizr.cssanimations){
        showPhotoCredits($element);
        showAfterText($element);
    }

    // If there are more questions, show the link, otherwise show link to the 'game over' view
    if (currentQuestion + 1 < quizData['questions'].length){
        $nextQuestionButton.addClass('show');
    } else {
        $showScoreButton.addClass('show');
    }
};

/*
* Shuffle photo credits around based on our layout
*/
var movePhotoCredits = function(){
    var currentChoices = quizData['questions'][currentQuestion]['choices'];
    var photoAnswers = _.where(currentChoices, { text: '' }).length === currentChoices.length;

    if (photoAnswers || $(window).outerWidth() <= 480){
        $answers.each(function(){
            var credit = $(this).find('.credit').remove();
            $(this).append(credit);
        });
    } else {
        $answers.each(function(){
            var credit = $(this).find('.credit').remove();
            $(this).find('.answer').before(credit);
        });
    }
}

/*
* Animate in photo credits
*/
var showPhotoCredits = function($el){
    // Show photo credits
    movePhotoCredits();

    $el.parents('.question-wrapper').find('.credit').slideDown({
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
};

/*
* Animate in after text
*/
var showAfterText = function($el){
    $el.parents('.question-wrapper').find('.after-text').slideDown({
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
* Animate in score bubble
*/
var displayScore = function(points, $el) {
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

                if (Modernizr.cssanimations){
                    showPhotoCredits($el);
                    showAfterText($el);
                }
        });
}

/*
* Handle choice clicks
*/
var onAnswerClick = function(){
    var points = 0;
    $this = $(this);

    // Stop the timer
    stopTimer = true;

    if ($this.data('choice-id') == currentAnswer) {
        $this.addClass('correct');

        // If the timer is running, 100 possible points are divided evenly among the quiz questions.
        // Points awarded for a correct answer will be reduced based on the time elapsed.
        // Otherwise, each question is worth one point.
        if (useTimer) {
            points = 100 / quizData['questions'].length * (timeLeft / (TIMERLENGTH * 1000));
        } else {
            points = 1;
        }

        points = Math.round(points);
        totalScore += points;
    } else {
        $this.addClass('incorrect');
    }

    $answers.off('click');

    onQuestionComplete(points, $this.data('choice-id'), this);

    return false;
};

/*
* Randomly select an choice to remove as time elapses
*/
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
* Animate question timer
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

        setTimeout(runTimer, INTERVAL);
        timeLeft -= INTERVAL;
    } else {
        $progressBar.css('width', '100%');
        onQuestionComplete(0, '');
    };
};

/*
* Setup question audio player
*/
var setupQuestionPlayer = function(){
    $questionPlayer.jPlayer({
        loadstart: function () {
            $($(this).jPlayer('option', 'cssSelectorAncestor')).find('.jp-pause i')
                .removeClass('fa-pause')
                .addClass('fa-spinner fa-spin');
        },
        canplay: function(){
            $($(this).jPlayer('option', 'cssSelectorAncestor')).find('.jp-pause i')
                .removeClass('fa-spinner fa-spin')
                .addClass('fa-pause');
        },
        play: function() {
            if (useTimer){
                runTimer();
            }
        },
        swfPath: 'js/lib',
        supplied: 'mp3, oga',
        loop: false
    });
}

var updateQuestionPlayer = function(question) {
    var selector = '.question-' + (currentQuestion + 1);

    $questionPlayer
        .jPlayer('option', 'cssSelectorAncestor', selector + ' .jp-audio')
        .jPlayer('setMedia', {
            mp3: question['audio']['rendered_mp3_path'],
            oga: question['audio']['rendered_oga_path']
        })
        .jPlayer('play');
}

/*
* Setup audio players
*/
var setupGameOverPlayers = function(){
    var $players = $content.find('.jp-player');

    // Initialize the players
    _.each(quizData['questions'], function(element, index){
        var $player = $content.find('#jp_player_' + (index + 1));

        var setMedia = function(){
            $player.jPlayer('setMedia', {
                mp3: $player.data('mp3'),
                oga: $player.data('ogg')
            });
        }

        $player.jPlayer({
            ready: function () {
                _.defer(setMedia);
            },
            loadstart: function(){
                $(this).next('.jp-audio').find('.jp-pause i')
                    .removeClass('fa-pause')
                    .addClass('fa-spinner fa-spin');
            },
            canplay: function(){
                $(this).next('.jp-audio').find('.jp-pause i')
                    .removeClass('fa-spinner fa-spin')
                    .addClass('fa-pause');
            },
            play: function() {
                $(this).jPlayer('pauseOthers');
            },
            cssSelectorAncestor: '#jp_container_' + (index + 1),
            swfPath: 'js/lib',
            supplied: 'mp3, oga',
            loop: false
        });
    });
}

/*
 * Intelligently load images
 */
var loadImages = function() {
    var $images = $('.img-responsive');

    // Check the dimension the image will occupy and swap in the source URL for the smallest
    // possible image to fill that space, accounting for high-density displays.
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

    if(images.length > 0) {
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
    $questionPlayer = $('#question-player');

    var slug = getParameterByName('quiz');

    timer = (getParameterByName('timer') == 'true');
    
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
                setupQuestionPlayer();
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
$(window).on('resize.sizeIframe', _.throttle(resizeWindow, 100));

