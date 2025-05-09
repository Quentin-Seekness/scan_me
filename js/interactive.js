document.addEventListener("DOMContentLoaded", function() {
	const sceneEl = document.querySelector('a-scene');
	let arSystem;
	sceneEl.addEventListener('loaded', function () {
	  arSystem = sceneEl.systems["mindar-image-system"];
	});
	const divButtons = document.querySelector('#interactive-buttons');
	const divSlider = document.querySelector('#slider');
	const exampleTarget = document.querySelector('#example-target');
	const examplePlane = document.querySelector('#example-plane');
	const startButton = document.querySelector("#example-start-button");
	const stopButton = document.querySelector("#example-stop-button");
	const pauseButton = document.querySelector("#example-pause-button");
	const pauseKeepVideoButton = document.querySelector("#example-pause-keep-video-button");
	const unpauseButton = document.querySelector("#example-unpause-button");
	startButton.addEventListener('click', () => {
	  console.log("start");
	  arSystem.start(); // start AR 
	});
	stopButton.addEventListener('click', () => {
	  arSystem.stop(); // stop AR 
	});
	pauseButton.addEventListener('click', () => {
	  arSystem.pause(); // pause AR, pause video
	});
	pauseKeepVideoButton.addEventListener('click', () => {
	  arSystem.pause(true); // pause AR, keep video
	});
	unpauseButton.addEventListener('click', () => {
	  arSystem.unpause(); // unpause AR and video
	});
	// arReady event triggered when ready
	sceneEl.addEventListener("arReady", (event) => {
	  // console.log("MindAR is ready")
	});
	// arError event triggered when something went wrong. Mostly browser compatbility issue
	sceneEl.addEventListener("arError", (event) => {
	  // console.log("MindAR failed to start")
	});
	// detect target found
	exampleTarget.addEventListener("targetFound", event => {
	  console.log("target found");
      divButtons.style.display = 'block';
      divSlider.style.display = 'block';
	});
	// detect target lost
	exampleTarget.addEventListener("targetLost", event => {
	  console.log("target lost");
      divButtons.style.display = 'none';
      divSlider.style.display = 'none';
	});
	// detect click event
	examplePlane.addEventListener("click", event => {
	  console.log("plane click");
	});
});