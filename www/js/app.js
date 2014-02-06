// jQuery references
var $project_modal = $('#project-modal');
var $project_form = $('#project-form');

// State
var router = null;
var project_modal_view = null;
var main_view = null;
var projects = null;
var team = null;
var tickets = null;

function make_context(data) {
    data = _.extend(data, {
        APP_CONFIG: APP_CONFIG
    });

    return data;
}

$(function() {
});
