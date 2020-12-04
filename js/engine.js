//GLOBAL General variables


const iphone_consts = {
    video:{
        width:window.innerWidth,
        height:window.innerHeight,
        facingMode: { 
            // require the rear camera
            exact: "environment" 
        }
    }
}

//if iPhone user agent, ONLY set video constraint, else include audio and width/height
const constraints = navigator.userAgent.includes("iPhone") ? iphone_consts: {
    audio:true,
      video: {
          width: { ideal: 640 },
          height: {ideal: 400 }
          }    
    };

//Chain the .then() of the media Promise since these take time and
//want to make sure they all complete in order
const VIDEO_ELEMENT = navigator.mediaDevices.getUserMedia(constraints)
.then(setCameraAsVideoSrc)
.then(backgroundCanvas)
.then(startItAll);

function setCameraAsVideoSrc(stream){
    const videoELement = document.createElement("video");//create an HTML5 video element
    videoELement.setAttribute.autoplay = true;
    videoELement.setAttribute('id','backgroundVideoElement')
    videoELement.srcObject = stream;
    //this needs to go to the backgroundCanvas() so must return it to pass to next then()

     //GET div to attach our video to the background canvas
     const container = document.getElementById('container');
    container.appendChild(videoELement);
    console.log('jump')
    return videoELement;
}

function backgroundCanvas (videoELement){
   
    //SECOND CANVAS
	//this canvas is our background that will display the users camera feed
	 const back_canvas = document.createElement("canvas");
     const back_ctx = back_canvas.getContext("2d");//set drawing context as a global
     //make it cover the full screen
     back_canvas.width = window.innerWidth;
     back_canvas.height = window.innerHeight;
     back_canvas.style.position = 'fixed';
     //keep our background at lowest level
     back_canvas.setAttribute('style','z-index:0');
     //add to the container
     container.appendChild(back_canvas);
    console.log('try')
     return [videoELement,back_ctx]
}

function startItAll (ary_vid_ctx){
    //ary_vid_ctx is an array and ctx 

    // https://stackoverflow.com/questions/19893336/how-can-i-pass-argument-with-requestanimationframe
    //const imgElement = document.getElementById('backgroundVideoElement');
    //'draw' the video onto the canvas, starting top left so it's full screen
    ary_vid_ctx[1].drawImage(ary_vid_ctx[0],0,0);
    console.log(ary_vid_ctx);
    window.requestAnimationFrame(startItAll.bind(startItAll,ary_vid_ctx));
}


startItAll(VIDEO_ELEMENT);

function theLoop(x) {
    anim.update(x);
    anim.redraw(x);
    window.requestAnimationFrame(anim.mainFunc.bind(anim,x));
}

function animation_loop(){
    //use requestAnimationFrame() to keep looping

    

    /* https://docs.opencv.org/master/d4/dc6/tutorial_py_template_matching.html
    # All the 6 methods for comparison in a list
    methods = ['cv.TM_CCOEFF', 'cv.TM_CCOEFF_NORMED', 'cv.TM_CCORR',
            'cv.TM_CCORR_NORMED', 'cv.TM_SQDIFF', 'cv.TM_SQDIFF_NORMED']
    
    # Apply template Matching
    res = cv.matchTemplate(img,template,method)
    */

   let mat = cv.imread(imgElement);
   cv.imshow('backgroundVideoElement', mat);
   mat.delete();
}



