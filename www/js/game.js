var $content = null;
var $questionPlayer = null;
var $questionPlayerButton = null;

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
var onQuestionPlayerButtonClick = function(){
    // _gaq.push(['_trackEvent', 'Audio', 'Played audio story', APP_CONFIG.PROJECT_NAME, 1]);
    $questionPlayer.jPlayer('play');
};

/*
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');
    renderQuestion();

    $questionPlayer = $content.find('#player');
    $questionPlayerButton = $content.find('.play');


    $questionPlayerButton.on('click', onQuestionPlayerButtonClick);

    // Set up the STORY NARRATION player.
    $questionPlayer.jPlayer({
        ready: function () {
            $(this).jPlayer('setMedia', {
                mp3: 'http://pd.npr.org/anon.npr-mp3/npr/asc/2011/07/20110726_asc_hh.mp3',
                oga: 'http://s.npr.org/news/specials/2014/wolves/wolf-ambient-draft.ogg'
            }).jPlayer('pause');
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

