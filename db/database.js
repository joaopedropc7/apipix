const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const transactions = new Datastore({ filename: path.join(dataDir, 'transactions.db'), autoload: true });
const logs = new Datastore({ filename: path.join(dataDir, 'logs.db'), autoload: true });
const webhooks = new Datastore({ filename: path.join(dataDir, 'webhooks.db'), autoload: true });

// Auto-compact every hour
transactions.setAutocompactionInterval(3600000);
logs.setAutocompactionInterval(3600000);

module.exports = { transactions, logs, webhooks };
