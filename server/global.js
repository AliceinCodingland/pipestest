'use strict';

/**
 * CDS Labs module
 * 
 *   Global singleton object
 * 
 * @author David Taieb
 */

var _ = require('lodash');
var events = require('events');

var globalFn = function(){
	//Call constructor from super class
	events.EventEmitter.call(this);
	
	this.appHost = null;
	this.appPort = 0;
	this.getHostName = function(){
		var url = this.appHost || "http://127.0.0.1";
		if ( url.indexOf("://") < 0 ){
			url = "https://" + this.appHost;
		}
		return url;
	};
	this.getHostUrl = function(){		
		var url = this.getHostName();
		if ( this.appPort > 0 ){
			url += ":" + this.appPort;
		}
		return url;
	};
	this.gc = function(){
		if ( global.gc ){
			//Check the memory usage to decide whether to invoke the gc or not
			var mem = process.memoryUsage();
			if ( (mem.heapUsed / mem.heapTotal) * 100 > 80 ){	//Heap is 80% or more filled
				global.gc();
			}			
		}
	};
	this.jsonError = function( res, code, err ){		
		if ( !err ){
			err = code;
		}
		if ( !_.isFinite( code ) ){
			code = 500;
		}
		
		var message = err.message || err.statusMessage || err;
		if ( res.headersSent ){
			console.log("Error could not be sent because response is already flushed: " + message );
			return;
		}
		
		res.status( code ).json({'error': message} );
		return message;
	}
};

//Extend event Emitter
require("util").inherits(globalFn, events.EventEmitter);

//Export the singleton
module.exports = new globalFn();
