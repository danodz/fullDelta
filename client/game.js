document.addEventListener("DOMContentLoaded",init);

ship = {};
ui = { speedControl : createHandleBar( 0, -10, 50, 300, 10, -100, 100)
     };
connected = false;

verbose = true;

function init()
{
    conn = new WebSocket("ws://0.0.0.0:9000");
    conn.onopen = function (event) {
        connected = true;
        conn.send("Hello"); 
    };
    conn.onmessage = function (event) {
        ship = event.data;
        if(verbose)
            console.log(ship);
    }
    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    canvas.height = innerHeight;
    canvas.width = innerWidth;
    debugMode = true;
    singleClick = false;
    
    ctx = canvas.getContext("2d");
    
    camX = 0;
    camY = 0;
    
    keys = {};
    keysPressed = {};
    keysReleased = {};
    
    mousePos = {x:0,y:0};
    getMousePosE = function(canvas, evt)
    {
        var rect = canvas.getBoundingClientRect();
        
        return { x : evt.clientX - rect.left - (innerWidth/2)
               , y : -(evt.clientY - rect.top) + (innerHeight/2)
               };
    }
    canvas.addEventListener('mousemove', function(evt)
    {
        mousePos = getMousePosE( canvas , evt );
    }, false);
    
    mouseDown = false;
    mouseClick = false;
    canvas.addEventListener( 'mousedown' , function(){ mouseDown = true; } );
    canvas.addEventListener( 'mouseup' , function(){ mouseDown = false; } );
    canvas.addEventListener( 'click' , function(){ mouseClick = true; } );
    
    document.body.onkeydown = function(e)
    {
        var evt = e || event.keyCode;
        var press = evt.which || event.keyCode;
        
        if ( window["logKeys"] )
            console.log(press);
        
        if ( !keys[press+""] )
            keysPressed[ press+"" ] = true;
        
        keys[ press+"" ] = true;
    };
    
    document.body.onkeyup = function(e)
    {
        var evt = e || event.keyCode;
        var press = evt.which || event.keyCode;
        
        keys[ press+"" ] = false;
        keysReleased[ press+"" ] = true;
    }
    
    requestAnimationFrame( gameUpdate );
}

function createHandleBar(x, y, width, height, defaultValue)
{
    var bar = { x : x
              , y : y
              , handleY : defaultValue
              , width : width
              , height : height
              , dragging : false
              , value : defaultValue
              , update : function()
                  {
                      if(mouseDown && collideMouse( this ))
                      {
                          this.dragging = true;
                      }
                      if(!mouseDown)
                      {
                          this.dragging = false;
                      }
                      if(this.dragging)
                      {
                          this.handleY = mousePos.y;
                          if(this.handleY < this.y + 5 - this.height / 2)
                          {
                              this.handleY = this.y + 5 - this.height / 2;
                          }
                          if(this.handleY > this.y - 5 + this.height / 2)
                          {
                              this.handleY = this.y - 5 + this.height / 2;
                          }

                          this.value = (1 / (this.height - 10)) * (this.handleY + (height-10)/2 - this.y);
                      }
                  }
              , draw : function()
                  {
                      drawRect(this.x, this.handleY, this.width, 10, "lightgray");
                      drawStrokeRect(this.x, this.y, this.width, this.height, 3, "white");
                  }
              }
    return bar;
}

function drawRect( x , y , width , height , color )
{
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect( x-(width/2) , y-(height/2) , width , height );
    ctx.restore();
}

function drawStrokeRect( x , y , width , height, lineWidth , color )
{
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth
    ctx.strokeRect( x-(width/2) , y-(height/2) , width , height );
    ctx.restore();
}

function gameUpdate()
{
    clearCanvas("black");

    ctx.save();
    ctx.translate( innerWidth/2 , innerHeight/2 );
    ctx.scale( 1 , -1 );

    for (var i in ui)
    {
        ui[i].update();
        ui[i].draw();
    }
    if(connected)
        conn.send( JSON.stringify( ["SetSpeed", ui.speedControl.value.toString()] ) );

    ctx.restore();

    mouseClick = false;
    requestAnimationFrame( gameUpdate );
}

function collideAABB( box1 , box2 )
{
   if ( Math.abs(box1.x - box2.x) < ((box1.width+box2.width)/2) )
       if ( Math.abs(box1.y - box2.y) < ((box1.height+box2.height)/2) )
           return true;
   return false;
}

function collideMouse( box )
{
    return collideAABB( {x : mousePos.x, y : mousePos.y, width : 1, height : 1}, box );
}

function clearCanvas( color )
{
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
}
