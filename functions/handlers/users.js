const {db, admin} = require("../util/admin");

const firebaseConfig = require("../util/config");
const firebase = require("firebase");
firebase.initializeApp(firebaseConfig);

const {validateSignUp, validateLogin, reduceUserDetails} = require('../util/validators');

exports.signup = (request, response) => {
	const newUser = {
		email:request.body.email,
		password:request.body.password,
		confirmPassword:request.body.confirmPassword,
		handle:request.body.handle
	}

	const {valid, errors} = validateSignUp(newUser, response);

	if(!valid)
		return response.status(400).json(errors);

	const noImg = 'no-img.png';
	let token, userId;
	db.doc(`/users/${newUser.handle}`).get()
	.then(doc => {
		if(doc.exists){
			response.status(400).json({message : `Error : ${newUser.handle} already exists`})
		}else{
			return firebase
				.auth()
				.createUserWithEmailAndPassword(newUser.email, newUser.password)
		}
	}) // chain returns, then is for the last return (here firebase.auth()...)
	.then(data => {
		userId = data.user.uid;
		return data.user.getIdToken();
	})
	.then(idToken => {
		token = idToken;
		const userCredentials = {
			handle:newUser.handle,
			email:newUser.email,
			createdAt:new Date().toISOString(),
			imageURL:`https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${noImg}?alt=media`,
			userId
		}

		return db.doc(`/users/${newUser.handle}`).set(userCredentials); // create users collection if it doesn't exists
	})
	.then(() => {
		return response.status(201).json({token});
	})
	.catch(err => {
		console.log(err);
		if(err.code === "auth/email-already-in-use")
			return response.status(400).json({email : "Email is already in use"});
		response.status(500).json({error : "Something went wrong, please try again"});
	});

	// --- WITHOUT db.doc() ---
	// firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
	// .then(data => {
	// 	return response.status(201).json({message : `User ${data.user.uid} successfully created`}) // 201 : ressource created
	// })
	// .catch(err => {
	// 	console.log(err);
	// 	response.status(500).json({error : "Something wrent wrong"});
	// });
}

exports.login = (request,response) => {
	const user = {
		email:request.body.email,
		password:request.body.password
	};

	const {valid, errors} = validateLogin(user, response);

	if(!valid)
		return response.status(400).json(errors);

	firebase.auth().signInWithEmailAndPassword(user.email, user.password)
	.then(data => {
		return data.user.getIdToken();
	})
	.then(token => {
		return response.json({token});
	})
	.catch(err => {
		return response.status(403).json({general : "Wrong credentials, please try again"}); // 403 : Unauthorized
	})
}

//Upload image for user
exports.uploadImage = (request, response) => {
	const BusBoy = require("busboy");
	const path = require("path");
	const os = require("os");
	const fs = require("fs");

	const busboy = new BusBoy({headers:request.headers});

	let imageFileName;
	let imageToBeUploaded = {};

	busboy.on('file', (fieldname, file, filename, enconding, mimetype) => {
		if(mimetype !== "image/jpeg" && mimetype !== "image/png")
			return response.status(400).json({error : "Invalid image type"});

		const imageExtension = filename.split(".")[filename.split(".").length - 1]; // image format
		imageFileName = `${Math.round(Math.random()*10000000000)}.${imageExtension}`; 
		const filepath = path.join(os.tmpdir(), imageFileName);
		imageToBeUploaded = {filepath, mimetype};
		file.pipe(fs.createWriteStream(filepath))
	})

	busboy.on("finish", () => {
		admin
		.storage()
		.bucket()
		.upload(imageToBeUploaded.filepath, {
			resumable:false,
			metadata:{
				metadata:{
					contentType:imageToBeUploaded.mimetype
				}
			}
		})
		.then(() => {
			const imageURL = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media` //alt=media : show it in browser instead of downloading it
			return db.doc(`/users/${request.user.handle}`).update({imageURL}); // update : updates a field in a specified collection (add or modify)
		})
		.then(() => {
			return response.json({message : "Image uploaded successfully"});
		})
		.catch(err => {
			console.error(err);
			return response.status(500).json(err);
		})
	})
	busboy.end(request.rawBody);
}

// Add user details
exports.addUserDetails = (request, response) => {
	let userDetails = reduceUserDetails(request.body);

	db.doc(`/users/${request.user.handle}`).update(userDetails)
		.then(() => {
			response.json({message: "Details added successfully"});
		})
		.catch(err => {
			console.error(err);
			response.status(500).json({error : err.code});
		})
}

//Get user details
exports.getAuthenticatedUser = (request, response) => {
	let userData = {};
	db.doc(`/users/${request.user.handle}`).get()
		.then(doc => {
			if(doc.exists){
				userData.credentials = doc.data();
				//return response.json(userData);
				return db.collection("likes").where("userHandle", "==", request.user.handle).get()
			}else{
				return response.status(500).json({error : "User does not exist "});
			}
		})
		.then(data => {
			userData.likes = [];
			data.forEach(doc => {
				userData.likes.push(doc.data())
			});
			return db
					.collection("notifications")
					.where("recipient", "==", request.user.handle)
					.orderBy("createdAt", "desc")
					.get();
		})
		.then(data => {
			userData.notifications = [];
			data.forEach(doc => {
				userData.notifications.push({
					recipient:doc.data().recipient,
					sender:doc.data().sender,
					createdAt:doc.data().createdAt,
					screamId:doc.data().screamId,
					type:doc.data().type,
					read:doc.data().read,
					notificationId:doc.id
				})
			});
			return response.json(userData);
		})
		.catch(err => {
			console.error(err);
			response.status(500).json({error : err});
		})
}

exports.getUserDetails = (request, response) => {
	let userData = {};
	db
		.doc(`/users/${request.params.handle}`)
		.get()
		.then(doc => {
			if(!doc.exists)
				return response.status(404).json({error : `${request.params.handle} does not exist`}); 
			userData.credentials = doc.data();
			return db
					.collection("screams")
					.where("userHandle", "==", request.params.handle)
					.orderBy("createdAt", "desc")
					.get()
		})
		.then(data => {
			userData.screams = [];
			data.forEach(doc => {
				userData.screams.push({
					body:doc.data().body,
					userHandle:doc.data().userHandle,
					userImage:doc.data().userImage,
					likeCount:doc.data().likeCount,
					commentCount:doc.data().commentCount,
					createdAt:doc.data().createdAt,
					screamId:doc.id
				})
			});

			return db
					.collection("likes")
					.where("userHandle", "==", request.params.handle)
					.get()
		})
		.then(data => {
			userData.likes = [];
			data.forEach(doc => {
				userData.likes.push({
					screamId:doc.data().screamId,
					userHandle:doc.data().userHandle,
					likeId:doc.id
				});
			});
			return response.json(userData);
		})
		.catch(err => {
			console.error(err);
			response.status(500).json({error : err});
		})
	}

exports.markNotificationsRead = (request, response) => {
	let batch = db.batch(); // allow to write/modify multiple documents
	request.body.forEach(notificationId => {
		const notification = db.doc(`/notifications/${notificationId}`);
		batch.update(notification, {read : true});
	});
	batch.commit()
	.then(() => {
		return response.json({message : "Notification read"});
	})
	.catch(err => {
		console.error(err);
		response.status(500).json({error : err});
	})

}