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

//REPRESENTATION OF THE PLAYER
let PlayerCube = null;// PlayerCube = createPlayerCube() 

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
//VIDEO_ELEMENT.setAttribute.autoplay = true;
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
        VIDEO_ELEMENT.onloadedmetadata = function(e) { VIDEO_ELEMENT.play(); };
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
    const far = 500;
    let CAM_X = 0;
    let CAM_Y = 0; 
    let CAM_Z = -7;//Set the initial perspective for the user

   //CAMERA = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.2, 2000 );	
   CAMERA = new THREE.PerspectiveCamera( fov,aspect,near,far );	 
   //mess around with these parameters to adjust CAMERA perspective view point
    CAMERA.position.x = CAM_X;
	CAMERA.position.y = CAM_Y;
    CAMERA.position.z =  CAM_Z;
				
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
	var ambientLight = new THREE.AmbientLight( 0x404040 );
	//ambientLight is for whole SCENE, use directionalLight for point source/spotlight effect
    SCENE.add( ambientLight );

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
		
		//add cube to graphics world
		SCENE.add( cube );
		
		//add physics portion of cube to world
		PHYSICS_WORLD.addRigidBody( cube.userData.physicsBody );
		*/

		///INVISIBLE GROUND
		//change and reuse pos for the ground		
		pos.set( 0, 0, 0 );//-y so it's under objects
		//note arg 4 is mass, set to 0 so that ground is static object
		var ground = createTransparentObject(2000,1,2000,0,pos,quat)
		PHYSICS_WORLD.addRigidBody( ground);
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
	
	//attach the physic properties to the graphic object
	Cube.userData.physicsBody = ammoCube;
	
	//Cube contains both our graphic and physics components
	return Cube;
}

function initInput() {
	//VIEW CONTROL
	/*contorl our CAMERA and move around our world.*/
    CONTROLS = new THREE.OrbitControls( CAMERA );
	CONTROLS.target.y = 2;
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
            
            //get the physical location of our object
            var p = TRANSFORM_AUX1.getOrigin();
            //get the physical orientation of our object
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
    var x=.5;//meters
    var y=.5;//meters
    var z=.5;//meters
    var mass = 1;//kg
    

    var pos =  PlayerCube.position;
    pos.addVectors(pos,new THREE.Vector3(0,2,0));
    
    var quat = new THREE.Quaternion();
    
    //assign random color when creating the new mesh
    //const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff } );

    const material = new THREE.MeshBasicMaterial({ color: 0xff0000} );

    var cube = createGrapicPhysicBox(x,y,z,mass,pos,quat,material);
    console.log(cube)
    
    /*DO NOT ENABLE cast shadow for these blocks system performance will be terrible!
    It's ok if they receive though.*/
//	cube.castShadow = true;
    //cube.receiveShadow = true;
    
    //////////////// ADD THIS - see git repo game1  https://github.com/reliableJARED/WebGL/blob/gh-pages/static/js/game1.js#L563
    //weaker then our main object
    //cube.userData.breakApart = new breakApart(15);
            
    //add our cube to our array, scene and physics world.
    RIGID_BODIES.push(cube);
    SCENE.add( cube );//Graphics add
    PHYSICS_WORLD.addRigidBody( cube.userData.physicsBody );// Physics add	
    /*
    TODO:
    add the current speed/direction of PlayerCube to the shot
    correct for orientation
    */
    
               var thrustZ = PlayerCube.userData.shotFireForce * Math.cos(PlayerCube.rotation._y);
               var thrustX = PlayerCube.userData.shotFireForce * Math.sin(PlayerCube.rotation._y);
               
               //used to determine if thrust in the z should be pos or neg
               var Zquad ;

               var QUAT = PlayerCube.quaternion._y;
            //   console.log(QUAT);
            
            /*determine what direction our player is facing and the correction neg/pos for applied fire force*/
             if( (QUAT > 0.74 && QUAT < 1.0) || (QUAT > -1  && QUAT < -0.74 )  ){Zquad=-1}
             else {Zquad=1}
             
              cube.userData.physicsBody.applyCentralImpulse(new Ammo.btVector3( thrustX,0,thrustZ*Zquad ));
    
    
    //destroy the shot in 5000 miliseconds (5 seconds)
    //removes it from the world so we don't litter with bullets
    destructionTimer(cube,5000);	
    
}

function createPlayerCube(){
    //PlayerCube is what the other players will see.  However, it's not visible to the local user because it's just behind the field of view
    //need to keep track of its orientation so that when we shoot, it looks like it's coming from the camera

	//properties used to make objects
		var x=2;//meters
		var y=2;//meters
		var z=2;//meters
		var mass = 0;// kg -- BUT if 0 will have infinity mass and not move or be affected by gravity
		var pos = new THREE.Vector3(0,0,0);	
		var quat = new THREE.Quaternion();
		
		//create a graphic and physic component for our PlayerCube
		//NOTE! pass vertexColors because each cube face will be random color
        //var material = new THREE.MeshPhongMaterial( { color: "rgba(33%, 34%, 33%,256)", vertexColors: THREE.FaceColors,transparent:true} );
        const material = new THREE.MeshBasicMaterial( { color: "rgba(33%, 34%, 33%,256)", vertexColors: THREE.FaceColors,transparent:true, opacity:0.1} );

        PlayerCube = createGrapicPhysicBox(x,y,z,mass,pos,quat,material,true);//bool at the end means random color for each cube face
        
        //no shadows
		PlayerCube.castShadow = false;
        PlayerCube.receiveShadow = false;
        
        //DEBUG HELP
		console.log(PlayerCube);//inspect to see whats availible
		console.log(PlayerCube.userData.physicsBody.getUserPointer());
		console.log(PlayerCube.userData.physicsBody.getUserIndex());
		
		//log total damage on player, 'life' of player
		PlayerCube.userData.totalDmg = 0;

        /****** IMPORTANT LOCATION PROPERTIES - will be set from Phone Movement */
		//torque force for turning
		PlayerCube.userData.RotationForce = 3;
		
		//forward reverse movement force
		PlayerCube.userData.MovementForce = 3;
		
		//used to limit constant accelleration
		PlayerCube.userData.TopSpeed = 25;
		
		//force that bullets are shot at
		PlayerCube.userData.shotFireForce = 100;
		
		//IMPORTANT!
		//hardcode prevention of Z and X rotation. Can only rotate around Y
	//	PlayerCube.userData.physicsBody.setAngularFactor(new Ammo.btVector3(0,1,0));
	//	PlayerCube.userData.physicsBody.setLinearFactor(new Ammo.btVector3(1,1,1));
				
		//add our PlayerCube to our array, scene and physics world.
		RIGID_BODIES.push(PlayerCube);
		SCENE.add( PlayerCube );
		PHYSICS_WORLD.addRigidBody( PlayerCube.userData.physicsBody );
		
		
		
		
		/*
		Future:
		to add other geometry to our cube:
		// Create a Point2Point constraint to keep two objects bound together
		// position_a is the point of constraint relative to object_a's position
		// position_b is the point of constraint relative to object_b's position
		var constraint = new Ammo.btPoint2PointConstraint(
			object_a,
			object_b,
			new Ammo.btVector3( position_a.x, position_a.y, position_a.z ),
			new Ammo.btVector3( position_b.x, position_b.y, position_b.z )
			);
		physicsWorld.addConstraint( constraint );
        */
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


//FIRE A SHOUT WITH 
window.addEventListener('touchstart',clickShootCube,false);
document.addEventListener("keydown", clickShootCube, false);