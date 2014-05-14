/*
 * Quizzes
 */
var Quizzes = Backbone.Collection.extend({
	url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/quiz/',
	model: Quiz,
});

/*
 * Questions
 */
var Questions = Backbone.Collection.extend({
    url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/question/',
    model: Question,
    sortBy: 'order'
});

/*
* Choices
*/
var Choices = Backbone.Collection.extend({
    url: '/' + APP_CONFIG['PROJECT_SLUG'] + '/api/choice/',
    model: Choice
})
