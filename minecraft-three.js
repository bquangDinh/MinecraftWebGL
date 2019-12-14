var scene,camera;
const cameraSpeed = 0.5;

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
  STUPID : 0,
  CULLING: 1,
  GREEDY : 2
};

var CHUNK_SIZE = {
  x2: '2 x 2',
  x4: '4 x 4',
  x8: '8 x 8',
  x16: '16 x 16'
}

var Quad = function(p1,p2,p3,p4,properties){
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
  var voxels = new Array();

  return{
    Generate: function(dimensions){
      if(dimensions.length < 3){
        console.error('Not enough dimensions to generate mesh');
        return null;
      }
      for(var x = 0; x < dimensions[0]; x++){
        for(var y = 0; y < dimensions[1]; y++){

          var height = Math.abs(noise.perlin2(x / 2,y / 2));
          height *= dimensions[1];
          height = parseInt(height);
          if(height == 0) height = 1;

          for(var z = 0; z < dimensions[2]; z++){
            if(z > height){
              let voxel = new Voxel({
                type:VOXEL_TYPE.GRASS_VOXEL,
                transparent:false
              });
              voxels.push(voxel);
            }else{
              let voxel = new Voxel({
                type:VOXEL_TYPE.AIR_VOXEL,
                transparent:true
              });
              voxels.push(voxel);
            }
          }
        }
      }
      return voxels;
    }
  }
})();

var Chunk = function(){
  this.CHUNK_SIZE = 4;
  this.Voxels = null;
  this.VOXEL_UNIT = 1;
  this.mesnBuider = null;

  this.ContainsPosition = function(position){
    return position[0] >= 0 && position[0] < this.CHUNK_SIZE && position[1] >= 0 && position[1] < this.CHUNK_SIZE && position[2] >= 0 && position[2] < this.CHUNK_SIZE;
  }
  this.FlattenPosition = function(position){
    return (position[2] * this.CHUNK_SIZE * this.CHUNK_SIZE) + (position[1] * this.CHUNK_SIZE) + position[0];
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
    this.meshBuider = new MeshBuilder;
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

      for(startPos[direction] = 0; startPos[direction] < this.CHUNK_SIZE;startPos[direction]++){
        for(startPos[workAxis1] = 0; startPos[workAxis1] < this.CHUNK_SIZE; startPos[workAxis1]++){
          for(startPos[workAxis2] = 0; startPos[workAxis2] < this.CHUNK_SIZE; startPos[workAxis2]++){

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

            this.meshBuider.addQuad(q,backface);
          }
        }
      }
    }
  }
  this.cullingMeshing = function(){
    this.meshBuider = new MeshBuilder;
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

      for(startPos[direction] = 0; startPos[direction] < this.CHUNK_SIZE;startPos[direction]++){
        for(startPos[workAxis1] = 0; startPos[workAxis1] < this.CHUNK_SIZE; startPos[workAxis1]++){
          for(startPos[workAxis2] = 0; startPos[workAxis2] < this.CHUNK_SIZE; startPos[workAxis2]++){

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

            this.meshBuider.addQuad(q,backface);
          }
        }
      }
    }
  }

  this.greedyMeshing = function(){
    this.meshBuider = new MeshBuilder;
    var direction,workAxis1,workAxis2,startPos,currPos,offsetPos,quadSize,m,n;
    var merged = [];
    var p1,p2,p3,p4,mV,nV;
    var that = this;

    for(let i = 0; i < this.CHUNK_SIZE;i++){
      merged[i] = [];
      for(let j = 0; j < this.CHUNK_SIZE;j++){
        merged[i][j] = false;
      }
    }

    for(var face = 0; face < 6; face++){
      var backface = face % 2 == 0 ? false : true;

      direction = face % 3;
      workAxis1 = (direction + 1) % 3;
      workAxis2 = (direction + 2) % 3;

      startPos = [0,0,0];
      currPos = [0,0,0];

      for(startPos[direction] = 0; startPos[direction] < this.CHUNK_SIZE;startPos[direction]++){
        //reset merged if we've done before
        for(let i = 0; i < this.CHUNK_SIZE;i++){
          merged[i] = [];
          for(let j = 0; j < this.CHUNK_SIZE;j++){
            merged[i][j] = false;
          }
        }

        for(startPos[workAxis1] = 0; startPos[workAxis1] < this.CHUNK_SIZE; startPos[workAxis1]++){
          for(startPos[workAxis2] = 0; startPos[workAxis2] < this.CHUNK_SIZE; startPos[workAxis2]++){

            let startVoxel = this.getVoxel(startPos);

            if(merged[startPos[workAxis1]][startPos[workAxis2]] == true || !startVoxel.isSolid() || !that.isBlockFaceVisible(startPos,direction,backface)){
              continue;
            }

            quadSize = [0,0,0];

            //figure out width
            for(currPos = [...startPos],currPos[workAxis2]++;currPos[workAxis2] < this.CHUNK_SIZE && this.compareStep(startPos,currPos,direction,backface) && !merged[currPos[workAxis1]][currPos[workAxis2]];currPos[workAxis2]++){}
            quadSize[workAxis2] = currPos[workAxis2] - startPos[workAxis2];

            //figure out height
            for(currPos = [...startPos],currPos[workAxis1]++;currPos[workAxis1] < this.CHUNK_SIZE && this.compareStep(startPos,currPos,direction,backface) && !merged[currPos[workAxis1]][currPos[workAxis2]];currPos[workAxis1]++){
              for(currPos[workAxis2] = startPos[workAxis2];currPos[workAxis2] < this.CHUNK_SIZE && this.compareStep(startPos,currPos,direction,backface) && !merged[currPos[workAxis1]][currPos[workAxis2]];currPos[workAxis2]++){}

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

            this.meshBuider.addQuad(q,backface);

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

Chunk.prototype.GenerateTerrain = function(){
  this.Voxels = MeshGenerator.Generate([this.CHUNK_SIZE,this.CHUNK_SIZE,this.CHUNK_SIZE]);
};

/*GLOBAL*/
var scene, chunk, axes;
var lastMeshingChosen = MESHING_METHOD.GREEDY;
var lastAxesChosen = true;

/*-----------*/

var resetScene = function(scene,properties){
  if(!scene){
    console.error('Scene is not initialized');
    return;
  }
  while(scene.children.length > 0){ scene.remove(scene.children[0]); }
  axes = null;

  if(properties){
    if(properties.axes){
      addAxesToScene();
    }
  }
}

var initScene = function(properties){
  let sceneProperties = Object.assign({
    axes: true
  },properties);

  scene = new THREE.Scene();
  if(sceneProperties.axes == true){
    axes = new THREE.AxesHelper(5);
    scene.add(axes);
  }
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
  if(value == CHUNK_SIZE.x2) return 2;
  if(value == CHUNK_SIZE.x4) return 4;
  if(value == CHUNK_SIZE.x8) return 8;
  if(value == CHUNK_SIZE.x16) return 16;
}

function main(){
  /*Init GUI*/
  //Stats monitor
  var stats=  new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  //dat gui library
  var guiControls = function(){
    this.meshingMethod = 'greedy';
    this.moving = 'W,S,A,D';
    this.rotating = 'Left Mouse';
    this.zoom = 'Scroll Mouse';
    this.showAxes = true;
    this.wireFrame = true;
    this.size = CHUNK_SIZE.x4;
  }

  var controls = new guiControls;

  const gui = new dat.GUI();
  gui.add(controls,'moving');
  gui.add(controls,'rotating');
  gui.add(controls,'zoom');
  var meshingGuiController = gui.add(controls,'meshingMethod',[ 'stupid', 'culling', 'greedy' ]);
  var axesGuiController = gui.add(controls,'showAxes');
  var wireFrameGuiController = gui.add(controls,'wireFrame');
  var chunkSizeGuiController = gui.add(controls,'size',['2 x 2', '4 x 4', '8 x 8', '16 x 16']);

  /*------------------***----------------------*/

  /*GUI Events*/
  var changeMeshingMethod = function(value){
    if(!scene){
      initScene();
    }else{
      resetScene(scene,{axes: lastAxesChosen});
    }

    if(!chunk){
      chunk = new Chunk;
      chunk.GenerateTerrain();
    }

    let meshingMethod = value == 'stupid' ? MESHING_METHOD.STUPID : value == 'culling' ? MESHING_METHOD.CULLING : MESHING_METHOD.GREEDY;
    lastMeshingChosen = meshingMethod;
    chunk.Generate(meshingMethod);

    let objInScene = createBufferGeometry(chunk.meshBuider.verticles,chunk.meshBuider.indicates,0xff000,true);
    scene.add(objInScene);
  }

  axesGuiController.onFinishChange(function(value){
      if(value == true){
        addAxesToScene();
      }else{
        removeAxesFromScence();
      }
      lastAxesChosen = value;
  });

  meshingGuiController.onFinishChange(changeMeshingMethod);

  wireFrameGuiController.onFinishChange(function(value){
    if(!scene){
      initScene();
    }else{
      resetScene(scene);
    }

    if(!chunk){
      chunk = new Chunk;
      chunk.GenerateTerrain();
    }

    let objInScene = createBufferGeometry(chunk.meshBuider.verticles,chunk.meshBuider.indicates,0xff000,value);
    scene.add(objInScene);
  });

  chunkSizeGuiController.onFinishChange(function(value){
    if(!scene){
      initScene();
    }else{
      resetScene(scene,{axes:lastAxesChosen});
    }

    chunk = new Chunk;
    chunk.CHUNK_SIZE = determineChunkSizeFromControls(value);
    chunk.GenerateTerrain();
    chunk.Generate(lastMeshingChosen);

    let meshingMethod = value == 'stupid' ? MESHING_METHOD.STUPID : value == 'culling' ? MESHING_METHOD.CULLING : MESHING_METHOD.GREEDY;
    chunk.Generate(meshingMethod);

    let objInScene = createBufferGeometry(chunk.meshBuider.verticles,chunk.meshBuider.indicates,0xff000,true);
    scene.add(objInScene);
  });

  initScene({axes:true});
  camera = new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,1000);

  var renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(window.innerWidth,window.innerHeight);
  document.body.appendChild(renderer.domElement);

  cameraControls	= new THREE.TrackballControls( camera, document.body )

  //first init
  chunk = new Chunk;
  chunk.CHUNK_SIZE = determineChunkSizeFromControls(CHUNK_SIZE.x4);
  chunk.GenerateTerrain();
  chunk.Generate(MESHING_METHOD.GREEDY);
  let objInScene = createBufferGeometry(chunk.meshBuider.verticles,chunk.meshBuider.indicates,0xff000,true);
  scene.add(objInScene);

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
