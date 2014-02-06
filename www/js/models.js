/*
 * Quiz
 */
var Quiz = Backbone.Model.extend({

    questions: null,

    initialize: function(attributes) {
        if (attributes) {
            if ("questions" in attributes) {
                this.questions = new Questions(attributes.questions);
            }
        }
    },
	url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
		var origUrl = Backbone.Model.prototype.url.call(this);
		return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
	},
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

/*
 * Question
 */
var Question = Backbone.Model.extend({

    choices: null,
    audio: null,
    photo: null,

    initialize: function(attributes) {
        if (attributes) {
            if ("choices" in attributes) {
                this.choices = new Choices(attributes.choices);
            }
            if ("audio" in attributes) {
                this.audio = new Audio(attributes.audio);
            }
            if ("photo" in attributes) {
                this.photo = new Photo(attributes.photo);
            }
        }
    },
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
});

var Choice = Backbone.Model.extend({
    audio: null,
    photo: null,

    initialize: function(attributes) {
        if (attributes) {
            if ("audio" in attributes) {
                this.audio = new Audio(attributes.audio);
            }
            if ("photo" in attributes) {
                this.photo = new Photo(attributes.photo);
            }
        }
    },
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
})

var Audio = Backbone.Model.extend({
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
})

var Photo = Backbone.Model.extend({
    url: function() {
        // Rewrite urls to include a trailing slash so flask doesn't freak out
        var origUrl = Backbone.Model.prototype.url.call(this);
        return origUrl + (origUrl.charAt(origUrl.length - 1) == '/' ? '' : '/');
    },
    toJSON: function() {
        var data = _.clone(this.attributes);

        return data;
    },
    forTemplate: function() {
        var data = _.clone(this.attributes);

        return data;
    }
})