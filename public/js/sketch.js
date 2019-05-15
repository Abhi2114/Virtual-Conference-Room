// a simple canvas which allows the user to paint

let canvas
let current_color = {r: 255, b: 0, g: 0}  // current pencil color
const p_size = 3
const clearCanvas = document.querySelector("#clearCanvas")

function setup(){
	canvas = createCanvas(windowWidth/2.45, windowHeight)
	canvas.parent('videoPage')
	canvas.position(0, 60)
	canvas.style('z-index', '1')

	background(255, 255, 255) // set the background as white
}

function draw(){
	if (mouseIsPressed){
		drawLine(current_color, p_size, pmouseX, 
			pmouseY, mouseX, mouseY)

		if (dataChannel){
			sendData(current_color, p_size, pmouseX, 
					pmouseY, mouseX, mouseY)   // send this data to the other peer
		}
	}
}

const drawLine = (color, size, pX, pY, mX, mY) => {
	stroke(color.r, color.g, color.b)  // pencil color
	strokeWeight(size)     // pencil size
	line(pX, pY, mX, mY)
}

const sendData = (color, size, pX, pY, mX, mY) => {
	
	// prepare json object to send to the other peer
	const data = {
		color: color,
		size: size,
		pX: pX,
		pY: pY,
		mX: mX,
		mY: mY
	}
	dataChannel.send(JSON.stringify(data))
}

// clear the canvas
clearCanvas.addEventListener('click', ev => {
	background(255, 255, 255)
}, false)
