const functions = require("firebase-functions");

const {db} = require("./util/admin.js");
const app = require('express')();
// Equivaut à :
// const express = require('express');
// const app = express();

const {getAllScreams, postAScream, getScream, postComment, likeScream, unlikeScream, deleteScream} = require("./handlers/screams");
const {signup, login, uploadImage, addUserDetails, getAuthenticatedUser, getUserDetails, markNotificationsRead} = require("./handlers/users");
const {FBAuth} = require("./util/fbAuth");


// Scream routes
app.get('/scream', getAllScreams);
app.post('/scream', FBAuth, postAScream);
app.get("/scream/:screamId", getScream); // ":" allow to specify a parameter that we don't know yet but which we will be able to call and use later 
app.post("/scream/:screamId/comment", FBAuth, postComment)
app.get("/scream/:screamId/like", FBAuth, likeScream);
app.get("/scream/:screamId/unlike", FBAuth, unlikeScream);
app.delete("/scream/:screamId", FBAuth, deleteScream);

//Sign up Route 
app.post('/signup', signup);

// Login route
app.post("/login", login);

app.post("/user/image", FBAuth, uploadImage);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

exports.api = functions.region('europe-west1').https.onRequest(app); // route is api/screams, first parameter in the post and get parameter
// region('europe-west1') forces firebase to deploy functions on an european server

//enable users : firebase => authentication => enable email/password

exports.createNotificationOnLike = functions.region('europe-west1').firestore.document('likes/{id}')
	.onCreate((snapshot) => {
		return db
			.doc(`/screams/${snapshot.data().screamId}`)
			.get()
			.then(doc => {
			if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){ // second condition avoid sending notifications to oneself
				return db.doc(`/notifications/${snapshot.id}`)
				.set({
						createdAt:new Date().toISOString(),
						recipient:doc.data().userHandle, // scream document
						sender:snapshot.data().userHandle, // like document
						read:false,
						screamId:doc.id,
						type:"like"
					})
				}
			})
		.catch(err => {
			console.error(err);
			return;
		});
	})

exports.deleteNotificationOnLike = functions.region('europe-west1').firestore.document('likes/{id}')
	.onDelete((snapshot) => {
		return db.doc(`/notifications/${snapshot.id}`)
		.delete()
		.catch(err => {
			console.error(err);
			return;
		})
});

exports.createNotificationOnComment = functions.region('europe-west1').firestore.document('comments/{id}')
	.onCreate((snapshot) => {
		return db.doc(`/screams/${snapshot.data().screamId}`)
		.get()
		.then(doc => {
			if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
				return db.doc(`/notifications/${snapshot.id}`)
				.set({
					createdAt:new Date().toISOString(),
					recipient:doc.data().userHandle, // scream document
					sender:snapshot.data().userHandle, // comment document
					read:false,
					screamId:doc.id,
					type:"comment"
				})
			}
		})
		.catch(err => {
			console.error(err);
			return;
		})

	})

exports.onUserImageChange = functions.region("europe-west1").firestore.document("users/{userId}")
	.onUpdate((change) => {
		if(change.before.data().imageURL !== change.after.data().imageURL){
			let batch = db.batch();
			return db
					.collection("screams")
					.where("userHandle", "==", change.before.data().handle)
					.get()
			.then(data => {
				data.forEach(doc => {
					const scream = db.doc(`/screams/${doc.id}`);
					batch.update(scream, {userImage : change.after.data().imageURL});
				})
				return db
						.collection("comments")
						.where("userHandle", "==", change.before.data().handle)
						.get()
			})
			.then(data => {
				data.forEach(doc => {
					const comment = db.doc(`/comments/${doc.id}`);
					batch.update(comment, {userImage : change.after.data().imageURL});
				})
				return batch.commit();
			})
			.then(() => {
				return;
			})
			.catch(err => {
				console.error(err);
				return;
			});
		}else return true; // in case the user changes his bio but not his user image
	});

exports.onScreamDelete = functions.region("europe-west1").firestore.document("screams/{screamId}")
	.onDelete((snapshot, context) => {
		const screamId = context.params.screamId;
		const batch = db.batch();
		return db
				.collection("comments")
				.where("screamId", "==", screamId)
				.get()
		.then(data => {
			data.forEach(doc => {
				comment = db.doc(`/comments/${doc.id}`);
				batch.delete(comment);
			})
			return db
					.collection("likes")
					.where("screamId", "==", screamId)
					.get()
		})
		.then(data => {
			data.forEach(doc => {
				like = db.doc(`/likes/${doc.id}`);
				batch.delete(like);
			})
			return db
					.collection("notifications")
					.where("screamId", "==", screamId)
					.get()
		})
		.then(data => {
			data.forEach(doc => {
				notification = db.doc(`/notifications/${doc.id}`);
				batch.delete(notification);
			})
			return batch.commit();
		})
		.then(() => {
			return;
		})
		.catch(err => {
			console.error(err);
			return;
		});
	})