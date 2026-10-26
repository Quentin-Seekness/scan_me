/**
 * animated-model : normalizes a glTF model size to the target width and plays its embedded animations.
 * Animations start automatically once the model is loaded (see autoplay).
 */
AFRAME.registerComponent('animated-model', {
	schema: {
		size: {type: 'number', default: 1},	// largest dimension, in target width units
		heading: {type: 'number', default: 0},	// rotation around the model up axis, in degrees
		autoplay: {type: 'boolean', default: true}
	},

	init: function () {
		const THREE = AFRAME.THREE;
		this.mixer = null;
		this.actions = [];
		this.playing = this.data.autoplay;
		// User rotation (drag) around the model center, in the entity space
		this.userRotation = new THREE.Quaternion();
		this.baseQuaternion = new THREE.Quaternion();
		this.pivot = new THREE.Vector3();
		this.offset = new THREE.Vector3();
		this.el.addEventListener('model-loaded', this.onModelLoaded.bind(this));
	},

	onModelLoaded: function () {
		const THREE = AFRAME.THREE;
		// Forget the animations of a previously loaded model (src change)
		if (this.mixer) this.mixer.stopAllAction();
		this.mixer = null;
		this.actions = [];

		const model = this.el.getObject3D('mesh');
		if (!model) return;

		// Center the model, put its base at the entity origin and fit it to the target.
		// The box is computed with the model detached: MindAR anchors hold a zero matrix
		// until a target is found, which would turn the box into NaN and hide the model.
		model.rotation.y = THREE.MathUtils.degToRad(this.data.heading);
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
			model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z).multiplyScalar(factor));
			this.pivot.set(0, (center.y - box.min.y) * factor, 0);
		} else {
			console.warn('animated-model: unable to compute model size, keeping original scale');
			this.pivot.set(0, 0, 0);
		}
		this.baseQuaternion.copy(model.quaternion);
		this.offset.copy(model.position).sub(this.pivot);
		this.userRotation.identity();

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

	/**
	 * Rotate the model around its center.
	 * @param {THREE.Vector3} axis normalized axis, in the entity space
	 * @param {number} angle in radians
	 */
	rotateBy: function (axis, angle) {
		const rotation = new AFRAME.THREE.Quaternion().setFromAxisAngle(axis, angle);
		this.userRotation.premultiply(rotation);
		this.applyRotation();
	},

	resetRotation: function () {
		this.userRotation.identity();
		this.applyRotation();
	},

	applyRotation: function () {
		const model = this.el.getObject3D('mesh');
		if (!model) return;
		model.quaternion.copy(this.userRotation).multiply(this.baseQuaternion);
		model.position.copy(this.offset).applyQuaternion(this.userRotation).add(this.pivot);
	},

	tick: function (time, timeDelta) {
		if (this.mixer) this.mixer.update(timeDelta / 1000);
	}
});

document.addEventListener("DOMContentLoaded", function() {
	const SCALE_STEP = 0.1;	// added or removed at each click (0.1 = 10%)
	const SCALE_MIN = 0.5;
	const SCALE_MAX = 3;
	let scale = 1;

	const models = () => Array.from(document.querySelectorAll('[animated-model]'));
	const foundTargets = new Set();
	const controls = document.querySelector('#model-controls');
	const animationControls = document.querySelector('#model-animation-controls');
	const playButton = document.querySelector('#model-play-button');
	const pauseButton = document.querySelector('#model-pause-button');
	const restartButton = document.querySelector('#model-restart-button');
	const smallerButton = document.querySelector('#model-smaller-button');
	const biggerButton = document.querySelector('#model-bigger-button');
	const scaleLabel = document.querySelector('#model-scale-label');
	const resetRotationButton = document.querySelector('#model-reset-rotation-button');

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
		// Rounded to avoid floating point drift (0.1 + 0.2 = 0.30000000000000004)
		scale = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, value)) * 100) / 100;
		models().forEach((el) => el.object3D.scale.set(scale, scale, scale));
		scaleLabel.textContent = Math.round(scale * 100) + '%';
	}

	const displayedModels = () => models().filter((el) => foundTargets.has(el.parentEl) && el.getObject3D('mesh'));

	// Show the controls only for displayed models, and animation controls only if one of them is animated
	function updateControls() {
		const displayed = displayedModels();
		const animated = displayed.some((el) => {
			const component = el.components['animated-model'];
			return component && component.actions.length > 0;
		});
		controls.classList.toggle('hidden', displayed.length === 0);
		animationControls.classList.toggle('hidden', !animated);
	}

	document.querySelectorAll('[mindar-image-target]').forEach((target) => {
		target.addEventListener('targetFound', () => {
			foundTargets.add(target);
			updateControls();
		});
		target.addEventListener('targetLost', () => {
			foundTargets.delete(target);
			updateControls();
		});
	});
	// A model may finish loading after its target has been found
	models().forEach((el) => el.addEventListener('model-loaded', updateControls));

	// Drag (mouse or finger) rotates the displayed models around their center:
	// horizontal moves turn around the screen vertical axis, vertical moves around the screen horizontal axis.
	// Pinch (two fingers) or mouse wheel zooms, by steps of SCALE_STEP within SCALE_MIN / SCALE_MAX.
	const ROTATE_SPEED = 0.01;	// radians per pixel
	const WHEEL_STEP_DELTA = 100;	// wheel delta (pixels) for one SCALE_STEP
	const pointers = new Map();	// pointerId => {x, y}
	let pinch = null;
	let wheelDelta = 0;

	function rotateDisplayed(dx, dy) {
		const THREE = AFRAME.THREE;
		const camera = document.querySelector('a-scene').camera;
		const cameraQuaternion = camera.getWorldQuaternion(new THREE.Quaternion());
		displayedModels().forEach((el) => {
			const toLocal = el.object3D.getWorldQuaternion(new THREE.Quaternion()).invert();
			const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternion).applyQuaternion(toLocal).normalize();
			const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion).applyQuaternion(toLocal).normalize();
			const component = el.components['animated-model'];
			component.rotateBy(up, dx * ROTATE_SPEED);
			component.rotateBy(right, dy * ROTATE_SPEED);
		});
	}

	// Snap to the closest SCALE_STEP so gestures move by the same increments as the buttons
	function setSnappedScale(value) {
		setScale(Math.round(value / SCALE_STEP) * SCALE_STEP);
	}

	function pointersDistance() {
		const [a, b] = Array.from(pointers.values());
		return Math.hypot(a.x - b.x, a.y - b.y);
	}

	document.addEventListener('pointerdown', (event) => {
		if (event.target.closest('#model-controls')) return;
		pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
		if (pointers.size === 2) {
			pinch = {distance: pointersDistance(), scale: scale};
		}
	});
	document.addEventListener('pointermove', (event) => {
		const pointer = pointers.get(event.pointerId);
		if (!pointer) return;
		const dx = event.clientX - pointer.x;
		const dy = event.clientY - pointer.y;
		pointer.x = event.clientX;
		pointer.y = event.clientY;
		if (pinch) {
			if (displayedModels().length && pinch.distance > 0) {
				setSnappedScale(pinch.scale * pointersDistance() / pinch.distance);
			}
		} else {
			rotateDisplayed(dx, dy);
		}
	});
	['pointerup', 'pointercancel'].forEach((type) => document.addEventListener(type, (event) => {
		pointers.delete(event.pointerId);
		// Pinch ends as soon as one finger is lifted, the remaining one rotates again
		if (pointers.size < 2) pinch = null;
	}));

	document.addEventListener('wheel', (event) => {
		if (!displayedModels().length) return;
		event.preventDefault();
		// deltaMode 1 = lines (Firefox), converted to pixels
		wheelDelta += event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
		const steps = Math.trunc(wheelDelta / WHEEL_STEP_DELTA);
		if (steps) {
			wheelDelta -= steps * WHEEL_STEP_DELTA;
			setScale(scale - steps * SCALE_STEP);	// wheel up (negative delta) zooms in
		}
	}, {passive: false});

	playButton.addEventListener('click', () => callAll('playAnimation'));
	pauseButton.addEventListener('click', () => callAll('pauseAnimation'));
	restartButton.addEventListener('click', () => callAll('restartAnimation'));
	smallerButton.addEventListener('click', () => setScale(scale - SCALE_STEP));
	biggerButton.addEventListener('click', () => setScale(scale + SCALE_STEP));
	resetRotationButton.addEventListener('click', () => models().forEach((el) => {
		const component = el.components['animated-model'];
		if (component) component.resetRotation();
	}));

	playButton.classList.add('active');
});
