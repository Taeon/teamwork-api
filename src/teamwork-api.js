(function (global) {

	var tw_base_url, tw_api_key;
	var authenticating = false;
	var deferred_authenticated_requests = [];
	
	/**
	 * Return URL for requests
	 *
	 * @return		string
	 */
	var GetURL = function( endpoint ){
		var url = endpoint + '.json';
		// Don't prefix URLs which already have a protocol
		if ( endpoint.indexOf( '//' ) !== 0 && endpoint.indexOf( 'http' ) !== 0 ) {
			url = tw_base_url + url;
		}

		return url;
	}

	/**
	 * Internal method for making ajax calls
	 *
	 * @param	string			endpoint		Path to API endpoint
	 * @param	object			options			Any options to be sent with the request
	 * @param	string			method			Which method (get, post, put, delete) to use
	 *
	 * @return	object			promises		Object with promise methods
	 */
	var Execute = function( endpoint, options, method ){

		// Define promises
		var then_stack = [], catch_stack = [], complete_stack = [];
		var promises = {
			then:function(func){
				then_stack.push(func);
				return promises;
			},
			'catch':function(func){
				catch_stack.push(func);
				return promises;
			},
			complete:function(func){
				complete_stack.push(func);
				return promises;
			}
		};
		for( var index in options ){
			if ( typeof options[ index ] == 'object' && typeof options[ index ].constructor != 'undefined' ) {
				if ( options[ index ].constructor == Date ) {
					options[ index ] = FormatDate( options[ index ] );
				}
			}
		}

		var headers = {
			'Authorization': "BASIC " + window.btoa( tw_api_key + ":xxx")
		};
		
		if ( typeof jQuery !== 'undefined' ) {
			var request = function(){
				jQuery.ajax(
					GetURL( endpoint ),
					{
						data:options,
						method: method.toUpperCase(),
						headers:headers,
						success: function( data ){
							if ( then_stack.length > 0 ) {
								for( var i = 0; func = then_stack[ i ]; i++ ){
									func.apply( func, [ data ] );
									delete then_stack[ i ];
								}
							}
							then_stack = null;
						},
						error: function(){
							if ( catch_stack.length > 0 ) {
								for( var i = 0; func = catch_stack[ i ]; i++ ){
									func.apply( func, arguments );
									delete catch_stack[ i ];
								}
							}
							catch_stack = null;
						},
						complete: function( data, status ){
							if ( complete_stack.length > 0 ) {
								for( var i = 0; func = complete_stack[ i ]; i++ ){
									func.apply( func, arguments );
									delete complete_stack[ i ];
								}
							}
							complete_stack = null;
						},
						dataType:'json'
					}
				);
			}
		} else if( typeof qwest !== 'undefined' ) {
			var request = function(){
				qwest[method](
					GetURL( endpoint ),
					options,
					{
						headers:headers,
						responseType:'json',
						
					}
				).then(
					function( data, status ){
						var _data = data;
						if ( then_stack.length > 0 ) {
							for( var i = 0; func = then_stack[ i ]; i++ ){
								func.apply( func, arguments );
								delete then_stack[ i ];
							}
							then_stack = null;
						}
					}
				).catch(
					function( data, status ){
						if ( catch_stack.length > 0 ) {
							for( var i = 0; func = catch_stack[ i ]; i++ ){
								func.apply( func, arguments );
								delete catch_stack[ i ];
							}
						}
						catch_stack = null;
					}
				).complete(
					function( data, status ){
						if ( complete_stack.length > 0 ) {
							for( var i = 0; func = complete_stack[ i ]; i++ ){
								func.apply( func, arguments );
								delete complete_stack[ i ];
							}
						}
						complete_stack = null;
					}
				);
			}
		} else {
			alert( 'TeamworkAPI: You must include either jQuery or qwest' );
		}

		// If we haven't authenticated yet...
		if ( authenticating ) {
			// ...store these requests for later
			deferred_authenticated_requests.push( request );
		} else {
			// Just execute the request
			request();
		}
		
		return promises;
	}
	
	/*******************************
	 *       Shortcut methods      *
	 *******************************/
	
	/**
	 * Internal shortcut functions for GET requests
	 *
	 * @param	string			endpoint	Path to API endpoint
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	var Get = function( endpoint, options ){
		
		return Execute(
			endpoint,
			options,
			'get'
		);
	};

	/**
	 * Internal shortcut functions for POST requests
	 *
	 * @param	string			endpoint	Path to API endpoint
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	var Post = function( endpoint, options ){
		
		return Execute(
			endpoint,
			{},
			'post'
		);
	};

	/**
	 * Internal shortcut functions for PUSH requests
	 *
	 * @param	string			endpoint	Path to API endpoint
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	var Put = function( endpoint, options ){
		
		return Execute(
			endpoint,
			{},
			'put'
		);
	};
	
	/**
	 * Internal shortcut functions for DELETE requests
	 *
	 * @param	string			endpoint	Path to API endpoint
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	var Delete = function( endpoint, options ){
		
		return Execute(
			endpoint,
			{},
			'delete'
		);
	};

	/**
	 * Interpolate values into a path string
	 */
	var BuildPath = function( path, parameters ){
		for( key in parameters ){
			var regex = new RegExp( '({' + key + '})' );
			path = path.replace( regex, parameters[ key ].toString() );
		}

		return path;
	}
	
	/**
	 * Left-pad a string
	 */
	var Pad = function(n, width, z) {
		z = z || '0';
		n = n + '';
		return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
	}

	/**
	 * Return a date formatted for sending as a parameter (YYYYMMDD)
	 */
	var FormatDate = function( date ){
		return date.getFullYear().toString() + Pad( date.getMonth() + 1, 2, '0' ) + Pad( date.getDate(), 2, '0' );
	}

	/******************************************************************/
	/******************************************************************/
	
	/**
	 * Constructor
	 *
	 * @param	string		api_key
	 */
	var TeamworkAPI = function( api_key ){
		tw_api_key = api_key;

		// Get account info, in order to retrieve base URL
		this.GetAuthentication().then(
			function( data ){
				tw_base_url = data.account.URL;
				authenticating = false;
				// Execute any requests called while we were waiting for authentication to be returned
				for( var i = 0; request = deferred_authenticated_requests[ i ]; i++ ){
					request();
					delete deferred_authenticated_requests[ i ];
				}
				deferred_authenticated_requests = null;
			}
		);
		authenticating = true;

		//tw_base_url = base_url;
	}
	



/***********
 * Account *
 ***********/


	/**
	 * Get Account Details
	 * http://developer.teamwork.com/account#get_account_detai
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetAccount = function( options ){
		return Get(
			'account',
			options
		);
	};

	/**
	 * The 'Authenticate' Call
	 * http://developer.teamwork.com/account#the_'authenti
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetAuthentication = function( options ){
		return Get(
			'//authenticate.teamworkpm.net/authenticate',
			options
		);
	};

/************
 * Activity *
 ************/

	/**
	 * Latest Activity across all projects
	 * http://developer.teamwork.com/activity#latest_activity_a
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetActivity = function( options ){
		return Get(
			'latestActivity',
			options
		);
	};

	/**
	 * List Latest Activity (for a project)
	 * http://developer.teamwork.com/activity#list_latest_activ
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectActivity = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/latestActivity', {project_id:project_id} ),
			options
		);
	};

/**
Delete an activity entry
http://developer.teamwork.com/activity#delete_an_activit
DELETE /activity/{id}.json

**/

/**

Categories
==========

- Message Categories

Creating Categories
http://developer.teamwork.com/messagecategories#creating_categori
POST /projects/{project_id}/messageCategories.json

	/**
	 * Retrieve a Single Message Category
	 * http://developer.teamwork.com/messagecategories#retrieve_a_single
	 *
	 * @param		int			category_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetMessageCategory = function( category_id, options ){
		return Get(
			BuildPath( 'messageCategories/{id}', {id:category_id} ),
			options
		);
	};

	/**
	 * Retrieving all of a Projects Message Categories
	 * http://developer.teamwork.com/messagecategories#retrieving_all_of
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectMessageCategories = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/messageCategories', {project_id:project_id} ),
			options
		);
	};

/*

Updating a Category
http://developer.teamwork.com/messagecategories#updating_a_catego
PUT /messageCategories/{id}.json

Destroying a Category
http://developer.teamwork.com/messagecategories#destroying_a_cate
DELETE /messageCategories/{id}.json
**/

/**
- File Categories 
*/

	/**
	 * Retrieve a Single File Category
	 * http://developer.teamwork.com/filecategories#retrieve_a_single
	 *
	 * @param		int			category_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetFileCategory = function( category_id, options ){
		return Get(
			BuildPath( 'fileCategories/{id}', {id:category_id} ),
			options
		);
	};

	/**
	 * Retrieving all of a Projects File Categories
	 * http://developer.teamwork.com/filecategories#retrieving_all_of
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectFileCategories = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/fileCategories.json', {project_id:project_id} ),
			options
		);
	};


/**
Creating Categories
http://developer.teamwork.com/filecategories#creating_categori
POST /projects/{project_id}/fileCategories.json

Updating a Category
http://developer.teamwork.com/filecategories#updating_a_catego
PUT /fileCategories/{id}.json

Destroying a Category
http://developer.teamwork.com/filecategories#destroying_a_cate
DELETE /fileCategories/{id}.json
**/

/**
- Notebook categories

Creating Categories
http://developer.teamwork.com/notebookcategories#creating_categori
POST /projects/{project_id}/notebookCategories.json

*/

	/**
	 * Retrieve a Single Notebook Category
	 * http://developer.teamwork.com/notebookcategories#retrieve_a_single
	 *
	 * @param		int			category_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetNotebookCategory = function( category_id, options ){
		return Get(
			BuildPath( 'notebookCategories/{id}', {id:category_id} ),
			options
		);
	};

	/**
	 * Retrieving all of a Projects Notebook Categories
	 * http://developer.teamwork.com/notebookcategories#retrieving_all_of
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectFileCategories = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/notebookCategories', {project_id:project_id} ),
			options
		);
	};
/**
Updating a Category
http://developer.teamwork.com/notebookcategories#updating_a_catego
PUT /notebookCategories/{id}.json

Destroying a Category
http://developer.teamwork.com/notebookcategories#destroying_a_cate
DELETE /notebookCategories/{id}.json
**/

/**
- Link Categories

Creating categories
http://developer.teamwork.com/linkcategories#__creating_categor
POST /projects/#{project_id}/linkCategories.json
*/

	/**
	 * Retrieve a single link category
	 * http://developer.teamwork.com/linkcategories#__retrieve_a_singl
	 *
	 * @param		int			category_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetLinkCategory = function( category_id, options ){
		return Get(
			BuildPath( 'linkCategories/{id}', {id:category_id} ),
			options
		);
	};

	/**
	 * Retrieving all of a projects link categories
	 * http://developer.teamwork.com/linkcategories#__retrieving_all_o
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectLinkCategories = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/linkCategories', {project_id:project_id} ),
			options
		);
	};
	
/**

Updating a category
http://developer.teamwork.com/linkcategories#__updating_a_categ
PUT /linkCategories/#{id}.json

Destroying a Category
http://developer.teamwork.com/linkcategories#__destroying_a_cat
DELETE /linkCategories/#{id}.json
**/

/**
- Project Categories

Creating Project Categories
http://developer.teamwork.com/projectcategories#creating_project_
POST /projectcategories.json
*/

	/**
	 * Retrieve a single Project Category
	 * http://developer.teamwork.com/projectcategories#retrieve_a_single
	 *
	 * @param		int			category_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectCategory = function( category_id, options ){
		return Get(
			BuildPath( 'projectCategories/{id}', {id:category_id} ),
			options
		);
	};

	/**
	 * Retrieve all Project Categories
	 * http://developer.teamwork.com/projectcategories#retrieve_all_proj
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectCategories = function( project_id, options ){
		return Get(
			BuildPath( 'projectCategories', {project_id:project_id} ),
			options
		);
	};
/**

Updating a Project Category
http://developer.teamwork.com/projectcategories#updating_a_projec
PUT /projectCategories/{id}.json

Destroying a Project Category
http://developer.teamwork.com/projectcategories#destroying_a_proj
DELETE /projectCategories/{id}.json
**/

/**
Comments
========

Retreiving Recent Comments
http://developer.teamwork.com/comments#retreiving_recent
GET /{resource}/{resource_id}/comments.json

Retrieving a Specific Comment
http://developer.teamwork.com/comments#retrieving_a_spec
GET /comments/{comment_id}.json

Creating a Comment
http://developer.teamwork.com/comments#creating_a_commen
POST /{resource}/{resource_id}/comments.json

Updating a comment
http://developer.teamwork.com/comments#updating_a_commen
PUT /comments/{id}.json

Destroying a comment
http://developer.teamwork.com/comments#destroying_a_comm
DELETE /comments/{id}.json

Mark a comment as read
http://developer.teamwork.com/comments#mark_a_comment_as
PUT /comments/{id}/markread.json
**/

/**
Companies
=========

Create Company
http://developer.teamwork.com/companies#create_company
POST /companies.json

Update Company
http://developer.teamwork.com/companies#update_company
PUT /companies/{company_id}.json

Delete Company
http://developer.teamwork.com/companies#delete_company
DELETE /companies/{id}.json

Retrieve a Single Company
http://developer.teamwork.com/companies#retrieve_a_single
GET /companies/{company_id}.json

Retrieve Companies
http://developer.teamwork.com/companies#retrieve_companie
GET /companies.json

Retrieving Companies within a Project
http://developer.teamwork.com/companies#retrieving_compan
GET /projects/{project_id}/companies.json
**/

/**
Files
=====

List Files on a Project
http://developer.teamwork.com/files#list_files_on_a_p
GET /projects/{project_id}/files.json

Get a Single File
http://developer.teamwork.com/files#get_a_single_file
GET /files/{file_id}.json

Add a File to a Project
http://developer.teamwork.com/files#add_a_file_to_a_p
POST /projects/{project_id}/files.json

Add a new File Version to a File
http://developer.teamwork.com/files#add_a_new_file_ve
POST /files/{file_id}.json

Delete a File from a Project
http://developer.teamwork.com/files#delete_a_file_fro
DELETE /files/{file_id}.json
**/

/**
Calendar Events
===============

Get Events
http://developer.teamwork.com/events#get_events
GET /calendarevents.json

Get an Event
http://developer.teamwork.com/events#get_an_event
GET /calendarevents/{id}.json

Create event
http://developer.teamwork.com/events#create_event
POST/calendarevents.json

Edit event
http://developer.teamwork.com/events#edit_event
PUT /calendarevents/{id}.json

Delete event
http://developer.teamwork.com/events#delete_event
DELETE /calendarevents/{id}.json

Get event types
http://developer.teamwork.com/events#get_event_types
GET /calendareventtypes.json
**/

/**
Messages
========

Create a message
http://developer.teamwork.com/messages#create_a_message
POST /projects/{project_id}/posts.json

Retrieve a Single Message
http://developer.teamwork.com/messages#retrieve_a_single
GET /posts/{id}.json

Retrieve Latest Messages
http://developer.teamwork.com/messages#retrieve_latest_m
GET /projects/{project_id}/posts.json

Retrieve Messages by Category
http://developer.teamwork.com/messages#retrieve_messages
GET /projects/{project_id}/cat/{category_id}/posts.json

Update message
http://developer.teamwork.com/messages#update_message
PUT /posts/{id}.json

Get archived messages
http://developer.teamwork.com/messages#get_archived_mess
GET /projects/{project_id}/posts/archive.json

Get archived messages by category
http://developer.teamwork.com/messages#get_archived_mess
GET /projects/{project_id}/cat/{category_id}/posts/archive.json

Archive a message
http://developer.teamwork.com/messages#archive_a_message
PUT /messages/{id}/archive.json

Un-archive a message
http://developer.teamwork.com/messages#un-archive_a_mess
PUT /messages/{id}/unarchive.json

Destroy message
http://developer.teamwork.com/messages#destroy_message
DELETE /posts/{id}.json
**/

/**
Message Replies
===============

Create a Message Reply
http://developer.teamwork.com/messagereplies#create_a_message_
POST /messages/{message_id}/messageReplies.json

Retrieve a Single Message Reply
http://developer.teamwork.com/messagereplies#retrieve_a_single
GET /messageReplies/{id}.json

Retrieve Replies to a Message
http://developer.teamwork.com/messagereplies#retrieve_a_single
GET /messages/{id}/replies.json

Update Message Reply
http://developer.teamwork.com/messagereplies#update_message_re
PUT /messageReplies/{id}.json

Destroy Message Reply
http://developer.teamwork.com/messagereplies#destroy_message_r
DELETE /messageReplies/{id}.json
**/

/**
Milestones
==========

List All Milestones
http://developer.teamwork.com/milestones#list_all_mileston
GET /milestones.json

List Milestones on a Project
http://developer.teamwork.com/milestones#list_milestones_o
GET /projects/{project_id}/milestones.json

Get a Single Milestone
http://developer.teamwork.com/milestones#get_a_single_mile
GET /milestones/{milestone_id}.json

Complete
http://developer.teamwork.com/milestones#complete
PUT /milestones/{id}/complete.json

Uncomplete
http://developer.teamwork.com/milestones#uncomplete
PUT /milestones/{id}/uncomplete.json

Create a Single Milestone
http://developer.teamwork.com/milestones#create_a_single_m
POST /projects/{project_id}/milestones.json

Update
http://developer.teamwork.com/milestones#update
PUT /milestones/{milestone_id}.json

Delete
http://developer.teamwork.com/milestones#delete
DELETE /milestones/{id}.json
**/

/**
Notebooks
=========

List All Notebooks
http://developer.teamwork.com/notebooks#list_all_notebook
GET /notebooks.json

List Notebooks on a Project
http://developer.teamwork.com/notebooks#list_notebooks_on
GET /projects/{project_id}/notebooks.json

List Notebooks in a specific category
http://developer.teamwork.com/notebooks#list_notebooks_in
GET /notebookCategories/{id}/notebooks.json

Get a Single Notebook
http://developer.teamwork.com/notebooks#get_a_single_note
GET /notebooks/{notebook_id}.json

Create a Single Notebook
http://developer.teamwork.com/notebooks#create_a_single_n
POST /projects/{project_id}/notebooks.json

Update a Single Notebook
http://developer.teamwork.com/notebooks#update_a_single_n
PUT /notebooks/{notebook_id}.json

Lock a Single Notebook For Editing
http://developer.teamwork.com/notebooks#lock_a_single_not
PUT /notebooks/{id}/lock.json

Unlock a Single Notebook
http://developer.teamwork.com/notebooks#unlock_a_single_n
PUT /notebooks/{id}/unlock.json

Delete a Single Notebook
http://developer.teamwork.com/notebooks#delete_a_single_n
DELETE /notebooks/{id}.json
**/

/**
People
======

Add a new user
http://developer.teamwork.com/people#add_a_new_user
POST /people.json

Edit user
http://developer.teamwork.com/people#edit_user
PUT /people/{id}.json

Delete user
http://developer.teamwork.com/people#delete_user
DELETE /people/{id}.json

*/

	/*******************************
	 *            People            *
	 *******************************/
		
	/**
	 * Get Current User Details
	 * http://developer.teamwork.com/people#get_current_user_
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetCurrentUser = function( options ){
		return Get(
			'me',
			options
		);
	};

	/**
	 * Get people
	 * http://developer.teamwork.com/people#get_people
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetPeople = function( options ){
		return Get(
			'people',
			options
		);
	};

	/**
	 * Get all People (within a Project)
	 * http://developer.teamwork.com/people#get_all_people_(w
	 *
	 * @param		int			person_id	ID of project
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectPeople = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/people', {project_id:project_id}),
			options
		);
	};

	/**
	 * Get People (within a Company)
	 * http://developer.teamwork.com/people#get_people_(withi
	 *
	 * @param		int			person_id	ID of company
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetCompanyPeople = function( company_id, options ){
		return Get(
			BuildPath( 'companies/{company_id}/people', {company_id:company_id}),
			options
		);
	};

	/**
	 * Retrieve a Specific Person
	 * http://developer.teamwork.com/people#retrieve_a_specif
	 *
	 * @param		int			person_id		ID of person to be retrieved
	 * @param		object		options			Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetPerson = function( person_id, options ){
		
		return Get(
			BuildPath( 'people/{person_id}', {person_id:person_id} ),
			options
		);
	};	

	/**
	 * Retrieve a API Keys for all people on account
	 * http://developer.teamwork.com/people#retrieve_a_api_ke
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetAPIKeys = function( options ){
		return Get(
			'people/APIKeys',
			options
		);
	};


/**
People - Status
===============

Create Status
http://developer.teamwork.com/people-status#create_status
POST /me/status.json
POST /people/{person_id}/status.json

Update Status
http://developer.teamwork.com/people-status#update_status
PUT /me/status/{status_id}.json
PUT /people/status/{status_id}.json
PUT /people/{person_id}/status/{status_id}.json

Delete Status
http://developer.teamwork.com/people-status#delete_status
DELETE /me/status/{status_id}.json
DELETE /people/status/{status_id}.json
DELETE /people/{person_id}/status/{status_id}.json

Retrieve a Persons Status
http://developer.teamwork.com/people-status#retrieve_a_person
GET /me/status.json
GET /people/{user_id}/status.json

Retrieve Everybodys Status
http://developer.teamwork.com/people-status#retrieve_everybod
GET /people/status.json
**/

/**
Permissions
===========

Add a new user to a project
http://developer.teamwork.com/permissions#add_a_new_user_to
POST /projects/{id}/people/{id}.json

Add/Remove multiple people to/from a project
http://developer.teamwork.com/permissions#add/remove_multip
PUT /projects/{id}/people.json

Remove a user from a project
http://developer.teamwork.com/permissions#remove_a_user_fro
DELETE /projects/{id}/people/{id}.json

Get a users permissions on a project
http://developer.teamwork.com/permissions#get_a_users_permi
GET /projects/{id}/people/{id}.json

Update a users permissions on a project
http://developer.teamwork.com/permissions#update_a_users_pe
PUT /projects/{id}/people/{id}.json
**/

/**
Projects
========

Create Project
http://developer.teamwork.com/projectsapi#create_project
POST /projects.json

Update Project
http://developer.teamwork.com/projectsapi#update_project
PUT /projects/{project_id}.json

Delete Project
http://developer.teamwork.com/projectsapi#delete_project
DELETE /projects/{id}.json

Retrieve All Projects
http://developer.teamwork.com/projectsapi#retrieve_all_proj
GET /projects.json

Retrieve a Single Project
http://developer.teamwork.com/projectsapi#retrieve_a_single
GET /projects/{project_id}.json

Retrieve projects assigned to a specific company
http://developer.teamwork.com/projectsapi#retrieve_projects
GET /companies/{id}/projects.json

Retrieve your Starred Projects
http://developer.teamwork.com/projectsapi#retrieve_your_sta
GET /projects/starred.json

Star a project
http://developer.teamwork.com/projectsapi#star_a_project
PUT /projects/{project_id}/star.json

Unstar a project
http://developer.teamwork.com/projectsapi#unstar_a_project
PUT /projects/{project_id}/unstar.json
**/


	/*******************************
	 *            Projects            *
	 *******************************/

	/**
	 * Get list of projects
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjects = function( options ){
		return Get(
			'projects',
			options
		);
	};


/**
Roles
=====

List Roles on a Project
http://developer.teamwork.com/projectroles#list_roles_on_a_p
GET /projects/{id}/roles.json

Add a role to a project
http://developer.teamwork.com/projectroles#add_a_role_to_a_p
POST /projects/{id}/roles.json

Update a role on a project
http://developer.teamwork.com/projectroles#update_a_role_on_
PUT /roles/{id}.json

Delete a role
http://developer.teamwork.com/projectroles#delete_a_role
DELETE /roles/{id}.json
**/

/**
Project Email Addresses
=======================

Get Project Email Address
http://developer.teamwork.com/projectemailaddresses#get_project_email
GET /projects/{id}/emailaddress.json

Update Project Email Address
http://developer.teamwork.com/projectemailaddresses#update_project_em
PUT /projects/{id}/emailaddress.json
**/

/**
Links
=====

List All Links
http://developer.teamwork.com/links#list_all_links
GET /links.json

List Links on a Project
http://developer.teamwork.com/links#list_links_on_a_p
GET /projects/{project_id}/links.json

Get a Single Link
http://developer.teamwork.com/links#get_a_single_link
GET /links/{link_id}.json

Create a Single Link
http://developer.teamwork.com/links#create_a_single_l
POST /projects/{project_id}/links.json

Update a Single Link
http://developer.teamwork.com/links#update_a_single_l
PUT /links/{link_id}.json

Delete a Single Link
http://developer.teamwork.com/links#delete_a_single_l
DELETE /links/{link_id}.json
**/

/**
Time Tracking API Calls
=======================

Retrieve All tIme Entries across all projects
http://developer.teamwork.com/timetracking#retrieve_all_time
GET /time_entries.json

Retrieve All Time Entries for a Project
http://developer.teamwork.com/timetracking#retrieve_all_time
GET /projects/{project_id}/time_entries.json

Retrieve all To-do Item Times
http://developer.teamwork.com/timetracking#retrieve_all_to-d
GET /todo_items/{todo_item_id}/time_entries.json

Create a Time-Entry
http://developer.teamwork.com/timetracking#create_a_time-ent
POST /projects/{project_id}/time_entries.json

Create a Time-Entry (for a task/todo item)
http://developer.teamwork.com/timetracking#create_a_time-ent
POST /tasks/{taskid}/time_entries.json

Retrieve Single Time-Entry
http://developer.teamwork.com/timetracking#retrieve_single_t
GET /time_entries/{id}.json

Update an Entry
http://developer.teamwork.com/timetracking#update_an_entry
PUT /time_entries/{id}.json

Delete Time-Entry
http://developer.teamwork.com/timetracking#delete_time-entry
DELETE /time_entries/{id}.json

Time Totals
http://developer.teamwork.com/timetracking#time_totals
GET /time/total.json
GET /projects/{id}/time/total.json
GET /tasklists/{id}/time/total.json
GET /tasks/{id}/time/total.json
**/

	/*******************************
	 *       Time entries          *
	 *******************************/

	/**
	 * Get list of time entries
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetTimeEntries = function( options ){
		return Get(
			'time_entries',
			options
		);
	};

	/**
	 * Get list of time entries for a project
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetTimeEntriesForProject = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/time_entries', { project_id:project_id }),
			options
		);
	};


/**
Task Lists
==========

Get all task lists for a project
http://developer.teamwork.com/tasklists#get_all_task_list
GET /projects/{project_id}/tasklists.json

Retrieve Single task list
http://developer.teamwork.com/tasklists#retrieve_single_t
GET /tasklists/{id}.json

Update list
http://developer.teamwork.com/tasklists#update_list
PUT /tasklists/{id}.json

Create list
http://developer.teamwork.com/tasklists#create_list
POST /projects/{project_id}/tasklists.json

Delete a task list
http://developer.teamwork.com/tasklists#delete_a_task_lis
DELETE /tasklists/{id}.json

Reorder lists
http://developer.teamwork.com/tasklists#reorder_lists
PUT /projects/{project_id}/tasklists/reorder.json

Template Task Lists: Get all template task lists
http://developer.teamwork.com/tasklists#template_task_lis
GET /tasklists/templates.json
**/

	
	/*******************************
	 *            TaskList         *
	 *******************************/

	/**
	 * Get a task list
	 *
	 * @param		int			tasklist_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetTaskList = function( tasklist_id, options ){
		return Get(
			BuildPath( 'tasklists/{id}', {id:tasklist_id} ),
			options
		);
	};
	
	/**
	 * Get list of task lists
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectTaskLists = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{project_id}/tasklists', {project_id:project_id} ),
			options
		);
	};

/**
Tasks API Calls
===============

Retrieve all tasks on a task list, project or at top level
http://developer.teamwork.com/todolistitems#retrieve_all_task
GET /tasks.json
GET /projects/{id}/tasks.json
GET /tasklists/{id}/tasks.json

Retrieve a task
http://developer.teamwork.com/todolistitems#retrieve_a_task
GET /tasks/{id}.json

Mark a task complete
http://developer.teamwork.com/todolistitems#mark_a_task_compl
PUT /tasks/{id}/complete.json

Mark a task uncomplete
http://developer.teamwork.com/todolistitems#mark_a_task_uncom
PUT /tasks/{id}/uncomplete.json

Add a task
http://developer.teamwork.com/todolistitems#add_a_task
POST /tasklists/{id}/tasks.json

Edit a task
http://developer.teamwork.com/todolistitems#edit_a_task
PUT /tasks/{id}.json

Destroy a task
http://developer.teamwork.com/todolistitems#destroy_a_task
DELETE /tasks/{id}.json

Reorder the tasks
http://developer.teamwork.com/todolistitems#reorder_the_tasks
PUT /tasklists/{id}/tasks/reorder.json
**/

	/*******************************
	 *            Tasks            *
	 *******************************/

	/**
	 * Get list of tasks
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetTasks = function( options ){
		return Get(
			'tasks',
			options
		);
	};

	/**
	 * Get list of tasks for a task list
	 *
	 * @param		int			tasklist_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetTasklistTasks = function( tasklist_id, options ){
		return Get(
			BuildPath( 'tasklists/{id}/tasks', {id:tasklist_id} ),
			options
		);
	};

	/**
	 * Get list of tasks for a project
	 *
	 * @param		int			project_id
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetProjectTasks = function( project_id, options ){
		return Get(
			BuildPath( 'projects/{id}/tasks', {id:project_id} ),
			options
		);
	};

	


/**
Task Reminders
==============

Get all reminders on a task
http://developer.teamwork.com/taskreminders#get_all_reminders
/tasks/:id/reminders.json

Create a reminder on a task
http://developer.teamwork.com/taskreminders#create_a_reminder
POST /tasks/:id/reminders.json

Update an existing reminder on a task
http://developer.teamwork.com/taskreminders#update_an_existin
PUT /tasks/:id/reminders/:id.json
PUT /taskreminders/:id.json

Delete an existing reminder on a task
http://developer.teamwork.com/taskreminders#delete_an_existin
DELETE /tasks/:id/reminders/:id.json
DELETE /taskreminders/:id.json
**/

/**
Tags
====

List All Tags
http://developer.teamwork.com/tags#list_all_tags
GET /tags.json

Get a single tag
http://developer.teamwork.com/tags#get_a_single_tag
GET /tags/{tag_id}.json

Create a single tag
http://developer.teamwork.com/tags#create_a_single_t
POST /tags.json

Update a single tag
http://developer.teamwork.com/tags#update_a_single_t
PUT /tags/{tag_id}.json

Delete a single tag
http://developer.teamwork.com/tags#delete_a_single_t
DELETE /tags/{tag_id}.json
*/









	
	/*******************************
	 *            Tickets          *
	 *******************************/

	/**
	 * Get list of ticket
	 *
	 * @param		object		options		Options to pass on request
	 *
	 * @return	object			promises	Object with promise methods
	 */
	TeamworkAPI.prototype.GetTicketStatuses = function( options ){
		return Get(
			'desk/v1/ticketstatuses',
			options
		);
	};



	if (typeof exports !== 'undefined') {
		module.exports = TeamworkAPI;
	}

	global.TeamworkAPI = TeamworkAPI;
})(this);
