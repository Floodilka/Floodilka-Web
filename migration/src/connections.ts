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
