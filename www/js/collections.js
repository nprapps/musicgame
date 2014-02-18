    /*
 * Quizzes
 */
var Quizzes = Backbone.Collection.extend({
	url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/quiz/',
	model: Quiz,

	parse: function(response) {
        //this.meta = response.meta;

        return response.objects;
	}
});

/*
 * Questions
 */
var Questions = Backbone.Collection.extend({
    url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/question/',
    model: Question
});

/*
* Choices
*/
var Choices = Backbone.Collection.extend({
    url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/choice/',
    model: Choice
})

var Audios = Backbone.Collection.extend({
    url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/audio/',
    model: Audio
})

var Photos = Backbone.Collection.extend({
    url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/photo/',
    model: Photo
})

