/**
 * animated-model : normalizes a glTF model size to the target width and plays its embedded animations.
 * Animations start automatically once the model is loaded (see autoplay).
 */
AFRAME.registerComponent('animated-model', {
	schema: {
		size: {type: 'number', default: 1},	// largest dimension, in target width units
		autoplay: {type: 'boolean', default: true}
	},

	init: function () {
		this.mixer = null;
		this.actions = [];
		this.playing = this.data.autoplay;
		this.el.addEventListener('model-loaded', this.onModelLoaded.bind(this));
	},

	onModelLoaded: function () {
		const THREE = AFRAME.THREE;
		const model = this.el.getObject3D('mesh');
		if (!model) return;

		// Center the model and fit it to the target.
		// The box is computed with the model detached: MindAR anchors hold a zero matrix
		// until a target is found, which would turn the box into NaN and hide the model.
		const parent = model.parent;
		parent.remove(model);
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		parent.add(model);
		const size = box.getSize(new THREE.Vector3());
		const center = box.getCenter(new THREE.Vector3());
		const maxDim = Math.max(size.x, size.y, size.z);
		if (isFinite(maxDim) && maxDim > 0) {
			const factor = this.data.size / maxDim;
			model.scale.multiplyScalar(factor);
			model.position.sub(center.multiplyScalar(factor));
		} else {
			console.warn('animated-model: unable to compute model size, keeping original scale');
		}

		const clips = model.animations || [];
		if (!clips.length) {
			console.warn('animated-model: no animation found in model');
			return;
		}
		this.mixer = new THREE.AnimationMixer(model);
		this.actions = clips.map((clip) => this.mixer.clipAction(clip));
		this.actions.forEach((action) => {
			action.play();
			action.paused = !this.playing;
		});
	},

	playAnimation: function () {
		this.playing = true;
		this.actions.forEach((action) => {
			action.paused = false;
			if (!action.isRunning()) action.play();
		});
	},

	pauseAnimation: function () {
		this.playing = false;
		this.actions.forEach((action) => { action.paused = true; });
	},

	restartAnimation: function () {
		this.playing = true;
		this.actions.forEach((action) => {
			action.reset();
			action.play();
		});
	},

	tick: function (time, timeDelta) {
		if (this.mixer) this.mixer.update(timeDelta / 1000);
	}
});

document.addEventListener("DOMContentLoaded", function() {
	const SCALE_STEP = 1.25;
	const SCALE_MIN = 0.2;
	const SCALE_MAX = 5;
	let scale = 1;

	const models = () => Array.from(document.querySelectorAll('[animated-model]'));
	const playButton = document.querySelector('#model-play-button');
	const pauseButton = document.querySelector('#model-pause-button');
	const restartButton = document.querySelector('#model-restart-button');
	const smallerButton = document.querySelector('#model-smaller-button');
	const biggerButton = document.querySelector('#model-bigger-button');
	const scaleLabel = document.querySelector('#model-scale-label');

	function callAll(method) {
		models().forEach((el) => {
			const component = el.components['animated-model'];
			if (component) component[method]();
		});
		const playing = method !== 'pauseAnimation';
		playButton.classList.toggle('active', playing);
		pauseButton.classList.toggle('active', !playing);
	}

	function setScale(value) {
		scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, value));
		models().forEach((el) => el.object3D.scale.set(scale, scale, scale));
		scaleLabel.textContent = Math.round(scale * 100) + '%';
	}

	playButton.addEventListener('click', () => callAll('playAnimation'));
	pauseButton.addEventListener('click', () => callAll('pauseAnimation'));
	restartButton.addEventListener('click', () => callAll('restartAnimation'));
	smallerButton.addEventListener('click', () => setScale(scale / SCALE_STEP));
	biggerButton.addEventListener('click', () => setScale(scale * SCALE_STEP));

	playButton.classList.add('active');
});
