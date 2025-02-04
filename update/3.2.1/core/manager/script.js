import {default as extend } from 'extend';  

function routes (req, res) {
	var cmd   = req.params.plugin;
	var data  = req.query;
	if (req.body) data.body = req.body;

	if (data.waitResponse) data.res = (res) ? res : null;

	if (data.command) {
		let tmpOptions = {action : {}};
		extend(true, tmpOptions.action, data);
		data = tmpOptions;	
	}

	run(cmd, data);
	if (res && !data.waitResponse) res.status(200).end();
}


function run (name, ...args) {

	if (!name) {
		return error(L.get("script.runError"));
	}

	let options, callback;
	for (let n of args) {
		if (typeof n === 'function') callback = n;
		if (typeof n === 'object') options = n;
	}

	// Call script
	call(name, options, callback);
}


async function call (name, ...args) {

	if (!name) {
		return error(L.get("script.runError"));
	}

	let options, callback;
	for (let n of args) {
		if (typeof n === 'function') callback = n;
		if (typeof n === 'object') options = n;
	}
  	if (!options) options = {};

	// Find Plugin
	const plugin = Avatar.find(name);
	if (!plugin){
		error(L.get(["script.callError", name]));
		if (callback) callback();
		return;
	}

	// Set callback
	const next = data => {
		if (data && data.error) {
			error(L.get(["script.callNextError", name, data.error]));
		}
		if (callback) callback(data);
	}

	// Run script
	try {
		const script = await plugin.getInstance();
		script.action(options, next);
	} catch(ex) {
		error(L.get(["script.callNextError", name, ex.message]));
		next();
	}
}


async function initScript () {
	Avatar.run = run;
	Avatar.call = call;
	Avatar.Script = {
		'run' : run,
		'call' : call,
		'routes' : routes
	}
}


export { initScript };

