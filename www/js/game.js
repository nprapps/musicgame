var $content = null;

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
 * On browser ready.
 */
var onDocumentReady = function() {
    $content = $('#content');

    renderQuestion();
}

/*
 * On window fully loaded.
 */
var onWindowLoad = function() {
    setupResponsiveChild();
}

$(document).ready(onDocumentReady);
$(window).load(onWindowLoad);

