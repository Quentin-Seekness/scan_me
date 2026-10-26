/**
 * Builds the MindAR scene from an experience config: experiences/<name>.json
 * The experience is chosen with the "exp" URL parameter (index.html?exp=visit-cards), DEFAULT_EXPERIENCE otherwise.
 *
 * Config format:
 * {
 *   "name": "Display name",
 *   "mind": "assets/targets.mind",          // compiled MindAR targets (one or several images)
 *   "scanHint": "Visez la carte",           // optional, text under the scanning frame
 *   "tracking": {...},                      // optional, mindar-image options (maxTrack, filterMinCF, filterBeta...)
 *   "defaults": {...},                      // optional, target options shared by all targets
 *   "targets": [
 *     {
 *       "index": 0,                         // image index in the .mind file
 *       "model": "assets/models/x.glb",     // glTF model shown on this image
 *       "height": 0.1,                      // height above the image, in image width units
 *       "rotation": "90 0 0",               // "90 0 0" stands a Y-up model on the image
 *       "heading": 0,                       // rotation around the model up axis, in degrees
 *       "size": 1,                          // largest model dimension, in image width units
 *       "autoplay": true                    // play the model animations once loaded
 *     }
 *   ]
 * }
 *
 * Models are loaded lazily, the first time their image is found.
 */
const DEFAULT_EXPERIENCE = '001';

const DEFAULT_TRACKING = {
	maxTrack: 1,
	filterMinCF: 0.0001,
	filterBeta: 0.001
};

const DEFAULT_TARGET = {
	height: 0.1,
	rotation: '90 0 0',
	heading: 0,
	size: 1,
	autoplay: true
};

function getExperienceName() {
	const name = new URLSearchParams(window.location.search).get('exp') || DEFAULT_EXPERIENCE;
	// Only plain file names, no path
	if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Nom d\'expérience invalide : ' + name);
	return name;
}

async function loadExperienceConfig(name) {
	const response = await fetch('experiences/' + name + '.json');
	if (!response.ok) throw new Error('Expérience introuvable : ' + name);
	return response.json();
}

// Serialize an object into an A-Frame component string: "key: value; key: value"
function toComponentString(options) {
	return Object.entries(options).map(([key, value]) => key + ': ' + value).join('; ');
}

function buildScene(config) {
	const tracking = Object.assign({}, DEFAULT_TRACKING, config.tracking, {
		imageTargetSrc: config.mind,
		uiScanning: '#scan-overlay'
	});

	const scene = document.createElement('a-scene');
	scene.setAttribute('mindar-image', toComponentString(tracking));
	scene.setAttribute('color-space', 'sRGB');
	scene.setAttribute('renderer', 'colorManagement: true, physicallyCorrectLights');
	scene.setAttribute('vr-mode-ui', 'enabled: false');
	scene.setAttribute('device-orientation-permission-ui', 'enabled: false');

	scene.insertAdjacentHTML('beforeend',
		'<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
		'<a-light type="ambient" intensity="1"></a-light>' +
		'<a-light type="directional" position="0 1 1" intensity="2"></a-light>');

	config.targets.forEach((targetConfig) => {
		const options = Object.assign({}, DEFAULT_TARGET, config.defaults, targetConfig);
		if (!options.model) {
			console.warn('experience: no model for target', options.index);
			return;
		}

		const target = document.createElement('a-entity');
		target.setAttribute('mindar-image-target', 'targetIndex: ' + options.index);

		// src is set on first detection (lazy loading)
		const model = document.createElement('a-gltf-model');
		model.dataset.src = options.model;
		model.setAttribute('position', '0 0 ' + options.height);
		model.setAttribute('rotation', options.rotation);
		model.setAttribute('animated-model', toComponentString({
			heading: options.heading,
			size: options.size,
			autoplay: options.autoplay
		}));

		target.appendChild(model);
		scene.appendChild(target);
	});

	return scene;
}

// Load the model of a target the first time it is found
function setupLazyLoading(scene) {
	const loading = document.querySelector('#model-loading');

	scene.addEventListener('targetFound', (event) => {
		const model = event.target.querySelector('a-gltf-model[data-src]');
		if (!model) return;
		loading.classList.remove('hidden');
		const done = () => loading.classList.add('hidden');
		model.addEventListener('model-loaded', done, {once: true});
		model.addEventListener('model-error', done, {once: true});
		model.setAttribute('src', model.dataset.src);
		model.removeAttribute('data-src');
	});
	scene.addEventListener('targetLost', () => loading.classList.add('hidden'));
}

function showExperienceError(message) {
	const error = document.querySelector('#experience-error');
	error.textContent = message;
	error.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', async function () {
	try {
		const config = await loadExperienceConfig(getExperienceName());
		if (config.name) document.title = config.name;
		if (config.scanHint) document.querySelector('#scan-overlay .scan-hint').textContent = config.scanHint;

		const scene = buildScene(config);
		setupLazyLoading(scene);
		document.body.appendChild(scene);
	} catch (error) {
		console.error(error);
		showExperienceError(error.message);
	}
});
