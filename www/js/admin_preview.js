var $preview;
var $embed;
var $seamusUrl;
var $publishNow;

var slug;
var urlRoot = '/' + APP_CONFIG['PROJECT_SLUG'];

if (APP_CONFIG['DEPLOYMENT_TARGET']) {
    urlRoot = APP_CONFIG['S3_BASE_URL']
}

var onClickPublishNow = function() {
    $.ajax({
        'url': '/' + APP_CONFIG['PROJECT_SLUG'] + '/admin/update-seamus-url/' + slug + '/',
        'method': 'POST',
        'data': { 'seamus_url': $seamusUrl.val() },
        'success': function() {
            console.log('Seamus URL updated.');
        },
        'error': function() {
            console.log('Failed to update Seamus URL.');
        }
    });
};

var onDocumentReady = function() {
    $preview = $('#preview');
    $embed = $('#embed');
    $seamusUrl = $('#seamus-url');
    $publishNow = $('#publish-now');

    slug = getParameterByName('quiz');

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
        moviePath: urlRoot + '/js/lib/ZeroClipboard.swf'
    });

    var clipper = new ZeroClipboard($('.clipper'));

    clipper.on('complete', function() {
        alert('Embed code copied to your clipboard!');
    });

    clipper.on('dataRequested', function(client, args) {
        client.setText(embed);
    });

    $publishNow.on('click', onClickPublishNow);
    
    $preview.responsiveIframe({
        src: urlRoot + '/game.html?quiz=' + slug
    });
}

$(document).ready(onDocumentReady);

