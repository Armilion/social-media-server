const isEmpty = (str) => {
	if(str.trim() === '')
		return true;
	return false;
}

const isEmail = (email) => {
	const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	if(emailRegEx.test(email))
		return true;
	return false;
}

exports.validateSignUp = (data) => {
	let errors = {};

	if(isEmpty(data.email)) errors.email = "Must not be empty";
	else if(!isEmail(data.email)) errors.email = "Must be a valid email address";

	if(data.password.length < 6) errors.password = "Must be at least 6 characters long";
	if(isEmpty(data.confirmPassword)) errors.confirmPassword = "Must not be empty";
	else if(data.password !== data.confirmPassword) errors.confirmPassword = "Must match password";

	if(isEmpty(data.handle)) errors.handle = "Must not be empty";

	return {
		errors,
		valid: Object.keys(errors).length === 0
	}
}

exports.validateLogin = (data) => {
	let errors = {};

	if(isEmpty(data.email)) errors.email = "Must not be empty";
	if(isEmpty(data.password)) errors.password = "Must not be empty";

	return {
		errors,
		valid: Object.keys(errors).length === 0
	}
}

exports.reduceUserDetails = (data) => {
	let userDetails = {};
	if(!isEmpty(data.bio.trim())) userDetails.bio = data.bio;
	if(!isEmpty(data.website.trim())) userDetails.website = data.website;
	if(!isEmpty(data.location.trim())) userDetails.location = data.location;

	return userDetails;
}