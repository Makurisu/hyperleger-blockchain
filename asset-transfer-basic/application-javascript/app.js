/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { buildCAClient, registerAndEnrollUser, enrollAdmin } = require('../../test-application/javascript/CAUtil.js');
const { buildCCPOrg1, buildWallet } = require('../../test-application/javascript/AppUtil.js');
const express = require('express')
const app = express()

const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'basic';

const mspOrg1 = 'Org1MSP';
const walletPath = path.join(__dirname, 'wallet');
const org1UserId = 'AppUser3';

const create = require("ipfs-http-client")
const fs = require('fs');

async function ipfsClient() {
    const ipfs = await create({ host: 'localhost', port: '5001', protocol: 'http' });
    return ipfs
}

function prettyJSONString(inputString) {
	return JSON.stringify(JSON.parse(inputString), null, 2);
}

async function imgHash(image) {
	let ipfs = await ipfsClient();
    const carImage = await fs.readFileSync(image);
    let result = await ipfs.add(carImage);
    return result.path
}


async function main() {
	try {
		// build an in memory object with the network configuration (also known as a connection profile)
		const ccp = buildCCPOrg1();

		// build an instance of the fabric ca services client based on
		// the information in the network configuration
		const caClient = buildCAClient(FabricCAServices, ccp, 'ca.org1.example.com');

		// setup the wallet to hold the credentials of the application user
		const wallet = await buildWallet(Wallets, walletPath);

		// in a real application this would be done on an administrative flow, and only once
		// await enrollAdmin(caClient, wallet, mspOrg1);

		// await registerAndEnrollUser(caClient, wallet, mspOrg1, org1UserId, 'appuser@gmail.com', 'org1.department1');

		const gateway = new Gateway();

		try {
			// setup the gateway instance
			// The user will now be able to create connections to the fabric network and be able to
			// submit transactions and query. All transactions submitted by this gateway will be
			// signed by this user using the credentials stored in the wallet.
			await gateway.connect(ccp, {
				wallet,
				identity: org1UserId,
				discovery: { enabled: true, asLocalhost: true } // using asLocalhost as this gateway is using a fabric network deployed locally
			});

			// Build a network instance based on the channel where the smart contract is deployed
			const network = await gateway.getNetwork(channelName);

			// Get the contract from the network.
			const contract = network.getContract(chaincodeName);

			// console.log('\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger');
			// await contract.submitTransaction('InitLedger');
			// console.log('*** Result: committed');

			// console.log('\n--> Submit Transaction: CreateAsset, function creates the initial set of assets on the ledger');
			// const imageHash = await imgHash('cry.jpg')
			// console.log(imageHash);
			// await contract.submitTransaction('UpdateAsset', 'asset20', 'abc781', 'abc412', 'Hung', 'aaaaaaa');
			// console.log('*** Result: committed');
			// if (`${result1}` !== '') {
			// 	console.log(`*** Result: ${prettyJSONString(result1.toString())}`);
			// }

			// await contract.submitTransaction('putLogs', JSON.parse(result1));

			// console.log('\n--> Evaluate Transaction: GetAllAssets, function returns all the current assets on the ledger');
			// let result2 = await contract.evaluateTransaction('GetAllAssets');
			// console.log(`*** Result: ${prettyJSONString(result2.toString())}`);

			// console.log('\n--> Submit Transaction: UpdateAsset asset1, change the appraisedValue to 350');
			// await contract.submitTransaction('UpdateAsset', 'asset331', 'blue', '5', 'Tomoko', '350', 'avc');
			// console.log('*** Result: committed');

			// console.log('\n--> Evaluate Transaction: ReadAsset, function returns an asset with a given assetID');
			// let result3 = await contract.evaluateTransaction('GetLogs');
			// console.log(`*** Result: ${prettyJSONString(result3.toString())}`);

			// let logs = JSON.parse(result3)
			// let filtered = logs.filter(asset => {
			// 	return asset.ID === 'abc342';
			// });

			// console.log(filtered);

			// let result4 = await contract.evaluateTransaction('UpdateAsset', 'asset1', 'BMW', 'Sport car', 'Tomoko', '');
			// console.log(result4.toString());

			// let result = await contract.evaluateTransaction('ReadAssetByOwner', 'Tomoko');
			// console.log(`*** Result: ${prettyJSONString(result.toString())}`);

			const folderPath = 'wallet';
			const fileName = 'bhung342@gmail.com'; 
			const fullPath = `${folderPath}/${fileName}.id`;

			fs.readFile(fullPath, 'utf8', (err, data) => {
				if (err) {
				  console.error(err);
				  return;
				}
				const jsonData = JSON.parse(data)
				const cleanedPrivateKey = jsonData.credentials.privateKey.replace('-----BEGIN PRIVATE KEY-----', '')
																		.replace(/\r\n/g, '')
																		.replace('-----END PRIVATE KEY-----', '')
				console.log(cleanedPrivateKey.toString());
				if('MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgeboFZY2gmqGNy22LmSAMV6l7+A5UkWyiDm9h+yvvOiShRANCAATE0Fih6luOez52dfj15WWkcB5dzIaL3YxjWnYclA4YSOQ9uwH2bDaHJF8VyVNw/FsC4Fx3WXU8p9+ru1RCUOsq' == cleanedPrivateKey.toString())
				{
					console.log('True')
				}
			  });
			  

		}
		catch (error) {
			console.log(`*** Successfully caught the error: \n    ${error}`);
		}
	} catch (error) {
		console.error(`******** FAILED to run the application: ${error}`);
		process.exit(1);
	}
}


main();
