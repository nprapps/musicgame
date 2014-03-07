/*
 * Extract a querystring parameter from the URL.
 */
var getParameterByName = function(name) {
    name = name.replace(/[\[]/, '\\\[').replace(/[\]]/, '\\\]');

    var regex = new RegExp("[\\?&]" + name + '=([^&#]*)');
    var results = regex.exec(location.search);;

    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, " "));
}

if(typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function()
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

/*
 * Scroll to a given element.
 */
var scrollTo = function($el) {
    var top = $el.offset().top;
    $('html,body').animate({
        scrollTop: top
    }, 1000);
};