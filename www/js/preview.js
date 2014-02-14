var $preview;
var $embed;

var renderEmbedCode = function(slug) {
    var urlRoot = APP_CONFIG['SERVER_BASE_URL'];

    if (APP_CONFIG['DEPLOYMENT_TARGET']) {
        urlRoot = APP_CONFIG['S3_BASE_URL']
    }

    $embed.text(JST.embed({
        'urlRoot': urlRoot,
        'slug': slug
    }));
}

var onDocumentReady = function() {
    $preview = $('#preview');
    $embed = $('#embed');

    var slug = getParameterByName('quiz');

    if (!slug) {
        alert('Quiz slug not specified!');
        return;
    }

    renderEmbedCode(slug);

    $('#preview').responsiveIframe({
        src: 'game.html?quiz=' + slug
    });
}

$(document).ready(onDocumentReady);

