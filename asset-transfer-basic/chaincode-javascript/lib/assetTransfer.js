/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

let logs = [];

class AssetTransfer extends Contract {

    async InitLedger(ctx) {
        const assets = [
            {
                ID: '51H-102.33',
                carCompany: 'BMW',
                type: 'Sport car',
                Owner: 'abc@gmail.com',
                Image: 'abc'
            },
            {
                ID: '51H-102.33',
                carCompany: 'Maybach',
                type: 'Sport car',
                Owner: 'hung@gmail.com',
                Image: 'abc'
            },
        ];

        for (const asset of assets) {
            await ctx.stub.putState(asset.ID, Buffer.from(stringify(sortKeysRecursive(asset))));
        }
    }

    // CreateAsset issues a new asset to the world state with given details.
    async CreateAsset(ctx, id, carCompany, type, owner, image) {
        const exists = await this.AssetExists(ctx, id);
        const txId = ctx.stub.getTxID();
        if (exists) {
            throw new Error(`The asset ${id} already exists`);
        }
        const createAsset = {
            ID: id,
            carCompany : carCompany,
            type : type,
            Owner: owner,
            Image: image
        };
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(createAsset))));
        createAsset.txId = txId
        createAsset.Date = new Date()
        createAsset.Method = 'Create'
        logs.push(createAsset)
        return createAsset;
    }

    // ReadAsset returns the asset stored in the world state with given id.
    async ReadAsset(ctx, id) {
        const assetJSON = await ctx.stub.getState(id); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return assetJSON.toString();
    }

    async ReadAssetByOwner(ctx, owner) {

        let result = await this.GetAllAssets(ctx);

        let allAssets = JSON.parse(result);

        let filtered = allAssets.filter(asset => {
            return asset.Owner === owner;
        });

        return filtered;
    }


    // UpdateAsset updates an existing asset in the world state with provided parameters.
    async UpdateAsset(ctx, id, carCompany, type, owner, img) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }

        // overwriting original asset with new asset
        const updatedAsset = {
            ID: id,
            carCompany: carCompany,
            type: type,
            Owner: owner,
            Image: img
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedAsset))));
        const txId = ctx.stub.getTxID();
        updatedAsset.txId = txId
        updatedAsset.Date = new Date()
        updatedAsset.Method = 'Update'
        logs.push(updatedAsset)
        return JSON.stringify(updatedAsset);
    }

    // DeleteAsset deletes an given asset from the world state.
    async DeleteAsset(ctx, id) {
        const exists = await this.AssetExists(ctx, id);
        if (!exists) {
            throw new Error(`The asset ${id} does not exist`);
        }
        return ctx.stub.deleteState(id);
    }

    // AssetExists returns true when asset with given ID exists in world state.
    async AssetExists(ctx, id) {
        const assetJSON = await ctx.stub.getState(id);
        return assetJSON && assetJSON.length > 0;
    }

    // TransferAsset updates the owner field of asset with given id in the world state.
    async TransferAsset(ctx, id, newOwner) {
        const assetString = await this.ReadAsset(ctx, id);
        const asset = JSON.parse(assetString);
        const oldOwner = asset.Owner;
        asset.Owner = newOwner;
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(asset))));
        return oldOwner;
    }

    // GetAllAssets returns all assets found in the world state.
    async GetAllAssets(ctx) {
        const allResults = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }

    async getTransactionDetails(ctx, txID) {
        const transactionDetailsBuffer = await ctx.stub.getTransactionByID(txID);

        const transactionDetails = JSON.parse(transactionDetailsBuffer.toString());

        return JSON.stringify(transactionDetails);
    }

    async GetLogs() {
        return JSON.stringify(logs);
    }

}

module.exports = AssetTransfer;
