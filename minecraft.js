var Mathf = {
  degree2radian: function(degrees){
    return degrees * (Math.PI / 180);
  },
  radian2degree: function(radian){
    return radian * 180 / Math.PI;
  }
}

const vsShaderSource = `
  attribute vec3 inPos;

  uniform mat4 model;
  uniform mat4 view;
  uniform mat4 projection;

  void main(){
    gl_Position = projection * view * vec4(inPos,1.0);
  }
`;

const fsShaderSource = `
  void main(){
    gl_FragColor = vec4(1.0, 0.5, 1.0, 1.0);
  }
`;

var Shader = function(){
  this.ID = 0;
}

Shader.prototype.Init = function(source,type){

  if(typeof gl === "undefined"){
    console.error("gl is undefined");
    return;
  }

  this.ID = gl.createShader(type);
  gl.shaderSource(this.ID,source);
  gl.compileShader(this.ID);
  if(!gl.getShaderParameter(this.ID,gl.COMPILE_STATUS)){
    console.log("An error occurred compiling the shader: " + gl.getShaderInfoLog(this.ID));
    gl.deleteShader(this.ID);
  }else{
    console.log("Shader compiling succeed !!!");
  }
}

var ShaderProgram = function(){
  this.ID = 0;
}

ShaderProgram.prototype.Init = function(vsSource,fsSource){
  if(typeof gl === "undefined"){
    console.error("gl is undefined");
    return;
  }

  let vertexShader = new Shader;
  vertexShader.Init(vsSource,gl.VERTEX_SHADER);

  let fragmentShader = new Shader;
  fragmentShader.Init(fsSource,gl.FRAGMENT_SHADER);

  this.ID = gl.createProgram();
  gl.attachShader(this.ID, vertexShader.ID);
  gl.attachShader(this.ID, fragmentShader.ID);
  gl.linkProgram(this.ID);

  if(!gl.getProgramParameter(this.ID,gl.LINK_STATUS)){
    console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(this.ID));
    gl.deleteProgram(this.ID);
  }else{
    console.log("Program linking succeed !!!");
    gl.deleteShader(vertexShader.ID);
    gl.deleteShader(fragmentShader.ID);
  }
}

ShaderProgram.prototype.Use = function(){
  if(typeof gl === "undefined"){
    console.error("gl is undefined");
    return;
  }

  gl.useProgram(this.ID);
}

ShaderProgram.prototype.getAttribLocation = function(attributeName){
  if(typeof gl === "undefined"){
    console.error("gl is undefined");
    return;
  }

  return gl.getAttribLocation(this.ID,attributeName);
}

ShaderProgram.prototype.SetMatrix4 = function(uniformName,value){
  if(typeof gl === "undefined"){
    console.error("gl is undefined");
    return;
  }

  let location = gl.getUniformLocation(this.ID,uniformName);

  gl.uniformMatrix4fv(location,false,value);
}

var Quad = function(p1,p2,p3,p4,properties){
  this.p1 = p1 || glMatrix.vec3.create();
  this.p2 = p2 || glMatrix.vec3.create();
  this.p3 = p3 || glMatrix.vec3.create();
  this.p4 = p4 || glMatrix.vec3.create();

  this.QuadProperties = Object.assign({
    type: VOXELTYPE.AIR_VOXEL,
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
    type: VOXELTYPE.AIR_VOXEL,
    transparent:true
  },properties);

  this.isTransparent = () => {return this.VoxelProperties.transparent};
  this.getType = () => {return this.VoxelProperties.type};
  this.isSolid = () => {return this.getType() != VOXELTYPE.AIR_VOXEL};
}

Voxel.prototype.equals = function(voxel){
  if(this.getType() == voxel.getType() && this.isTransparent() == voxel.isTransparent()){
    return true;
  }
  return false;
};

var MeshBuilder = function(shaderProgram){
  this.verticles = [];
  this.faceCount = 0;
  this.VAO = 0;
  this.shaderProgram = shaderProgram;
};

MeshBuilder.prototype.addQuad = function(quad){
  this.verticles.push(quad.p1[0]);
  this.verticles.push(quad.p1[1]);
  this.verticles.push(quad.p1[2]);

  this.verticles.push(quad.p2[0]);
  this.verticles.push(quad.p2[1]);
  this.verticles.push(quad.p2[2]);

  this.verticles.push(quad.p3[0]);
  this.verticles.push(quad.p3[1]);
  this.verticles.push(quad.p3[2]);

  this.verticles.push(quad.p4[0]);
  this.verticles.push(quad.p4[1]);
  this.verticles.push(quad.p4[2]);

  this.faceCount++;
}

MeshBuilder.prototype.generateVBO = function(){
  if(this.verticles.length == 0){
    console.error("Nothing to generate");
    return;
  }

  this.VAO = gl.createVertexArray();
  gl.bindVertexArray(this.VAO);

  let VBO = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,VBO);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.verticles),gl.STATIC_DRAW);

  gl.vertexAttribPointer(this.shaderProgram.getAttribLocation("inPos"),3,gl.FLOAT,false,0,0);
  gl.enableVertexAttribArray(this.shaderProgram.getAttribLocation("inPos"));
}

MeshBuilder.prototype.render = function(){
  if(this.VAO == 0){
    console.error("VAO is not initialized");
    return;
  }

  gl.bindVertexArray(this.VAO);
  this.shaderProgram.Use();
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
}

var Camera = function(){
  this.cameraPos = glMatrix.vec3.fromValues(0.0,0.0,3.0);
  this.cameraFront = glMatrix.vec3.fromValues(0.0,0.0,-1.0);
  this.cameraUp = glMatrix.vec3.fromValues(0.0,1.0,0.0);
  this.cameraSpeed = 0.02;
  this.sensitivity = 0.005;
  this.pitch = 0.0;
  this.yaw = -90.0;
  this.firstMouse = true;
  this.lastX = 0;
  this.lastY = 0;
}

Camera.prototype.getViewMatrix = function(){
  let view = glMatrix.mat4.create();
  let center = glMatrix.vec3.create();
  glMatrix.vec3.add(center,this.cameraFront,this.cameraPos);
  glMatrix.mat4.lookAt(view,this.cameraPos,center,this.cameraUp);
  return view;
}

Camera.prototype.MoveForward = function(deltaTime){
  let speed = this.cameraSpeed * deltaTime;
  let scaledCameraFront = glMatrix.vec3.create();
  glMatrix.vec3.scale(scaledCameraFront,this.cameraFront,speed);
  glMatrix.vec3.add(this.cameraPos,this.cameraPos,scaledCameraFront);
}

Camera.prototype.MoveBackward = function(deltaTime){
  let speed = this.cameraSpeed * deltaTime;
  let scaledCameraFront = glMatrix.vec3.create();
  glMatrix.vec3.scale(scaledCameraFront,this.cameraFront,speed);
  glMatrix.vec3.subtract(this.cameraPos,this.cameraPos,scaledCameraFront);
}

Camera.prototype.GoLeft = function(deltaTime){
  let speed = this.cameraSpeed * deltaTime;
  let cameraRight = glMatrix.vec3.create();
  glMatrix.vec3.cross(cameraRight,this.cameraFront,this.cameraUp);
  glMatrix.vec3.normalize(cameraRight,cameraRight);
  glMatrix.vec3.scale(cameraRight,cameraRight,speed);
  glMatrix.vec3.subtract(this.cameraPos,this.cameraPos,cameraRight);
}

Camera.prototype.GoRight = function(deltaTime){
  let speed = this.cameraSpeed * deltaTime;
  let cameraRight = glMatrix.vec3.create();
  glMatrix.vec3.cross(cameraRight,this.cameraFront,this.cameraUp);
  glMatrix.vec3.normalize(cameraRight,cameraRight);
  glMatrix.vec3.scale(cameraRight,cameraRight,speed);
  glMatrix.vec3.add(this.cameraPos,this.cameraPos,cameraRight);
}

Camera.prototype.TurnAround = function(x,y){
  if(this.firstMouse){
    this.lastX = x;
    this.lastY = y;
    this.firstMouse = false;
  }

  let xOffset = x - this.lastX;
  let yOffset = this.lastY - y;

  xOffset *= this.sensitivity;
  yOffset *= this.sensitivity;

  this.yaw += xOffset;
  this.pitch += yOffset;

  if(this.pitch > 89.0) this.pitch = 89.0;
  if(this.pitch < -89.0) this.pitch = -89.0;

  let front = glMatrix.vec3.create();
  front[0] = Math.cos(Mathf.degree2radian(this.yaw)) + Math.cos(Mathf.degree2radian(this.pitch));
  front[1] = Math.sin(Mathf.degree2radian(this.pitch));
  front[2] = Math.cos(Mathf.degree2radian(this.pitch)) + Math.sin(Mathf.degree2radian(this.yaw));

  glMatrix.vec3.normalize(this.cameraFront,front);
}

/*GLOBAL VARIABLES*/
const VOXELTYPE = {
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

var shaderProgram = null;
/*----------------*/

const GAMESTATE = {
  NOT_INITIALIZED: "Not initialized",
  RUNNING: "Running",
  PAUSE: "Paused",
  EXIT: "Exited"
}

var Game = function(settings){
  this.gameSettings = Object.assign({
    width: 640,
    height: 480,
    title: "Minecraft WebGL Demo"
  },settings);

  this.camera = null;
  this.deltaTime = 0;
  this.maxFPS = 60;
  this.lastFrameTimeMs = 0;

  this.currentGameState = GAMESTATE.NOT_INITIALIZED;
}

Game.prototype.changeState = function(state){
  this.currentGameState = state;
}

Game.prototype.Init = function(){
  console.log("Initializing...");
  this.camera = new Camera();

  shaderProgram = new ShaderProgram;
  shaderProgram.Init(vsShaderSource,fsShaderSource);

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;

  this.projectionMatrix = glMatrix.mat4.create();

  glMatrix.mat4.perspective(this.projectionMatrix,fieldOfView,aspect,zNear,zFar);

  let q = new Quad(
    glMatrix.vec3.fromValues(-0.5,0.5,0.0),
    glMatrix.vec3.fromValues(0.5,0.5,0.0),
    glMatrix.vec3.fromValues(-0.5,-0.5,0.0),
    glMatrix.vec3.fromValues(0.5,-0.5,0.0)
  );

  this.meshBuider = new MeshBuilder(shaderProgram);
  this.meshBuider.addQuad(q);
  this.meshBuider.generateVBO();

  this.changeState(GAMESTATE.RUNNING);
}

Game.prototype.Update = function(){
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  shaderProgram.Use();

  shaderProgram.SetMatrix4("projection",this.projectionMatrix);
  shaderProgram.SetMatrix4("view",this.camera.getViewMatrix());

  this.meshBuider.render();
}

Game.prototype.ProcessKeyInput = function(e){
  if(e.keyCode == 27){
    console.log("exit");
  }

  if(e.keyCode == 87){
    //key W
    this.camera.MoveForward(this.deltaTime);
  }

  if(e.keyCode == 83){
    //key S
    this.camera.MoveBackward(this.deltaTime);
  }

  if(e.keyCode == 65){
    //key A
    this.camera.GoLeft(this.deltaTime);
  }

  if(e.keyCode == 68){
    //key D
    this.camera.GoRight(this.deltaTime);
  }
};

Game.prototype.ProcessMouseInput = function(mouseX,mouseY){
  this.camera.TurnAround(mouseX,mouseY);
}

var game = new Game();

function mainLoop(timestamp){
  if(timestamp < game.lastFrameTimeMs + (1000 / game.maxFPS)){
    window.requestAnimationFrame(mainLoop);
    return;
  }

  game.deltaTime = timestamp - game.lastFrameTimeMs;
  game.lastFrameTimeMs = timestamp;

  game.Update();
  window.requestAnimationFrame(mainLoop);
}

function KeyCallback(e){
  game.ProcessKeyInput(e);
}

function MouseMoveCallback(e){
  let rect = e.target.getBoundingClientRect();

  if(e.clientX > rect.left && e.clientX < rect.right && e.clientY > rect.top && e.clientY < rect.bottom){
    game.ProcessMouseInput(e.clientX - rect.left,e.clientY - rect.top);
  }
}

//start here
function main(){
  const canvas = document.querySelector("#glCanvas");

  document.addEventListener("keydown",KeyCallback);
  document.addEventListener("mousemove",MouseMoveCallback);

  gl = canvas.getContext("webgl2");

  if(gl === null){
    alert("Your web browser doesn't not support webgl");
    return;
  }

  gl.clearColor(0.0,0.0,0.0,1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  game.Init(gl);

  window.requestAnimationFrame(mainLoop);

}

window.onload = main;
