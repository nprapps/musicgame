var $content = null;
var $questionPlayer = null;
var $questionPlayButton = null;
var $questionStopButton = null;

/*
 * Render the start screen.
 */
var renderStart = function() {
    var context = {};
    var html = JST.start(context);

    $content.html(html);
}

/*
 * Render the question screen.
 */
var renderQuestion = function() {
    var context = {};
    var html = JST.question(context);

    $content.html(html);
}

/*
 * Render the game over screen.
 */
var renderGameOver = function() {
    var context = {};
    var html = JST.gameover(context);

    $content.html(html);
}

/*
* Click handler for the question player "play" button.
*/
var onQuestionPlayButtonClick = function(){
    // _gaq.push(['_trackEvent', 'Audio', 'Played audio story', APP_CONFIG.PROJECT_NAME, 1]);
    $questionPlayer.jPlayer('play', 0);
    $content.find('.jp-play').hide();
    $content.find('.jp-stop').show();
};

/*
* Click handler for the question player "stop" button.
*/
var onQuestionStopButtonClick = function(){
    // _gaq.push(['_trackEvent', 'Audio', 'Played audio story', APP_CONFIG.PROJECT_NAME, 1]);
    $questionPlayer.jPlayer('stop');
    $content.find('.jp-stop').hide();
    $content.find('.jp-play').show();
};

/*
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');
    renderQuestion();

    $questionPlayer = $content.find('#player');
    $questionPlayButton = $content.find('.jp-play');
    $questionStopButton = $content.find('.jp-stop');



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
}

/*
 * On window fully loaded.
 */
var onWindowLoad = function() {
    setupResponsiveChild();
}

$(document).ready(onDocumentReady);
$(window).load(onWindowLoad);

