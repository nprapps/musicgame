var $preview;
var $embed;

var urlRoot = APP_CONFIG['SERVER_BASE_URL'];

if (APP_CONFIG['DEPLOYMENT_TARGET']) {
    urlRoot = APP_CONFIG['S3_BASE_URL']
}

var onDocumentReady = function() {
    $preview = $('#preview');
    $embed = $('#embed');

    var slug = getParameterByName('quiz');

    if (!slug) {
        alert('Quiz slug not specified!');
        return;
    }

    var embed = JST.embed({
        'urlRoot': urlRoot,
        'slug': slug
    });

    $embed.text(embed);

    ZeroClipboard.setDefaults({
        moviePath: urlRoot + "/js/lib/ZeroClipboard.swf"
    });

    var clipper = new ZeroClipboard($('.clipper'));

    clipper.on('complete', function() {
        alert('Embed code copied to your clipboard!');
    });

    clipper.on('dataRequested', function(client, args) {
        client.setText(embed);
    });
    
    $('#preview').responsiveIframe({
        src: urlRoot + '/game.html?quiz=' + slug
    });
}

$(document).ready(onDocumentReady);

