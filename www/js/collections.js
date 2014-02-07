    /*
 * Quizzes
 */
var Quizzes = Backbone.Collection.extend({
	url: APP_CONFIG['SERVER_BASE_URL'] + '/api/quiz/',
	model: Quiz
});

/*
 * Questions
 */
var Questions = Backbone.Collection.extend({
    url: APP_CONFIG['SERVER_BASE_URL'] + '/api/question/',
    model: Question
});

/*
* Choices
*/
var Choices = Backbone.Collection.extend({
    url: APP_CONFIG['SERVER_BASE_URL'] + '/api/choice/',
    model: Choice
})

var Audios = Backbone.Collection.extend({
    url: APP_CONFIG['SERVER_BASE_URL'] + '/api/audio/',
    model: Audio
})

var Photos = Backbone.Collection.extend({
    url: APP_CONFIG['SERVER_BASE_URL'] + '/api/photo/',
    model: Photo
})

