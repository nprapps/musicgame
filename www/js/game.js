var $content = null;
var $answers = null;
var $questionPlayer = null;
var $questionPlayButton = null;
var $questionStopButton = null;
var $timerBg = null;
var $timer = null;
var angle = 0;
var pi = Math.PI;
var interval = 30;

/*
 * Render the start screen.
 */
var renderStart = function() {
    var context = {};
    var html = JST.start(context);

    $content.html(html);
};

/*
 * Render the question screen.
 */
var renderQuestion = function() {
    var context = {};
    var html = JST.question(context);

    $content.html(html);
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
* You ran out of time
*/
var onTimerComplete = _.once(function(){
    $content.find('.answers li:not(.correct)').addClass('fade');
});

/*
* Draw the timer
*/
var drawTimer = function(){
    var r = ( angle * pi / 180 );
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
    onTimerComplete();
  };
};

/*
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');
    renderQuestion();

    $answers = $content.find('.answers li');
    $questionPlayer = $content.find('#player');
    $questionPlayButton = $content.find('.jp-play');
    $questionStopButton = $content.find('.jp-stop');
    $timerBg = $content.find('#timer-bg');
    $timer = $content.find('#timer');

    $questionPlayButton.on('click', onQuestionPlayButtonClick);
    $questionStopButton.on('click', onQuestionStopButtonClick);

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

