# teamwork-api
This is intended as a very simple wrapper for the [Teamwork API](http://developer.teamwork.com/), with minimal dependencies.

The wrapper provides a set of functions, one per API endpoint, and simply returns whatever data is returned by the API call. If you're looking for a more fleshed-out wrapper with fully-realised objects for the different resource types then you might be better off trying [this project](https://github.com/bvalosek/teamworkpm-js) by Brandon Valosek (although not all resource types are supported).

Usage
=====

Usage is very simple. Just include the file (you can also `require()` it) and then instantiate a TeamworkAPI object with your API key:

    var tw = new TeamworkAPI( 'ABC123' );

This will immediately fire an initial authorization request, which will (assuming your API key is correct) return the URL that your account uses for API access.

Now you can call a method and it'll return a promise:

    tw.GetCurrentUser().then(
    	// This function will be called on success
    	function( data ){
    			console.log( 'Success' );
    	}
    ).error(
    	// This function will be called on error
    	function( error ){
    			console.log( 'Error' );
    	}
    ).complete
    	// This function will always be called
    	function( data ){
    			console.log( 'Finished' );
    	}
    )

You can add multiple `then()`, `error()` and `complete()` calls, if needed.

Since the methods are based on the various endpoints of the API, you can just refer to the API documentation to find out what can be done. The methods follow a fairly simple naming convention:

\[Get|Create|Update|Delete\]\[ResourceType\]()

...which correspond to the following REST methods referred to in the documentation:

 - Get => Get
 - Create => Post
 - Update => Put
 - Delete => Delete

So for example:

    // Get an existing user
    GetUser(...)
    // Add a new company
    CreateCompany(...)
    // Change a project
    UpdateProject(...)
    // Remove a Task
    DeleteTask(...)

Method arguments
----------------

Some endpoints require one or more arguments within the URL path, for example:

    // Retrieve a project
    /projects/{project_id}.json
    // Retrieve recent comments
     /{resource}/{resource_id}/comments.json

...in these cases, the method will receive those as its initial parameter(s), so:

    // Retrieve a project
    tw.GetProject( 12345 )
    // Retrieve recent comments for a link
    tw.GetComments( 'links', 67890 )

All methods take an optional `options` parameter, which is a plain JavaScript object with key/value pairs specifying any parameters to be sent with a request. These simply match those specified for a given endpoint in the API documentation. So for example, 

    // Retrieve recent comments for a link, by page
    tw.GetComments( 'links', 67890, {page:2,pageSize:10} );

...will retrieve the second page of ten comments. Refer to the API documentation for details of these parameters for a given endpoint.

Dates as parameters
-------------------

For the sake of convenience, if you pass a Date object as an option value, it will automatically be converted to the correct format ('YYYMMDD') for sending with the request.

Dependencies
============

The script has just one dependency, for providing handling AJAX requests: if you're using [jQuery](http://jquery.com) then it'll use that, or if not it'll also work with [qwest](https://github.com/pyrsmk/qwest), which is a very small ajax library. If you have an alternative that you'd like to use, feel free to contact me and I'll see about adding it.

