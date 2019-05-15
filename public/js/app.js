//App.js:  This file contains the code necessary for basic flow of our application

// Variable declarations for the high level screens of our single page app
const entryDiv = document.querySelector("#Entry")

// Variable declarations for other controls used on the signup pages and necessary for app flow
const showCallID = document.querySelector("#showCallID")
const warning = document.querySelector("#warning")
const invalid = document.querySelector("#invalid")
let roomID

// wait for your friend to arrive
requestFriend.addEventListener('click', ev => {
	
	//The user joins the signaling room in socket.io
	const userName = document.getElementById("Name").value || 'no name'
	roomID = document.getElementById("CallID").value

	if (roomID === ''){  // create a new call
		console.log('New Call')
		io.emit('call', {"user_type": "newcall"})
	}
	else{   // connect to an existing call
		console.log('Existing Call')
		io.emit('signal', {"user_type": "friend", "user_name": userName, "command": "callfriend", "room_id": roomID})
	}

	myName = userName
	
	console.log("user " + userName + " has joined.")
	
	ev.preventDefault()
}, false)

io.on('call', data => {
	roomID = data.room_id
	console.log('Got the room ID:' + roomID)
	// display the call id for the user to see
	entryDiv.style.display = 'none'
	showCallID.style.display = 'block'
	document.getElementById("message").innerHTML += roomID
})

io.on('invalid_id', data => {

	console.log('Invalid ID entered...')
	// show the user that they entered an invalid call id
	warning.style.display = 'block'
	invalid.style.display = 'block'
})
