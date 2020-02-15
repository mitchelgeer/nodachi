const _ = require("lodash");
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const https = require("https");
const request = require("request");

/**
 * An Apache alternative for the aspiring Node.js developer.
 * (Please find something better than this, and then tell me it exists)
 */
class Nodachi {
	/**
	 * Express.JS app instance for port 80
	 * @type {Express.App}
	 */
	httpServer;

	/**
	 * Express.JS app instance for port 443
	 * @type {Express.App}
	 */
	httpsServer;

	/**
	 * Loaded config file.
	 * @type {Object}
	 */
	config;

	/**
	 * Constructor
	 * @param {config} config Configuration object
	 */
	constructor(config) {
		this.config = config;

		// init servers
		this.httpServer = this.initHTTP();
		this.httpsServer = this.initHTTPS();

		// init server routes
		this.initRoutes();
	}

	/**
	 * Initializes an HTTP server.
	 * @return {Express.App} HTTP server
	 */
	initHTTP() {
		// prepare express server
		let app = express();

		// listen
		app.listen(80);

		// return server
		return app;
	}

	/**
	 * Initializes an HTTPS server.
	 * @return {Express.App} HTTPS server instance
	 */
	initHTTPS() {
		// prepare express server
		let app = express();

		// enable CORS
		app.use(cors());

		// parse URL-encoded bodies (as sent by HTML forms)
		app.use(
			express.urlencoded({
				extended: true
			})
		);

		// parse JSON bodies (as sent by API clients)
		app.use(express.json());

		// server config
		let options = {
			key: fs.readFileSync(this.config.https.keys.private),
			cert: fs.readFileSync(this.config.https.keys.public)
		};

		// listen
		https.createServer(options, app).listen(443);

		// return server
		return app;
	}

	/**
	 * Initializes server routes.
	 * @param {Express.App} unsecure HTTP server
	 * @param {Express.App} secure HTTPS server
	 */
	initRoutes(unsecure, secure) {
		_.each(this.config.routes, route => {
			this.initRoute(route);

			if (route.settings.secure) {
				this.initSecureRedirect(route);
			}
		});
	}

	/**
	 * Initializes a single server route.
	 * @param {Object} route
	 */
	initRoute(route) {
		let app = route.settings.secure ? this.httpsServer : this.httpServer;

		if (route.settings.type === "dynamic") {
			// dynamic route (web server)

			// establish forwarding
			app.all(`${route.path.from}`, (req, res, next) => {
				let localTarget = req.path.slice(
					route.path.from.replace(/\*$/, "").length
				);
				let queryKeys = _.map(
					Object.keys(req.query),
					k => `${k}=${req.query[k]}`
				).join("&");
				let strGet = queryKeys.length > 0 ? `?${queryKeys}` : "";
				let targetPath = `${route.path.to}${localTarget}${strGet}`;

				// make proxied request
				request(
					{
						method: req.method,
						uri: targetPath,
						form: req.body
					},
					(error, response, body) => {
						if (error) {
							res.redirect("/");
						} else {
							res.send(body);
						}
					}
				);
			});
		} else if (route.settings.type === "static") {
			// static route (static files)
			app.use(route.path.from, express.static(route.path.to));
		}
	}

	/**
	 * Initializes a redirect route.
	 * @param {Object} route
	 */
	initSecureRedirect(route) {
		let app = this.httpServer;

		// redirect traffic to the secured page
		app.all(`${route.path.from}`, (req, res, next) => {
			res.redirect("https://" + req.headers.host + req.url);
		});
	}
}

module.exports = Nodachi;
