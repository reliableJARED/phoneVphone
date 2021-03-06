/*
RESOUCES:
****PHYSICS
Ammo.js is a port of Bullet, use the bullet manual
http://www.cs.uu.nl/docs/vakken/mgp/2014-2015/Bullet%20-%20User%20Manual.pdf

https://www.raywenderlich.com/53077/bullet-physics-tutorial-getting-started

****GRAPHICS
http://threejs.org/docs/
http://threejs.org/examples/

EXAMPLE INTRO:
Graphics and physics objects are not the same.  we need to create graphics, with corresponding physics objects and then associate them so it's easy to update a graphics change. For example when a box rotates after being in a collision.  The graphics (orientation) of the box moves based on what the position of physics object is.

I'll be using three.js for graphics and ammo.js for physics (note that in the comments bullet = ammo.js)
*/

//GLOBAL General variables
var MOUSE = new THREE.Vector2();
var CLOCK = new THREE.Clock();


//GLOBAL Graphics variables
var CAMERA, SCENE, RENDERER;//THREE: primary components of displaying in three.js
var CONTROLS;
//RAYCASTER  is a project that renders a 3D world based on a 2D map
var RAYCASTER = new THREE.Raycaster();//http://threejs.org/docs/api/core/RAYCASTER.html
var backgroundImage, VIDEO_CANVAS_CTX;// lower layer canvas that has video feed

//GLOBAL Camera perspective variable container
const CAMERA_PERSPECTIVE = (()=>{
	// mess around with these to get the right view perspective
	const camX = 0;
    const camY = 3; 
    const camZ = -7;
	return {
		x: ()=>{ return camX},
		y: ()=>{ return camY},
		z: ()=>{ return camZ},
	};
})();
//GLOBAL for the HTML5 video element holding our local video feed
var VIDEO_ELEMENT = null;

//GLOBAL Physics variables
var PHYSICS_WORLD;
var GRAVITY_CONSTANT = -9.8;
var RIGID_BODIES = [];
var COLLISION_CONFIGURATION;
var DISPATCHER; //AMMO: This is used to dispatch objects that have been determined to be in collision to the SOLVER
var BROADPHASE; //AMMO:  used to eliminate objects that can't collide because they are not near
var SOLVER; //AMMO: dispatch objects  to the SOLVER that have been determined to be in collision
var TRANSFORM_AUX1 = new Ammo.btTransform();


//SOUND EFFECT
const POP_SOUND = document.createElement("audio");
POP_SOUND.src = "/resources/sound/328118__greenvwbeetle__pop-7.mp3";

//REPRESENTATION OF THE PLAYER
let PlayerCube = null;// PlayerCube = createPlayerCube() 


//// TRACK DEVICE ORIENTATION
/*
maybe a better way to do this
used as holder for the motion event state
the pupose is so that the annimationfram()
use of state is in sync. and not constantly
update on the event listener
*/
const DEVICE_MOTION_STATE = (()=>{
	/*
	state includes state.acceleration.x, .y, .z as (meter/sec.) // https://developers.google.com/web/fundamentals/native-hardware/device-orientation#handle_the_device_motion_events
	state includes state.rotationRate.alpha, .gamma, .beta (degree/sec.)  // https://developers.google.com/web/fundamentals/native-hardware/device-orientation#rotation_data
	*/
	let state = false;//false flag is used to determine if state has been acquired yet

	return  {
		set: function (e){ 
			state = e;
			return state},
		get: function(){ 
			return state;
			}
	};
})();

//MAIN
init();// start world building
animate(); //start rendering loop


function init() {
		initUserCamFeed();
		
		initGraphics();

		initPhysics();

		createObjects();

		initInput();

}



function createVideoElement(stream){
    console.log('creating a video element, assign to global VIDEO_ELEMENT ')
//create html5 video element to stream our local camera Video feed
VIDEO_ELEMENT = document.createElement("video");//create an HTML5 video element
VIDEO_ELEMENT.autoplay = true;
VIDEO_ELEMENT.setAttribute('playsinline','');//this only way to get .play to work on iphone
//add the element to our dom
console.log(stream);
//this will be in a promise chain.  return the new element and the stream that came in.
return stream;
}

function initUserCamFeed(){
	//https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getUserMedia
	//https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

	//Desktop constraint
	const dsk_constraints = {
		audio: false,
        video: {width:window.innerWidth,
                height:window.innerHeight}
        };
    
    //iPhone constraint.  note should really be 'mobile'
    const phone_constraints = {
		audio: false,
        video: {width:window.innerWidth,
                height:window.innerHeight,
                facingMode: { 
                    // require the rear camera
                    exact: "environment" 
                    }
                }
        };
    
    //if iPhone user agent, ONLY set video constraint, else it will over constrain.  this is not a fool proof check and obv. doesn't check for non iphone
    const constraints = navigator.userAgent.includes("iPhone") ? phone_constraints : dsk_constraints;

    const videoElementWithCamStream = navigator.mediaDevices.getUserMedia(constraints)
    .then(new Promise(createVideoElement,errorHandler))
	.then(setStreamToVideoElement).catch(errorHandler)


	//Add local camera stream to our video element
	function setStreamToVideoElement(stream) {
        //VIDEO_ELEMENT  is a global ref to a html5 <video> 
        console.log(stream);
		console.log('adding .getuserMedia stream to video element');
        VIDEO_ELEMENT.srcObject = stream;//set our video element souce to the webcam feed
        VIDEO_ELEMENT.play();
        //VIDEO_ELEMENT.onloadedmetadata = function(e) { VIDEO_ELEMENT.play(); };
	}
}

function initGraphics() {
/*To actually be able to display anything with Three.js, we need three things: 
a SCENE, a CAMERA, 
and a RENDERER so we can render the SCENE with the CAMERA*/

/* there are dif types of CAMERAs, we'll use:
PerspectiveCAMERA( fov, aspect, near, far )
		fov — CAMERA frustum vertical field of view.
		aspect — CAMERA frustum aspect ratio.
		near — CAMERA frustum near plane.
        far — CAMERA frustum far plane.
*/  
//https://threejs.org/docs/#api/en/cameras/PerspectiveCamera
// GOOD SITE TO SEE HOW CAMERA VIEW CHANGES //// https://threejsfundamentals.org/threejs/lessons/threejs-cameras.html
    const fov = 60;
    const aspect = (window.innerWidth / window.innerHeight);
    const near = 0.1;
    const far = 3000;

   CAMERA = new THREE.PerspectiveCamera( fov,aspect,near,far );	 //mess around with these parameters to adjust CAMERA perspective view point
	//Set the initial perspective for the user
    CAMERA.position.x = CAMERA_PERSPECTIVE.x();
	CAMERA.position.y = CAMERA_PERSPECTIVE.y();
    CAMERA.position.z = CAMERA_PERSPECTIVE.z();
				
	SCENE = new THREE.Scene();//http://threejs.org/docs/#Reference/SCENEs/SCENE
    
	//http://threejs.org/docs/#Reference/RENDERERs/WebGLRENDERER
	RENDERER = new THREE.WebGLRenderer({ alpha: true });//alpha true makes background CLEAR
	RENDERER.setClearColor( 0x000000, 0  ); //sets the clear color and opacity of background.
    RENDERER.setPixelRatio( window.devicePixelRatio );//Sets device pixel ratio.
    RENDERER.setSize( window.innerWidth, window.innerHeight );//Resizes output to canvas device with pixel ratio taken into account
	
	//IMPORTANT.  by default the renderer style will 'stack' not overlap, need to change css for position to fixed
	RENDERER.domElement.style.position = 'fixed';

    
    //LIGHT
	//http://threejs.org/docs/api/lights/AmbientLight.html
	const ambientLight = new THREE.AmbientLight( 0x404040 );
	//ambientLight is for whole SCENE, use directionalLight for point source/spotlight effect
	SCENE.add( ambientLight );
	const directionalLight = new THREE.DirectionalLight('white',8);
	directionalLight.position.set(0,10,10);
	SCENE.add(directionalLight);

    //fog to make far objects appear smoothly, not just pop up when they are within render distance
	SCENE.fog = new THREE.FogExp2( 0xefd1b5, 0.0025 );
    				
    
    //attach and display the RENDERER to our html element
    var container = document.getElementById( 'container' );
        container.appendChild( RENDERER.domElement );
	
	//SECOND CANVAS
	//this canvas is our background that will display the users camera feed
	 backgroundImage = document.createElement("canvas");
		VIDEO_CANVAS_CTX = backgroundImage.getContext("2d");//set drawing context as a global
		backgroundImage.width = window.innerWidth;
		//add 1 to force auto scroll.  this way the URL input bar goes away on iOS safari
		backgroundImage.height = window.innerHeight;
		VIDEO_CANVAS_CTX.drawImage(VIDEO_ELEMENT,0,0);
		backgroundImage.style.position = 'fixed';
		//keep our background at lowest level
		backgroundImage.setAttribute('style','z-index:0');
		container.appendChild(backgroundImage);
}

function createObjects() {
		
        // Create a cube for the player
        PlayerCube = createPlayerCube();
        
        
		//http://threejs.org/docs/api/math/Vector3.html
		var pos = new THREE.Vector3(0,50,0);//location in 3D space
		
		//http://threejs.org/docs/api/math/Quaternion.html
		var quat = new THREE.Quaternion();//rotation/orientation in 3D space.  default is none, (0,0,0,1);
		/*
        //create a graphic and physic component for our cube
        let length = 10;
        let height = 1;
        let width = 1;
		var cube = createGrapicPhysicBox(length,height,width,5,pos,quat);
		
		//add to our physics object holder
		RIGID_BODIES.push( cube );
		g
		//add cube to graphics world
		SCENE.add( cube );
		
		//add physics portion of cube to world
		PHYSICS_WORLD.addRigidBody( cube.userData.physicsBody );
		*/

		///INVISIBLE GROUND  -- NOT USING -- UNCOMMENT TO ADD
		//----change and reuse pos for the ground		
		//pos.set( 0, -10, 0 );//-y so it's under objects
		//----note arg 4 is mass, set to 0 so that ground is static object
		//var ground = createTransparentObject(2000,1,2000,0,pos,quat)
		//PHYSICS_WORLD.addRigidBody( ground);
}

function createTransparentObject(sx, sy, sz, mass, pos, quat){
	
	//PHYSICS COMPONENT	/******************************************************************/
	//btBoxShape : Box defined by the half extents (half length) of its sides (that is why the 0.5 is there)
	var physicsShape = new Ammo.btBoxShape(new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
	
	//set the collision margin, don't use zero, default is typically 0.04
	physicsShape.setMargin(0.04);
	
	/*set the location of our physics object based on where the graphics object is*/
	//btTransform() supports rigid transforms with only translation and rotation and no scaling/shear.
	var transform = new Ammo.btTransform();
	transform.setIdentity();
	
	//setOrigin() is for location
	transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
    
	//setRotation() is for Orientation
	transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );
	
	//set the motion state and inertia of our object
	var motionState = new Ammo.btDefaultMotionState( transform );
	
	//http://stackoverflow.com/questions/16322080/what-does-having-an-inertia-tensor-of-zero-do-in-bullet
	//tendency of our object to resist changes in its velocity, in our case none in any direction.
	var localInertia = new Ammo.btVector3( 0, 0, 0 );
	
	physicsShape.calculateLocalInertia( mass, localInertia );
	
	//create our final physics body info
	var rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
	
	//build our ridgidBody
	var ammoCube = new Ammo.btRigidBody( rbInfo );
	
	//return our physics object
	return ammoCube;
	
	
}

function createGaphicPhysicSphere (radius, mass, pos, quat, material,widthSegments, heightSegments,){
    /***TODO***Change input to an object so it's not order based */
	/////// GRAPHICS
	widthSegments =  widthSegments || 32;//default 32 should be fine to make shape round ish
	heightSegments =heightSegments || 32; //default 32 should be fine to make shape round ish
	material = material || new THREE.MeshBasicMaterial( {color: 0xff0000} ); //red default

	const geometry = new THREE.SphereGeometry( radius, widthSegments, heightSegments );
	const Sphere = new THREE.Mesh( geometry, material );

	////// PHISICS
	const physicsShape = new Ammo.btSphereShape( radius );
	//set the collision margin, don't use zero, default is typically 0.04
	physicsShape.setMargin(0.04);

	/*set the location of our physics object based on where the graphics object is*/
	//btTransform() supports rigid transforms with only translation and rotation and no scaling/shear.
	const transform = transformSetup(pos,quat);

	//set the motion state and inertia of our object
	const motionState = new Ammo.btDefaultMotionState( transform );

	//http://stackoverflow.com/questions/16322080/what-does-having-an-inertia-tensor-of-zero-do-in-bullet
	//tendency of our object to resist changes in its velocity, in our case none in any direction.
	const localInertia = new Ammo.btVector3( 0, 0, 0 );
	
	physicsShape.calculateLocalInertia( mass, localInertia );
	
	//create our final physics body info
	const rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
	
	//build our ridgidBody
	const ammoSphere = new Ammo.btRigidBody( rbInfo );
	
	//attach the physic properties to the graphic object
	Sphere.userData.physicsBody = ammoSphere;
	
	//Sphere contains both our graphic and physics components
	return Sphere;

	
}

function transformSetup(pos,quat){
	/*set the location of our physics object based on where the graphics object is*/
	//btTransform() supports rigid transforms with only translation and rotation and no scaling/shear.
	var transform = new Ammo.btTransform();
	transform.setIdentity();
	
	//setOrigin() is for location
	transform.setOrigin( new Ammo.btVector3( pos.x, pos.y, pos.z ) );
    
	//setRotation() is for Orientation
	transform.setRotation( new Ammo.btQuaternion( quat.x, quat.y, quat.z, quat.w ) );

	return transform
}
//REALbox(x,y,z,mass,pos,quat,material);
function createGrapicPhysicBox (sx, sy, sz, mass, pos, quat, material,rndFaceColors){
    rndFaceColors = rndFaceColors || false; //color assignment 
	//GRAPHIC COMPONENT
	/***************************************************************/
	//http://threejs.org/docs/api/extras/geometries/BoxGeometry.html
	var geometry = new THREE.BoxGeometry(sx, sy, sz );
	
	//create detault material if none passed
	//http://threejs.org/docs/api/materials/MeshBasicMaterial.html
	material = material || new THREE.MeshPhongMaterial( { color: "rgb(100%, 0%, 0%)"} );
	
	//http://threejs.org/docs/#Reference/Objects/Mesh
	var Cube = new THREE.Mesh(geometry, material);
	
	
	//PHYSICS COMPONENT	/******************************************************************/
	//btBoxShape : Box defined by the half extents (half length) of its sides (that is why the 0.5 is there)
	var physicsShape = new Ammo.btBoxShape(new Ammo.btVector3( sx * 0.5, sy * 0.5, sz * 0.5 ) );
	
	//set the collision margin, don't use zero, default is typically 0.04
	physicsShape.setMargin(0.04);
	
	/*set the location of our physics object based on where the graphics object is*/
	//btTransform() supports rigid transforms with only translation and rotation and no scaling/shear.
	const transform = transformSetup(pos,quat);
	
	//set the motion state and inertia of our object
	var motionState = new Ammo.btDefaultMotionState( transform );
	
	//http://stackoverflow.com/questions/16322080/what-does-having-an-inertia-tensor-of-zero-do-in-bullet
	//tendency of our object to resist changes in its velocity, in our case none in any direction.
	var localInertia = new Ammo.btVector3( 0, 0, 0 );
	
	physicsShape.calculateLocalInertia( mass, localInertia );
	
	//create our final physics body info
	var rbInfo = new Ammo.btRigidBodyConstructionInfo( mass, motionState, physicsShape, localInertia );
	
	//build our ridgidBody
	var ammoCube = new Ammo.btRigidBody( rbInfo );
	
	//attach the physic properties to the graphic object
	Cube.userData.physicsBody = ammoCube;
	
	//Cube contains both our graphic and physics components
	return Cube;
}

function initInput() {
	////////////// DISABLE THIS - left here for debut only
	//VIEW CONTROL
	/*contorl our CAMERA and move around our world.*/
	/*
	https://threejs.org/docs/#examples/en/controls/OrbitControls
	*/
    CONTROLS = new THREE.OrbitControls( CAMERA );
	CONTROLS.target.y = 2;
	CONTROLS.enableKeys = false; //for testing stop keyboard from chaning view
};

function initPhysics() {
		// Physics World configurations
		/*see Bullet documentation link at top for help/info on each*/
		/*
		To run physics simulations we need to create a few things for our world. ammo.js (bullet) has different classes/versions for each category.
		
		1. COLLISION DETECTION: this is done in two phases: broad and 	narrow.  broad is used to eliminate objects that can't collide because they are not near.  narrow is used for objects that can collide (slower calc) and where on the two objects the collision happens.
		
		2.DISPATCHER: This is used to dispatch objects that have been determined to be in collision to the SOLVER
		
		3. SOLVER: This is what causes the objects to interact properly, taking into account gravity, game logic supplied forces, collisions, and hinge constraints.
		*/
		
		//BROAD
		BROADPHASE = new Ammo.btDbvtBroadphase();
		
		//NARROW
		COLLISION_CONFIGURATION = new Ammo.btSoftBodyRigidBodyCollisionConfiguration();
		
		//DISPATCHER
		DISPATCHER = new Ammo.btCollisionDispatcher( COLLISION_CONFIGURATION );
		
		//SOLVER(s)
		SOLVER = new Ammo.btSequentialImpulseConstraintSolver();	
		softBodySolver = new Ammo.btDefaultSoftBodySolver();
		
		/*apply our selected components to the world*/
		//WORLD
		PHYSICS_WORLD = new Ammo.btSoftRigidDynamicsWorld( DISPATCHER, BROADPHASE, SOLVER, COLLISION_CONFIGURATION, softBodySolver);
				
		//note setGravity accepts (x,y,z), you could set gravitationl force in x or z too if you wanted.		
		PHYSICS_WORLD.setGravity( new Ammo.btVector3( 0, GRAVITY_CONSTANT, 0 ) );
};

function updatePhysics( deltaTime ) {
	//  https://developers.google.com/web/fundamentals/native-hardware/device-orientation
	let deviceState = DEVICE_MOTION_STATE.get();
	
	let trans = null;

	if(deviceState){
		//rotationRate is provided in °/sec
		//let alpha = deviceState.rotationRate.alpha;//get the orientation of phone on Z axis
		//console.log('alpha',alpha);

		//DEVICE_LOCATION.getTransform returns pos and quat representing where the device is in space
		let transform = DEVICE_LOCATION.getTransform(deviceState);

		//If the device isn't ready to give location, will be false
		if(transform){
		///Get update device about WHERE it actually is
			movePlayerCubeFromDeviceMotion(transform);
		}
	}
// Step world
/*By default, Bullet physics simulation runs at an internal fixed framerate of 60 Hertz (0.01666) or (60fps). The
game or application might have a different or even variable framerate. To decouple the application
framerate from the simulation framerate, an automatic interpolation method is built into
stepSimulation: when the application deltatime, is smaller then the internal fixed timestep, Bullet will
interpolate the world transform, and send the interpolated worldtransform to the btMotionState,
without performing physics simulation. If the application timestep is larger then 60 hertz, more then 1
simulation step can be performed during each ‘stepSimulation’ call. The user can limit the maximum
number of simulation steps by passing a maximum value as second argument*/

PHYSICS_WORLD.stepSimulation( deltaTime,10);

// Update rigid bodies
for ( let i = 0; i < RIGID_BODIES.length; i++ ) {
	let objThree = RIGID_BODIES[ i ];//graphic component
	let objPhys = objThree.userData.physicsBody;//physics component
	
	//Motion states for objects communicate movement caused by forces in the physics simulation.  use this info to change our graphics
	let ms = objPhys.getMotionState();
	
	//bullet uses motionstates to aliviate looping through many world objects.  if there has been no change due too physical forces there will be no motion.  Also, objects can go into a 'sleep' mode.  If a body doesn't move due too force for about 2 seconds it won't be able to move again unless it collides with a body that is in motion. 
	
		if ( ms ) {
            //Bullet calls getWorldTransform with a reference to the variable it wants you to fill with transform information
            ms.getWorldTransform( TRANSFORM_AUX1 );//note: TRANSFORM_AUX1 =  Ammo.btTransform();
            
            //get the physical location of our object as a vector
            var p = TRANSFORM_AUX1.getOrigin();
            //get the physical orientation of our object as a quaternion
            var q = TRANSFORM_AUX1.getRotation();
            
            //update the graphic of our object with the physical location
            objThree.position.set( p.x(), p.y(), p.z() );
            //update the graphic of our object with the physical orientation/rotation
            objThree.quaternion.set( q.x(), q.y(), q.z(), q.w() );
				};
	};
				
};

function animate() {
        render();
		
		//call animate() in a loop
		requestAnimationFrame( animate );//https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame
    };
    
function render() {
	   var deltaTime = CLOCK.getDelta();
       RENDERER.render( SCENE, CAMERA );//graphics
	   CONTROLS.update( deltaTime );//view control
	   updatePhysics( deltaTime );//physics
	   updateCamera();//update view
	   //UPDATE!  the scaling of the video feed may not be needed.  will have to test
	   VIDEO_CANVAS_CTX.drawImage(VIDEO_ELEMENT,0,0,VIDEO_ELEMENT.videoWidth ,VIDEO_ELEMENT.videoHeight,0,0,backgroundImage.width,backgroundImage.height);//update video feed and stretch to fit screen
       };

       //MEDIA PROMISE FAIL
function errorHandler(error) {
		console.log('here is where it all went wrong ERROR: ', error);
    }
    

    //****** SHOOT A LITTLE CUBE		
function clickShootCube (event){
    //event should be a 'touchstart' event or key press
    event.preventDefault();
    console.log('fire')
    const radius = 0.8;//meters
    var mass = 10;//kg
    

	var pos =  PlayerCube.position;
	//use the current position of the player but add 2 to y so it shoots from player 'top'
    pos.addVectors(pos,new THREE.Vector3(0,0,0));
    
    var quat = new THREE.Quaternion();
    
    //assign random color when creating the new mesh
    const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff,shininess:100 } );

    //const material = new THREE.MeshBasicMaterial({ color: 0xff0000} );

    const sphere = createGaphicPhysicSphere(radius,mass,pos,quat,material);
    //onsole.log(sphere)
    
    /*DO NOT ENABLE cast shadow for these blocks system performance will be terrible!
    It's ok if they receive though.*/
	//sphere.castShadow = true;
	sphere.receiveShadow = true;
	sphere.flatShadding = true;
    
    //////////////// ADD THIS - see git repo game1  https://github.com/reliableJARED/WebGL/blob/gh-pages/static/js/game1.js#L563
    //weaker then our main object
    //sphere.userData.breakApart = new breakApart(15);
            
    //add our sphere to our array, scene and physics world.
    RIGID_BODIES.push(sphere);
    SCENE.add( sphere );//Graphics add
    PHYSICS_WORLD.addRigidBody( sphere.userData.physicsBody );// Physics add	
    /*
	Get the current Rotation of the player to determine how the sphere should be fired
	thrust can be applied in three directions x,y,z so that the direction of fire
	matches the direction the player is 'looking'
    */
	
   //It's easier to get the rotation from three.js then ammo.js, there are just less steps
   //the physics objects update graphics objects so you should get the same answer regardless of which one is used

	let thrustX = PlayerCube.userData.shotFireForce * Math.sin(PlayerCube.rotation._y);
	//let thrustY = PlayerCube.userData.shotFireForce * Math.cos(PlayerCube.rotation._y);
	let thrustZ = PlayerCube.userData.shotFireForce * Math.cos(PlayerCube.rotation._y);
               
               //used to determine if thrust in the z should be pos or neg
               var Zquad =1;

               var QUAT = PlayerCube.quaternion._y;
            //   console.log(QUAT);
            
            /*determine what direction our player is facing and the correction neg/pos for applied fire force*/
            // if( (QUAT > 0.74 && QUAT < 1.0) || (QUAT > -1  && QUAT < -0.74 )  ){Zquad=-1}
            // else {Zquad=1}
             
			 sphere.userData.physicsBody.applyCentralImpulse(new Ammo.btVector3( thrustX,0,thrustZ*Zquad ));
    
    
    //destroy the shot in x miliseconds (1000 =1 seconds)
    //removes it from the world so we don't litter with bullets
	destructionTimer(sphere,5000);	
	
	//////// SOUND EFFECT
	POP_SOUND.play();
    
}

function createPlayerCube(event){
	console.log(event);
    //PlayerCube is what the other players will see.  However, it's not visible to the local user because it's just behind the field of view
    //need to keep track of its orientation so that when we shoot, it looks like it's coming from the camera

	//properties used to make objects
		var x=2;//meters
		var y=2;//meters
		var z=2;//meters
		var mass = 0;// kg -- BUT if 0 will have infinity mass and not move or be affected by gravity STATIC BODY or KINEMATIC BODY
		var pos = new THREE.Vector3(0,0,0);	
		//////////////// QUATERNIONS  ////////////////////
		/*
		https://answers.unity.com/storage/attachments/139923-xyz.png
		https://stackoverflow.com/questions/4436764/rotating-a-quaternion-on-1-axis
		X,Y, Z compoent of quaternion is direction of axis around which we rotate.
		Quaternions are four-dimensional, so you need four properties. 
		The x/y/z properties don't correspond to x/y/z in euler angles. 
		With quaternions, each of the properties is a normalized float between 0 and 1, 
		so for example a euler angle of 45/90/180 is represented by a quaternion as approximately .65/-.27/.65/.27.
		
		a quaternion is a complex number with w as the real part and x, y, z as imaginary parts.
		If a quaternion represents a rotation then w = cos(theta / 2), where theta is the rotation angle around the axis of the quaternion.
		The axis v(v1, v2, v3) of a rotation is encoded in a quaternion: **x = v1 sin (theta / 2), y = v2 sin (theta / 2), z = v3 sin (theta / 2)*.
		If w is 1 then the quaternion defines 0 rotation angle around an undefined axis v = (0,0,0).
		If w is 0 the quaternion defines a half circle rotation since theta then could be +/- pi.
		If w is -1 the quaternion defines +/-2pi rotation angle around an undefined axis v = (0,0,0).
		A quater circle rotation around a single axis causes w to be +/- 0.5 and x/y/z to be +/- 0.5.
		*/
		var quat = new THREE.Quaternion();
		
		//create a graphic and physic component for our PlayerCube
		//NOTE! pass vertexColors because each cube face will be random color
        //var material = new THREE.MeshPhongMaterial( { color: "rgba(33%, 34%, 33%,256)", vertexColors: THREE.FaceColors,transparent:true} );
        const material = new THREE.MeshBasicMaterial( { color: "rgba(33%, 34%, 33%,256)", vertexColors: THREE.FaceColors,transparent:true, opacity:0.4} );

		/// return from createGrapicPhysicBox() joint physics/graphics object where Object.userData.physicsBody is a Ammo.btRigidBody
        PlayerCube = createGrapicPhysicBox(x,y,z,mass,pos,quat,material,true);//bool at the end means random color for each cube face
        
        //no shadows
		PlayerCube.castShadow = false;
        PlayerCube.receiveShadow = false;
		
		//log total damage on player, 'life' of player
		PlayerCube.userData.totalDmg = 0;

		//force that bullets are shot at
		PlayerCube.userData.shotFireForce = 1500;

		//// IMPORTANT to allow user movement
		/*
		https://medium.com/@bluemagnificent/moving-objects-in-javascript-3d-physics-using-ammo-js-and-three-js-6e39eff6d9e5
		make the player a KINEMATIC RIGID BODY
		*/
		const FLAGS = { CF_KINEMATIC_OBJECT: 2 };
		const STATE = { DISABLE_DEACTIVATION : 4 };
		PlayerCube.userData.physicsBody.setActivationState(STATE.DISABLE_DEACTIVATION);
		PlayerCube.userData.physicsBody.setCollisionFlags(FLAGS.CF_KINEMATIC_OBJECT);

		//IMPORTANT! 
		//hardcode prevention of Z and X rotation. Can only rotate around Y
	//	PlayerCube.userData.physicsBody.setAngularFactor(new Ammo.btVector3(0,1,0));
	//	PlayerCube.userData.physicsBody.setLinearFactor(new Ammo.btVector3(1,1,1));
				
		//add our PlayerCube to our array, scene and physics world.
		RIGID_BODIES.push(PlayerCube);
		SCENE.add( PlayerCube );
		PHYSICS_WORLD.addRigidBody( PlayerCube.userData.physicsBody );
		

        return PlayerCube;
}

////// GARBAGE COLLECTOR - get rid of bullets or other objects
//Promise used in the delayed destruction of objects
function destructionTimer(obj,delay) {
	//create promise
    var p1 = new Promise(
    // promise constructor takes one argument, a callback with two parameters, resolve and reject.
        function(resolve, reject) {
        	//create a timer with time = delay
            window.setTimeout( function() {
				//when time is up resolve with the return obj            	
            	resolve(obj);}, delay);
           /*I'm not using a reject condition. but typically a promise would be built with:
           function (resolve,reject) {
           	if (*all good*) {resolve()} else {reject(reason)}*/
        }
    );
    /*
    "then" takes two arguments, a callback for a success case, and another for the failure case. Both are optional.
    Setup as promise.then(*do something*).catch(*do something*) where then() is success, catch() is fail*/
    p1.then(  
        function(obj) {	
        //when promise resolves obj to be destroyed is passed	
			destroyObj(obj);
        });/*
    .catch(
       //reason would have been passed from reject()
        function(reason) {
            console.log(reason);
        });*/
}


function destroyObj(obj){
	//check for any attached mesh and remove.  For example the 'red cone' graphic
	//for the rocket flame.
	var keys = Object.keys(obj.userData);
	for(var i=0; i<keys.length;i++){
		//all THREE (graphic) components to an object will be .type == 'Mesh'
		// other random properties don't matter and don't need to be
		//removed
		if (obj.userData[keys[i]].type  === 'Mesh'){
			SCENE.remove( obj.userData[keys[i]] );
		}
	}
	//remove object from the visual world
	SCENE.remove( obj );
	//remove object from the physical world
	PHYSICS_WORLD.removeRigidBody( obj.userData.physicsBody );
	//remove from our rigidbodies holder
	for(var i=0;i < RIGID_BODIES.length;i++){
		if(obj.uuid === RIGID_BODIES[i].uuid ){
			RIGID_BODIES.splice(i,1);
		}
		
	}
	
}

/*
function yaw(){
	//update player yaw (Left/rigth rotation) movement
}

function pitch(){
	//update player pitch (up down rotation) movement
}
*/

window.addEventListener('touchend',((e)=>{
	/*****************iPhone
	 Access to device motion is only granted if it's triggered
	 with a gesture BUT not any gesture. click or touchend NOT a touchstart
	 */
		//could only be called on a user gesture (e.g. click).
		requestDeviceMotion();
		requestDeviceOrientation();//ask for orientation permission ios
		//THIRD arg once:TRUE - only fire this listener once
}),{once:true});

function btAddVector (ammoVector1, ammoVector2){
	// https://evanw.github.io/lightgl.js/docs/vector.html
	let x1 = ammoVector1.x();
	let y1 = ammoVector1.y();
	let z1 = ammoVector1.z();

	let x2 = ammoVector2.x();
	let y2 = ammoVector2.y();
	let z2 = ammoVector2.z();

	return new Ammo.btVector3(x1+x2,y1+y2,z1+z2);
}

function btMultiplyQuaternions(quatA,quatB){
	/////// consider adding this to the ammo.js Quaternion object proto at some point

// from http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/code/index.htm

	let qax = quatA.x(), qay = quatA.y(), qaz = quatA.z(), qaw = quatA.w();
	let qbx = quatB.x(), qby = quatB.y(), qbz = quatB.z(), qbw = quatB.w();

	//someone else knows this works, see link
	let x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
	let y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
	let z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
	let w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;

	return new Ammo.btQuaternion(x,y,z,w);
}

function btGetDeviceMotionStateQuaternion (alpha, beta, gamma){
	//get a Quaternion that represents current orientation of device
	//// Function from EXAMPLE 12 of:
	//	https://www.w3.org/TR/orientation-event/
	const degtorad = Math.PI / 180; // Degree-to-Radian conversion

	var _x = beta  ? beta  * degtorad : 0; // beta value
	var _y = gamma ? gamma * degtorad : 0; // gamma value
	var _z = alpha ? alpha * degtorad : 0; // alpha value
  
	var cX = Math.cos( _x/2 );
	var cY = Math.cos( _y/2 );
	var cZ = Math.cos( _z/2 );
	var sX = Math.sin( _x/2 );
	var sY = Math.sin( _y/2 );
	var sZ = Math.sin( _z/2 );
  
	//
	// ZXY quaternion construction.
	//
  
	var w = cX * cY * cZ - sX * sY * sZ;
	var x = sX * cY * cZ - cX * sY * sZ;
	var y = cX * sY * cZ + sX * cY * sZ;
	var z = cX * cY * sZ + sX * sY * cZ;
	
	return new Ammo.btQuaternion(x,y,z,w);;
  
  }

function btGetDeviceMotionStateVector(accel_x,accel_y,accel_z, deltaTime){
	//get position vector of device based on accelleration
	//https://stackoverflow.com/questions/153507/calculate-the-position-of-an-accelerating-body-after-a-certain-time
	let x = (1/2) * accel_x * (deltaTime*deltaTime);
	let y = (1/2) * accel_y * (deltaTime*deltaTime);
	let z = (1/2) * accel_z * (deltaTime*deltaTime);

	return new Ammo.btVector3(x,y,z);//vector of new position
}
function createRotationFromAxisAngle(xx,yy,zz,a,options){
	//options is a flag object to return a Ammo quaternion or a Threejs, default Three
	options = options|| {type:'threejs'};
	/*** FUNCTION SOURCE:
	https://stackoverflow.com/questions/4436764/rotating-a-quaternion-on-1-axis
	*/
	let angle = (a*Math.PI)/180;// Degree-to-Radian conversion
	// calculate the sin( theta / 2) once for optimization
	let factor = Math.sin(angle/2);

	// Calculate the x, y and z of the quaternion
	let x = xx * factor;
	let y = yy * factor;
	let z = zz * factor;

	// Calcualte the w value by cos( theta / 2 )
	let w = Math.cos(angle/2);

	//create Quaternion holder
	let quat = null;
	if(options.type === 'threejs'){
		 quat = new THREE.Quaternion(x,y,z,w);
		 return quat.normalize();
	}else if(options.type === 'ammo'){
		quat = new Ammo.btQuaternion(x,y,z,w);
		////// ADD NORMALIZATION METHOD
		return quat;
	}
	//let quat = new Ammo.btQuaternion(x,y,z,w);

	//Normalizes this quaternion - that is, calculated the quaternion that performs the same rotation as this one, but has length equal to 1.
	//return quat.normalize();
};

//FIRE A SHOUT WITH 
window.addEventListener('touchstart',((e)=>{

	clickShootCube(e)}),false);
	
document.addEventListener("keydown", ((e)=>{
	//amount to rotate by
	let angle = 2;//degrees
	let x = 0;
	let y = 0;
	let z = 0;
	switch (e.key){
		case 'ArrowDown':
			//LEFT - 37
			x = 1;
			angle *= -1;//reverse direction
			break;
		case 'ArrowUp':
			//UP - 38
			x = 1;
			break;
		case 'ArrowLeft':
			//RIGHT - 39
			y = 1;
			break;
		case "ArrowRight":
			//DOWN - 40
			y = 1;
			angle *= -1;
			break;
		default:
			clickShootCube(e)
		}
		//get the world location/rotation of player
		let transform = PlayerCube.userData.physicsBody.getWorldTransform();

		//get current player rotation quaternion from transform
		var quat = transform.getRotation();
	
		//create a Quat with a 'angle' degree of rotation around axis - X rotation = (1,0,0) (x,y,z)
		let quat_update = createRotationFromAxisAngle(x,y,z,angle,{type:'ammo'}); //return an Ammo quaternion

		//multiply the player quat, by the rotated quat, return a new quat  that is a combination of the two
		quat = btMultiplyQuaternions(quat,quat_update);

		///////:
		//	https://medium.com/@bluemagnificent/moving-objects-in-javascript-3d-physics-using-ammo-js-and-three-js-6e39eff6d9e5
		//set player object transform using the new quat
		transform.setRotation( quat );

		//Update the motionState with the new WorldTransform
		PlayerCube.userData.physicsBody.getMotionState().setWorldTransform(transform);
	}), false);

function movePlayerCubeFromDeviceMotion(transformFromDevice){
	//get the current world location/rotation of player
	let transform = PlayerCube.userData.physicsBody.getWorldTransform();

	//get current player rotation quaternion from transform
	var quat = transform.getRotation();//quaternion
	let pos = transform.getOrigin()//vector

	//create a Quat from the device rotation
	//let quat_update = createRotationFromAxisAngle(x,y,z,angle,{type:'ammo'}); //return an Ammo quaternion

	//multiply the player quat, by the rotated quat, return a new quat  that is a combination of the two
	quat = btMultiplyQuaternions(quat,transformFromDevice.quat);
	pos = btAddVector(pos,transformFromDevice.pos);

	///////:
	//	https://medium.com/@bluemagnificent/moving-objects-in-javascript-3d-physics-using-ammo-js-and-three-js-6e39eff6d9e5
	//set player object transform using the new quat and pos
	transform.setRotation( quat );
	transform.setOrigin( pos );

	//  https://www.varsitytutors.com/hotmath/hotmath_help/topics/adding-and-subtracting-vectors
	//Update the motionState with the new WorldTransform
	PlayerCube.userData.physicsBody.getMotionState().setWorldTransform(transform);
}

function requestDeviceMotion() {
    // feature detect
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener('devicemotion', onDeviceMotion);
          }
        })
        .catch(console.error);
    } else {
      // handle regular non iOS 13+ devices
    }
  };
/*
  function requestDeviceOrientation() {
    // feature detect
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientation', onDeviceOrientation);
          }
        })
        .catch(console.error);
    } else {
      // handle regular non iOS 13+ devices
    }
  }
*/
 


var STOP = false;
var STOP2 = false;

function onDeviceMotion (event){
	DEVICE_MOTION_STATE.set(event);
	//Debug code
	  if(!STOP){
		console.log(DEVICE_MOTION_STATE)
		console.log('motion');
		  console.log(event);
		  STOP = true;
	  }
	  
  }

  function onDeviceOrientation (event){
	  /// good resource
	  /*  
	  https://developers.google.com/web/fundamentals/native-hardware/device-orientation
	  https://developer.apple.com/documentation/coremotion/getting_processed_device-motion_data/understanding_reference_frames_and_device_attitude
	  */
	 
	  if(!STOP){
		console.log('orientation');
		  console.log(event);
		  STOP2 = true;
	  }


	//ROTATE PlayerCube --- PHYSICS


}


  // Keep acccurate account of real time
  // the reason is accellerometer and gyro data comes in at
  // units/second.  the fps for the user can vary
  // need to sync (best we can without a check, like qr code optical detection)
  // how much the device has moved

const DEVICE_LOCATION = (function (){
	// time stamp from previous call, gets updated during use
	let beforeTime = 0;//Date.now();
	//let beforeState = false;/// the previous motion state.

	return {getTransform: function (DeviceMotionEvent){
		// the milliseconds elapsed since the UNIX epoch
		//const nowTime = Date.now(); 
		
		//the miliseconds elapsed since the last DeviceMotionEvent relative to time Origin
		const nowTime = DeviceMotionEvent.timeStamp;
		// how many millisecons have elapsed since last call
		const deltaTime = (nowTime/1000) - (beforeTime/1000);
		//update beforeTime
		beforeTime = nowTime;
		console.log('deltaTime',deltaTime);
	
		/*
		/////the device has been moving with beforeState conditions for deltaTime////
		beforeState includes beforeState.acceleration.x, .y, .z as (meter/sec.) // https://developers.google.com/web/fundamentals/native-hardware/device-orientation#handle_the_device_motion_events
		beforeState includes beforeState.rotationRate.alpha, .gamma, .beta (degree/sec.)  // https://developers.google.com/web/fundamentals/native-hardware/device-orientation#rotation_data
		goal is to return a new ammo js vector and quaternion
		*/
		const a = DeviceMotionEvent.rotationRate.alpha/deltaTime;
		const b = DeviceMotionEvent.rotationRate.beta/deltaTime;
		const g = DeviceMotionEvent.rotationRate.gamma/deltaTime;
		const acceleration = DeviceMotionEvent.acceleration;

		const quat = btGetDeviceMotionStateQuaternion(a,b,g);
		const pos = btGetDeviceMotionStateVector(acceleration.x,acceleration.y,acceleration.z, deltaTime);

		console.log(quat, pos);

		// need to make sure time stamp is accurate
		if(deltaTime >0){
		//return a quaternion and vector that are the new location of device
			return {quat:quat, pos:pos};
		}else{
			return false;
		}
		}
	}

})();

function updateCamera (){
	   //Set the initial perspective for the user
	   //using cam distance constants
	   const X = CAMERA_PERSPECTIVE.x(); 
	   const Y = CAMERA_PERSPECTIVE.y(); 
	   const Z = CAMERA_PERSPECTIVE.z(); 
	   
		/*CHASE CAMERA EFFECT*/
		let relativeCameraOffset = new THREE.Vector3(X,Y,Z);//used to set camera chase distance
		const cameraOffset = relativeCameraOffset.applyMatrix4( PlayerCube.matrixWorld );
		CAMERA.position.x = cameraOffset.x;
		CAMERA.position.y = cameraOffset.y;
		CAMERA.position.z = cameraOffset.z;
		
		CAMERA.lookAt( PlayerCube.position );
	
};

////// hide search bar of iOS device
//     https://stackoverflow.com/questions/10714966/remove-the-url-search-bar-from-android-iphone/14116294
window.addEventListener("load",function() {
	// Set a timeout...
	setTimeout(function(){
	  // Hide the address bar! - this needs work, must coordinate with canvas/video size comment out for now
	 // window.scrollTo(0, 100);
	}, 0);
  }); 

