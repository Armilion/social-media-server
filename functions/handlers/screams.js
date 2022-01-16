const { db } = require('../util/admin');

exports.getAllScreams = (request, response) => {
	db
		.collection('screams')
		.orderBy("createdAt", "desc") // last submitted first
		.get()
		.then((data) => {
			let screams = [];
			data.forEach((doc) => {
				screams.push({
					screamId:doc.id,
					body:doc.data().body,
					userHandle:doc.data().userHandle,
					createdAt:doc.data().createdAt,
					userImage:doc.data().userImage,
					likeCount:doc.data().likeCount,
					commentCount:doc.data().commentCount
				}) 
				// or : scream.push(doc.data()) if we don't want the id
				// or with spread operator :  screams.push({
						// screamId:doc.id, 
						// ...doc.data()
					// )}
			})
			return response.json(screams);
		})
		.catch((err) => console.error(err));
}

// ----- EQUIVALENT SANS EXPRESSJS -----
// exports.getScreams = functions.https.onRequest((request, response) => {
// 	admin
// 		.firestore()
// 		.collection('screams')
// 		.get()
// 		.then((data) => {
// 			let screams = [];
// 			data.forEach((doc) => {
// 				screams.push(doc.data());
// 			})
// 			return response.json(screams);
// 		})
// 		.catch((err) => console.error(err));
// });

exports.postAScream = (request, response) => { // Le deuxième paramètre sert de Middleware : il intercepte la requête et selon les paramètres qu'elle doit respecter, il poursuit vers la fonction handler (3ème param) ou il s'en débarasse
	// --- FOLLOWING PART NOT NECESSARY WITH EXPRESS ---
	// if(request.method !== "POST")
	// 	return response.status(400).json({error : "Method not allowed"}); // 400 : Client error
	if(request.body.body.trim() === "")
		return response.status(400).json({body : "Body must not be empty"});

	const newScream = {
		body:request.body.body,
		userHandle:request.user.handle, // userHandle:request.body.userHandle was original parameter, but since the request is first checked by the FBAuth, we added the parameter handle in the request. It is alreayd in the header of the request and does not need to be in the request body anymore
		userImage:request.user.imageURL,
		likeCount:0,
		commentCount:0,
		createdAt:new Date().toISOString() // toISOString() :  converts Date to stream format "2021-02-22T11:40:38.932Z"
	}

	db
		.collection('screams')
		.add(newScream)
		.then(doc => {
			const resScream = newScream;
			resScream.screamId = doc.id;
			return response.json(resScream);
		})
		.catch(err => {
			console.error(err);
			return response.status(500).json(err); // 500 : Internal servor error
		})
}

exports.getScream = (request, response) =>{
	let screamData = {}
	db
		.doc(`/screams/${request.params.screamId}`)
		.get()
		.then(doc => {
			if(!doc.exists){
				return response.status(404).json({error : "Scream not found"});
			}
			screamData = doc.data();
			screamData.screamId = doc.id;
			return db
				.collection("comments")
				.orderBy("createdAt", "desc")
				.where("screamId", "==", request.params.screamId)
				.get(); // we want to get the scream as well as the comments underneath
		})
		.then(data => {
			screamData.comments = [];
			data.forEach((doc) => {
				screamData.comments.push(doc.data());
			})
			return response.json(screamData);
		})
		.catch(err => {
			console.error(err);
			return response.status(500).json(err); // 500 : Internal servor error
		})
}


exports.postComment = (request, response) => {
	if(request.body.body.trim() === "")
		return response.status(400).json({comment : "Must not be empty"});

	let userComment = {
		userHandle : request.user.handle,
		screamId : request.params.screamId,
		body : request.body.body,
		createdAt:new Date().toISOString(),
		userImage:request.user.imageURL
	}

	db
		.doc(`/screams/${request.params.screamId}`)
		.get()
		.then(doc => {
			if(!doc.exists){
				return response.status(404).json({error : "Scream not found"});
			}
			return doc.ref.update({commentCount:doc.data().commentCount+1});
		})
		.then(() => {
			return db.collection("comments").add(userComment);
		})
		.then(() => {
			return response.json(userComment);
		})
		.catch(err => {
			console.error(err);
			return response.status(500).json(err);
		})
}

exports.likeScream = (request, response) => {
	const likedDocument = db
							.collection("likes")
							.where("userHandle", "==", request.user.handle)
							.where("screamId", "==", request.params.screamId)

	const screamDocument = db.doc(`/screams/${request.params.screamId}`)
	let screamData = {};

	screamDocument.get()
	.then(doc => {
		if(!doc.exists)
			return json.status(404).json({error : "Scream not found"});
		screamData = doc.data();
		screamData.screamId = doc.id;
		return likedDocument.get();
	})
	.then(data => {
		if(!data.empty)
			return response.json({error : "Comment already liked"});
		return db
				.collection("likes")
				.add({
					userHandle:request.user.handle,
					screamId:screamData.screamId
				});
	})
	.then(() => {
		screamData.likeCount++;
		return screamDocument
				.update({likeCount:screamData.likeCount});
	})
	.then(doc => {
		return response.json(screamData);
	})
	.catch(err => {
		console.error(err);
		return response.status(500).json(err);
	})

	

}

exports.unlikeScream = (request, response) => {
	const likedDocument = db
							.collection("likes")
							.where("userHandle", "==", request.user.handle)
							.where("screamId", "==", request.params.screamId)
							.limit(1);

	const screamDocument = db.doc(`/screams/${request.params.screamId}`)
	let screamData = {};

	screamDocument.get()
	.then(doc => {
		if(!doc.exists)
			return json.status(404).json({error : "Scream not found"});
		screamData = doc.data();
		screamData.screamId = doc.id;
		return likedDocument.get();
	})
	.then(data => {
		if(data.empty)
			return response.json({error : "Cannot unlike scream"});
		return db
				.doc(`/likes/${data.docs[0].id}`)
				.delete();
	})
	.then(() => {
		screamData.likeCount--;
		return screamDocument
				.update({likeCount:screamData.likeCount});
	})
	.then(doc => {
		return response.json(screamData);
	})
	.catch(err => {
		console.error(err);
		return response.status(500).json(err);
	})
	
}

exports.deleteScream = (request, response) => {
	const screamDocument = db.doc(`/screams/${request.params.screamId}`)
	screamDocument.get()
	.then(doc => {
		if(doc.exists){
			if(doc.data().userHandle === request.user.handle){
				return screamDocument.delete()
				.then(() => {
					return response.json({message : "Scream deleted successfully"});
				})
			}else
				return response.json({error : "Cannot delete the scream : wrong owner"});
		}else
			return response.json({error : "Scream not found"});
	})
	.catch(err => {
		console.error(err);
		return response.status(500).json(err);
	})
}


/*
exports.deleteScream = (request, response) => {
	TODO : DELETE COMMENTS AND LIKES AS CREAM IS DELETED (use batch)
	let batch = db.batch();
	const screamDocument = db.doc(`/screams/${request.params.screamId}`)
	screamDocument.get()
	.then(doc => {
		if(doc.exists){
			if(doc.data().userHandle === request.user.handle){
				batch.delete(doc)
				return db
				.collection("likes")
				.where("screamId", "==", request.params.screamId)
				.get()
			}else
				return response.json({error : "Cannot delete the scream : wrong owner"});
		}else
			return response.json({error : "Scream not found"});
	})
	.then(data => {
		data.forEach(like => {
			batch.delete(like.ref);
		})
		return db
				.collection("comments")
				.where("screamId", "==", request.params.screamId)
				.get()
	})
	.then(data => {
		data.forEach(comment => {
			batch.delete(comment.ref);
		})
		return batch.commit();
	})
	.then(() => {
		return response.json({message : "Scream deleted successfully"});
	})
	.catch(err => {
		console.error(err);
		return response.status(500).json(err);
	})
}
*/