//const configs = require('./config.js');
var fs = require('fs');
var mail = require('nodemailer');
var os = require('os');
var https = require('https');

//log modes
const LogHandler = {
	FILE: 1 << 0,
	EMAIL: 1 << 1,
	HTTP: 1 << 2
};

//log levels
const LogLevel = {
    DEBUG: [0, "DEBUG"],
	INFO: [1, "INFO"],
	WARN: [2, "WARN"],
	ERROR: [3, "ERROR"]
};

var Logger = function(projectId = null) {
	
	//main configs
	var _projectId = projectId;
	var _configs = {
		file: {
			enabled: false,
			path: null,
			levelTrigger: null
		},
		http: {
			enabled: false,
			options: null,
			levelTrigger: null
		},
		email: {
			enabled: false,
			options: null,
			levelTrigger: null,
		}
	};

	/**
	 * sets parameters for file writer handler
	 * @param {string} path file path
	 * @param {function} errorCallback error message callback
	 */
	var _setFile = (path, levelTrigger, errorCallback) => { 
		if (typeof path !== 'string') {
			errorCallback('log to file parameter must be a string');
		}

		_configs.file.path = path;
		_configs.file.levelTrigger = levelTrigger;
		_configs.file.enabled = true;
	}

	/**
	 * sets parameters for email sender handler
	 * @param {object} configs email service configs
	 * @param {function} errorCallback error message callback
	 */
	var _setEmail = (configs, levelTrigger, errorCallback) => {
		if (typeof configs !== 'object') { 
			errorCallback('log to email parameter must be an object');
		}
		
		if (typeof configs.port !== 'number') {
			errorCallback('port must be a number');
		}

		if (typeof configs.secure !== 'boolean') { 
			errorCallback('secure must be a boolean');
		}

		if (typeof configs.user !== 'string') { 
			errorCallback('user must be a string');
		}

		if (typeof configs.pass !== 'string') { 
			errorCallback('pass must be a string');
		}

		if (typeof configs.from !== 'string') { 
			errorCallback('from must be a string');
		}

		if (typeof configs.to !== 'string') { 
			errorCallback('to must be a string');
		}

		if (typeof configs.subject !== 'string') { 
			errorCallback('subject must be a string');
		}
		
		_configs.email.options = {
			configs: configs.host,
			port: configs.port,
			secure: configs.secure,
			user: configs.user,
			pass: configs.pass,
			from: configs.from,
			to: configs.to
		};
		_configs.email.levelTrigger = levelTrigger;
		_configs.email.enabled = true;
	}

	/**
	 * sets parameters for http sender handler
	 * @param {object} configs host url
	 * @param {function} errorCallback error message callback
	 */
	var _setHttp = (configs, levelTrigger, errorCallback) => {
		if (typeof configs !== 'object') { 
			errorCallback('log via http parameter must be an object');
		}

		if (typeof configs.host !== 'string') {
			errorCallback('url parameter must be a string');
		}

		if (typeof configs.port !== 'undefined') {
			if (typeof configs.port !== 'number') {
				errorCallback('port parameter must be a number');
			}
		}

		if (typeof configs.path !== 'string') {
			errorCallback('path parameter must be a string');
		}

		_configs.http.options = {
			host: configs.host,
			path: configs.path
		}

		if (configs.port !== 'undefined') { 
			_configs.http.options.port = configs.port;
		}
		_configs.http.levelTrigger = levelTrigger;
		_configs.http.enabled = true;
	}

	/**
	 * write log to console
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 */
	var _console = (level, content, now, description = "") => {
	    let levelName = level[1].toUpperCase();
        switch (level) { 
			case LogLevel.INFO:
				console.info(`[${now}] ${levelName}: ${description ? description + ' ' : ''}` + JSON.stringify(content));
				break;
			case LogLevel.WARN:
				console.warn(`[${now}] ${levelName}: ${description ? description + ' ' : ''}` + JSON.stringify(content));
				break;
			case LogLevel.ERROR:
				console.error(`[${now}] ${levelName}: ${description ? description + ' ' : ''}` + JSON.stringify(content));
				break;
			case LogLevel.DEBUG:
				console.debug(`[${now}] ${levelName}: ${description ? description + ' ' : ''}` + JSON.stringify(content));
				break;
			default:
				console.log(`[${now}] ${levelName}: ${description ? description + ' ' : ''}` + JSON.stringify(content));
		}
	}

	/**
	 * write log to file
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 */
	var _file = (level, content, now) => { 
	    if(_configs.file.enabled && level[0] >= _configs.file.levelTrigger) {
		    if (!_configs.file.path) { 
			    _console(LogLevel.WARNING, 'file handler not configured yet', now, 'file handler');
			    return;
		    }

		    fs.appendFile(_configs.file.path, '[' + now + '] ' + level[1].toUpperCase() + ': ' + JSON.stringify(content) + os.EOL, (error) => { 
			    if (error) { 
				    _console(LogLevel.ERROR, error, now, 'file handler');
			    }
		    });
		}
	}

	/**
	 * send http post request to specified api
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 * @param {object} hostInfo local host info
	 */
	var _http = (level, content, now, hostInfo) => {
		if(_configs.http.enabled && level[0] >= _configs.http.levelTrigger) {
		    if (!_configs.http.options) { 
			    _console(LogLevel.WARNING, 'file handler not configured yet', now, 'file handler');
			    return;
		    }
		    
		    var postOptions = {
			    host: _configs.http.options.host,
			    path: _configs.http.options.path,
			    method: 'POST',
			    headers: {
				    'Accept': 'application/json',
				    'Content-Type': 'application/json'
			    }
		    };

		    if (typeof _configs.http.options.port !== 'undefined') { 
			    postOptions.port = _configs.http.options.port;
		    }

		    var request = https.request(postOptions);
		    
		    request.on('error', (error) => { 
			    _console(LogLevel.ERROR, error, now, 'http handler');
		    });
		    
		    let log = {
			    datetime: now,
			    level: level[1].toUpperCase(),
			    content,
			    host: hostInfo,
		    };
		    
		    if(content instanceof Error) {
			    log.backtrace = content.stack;
			    log.content = content.message;
		    }
		    
		    request.write(JSON.stringify(log));
	    
		    request.end();
		}
	}

	/**
	 * send log via email
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 * @param {object} hostInfo local host info
	 */
	var _email = (level, content, now, hostInfo) => { 
	    if(_configs.email.enabled && level[0] >= _configs.email.levelTrigger) {
		    if (!_configs.email.options) { 
			    _console(LogLevel.WARNING, 'file handler not configured yet', now, 'file handler');
			    return;
		    }

		    let transporter = mail.createTransport({
			    host: _configs.email.options.host,
			    port: _configs.email.options.port,
			    secure: _configs.email.options.secure,
			    auth: {
				    user: _configs.email.options.user,
				    pass: _configs.email.options.pass
			    }
		    });

		    let parsedHost = JSON.stringify(hostInfo);
		    let parsedContent = JSON.stringify(content);

		    let mailOptions = {
			    from: _configs.email.options.from,
			    to: _configs.email.options.to,
			    subject: _projectId ? _projectId + ' ' : '' + `${level[1].toUpperCase()} Message from Logger`,
			    text: `--------------------------- INFO -------------------------------
			    datetime:\t${now}
			    projectId:\t${_projectId}
			    ---------------------------- HOST ------------------------------
			    ${parsedHost}
			    ---------------------------- ERROR ------------------------------
			    ${parsedContent}`
		    }

		    transporter.sendMail(mailOptions, (error, resp) => { 
			    if (error) {
				    _console(LogLevel.ERROR, error, now, 'email handler');
			    }
		    });
		}
	}

	return {
		/**
		 * register handler's parameters
		 * @param {integer} handler choosen LogHandler
		 * @param {mixed} configs file path
		 */
		register: (handler, configs, levelTrigger = LogLevel.INFO) => {
			try {
				switch (handler) {
					case LogHandler.FILE:
						_setFile(configs, levelTrigger, error => { throw error; });
					break;
					
					case LogHandler.HTTP:
					_setHttp(configs, levelTrigger, error => { throw error; });
					break;
					
					case LogHandler.EMAIL:
					_setEmail(configs, levelTrigger, error => { throw error; });
					break;
				}
			} catch(error){
				let now = (new Date()).toLocaleString();
				_console(LogLevel.ERROR, error, now, 'handlers registerer');
				process.exit(-2);
			}
		},
	
		/**
		 * Logger main method
		 * @param {array} level log level
		 * @param {mixed} content data or message to log
		 * @param {integer} mode type of log method
		 */
		create: (level, content, mode = 0) => { 
		    let now = (new Date()).toLocaleString('en-GB');
		    
		    let localHost = {
			    hostname: os.hostname(),
			    platform: os.type(),
			    release: os.release(),
			    userInfo: os.userInfo(),
			    networkInterfaces: os.networkInterfaces()
		    };
    
			_console(level, content, now);
			_file(level, content, now);
		    _email(level, content, now, localHost);
			_http(level, content, now, localHost);
        }
	}
}

//exports
exports.LogLevel = LogLevel;
exports.LogHandler = LogHandler;
exports.Logger = Logger;
