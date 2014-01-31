var $content = null;
var $quiz = null;
var $answers = null;
var $questionPlayer = null;
var $questionPlayButton = null;
var $questionStopButton = null;
var $timerBg = null;
var $timer = null;
var $nextQuestionButton = null;
var $showScoreButton = null;
var $startQuizButton = null;
var $progressBar = null;
var angle = 0;
var interval = 30;
var currentQuestion = 0;

/*
 * Render the start screen.
 */
var renderStart = function() {
    var context = {};
    var html = JST.start(context);

    $quiz.html(html);

    $startQuizButton = $content.find('#start-quiz');
    $startQuizButton.on('click', function(){
        renderQuestion(currentQuestion);
    });
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

    $quiz.html(html);

    $answers = $content.find('.answers li');
    $questionPlayer = $content.find('#player');
    $questionPlayButton = $content.find('.jp-play');
    $questionStopButton = $content.find('.jp-stop');
    $timerBg = $content.find('#timer-bg');
    $timer = $content.find('#timer');
    $nextQuestionButton = $content.find('#next-question');
    $showScoreButton = $content.find('#show-score');
    

    $questionPlayButton.on('click', onQuestionPlayButtonClick);
    $questionStopButton.on('click', onQuestionStopButtonClick);
    $answers.on('click', onAnswerClick);
    $nextQuestionButton.on('click', onNextQuestionClick);
    $showScoreButton.on('click', renderGameOver);

    $progressBar.css('width', progress + '%');
};

/*
 * Render the game over screen.
 */
var renderGameOver = function() {
    var context = {};
    var html = JST.gameover(context);

    $content.html(html);
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
        $this = $(this).find('a');

        if ($this.text() === QUIZ.questions[currentQuestion].answer){
            $this.parent().addClass('correct');
        }
    });
    $content.find('.answers li:not(.correct)').addClass('fade');

    if (currentQuestion + 1 < QUIZ.questions.length){
        $nextQuestionButton.addClass('show');
    } else {
        $showScoreButton.addClass('show');
    }
};

/*
* You ran out of time
*/
var onAnswerClick = function(){
    var answer = QUIZ.questions[currentQuestion].answer;
    $this = $(this).find('a');
    if ($this.text() === answer){
        // TODO: calculate score
    } else {
        // TODO: calculate score
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
  if (angle < 359){
    drawTimer();
    setTimeout(runTimer, interval);
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
    renderStart();

    var slug = getParameterByName('quiz');

    //if (!slug) {
    //    alert('No quiz slug specified!');
    //}

    // TODO: fetch JSON config for quiz slug

    // Set up the STORY NARRATION player.
    $questionPlayer.jPlayer({
        ready: function () {
            $(this).jPlayer('setMedia', {
                mp3: 'http://pd.npr.org/anon.npr-mp3/npr/asc/2011/07/20110726_asc_hh.mp3',
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
};

/*
 * On window fully loaded.
 */
var onWindowLoad = function() {
    setupResponsiveChild();
};

$(document).ready(onDocumentReady);
$(window).load(onWindowLoad);

