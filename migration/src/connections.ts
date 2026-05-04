/*
 * Copyright (C) 2020-2026 Fluxer Contributors
 * Copyright (C) 2026 Floodilka Contributors
 *
 * This file is part of Floodilka, a fork of Fluxer
 * (https://github.com/fluxerapp/fluxer).
 * Modified by Floodilka Contributors starting March 2026.
 *
 * Floodilka is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Floodilka is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Floodilka. If not, see <https://www.gnu.org/licenses/>.
 */

import {MongoClient, type Db} from 'mongodb';
import cassandra from 'cassandra-driver';
import {S3Client} from '@aws-sdk/client-s3';
import {config} from './config.js';

let mongoClient: MongoClient;
let mongoDB: Db;
let cassandraClient: cassandra.Client;
let s3Client: S3Client;

export async function connect() {
	console.log('Connecting to MongoDB...');
	mongoClient = new MongoClient(config.mongo.uri);
	await mongoClient.connect();
	mongoDB = mongoClient.db();
	console.log(`  Connected to MongoDB: ${mongoDB.databaseName}`);

	console.log('Connecting to Cassandra...');
	cassandraClient = new cassandra.Client({
		contactPoints: config.cassandra.hosts,
		protocolOptions: {port: config.cassandra.port},
		localDataCenter: config.cassandra.localDc,
		keyspace: config.cassandra.keyspace,
		credentials: {
			username: config.cassandra.username,
			password: config.cassandra.password,
		},
		encoding: {
			useBigIntAsLong: true,
			useBigIntAsVarint: true,
		},
	});
	await cassandraClient.connect();
	console.log(`  Connected to Cassandra: ${config.cassandra.keyspace}`);

	if (config.s3.accessKeyId) {
		s3Client = new S3Client({
			endpoint: config.s3.endpoint,
			region: 'ru-1',
			credentials: {
				accessKeyId: config.s3.accessKeyId,
				secretAccessKey: config.s3.secretAccessKey,
			},
			forcePathStyle: true,
		});
		console.log('  S3 client initialized');
	} else {
		console.log('  S3 credentials not provided, icon upload will be skipped');
	}
}

export async function disconnect() {
	await mongoClient?.close();
	await cassandraClient?.shutdown();
	console.log('Disconnected from all databases.');
}

export function getMongo(): Db {
	return mongoDB;
}

export function getCassandra(): cassandra.Client {
	return cassandraClient;
}

export function getS3(): S3Client {
	return s3Client;
}
