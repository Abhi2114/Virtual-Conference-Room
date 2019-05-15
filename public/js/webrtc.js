// webrtc.js:  This is where we will put the bulk of the webrtc related code

////////SIGNALING CODE/////////////
io = io.connect()
let myName = ""
let theirName = ""
let myUserType = ""
const configuration = {
	iceServers: [{
		// using public google STUN servers
		urls: 'stun:stun.l.google.com:19302'
	}]
}
let rtcPeerConn
const mainVideoArea = document.querySelector("#mainVideoTag")
const smallVideoArea = document.querySelector("#smallVideoTag")
/*
const dataChannelOptions = {
	ordered: false, //no guaranteed delivery, unreliable but faster 
	maxPacketLifeTime: 1000, //milliseconds
};
*/
const dataChannelOptions = {
	ordered: true, //slow, but reliable 
}

let dataChannel
const CHUNK_SIZE = 16384  // chunk size is 16384 bytes

io.on('signal', data => {

	if (data.user_type == "friend" && data.command == "joinroom") {
		// get a peer connection offer to join the chat
		console.log("Your friend is here!")
		theirName = data.user_name
		document.querySelector("#landingPage").style.display = 'none'
		document.querySelector("#messageOutName").textContent = theirName
		document.querySelector("#messageInName").textContent = myName
		document.querySelector("#videoPage").style.display = 'block'
	}
	else if (data.user_type == "friend" && data.command == "callfriend") {
		// the other user has also come online
		// initiate a peer connection
		console.log("Friend is calling");
		if (!rtcPeerConn) startSignaling(true)
		theirName = data.user_name
		document.querySelector("#landingPage").style.display = 'none'
		document.querySelector("#messageOutName").textContent = theirName
		document.querySelector("#messageInName").textContent = myName
		document.querySelector("#videoPage").style.display = 'block'
		io.emit('signal', {"user_type": "friend", "user_name": myName, "command": "joinroom", "room_id": roomID})
	}
	else if (data.user_type == 'signaling') {
		if (!rtcPeerConn) startSignaling(false)

		const message = JSON.parse(data.user_data)
		if (message.sdp) {

			rtcPeerConn.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
				// if we received an offer, we need to answer
				if (rtcPeerConn.remoteDescription.type == 'offer') {
					rtcPeerConn.createAnswer().then(sendLocalDesc).catch(logError)
				}
			}, logError)
		}
		else {
			rtcPeerConn.addIceCandidate(new RTCIceCandidate(message.candidate))
		}
	}
}); 

const startSignaling = offer => {
	console.log("starting signaling...")
	rtcPeerConn = new RTCPeerConnection(configuration)
	
	// setup a data channel for sending messages/data peer to peer
	dataChannel = rtcPeerConn.createDataChannel('data_channel', dataChannelOptions)
	
	dataChannel.onopen = dataChannelStateChanged
	rtcPeerConn.ondatachannel = receiveDataChannel

	// send any ice candidates to the other peer
	rtcPeerConn.onicecandidate = evt => {
		if (evt.candidate){
			io.emit('signal',
					{"user_type": "signaling", 
					"command": "icecandidate", 
					"user_data": JSON.stringify({ 'candidate': evt.candidate }), 
					"room_id": roomID})
		}
	}
	
	// let the 'negotiationneeded' event trigger offer generation
	rtcPeerConn.onnegotiationneeded = () => {
		console.log("on negotiation called")
		// beware of the glare issue of webRTC
		if (offer)
			rtcPeerConn.createOffer().then(sendLocalDesc).catch(logError)
	}
	
	// once remote stream arrives, show it in the main video element
	rtcPeerConn.ontrack = evt => {
		console.log("going to add their stream...")
		mainVideoArea.srcObject = evt.streams[0]
	}
	
	// get a local stream, show it in our video tag and add it to be sent
	navigator.mediaDevices.getUserMedia({
		'audio': true,
		'video': true
	}).then(stream => {
		console.log("going to display my stream...")
		smallVideoArea.srcObject = stream
		// send the stream to the remote peer
		stream.getTracks().forEach(track => {
			rtcPeerConn.addTrack(track, stream)
		})
	}).catch(error => {
		console.log(error)
	})

}

const sendLocalDesc = desc => {
	rtcPeerConn.setLocalDescription(desc).then(() => {
		io.emit('signal',
			{"user_type":"signaling", 
			"command":"SDP", 
			"user_data": JSON.stringify({ 'sdp': rtcPeerConn.localDescription }), 
			"room_id": roomID})
	}).catch(logError)
}

const logError = error => {
	console.log(error)
}

//////////MUTE/PAUSE STREAMS CODE////////////
const muteMyself = document.querySelector("#muteMyself");
const pauseMyVideo = document.querySelector("#pauseMyVideo");

muteMyself.addEventListener('click', ev => {
	console.log("muting/unmuting myself")

	const streams = rtcPeerConn.getLocalStreams()
	for (let stream of streams) {
		for (let audioTrack of stream.getAudioTracks()) {
			if (audioTrack.enabled) 
				muteMyself.innerHTML = "Unmute"
			else 
				muteMyself.innerHTML = "Mute Myself"
			
			audioTrack.enabled = !audioTrack.enabled
		}
		console.log("Local stream: " + stream.id)
	}
	ev.preventDefault();
}, false);

pauseMyVideo.addEventListener('click', ev => {
	console.log("pausing/unpausing my video")

	const streams = rtcPeerConn.getLocalStreams()
	for (let stream of streams) {
		for (let videoTrack of stream.getVideoTracks()) {
			if (videoTrack.enabled) 
				pauseMyVideo.innerHTML = "Start Video"
			else 
				pauseMyVideo.innerHTML = "Pause Video"
			
			videoTrack.enabled = !videoTrack.enabled
		}
		console.log("Local stream: " + stream.id)
	}
	ev.preventDefault();
}, false);

///////////// Data Channels Code ///////////

const messageHolder = document.querySelector("#messageHolder")
const myMessage = document.getElementById("myMessage")
const sendMessage = document.querySelector("#sendMessage")
let receivedFileName, receivedFileSize
let fileBuffer = []
let currentBlocks = 0
let fileTransferring = false

const dataChannelStateChanged = () => {
	if (dataChannel.readyState === 'open') {
		console.log("Data Channel open")
		dataChannel.onmessage = receiveDataChannelMessage
	}
}

const receiveDataChannel = (event) => {
	console.log("Receiving a data channel")
	dataChannel = event.channel
	dataChannel.onmessage = receiveDataChannelMessage
}

const receiveDataChannelMessage = (event) => {
	console.log("From DataChannel: " + event.data)

	if (fileTransferring) {
		//Now here is the file handling code:
		fileBuffer.push(event.data)
		currentBlocks += 1
		fileProgress.value = currentBlocks * CHUNK_SIZE
		
		//Provide link to downloadable file when complete
		if (currentBlocks === Math.ceil(receivedFileSize / CHUNK_SIZE)) {
			const received = new window.Blob(fileBuffer)

			downloadLink.href = URL.createObjectURL(received)
			downloadLink.download = receivedFileName
			downloadLink.appendChild(document.createTextNode(receivedFileName + "(" + currentBlocks + ") blocks"))
			
			// reset all variables
			fileBuffer = []
			currentBlocks = 0
			fileProgress.value = 1
			fileTransferring = false
		
			// Also put the file in the text chat area
			const linkTag = document.createElement('a')
			linkTag.href = URL.createObjectURL(received)
			linkTag.download = receivedFileName
			linkTag.appendChild(document.createTextNode(receivedFileName))
			const div = document.createElement('div')
			div.className = 'message-out'
			div.appendChild(linkTag)
			messageHolder.appendChild(div)
		}
	}
	else {
		const message = JSON.parse(event.data)
		if(message.type === "chat")  // chat message
			appendChatMessage(message.data, 'message-out')
		else   // draw event on canvas
		{	
			const line = message
			drawLine(line.color, line.size, line.pX, line.pY, line.mX, line.mY)
		}
	}
}

sendMessage.addEventListener('click', ev => {
	const message = {type: "chat", data: myMessage.value}
	dataChannel.send(JSON.stringify(message))
	console.log("To DataChannel: " + myMessage.value)
	appendChatMessage(myMessage.value, 'message-in')
	myMessage.value = ""
	ev.preventDefault()
}, false)

const appendChatMessage = (msg, className) => {
	const div = document.createElement('div')
	div.className = className
	div.innerHTML = '<span>' + msg + '</span>'
	messageHolder.appendChild(div)
}

/////// File Transfer code ///////
const sendFile = document.querySelector("input#sendFile")
const fileProgress = document.querySelector("progress#fileProgress")
const downloadLink = document.querySelector("a#receivedFileLink")

// receive meta data of the file from the server
io.on('files', data => {
	receivedFileName = data.filename
	receivedFileSize = data.filesize
	console.log("File on it's way: " + receivedFileName + "(" + receivedFileSize + ")")
	fileTransferring = true
})

sendFile.addEventListener('change', ev => {
	const file = sendFile.files[0]
	console.log('sending file: ' + file.name + '(' + file.size + ')...')

	io.emit('files', {'filename': file.name, 'filesize': file.size, "room_id": roomID})
	
	appendChatMessage('sending ' + file.name, 'message-in')
	fileTransferring = true

	// send data (the actual content of the file) via the data channel
    // in chunks of 16k
	fileProgress.max = file.size
	const sliceFile = offset => {
		const reader = new window.FileReader()

		reader.onload = (() => {
			return e => {
				dataChannel.send(e.target.result)
				if (file.size > offset + e.target.result.byteLength){
					window.setTimeout(sliceFile, 0, offset + CHUNK_SIZE)
				}
				fileProgress.value = offset + e.target.result.byteLength
			}
		})(file)

		const slice = file.slice(offset, offset + CHUNK_SIZE)
		reader.readAsArrayBuffer(slice)
	};
	sliceFile(0)
	fileTransferring = false
	fileProgress.value = 1
}, false)
