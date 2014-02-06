/*
 * DashboardView
 */
var DashboardView = Backbone.View.extend({
	el: '.main-wrapper',
    events: {
        'click #add-project': 'add_project'
    },
	initialize: function() {
		_.bindAll(this);

        this.active_projects_view = new ActiveProjectsView();
        this.inactive_projects_view = new InactiveProjectsView();
        this.team_view = new TeamView();
        this.inactive_team_view = new InactiveTeamView();

        this.render();
	},
	render: function() {
		this.$el.empty();

		this.$el.html(JST.dashboard());

        this.active_projects_view.setElement('#active-projects');
        this.active_projects_view.render();

        this.inactive_projects_view.setElement('#inactive-projects');
        this.inactive_projects_view.render();

        this.team_view.setElement('.team .members');
        this.team_view.render();

        this.inactive_team_view.setElement('.team .inactive');
        this.inactive_team_view.render();
	},
    add_project: function() {
        project_modal_view.clear();;
		$project_modal.modal('show');
    },
    close: function() {
        this.$el.empty();
        this.unbind();

        this.active_projects_view.close();
        this.inactive_projects_view.close();
        this.team_view.close();
    }
});

/*
 * ProjectView
 */
var ProjectView = Backbone.View.extend({
	el: '.main-wrapper',
    events: {
		"click .edit-project": "edit"
    },
	initialize: function() {
		_.bindAll(this);

        this.model.on('change', this.render);

        this.render();
	},
	render: function() {
		this.$el.empty();

        var context = make_context(this.model.forTemplate());

        var assigned = team.filter(function(t) {
            return _.indexOf(context['assigned_users'], t.get('login')) >= 0;
        });

        assigned = _.sortBy(assigned, function(t){
            return t.get('login').toLowerCase();
        });

        context['assigned_users'] = _.map(assigned, function(t) { return t.forTemplate() });

        var project_tickets = tickets.where({ repository: this.model.get('github_name') });

        project_tickets = _.sortBy(project_tickets, function(p){
            return -p.get('priority_sort');
        });
        
        context['tickets'] = project_tickets.map(function(ticket) {
             var data = ticket.forTemplate();
             
             if (data['assignee']) {
                 team_member = team.where({ login: data['assignee'] })[0];

                 if (team_member) {
                     data['assignee'] = team_member.forTemplate();
                 } else {
                     // Display login-only for non-team-member
                     data['assignee'] = { login: data['assignee'] };
                 }
             }

             return data;
        });

        context['ticket_counts'] = {
            'critical': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'Critical';
                    }, this)).length,
            'high': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'High';
                    }, this)).length,
            'normal': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'Normal';
                    }, this)).length,
            'low': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'Low';
                    }, this)).length,
            'total': project_tickets.length
        };

		this.$el.html(JST.project(context));

        this.$el.find('table').tablesorter();
	},
    edit: function() {
        project_modal_view.update_from_project(this.model);
		$project_modal.modal('show');
    },
    close: function() {
        this.$el.empty();
        this.undelegateEvents();
        this.unbind();
    }
});

/*
 * UserView
 */
var UserView = Backbone.View.extend({
	el: '.main-wrapper',
    events: {
    },
	initialize: function() {
		_.bindAll(this);

        this.render();
	},
	render: function() {
		this.$el.empty();

        var context = make_context(this.model.forTemplate());

        var user_tickets = tickets.where({ assignee: this.model.get('login') });

        user_tickets = _.sortBy(user_tickets, function(p){
            return -p.get('priority_sort');
        });

        context['tickets'] = user_tickets.map(function(ticket) {
             var data = ticket.forTemplate();

             var project = projects.findWhere({ github_name: data.repository });

             if (project) {
                 data['project'] = project.id;
             } else {
                 data['project'] = null;
             }
             
             return data;
        });

		this.$el.html(JST.user(context));

        this.$el.find('table').tablesorter();
	},
    close: function() {
        this.$el.empty();
        this.undelegateEvents();
        this.unbind();
    }
});

/*
 * ProjectModalView
 */
var ProjectModalView = Backbone.View.extend({
	el: '#project-modal',
    events: {
        'click #delete': 'delete_project',
        'keyup #launch-date': 'change_launch_date',
        'click #save': 'save_project'
    },
	initialize: function() {
		_.bindAll(this);

        this.render();

        team.on('reset', this.update_autocomplete);

        this.$el.on('shown.bs.modal', this.on_shown);
	},
	render: function() {
		this.$el.empty();

		this.$el.html(JST.project_modal());

        this.$project_id = $('#project-id');
        this.$project_name = $('#project-name');
        this.$project_description = $('#project-description');
        this.$github_name = $('#github-name');
        this.$production_url = $('#production-url');
        this.$staging_url = $('#staging-url');
        this.$is_active = $('#is-active');
        this.$launch_date = $('#launch-date');
        this.$assigned_users = $('#assigned-users');
        this.$parsed_launch_date = $('#parse-launch-date');
    
        this.$assigned_users.chosen({ width: '100%' });

        this.update_autocomplete();
	},
    update_autocomplete: function() {
        this.$assigned_users.empty();

        team.each(_.bind(function(user) {
            this.$assigned_users.append('<option>' + user.get('login') + '</option>'); 
        }, this));
    },
    update_from_project: function(project) {
        $project_modal.addClass('update');
        $project_modal.find('.modal-title').text('Edit a project');

        this.$project_id.val(project.id);
        this.$project_name.val(project.get('name'));
        this.$project_description.val(project.get('description'));
        this.$github_name.val(project.get('github_name'));
        this.$staging_url.val(project.get('staging_url'));
        this.$production_url.val(project.get('production_url'));
        this.$launch_date.val(project.get('launch_date'));

        this.$launch_date.trigger('keyup');

        var assigned_users = project.getAssignedUsers();
        
        // Clear assigned users
        this.$assigned_users.find('option').removeAttr('selected');

        // Select assigned users
        _.each(assigned_users, _.bind(function(user) {
            var el = this.$assigned_users.find('option:contains(' + user + ')');
            el.attr('selected', 'selected');
        }, this));
            
        // Refresh Chosen
        this.$assigned_users.trigger('chosen:updated');

        if (project.get('active')) {
            this.$is_active.attr('checked', 'checked');
        } else {
            this.$is_active.removeAttr('checked');
        }
    },
    serialize: function() {
        var properties = {
            id: this.$project_id.val(),
            name: this.$project_name.val().trim(),
            description: this.$project_description.val().trim(),
            github_name: this.$github_name.val().trim(),
            staging_url: this.$staging_url.val().trim(),
            production_url: this.$production_url.val().trim(),
            active: this.$is_active.is(':checked'),
            launch_date: this.$launch_date.val()
        };

        var urls = ['staging_url', 'production_url'];

        for (i in urls) {
            var prop = properties[urls[i]];

            if (prop != '' && prop.indexOf('http') != 0) {
                properties[urls[i]] = 'http://' + prop; 
            }
        }

        var assigned_users = this.$assigned_users.val();

        if (assigned_users == null) {
            properties.assigned_users = '';
        } else {
            properties.assigned_users = this.$assigned_users.val().join(',');
        }

        return properties;
    },
    clear: function() {
        $project_modal.removeClass('update');
        $project_modal.find('.modal-title').text('Add a project');

        this.$project_id.val('');
        this.$project_name.val('');
        this.$project_description.val('');
        this.$github_name.val('');
        this.$staging_url.val('');
        this.$production_url.val('');
        this.$launch_date.val('');

        // Clear assigned users
        this.$assigned_users.find('option').removeAttr('selected');
            
        // Refresh Chosen
        this.$assigned_users.trigger('chosen:updated');

        this.$is_active.attr('checked', 'checked');
    },
    delete_project: function() {
        var properties = this.serialize();

        var id = properties['id'];

    	if (id !== ''){
    		var project = projects.get(id);

       		project.destroy({
	            success: function() {
	                projects.trigger('change');
	            }
	        });
    	}
    				
        $project_modal.modal('hide');
    },
    save_project: function() {
        var properties = this.serialize();

        var id = properties['id'];
        delete properties['id'];

    	if (id == '') {
    		projects.create(properties, { wait: true });
    	} else {
    		var project = projects.get(id);

       		project.save(properties, {
    			success: function(data) {
                    projects.sort();
    			},
    			error: function(data) {
    				console.log('failed to save project');
    			}
    		});
    	}
    				
        $project_modal.modal('hide');
    },
    change_launch_date: function() {
        var d = Date.parse(this.$launch_date.val());

        this.$parsed_launch_date.text(d !== null ? d.toString('MMMM d, yyyy') : 'Input could not be parsed.');
    },
    on_shown: function() {
        this.$project_name.focus().select();
    },
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * ActiveProjectView
 */
var ActiveProjectView = Backbone.View.extend({
	tagName: 'div',
	className: 'project',
	events: {
		"click .edit-project": "edit"
	},
	initialize: function() {
        // pass
	},
	render: function() {
        var context = make_context(this.model.forTemplate());
        
        var assigned = team.filter(function(t) {
            return _.indexOf(context['assigned_users'], t.get('login')) >= 0;
        });

        assigned = _.sortBy(assigned, function(t){
            return t.get('login').toLowerCase();
        });

        context['assigned_users'] = _.map(assigned, function(t) { return t.forTemplate() });

        var project_tickets = tickets.where({ repository: this.model.get('github_name') });

        context['ticket_counts'] = {
            'critical': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'Critical';
                    }, this)).length,
            'high': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'High';
                    }, this)).length,
            'normal': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'Normal';
                    }, this)).length,
            'low': project_tickets.filter(_.bind(function(ticket) {
                        return ticket.get('priority') === 'Low';
                    }, this)).length,
            'total': project_tickets.length
        };

		this.$el.html(JST.active_project(context));
	},
	edit: function() {
        project_modal_view.update_from_project(this.model);
		$project_modal.modal('show');
	},
    destroy: function() {
        this.model.destroy({
            success: function() {
                projects.trigger('change');
            }
        });
    },
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * ActiveProjectsView
 */
var ActiveProjectsView = Backbone.View.extend({
	el: '#active-projects',
	initialize: function() {
		_.bindAll(this);

		projects.on('change', this.render);
		projects.on('sort', this.render);

        this.child_views = [];
	},
	render: function() {
        _.each(this.child_views, function(view) {
            view.close();
        });
		
        //this.$el.empty();

        var active = projects.where({ active: true });

		_.each(active, _.bind(function(project) {
			var view = new ActiveProjectView({
				model: project
			});

            view.render();

			this.$el.append(view.el);
            this.child_views.push(view);
		}, this));
	},
    close: function() {
        this.remove();
        this.unbind();

        _.each(this.child_views, function(view) {
            view.close();
        });
    }
});

/* 
 * InactiveProjectView
 */
var InactiveProjectView = Backbone.View.extend({
	tagName: 'li',
	className: 'inactive-project',
	events: {
		"click .edit-project": "edit"
	},
	initialize: function() {
        // pass
	},
	render: function() {
        var context = make_context(this.model.forTemplate());

        var assigned = team.filter(function(t) {
            return _.indexOf(context['assigned_users'], t.get('login')) >= 0;
        });

        context['assigned_users'] = _.each(assigned, function(t) { return t.forTemplate() });

		this.$el.html(JST.inactive_project(context));
	},
	edit: function() {
        project_modal_view.update_from_project(this.model);
		$project_modal.modal('show');
	},
    destroy: function() {
        this.model.destroy({
            success: function() {
                projects.trigger('change');
            }
        });
    },
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * InactiveProjectsView
 */
var InactiveProjectsView = Backbone.View.extend({
	el: '#inactive-projects',
	initialize: function() {
		_.bindAll(this);

		projects.on('change', this.render);
		projects.on('sort', this.render);

        this.child_views = [];
	},
	render: function() {
        _.each(this.child_views, function(view) {
            view.close();
        });

		//this.$el.empty();

        var inactive = projects.where({ active: false });

        inactive = _.sortBy(inactive, function(p){
            return p.get('name').toLowerCase();
        });

        _.each(inactive, _.bind(function(project){
			var view = new InactiveProjectView({
				model: project
			});

            view.render();

			this.$el.append(view.el);
            this.child_views.push(view);
		}, this));
	},
    close: function() {
        this.remove();
        this.unbind();

        _.each(this.child_views, function(view) {
            view.close();
        });
    }
});

/*
 * TeamMemberView
 */
var TeamMemberView = Backbone.View.extend({
	tagName: 'tr',
	events: {
	},
	initialize: function() {
		this.render();
	},
	render: function() {
        var context = make_context(this.model.forTemplate());
		this.$el.html(JST.team_member(context));
	},
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * TeamMemberView
 */
var InactiveTeamMemberView = Backbone.View.extend({
    tagName: 'li',
    events: {
    },
    initialize: function() {
        this.render();
    },
    render: function() {
        var context = make_context(this.model.forTemplate());
        this.$el.html(JST.inactive_team_member(context));
    },
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * TeamView
 */
var TeamView = Backbone.View.extend({
    el: '.team .members',
    initialize: function() {
        _.bindAll(this);

        team.on('change', this.render);
        projects.on('change', this.render);

        this.child_views = [];
    },
    render: function() {
        _.each(this.child_views, function(view) {
            view.close();
        });

        var active = team.filter(function(t){
            var num_projects = projects.filter(function(project) {
                return project.get('active') == true && project.get('assigned_users').indexOf(t.get('login')) >= 0;
            }).length;

            return num_projects > 0;
        });

        active = _.sortBy(active, function(t){
            var num_projects = projects.filter(function(project) {
                        return project.get('active') == true && project.get('assigned_users').indexOf(t.get('login')) >= 0;
            }).length;
            return -num_projects;
        });

		//this.$el.empty();
        _.each(active, _.bind(function(user) {
			var view = new TeamMemberView({
				model: user 
			});

            view.render();

			this.$el.append(view.el);
            this.child_views.push(view);
		}, this));
    },
    close: function() {
        this.remove();
        this.unbind();

        _.each(this.child_views, function(view) {
            view.close();
        });
    }
});

var InactiveTeamView = Backbone.View.extend({
    el: '.team .inactive',
    initialize: function() {
        _.bindAll(this);

        team.on('change', this.render);
        projects.on('change', this.render);

        this.child_views = [];
    },
    render: function() {
        _.each(this.child_views, function(view) {
            view.close();
        });

        var inactive = team.filter(function(t){
            var num_projects = projects.filter(function(project) {
                return project.get('active') == true && project.get('assigned_users').indexOf(t.get('login')) >= 0;
            }).length;

            return num_projects === 0;
        });

        inactive = _.sortBy(inactive, function(t){
            return t.get('login').toLowerCase();
        });

        //this.$el.empty();
        _.each(inactive, _.bind(function(user) {
            var view = new InactiveTeamMemberView({
                model: user 
            });

            view.render();

            this.$el.append(view.el);
            this.child_views.push(view);
        }, this));
    },
    close: function() {
        this.remove();
        this.unbind();

        _.each(this.child_views, function(view) {
            view.close();
        });
    }
});

/*
 * TicketView
 */
var TicketView = Backbone.View.extend({
    close: function() {
        this.remove();
        this.unbind();
    }
});

/*
 * TicketsView
 */
var TicketsView = Backbone.View.extend({
    close: function() {
        this.remove();
        this.unbind();

        _.each(child_views, function(view) {
            view.close();
        });
    }
});
