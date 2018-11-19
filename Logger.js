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
	INFO: "INFO",
	WARN: "WARN",
	ERROR: "ERROR"
};

var Logger = function() {
	 
	//main configs
	var _configs = {
		filePath: null,
		httpOptions: null,
		emailOptions: null
	};

	/**
	 * sets parameters for file writer handler
	 * @param {string} path file path
	 * @param {function} errorCallback error message callback
	 */
	var _setFile = (path, errorCallback) => { 
		if (typeof path !== 'string') {
			errorCallback('log to file parameter must be a string');
		}

		_configs.filePath = path;
	}

	/**
	 * sets parameters for email sender handler
	 * @param {object} configs email service configs
	 * @param {function} errorCallback error message callback
	 */
	var _setEmail = (configs, errorCallback) => {
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
		
		_configs.emailOptions = {
			configs: configs.host,
			port: configs.port,
			secure: configs.secure,
			user: configs.user,
			pass: configs.pass,
			from: configs.from,
			to: configs.to,
			subject: configs.subject
		};
	}

	/**
	 * sets parameters for http sender handler
	 * @param {object} configs host url
	 * @param {function} errorCallback error message callback
	 */
	var _setHttp = (configs, errorCallback) => {
		if (typeof configs !== 'object') { 
			errorCallback('log via http parameter must be an object');
		}

		if (typeof configs.host !== 'string') {
			errorCallback('url parameter must be a string');
		}

		if (typeof configs.port !== 'number') {
			errorCallback('port parameter must be a number');
		}

		if (typeof configs.path !== 'string') {
			errorCallback('path parameter must be a string');
		}

		_configs.httpOptions = {
			host: configs.host,
			port: configs.port,
			path: configs.path
		}
	}

	/**
	 * write log to file
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 */
	var _file = (level, content, now) => { 
		fs.appendFile(_configs.filePath, '[' + now + '] ' + level.toUpperCase() + ': ' + JSON.stringify(content) + '\n', (error) => { 
			if (error) { 
				console.log('[' + now + '] FILE HANDLER ERROR: ' + JSON.stringify(error));
			}
		});
	}

	/**
	 * send http post request to specified api
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 * @param {object} hostInfo local host info
	 */
	var _http = (level, content, now, hostInfo) => {
		var postOptions = {
			hostname: _configs.httpOptions.host,
			port: _configs.httpOptions.port,
			path: _configs.httpOptions.path,
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json'
			}
		};

		var request = https.request(postOptions, (res) => {
			console.log("Response: " + JSON.stringify(resp.statusCode));
		});
		
		request.on('error', (error) => { 
			console.log('[' + now + '] HTTP HANDLER ERROR: ' + JSON.stringify(error));
		});

		request.write(JSON.stringify({
			datetime: now,
			level,
			content,
			host: hostInfo
		}));
	
		request.end();
	}

	/**
	 * send log via email
	 * @param {string} level log level
	 * @param {mixed} content data or message to log
	 * @param {string} now datetime to locale string
	 * @param {object} hostInfo local host info
	 */
	var _email = (level, content, now, hostInfo) => { 
		let transporter = mail.createTransport({
			service: _configs.emailOptions.service,
			auth: {
				host: _configs.emailOptions.host,
				port: _configs.emailOptions.port,
				secure: _configs.emailOptions.secure,
				user: _configs.emailOptions.user,
				pass: _configs.emailOptions.pass
			}
		});

		let parsedHost = JSON.stringify(hostInfo);
		let parsedContent = JSON.stringify(content);

		let mailOptions = {
			from: _configs.emailOptions.from,
			to: _configs.emailOptions.to,
			subject: `${level}: ${_configs.emailOptions.subject}`,
			text: `--------------------------- INFO -------------------------------
			${now}
			---------------------------- HOST ------------------------------
			${parsedHost}
			---------------------------- ERROR ------------------------------
			${parsedContent}`
		}

		transporter.sendMail(mailOptions, (error, info) => { 
			if (error) {
				console.log('[' + now + '] EMAIL HANDLER ERROR: ' + JSON.stringify(error));
			}
		});
	}

	return {
		/**
		 * register handler's parameters
		 * @param {integer} handler choosen LogHandler
		 * @param {mixed} configs file path
		 */
		register: (handler, configs) => {
			try {
				switch (handler) {
					case LogHandler.FILE:
						_setFile(configs, (error) => { 
							throw error;
						});
						break;
					
					case LogHandler.HTTP:
						_setHttp(configs, (error) => { 
							throw error;
						});
						break;
					
					case LogHandler.EMAIL:
						_setEmail(configs, (error) => { 
							throw error;
						});
					break;
				}
			} catch(error){
				let now = (new Date()).toLocaleString();
				console.log('[' + now + '] HANDLER REGISTERING ERROR: ' + JSON.stringify(error));
				process.exit(-2);
			}
		},
	
		/**
		 * Logger main method
		 * @param {string} level log level
		 * @param {mixed} content data or message to log
		 * @param {integer} mode type of log method
		 */
		create: (level, content, mode = 0) => { 
			let now = (new Date()).toLocaleString();
			
			let localHost = {
				hostname: os.hostname(),
				platform: os.type(),
				release: os.release(),
				userInfo: os.userInfo(),
				networkInterfaces: os.networkInterfaces()
			};
	
			//always logs in console
			console.log('[' + now + '] ' + level.toUpperCase() + ': ' + JSON.stringify(content));
		
			if (mode & LogHandler.FILE && _configs.filePath) { 
				_file(level, content, now);
			}
		
			if (mode & LogHandler.EMAIL && _configs.emailOptions) { 
				_email(level, content, now, localHost);
			}
		
			if (mode & LogHandler.HTTP && _configs.httpOptions) {
				_http(level, content, now, localHost);
			}
		}
	}
}

//exports
exports.LogLevel = LogLevel;
exports.LogHandler = LogHandler;
exports.Logger = Logger;