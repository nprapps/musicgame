var $preview;
var $embed;

var urlRoot = APP_CONFIG['SERVER_BASE_URL'];

if (APP_CONFIG['DEPLOYMENT_TARGET']) {
    urlRoot = APP_CONFIG['S3_BASE_URL']
}

var renderEmbedCode = function(slug) {
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
        src: urlRoot + '/game.html?quiz=' + slug
    });
}

$(document).ready(onDocumentReady);

