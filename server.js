//Server.js:  This is the core Node.js configuration code, and also used for
//setting up signaling channels to be used by socket.io

const express = require('express.io')
const app = express()
app.http().io()
const PORT = 3000
console.log('server started on port ' + PORT)

app.use(express.static(__dirname + '/public'))

app.get('/', function(req, res){
	res.render('index.ejs')
})

const getRandom = () => '' + Math.random().toString(36).substr(2, 9)

calls = new Set()

app.listen(process.env.PORT || PORT)

app.io.route('signal', req => {

	// check if id is valid
	const room_id = req.data.room_id
	
	if (calls.has(room_id)){
		req.io.join(room_id)
		// send a message to the other peers indicating that the caller is online
		req.io.room(room_id).broadcast('signal', {
			user_type: req.data.user_type,
			user_name: req.data.user_name,
			user_data: req.data.user_data,
			command: req.data.command
		})
	}
	else{
		// invalid room id
		console.log('Invalid..')
		req.io.emit('invalid_id', 'Invalid Call ID')
	}
})

app.io.route('call', req => {
	// create a new call
	// generate a random id
	const room_id = getRandom()
	calls.add(room_id)

	req.io.join(room_id)

	app.io.room(room_id).broadcast('call', {
		room_id: room_id	
	})
})

// send file meta data over the server
app.io.route('files', req => {
	req.io.room(req.data.room_id).broadcast('files', {
		filename: req.data.filename,
		filesize: req.data.filesize
	})
})
