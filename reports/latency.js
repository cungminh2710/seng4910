const Promise = require('bluebird');
const fs = require('fs');
const speedtest = require('speedtest-net')();
const ipfsAPI = require('ipfs-api');
const moment = require('moment');
const _ = require('lodash');
const {
	lookupPretty
} = require('ipfs-geoip');

// connect to ipfs daemon API server
const ipfs = ipfsAPI('localhost', '5001', {
	protocol: 'http'
});

let getIPFSLatency = () => {
	let getLocation = Promise.promisify(lookupPretty);
	return new Promise((resolve, reject) => {
		ipfs.swarm.peers({
			verbose: true
		}, async(err, peers) => {
			if (err) throw err;
			let data = _.chain(peers)
				// .sortBy((peer) => peer.peer.toB58String())
				.map((peer) => ({
					id: peer.peer.toB58String(),
					latency: (peer.latency === 'n/a') ? null : parseFloat(peer.latency.replace('ms', '')).toFixed(2),
					addr: peer.addr.toString()
				}))
				.orderBy('latency')
				.value();
			// console.log(data, data.length);
			for (let index = 0; index < data.length; index++) {
				// console.log(index);
				let peer = data[index];
				let location;
				try {
					location = await getLocation(ipfs, [peer.addr.toString()]);
				} catch (err) {
					location = 'n/a';
				}	
				// console.log(location);
				data[index].location = location;
			}
			return resolve(data);
		});
	});
}

let getDownloadSpeed = () => {
	return new Promise((resolve) => {
		speedtest.on('downloadspeed', speed => {
			speed = (speed * 125).toFixed(2);
			return resolve(speed);
		});
	});
}
let getUploadSpeed = () => {
	return new Promise((resolve) => {
		speedtest.on('uploadspeed', speed => {
			speed = (speed * 125).toFixed(2);
			return resolve(speed);
		});
	});
}

let run = async() => {
	let promise = await Promise.all([
		getDownloadSpeed(),
		getUploadSpeed(),
		getIPFSLatency()
	]);
	// console.log(promise);
	let data = {
		downloadSpeed: promise[0],
		uploadSpeed: promise[1],
		peers: promise[2]
	}
	return data;
}

run().then(data => fs.writeFileSync('results/_' + moment().format() + '.json', JSON.stringify(data, null, 4)));