/*Documentation*/
// https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/ : thanks this article. It is very helpful. If you are going to create a voxel game like Minecraft. You should read this
// https://eddieabbondanz.io/post/voxel/greedy-mesh/ : all meshing method I implemented here is from here. It is made by C#
// THREE.js : the best library for making 3D things
/*---------------------*/
var scene,camera;
const cameraSpeed = 0.5;

const VOXEL_TYPE = {
  AIR_VOXEL: "air_block",
  GRASS_VOXEL: "grass_block",
  ROCK_VOXEL: "rock_block"
};

const FACE = {
  FRONT: 0,
  BACK: 1,
  RIGHT: 2,
  LEFT: 3,
  TOP: 4,
  BOTTOM: 5
}

var MESHING_METHOD = {
  STUPID : 'stupid',
  CULLING: 'culling',
  GREEDY : 'greedy'
};

var CHUNK_SIZE = {
  x2: '2 x 2',
  x4: '4 x 4',
  x8: '8 x 8',
  x16: '16 x 16',
  x32: '32 x 32',
  x64: '64 x 64'
}

var CHUNK_SHAPE = {
  CUBE: 'cube',
  SPHERE: 'sphere',
  SIMPLEX_NOISE_TERRAIN: 'simplex noise terrain',
  PERLIN_NOISE_TERRAIN: 'perlin noise terrain'
}

var f = function(x,y,z,dimensions){
  return (z * dimensions[2] * dimensions[2]) + (y * dimensions[1]) + x;
}

//Precondition: Create a rectangle quad with 4 points and its properties
//return nothing when it is not enough 4 points to create a quad
//Postcondition: return quad instance if it succeed
var Quad = function(p1,p2,p3,p4,properties){
  if(p1 == null || p2 == null || p3 == null || p4 == null
  || typeof p1 === "undefined" || typeof p2 === "undefined" || typeof p3 === "undefined" || typeof p4 === "undefined"){
    console.error("Not enough 4 points to create a quad");
    return null;
  }

  this.p1 = p1 || new THREE.Vector3();
  this.p2 = p2 || new THREE.Vector3();
  this.p3 = p3 || new THREE.Vector3();
  this.p4 = p4 || new THREE.Vector3();

  this.QuadProperties = Object.assign({
    type: VOXEL_TYPE.AIR_VOXEL,
    transparent: true,
    face: FACE.FRONT
  },properties);

  this.getType = () => {return this.QuadProperties.type};
  this.getFace = () => {return this.QuadProperties.face};
  this.isTransparent = () => {return this.transparent};
};

Quad.prototype.equals = function(quad){
  if(this.getType() == quad.getType() && this.isTransparent() == quad.isTransparent()){
    return true;
  }
  return false;
}

var Voxel = function(properties){
  this.VoxelProperties = Object.assign({
    type: VOXEL_TYPE.AIR_VOXEL,
    transparent:true
  },properties);

  this.isTransparent = () => {return this.VoxelProperties.transparent};
  this.getType = () => {return this.VoxelProperties.type};
  this.isSolid = () => {return this.getType() != VOXEL_TYPE.AIR_VOXEL};
}

Voxel.prototype.equals = function(voxel){
  if(this.getType() == voxel.getType() && this.isTransparent() == voxel.isTransparent()){
    return true;
  }
  return false;
};

var MeshBuilder = function(){
  this.verticles = [];
  this.indicates = [];
  this.faceCount = 0;

  this.addPoint = (point) => {
    this.verticles.push(point.x);
    this.verticles.push(point.y);
    this.verticles.push(point.z);
  };
  this.addIndicates = (backface,offset) => {
    if(backface){
      this.indicates.push(0 + offset);
      this.indicates.push(1 + offset);
      this.indicates.push(3 + offset);

      this.indicates.push(1 + offset);
      this.indicates.push(2 + offset);
      this.indicates.push(3 + offset);
    }else{
      this.indicates.push(3 + offset);
      this.indicates.push(1 + offset);
      this.indicates.push(0 + offset);

      this.indicates.push(3 + offset);
      this.indicates.push(2 + offset);
      this.indicates.push(1 + offset);
    }
  }
};

MeshBuilder.prototype.addQuad = function(quad,backface){
  if(backface){
    this.addIndicates(true,4 * this.faceCount);
  }else{
    this.addIndicates(false,4 * this.faceCount);
  }

  this.addPoint(quad.p1);
  this.addPoint(quad.p2);
  this.addPoint(quad.p3);
  this.addPoint(quad.p4);

  this.faceCount++;
}

var MeshGenerator = (function(){
  var sphereF = function(x,y,z,d){
    return ((x - (d[0]/2)) * (x - (d[0]/2)) + (y - (d[1]/2)) * (y - (d[1]/2)) + (z - (d[2]/2)) * (z - (d[2]/2))) <= (d[0] / 2) * (d[1] / 2);
  }

  var cubeF = function(x,y,z,d){
    //nothing to check here :))
    return true;
  }

  var cubeSimplexNoiseF = function(x,y,z,d){
    return y <= Math.abs(noise.simplex2(x / 10,z / 10)) * d[1];
  }

  var cubePerlinNoiseF = function(x,y,z,d){
    return y <= Math.abs(noise.perlin2(x / 10,z / 10)) * d[1];
  }

  this.generateShape = function(rangeLeft,rangeRight,checkingFunction){
    if(rangeLeft.length < 3){
      console.error("This range has not enough dimensions");
      return;
    }

    if(rangeRight.length < 3){
      console.error("This range has not enough dimensions");
      return;
    }

    if(typeof checkingFunction != "function"){
      console.error("Checking function is not valid");
      return;
    }

    let dimensions = [rangeRight[0] - rangeLeft[0],rangeRight[1] - rangeLeft[1],rangeRight[2] - rangeLeft[2]];

    voxels = new Array(dimensions[0],dimensions[1],dimensions[2]);
    var n = 0;
    for(let x = rangeLeft[0];x < rangeRight[0];x++){
      for(let y = rangeLeft[1];y < rangeRight[1];y++){
        for(let z = rangeLeft[2];z < rangeRight[2];z++,n++){
            if(checkingFunction(x,y,z,dimensions)){
              let v = new Voxel({
                type: VOXEL_TYPE.GRASS_VOXEL,
                transparent: false
              });
              voxels[n] = v;
            }else{
              let v = new Voxel({
                type: VOXEL_TYPE.AIR_VOXEL,
                transparent: true
              });
              voxels[n] = v;
          }
        }
      }
    }

    return voxels;
  }

  return{
    generate: function(dimensions,shape){
      if(shape == CHUNK_SHAPE.CUBE){
          return generateShape([0,0,0],dimensions,cubeF);
      }

      if(shape == CHUNK_SHAPE.SPHERE){
        return generateShape([0,0,0],dimensions,sphereF);
      }

      if(shape == CHUNK_SHAPE.SIMPLEX_NOISE_TERRAIN){
        return generateShape([0,0,0],dimensions,cubeSimplexNoiseF);
      }

      if(shape == CHUNK_SHAPE.PERLIN_NOISE_TERRAIN){
        return generateShape([0,0,0],dimensions,cubePerlinNoiseF);
      }
    }
  }
})();

var Chunk = function(dimensions){
  if(dimensions.length < 3){
    console.error("Not enough dimensions to create a chunk");
    return;
  }

  this.Dimensions = [dimensions[0],dimensions[1],dimensions[2]];
  this.Voxels = null;
  this.VOXEL_UNIT = 1;
  this.meshBuilder = null;
  this.objInScene = null;

  this.ContainsPosition = function(position){
    return position[0] >= 0 && position[0] < this.Dimensions[0] && position[1] >= 0 && position[1] < this.Dimensions[1] && position[2] >= 0 && position[2] < this.Dimensions[2];
  }
  this.FlattenPosition = function(position){
    return f(position[0],position[1],position[2],this.Dimensions);
  }
  this.getVoxel = function(position){
    if(!this.ContainsPosition(position)){
      return new Voxel({
        type: VOXEL_TYPE.AIR_VOXEL,
        transparent: true
      });
    }

    return this.Voxels[this.FlattenPosition(position)];
  }
  this.setVoxel = function(position, type, transparent){
    if(!this.ContainsPosition(position)){
      console.error("Chunk is not contain this position: " + position[0] + " " + position[1] + " " + position[2]);
      return;
    }

    let voxel = new Voxel({
      type: type,
      transparent: transparent
    });

    this.Voxels[FlattenPosition(position)] = voxel;
  }
  this.isBlockFaceVisible = function(position, axis, backface){
    let positionClone = [...position];
    positionClone[axis] += backface ? -1 : 1;
    return !this.getVoxel(positionClone).isSolid();
  }.bind(this);
  this.compareStep = function(pos1,pos2,direction,backface){
    let vox1 = this.getVoxel(pos1);
    let vox2 = this.getVoxel(pos2);

    return vox1.equals(vox2) && vox2.isSolid() && this.isBlockFaceVisible(pos2,direction,backface);
  }

  this.stupidMeshing = function(){
    /*This is the simplest meshing algorithm. Everything it need to do that is check if the current voxel is solid or not. If it is, we add all 6 faces of the voxel to the mesh*/
    /*If you look all meshing algorithm, the structure of all meshing method is the same. Just each method has the different condition. With stupid meshing, we just need one condition that is checking solid voxel*/
    this.meshBuilder = new MeshBuilder;
    var direction,workAxis1,workAxis2,startPos,currPos,offsetPos,quadSize,m,n;
    var p1,p2,p3,p4; // 4 points to create a quad
    var mV,nV; // I use this to apply THREE.Vector3 instead an array (because on an array, we cannot do some calculate like adding, subtracting on array. So we need vector. You can use any Vector calculating library. In this case, I am using THREE.Vector3)
    var that = this;

    //iterate each face of a voxel
    for(var face = 0; face < 6; face++){
      //check if we're facing a back face or not
      //You can take a look FACE list on there.
      var backface = face % 2 == 0 ? false : true;

      //direction is 0 that means we are looking the voxel in X axis (0 is X axis, 1 is Y axis, 2 is Z axis)
      direction = face % 3;
      //we will process on a plane that we're looking at. If direction is X then a plane which we're processing is YZ plane.
      workAxis1 = (direction + 1) % 3;
      workAxis2 = (direction + 2) % 3;

      //Just keep here
      startPos = [0,0,0];
      currPos = [0,0,0];

      for(startPos[direction] = 0; startPos[direction] < this.Dimensions[direction];startPos[direction]++){
        for(startPos[workAxis1] = 0; startPos[workAxis1] < this.Dimensions[workAxis1]; startPos[workAxis1]++){
          for(startPos[workAxis2] = 0; startPos[workAxis2] < this.Dimensions[workAxis2]; startPos[workAxis2]++){

            let startVoxel = this.getVoxel(startPos);

            if(!startVoxel.isSolid()){
              continue;
            }

            quadSize = [0,0,0];

            quadSize[workAxis2] = this.VOXEL_UNIT;
            quadSize[workAxis1] = this.VOXEL_UNIT;

            m = [0,0,0];
            n = [0,0,0];

            m[workAxis1] = quadSize[workAxis1];
            n[workAxis2] = quadSize[workAxis2];

            //clone the startPos array by this way. Do not copy an array like this: array1 = array2
            //you are copy the reference of the array that is not the value of the array. So when array1 change then array2 will be changed unexpectedly
            offsetPos = [...startPos];
            offsetPos[direction] += backface ? 0 : 1;

            //add quad
            mV = new THREE.Vector3().fromArray(m,0);
            nV = new THREE.Vector3().fromArray(n,0);
            p1 = new THREE.Vector3().fromArray(offsetPos,0);
            p2 = new THREE.Vector3().addVectors(p1,mV);
            p3 = new THREE.Vector3().addVectors(p2,nV);
            p4 = new THREE.Vector3().addVectors(p1,nV);

            let q = new Quad(p1,p2,p3,p4,{
              type: startVoxel.getType(),
              transparent: startVoxel.isTransparent()
            });

            this.meshBuilder.addQuad(q,backface);
          }
        }
      }
    }
  }
  this.cullingMeshing = function(){
    //With this method. We just add one more condition that is checking the face that we are processing that is visible or not. If it is not, don't render it.
    //We check the visible by checking the next voxel of this voxel in the direction is solid or not. If that voxel is solid, then the face which we're processing should not render.
    //Everything here stay the same (look stupidMeshing) expect one more condition
    this.meshBuilder = new MeshBuilder;
    var direction,workAxis1,workAxis2,startPos,currPos,offsetPos,quadSize,m,n;
    var p1,p2,p3,p4,mV,nV;
    var that = this;

    for(var face = 0; face < 6; face++){
      var backface = face % 2 == 0 ? false : true;

      direction = face % 3;
      workAxis1 = (direction + 1) % 3;
      workAxis2 = (direction + 2) % 3;

      startPos = [0,0,0];
      currPos = [0,0,0];

      for(startPos[direction] = 0; startPos[direction] < this.Dimensions[direction];startPos[direction]++){
        for(startPos[workAxis1] = 0; startPos[workAxis1] < this.Dimensions[workAxis1]; startPos[workAxis1]++){
          for(startPos[workAxis2] = 0; startPos[workAxis2] < this.Dimensions[workAxis2]; startPos[workAxis2]++){

            let startVoxel = this.getVoxel(startPos);

            if(!startVoxel.isSolid() || !that.isBlockFaceVisible(startPos,direction,backface)){
              continue;
            }

            quadSize = [0,0,0];

            quadSize[workAxis2] = this.VOXEL_UNIT;
            quadSize[workAxis1] = this.VOXEL_UNIT;

            m = [0,0,0];
            n = [0,0,0];

            m[workAxis1] = quadSize[workAxis1];
            n[workAxis2] = quadSize[workAxis2];

            offsetPos = [...startPos];
            offsetPos[direction] += backface ? 0 : 1;

            mV = new THREE.Vector3().fromArray(m,0);
            nV = new THREE.Vector3().fromArray(n,0);
            p1 = new THREE.Vector3().fromArray(offsetPos,0);
            p2 = new THREE.Vector3().addVectors(p1,mV);
            p3 = new THREE.Vector3().addVectors(p2,nV);
            p4 = new THREE.Vector3().addVectors(p1,nV);

            let q = new Quad(p1,p2,p3,p4,{
              type: startVoxel.getType(),
              transparent: startVoxel.isTransparent()
            });

            this.meshBuilder.addQuad(q,backface);
          }
        }
      }
    }
  }
  this.greedyMeshing = function(){
    //With greedy meshing, it is quite hard for me @@.
    //We create a boolean array (merged array) which handle status of all quads in the direction (not yet process or processed)
    //if the quad is processed, we just ignore it.
    this.meshBuilder = new MeshBuilder;
    var direction,workAxis1,workAxis2,startPos,currPos,offsetPos,quadSize,m,n;
    var merged = [];
    var p1,p2,p3,p4,mV,nV;
    var that = this;

    for(var face = 0; face < 6; face++){
      var backface = face % 2 == 0 ? false : true;

      direction = face % 3;
      workAxis1 = (direction + 1) % 3;
      workAxis2 = (direction + 2) % 3;

      startPos = [0,0,0];
      currPos = [0,0,0];

      for(startPos[direction] = 0; startPos[direction] < this.Dimensions[direction];startPos[direction]++){
        //reset merged if we've done before
        for(let i = 0; i < this.Dimensions[workAxis1];i++){
          merged[i] = [];
          for(let j = 0; j < this.Dimensions[workAxis2];j++){
            merged[i][j] = false;
          }
        }

        for(startPos[workAxis1] = 0; startPos[workAxis1] < this.Dimensions[workAxis1]; startPos[workAxis1]++){
          for(startPos[workAxis2] = 0; startPos[workAxis2] < this.Dimensions[workAxis2]; startPos[workAxis2]++){

            let startVoxel = this.getVoxel(startPos);

            if(merged[startPos[workAxis1]][startPos[workAxis2]] == true || !startVoxel.isSolid() || !that.isBlockFaceVisible(startPos,direction,backface)){
              continue;
            }

            quadSize = [0,0,0];

            //figure out width
            for(currPos = [...startPos],currPos[workAxis2]++;currPos[workAxis2] < this.Dimensions[workAxis2] && this.compareStep(startPos,currPos,direction,backface) && !merged[currPos[workAxis1]][currPos[workAxis2]];currPos[workAxis2]++){}
            quadSize[workAxis2] = currPos[workAxis2] - startPos[workAxis2];

            //figure out height
            for(currPos = [...startPos],currPos[workAxis1]++;currPos[workAxis1] < this.Dimensions[workAxis1] && this.compareStep(startPos,currPos,direction,backface) && !merged[currPos[workAxis1]][currPos[workAxis2]];currPos[workAxis1]++){
              for(currPos[workAxis2] = startPos[workAxis2];currPos[workAxis2] < this.Dimensions[workAxis2] && this.compareStep(startPos,currPos,direction,backface) && !merged[currPos[workAxis1]][currPos[workAxis2]];currPos[workAxis2]++){}

              if(currPos[workAxis2] - startPos[workAxis2] < quadSize[workAxis2]){
                break;
              }else{
                currPos[workAxis2] = startPos[workAxis2];
              }
            }
            quadSize[workAxis1] = currPos[workAxis1] - startPos[workAxis1];

            m = [0,0,0];
            n = [0,0,0];

            m[workAxis1] = quadSize[workAxis1];
            n[workAxis2] = quadSize[workAxis2];

            offsetPos = [...startPos];
            offsetPos[direction] += backface ? 0 : 1;

            mV = new THREE.Vector3().fromArray(m,0);
            nV = new THREE.Vector3().fromArray(n,0);
            p1 = new THREE.Vector3().fromArray(offsetPos,0);
            p2 = new THREE.Vector3().addVectors(p1,mV);
            p3 = new THREE.Vector3().addVectors(p2,nV);
            p4 = new THREE.Vector3().addVectors(p1,nV);

            let q = new Quad(p1,p2,p3,p4,{
              type: startVoxel.getType(),
              transparent: startVoxel.isTransparent()
            });

            this.meshBuilder.addQuad(q,backface);

            for(var f = 0; f < quadSize[workAxis1];f++){
              for(var g = 0; g < quadSize[workAxis2];g++){
                merged[startPos[workAxis1] + f][startPos[workAxis2] + g] = true;
              }
            }
          }
        }
      }
    }
  }
}

Chunk.prototype.Generate = function(meshingMethod){
  if(meshingMethod == MESHING_METHOD.GREEDY){
    this.greedyMeshing();
  }else if(meshingMethod == MESHING_METHOD.CULLING){
    this.cullingMeshing();
  }else if(meshingMethod == MESHING_METHOD.STUPID){
    this.stupidMeshing();
  }else{
    console.error("Please provide a correct meshing method");
  }
}

Chunk.prototype.GenerateTerrain = function(shape){
  if(typeof shape === "undefined") shape = CHUNK_SHAPE.CUBE;
  this.Voxels = MeshGenerator.generate(this.Dimensions,shape);
};

Chunk.prototype.RenderToScene = function(scene){
  if(!scene){
    console.error("There is no scene to render. Please provice a scene");
    return;
  }

  if(chunk.meshBuilder.verticles.length == 0 || chunk.meshBuilder.indicates.length == 0){
    console.error("Not enough verticle to render. Might you forget generating a chunk first?");
    return;
  }

  this.objInScene = createBufferGeometry(chunk.meshBuilder.verticles,chunk.meshBuilder.indicates,0xff000,lastOptionsChosen.lastWireFrameChosen);
  scene.add(this.objInScene);
}

/*GLOBAL*/
var scene, chunk, axes, guiControls, boundingBox;

var lastOptionsChosen = {
  lastAxesChosen: true,
  lastMeshingChosen: MESHING_METHOD.GREEDY,
  lastWireFrameChosen: true,
  lastChunkSizeChosen: CHUNK_SIZE.x4,
  lastChunkShapeChosen: CHUNK_SHAPE.SPHERE,
  lastBoundingBoxChosen: true,
  enableWarning: false
}
/*-----------*/

function KeyInputCallback(e){
  if(e.keyCode == 87){
    camera.position.z -= cameraSpeed;
  }

  if(e.keyCode == 83){
    camera.position.z += cameraSpeed;
  }

  if(e.keyCode == 65){
    camera.position.x -= cameraSpeed;
  }

  if(e.keyCode == 68){
    camera.position.x += cameraSpeed;
  }
}

var initSceneWithOptions = function(){
  if(scene == null){
    console.warn("Scene is not initialized. Create a new scene");
    scene = new THREE.Scene();
  }

  if(lastOptionsChosen.lastAxesChosen){
    addAxesToScene();
  }else{
    removeAxesFromScence();
  }
}

var resetScene = function(){
  if(scene == null){
    console.error('Scene is not initialized');
    return;
  }
  while(scene.children.length > 0){ scene.remove(scene.children[0]); }

  chunk = null;
  axes = null;

  initSceneWithOptions();
}

var addAxesToScene = function(){
  if(!scene){
    console.error('Scene is not initialized');
    return;
  }

  if(axes != null){
    console.error('Axes have been enabled already');
    return;
  }

  axes = new THREE.AxesHelper(5);
  scene.add(axes);
}

var removeAxesFromScence = function(){
  if(!scene){
    console.error('Scene is not initialized');
    return;
  }

  if(axes == null){
    console.error('Axes have not been enabled yet');
    return;
  }

  scene.remove(axes);
  axes = null;
}

var createBufferGeometry = function(verticles,indicates,color,wireframe){
    if(wireframe){
      geometry = new THREE.BufferGeometry();
      geometry.setIndex(indicates);
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(verticles),3));
      var material = new THREE.MeshBasicMaterial( { color: color } );

      wireframe = new THREE.WireframeGeometry( geometry );

      var line = new THREE.LineSegments( wireframe );
      line.material.depthTest = false;
      line.material.opacity = 0.25;
      line.material.transparent = true;

      return line;
    }

    geometry = new THREE.BufferGeometry();
    geometry.setIndex(indicates);
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(verticles),3));
    var material = new THREE.MeshBasicMaterial( { color: color } );

    var mesh = new THREE.Mesh(geometry,material);

    return mesh;
}

var determineChunkSizeFromControls = function(value){
  if(value == CHUNK_SIZE.x2){
    lastOptionsChosen.lastChunkSizeChosen = value;
    return [2,2,2];
  }

  if(value == CHUNK_SIZE.x4){
    lastOptionsChosen.lastChunkSizeChosen = value;
    return [4,4,4];
  }

  if(value == CHUNK_SIZE.x8){
    lastOptionsChosen.lastChunkSizeChosen = value;
    return [8,8,8];
  }

  if(value == CHUNK_SIZE.x16){
    lastOptionsChosen.lastChunkSizeChosen = value;
    return [16,16,16];
  }

  if(value == CHUNK_SIZE.x32){
    if(lastOptionsChosen.enableWarning == true){
      if(window.confirm('Are you sure? This option will hit the computer performance')){
        lastOptionsChosen.lastChunkSizeChosen = value;
        return [32,32,32];
      }
    }else{
      return [32,32,32];
    }
  }
  if(value == CHUNK_SIZE.x64){
    if(lastOptionsChosen.enableWarning == true){
      if(window.confirm("What??? Are you really sure about this? This dam option will kill your computer, dude")){
        if(window.confirm("Oh come on !!! Seriously???")){
          lastOptionsChosen.lastChunkSizeChosen = value;
          return [64,64,64];
        }
      }
    }else{
      return [64,64,64];
    }
  }
}

var createChunk = function(){
  if(chunk != null){
    console.warn("Chunk has initialized already. Create a new one");
    chunk = null;
  }

  chunk = new Chunk(determineChunkSizeFromControls(lastOptionsChosen.lastChunkSizeChosen));
  chunk.GenerateTerrain(lastOptionsChosen.lastChunkShapeChosen);
  chunk.Generate(lastOptionsChosen.lastMeshingChosen);
  chunk.RenderToScene(scene);

  if(lastOptionsChosen.lastBoundingBoxChosen){
    if(boundingBox){
      scene.remove(boundingBox);
    }
    boundingBox = new THREE.BoxHelper( chunk.objInScene, 0xffff00 );
    scene.add( boundingBox );
  }else{
    if(boundingBox){
      scene.remove(boundingBox);
    }
  }

  //update Mesh Info on GUI
  guiControls.faceCount = chunk.meshBuilder.faceCount;
  guiControls.verticles = chunk.meshBuilder.faceCount * 4;
}

function main(){
  /*Init GUI*/
  //Stats monitor
  var stats=  new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  //dat gui library
  guiControls = {
    /*For Guideline*/
    moving : 'W,S,A,D',
    rotating : 'Left Mouse',
    changeCameraPivot: 'Right Mouse',
    zoom : 'Scroll Mouse',
    xAxis : "Red Line",
    yAxis : "Green Line",
    zAxis : "Blue Line",
    /*-------------*/
    meshingMethod : lastOptionsChosen.lastMeshingChosen,
    showAxes : lastOptionsChosen.lastAxesChosen,
    showBoundingBox: lastOptionsChosen.lastBoundingBoxChosen,
    wireFrame : lastOptionsChosen.lastWireFrameChosen,
    size : lastOptionsChosen.lastChunkSizeChosen,
    shape: lastOptionsChosen.lastChunkShapeChosen,
    faceCount : -1,
    verticles : -1,
  }

  const gui = new dat.GUI();

  /*Guideline GUI*/
  var guidelineFolder = gui.addFolder("Guideline");
  guidelineFolder.add(guiControls,'moving');
  guidelineFolder.add(guiControls,'rotating');
  guidelineFolder.add(guiControls,'changeCameraPivot');
  guidelineFolder.add(guiControls,'zoom');
  guidelineFolder.add(guiControls,'xAxis');
  guidelineFolder.add(guiControls,'yAxis');
  guidelineFolder.add(guiControls,'zAxis');
  guidelineFolder.open();
  /*-------------*/

  var optionsFolder = gui.addFolder("Options");
  var meshingGuiController = optionsFolder.add(guiControls,'meshingMethod',[ MESHING_METHOD.STUPID, MESHING_METHOD.CULLING, MESHING_METHOD.GREEDY ]);
  var axesGuiController = optionsFolder.add(guiControls,'showAxes');
  var boundingBoxGuiController = optionsFolder.add(guiControls,'showBoundingBox');
  var wireFrameGuiController = optionsFolder.add(guiControls,'wireFrame');
  var chunkSizeGuiController = optionsFolder.add(guiControls,'size',[CHUNK_SIZE.x2,CHUNK_SIZE.x4,CHUNK_SIZE.x8,CHUNK_SIZE.x16,CHUNK_SIZE.x32,CHUNK_SIZE.x64]);
  var chunkShapeGuiController = optionsFolder.add(guiControls,'shape',[CHUNK_SHAPE.CUBE,CHUNK_SHAPE.SPHERE,CHUNK_SHAPE.SIMPLEX_NOISE_TERRAIN,CHUNK_SHAPE.PERLIN_NOISE_TERRAIN]);
  optionsFolder.open();

  var infoFolder = gui.addFolder("Mesh Info");
  var faceCount = infoFolder.add(guiControls,'faceCount').listen();
  faceCount.domElement.style.pointerEvents = "none";
  faceCount.domElement.style.opacity = .5;
  var verticlesCount = infoFolder.add(guiControls,'verticles').listen();
  verticlesCount.domElement.style.pointerEvents = "none";
  verticlesCount.domElement.style.opacity = .5;
  infoFolder.open();

  /*------------------***----------------------*/

  /*GUI Events*/
  axesGuiController.onFinishChange(function(value){
      if(value == true){
        addAxesToScene();
      }else{
        removeAxesFromScence();
      }
      lastAxesChosen = value;
  });

  boundingBoxGuiController.onFinishChange(function(value){
    lastOptionsChosen.lastBoundingBoxChosen = value;

    if(value == false){
      if(boundingBox != null){
        if(scene != null){
          scene.remove(boundingBox);
        }
      }
    }else{
      //prevent overdrawing
      if(boundingBox != null){
        if(scene != null){
          scene.remove(boundingBox);
        }
      }
      if(chunk != null){
        boundingBox = new THREE.BoxHelper( chunk.objInScene, 0xffff00 );
        scene.add( boundingBox );
      }else{
        console.error("No chunk to bound a box");
      }
    }
  });

  meshingGuiController.onFinishChange(function(value){
    resetScene();
    lastOptionsChosen.lastMeshingChosen = value;
    lastOptionsChosen.enableWarning = false;
    createChunk();
  });

  wireFrameGuiController.onFinishChange(function(value){
    resetScene();
    lastOptionsChosen.lastWireFrameChosen = value;
    lastOptionsChosen.enableWarning = false;
    createChunk();
  });

  chunkSizeGuiController.onFinishChange(function(value){
    resetScene();
    lastOptionsChosen.enableWarning = true;
    lastOptionsChosen.lastChunkSizeChosen = value;
    createChunk();
  });

  chunkShapeGuiController.onFinishChange(function(value){
    resetScene();
    lastOptionsChosen.lastChunkShapeChosen = value;
    lastOptionsChosen.enableWarning = false;
    createChunk();
  });

  initSceneWithOptions();

  camera = new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,1000);
  camera.position.z -= 20;
  camera.position.y += 10;
  camera.position.x -= 10;

  var renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth,window.innerHeight);
  document.body.appendChild(renderer.domElement);

  cameraControls	= new THREE.TrackballControls( camera, document.body )

  //first init
  createChunk();

  function animate(){
    //update stats
    stats.begin();
    stats.end();
    requestAnimationFrame(animate);
    cameraControls.update();
    renderer.render(scene,camera);
  }

  animate();

  document.addEventListener("keydown",KeyInputCallback);
}

//entry point here
main();
