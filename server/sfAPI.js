'use strict';

/**
*	Endpoints for managing access to salesforce APIs
*	@Author: David Taieb
*/

var sf = require('./sf');
var _ = require('lodash');
var async = require('async');
var pipeDb = require('./pipeStorage');
var global = require("./global");

module.exports = function( app ){
	app.get("/authCallback", function( req, res ){
		var code = req.query.code;
		var state = JSON.parse( req.query.state);
		var pipeId = state.pipe;
		
		console.log("AuthCallback called with return url : " + state.url );
		
		if ( !code || !pipeId ){
			return global.jsonError( res, "No code or state specified in OAuth callback request");
		}
		
		console.log("OAuth callback called with pipe id: " + pipeId );
		var sfObject = new sf( pipeId );
		
		sfObject.authorize(code, function(err, userInfo, jsForceConnection, pipe ){
			if (err) { 
				return res.type("html").status(401).send("<html><body>" +
						"Authentication error: " + err +
						"</body></html>");
			}
			
			var tables = [];
			async.series([
				function( done ){
					jsForceConnection.describeGlobal(function(err, res) {
						if (err) { 
							return done(err); 
						}
						for ( var i=0; i < res.sobjects.length; i++){
							if ( res.sobjects[i].createable ){
								tables.push( res.sobjects[i] );
							}
						}
						return done(null);
					});
				},
				function( done ){
					async.map( tables, function( sobject, done ){
						jsForceConnection.sobject( sobject.name).describe( function( err, meta){
							if ( err ){
								return done( err );
							}
							if ( _.isArray( meta.recordTypeInfos ) && meta.recordTypeInfos.length > 0 ){
								return done( null, meta );
							}
							return done( null, null );
						});
					}, function( err, results){
						if ( err ){
							return done( err );
						}
						tables = _.remove( results, function( v ){
							return v != null;
						});
						return done(null);
					});
				}
			], function( err, results ){
				if ( err ){
					return global.jsonError( res, err );
				}
				
				for ( var i = 0 ; i < tables.length; i++ ){
					console.log( tables[i].name + " : " + tables[i].labelPlural );
				}

				pipe.tables = tables;
				pipe.sf = {
						accessToken: jsForceConnection.accessToken,
						refreshToken: jsForceConnection.refreshToken,
						instanceUrl: jsForceConnection.instanceUrl,
						userId: userInfo.id,
						orgId: userInfo.organizationId
				};

				//Save the pipe
				pipeDb.savePipe( pipe, function( err, data ){
					if ( err ){
						return global.jsonError( res, err );
					}

					res.redirect(state.url);
				})
				
			});
		});
	});
	
	app.get("/sf/:id", function( req, res){
		var sfConnection = new sf( req.params.id );
		sfConnection.connect( req, res, req.query.url, function (err, results ){
			if ( err ){
				return global.jsonError( res, err );
			}
			return res.json( results );
		});
	});
	
	/**
	 * Start a new pipe run
	 */
	app.post("/sf/:id", function( req, res ){
		var sfConnection = new sf( req.params.id );
		sfConnection.run( function( err, run ){
			if ( err ){
				return global.jsonError( res, err );
			}
			//Return a 202 accepted code to the client with information about the run
			return res.status( 202 ).json( run.getId() );
		});
	});
	
	global.on("runScheduledEvent", function( pipeId){
		var sfConnection = new sf( pipeId );
		sfConnection.run( function( err, run ){
			if ( err ){
				return console.log("Unable to execute a scheduled run for pipe %s", pipeId);
			}
			console.log('New Scheduled run started for pipe %s', pipeId);
		});
	})
}