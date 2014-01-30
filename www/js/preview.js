var $preview;
var $production;
var $localhost;

var renderEmbedCode = function(slug) {
    $production.text(JST.embed({
        'urlRoot': 'http://' + APP_CONFIG.PRODUCTION_S3_BUCKETS[0] + '/' + APP_CONFIG.PROJECT_SLUG,
        'slug': slug
    }));

    $localhost.text(JST.embed({
        'urlRoot': 'http://localhost:8000/' + APP_CONFIG.PROJECT_SLUG,
        'slug': slug
    }));
}

var onDocumentReady = function() {
    $preview = $('#preview');
    $production = $('#production');
    $localhost = $('#localhost');

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

