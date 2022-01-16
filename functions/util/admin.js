const admin = require("firebase-admin");
admin.initializeApp(); //doesn't need parameter as project name is already mentionned in .firebaserc
const db = admin.firestore(); //database

module.exports = {admin, db}; //CommonJS format, used by NodeJS